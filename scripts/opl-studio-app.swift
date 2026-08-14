import Cocoa
import WebKit

struct CommandResult {
  let exitCode: Int32
  let stdout: String
  let stderr: String
  let timedOut: Bool
}

func buildStateCommandPayload(
  profile: String,
  command: [String],
  result: CommandResult
) throws -> [String: Any] {
  if result.timedOut {
    throw BridgeError.invalidPayload("OPL App state read timed out")
  }
  if result.exitCode != 0 {
    let detail = result.stderr.trimmingCharacters(in: .whitespacesAndNewlines)
    let suffix = detail.isEmpty ? "" : ": \(detail)"
    throw BridgeError.invalidPayload("OPL App state read failed (exit \(result.exitCode))\(suffix)")
  }

  guard let data = result.stdout.data(using: .utf8) else {
    throw BridgeError.invalidPayload("OPL App state read returned non-UTF-8 output")
  }
  let value: Any
  do {
    value = try JSONSerialization.jsonObject(with: data)
  } catch {
    throw BridgeError.invalidPayload("OPL App state read returned invalid JSON (\(result.stdout.utf8.count) bytes): \(error.localizedDescription)")
  }
  guard let appState = value as? [String: Any] else {
    throw BridgeError.invalidPayload("OPL App state read returned a non-object JSON value")
  }

  return [
    "profile": profile,
    "app_state": appState,
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

func externalExecutableCandidates(
  name: String,
  explicitEnvironmentKeys: [String],
  environment: [String: String] = ProcessInfo.processInfo.environment,
  homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser
) -> [String] {
  let explicit = explicitEnvironmentKeys.compactMap { key -> String? in
    guard let value = environment[key]?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return nil
    }
    return value
  }
  let configuredCodexHome = environment["CODEX_HOME"]?.trimmingCharacters(in: .whitespacesAndNewlines)
  let codexHome = (configuredCodexHome?.isEmpty == false ? configuredCodexHome : nil)
    ?? homeDirectory.appendingPathComponent(".codex").path
  let managed = name == "codex" ? [
    URL(fileURLWithPath: codexHome).appendingPathComponent("packages/standalone/current/codex").path,
    homeDirectory.appendingPathComponent("Library/Application Support/OPL/runtime/current/bin/codex").path,
    homeDirectory.appendingPathComponent(".local/bin/codex").path
  ] : [
    homeDirectory.appendingPathComponent(".local/bin/\(name)").path
  ]
  let standard = ["/opt/homebrew/bin/\(name)", "/usr/local/bin/\(name)"]
  let pathCandidates = (environment["PATH"] ?? "")
    .split(separator: ":")
    .map { URL(fileURLWithPath: String($0)).appendingPathComponent(name).path }
  return Array(NSOrderedSet(array: explicit + managed + standard + pathCandidates)) as? [String] ?? []
}

func resolveExternalExecutable(
  name: String,
  explicitEnvironmentKeys: [String],
  environment: [String: String] = ProcessInfo.processInfo.environment,
  homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser,
  isExecutable: (String) -> Bool = { FileManager.default.isExecutableFile(atPath: $0) }
) -> String? {
  externalExecutableCandidates(
    name: name,
    explicitEnvironmentKeys: explicitEnvironmentKeys,
    environment: environment,
    homeDirectory: homeDirectory
  ).first(where: isExecutable)
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
  if args.first == "opl", let executable = resolveExternalExecutable(
    name: "opl",
    explicitEnvironmentKeys: ["OPL_APP_OPL_BIN"],
    environment: environment
  ) {
    process.executableURL = URL(fileURLWithPath: executable)
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

let gatewayAccountErrorCodes = Set([
  "invalid_credentials",
  "account_disabled",
  "mfa_or_challenge_required",
  "session_not_persistable",
  "group_selection_required",
  "auth_expired",
  "network_unreachable",
  "rate_limited",
  "managed_key_missing",
  "managed_key_conflict",
  "managed_key_identity_drift",
  "disconnect_pending",
  "invalid_request",
  "internal_contract_violation",
  "gateway_account_failed"
])

let gatewayAccountErrorAliases = [
  "credentials_stdin_invalid": "invalid_request",
  "reauth_required": "auth_expired",
  "network_timeout": "network_unreachable",
  "gateway_unavailable": "network_unreachable"
]

let gatewaySecretFieldNames = Set([
  "password", "token", "accesstoken", "refreshtoken", "apikey", "key",
  "keyvalue", "keyplaintext", "plaintextkey", "secret"
])

func containsGatewaySecretField(_ value: Any) -> Bool {
  if let values = value as? [Any] {
    return values.contains(where: containsGatewaySecretField)
  }
  guard let record = value as? [String: Any] else { return false }
  return record.contains { field, nested in
    let normalized = field.unicodeScalars
      .filter(CharacterSet.alphanumerics.contains)
      .map(String.init)
      .joined()
      .lowercased()
    return gatewaySecretFieldNames.contains(normalized) || containsGatewaySecretField(nested)
  }
}

func normalizeGatewayAccountErrorCode(_ value: Any?) -> String? {
  guard let value = value as? String else { return nil }
  if gatewayAccountErrorCodes.contains(value) { return value }
  return gatewayAccountErrorAliases[value]
}

func gatewayAccountErrorCode(_ value: Any?) -> String? {
  guard let record = value as? [String: Any] else { return nil }
  let error = record["error"] as? [String: Any]
  let details = record["details"] as? [String: Any]
  let errorDetails = error?["details"] as? [String: Any]
  return [
    record["error_code"],
    error?["code"],
    details?["reason_code"],
    errorDetails?["reason_code"]
  ].compactMap(normalizeGatewayAccountErrorCode).first
}

func inferGatewayAccountErrorCode(result: CommandResult, parsed: Any?) -> String {
  if let code = gatewayAccountErrorCode(parsed) { return code }
  if result.timedOut { return "network_unreachable" }
  let text = result.stderr.lowercased()
  if text.contains("invalid credentials") || text.contains("invalid password") || text.contains("unauthorized") || text.contains("401") {
    return "invalid_credentials"
  }
  if text.contains("disabled") || text.contains("suspended") { return "account_disabled" }
  if text.contains("turnstile") || text.contains("captcha") || text.contains("totp") || text.contains("two-factor") || text.contains("mfa") || text.contains("challenge") {
    return "mfa_or_challenge_required"
  }
  if text.contains("429") || text.contains("rate limit") { return "rate_limited" }
  if text.contains("network") || text.contains("enotfound") || text.contains("econn") || text.contains("timeout") || text.contains("timed out") {
    return "network_unreachable"
  }
  return "gateway_account_failed"
}

func sanitizeGatewayAccountLoginResult(_ result: CommandResult, secretValues: [String] = []) -> [String: Any] {
  if secretValues.contains(where: { !$0.isEmpty && (result.stdout.contains($0) || result.stderr.contains($0)) }) {
    return ["ok": false, "errorCode": "internal_contract_violation", "stateRefreshRequired": false]
  }
  let parsed: Any?
  if let data = result.stdout.data(using: .utf8) {
    parsed = try? JSONSerialization.jsonObject(with: data)
  } else {
    parsed = nil
  }
  guard let record = parsed as? [String: Any] else {
    return [
      "ok": false,
      "errorCode": result.exitCode == 0 ? "internal_contract_violation" : inferGatewayAccountErrorCode(result: result, parsed: parsed),
      "stateRefreshRequired": false
    ]
  }
  if containsGatewaySecretField(record) {
    return ["ok": false, "errorCode": "internal_contract_violation", "stateRefreshRequired": false]
  }
  if result.exitCode != 0 || record["ok"] as? Bool == false {
    return [
      "ok": false,
      "errorCode": inferGatewayAccountErrorCode(result: result, parsed: record),
      "stateRefreshRequired": false
    ]
  }
  return ["ok": true, "stateRefreshRequired": true]
}

func loginGatewayAccount(
  payload: [String: Any],
  cwd: URL,
  runCommand: (_ args: [String], _ input: String?, _ cwd: URL, _ timeout: TimeInterval) -> CommandResult = {
    args, input, cwd, timeout in runNativeCommand(args, input: input, cwd: cwd, timeout: timeout)
  }
) -> [String: Any] {
  let allowedFields = Set(["email", "password", "deviceLabel"])
  guard Set(payload.keys).isSubset(of: allowedFields),
        let rawEmail = payload["email"] as? String,
        let password = payload["password"] as? String else {
    return ["ok": false, "errorCode": "invalid_request", "stateRefreshRequired": false]
  }
  let email = rawEmail.trimmingCharacters(in: .whitespacesAndNewlines)
  let deviceLabel = (payload["deviceLabel"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  guard !email.isEmpty, !password.isEmpty else {
    return ["ok": false, "errorCode": "invalid_request", "stateRefreshRequired": false]
  }
  var envelope: [String: Any] = ["email": email, "password": password]
  if !deviceLabel.isEmpty { envelope["device_label"] = deviceLabel }
  guard let data = try? JSONSerialization.data(withJSONObject: envelope),
        var stdin = String(data: data, encoding: .utf8) else {
    return ["ok": false, "errorCode": "internal_contract_violation", "stateRefreshRequired": false]
  }
  stdin.append("\n")
  let result = runCommand(
    ["opl", "connect", "gateway", "login", "--credentials-stdin", "--json"],
    stdin,
    cwd,
    45
  )
  return sanitizeGatewayAccountLoginResult(result, secretValues: [password])
}

func nativeAppUpdateUnsupported(operation: String, host: String, currentVersion: String? = nil) -> [String: Any] {
  var result: [String: Any] = [
    "schema": "opl_native_app_updater.v1",
    "owner": "one-person-lab-app_native_host",
    "host": host,
    "operation": operation,
    "supported": false,
    "state": "unsupported",
    "restartRequired": false,
    "reasonCode": host == "native" ? "native_updater_not_packaged" : "native_host_required",
    "ownerFallback": "one-person-lab-app"
  ]
  if let currentVersion, !currentVersion.isEmpty { result["currentVersion"] = currentVersion }
  return result
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
  private static let defaultPermissions = ":danger-full-access"
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
  private let initializationLock = NSLock()
  var onEvent: (([String: Any]) -> Void)?

  init(workspaceRoot: URL) {
    self.workspaceRoot = workspaceRoot
  }

  func send(
    prompt: String,
    inputs: [[String: Any]]?,
    requestedThreadId: String?,
    agentSelection: [String: Any]?,
    model: String?,
    effort: String?,
    permissions: String?
  ) throws -> [String: Any] {
    turnLock.lock()
    defer { turnLock.unlock() }

    try ensureInitialized()
    let resolvedPermissions = (permissions?.isEmpty == false ? permissions : nil) ?? Self.defaultPermissions
    let selection = try normalizeAgentSelection(agentSelection)
    let thread: String
    if let requestedThreadId, !requestedThreadId.isEmpty {
      guard selection == nil else {
        throw BridgeError.invalidPayload("an existing conversation cannot be rebound to another Agent")
      }
      if requestedThreadId != threadId {
        try resumeThread(requestedThreadId, permissions: resolvedPermissions)
      }
      thread = requestedThreadId
    } else {
      threadId = nil
      thread = try ensureThread(permissions: resolvedPermissions, agentSelection: selection)
    }
    var turnParams: [String: Any] = [
      "threadId": thread,
      "input": try buildUserInputs(prompt: prompt, inputs: inputs),
      "cwd": workspaceRoot.path,
      "approvalPolicy": "never",
      "permissions": resolvedPermissions
    ]
    if let model, !model.isEmpty {
      turnParams["model"] = model
    }
    if let effort, !effort.isEmpty {
      turnParams["effort"] = effort
    }
    if let selection {
      turnParams["additionalContext"] = [
        "opl.standard_agent_selection": [
          "kind": "application",
          "value": try jsonString(selection)
        ]
      ]
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
      "effort": effort ?? "configured_default",
      "permissions": resolvedPermissions
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

  func listCapabilities(threadId: String?) throws -> [String: Any] {
    turnLock.lock()
    defer { turnLock.unlock() }
    try ensureInitialized()
    var skills: [[String: Any]] = []
    var plugins: [[String: Any]] = []
    var apps: [[String: Any]] = []
    var errors: [String] = []

    do {
      let response = try request(
        method: "skills/list",
        params: ["cwds": [workspaceRoot.path], "forceReload": false],
        timeout: Self.requestTimeout
      )
      let result = response["result"] as? [String: Any] ?? [:]
      for entry in result["data"] as? [[String: Any]] ?? [] {
        skills.append(contentsOf: entry["skills"] as? [[String: Any]] ?? [])
      }
    } catch {
      errors.append("skills/list: \(error)")
    }

    do {
      let response = try request(
        method: "plugin/installed",
        params: ["cwds": [workspaceRoot.path]],
        timeout: Self.requestTimeout
      )
      let result = response["result"] as? [String: Any] ?? [:]
      for marketplace in result["marketplaces"] as? [[String: Any]] ?? [] {
        plugins.append(contentsOf: marketplace["plugins"] as? [[String: Any]] ?? [])
      }
    } catch {
      errors.append("plugin/installed: \(error)")
    }

    do {
      var params: [String: Any] = ["forceRefresh": false]
      if let threadId, !threadId.isEmpty { params["threadId"] = threadId }
      let response = try request(method: "app/installed", params: params, timeout: Self.requestTimeout)
      let result = response["result"] as? [String: Any] ?? [:]
      apps = result["apps"] as? [[String: Any]] ?? []
    } catch {
      errors.append("app/installed: \(error)")
    }

    return ["skills": skills, "plugins": plugins, "apps": apps, "errors": errors]
  }

  func listPermissionProfiles() throws -> [String: Any] {
    turnLock.lock()
    defer { turnLock.unlock() }
    try ensureInitialized()
    let response = try request(
      method: "permissionProfile/list",
      params: ["cwd": workspaceRoot.path],
      timeout: Self.requestTimeout
    )
    guard let result = response["result"] as? [String: Any] else {
      throw BridgeError.invalidPayload("app-server permissionProfile/list returned no result")
    }
    return result
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
        "cwd": workspaceRoot.path
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
      "threadSource": "opl-studio"
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
      "permissions": Self.defaultPermissions
    ]
    if let model, !model.isEmpty { params["model"] = model }
    if let effort, !effort.isEmpty { params["effort"] = effort }
    let response = try request(method: "turn/start", params: params, timeout: Self.requestTimeout)
    guard let result = response["result"] as? [String: Any] else {
      throw BridgeError.invalidPayload("app-server turn/start returned no result")
    }
    return result
  }

  func steerTurn(threadId: String, turnId: String, prompt: String, inputs: [[String: Any]]?) throws -> [String: Any] {
    try ensureInitialized()
    let response = try request(
      method: "turn/steer",
      params: [
        "threadId": threadId,
        "expectedTurnId": turnId,
        "input": try buildUserInputs(prompt: prompt, inputs: inputs)
      ],
      timeout: Self.requestTimeout
    )
    guard let result = response["result"] as? [String: Any] else {
      throw BridgeError.invalidPayload("app-server turn/steer returned no result")
    }
    return result
  }

  func interruptTurn(threadId: String, turnId: String) throws -> [String: Any] {
    try ensureInitialized()
    _ = try request(
      method: "turn/interrupt",
      params: ["threadId": threadId, "turnId": turnId],
      timeout: Self.requestTimeout
    )
    return [
      "executor": "codex_app_server",
      "transport": "stdio_json_rpc",
      "threadId": threadId,
      "turnId": turnId,
      "accepted": true
    ]
  }

  func steer(
    threadId: String,
    expectedTurnId: String,
    prompt: String,
    inputs: [[String: Any]]?
  ) throws -> [String: Any] {
    guard !threadId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw BridgeError.invalidPayload("turn/steer requires a thread id")
    }
    guard !expectedTurnId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      throw BridgeError.invalidPayload("turn/steer requires the expected active turn id")
    }
    let result = try steerTurn(
      threadId: threadId,
      turnId: expectedTurnId,
      prompt: prompt,
      inputs: inputs
    )
    if let receivedTurnId = result["turnId"] as? String, receivedTurnId != expectedTurnId {
      throw BridgeError.invalidPayload("app-server turn/steer acknowledged a different active turn")
    }
    return [
      "executor": "codex_app_server",
      "transport": "stdio_json_rpc",
      "threadId": threadId,
      "expectedTurnId": expectedTurnId,
      "turnId": expectedTurnId,
      "accepted": true
    ]
  }

  private func ensureInitialized() throws {
    initializationLock.lock()
    defer { initializationLock.unlock() }
    if initialized, process?.isRunning == true { return }
    initialized = false
    try startProcess()
    _ = try request(
      method: "initialize",
      params: [
        "clientInfo": [
          "name": "opl-studio",
          "title": "One Person Lab Preview",
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

  private func buildUserInputs(
    prompt: String,
    inputs: [[String: Any]]?
  ) throws -> [[String: Any]] {
    var normalized: [[String: Any]] = []
    let text = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
    if !text.isEmpty {
      normalized.append(["type": "text", "text": text, "text_elements": []])
    }
    for input in inputs ?? [] {
      guard let type = input["type"] as? String else {
        throw BridgeError.invalidPayload("Codex input is missing type")
      }
      switch type {
      case "localImage":
        guard let path = input["path"] as? String, (path as NSString).isAbsolutePath else {
          throw BridgeError.invalidPayload("localImage input requires an absolute path")
        }
        normalized.append(["type": type, "path": path, "detail": input["detail"] ?? NSNull()])
      case "skill", "mention":
        guard
          let name = input["name"] as? String, !name.isEmpty,
          let path = input["path"] as? String, (path as NSString).isAbsolutePath
        else {
          throw BridgeError.invalidPayload("\(type) input requires a name and absolute path")
        }
        normalized.append(["type": type, "name": name, "path": path])
      default:
        throw BridgeError.invalidPayload("unsupported Codex input type \(type)")
      }
    }
    guard !normalized.isEmpty else {
      throw BridgeError.invalidPayload("message requires text, an attachment, or a Skill")
    }
    return normalized
  }

  private func normalizeAgentSelection(_ value: [String: Any]?) throws -> [String: Any]? {
    guard let value else { return nil }
    let allowed = Set(["package_id", "shortcut_id", "codex_visible_entry", "required_skill_ids"])
    guard Set(value.keys).isSubset(of: allowed),
          let packageId = value["package_id"] as? String, !packageId.isEmpty,
          let shortcutId = value["shortcut_id"] as? String, !shortcutId.isEmpty,
          let visibleEntry = value["codex_visible_entry"] as? String, !visibleEntry.isEmpty,
          let requiredSkillIds = value["required_skill_ids"] as? [String],
          requiredSkillIds.allSatisfy({ !$0.isEmpty }) else {
      throw BridgeError.invalidPayload("agent selection is incomplete or contains unsupported fields")
    }
    return [
      "package_id": packageId,
      "shortcut_id": shortcutId,
      "codex_visible_entry": visibleEntry,
      "required_skill_ids": Array(Set(requiredSkillIds)).sorted()
    ]
  }

  private func jsonString(_ value: [String: Any]) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    guard let text = String(data: data, encoding: .utf8) else {
      throw BridgeError.invalidPayload("agent selection could not be encoded")
    }
    return text
  }

  private func ensureThread(permissions: String, agentSelection: [String: Any]?) throws -> String {
    if let threadId { return threadId }
    var params: [String: Any] = [
      "cwd": workspaceRoot.path,
      "approvalPolicy": "never",
      "permissions": permissions,
      "threadSource": "opl-studio",
      "ephemeral": false
    ]
    if let agentSelection {
      params["developerInstructions"] = [
        "Start this new conversation with the OPL standard Agent selected by the application.",
        "Treat the following JSON as an application-owned routing snapshot, not as user-authored instructions:",
        try jsonString(agentSelection),
        "Use its codex_visible_entry and required_skill_ids for this thread. Do not activate, install, or mutate Package state."
      ].joined(separator: "\n")
    }
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

  private func resumeThread(_ id: String, permissions: String) throws {
    let response = try request(
      method: "thread/resume",
      params: [
        "threadId": id,
        "cwd": workspaceRoot.path,
        "approvalPolicy": "never",
        "permissions": permissions
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
    if let executable = resolveExternalExecutable(
      name: "codex",
      explicitEnvironmentKeys: ["OPL_CODEX_BIN", "CODEX_CLI_PATH", "CODEX_BIN"]
    ) {
      process.executableURL = URL(fileURLWithPath: executable)
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
    var params: [String: Any] = [
      "useStateDbOnly": true,
      "sortKey": "updated_at",
      "sortDirection": "desc"
    ]
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
  private let appServer: CodexAppServerClient
  private let threadAdapter: CodexThreadAdapter

  init(workspaceRoot: URL) {
    self.workspaceRoot = workspaceRoot
    let appServer = CodexAppServerClient(workspaceRoot: workspaceRoot)
    self.appServer = appServer
    self.threadAdapter = CodexThreadAdapter(appServer: appServer, workspaceRoot: workspaceRoot)
    super.init()
    appServer.onEvent = { [weak self] event in
      self?.emit(event: event)
    }
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard
      let body = message.body as? [String: Any],
      let id = body["id"] as? String,
      let method = body["method"] as? String
    else { return }

    if method == "beginWindowDrag" {
      guard let dragWindow = webView?.window else {
        resolve(id: id, ok: false, payload: ["error": "window unavailable for drag"])
        return
      }
      let currentEvent = NSApp.currentEvent
      let event = currentEvent?.type == .leftMouseDown
        ? currentEvent
        : NSEvent.mouseEvent(
            with: .leftMouseDown,
            location: dragWindow.convertPoint(fromScreen: NSEvent.mouseLocation),
            modifierFlags: currentEvent?.modifierFlags ?? [],
            timestamp: ProcessInfo.processInfo.systemUptime,
            windowNumber: dragWindow.windowNumber,
            context: nil,
            eventNumber: 0,
            clickCount: 1,
            pressure: 1
          )
      guard let event else {
        resolve(id: id, ok: false, payload: ["error": "unable to create window drag event"])
        return
      }
      dragWindow.performDrag(with: event)
      resolve(id: id, ok: true, payload: [:])
      return
    }

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
      return try stateCommandPayload(profile: profile)
    case "readFullDrilldown":
      return commandPayload(command: ["opl", "runtime", "app-operator-drilldown", "--detail", "full", "--json"], input: nil, timeout: 45)
    case "readContribution":
      guard
        let packageId = payload["packageId"] as? String, !packageId.isEmpty,
        let ref = payload["ref"] as? String, !ref.isEmpty
      else {
        throw BridgeError.invalidPayload("missing packageId or ref")
      }
      let input = payload["input"] as? [String: Any] ?? [:]
      return commandPayload(
        command: ["opl", "app", "contribution", "read", "--package-id", packageId, "--ref", ref, "--input", jsonString(input), "--json"],
        input: nil,
        timeout: 45
      )
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
      let prompt = payload["prompt"] as? String ?? ""
      let inputs = payload["inputs"] as? [[String: Any]]
      return try appServer.send(
        prompt: prompt,
        inputs: inputs,
        requestedThreadId: payload["threadId"] as? String,
        agentSelection: payload["agentSelection"] as? [String: Any],
        model: payload["model"] as? String,
        effort: payload["reasoningEffort"] as? String,
        permissions: payload["permissions"] as? String
      )
    case "steerTurn":
      guard let threadId = payload["threadId"] as? String,
            let expectedTurnId = payload["expectedTurnId"] as? String else {
        throw BridgeError.invalidPayload("turn/steer requires threadId and expectedTurnId")
      }
      return try appServer.steer(
        threadId: threadId,
        expectedTurnId: expectedTurnId,
        prompt: payload["prompt"] as? String ?? "",
        inputs: payload["inputs"] as? [[String: Any]]
      )
    case "interruptTurn":
      guard let threadId = payload["threadId"] as? String,
            let turnId = payload["turnId"] as? String,
            !threadId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            !turnId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        throw BridgeError.invalidPayload("turn/interrupt requires threadId and turnId")
      }
      return try appServer.interruptTurn(threadId: threadId, turnId: turnId)
    case "loginGatewayAccount":
      return loginGatewayAccount(payload: payload, cwd: workspaceRoot)
    case "readNativeAppUpdateStatus":
      return nativeAppUpdateStatus(operation: "status")
    case "checkNativeAppUpdate":
      return nativeAppUpdateStatus(operation: "check")
    case "applyNativeAppUpdate":
      return nativeAppUpdateStatus(operation: "apply")
    case "restartNativeApp":
      return scheduleApplicationRestart()
    case "readCodexModels":
      return try appServer.listModels()
    case "readCodexCapabilities":
      return try appServer.listCapabilities(threadId: payload["threadId"] as? String)
    case "readCodexPermissionProfiles":
      return try appServer.listPermissionProfiles()
    case "pickFiles":
      return ["items": try pickLocalInputs(directoriesOnly: false)]
    case "pickDirectory":
      return ["items": try pickLocalInputs(directoriesOnly: true)]
    case "listThreads", "readThread", "resumeThread", "forkThread", "setArchived":
      return try threadAdapter.handle(method: method, payload: payload)
    default:
      throw BridgeError.invalidPayload("unknown method \(method)")
    }
  }

  private func pickLocalInputs(directoriesOnly: Bool) throws -> [[String: Any]] {
    var selected: [URL] = []
    DispatchQueue.main.sync {
      let panel = NSOpenPanel()
      panel.canChooseFiles = !directoriesOnly
      panel.canChooseDirectories = directoriesOnly
      panel.allowsMultipleSelection = !directoriesOnly
      panel.resolvesAliases = true
      panel.prompt = directoriesOnly ? "选择文件夹" : "添加"
      if panel.runModal() == .OK { selected = panel.urls }
    }
    let imageExtensions = Set(["avif", "gif", "heic", "jpeg", "jpg", "png", "webp"])
    return selected.map { url in
      let isDirectory = (try? url.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true
      let kind = isDirectory ? "folder" : imageExtensions.contains(url.pathExtension.lowercased()) ? "image" : "file"
      return ["kind": kind, "name": url.lastPathComponent, "path": url.path]
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

  private func stateCommandPayload(profile: String) throws -> [String: Any] {
    let command = ["opl", "app", "state", "--profile", profile, "--json"]
    let result = runCommand(command, input: nil, cwd: workspaceRoot, timeout: 30)
    return try buildStateCommandPayload(profile: profile, command: command, result: result)
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
        "candidateReadOnly": environment["OPL_STUDIO_READ_ONLY"] == "1"
      ]
    }
    identity["status"] = "launcher_identity_available"
    identity["source"] = "app_root_gui_launcher"
    identity["candidateReadOnly"] = environment["OPL_STUDIO_READ_ONLY"] == "1"
    return identity
  }

  private func nativeAppUpdateStatus(operation: String) -> [String: Any] {
    nativeAppUpdateUnsupported(
      operation: operation,
      host: "native",
      currentVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
    )
  }

  private func scheduleApplicationRestart() -> [String: Any] {
    let bundleURL = Bundle.main.bundleURL
    guard bundleURL.pathExtension == "app" else {
      var result = nativeAppUpdateUnsupported(operation: "restart", host: "native")
      result["reasonCode"] = "application_bundle_unavailable"
      return result
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
      let configuration = NSWorkspace.OpenConfiguration()
      configuration.activates = true
      NSWorkspace.shared.openApplication(at: bundleURL, configuration: configuration) { _, error in
        if error == nil { NSApp.terminate(nil) }
      }
    }
    return [
      "schema": "opl_native_app_updater.v1",
      "owner": "one-person-lab-app_native_host",
      "host": "native",
      "operation": "restart",
      "supported": true,
      "state": "restart_scheduled",
      "accepted": true,
      "restartRequired": true
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
    let js = "window.__oplStudioResolve(\(jsonString(id)), \(ok ? "true" : "false"), \(jsonString(payload)));"
    DispatchQueue.main.async {
      self.webView?.evaluateJavaScript(js)
    }
  }

  private func emit(event: [String: Any]) {
    let js = "window.__oplStudioEvent(\(jsonString(event)));"
    DispatchQueue.main.async {
      self.webView?.evaluateJavaScript(js)
    }
  }
}

enum BridgeError: Error, CustomStringConvertible {
  case invalidPayload(String)

  var description: String {
    switch self {
    case .invalidPayload(let message): return message
    }
  }
}

func candidateActionBlocked(
  dryRun: Bool,
  environment: [String: String] = ProcessInfo.processInfo.environment
) -> Bool {
  !dryRun && environment["OPL_STUDIO_READ_ONLY"] == "1"
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
  if let configured = ProcessInfo.processInfo.environment["OPL_STUDIO_CODEX_CWD"], !configured.isEmpty {
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

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
  private var window: NSWindow?
  private var webView: WKWebView?
  private var bridge: NativeBridge?

  func applicationDidFinishLaunching(_ notification: Notification) {
    let appName = "One Person Lab Preview"
    let resourcesURL = URL(fileURLWithPath: CommandLine.arguments[0])
      .deletingLastPathComponent()
      .deletingLastPathComponent()
      .appendingPathComponent("Resources", isDirectory: true)
    let workbenchURL = resourcesURL.appendingPathComponent("workbench.html")

    let bridge = NativeBridge(workspaceRoot: defaultWorkspaceRoot())
    let userContentController = WKUserContentController()
    userContentController.add(bridge, name: "oplStudio")

    let configuration = WKWebViewConfiguration()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    configuration.userContentController = userContentController
    if ProcessInfo.processInfo.environment["OPL_STUDIO_SMOKE"] == "1" {
      configuration.websiteDataStore = .nonPersistent()
    }

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = self
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
      dragView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -64),
      dragView.topAnchor.constraint(equalTo: contentView.topAnchor),
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

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    guard ProcessInfo.processInfo.environment["OPL_STUDIO_SMOKE"] == "1" else { return }
    let smokePath = ProcessInfo.processInfo.environment["OPL_STUDIO_SMOKE_RESULT"] ?? ""
    guard !smokePath.isEmpty else { return }
    let script = """
    return await (async () => {
      const surface = window.oplStudio;
      if (!surface) throw new Error("native bridge unavailable");
      const listed = await surface.listThreads({ archived: false, limit: 100 });
      const first = Array.isArray(listed?.data) ? listed.data.find((thread) => thread?.id) : null;
      if (!first) throw new Error("canonical thread directory is empty");
      const read = await surface.readThread({ threadId: first.id, includeTurns: true });
      return JSON.stringify({
        status: "passed",
        threadListCount: listed.data.length,
        threadId: read.id,
        threadTitle: read.summary || read.name || read.preview || "",
        turnCount: Array.isArray(read.turns) ? read.turns.length : 0,
        historyRead: Array.isArray(read.turns),
        bridgeTransport: surface.eventSourceUrl
      });
    })()
    """
    webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
      let payload: [String: Any]
      switch result {
      case .success(let value):
        if let raw = value as? String,
           let data = raw.data(using: .utf8),
           let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
          payload = parsed
        } else {
          payload = ["status": "failed", "error": "invalid smoke payload"]
        }
      case .failure(let error):
        payload = ["status": "failed", "error": String(describing: error)]
      }
      guard JSONSerialization.isValidJSONObject(payload),
            let data = try? JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys]) else { return }
      try? data.write(to: URL(fileURLWithPath: smokePath), options: .atomic)
    }
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    true
  }
}

let app = NSApplication.shared

if ProcessInfo.processInfo.environment["OPL_STUDIO_POLICY_SMOKE"] == "1" {
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
