import Foundation

enum NativeHostTransportRegressionFailure: Error {
  case assertion(String)
}

func requireNativeHostTransport(_ condition: @autoclosure () -> Bool, _ message: String) throws {
  if !condition() { throw NativeHostTransportRegressionFailure.assertion(message) }
}

@main
struct NativeHostTransportRegression {
  static func main() throws {
    let password = "native-gateway-secret"
    var observedArgs: [String] = []
    var observedInput = ""
    let success = loginGatewayAccount(
      payload: ["email": " user@example.com ", "password": password, "deviceLabel": " Test Mac "],
      cwd: URL(fileURLWithPath: "/workspace")
    ) { args, input, _, _ in
      observedArgs = args
      observedInput = input ?? ""
      return CommandResult(exitCode: 0, stdout: #"{"ok":true,"account":"user@example.com"}"#, stderr: "", timedOut: false)
    }
    try requireNativeHostTransport(observedArgs == ["opl", "connect", "gateway", "login", "--credentials-stdin", "--json"], "Gateway command args must not contain credentials")
    try requireNativeHostTransport(!observedArgs.joined().contains(password), "Gateway password must not enter argv")
    let envelope = try JSONSerialization.jsonObject(with: Data(observedInput.utf8)) as? [String: Any]
    try requireNativeHostTransport(envelope?["email"] as? String == "user@example.com", "Gateway email must be trimmed in stdin")
    try requireNativeHostTransport(envelope?["password"] as? String == password, "Gateway password must reach only stdin")
    try requireNativeHostTransport(envelope?["device_label"] as? String == "Test Mac", "Gateway device label must use the CLI envelope field")
    try requireNativeHostTransport(success["ok"] as? Bool == true, "valid Gateway login must return typed success")
    try requireNativeHostTransport(success["stateRefreshRequired"] as? Bool == true, "valid Gateway login must require fresh state")
    try requireNativeHostTransport(success["stdout"] == nil && success["stderr"] == nil, "Gateway result must omit raw output")

    let secretOutput = sanitizeGatewayAccountLoginResult(CommandResult(
      exitCode: 0,
      stdout: #"{"ok":true,"password":"echoed-secret"}"#,
      stderr: "",
      timedOut: false
    ))
    try requireNativeHostTransport(secretOutput["ok"] as? Bool == false, "secret-bearing CLI output must fail closed")
    try requireNativeHostTransport(secretOutput["errorCode"] as? String == "internal_contract_violation", "secret-bearing CLI output must use the contract error")
    try requireNativeHostTransport(!jsonString(secretOutput).contains("echoed-secret"), "secret-bearing CLI output must not cross the bridge")

    let secretValueOutput = sanitizeGatewayAccountLoginResult(
      CommandResult(exitCode: 0, stdout: #"{"ok":true,"message":"native-gateway-secret"}"#, stderr: "", timedOut: false),
      secretValues: [password]
    )
    try requireNativeHostTransport(secretValueOutput["errorCode"] as? String == "internal_contract_violation", "secret value echoed under another field must fail closed")

    let update = nativeAppUpdateUnsupported(operation: "check", host: "native", currentVersion: "0.1.0")
    try requireNativeHostTransport(update["supported"] as? Bool == false, "unpackaged Native updater must stay unsupported")
    try requireNativeHostTransport(update["reasonCode"] as? String == "native_updater_not_packaged", "Native updater must identify its missing carrier")
    try requireNativeHostTransport(update["ownerFallback"] as? String == "one-person-lab-app", "Native updater must preserve App owner fallback")

    print("{\"status\":\"native_host_transport_regression_passed\"}")
  }
}
