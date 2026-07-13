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

    print("{\"status\":\"native_command_output_regression_passed\",\"stdout_bytes\":\(result.stdout.utf8.count),\"stderr_bytes\":\(result.stderr.utf8.count)}")
  }
}
