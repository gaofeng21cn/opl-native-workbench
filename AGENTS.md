# OPL Native Workbench Instructions

- This repository is an external shell checkout for One Person Lab App.
- Keep product truth in `one-person-lab-app` contracts and docs.
- Do not copy AionUI, Hermes, AGUI, K-Dense, or OpenClaudeScience source into
  this repository without a separate code-reuse decision.
- Use OPL App state/action contracts as the only runtime interface.
- Candidate evidence must not claim active-shell adoption, release readiness,
  production readiness, domain readiness, or artifact authority.
- Keep Electron and WebUI on the same renderer and bridge shape.

<!-- CODEGRAPH_START -->
## CodeGraph

- 本仓库使用本地 `.codegraph/` 索引；该目录不得纳入 Git。
- 定义、调用、影响范围和代码路径等结构检索优先使用 CodeGraph；字面文本检索使用 `rg`。
- 索引缺失或过期时运行 `codegraph init .` 或 `codegraph sync .`。
<!-- CODEGRAPH_END -->
