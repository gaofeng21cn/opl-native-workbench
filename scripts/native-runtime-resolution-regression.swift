import Foundation

enum NativeRuntimeResolutionRegressionFailure: Error {
  case assertion(String)
}

func requireRuntimeResolution(_ condition: @autoclosure () -> Bool, _ message: String) throws {
  if !condition() { throw NativeRuntimeResolutionRegressionFailure.assertion(message) }
}

@main
struct NativeRuntimeResolutionRegression {
  static func main() throws {
    let home = URL(fileURLWithPath: "/Users/tester")
    let executablePaths = Set([
      "/Users/tester/.local/bin/codex",
      "/opt/homebrew/bin/opl",
      "/custom/codex"
    ])
    let executable: (String) -> Bool = { executablePaths.contains($0) }

    let finderCodex = resolveExternalExecutable(
      name: "codex",
      explicitEnvironmentKeys: ["OPL_CODEX_BIN", "CODEX_CLI_PATH", "CODEX_BIN"],
      environment: ["PATH": "/usr/bin:/bin"],
      homeDirectory: home,
      isExecutable: executable
    )
    try requireRuntimeResolution(finderCodex == "/Users/tester/.local/bin/codex", "Finder launch must resolve ~/.local/bin/codex")

    let explicitCodex = resolveExternalExecutable(
      name: "codex",
      explicitEnvironmentKeys: ["OPL_CODEX_BIN", "CODEX_CLI_PATH", "CODEX_BIN"],
      environment: ["OPL_CODEX_BIN": "/custom/codex", "PATH": "/usr/bin:/bin"],
      homeDirectory: home,
      isExecutable: executable
    )
    try requireRuntimeResolution(explicitCodex == "/custom/codex", "OPL_CODEX_BIN must remain the highest priority")

    let opl = resolveExternalExecutable(
      name: "opl",
      explicitEnvironmentKeys: ["OPL_APP_OPL_BIN"],
      environment: ["PATH": "/usr/bin:/bin"],
      homeDirectory: home,
      isExecutable: executable
    )
    try requireRuntimeResolution(opl == "/opt/homebrew/bin/opl", "Finder launch must resolve Homebrew OPL")

    let candidates = externalExecutableCandidates(
      name: "codex",
      explicitEnvironmentKeys: ["OPL_CODEX_BIN", "CODEX_CLI_PATH", "CODEX_BIN"],
      environment: ["PATH": "/usr/bin:/bin"],
      homeDirectory: home
    )
    try requireRuntimeResolution(candidates.allSatisfy { !$0.localizedCaseInsensitiveContains("aioncore") }, "AionCore must never be a Native executable candidate")

    print("{\"status\":\"native_runtime_resolution_regression_passed\"}")
  }
}
