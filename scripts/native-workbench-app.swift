import Cocoa
import WebKit

struct CommandResult {
  let exitCode: Int32
  let stdout: String
  let stderr: String
  let timedOut: Bool
}

final class PendingRequest {
  let semaphore = DispatchSemaphore(value: 0)
  var response: [String: Any]?
  var error: String?
}

final class PendingTurn {
  let semaphore = DispatchSemaphore(value: 0)
  var text = ""
  var completedText: String?
  var events: [[String: Any]] = []
  var completed: [String: Any]?
  var error: String?
}

final class CodexAppServerClient {
  private static let requestTimeout: TimeInterval = 45
  private static let turnTimeout: TimeInterval = 180
  private static let stderrLimit = 8000
  private let workspaceRoot: URL
  private var process: Process?
  private var stdinHandle: FileHandle?
  private var stdoutBuffer = Data()
  private var stderrTail = ""
  private var processExitDescription: String?
  private var nextRequestId = 1
  private var pendingRequests: [Int: PendingRequest] = [:]
  private var pendingTurns: [String: PendingTurn] = [:]
  private var threadId: String?
  private var initialized = false
  private let lock = NSLock()
  private let turnLock = NSLock()
  var onEvent: (([String: Any]) -> Void)?

  init(workspaceRoot: URL) {
    self.workspaceRoot = workspaceRoot
  }

  func send(prompt: String, requestedThreadId: String?, model: String?, effort: String?) throws -> [String: Any] {
    turnLock.lock()
    defer { turnLock.unlock() }

    try ensureInitialized()
    if let requestedThreadId, !requestedThreadId.isEmpty, requestedThreadId != threadId {
      try resumeThread(requestedThreadId)
    }
    let thread = try ensureThread()
    var turnParams: [String: Any] = [
      "threadId": thread,
      "input": [["type": "text", "text": prompt, "text_elements": []]],
      "cwd": workspaceRoot.path,
      "approvalPolicy": "never",
      "sandboxPolicy": ["type": "readOnly", "networkAccess": false]
    ]
    if let model, !model.isEmpty {
      turnParams["model"] = model
    }
    if let effort, !effort.isEmpty {
      turnParams["effort"] = effort
    }
    let turnResponse = try request(
      method: "turn/start",
      params: turnParams,
      timeout: Self.requestTimeout
    )
    guard
      let result = turnResponse["result"] as? [String: Any],
      let turn = result["turn"] as? [String: Any],
      let turnId = turn["id"] as? String
    else {
      throw BridgeError.invalidPayload("app-server turn/start returned no turn id")
    }

    lock.lock()
    let pendingTurn = turnBucketLocked(turnId)
    pendingTurns[turnId] = pendingTurn
    lock.unlock()

    if pendingTurn.semaphore.wait(timeout: .now() + Self.turnTimeout) == .timedOut {
      lock.lock()
      let eventCount = pendingTurn.events.count
      pendingTurns.removeValue(forKey: turnId)
      let diagnostics = diagnosticSuffixLocked()
      lock.unlock()
      throw BridgeError.invalidPayload("app-server turn timed out after \(Int(Self.turnTimeout))s: threadId=\(thread), turnId=\(turnId), events=\(eventCount)\(diagnostics)")
    }

    lock.lock()
    pendingTurns.removeValue(forKey: turnId)
    let finalText = pendingTurn.completedText ?? pendingTurn.text
    let events = pendingTurn.events
    let completed = pendingTurn.completed ?? [:]
    let turnError = pendingTurn.error
    let diagnostics = diagnosticSuffixLocked()
    lock.unlock()

    if let turnError {
      throw BridgeError.invalidPayload("app-server turn error: threadId=\(thread), turnId=\(turnId), error=\(turnError)\(diagnostics)")
    }
    if
      let completedTurn = completed["turn"] as? [String: Any],
      let status = completedTurn["status"] as? String,
      status != "completed"
    {
      throw BridgeError.invalidPayload("app-server turn \(status): threadId=\(thread), turnId=\(turnId), error=\(describeValue(completedTurn["error"]))\(diagnostics)")
    }

    return [
      "executor": "codex_app_server",
      "transport": "stdio_json_rpc",
      "threadId": thread,
      "turnId": turnId,
      "finalMessage": finalText,
      "eventCount": events.count,
      "completed": completed,
      "cwd": workspaceRoot.path,
      "model": model ?? "configured_default",
      "effort": effort ?? "configured_default"
    ]
  }

