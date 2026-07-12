import fs from "node:fs";
import path from "node:path";

export function resolveAppRepoRoot(candidateRoot) {
  const candidates = [
    process.env.OPL_APP_REPO_ROOT,
    // Mounted candidate checkout: <app-root>/shells/opl-native-workbench.
    path.join(candidateRoot, "..", ".."),
    // Standalone worktree: <workspace>/opl-native-workbench/.worktrees/<name>.
    path.join(candidateRoot, "..", "..", "..", "one-person-lab-app"),
    path.join(candidateRoot, "..", "one-person-lab-app"),
    path.join(candidateRoot, "..", "..", "one-person-lab-app")
  ].filter(Boolean).map((value) => path.resolve(value));
  const resolved = candidates.find((value) => fs.existsSync(path.join(value, "contracts", "app-product-profile.json")));
  if (!resolved) {
    throw new Error(`unable to locate one-person-lab-app; checked ${candidates.join(", ")}`);
  }
  return resolved;
}
