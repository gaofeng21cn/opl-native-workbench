export function workspaceTitleOf(cwd: string): string {
  return cwd.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "";
}