  func listModels() throws -> [String: Any] {
    turnLock.lock()
    defer { turnLock.unlock() }
    try ensureInitialized()
    let response = try request(
      method: "model/list",
      params: ["includeHidden": false],
      timeout: Self.requestTimeout
    )
    guard let result = response["result"] as? [String: Any] else {
      throw BridgeError.invalidPayload("app-server model/list returned no result")
    }
    return result
  }

  private func ensureInitialized() throws {
    if initialized, process?.isRunning == true { return }
    initialized = false
    try startProcess()
    _ = try request(
      method: "initialize",
      params: [
        "clientInfo": [
          "name": "opl-native-workbench",
          "title": "One Person Lab Native Workbench",
          "version": "0.1.0"
        ],
        "capabilities": [
          "experimentalApi": true,
          "requestAttestation": false
        ]
      ],
      timeout: 30
    )
    try send(frame: ["method": "initialized"])
    initialized = true
  }

  private func ensureThread() throws -> String {
    if let threadId { return threadId }
    let response = try request(
      method: "thread/start",
      params: [
        "cwd": workspaceRoot.path,
        "sandbox": "read-only",
        "approvalPolicy": "never",
        "threadSource": "opl-native-workbench",
        "ephemeral": false
      ],
      timeout: Self.requestTimeout
    )
    guard
      let result = response["result"] as? [String: Any],
      let thread = result["thread"] as? [String: Any],
      let id = thread["id"] as? String
    else {
      throw BridgeError.invalidPayload("app-server thread/start returned no thread id")
    }
    threadId = id
    return id
  }

  private func resumeThread(_ id: String) throws {
    let response = try request(
      method: "thread/resume",
      params: [
        "threadId": id,
        "cwd": workspaceRoot.path,
        "sandbox": "read-only",
        "approvalPolicy": "never"
      ],
      timeout: Self.requestTimeout
    )
    guard
      let result = response["result"] as? [String: Any],
      let thread = result["thread"] as? [String: Any],
      let resumedId = thread["id"] as? String
    else {
      throw BridgeError.invalidPayload("app-server thread/resume returned no thread id")
    }
    threadId = resumedId
  }

