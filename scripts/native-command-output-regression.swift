import Foundation

enum NativeCommandOutputRegressionFailure: Error {
  case assertion(String)
}

func requireNativeCommandOutput(_ condition: @autoclosure () -> Bool, _ message: String) throws {
  if !condition() { throw NativeCommandOutputRegressionFailure.assertion(message) }
}

@main
struct NativeCommandOutputRegression {
  static func main() throws {
    let script = #"BEGIN { for (i = 0; i < 12000; i++) { print "stdout-pipe-regression-" i; print "stderr-pipe-regression-" i > "/dev/stderr" } }"#
    let result = runNativeCommand(
      ["/usr/bin/awk", script],
      input: nil,
      cwd: URL(fileURLWithPath: FileManager.default.currentDirectoryPath),
      timeout: 10
    )

    try requireNativeCommandOutput(!result.timedOut, "large stdout/stderr command must not time out")
    try requireNativeCommandOutput(result.exitCode == 0, "large stdout/stderr command must exit successfully")
    try requireNativeCommandOutput(result.stdout.utf8.count > 250_000, "stdout must be drained beyond the pipe buffer")
    try requireNativeCommandOutput(result.stderr.utf8.count > 250_000, "stderr must be drained beyond the pipe buffer")
    try requireNativeCommandOutput(result.stdout.contains("stdout-pipe-regression-11999"), "stdout tail must be complete")
    try requireNativeCommandOutput(result.stderr.contains("stderr-pipe-regression-11999"), "stderr tail must be complete")

    let command = ["opl", "app", "state", "--profile", "fast", "--json"]
    let state = try buildStateCommandPayload(
      profile: "fast",
      command: command,
      result: CommandResult(exitCode: 0, stdout: #"{"version":"test","app_state":{"meta":{"profile":"fast"}}}"#, stderr: "", timedOut: false)
    )
    try requireNativeCommandOutput(state["profile"] as? String == "fast", "valid state must preserve the requested profile")
    try requireNativeCommandOutput((state["app_state"] as? [String: Any])?["version"] as? String == "test", "valid state JSON must reach the bridge")

    try requireStateCommandFailure(
      CommandResult(exitCode: -1, stdout: "", stderr: "", timedOut: true),
      command: command,
      expected: "timed out"
    )
    try requireStateCommandFailure(
      CommandResult(exitCode: 127, stdout: "", stderr: "node: not found", timedOut: false),
      command: command,
      expected: "exit 127"
    )
    try requireStateCommandFailure(
      CommandResult(exitCode: 0, stdout: "not-json", stderr: "", timedOut: false),
      command: command,
      expected: "invalid JSON"
    )

    print("{\"status\":\"native_command_output_regression_passed\",\"stdout_bytes\":\(result.stdout.utf8.count),\"stderr_bytes\":\(result.stderr.utf8.count)}")
  }

  static func requireStateCommandFailure(
    _ result: CommandResult,
    command: [String],
    expected: String
  ) throws {
    do {
      _ = try buildStateCommandPayload(profile: "fast", command: command, result: result)
      throw NativeCommandOutputRegressionFailure.assertion("state command failure must not become an empty ready projection")
    } catch let error as BridgeError {
      try requireNativeCommandOutput(error.description.contains(expected), "state error must explain \(expected)")
    }
  }
}
