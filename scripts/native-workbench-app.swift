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
  private var activeTurnIds: [String: String] = [:]
  private var threadStatuses: [String: [String: Any]] = [:]
  private var dynamicToolsRuntimeSupported: Bool?
  private var initialized = false
  private let lock = NSLock()
  private let writeLock = NSLock()
  private let turnLock = NSLock()
  var onEvent: (([String: Any]) -> Void)?
  var onThreadStatus: ((String, [String: Any]) -> Void)?
  var onTurnCompleted: ((String, [String: Any]) -> Void)?
  var onDynamicToolCall: (([String: Any]) throws -> [String: Any])?

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

  func resumeCoordinationThread(id: String) throws -> [String: Any] {
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

  func startCoordinationTurn(
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

  func steerCoordinationTurn(threadId: String, turnId: String, message: String) throws -> [String: Any] {
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

  func cachedActiveTurnId(threadId: String) -> String? {
    lock.lock()
    defer { lock.unlock() }
    return activeTurnIds[threadId]
  }

  func cachedThreadStatus(threadId: String) -> [String: Any]? {
    lock.lock()
    defer { lock.unlock() }
    return threadStatuses[threadId]
  }

  func resultSummary(turnId: String) -> String? {
    lock.lock()
    defer { lock.unlock() }
    guard let turn = pendingTurns[turnId] else { return nil }
    let value = turn.completedText ?? turn.text
    return value.isEmpty ? nil : value
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
    var params: [String: Any] = [
      "cwd": workspaceRoot.path,
      "sandbox": "read-only",
      "approvalPolicy": "never",
      "threadSource": "opl-native-workbench",
      "ephemeral": false
    ]
    if dynamicToolsRuntimeSupported != false {
      params["dynamicTools"] = coordinationDynamicTools()
    }
    let response: [String: Any]
    do {
      response = try request(method: "thread/start", params: params, timeout: Self.requestTimeout)
      if params["dynamicTools"] != nil {
        emitDynamicToolsCapability(state: "accepted_unverified", detail: "thread/start accepted dynamicTools; awaiting item/tool/call")
      }
    } catch {
      let detail = String(describing: error)
      guard params["dynamicTools"] != nil, detail.lowercased().contains("dynamic") else { throw error }
      dynamicToolsRuntimeSupported = false
      emitDynamicToolsCapability(state: "unavailable", detail: detail)
      params.removeValue(forKey: "dynamicTools")
      response = try request(method: "thread/start", params: params, timeout: Self.requestTimeout)
    }
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

  private func coordinationDynamicTools() -> [[String: Any]] {
    let threadIdSchema: [String: Any] = ["type": "string", "minLength": 1]
    return [
      dynamicTool(name: "list_threads", description: "List authorized local top-level threads.", properties: [
        "projectKey": ["type": "string"], "hostId": ["type": "string"], "archived": ["type": "boolean"],
        "workspace": ["oneOf": [["type": "string"], ["type": "array", "items": ["type": "string"]]]],
        "searchTerm": ["type": "string"], "limit": ["type": "integer", "minimum": 1, "maximum": 100]
      ]),
      dynamicTool(name: "read_thread", description: "Read an authorized thread projection.", required: ["threadId"], properties: [
        "threadId": threadIdSchema, "includeTurns": ["type": "boolean"]
      ]),
      dynamicTool(name: "send_message_to_thread", description: "Send a guarded coordination message to another thread.", required: [
        "targetThreadId", "intent", "reason", "message", "summary", "expectedWriteSet", "dedupeKey"
      ], properties: [
        "targetThreadId": threadIdSchema,
        "intent": ["enum": ["delegate", "inform", "review", "block", "handoff"]],
        "reason": ["type": "string", "minLength": 1],
        "message": ["type": "string", "minLength": 1],
        "summary": ["type": "string", "minLength": 1],
        "expectedWriteSet": ["type": "array", "items": ["type": "string"]],
        "ancestorCoordinationIds": ["type": "array", "items": ["type": "string"]],
        "priority": ["enum": ["normal", "urgent"]],
        "dedupeKey": ["type": "string", "minLength": 1],
        "hopCount": ["type": "integer", "minimum": 0, "maximum": 8]
      ]),
      dynamicTool(name: "fork_thread", description: "Fork an authorized thread.", required: ["threadId"], properties: [
        "threadId": threadIdSchema, "throughTurnId": ["type": "string"]
      ]),
      dynamicTool(name: "archive_thread", description: "Archive a thread with explicit confirmation.", required: ["threadId"], properties: [
        "threadId": threadIdSchema
      ]),
      dynamicTool(name: "unarchive_thread", description: "Unarchive an authorized thread.", required: ["threadId"], properties: [
        "threadId": threadIdSchema
      ]),
      dynamicTool(name: "wait_thread", description: "Wait for the latest coordination state for a thread.", required: ["threadId"], properties: [
        "threadId": threadIdSchema, "coordinationId": ["type": "string"], "condition": ["type": "string"],
        "timeoutMs": ["type": "integer", "minimum": 0, "maximum": 180000]
      ])
    ]
  }

  private func dynamicTool(
    name: String,
    description: String,
    required: [String] = [],
    properties: [String: Any]
  ) -> [String: Any] {
    [
      "type": "function",
      "name": name,
      "description": description,
      "inputSchema": [
        "type": "object",
        "additionalProperties": false,
        "required": required,
        "properties": properties
      ]
    ]
  }

  private func emitDynamicToolsCapability(state: String, detail: String) {
    let event: [String: Any] = [
      "method": "coordination/dynamicToolsCapability",
      "params": [
        "generatedSchemaFieldPresent": false,
        "state": state,
        "runtimeSupported": state == "verified_available",
        "codexCliVersion": "0.144.1",
        "detail": detail
      ]
    ]
    DispatchQueue.main.async { self.onEvent?(event) }
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
      if method == "item/tool/call", let requestId = message["id"], let params = message["params"] as? [String: Any] {
        let handler = onDynamicToolCall
        DispatchQueue.global(qos: .userInitiated).async {
          do {
            guard let handler else {
              throw BridgeError.invalidPayload("dynamic tool host dispatcher unavailable")
            }
            let result = try handler(params)
            try self.send(frame: ["id": requestId, "result": result])
            self.dynamicToolsRuntimeSupported = true
            self.emitDynamicToolsCapability(state: "verified_available", detail: "item/tool/call handled and response returned")
          } catch {
            let result: [String: Any] = [
              "contentItems": [["type": "inputText", "text": String(describing: error)]],
              "success": false
            ]
            try? self.send(frame: ["id": requestId, "result": result])
          }
        }
        return
      }
      if let params = message["params"] as? [String: Any] {
        if method == "thread/status/changed",
           let changedThreadId = params["threadId"] as? String,
           let status = params["status"] as? [String: Any] {
          threadStatuses[changedThreadId] = status
          DispatchQueue.global(qos: .utility).async {
            self.onThreadStatus?(changedThreadId, status)
          }
        }
        if method == "turn/started",
           let startedThreadId = params["threadId"] as? String,
           let turn = params["turn"] as? [String: Any],
           let turnId = turn["id"] as? String {
          activeTurnIds[startedThreadId] = turnId
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
           let completedThreadId = params["threadId"] as? String,
           let turn = params["turn"] as? [String: Any],
           let turnId = turn["id"] as? String {
          if activeTurnIds[completedThreadId] == turnId {
            activeTurnIds.removeValue(forKey: completedThreadId)
          }
          let pendingTurn = turnBucketLocked(turnId)
          pendingTurn.completed = params
          pendingTurn.events.append(message)
          pendingTurn.semaphore.signal()
          DispatchQueue.global(qos: .utility).async {
            self.onTurnCompleted?(completedThreadId, turn)
          }
        }
      }
      DispatchQueue.main.async {
        self.onEvent?(message)
      }
    }
  }
}

final class CoordinationLedger {
  private let url: URL
  private let lock = NSLock()

  init() {
    if let configured = ProcessInfo.processInfo.environment["OPL_COORDINATION_LEDGER"], !configured.isEmpty {
      url = URL(fileURLWithPath: configured)
    } else {
      let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
      url = base.appendingPathComponent("One Person Lab/coordination-ledger.jsonl")
    }
  }

  func append(_ record: [String: Any]) {
    guard JSONSerialization.isValidJSONObject(record),
          let data = try? JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]) else { return }
    lock.lock()
    defer { lock.unlock() }
    try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    if !FileManager.default.fileExists(atPath: url.path) { FileManager.default.createFile(atPath: url.path, contents: nil) }
    guard let handle = try? FileHandle(forWritingTo: url) else { return }
    defer { try? handle.close() }
    do {
      try handle.seekToEnd()
      try handle.write(contentsOf: data + Data([10]))
    } catch { return }
  }

  func recentDedupeKeys(since: Date) -> Set<String> {
    lock.lock()
    defer { lock.unlock() }
    guard let data = try? Data(contentsOf: url), let text = String(data: data, encoding: .utf8) else { return [] }
    var keys = Set<String>()
    for line in text.split(separator: "\n") {
      guard let lineData = line.data(using: .utf8),
            let record = try? JSONSerialization.jsonObject(with: lineData) as? [String: Any],
            let key = record["dedupeKey"] as? String,
            let recordedAt = record["recordedAt"] as? String,
            let date = ISO8601DateFormatter().date(from: recordedAt), date >= since else { continue }
      keys.insert(key)
    }
    return keys
  }

  func recentRecord(coordinationId: String, since: Date) -> [String: Any]? {
    lock.lock()
    defer { lock.unlock() }
    guard let data = try? Data(contentsOf: url), let text = String(data: data, encoding: .utf8) else { return nil }
    for line in text.split(separator: "\n").reversed() {
      guard let lineData = line.data(using: .utf8),
            let record = try? JSONSerialization.jsonObject(with: lineData) as? [String: Any],
            record["coordinationId"] as? String == coordinationId,
            let recordedAt = record["recordedAt"] as? String,
            let date = ISO8601DateFormatter().date(from: recordedAt), date >= since else { continue }
      return record
    }
    return nil
  }
}

final class ThreadCoordinationHost {
  private static let dedupeWindow: TimeInterval = 24 * 60 * 60
  private static let queueWindow: TimeInterval = 30 * 60
  private static let maxHops = 8
  private let appServer: CodexAppServerClient
  private let workspaceRoot: URL
  private let hostId: String
  private let ledger = CoordinationLedger()
  private let lock = NSLock()
  private var preparations: [String: [String: Any]] = [:]
  private var results: [String: [String: Any]] = [:]
  private var queued: [[String: Any]] = []
  private var coordinationByTurn: [String: String] = [:]
  private var archivedThreadIds = Set<String>()
  var onEvent: (([String: Any]) -> Void)?

  init(appServer: CodexAppServerClient, workspaceRoot: URL) {
    self.appServer = appServer
    self.workspaceRoot = workspaceRoot
    self.hostId = ProcessInfo.processInfo.environment["OPL_HOST_ID"] ?? Host.current().localizedName ?? "local"
  }

  func handle(method: String, payload: [String: Any]) throws -> [String: Any] {
    switch method {
    case "listThreads": return try listThreads(payload)
    case "readThread": return try readThread(payload)
    case "resumeThread": return try resumeThread(payload)
    case "prepareCoordination": return try prepareCoordination(payload)
    case "dispatchCoordination": return try dispatchCoordination(payload)
    case "forkThread": return try forkThread(payload)
    case "setArchived": return try setArchived(payload)
    case "waitCoordination": return try waitCoordination(payload)
    default: throw BridgeError.invalidPayload("unknown coordination method \(method)")
    }
  }

  func handleDynamicTool(_ params: [String: Any]) throws -> [String: Any] {
    guard let tool = params["tool"] as? String else { throw BridgeError.invalidPayload("dynamic tool missing tool") }
    let arguments = params["arguments"] as? [String: Any] ?? [:]
    let sourceThreadId = params["threadId"] as? String ?? ""
    let value: [String: Any]
    switch tool {
    case "list_threads":
      let source = try readThread(["threadId": sourceThreadId, "includeTurns": false])
      let sourceProject = source["projectKey"] as? String
      if let requestedProject = arguments["projectKey"] as? String, requestedProject != sourceProject {
        value = deniedTool("scope_mismatch", "model thread listing is limited to the source project")
      } else {
        var scoped = arguments
        if let sourceProject { scoped["projectKey"] = sourceProject }
        else { scoped["workspace"] = source["workspace"] }
        scoped["hostId"] = hostId
        value = try listThreads(scoped)
      }
    case "read_thread":
      let source = try readThread(["threadId": sourceThreadId, "includeTurns": false])
      let target = try readThread(arguments)
      let sourceProject = source["projectKey"] as? String
      let targetProject = target["projectKey"] as? String
      let sameProject = sourceProject != nil && sourceProject == targetProject
      let sameProjectlessWorkspace = sourceProject == nil
        && targetProject == nil
        && source["workspace"] as? String == target["workspace"] as? String
      if (!sameProject && !sameProjectlessWorkspace) || target["hostId"] as? String != hostId {
        value = deniedTool("scope_mismatch", "model thread read is limited to the source project and host")
      } else {
        value = target
      }
    case "send_message_to_thread":
      var request = arguments
      let source = try readThread(["threadId": sourceThreadId, "includeTurns": false])
      request["sourceThreadId"] = sourceThreadId
      request["sourceHostId"] = hostId
      request["targetHostId"] = hostId
      if let sourceProject = source["projectKey"] as? String { request["projectKey"] = sourceProject }
      request["sender"] = "model"
      request["ancestorCoordinationIds"] = request["ancestorCoordinationIds"] as? [Any] ?? []
      request["priority"] = request["priority"] as? String ?? "normal"
      request["hopCount"] = request["hopCount"] as? Int ?? 0
      value = try prepareCoordination(request)
    case "fork_thread", "archive_thread", "unarchive_thread":
      value = proposalReceipt(tool: tool, payload: arguments)
    case "wait_thread":
      var wait = arguments
      if wait["coordinationId"] == nil, let threadId = arguments["threadId"] as? String {
        wait["coordinationId"] = latestCoordinationId(threadId: threadId) ?? ""
      }
      value = try waitCoordination(wait)
    default: throw BridgeError.invalidPayload("unsupported dynamic coordination tool \(tool)")
    }
    if tool == "send_message_to_thread" {
      onEvent?([
        "method": "coordination/prepared",
        "threadId": sourceThreadId,
        "coordinationId": value["coordinationId"] ?? value["previewToken"] ?? "",
        "state": value["state"] ?? "confirmation_required",
        "raw": value
      ])
    } else if ["fork_thread", "archive_thread", "unarchive_thread"].contains(tool) {
      onEvent?([
        "method": "coordination/lifecycle-proposal",
        "threadId": sourceThreadId,
        "state": value["state"] ?? "confirmation_required",
        "raw": value
      ])
    }
    return [
      "contentItems": [["type": "inputText", "text": jsonString(value)]],
      "success": true
    ]
  }

  func threadStatusChanged(threadId: String, status: [String: Any]) {
    guard status["type"] as? String == "idle" else { return }
    DispatchQueue.global(qos: .utility).async { self.drainQueue(threadId: threadId) }
  }

  func turnCompleted(threadId: String, turn: [String: Any]) {
    guard let turnId = turn["id"] as? String else { return }
    lock.lock()
    guard let coordinationId = coordinationByTurn.removeValue(forKey: turnId), var result = results[coordinationId] else {
      lock.unlock()
      return
    }
    let status = turn["status"] as? String == "completed" ? "completed" : "failed"
    result["state"] = status
    result["resultSummaryOrRef"] = appServer.resultSummary(turnId: turnId) ?? "thread:\(threadId)/turn:\(turnId)"
    result["completedAt"] = isoNow()
    result["updatedAt"] = isoNow()
    lock.unlock()
    storeResult(coordinationId, result)
    appendLedger(event: "terminal", coordinationId: coordinationId, state: status, targetThreadId: threadId, turnId: turnId)
  }

  private func listThreads(_ payload: [String: Any]) throws -> [String: Any] {
    var params: [String: Any] = [:]
    if let archived = payload["archived"] as? Bool { params["archived"] = archived }
    if let workspace = payload["workspace"] { params["cwd"] = workspace }
    if let limit = payload["limit"] as? Int { params["limit"] = min(max(limit, 1), 100) }
    if let search = payload["searchTerm"] as? String { params["searchTerm"] = search }
    let listed = try appServer.listThreads(params: params)
    let archived = payload["archived"] as? Bool ?? false
    let data = (listed["data"] as? [[String: Any]] ?? []).map { projectThread($0, archived: archived) }
    let projectFilter = payload["projectKey"] as? String
    let hostFilter = payload["hostId"] as? String
    return [
      "data": data.filter {
        (projectFilter == nil || $0["projectKey"] as? String == projectFilter)
          && (hostFilter == nil || $0["hostId"] as? String == hostFilter)
      },
      "nextCursor": NSNull()
    ]
  }

  private func readThread(_ payload: [String: Any]) throws -> [String: Any] {
    let id = try requiredString(payload, "threadId")
    let result = try appServer.readThread(id: id, includeTurns: payload["includeTurns"] as? Bool ?? true)
    guard let thread = result["thread"] as? [String: Any] else { throw BridgeError.invalidPayload("thread/read missing thread") }
    return projectThread(thread, archived: isThreadArchived(id))
  }

  private func resumeThread(_ payload: [String: Any]) throws -> [String: Any] {
    let id = try requiredString(payload, "threadId")
    let result = try appServer.resumeCoordinationThread(id: id)
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
    if archived && payload["confirmed"] as? Bool != true && stringValue(payload["confirmationId"]) == nil {
      return proposalReceipt(tool: "archive_thread", payload: payload)
    }
    _ = try appServer.setArchived(id: id, archived: archived)
    lock.lock()
    if archived { archivedThreadIds.insert(id) } else { archivedThreadIds.remove(id) }
    lock.unlock()
    return ["threadId": id, "archived": archived]
  }

  private func prepareCoordination(_ payload: [String: Any]) throws -> [String: Any] {
    let sourceId = try requiredString(payload, "sourceThreadId")
    let targetId = try requiredString(payload, "targetThreadId")
    let sourceHost = try requiredString(payload, "sourceHostId")
    let targetHost = try requiredString(payload, "targetHostId")
    let dedupeKey = try requiredString(payload, "dedupeKey")
    _ = try requiredString(payload, "message")
    let coordinationId = UUID().uuidString.lowercased()
    let previewToken = UUID().uuidString.lowercased()
    let now = isoNow()

    let target: [String: Any]
    do { target = try readThread(["threadId": targetId, "includeTurns": true]) }
    catch { return rejectedPreparation(payload, coordinationId, "offline", String(describing: error), now) }
    let targetWriteSet = target["writeSet"] as? [String] ?? []
    let plannedDispatch = dispatchKind(target: target, priority: payload["priority"] as? String ?? "normal")
    let permission = payload["sender"] as? String == "user" && plannedDispatch != "steered"
      ? "preauthorized"
      : "confirmation_required"
    if sourceId == targetId { return rejectedPreparation(payload, coordinationId, "loop_rejected", "source and target must differ", now) }
    if sourceHost != hostId || targetHost != hostId {
      return rejectedPreparation(payload, coordinationId, "scope_mismatch", "local host scope mismatch", now)
    }
    let source: [String: Any]
    do { source = try readThread(["threadId": sourceId, "includeTurns": false]) }
    catch { return rejectedPreparation(payload, coordinationId, "offline", "source thread could not be refreshed", now) }
    if let project = payload["projectKey"] as? String, !project.isEmpty {
      if project != source["projectKey"] as? String || project != target["projectKey"] as? String {
        return rejectedPreparation(payload, coordinationId, "scope_mismatch", "source or target project does not match", now)
      }
    } else if source["projectKey"] is NSNull || target["projectKey"] is NSNull {
      if source["workspace"] as? String != target["workspace"] as? String {
        return rejectedPreparation(payload, coordinationId, "scope_mismatch", "projectless coordination requires exact workspace match", now)
      }
    } else if source["projectKey"] as? String != target["projectKey"] as? String {
      return rejectedPreparation(payload, coordinationId, "scope_mismatch", "source and target projects differ", now)
    }
    if target["archived"] as? Bool == true {
      return rejectedPreparation(payload, coordinationId, "archived_target", "target is archived", now)
    }
    let hopCount = payload["hopCount"] as? Int ?? 0
    let ancestors = payload["ancestorCoordinationIds"] as? [String] ?? []
    if hopCount > Self.maxHops || ancestors.count > Self.maxHops || Set(ancestors).count != ancestors.count {
      return rejectedPreparation(payload, coordinationId, "loop_rejected", "ancestor chain or hop budget rejected", now)
    }
    let cutoff = Date().addingTimeInterval(-Self.dedupeWindow)
    for ancestorId in ancestors {
      if let ancestor = ledger.recentRecord(coordinationId: ancestorId, since: cutoff),
         ancestor["sourceThreadId"] as? String == targetId,
         ancestor["targetThreadId"] as? String == sourceId {
        return rejectedPreparation(payload, coordinationId, "loop_rejected", "ancestor coordination would route back to its source", now)
      }
    }
    if ledger.recentDedupeKeys(since: cutoff).contains(dedupeKey) {
      return rejectedPreparation(payload, coordinationId, "duplicate_rejected", "duplicate within 24 hours", now)
    }
    let expectedWriteSet = payload["expectedWriteSet"] as? [String] ?? []
    if writeSetsOverlap(expectedWriteSet, targetWriteSet) {
      return rejectedPreparation(payload, coordinationId, "write_set_conflict", "expected write set overlaps fresh target write set", now)
    }
    if (target["state"] as? String) == "system_error" {
      return rejectedPreparation(payload, coordinationId, "stale_status", "fresh target status unavailable", now)
    }

    var stored = payload
    stored["coordinationId"] = coordinationId
    stored["previewToken"] = previewToken
    stored["target"] = target
    stored["targetWriteSet"] = targetWriteSet
    stored["permissionDecision"] = permission
    stored["preparedAt"] = now
    lock.lock()
    preparations[previewToken] = stored
    lock.unlock()
    appendReceipt(stored, event: "created", state: permission == "preauthorized" ? "prepared" : "confirmation_required", protocolMethod: "preview")
    return [
      "state": permission == "preauthorized" ? "prepared" : "confirmation_required", "coordinationId": coordinationId, "previewToken": previewToken,
      "request": payload, "target": target, "targetWriteSet": targetWriteSet,
      "plannedDispatch": plannedDispatch,
      "permissionDecision": permission, "preparedAt": now
    ]
  }

  private func dispatchCoordination(_ payload: [String: Any]) throws -> [String: Any] {
    let token = try requiredString(payload, "previewToken")
    lock.lock()
    guard let prepared = preparations[token] else { lock.unlock(); return dispatchFailure(token, "protocol_incompatible", "unknown preview token") }
    lock.unlock()
    let preauthorized = prepared["permissionDecision"] as? String == "preauthorized"
    guard preauthorized || payload["confirmed"] as? Bool == true || stringValue(payload["confirmationId"]) != nil else {
      return dispatchFailure(prepared["coordinationId"] as? String ?? token, "permission_denied", "user confirmation or persisted preauthorization required")
    }
    let targetId = prepared["targetThreadId"] as? String ?? ""
    let refreshed: [String: Any]
    do { refreshed = try readThread(["threadId": targetId, "includeTurns": true]) }
    catch { return dispatchFailure(prepared["coordinationId"] as? String ?? token, "stale_status", String(describing: error)) }
    if refreshed["archived"] as? Bool == true { return dispatchFailure(prepared["coordinationId"] as? String ?? token, "archived_target", "target became archived") }
    if writeSetsOverlap(prepared["expectedWriteSet"] as? [String] ?? [], refreshed["writeSet"] as? [String] ?? []) {
      return dispatchFailure(prepared["coordinationId"] as? String ?? token, "write_set_conflict", "fresh target write set conflicts")
    }
    var authorized = prepared
    if !preauthorized { authorized["permissionDecision"] = "confirmed" }
    return try route(authorized, refreshed: refreshed)
  }

  private func route(_ prepared: [String: Any], refreshed: [String: Any]) throws -> [String: Any] {
    let coordinationId = prepared["coordinationId"] as? String ?? UUID().uuidString.lowercased()
    let targetId = prepared["targetThreadId"] as? String ?? ""
    let message = coordinationMessage(prepared)
    let priority = prepared["priority"] as? String ?? "normal"
    let state = refreshed["state"] as? String ?? "system_error"
    let now = isoNow()
    if state == "system_error" { return dispatchFailure(coordinationId, "stale_status", "target status is not dispatchable") }
    if state == "running" && priority != "urgent" {
      var queuedItem = prepared
      queuedItem["state"] = "queued"
      queuedItem["queueExpiresAt"] = ISO8601DateFormatter().string(from: Date().addingTimeInterval(Self.queueWindow))
      lock.lock(); queued.append(queuedItem); lock.unlock()
      let result: [String: Any] = ["coordinationId": coordinationId, "state": "queued", "targetThreadId": targetId, "protocolMethod": "host_queue", "dispatchedAt": now, "updatedAt": now]
      storeResult(coordinationId, result)
      appendReceipt(prepared, event: "queued", state: "queued", protocolMethod: "host_queue")
      return result
    }

    var protocolMethod = "turn/start"
    var response: [String: Any]
    if state == "running" {
      guard let activeTurnId = refreshed["activeTurnId"] as? String ?? appServer.cachedActiveTurnId(threadId: targetId) else {
        return dispatchFailure(coordinationId, "stale_status", "running target has no active turn id")
      }
      response = try appServer.steerCoordinationTurn(threadId: targetId, turnId: activeTurnId, message: "[Realtime coordination]\n\(message)")
      protocolMethod = "turn/steer"
    } else {
      if state == "unloaded" {
        _ = try appServer.resumeCoordinationThread(id: targetId)
        protocolMethod = "thread/resume+turn/start"
      }
      response = try appServer.startCoordinationTurn(
        threadId: targetId, message: message,
        model: prepared["model"] as? String, effort: prepared["reasoningEffort"] as? String
      )
    }
    let turn = response["turn"] as? [String: Any]
    let turnId = turn?["id"] as? String ?? response["turnId"] as? String
    let dispatchState = protocolMethod == "turn/steer" ? "steered" : "started"
    var result: [String: Any] = [
      "coordinationId": coordinationId, "state": dispatchState, "targetThreadId": targetId,
      "protocolMethod": protocolMethod, "dispatchedAt": now, "updatedAt": now
    ]
    if let turnId { result["turnId"] = turnId; lock.lock(); coordinationByTurn[turnId] = coordinationId; lock.unlock() }
    storeResult(coordinationId, result)
    appendReceipt(prepared, event: "delivered", state: dispatchState, protocolMethod: protocolMethod, turnId: turnId)
    return result
  }

  private func waitCoordination(_ payload: [String: Any]) throws -> [String: Any] {
    let coordinationId = try requiredString(payload, "coordinationId")
    let timeoutMs = min(max(payload["timeoutMs"] as? Int ?? 30_000, 0), 180_000)
    let deadline = Date().addingTimeInterval(Double(timeoutMs) / 1000)
    repeat {
      lock.lock(); let result = results[coordinationId]; lock.unlock()
      if let result, let state = result["state"] as? String, ["completed", "failed", "cancelled", "rejected"].contains(state) { return result }
      if Date() >= deadline {
        return ["coordinationId": coordinationId, "state": "wait_timeout", "targetThreadId": result?["targetThreadId"] ?? "", "updatedAt": isoNow(), "guard": guardValue("wait_timeout", "wait deadline reached")]
      }
      Thread.sleep(forTimeInterval: 0.05)
    } while true
  }

  private func drainQueue(threadId: String) {
    lock.lock()
    guard let index = queued.firstIndex(where: { $0["targetThreadId"] as? String == threadId }) else { lock.unlock(); return }
    let item = queued.remove(at: index)
    lock.unlock()
    if let expiresAt = item["queueExpiresAt"] as? String,
       let expiration = ISO8601DateFormatter().date(from: expiresAt),
       expiration <= Date() {
      let coordinationId = item["coordinationId"] as? String ?? ""
      let now = isoNow()
      storeResult(coordinationId, [
        "coordinationId": coordinationId,
        "state": "cancelled",
        "targetThreadId": threadId,
        "resultSummaryOrRef": "queue_expired",
        "completedAt": now,
        "updatedAt": now
      ])
      return
    }
    do {
      let refreshed = try readThread(["threadId": threadId, "includeTurns": true])
      _ = try route(item, refreshed: refreshed)
    } catch {
      let coordinationId = item["coordinationId"] as? String ?? ""
      let failed = dispatchFailure(coordinationId, "dispatch_failed", String(describing: error))
      storeResult(coordinationId, failed)
    }
  }

  private func projectThread(_ thread: [String: Any], archived: Bool) -> [String: Any] {
    let id = thread["id"] as? String ?? ""
    let status = thread["status"] as? [String: Any] ?? ["type": "systemError"]
    let statusType = status["type"] as? String ?? "systemError"
    let state = statusType == "notLoaded" ? "unloaded" : statusType == "idle" ? "idle" : statusType == "active" ? "running" : "system_error"
    let cwd = thread["cwd"] as? String ?? ""
    let extra = thread["extra"] as? [String: Any] ?? [:]
    let turns = thread["turns"] as? [[String: Any]] ?? []
    let activeTurnId = turns.first(where: { $0["status"] as? String == "inProgress" })?["id"] as? String ?? appServer.cachedActiveTurnId(threadId: id)
    var projected: [String: Any] = thread
    projected["sessionId"] = thread["sessionId"] as? String ?? id
    projected["projectKey"] = extra["projectKey"] as? String ?? NSNull()
    projected["hostId"] = hostId
    projected["state"] = state
    projected["summary"] = thread["preview"] as? String ?? ""
    projected["workspace"] = cwd
    projected["currentWorkspace"] = cwd == workspaceRoot.path
    projected["owner"] = thread["agentRole"] as? String ?? "user"
    projected["goal"] = extra["goal"] as? String ?? ""
    projected["archived"] = archived
    projected["parentThreadId"] = thread["parentThreadId"] ?? NSNull()
    projected["ancestorThreadIds"] = extra["ancestorThreadIds"] as? [String] ?? []
    projected["writeSet"] = extra["writeSet"] as? [String] ?? []
    if let activeTurnId { projected["activeTurnId"] = activeTurnId }
    return projected
  }

  private func dispatchKind(target: [String: Any], priority: String) -> String {
    target["state"] as? String == "running" ? (priority == "urgent" ? "steered" : "queued") : "started"
  }

  private func coordinationMessage(_ value: [String: Any]) -> String {
    let sender = value["sender"] as? String ?? "user"
    let summary = value["summary"] as? String ?? "Coordination"
    let reason = value["reason"] as? String ?? ""
    let message = value["message"] as? String ?? ""
    return "[Cross-thread coordination from \(sender)] \(summary)\nReason: \(reason)\n\n\(message)"
  }

  private func proposalReceipt(tool: String, payload: [String: Any]) -> [String: Any] {
    ["state": "confirmation_required", "tool": tool, "request": payload, "permissionDecision": "confirmation_required", "createdAt": isoNow()]
  }

  private func deniedTool(_ code: String, _ message: String) -> [String: Any] {
    ["state": "rejected", "permissionDecision": "denied", "guard": guardValue(code, message), "createdAt": isoNow()]
  }

  private func rejectedPreparation(_ request: [String: Any], _ id: String, _ code: String, _ message: String, _ now: String) -> [String: Any] {
    ["state": "rejected", "coordinationId": id, "request": request, "targetWriteSet": [], "permissionDecision": "denied", "guard": guardValue(code, message), "preparedAt": now]
  }

  private func dispatchFailure(_ id: String, _ code: String, _ message: String) -> [String: Any] {
    ["coordinationId": id, "state": "rejected", "targetThreadId": "", "guard": guardValue(code, message), "dispatchedAt": isoNow(), "updatedAt": isoNow()]
  }

  private func guardValue(_ code: String, _ message: String) -> [String: Any] { ["code": code, "message": message] }

  private func writeSetsOverlap(_ left: [String], _ right: [String]) -> Bool {
    let a = left.map { $0.trimmingCharacters(in: CharacterSet(charactersIn: "/")) }
    let b = right.map { $0.trimmingCharacters(in: CharacterSet(charactersIn: "/")) }
    return a.contains { x in b.contains { y in x == y || x.hasPrefix(y + "/") || y.hasPrefix(x + "/") } }
  }

  private func requiredString(_ payload: [String: Any], _ key: String) throws -> String {
    guard let value = payload[key] as? String, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw BridgeError.invalidPayload("missing \(key)")
    }
    return value
  }

  private func isThreadArchived(_ id: String) -> Bool {
    lock.lock()
    let cached = archivedThreadIds.contains(id)
    lock.unlock()
    if cached { return true }
    guard let listed = try? appServer.listThreads(params: ["archived": true]),
          let threads = listed["data"] as? [[String: Any]] else { return false }
    let archived = threads.contains { $0["id"] as? String == id }
    if archived { lock.lock(); archivedThreadIds.insert(id); lock.unlock() }
    return archived
  }

  private func storeResult(_ id: String, _ result: [String: Any]) {
    lock.lock(); results[id] = result; lock.unlock()
    onEvent?([
      "method": "coordination/receipt",
      "threadId": result["targetThreadId"] ?? "",
      "coordinationId": result["coordinationId"] ?? id,
      "state": result["state"] ?? "",
      "raw": result
    ])
  }

  private func latestCoordinationId(threadId: String) -> String? {
    lock.lock(); defer { lock.unlock() }
    return results.values.first(where: { $0["targetThreadId"] as? String == threadId })?["coordinationId"] as? String
  }

  private func appendLedger(event: String, coordinationId: String, state: String, targetThreadId: String, turnId: String? = nil) {
    var record: [String: Any] = ["event": event, "coordinationId": coordinationId, "state": state, "targetThreadId": targetThreadId, "recordedAt": isoNow()]
    if let turnId { record["turnId"] = turnId }
    ledger.append(record)
  }

  private func appendReceipt(_ value: [String: Any], event: String, state: String, protocolMethod: String, turnId: String? = nil) {
    var record: [String: Any] = [
      "event": event, "coordinationId": value["coordinationId"] ?? "", "sourceThreadId": value["sourceThreadId"] ?? "",
      "targetThreadId": value["targetThreadId"] ?? "", "sourceHostId": value["sourceHostId"] ?? "",
      "targetHostId": value["targetHostId"] ?? "", "projectKey": value["projectKey"] ?? NSNull(),
      "sender": value["sender"] ?? "", "intent": value["intent"] ?? "", "reason": value["reason"] ?? "",
      "messageSummary": value["summary"] ?? "", "protocolMethod": protocolMethod, "queueDecision": state == "queued" ? "queued" : "direct",
      "permissionDecision": value["permissionDecision"] ?? "confirmation_required", "writeSetDecision": "no_conflict",
      "status": state, "dedupeKey": value["dedupeKey"] ?? "", "recordedAt": isoNow()
    ]
    if let turnId { record["turnId"] = turnId }
    ledger.append(record)
  }

  private func isoNow() -> String { ISO8601DateFormatter().string(from: Date()) }
}