  private func startProcess() throws {
    if process?.isRunning == true { return }
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = ["codex", "app-server", "--stdio"]
    process.currentDirectoryURL = workspaceRoot
    process.environment = ProcessInfo.processInfo.environment

    let stdoutPipe = Pipe()
    let stderrPipe = Pipe()
    let stdinPipe = Pipe()
    process.standardOutput = stdoutPipe
    process.standardError = stderrPipe
    process.standardInput = stdinPipe
    process.terminationHandler = { [weak self] terminated in
      self?.handleProcessExit(terminated)
    }

    stdoutPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
      self?.consumeStdout(handle.availableData)
    }
    stderrPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
      self?.consumeStderr(handle.availableData)
    }

    self.process = process
    self.stdinHandle = stdinPipe.fileHandleForWriting
    stdoutBuffer.removeAll()
    stderrTail = ""
    processExitDescription = nil
    do {
      try process.run()
    } catch {
      self.process = nil
      self.stdinHandle = nil
      throw error
    }
  }

  private func request(method: String, params: [String: Any], timeout: TimeInterval) throws -> [String: Any] {
    lock.lock()
    let id = nextRequestId
    nextRequestId += 1
    let pending = PendingRequest()
    pendingRequests[id] = pending
    lock.unlock()

    do {
      try send(frame: ["method": method, "id": id, "params": params])
    } catch {
      lock.lock()
      pendingRequests.removeValue(forKey: id)
      lock.unlock()
      throw error
    }
    if pending.semaphore.wait(timeout: .now() + timeout) == .timedOut {
      lock.lock()
      pendingRequests.removeValue(forKey: id)
      let diagnostics = diagnosticSuffixLocked()
      lock.unlock()
      throw BridgeError.invalidPayload("app-server request timed out after \(Int(timeout))s: method=\(method), id=\(id)\(diagnostics)")
    }
    if let error = pending.error {
      throw BridgeError.invalidPayload("app-server request failed: method=\(method), id=\(id), error=\(error)")
    }
    guard let response = pending.response else {
      throw BridgeError.invalidPayload("app-server request returned no response: \(method)")
    }
    if let error = response["error"] {
      throw BridgeError.invalidPayload("app-server \(method) error: \(describeValue(error))")
    }
    return response
  }

  private func send(frame: [String: Any]) throws {
    guard
      JSONSerialization.isValidJSONObject(frame),
      let data = try? JSONSerialization.data(withJSONObject: frame, options: []),
      var line = String(data: data, encoding: .utf8)
    else {
      throw BridgeError.invalidPayload("app-server frame is not valid JSON: \(describeValue(frame))")
    }
    guard let stdinHandle else {
      lock.lock()
      let diagnostics = diagnosticSuffixLocked()
      lock.unlock()
      throw BridgeError.invalidPayload("app-server stdin is not available\(diagnostics)")
    }
    line.append("\n")
    stdinHandle.write(Data(line.utf8))
  }

  private func consumeStdout(_ data: Data) {
    guard !data.isEmpty else { return }
    lock.lock()
    stdoutBuffer.append(data)
    while let newline = stdoutBuffer.firstIndex(of: 10) {
      let lineData = stdoutBuffer.subdata(in: 0..<newline)
      stdoutBuffer.removeSubrange(0...newline)
      if lineData.isEmpty { continue }
      handleMessageData(lineData)
    }
    lock.unlock()
  }

  private func consumeStderr(_ data: Data) {
    guard !data.isEmpty, let chunk = String(data: data, encoding: .utf8), !chunk.isEmpty else { return }
    lock.lock()
    stderrTail.append(chunk)
    if stderrTail.count > Self.stderrLimit {
      stderrTail = String(stderrTail.suffix(Self.stderrLimit))
    }
    lock.unlock()
  }

  private func handleProcessExit(_ terminated: Process) {
    lock.lock()
    if process === terminated {
      process = nil
      stdinHandle = nil
      initialized = false
      threadId = nil
    }
    let reason = "app-server process exited with code \(terminated.terminationStatus)"
    processExitDescription = reason
    failPendingLocked(reason)
    lock.unlock()
  }

  private func failPendingLocked(_ error: String) {
    for pending in pendingRequests.values {
      pending.error = "\(error)\(diagnosticSuffixLocked())"
      pending.semaphore.signal()
    }
    pendingRequests.removeAll()
    for pendingTurn in pendingTurns.values {
      pendingTurn.error = "\(error)\(diagnosticSuffixLocked())"
      pendingTurn.semaphore.signal()
    }
    pendingTurns.removeAll()
  }

  private func turnBucketLocked(_ turnId: String) -> PendingTurn {
    if let existing = pendingTurns[turnId] { return existing }
    let pendingTurn = PendingTurn()
    pendingTurns[turnId] = pendingTurn
    return pendingTurn
  }

  private func diagnosticSuffixLocked() -> String {
    var parts: [String] = []
    if let processExitDescription {
      parts.append("process=\(processExitDescription)")
    }
    let stderr = stderrTail.trimmingCharacters(in: .whitespacesAndNewlines)
    if !stderr.isEmpty {
      parts.append("stderr=\(stderr)")
    }
    return parts.isEmpty ? "" : "; " + parts.joined(separator: "; ")
  }

  private func handleMessageData(_ data: Data) {
    guard
      let message = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
    else { return }

    if let id = message["id"] as? Int, let pending = pendingRequests.removeValue(forKey: id) {
      pending.response = message
      pending.semaphore.signal()
      return
    }

    if let method = message["method"] as? String {
      if let params = message["params"] as? [String: Any] {
        if method == "turn/started",
           let turn = params["turn"] as? [String: Any],
           let turnId = turn["id"] as? String {
          turnBucketLocked(turnId).events.append(message)
        }
        if method == "item/agentMessage/delta",
           let turnId = params["turnId"] as? String,
           let delta = params["delta"] as? String {
          let pendingTurn = turnBucketLocked(turnId)
          pendingTurn.text.append(delta)
          pendingTurn.events.append(message)
        }
        if method == "item/completed",
           let turnId = params["turnId"] as? String,
           let item = params["item"] as? [String: Any] {
          let pendingTurn = turnBucketLocked(turnId)
          if item["type"] as? String == "agentMessage", let text = item["text"] as? String {
            pendingTurn.completedText = text
          }
          pendingTurn.events.append(message)
        }
        if method == "error",
           let turnId = params["turnId"] as? String {
          let pendingTurn = turnBucketLocked(turnId)
          pendingTurn.error = describeValue(params["error"])
          pendingTurn.events.append(message)
          if (params["willRetry"] as? Bool) != true {
            pendingTurn.semaphore.signal()
          }
        }
        if method == "turn/completed",
           let turn = params["turn"] as? [String: Any],
           let turnId = turn["id"] as? String {
          let pendingTurn = turnBucketLocked(turnId)
          pendingTurn.completed = params
          pendingTurn.events.append(message)
          pendingTurn.semaphore.signal()
        }
      }
      DispatchQueue.main.async {
        self.onEvent?(message)
      }
    }
  }
}

