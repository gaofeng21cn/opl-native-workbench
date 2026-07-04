# OPL Native Workbench

`opl-native-workbench` is an independent One Person Lab App shell candidate.
It is mounted by the App repository as `shells/opl-native-workbench` and
selected only through `OPL_APP_SHELL_ADAPTER_CONTRACT`.

The shell keeps App truth in the App repository:

- Reads: `opl app state --profile fast --json` and explicit full-state
  commands.
- Mutations: `opl app action execute --action <id> ... --json`.
- Domain/runtime truth: owned by OPL Framework and domain repos, not by this
  renderer.
- Release adoption: forbidden until the App owner deliberately changes
  `contracts/app-shell-adapter.json` and release gates pass.

The current candidate is a skeleton that proves the reusable module shape:
shared React renderer, Electron/WebUI bridge contracts, result and delivery
context panels, and candidate packaging evidence.

## Commands

```bash
npm run validate:candidate
npm run validate:state-model
npm run smoke:webui
npm run package
```

These commands are structural candidate evidence. They do not claim active-shell
adoption, release readiness, production readiness, or live user-path evidence.