final class NativeBridge: NSObject, WKScriptMessageHandler {
  weak var webView: WKWebView?
  private let workspaceRoot: URL
  private lazy var appServer = CodexAppServerClient(workspaceRoot: workspaceRoot)
  private lazy var coordinationHost = ThreadCoordinationHost(appServer: appServer, workspaceRoot: workspaceRoot)

  init(workspaceRoot: URL) {
    self.workspaceRoot = workspaceRoot
    super.init()
    self.appServer.onEvent = { [weak self] event in
      self?.emit(event: event)
    }
    self.appServer.onThreadStatus = { [weak self] threadId, status in
      self?.coordinationHost.threadStatusChanged(threadId: threadId, status: status)
    }
    self.appServer.onTurnCompleted = { [weak self] threadId, turn in
      self?.coordinationHost.turnCompleted(threadId: threadId, turn: turn)
    }
    self.appServer.onDynamicToolCall = { [weak self] params in
      guard let self else { throw BridgeError.invalidPayload("coordination host unavailable") }
      return try self.coordinationHost.handleDynamicTool(params)
    }
    self.coordinationHost.onEvent = { [weak self] event in
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
    case "listThreads", "readThread", "resumeThread", "prepareCoordination", "dispatchCoordination", "forkThread", "setArchived", "waitCoordination":
      return try coordinationHost.handle(method: method, payload: payload)
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
    let process = Process()
    if args.first == "opl", let configured = ProcessInfo.processInfo.environment["OPL_APP_OPL_BIN"], !configured.isEmpty {
      process.executableURL = URL(fileURLWithPath: configured)
      process.arguments = Array(args.dropFirst())
    } else {
      process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
      process.arguments = args
    }
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