final class NativeBridge: NSObject, WKScriptMessageHandler {
  weak var webView: WKWebView?
  private let workspaceRoot: URL
  private lazy var appServer = CodexAppServerClient(workspaceRoot: workspaceRoot)

  init(workspaceRoot: URL) {
    self.workspaceRoot = workspaceRoot
    super.init()
    self.appServer.onEvent = { [weak self] event in
      self?.emit(event: event)
    }
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard
      let body = message.body as? [String: Any],
      let id = body["id"] as? String,
      let method = body["method"] as? String
    else { return }

    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let payload = try self.handle(method: method, payload: body["payload"] as? [String: Any] ?? [:])
        self.resolve(id: id, ok: true, payload: payload)
      } catch {
        self.resolve(id: id, ok: false, payload: ["error": String(describing: error)])
      }
    }
  }

  private func handle(method: String, payload: [String: Any]) throws -> [String: Any] {
    switch method {
    case "readState":
      let profile = (payload["profile"] as? String) == "full" ? "full" : "fast"
      return commandPayload(command: ["opl", "app", "state", "--profile", profile, "--json"], input: nil, timeout: 30)
    case "readFullDrilldown":
      return commandPayload(command: ["opl", "runtime", "app-operator-drilldown", "--detail", "full", "--json"], input: nil, timeout: 45)
    case "executeAction":
      guard let actionId = payload["actionId"] as? String, !actionId.isEmpty else {
        throw BridgeError.invalidPayload("missing actionId")
      }
      let actionPayload = payload["payload"] as? [String: Any] ?? [:]
      let dryRun = (payload["dryRun"] as? Bool) != false
      let confirmed = actionPayload["confirmed"] as? Bool == true
      let rollbackRef = stringValue(actionPayload["rollbackRef"])
      let receiptKind = actionReceiptKind(mode: payload["mode"] as? String, dryRun: dryRun, confirmed: confirmed, rollbackRef: rollbackRef)
      var args = ["opl", "app", "action", "execute", "--action", actionId]
      if !actionPayload.isEmpty {
        args.append("--payload")
        args.append(jsonString(actionPayload))
      }
      if dryRun {
        args.append("--dry-run")
      }
      args.append("--json")
      if !dryRun && !confirmed {
        return actionCommandPayload(
          actionId: actionId,
          command: args,
          result: CommandResult(exitCode: -1, stdout: "", stderr: "confirmation_required", timedOut: false),
          dryRun: false,
          confirmationRequired: true,
          canExecute: false,
          receiptKind: "confirmation_required",
          confirmationId: stringValue(actionPayload["confirmationId"]),
          receiptId: stringValue(actionPayload["receiptId"]),
          rollbackRef: rollbackRef
        )
      }
      let result = runCommand(args, input: nil, cwd: workspaceRoot, timeout: 45)
      return actionCommandPayload(
        actionId: actionId,
        command: args,
        result: result,
        dryRun: dryRun,
        confirmationRequired: dryRun,
        canExecute: true,
        receiptKind: receiptKind,
        confirmationId: stringValue(actionPayload["confirmationId"]),
        receiptId: stringValue(actionPayload["receiptId"]),
        rollbackRef: rollbackRef
      )
    case "sendMessage":
      guard let prompt = payload["prompt"] as? String, !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw BridgeError.invalidPayload("missing prompt")
      }
      return try appServer.send(
        prompt: prompt,
        requestedThreadId: payload["threadId"] as? String,
        model: payload["model"] as? String,
        effort: payload["reasoningEffort"] as? String
      )
    case "readCodexModels":
      return try appServer.listModels()
    default:
      throw BridgeError.invalidPayload("unknown method \(method)")
    }
  }

  private func commandPayload(command: [String], input: String?, timeout: TimeInterval) -> [String: Any] {
    let result = runCommand(command, input: input, cwd: workspaceRoot, timeout: timeout)
    return [
      "command": command.joined(separator: " "),
      "exitCode": result.exitCode,
      "stdout": result.stdout,
      "stderr": result.stderr,
      "timedOut": result.timedOut
    ]
  }

  private func actionCommandPayload(
    actionId: String,
    command: [String],
    result: CommandResult,
    dryRun: Bool,
    confirmationRequired: Bool,
    canExecute: Bool,
    receiptKind: String,
    confirmationId: String?,
    receiptId: String?,
    rollbackRef: String?
  ) -> [String: Any] {
    var payload: [String: Any] = [
      "actionId": actionId,
      "dryRun": dryRun,
      "confirmationRequired": confirmationRequired,
      "canExecute": canExecute,
      "receiptKind": receiptKind,
      "authorityBoundary": "app_bridge_no_domain_authority",
      "command": command.joined(separator: " "),
      "exitCode": result.exitCode,
      "stdout": result.stdout,
      "stderr": result.stderr,
      "timedOut": result.timedOut
    ]
    if let confirmationId { payload["confirmationId"] = confirmationId }
    if let receiptId { payload["receiptId"] = receiptId }
    if let rollbackRef { payload["rollbackRef"] = rollbackRef }
    return payload
  }

  private func runCommand(_ args: [String], input: String?, cwd: URL, timeout: TimeInterval) -> CommandResult {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = args
    process.currentDirectoryURL = cwd
    process.environment = ProcessInfo.processInfo.environment

    let stdoutPipe = Pipe()
    let stderrPipe = Pipe()
    let stdinPipe = Pipe()
    process.standardOutput = stdoutPipe
    process.standardError = stderrPipe
    process.standardInput = stdinPipe

    do {
      try process.run()
      if let input {
        stdinPipe.fileHandleForWriting.write(Data(input.utf8))
      }
      try? stdinPipe.fileHandleForWriting.close()

      let deadline = Date().addingTimeInterval(timeout)
      while process.isRunning && Date() < deadline {
        Thread.sleep(forTimeInterval: 0.1)
      }
      let timedOut = process.isRunning
      if timedOut {
        process.terminate()
      }
      process.waitUntilExit()
      let stdout = String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
      let stderr = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
      return CommandResult(exitCode: timedOut ? -1 : process.terminationStatus, stdout: stdout, stderr: stderr, timedOut: timedOut)
    } catch {
      return CommandResult(exitCode: -1, stdout: "", stderr: String(describing: error), timedOut: false)
    }
  }

  private func resolve(id: String, ok: Bool, payload: [String: Any]) {
    let js = "window.__oplNativeWorkbenchResolve(\(jsonString(id)), \(ok ? "true" : "false"), \(jsonString(payload)));"
    DispatchQueue.main.async {
      self.webView?.evaluateJavaScript(js)
    }
  }

  private func emit(event: [String: Any]) {
    let js = "window.__oplNativeWorkbenchEvent(\(jsonString(event)));"
    self.webView?.evaluateJavaScript(js)
  }
}

