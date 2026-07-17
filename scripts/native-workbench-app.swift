import Cocoa
import WebKit

struct CommandResult {
  let exitCode: Int32
  let stdout: String
  let stderr: String
  let timedOut: Bool
}

final class CommandOutputBuffer: @unchecked Sendable {
  private let lock = NSLock()
  private var data = Data()

  func replace(with value: Data) {
    lock.lock()
    data = value
    lock.unlock()
  }

  func string() -> String {
    lock.lock()
    defer { lock.unlock() }
    return String(data: data, encoding: .utf8) ?? ""
  }
}

func runNativeCommand(
  _ args: [String],
  input: String?,
  cwd: URL,
  timeout: TimeInterval,
  environment: [String: String] = ProcessInfo.processInfo.environment
) -> CommandResult {
  let process = Process()
  if args.first == "opl", let configured = environment["OPL_APP_OPL_BIN"], !configured.isEmpty {
    process.executableURL = URL(fileURLWithPath: configured)
    process.arguments = Array(args.dropFirst())
  } else {
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = args
  }
  process.currentDirectoryURL = cwd
  process.environment = environment

  let stdoutPipe = Pipe()
  let stderrPipe = Pipe()
  let stdinPipe = Pipe()
  process.standardOutput = stdoutPipe
  process.standardError = stderrPipe
  process.standardInput = stdinPipe

  do {
    try process.run()

    let stdoutBuffer = CommandOutputBuffer()
    let stderrBuffer = CommandOutputBuffer()
    let readers = DispatchGroup()
    readers.enter()
    DispatchQueue.global(qos: .utility).async {
      stdoutBuffer.replace(with: stdoutPipe.fileHandleForReading.readDataToEndOfFile())
      readers.leave()
    }
    readers.enter()
    DispatchQueue.global(qos: .utility).async {
      stderrBuffer.replace(with: stderrPipe.fileHandleForReading.readDataToEndOfFile())
      readers.leave()
    }

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
    readers.wait()
    return CommandResult(
      exitCode: timedOut ? -1 : process.terminationStatus,
      stdout: stdoutBuffer.string(),
      stderr: stderrBuffer.string(),
      timedOut: timedOut
    )
  } catch {
    return CommandResult(exitCode: -1, stdout: "", stderr: String(describing: error), timedOut: false)
  }
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

func collectCodexModelListPages(
  fetchPage: (_ cursor: String?) throws -> [String: Any]
) throws -> [String: Any] {
  var cursor: String?
  var seenCursors = Set<String>()
  var models: [Any] = []

  repeat {
    let result = try fetchPage(cursor)
    guard let pageModels = result["data"] as? [Any] else {
      throw BridgeError.invalidPayload("app-server model/list returned invalid data")
    }
    models.append(contentsOf: pageModels)

    guard let nextCursor = result["nextCursor"] as? String, !nextCursor.isEmpty else {
      cursor = nil
      continue
    }
    guard seenCursors.insert(nextCursor).inserted else {
      throw BridgeError.invalidPayload("app-server model/list repeated cursor \(nextCursor)")
    }
    cursor = nextCursor
  } while cursor != nil

  return ["data": models, "nextCursor": NSNull()]
}

func collectCodexThreadListPages(
  initialParams: [String: Any],
  fetchPage: (_ params: [String: Any]) throws -> [String: Any]
) throws -> [String: Any] {
  var cursor: String?
  var seenCursors = Set<String>()
  var threads: [Any] = []

  repeat {
    var params = initialParams
    if let cursor { params["cursor"] = cursor }
    let result = try fetchPage(params)
    guard let pageThreads = result["data"] as? [Any] else {
      throw BridgeError.invalidPayload("app-server thread/list returned invalid data")
    }
    threads.append(contentsOf: pageThreads)

    guard let nextCursor = result["nextCursor"] as? String, !nextCursor.isEmpty else {
      cursor = nil
      continue
    }
    guard seenCursors.insert(nextCursor).inserted else {
      throw BridgeError.invalidPayload("app-server thread/list repeated cursor \(nextCursor)")
    }
    cursor = nextCursor
  } while cursor != nil

  return ["data": threads, "nextCursor": NSNull()]
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
  private let writeLock = NSLock()
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
    return try collectCodexModelListPages { cursor in
      var params: [String: Any] = ["includeHidden": false]
      if let cursor { params["cursor"] = cursor }
      let response = try request(
        method: "model/list",
        params: params,
        timeout: Self.requestTimeout
      )
      guard let result = response["result"] as? [String: Any] else {
        throw BridgeError.invalidPayload("app-server model/list returned no result")
      }
      return result
    }
  }

  func listThreads(params: [String: Any]) throws -> [String: Any] {
    try ensureInitialized()
    return try collectCodexThreadListPages(initialParams: params) { pageParams in
      let response = try request(method: "thread/list", params: pageParams, timeout: Self.requestTimeout)
      guard let result = response["result"] as? [String: Any] else {
        throw BridgeError.invalidPayload("app-server thread/list returned no result")
      }
      return result
    }
  }

  func readThread(id: String, includeTurns: Bool = true) throws -> [String: Any] {
    try ensureInitialized()
    let response = try request(
      method: "thread/read",
      params: ["threadId": id, "includeTurns": includeTurns],
      timeout: Self.requestTimeout
    )
    guard let result = response["result"] as? [String: Any] else {
      throw BridgeError.invalidPayload("app-server thread/read returned no result")
    }
    return result
  }

  func resumeThread(id: String) throws -> [String: Any] {
    try ensureInitialized()
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
    guard let result = response["result"] as? [String: Any] else {
      throw BridgeError.invalidPayload("app-server thread/resume returned no result")
    }
    return result
  }

  func forkThread(id: String, throughTurnId: String?) throws -> [String: Any] {
    try ensureInitialized()
    var params: [String: Any] = [
      "threadId": id,
      "cwd": workspaceRoot.path,
      "sandbox": "read-only",
      "approvalPolicy": "never",
      "threadSource": "opl-native-workbench"
    ]
    if let throughTurnId, !throughTurnId.isEmpty { params["lastTurnId"] = throughTurnId }
    let response = try request(method: "thread/fork", params: params, timeout: Self.requestTimeout)
    guard let result = response["result"] as? [String: Any] else {
      throw BridgeError.invalidPayload("app-server thread/fork returned no result")
    }
    return result
  }

  func setArchived(id: String, archived: Bool) throws -> [String: Any] {
    try ensureInitialized()
    let method = archived ? "thread/archive" : "thread/unarchive"
    let response = try request(method: method, params: ["threadId": id], timeout: Self.requestTimeout)
    return response["result"] as? [String: Any] ?? [:]
  }

  func startTurn(
    threadId: String,
    message: String,
    model: String?,
    effort: String?
  ) throws -> [String: Any] {
    try ensureInitialized()
    var params: [String: Any] = [
      "threadId": threadId,
      "input": [["type": "text", "text": message, "text_elements": []]],
      "cwd": workspaceRoot.path,
      "approvalPolicy": "never",
      "sandboxPolicy": ["type": "readOnly", "networkAccess": false]
    ]
    if let model, !model.isEmpty { params["model"] = model }
    if let effort, !effort.isEmpty { params["effort"] = effort }
    let response = try request(method: "turn/start", params: params, timeout: Self.requestTimeout)
    guard let result = response["result"] as? [String: Any] else {
      throw BridgeError.invalidPayload("app-server turn/start returned no result")
    }
    return result
  }

  func steerTurn(threadId: String, turnId: String, message: String) throws -> [String: Any] {
    try ensureInitialized()
    let response = try request(
      method: "turn/steer",
      params: [
        "threadId": threadId,
        "expectedTurnId": turnId,
        "input": [["type": "text", "text": message, "text_elements": []]]
      ],
      timeout: Self.requestTimeout
    )
    guard let result = response["result"] as? [String: Any] else {
      throw BridgeError.invalidPayload("app-server turn/steer returned no result")
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
    let params: [String: Any] = [
      "cwd": workspaceRoot.path,
      "sandbox": "read-only",
      "approvalPolicy": "never",
      "threadSource": "opl-native-workbench",
      "ephemeral": false
    ]
    let response = try request(method: "thread/start", params: params, timeout: Self.requestTimeout)
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
    if let configured = ProcessInfo.processInfo.environment["OPL_CODEX_BIN"], !configured.isEmpty {
      process.executableURL = URL(fileURLWithPath: configured)
      process.arguments = ["app-server", "--stdio"]
    } else {
      process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
      process.arguments = ["codex", "app-server", "--stdio"]
    }
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
    writeLock.lock()
    defer { writeLock.unlock() }
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

    if message["method"] == nil, let id = message["id"] as? Int, let pending = pendingRequests.removeValue(forKey: id) {
      pending.response = message
      pending.semaphore.signal()
      return
    }

    if let method = message["method"] as? String {
      if let requestId = message["id"] {
        try? send(frame: [
          "id": requestId,
          "error": ["code": -32601, "message": "Unsupported app-server request: \(method)"]
        ])
        return
      }
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

final class CodexThreadAdapter {
  private let appServer: CodexAppServerClient
  private let workspaceRoot: URL

  init(appServer: CodexAppServerClient, workspaceRoot: URL) {
    self.appServer = appServer
    self.workspaceRoot = workspaceRoot
  }

  func handle(method: String, payload: [String: Any]) throws -> [String: Any] {
    switch method {
    case "listThreads": return try listThreads(payload)
    case "readThread": return try readThread(payload)
    case "resumeThread": return try resumeThread(payload)
    case "forkThread": return try forkThread(payload)
    case "setArchived": return try setArchived(payload)
    default: throw BridgeError.invalidPayload("unknown thread adapter method \(method)")
    }
  }

  private func listThreads(_ payload: [String: Any]) throws -> [String: Any] {
    var params: [String: Any] = [:]
    if let archived = payload["archived"] as? Bool { params["archived"] = archived }
    let workspaceFilter: [String]
    if let workspace = payload["workspace"] as? String, !workspace.isEmpty {
      params["cwd"] = workspace
      workspaceFilter = [workspace]
    } else {
      workspaceFilter = (payload["workspace"] as? [String] ?? []).filter { !$0.isEmpty }
    }
    if let limit = payload["limit"] as? Int { params["limit"] = min(max(limit, 1), 100) }
    if let search = payload["searchTerm"] as? String { params["searchTerm"] = search }
    let listed = try appServer.listThreads(params: params)
    let requestedArchived = payload["archived"] as? Bool
    let data = (listed["data"] as? [[String: Any]] ?? []).map {
      projectThread($0, archived: requestedArchived ?? ($0["archived"] as? Bool ?? false))
    }
    let projectFilter = payload["projectKey"] as? String
    return [
      "data": data.filter { thread in
        let projectMatches = projectFilter == nil || thread["projectKey"] as? String == projectFilter
        let workspaceMatches = workspaceFilter.isEmpty || workspaceFilter.contains(thread["workspace"] as? String ?? "")
        return projectMatches && workspaceMatches
      },
      "nextCursor": NSNull()
    ]
  }

  private func readThread(_ payload: [String: Any]) throws -> [String: Any] {
    let id = try requiredString(payload, "threadId")
    let result = try appServer.readThread(id: id, includeTurns: payload["includeTurns"] as? Bool ?? true)
    guard let thread = result["thread"] as? [String: Any] else { throw BridgeError.invalidPayload("thread/read missing thread") }
    return projectThread(thread, archived: thread["archived"] as? Bool ?? false)
  }

  private func resumeThread(_ payload: [String: Any]) throws -> [String: Any] {
    let id = try requiredString(payload, "threadId")
    let result = try appServer.resumeThread(id: id)
    guard let thread = result["thread"] as? [String: Any] else { throw BridgeError.invalidPayload("thread/resume missing thread") }
    return projectThread(thread, archived: false)
  }

  private func forkThread(_ payload: [String: Any]) throws -> [String: Any] {
    let id = try requiredString(payload, "threadId")
    let result = try appServer.forkThread(id: id, throughTurnId: payload["throughTurnId"] as? String)
    guard let thread = result["thread"] as? [String: Any] else { throw BridgeError.invalidPayload("thread/fork missing thread") }
    return projectThread(thread, archived: false)
  }

  private func setArchived(_ payload: [String: Any]) throws -> [String: Any] {
    let id = try requiredString(payload, "threadId")
    let archived = payload["archived"] as? Bool ?? false
    if archived && payload["confirmed"] as? Bool != true {
      throw BridgeError.invalidPayload("thread/archive requires explicit user confirmation")
    }
    _ = try appServer.setArchived(id: id, archived: archived)
    return ["threadId": id, "archived": archived]
  }

  private func projectThread(_ thread: [String: Any], archived: Bool) -> [String: Any] {
    let id = thread["id"] as? String ?? ""
    let status = thread["status"] as? [String: Any]
    let statusType = status?["type"] as? String ?? thread["status"] as? String ?? "systemError"
    let state = statusType == "notLoaded"
      ? "unloaded"
      : statusType == "idle"
        ? "idle"
        : statusType == "active"
          ? "running"
          : "system_error"
    let cwd = thread["cwd"] as? String ?? ""
    let extra = thread["extra"] as? [String: Any] ?? [:]
    let turns = thread["turns"] as? [[String: Any]] ?? []
    let activeTurnId = turns.reversed()
      .first(where: { $0["status"] as? String == "inProgress" })?["id"] as? String
    let source = thread["threadSource"] ?? thread["source"]
    let sourceKind = source as? String
      ?? (source as? [String: Any])?["type"] as? String
      ?? (source as? [String: Any])?["kind"] as? String

    var projected = thread
    projected["sessionId"] = thread["sessionId"] as? String ?? id
    projected["projectKey"] = thread["projectKey"] as? String
      ?? extra["projectKey"] as? String
      ?? NSNull()
    projected["status"] = status ?? ["type": statusType]
    projected["state"] = state
    projected["summary"] = thread["name"] as? String ?? thread["preview"] as? String ?? ""
    projected["workspace"] = cwd
    projected["currentWorkspace"] = cwd == workspaceRoot.path
    projected["archived"] = archived
    projected["parentThreadId"] = thread["parentThreadId"] ?? thread["forkedFromId"] ?? NSNull()
    if let agentRole = thread["agentRole"] as? String { projected["agentRole"] = agentRole }
    if let agentNickname = thread["agentNickname"] as? String { projected["agentNickname"] = agentNickname }
    if let sourceKind { projected["sourceKind"] = sourceKind }
    if let activeTurnId { projected["activeTurnId"] = activeTurnId }
    return projected
  }

  private func requiredString(_ payload: [String: Any], _ key: String) throws -> String {
    guard let value = payload[key] as? String,
          !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw BridgeError.invalidPayload("missing \(key)")
    }
    return value
  }
}

final class NativeBridge: NSObject, WKScriptMessageHandler {
  weak var webView: WKWebView?
  private let workspaceRoot: URL
  private lazy var appServer = CodexAppServerClient(workspaceRoot: workspaceRoot)
  private lazy var threadAdapter = CodexThreadAdapter(appServer: appServer, workspaceRoot: workspaceRoot)

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
    case "readRuntimeIdentity":
      return runtimeIdentityPayload()
    case "readState":
      let profile = (payload["profile"] as? String) == "full" ? "full" : "fast"
      return stateCommandPayload(profile: profile)
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
      if candidateActionBlocked(dryRun: dryRun) {
        return actionCommandPayload(
          actionId: actionId,
          command: args,
          result: CommandResult(exitCode: -1, stdout: "", stderr: "candidate_read_only_policy", timedOut: false),
          dryRun: false,
          confirmationRequired: false,
          canExecute: false,
          receiptKind: "blocked_read_only",
          confirmationId: stringValue(actionPayload["confirmationId"]),
          receiptId: stringValue(actionPayload["receiptId"]),
          rollbackRef: rollbackRef,
          blockedReason: "candidate_read_only_policy"
        )
      }
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
    case "listThreads", "readThread", "resumeThread", "forkThread", "setArchived":
      return try threadAdapter.handle(method: method, payload: payload)
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

  private func stateCommandPayload(profile: String) -> [String: Any] {
    let command = ["opl", "app", "state", "--profile", profile, "--json"]
    let result = runCommand(command, input: nil, cwd: workspaceRoot, timeout: 30)
    let parsed: Any
    if let data = result.stdout.data(using: .utf8),
       let value = try? JSONSerialization.jsonObject(with: data) {
      parsed = value
    } else {
      parsed = [:]
    }
    return [
      "profile": profile,
      "app_state": parsed,
      "readback": [
        "command": command.joined(separator: " "),
        "commandArgs": command,
        "exitCode": result.exitCode,
        "stdout": "",
        "stdoutBytes": result.stdout.utf8.count,
        "stdoutOmittedFromGuiProjection": true,
        "stderr": result.stderr,
        "timedOut": result.timedOut
      ]
    ]
  }

  private func runtimeIdentityPayload() -> [String: Any] {
    let environment = ProcessInfo.processInfo.environment
    guard
      let raw = environment["OPL_APP_RUNTIME_IDENTITY_JSON"],
      let data = raw.data(using: .utf8),
      var identity = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any]
    else {
      return [
        "schema": "app_runtime_executable_identity.v1",
        "status": "launcher_identity_unavailable",
        "source": "direct_launch_host_path_fallback",
        "candidateReadOnly": environment["OPL_NATIVE_WORKBENCH_READ_ONLY"] == "1"
      ]
    }
    identity["status"] = "launcher_identity_available"
    identity["source"] = "app_root_gui_launcher"
    identity["candidateReadOnly"] = environment["OPL_NATIVE_WORKBENCH_READ_ONLY"] == "1"
    return identity
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
    rollbackRef: String?,
    blockedReason: String? = nil
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
    if let blockedReason { payload["blockedReason"] = blockedReason }
    return payload
  }

  private func runCommand(_ args: [String], input: String?, cwd: URL, timeout: TimeInterval) -> CommandResult {
    runNativeCommand(args, input: input, cwd: cwd, timeout: timeout)
  }

  private func resolve(id: String, ok: Bool, payload: [String: Any]) {
    let js = "window.__oplNativeWorkbenchResolve(\(jsonString(id)), \(ok ? "true" : "false"), \(jsonString(payload)));"
    DispatchQueue.main.async {
      self.webView?.evaluateJavaScript(js)
    }
  }

  private func emit(event: [String: Any]) {
    let js = "window.__oplNativeWorkbenchEvent(\(jsonString(event)));"
    DispatchQueue.main.async {
      self.webView?.evaluateJavaScript(js)
    }
  }
}

enum BridgeError: Error {
  case invalidPayload(String)
}

func candidateActionBlocked(
  dryRun: Bool,
  environment: [String: String] = ProcessInfo.processInfo.environment
) -> Bool {
  !dryRun && environment["OPL_NATIVE_WORKBENCH_READ_ONLY"] == "1"
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

final class WindowDragView: NSView {
  override var mouseDownCanMoveWindow: Bool { true }

  override func mouseDown(with event: NSEvent) {
    window?.performDrag(with: event)
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  private var window: NSWindow?
  private var webView: WKWebView?
  private var bridge: NativeBridge?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let appName = "One Person Lab Native"
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
    if ProcessInfo.processInfo.environment["OPL_NATIVE_WORKBENCH_SMOKE"] == "1" {
      configuration.websiteDataStore = .nonPersistent()
    }

    let webView = WKWebView(frame: .zero, configuration: configuration)
    bridge.webView = webView
    webView.loadFileURL(workbenchURL, allowingReadAccessTo: resourcesURL)

    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
      backing: .buffered,
      defer: false
    )
    window.title = appName
    window.titleVisibility = .hidden
    window.titlebarAppearsTransparent = true
    window.titlebarSeparatorStyle = .none
    window.isMovableByWindowBackground = true
    window.minSize = NSSize(width: 980, height: 680)

    let contentView = NSView(frame: .zero)
    let dragView = WindowDragView(frame: .zero)
    webView.translatesAutoresizingMaskIntoConstraints = false
    dragView.translatesAutoresizingMaskIntoConstraints = false
    contentView.addSubview(webView)
    contentView.addSubview(dragView)
    NSLayoutConstraint.activate([
      webView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
      webView.topAnchor.constraint(equalTo: contentView.topAnchor),
      webView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
      dragView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 96),
      dragView.topAnchor.constraint(equalTo: contentView.topAnchor),
      dragView.widthAnchor.constraint(equalToConstant: 164),
      dragView.heightAnchor.constraint(equalToConstant: 18)
    ])
    window.contentView = contentView
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

if ProcessInfo.processInfo.environment["OPL_NATIVE_WORKBENCH_POLICY_SMOKE"] == "1" {
  let mutationBlocked = candidateActionBlocked(dryRun: false)
  let dryRunAllowed = !candidateActionBlocked(dryRun: true)
  print(jsonString([
    "status": "candidate_action_policy_smoke",
    "mutationBlocked": mutationBlocked,
    "dryRunAllowed": dryRunAllowed
  ]))
  exit(mutationBlocked && dryRunAllowed ? 0 : 1)
}

let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