enum BridgeError: Error {
  case invalidPayload(String)
}

func actionReceiptKind(mode: String?, dryRun: Bool, confirmed: Bool, rollbackRef: String?) -> String {
  if !dryRun && !confirmed { return "confirmation_required" }
  if mode == "rollback" || rollbackRef != nil { return "rollback" }
  if dryRun { return "preview" }
  return "execute"
}

func stringValue(_ value: Any?) -> String? {
  guard let value else { return nil }
  if let string = value as? String, !string.isEmpty { return string }
  return nil
}

func describeValue(_ value: Any?) -> String {
  guard let value else { return "null" }
  if JSONSerialization.isValidJSONObject(value),
     let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]),
     let string = String(data: data, encoding: .utf8) {
    return string
  }
  if let string = value as? String { return string }
  return String(describing: value)
}

func jsonString(_ value: Any) -> String {
  guard
    JSONSerialization.isValidJSONObject(value),
    let data = try? JSONSerialization.data(withJSONObject: value, options: []),
    let string = String(data: data, encoding: .utf8)
  else {
    let data = try? JSONSerialization.data(withJSONObject: ["value": String(describing: value)], options: [])
    return String(data: data ?? Data("null".utf8), encoding: .utf8) ?? "null"
  }
  return string
}

func jsonString(_ value: String) -> String {
  let data = try? JSONEncoder().encode(value)
  return String(data: data ?? Data("\"\"".utf8), encoding: .utf8) ?? "\"\""
}

func defaultWorkspaceRoot() -> URL {
  let fm = FileManager.default
  if let configured = ProcessInfo.processInfo.environment["OPL_NATIVE_WORKBENCH_CODEX_CWD"], !configured.isEmpty {
    return URL(fileURLWithPath: configured)
  }
  let appRepo = fm.homeDirectoryForCurrentUser.appendingPathComponent("workspace/one-person-lab-app")
  if fm.fileExists(atPath: appRepo.path) {
    return appRepo
  }
  return fm.homeDirectoryForCurrentUser
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  private var window: NSWindow?
  private var webView: WKWebView?
  private var bridge: NativeBridge?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let appName = "One Person Lab Native Workbench Candidate"
    let resourcesURL = URL(fileURLWithPath: CommandLine.arguments[0])
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .appendingPathComponent("Resources", isDirectory: true)
    let workbenchURL = resourcesURL.appendingPathComponent("workbench.html")

    let bridge = NativeBridge(workspaceRoot: defaultWorkspaceRoot())
    let userContentController = WKUserContentController()
    userContentController.add(bridge, name: "oplNativeWorkbench")

    let configuration = WKWebViewConfiguration()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    configuration.userContentController = userContentController

    let webView = WKWebView(frame: .zero, configuration: configuration)
    bridge.webView = webView
    webView.loadFileURL(workbenchURL, allowingReadAccessTo: resourcesURL)

    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = appName
    window.minSize = NSSize(width: 980, height: 680)
    window.contentView = webView
    window.center()
    window.makeKeyAndOrderFront(nil)

    self.bridge = bridge
    self.webView = webView
    self.window = window
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
