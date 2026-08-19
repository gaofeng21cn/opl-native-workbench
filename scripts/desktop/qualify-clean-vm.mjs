import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePage, waitForPageReady } from "./cdp.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const productName = "One Person Lab Preview";
const defaultSourceVm = process.env.OPL_STUDIO_CLEAN_VM_SOURCE || "opl-first-run-no-clt-clean-base-26-5-18";
const defaultGuestUser = process.env.OPL_STUDIO_CLEAN_VM_USER || "admin";
const defaultSshKey = process.env.OPL_STUDIO_CLEAN_VM_SSH_KEY || path.join(os.homedir(), ".ssh", "opl_first_run_tart_ed25519");
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const options = {
    sourceVm: defaultSourceVm,
    dmg: path.join(repositoryRoot, "out", "one-person-lab-preview-0.1.1-mac-arm64.dmg"),
    guestUser: defaultGuestUser,
    sshKey: defaultSshKey,
    vmName: `opl-studio-clean-${stamp}`,
    outPath: path.join(repositoryRoot, "out", "studio-clean-vm-qualification.json"),
    cdpPort: 19222 + (process.pid % 500),
    keepVm: false,
    skipClone: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--keep-vm") { options.keepVm = true; continue; }
    if (arg === "--skip-clone") { options.skipClone = true; continue; }
    const value = argv[++index];
    invariant(value, `missing value for ${arg}`);
    if (arg === "--source-vm") options.sourceVm = value;
    else if (arg === "--dmg") options.dmg = path.resolve(value);
    else if (arg === "--guest-user") options.guestUser = value;
    else if (arg === "--ssh-key") options.sshKey = path.resolve(value);
    else if (arg === "--vm-name") options.vmName = value;
    else if (arg === "--out") options.outPath = path.resolve(value);
    else if (arg === "--cdp-port") options.cdpPort = Number(value);
    else throw new Error(`unsupported argument: ${arg}`);
  }
  return options;
}

function run(executable, args, { allowFailure = false, input } = {}) {
  const result = spawnSync(executable, args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${path.basename(executable)} failed: ${(result.stderr || result.stdout || "").trim()}`);
  }
  return result;
}

function sshArgs(options, ip, command) {
  return ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", "-o", "IdentitiesOnly=yes", "-o", "ConnectTimeout=8", "-i", options.sshKey, `${options.guestUser}@${ip}`, command];
}

function guestRun(options, ip, command, { allowFailure = false } = {}) {
  return run("ssh", sshArgs(options, ip, command), { allowFailure });
}

function scpToGuest(options, ip, source, target) {
  return run("scp", ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", "-o", "IdentitiesOnly=yes", "-i", options.sshKey, source, `${options.guestUser}@${ip}:${target}`]);
}

async function waitForIp(vmName, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = run("tart", ["ip", vmName], { allowFailure: true });
    const ip = result.stdout.trim();
    if (result.status === 0 && ip) return ip;
    await delay(2_000);
  }
  throw new Error(`timed out waiting for Tart IP for ${vmName}`);
}

function sanitizeGatewayProjection(state) {
  const outer = state?.app_state ?? state;
  const root = outer?.app_state ?? outer;
  const projection = root?.settings_control_center?.app_settings_read_model?.opl_gateway_account;
  if (!projection || typeof projection !== "object") return null;
  return {
    surfaceKind: projection.surface_kind ?? null,
    status: projection.status ?? null,
    connectionMode: projection.connection_mode ?? null,
    accountCardVisible: projection.account_card_visible === true,
    accountStatus: projection.account?.status ?? null,
    managedKeyStatus: projection.managed_key?.status ?? null,
    freshnessStale: projection.freshness?.stale === true
  };
}

function summarizeState(value) {
  const readback = value?.readback ?? {};
  return {
    readbackExitCode: readback.exitCode ?? readback.status ?? null,
    readbackTimedOut: readback.timedOut === true,
    readbackStderr: typeof readback.stderr === "string" ? readback.stderr.slice(0, 2_000) : "",
    gateway: sanitizeGatewayProjection(value)
  };
}

async function qualifyCleanVm(options) {
  invariant(process.platform === "darwin", "Studio clean VM qualification requires macOS host");
  invariant(Number.isInteger(options.cdpPort) && options.cdpPort > 1024, "CDP port must be a valid host port");
  await stat(options.dmg);
  await stat(options.sshKey);
  const runRoot = await mkdtemp(path.join(os.tmpdir(), "opl-studio-clean-vm-"));
  const guestDmg = `/tmp/opl-studio-clean-${process.pid}.dmg`;
  const guestApp = `/Applications/${productName}.app`;
  const guestLog = `/tmp/opl-studio-clean-${process.pid}.log`;
  let tartProcess;
  let tunnel;
  let ip = null;
  let appPage = null;
  const checks = {};
  try {
    if (!options.skipClone) run("tart", ["clone", options.sourceVm, options.vmName]);
    tartProcess = spawn("tart", ["run", "--no-graphics", options.vmName], { stdio: "ignore" });
    ip = await waitForIp(options.vmName);
    checks.vm = { source: options.sourceVm, clone: options.vmName, ip, started: true };

    scpToGuest(options, ip, options.dmg, guestDmg);
    const install = guestRun(options, ip, [
      "set -e",
      `test ! -e ${JSON.stringify(guestApp)}`,
      `mkdir -p /tmp/opl-studio-clean-${process.pid}/mount`,
      `hdiutil attach -nobrowse -readonly -mountpoint /tmp/opl-studio-clean-${process.pid}/mount ${JSON.stringify(guestDmg)} >/dev/null`,
      `ditto "/tmp/opl-studio-clean-${process.pid}/mount/${productName}.app" ${JSON.stringify(guestApp)}`,
      `hdiutil detach /tmp/opl-studio-clean-${process.pid}/mount >/dev/null`,
      `plutil -extract CFBundleShortVersionString raw -o - ${JSON.stringify(`${guestApp}/Contents/Info.plist`)}`
    ].join(" && "));
    checks.install = { passed: true, version: install.stdout.trim(), app: guestApp };

    guestRun(options, ip, `nohup "${guestApp}/Contents/MacOS/${productName}" --disable-gpu --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 >${guestLog} 2>&1 & echo $!`);
    tunnel = spawn("ssh", ["-N", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", "-o", "IdentitiesOnly=yes", "-i", options.sshKey, "-L", `${options.cdpPort}:127.0.0.1:9222`, `${options.guestUser}@${ip}`], { stdio: "ignore" });
    await waitForPageReady({ port: options.cdpPort, timeoutMs: 45_000 });
    appPage = await evaluatePage({
      port: options.cdpPort,
      expression: `(async()=>{
        const state=await window.oplStudio.readState("fast");
        const bodyText=document.body?.innerText||"";
        const startupErrors=bodyText.split(/\\n+/).map((line)=>line.trim()).filter((line)=>/无法连接|AppServerTransportError|spawn (?:codex|opl) ENOENT|Error invoking remote method/.test(line)).slice(0,8);
        return {readyState:document.readyState,root:!!document.getElementById("root"),bridge:!!window.oplStudio,state,update:await window.oplStudio.readNativeAppUpdateStatus(),startupErrors};
      })()`
    });
    checks.startup = {
      passed: appPage?.readyState === "complete" && appPage?.root === true && appPage?.bridge === true,
      readyState: appPage?.readyState ?? null,
      root: appPage?.root === true,
      bridge: appPage?.bridge === true,
      appServerErrors: Array.isArray(appPage?.startupErrors) ? appPage.startupErrors : []
    };
    checks.runtime = summarizeState(appPage?.state);
    checks.gateway = {
      projection: sanitizeGatewayProjection(appPage?.state),
      cleanStateExpected: true,
      cleanStateObserved: ["none", "setup_required", "reauth_required"].includes(sanitizeGatewayProjection(appPage?.state)?.status)
    };
    checks.update = {
      status: appPage?.update ?? null,
      publicFeedChecked: false,
      reason: "clean_vm_harness_does_not_mutate_or_require_public_release"
    };
  } catch (error) {
    checks.failure = { detail: error instanceof Error ? error.message : String(error) };
    if (ip) checks.guestLog = guestRun(options, ip, `tail -120 ${guestLog}`, { allowFailure: true }).stdout;
  } finally {
    if (tunnel && tunnel.exitCode === null) tunnel.kill("SIGTERM");
    if (!options.keepVm && tartProcess && tartProcess.exitCode === null) tartProcess.kill("SIGTERM");
    if (!options.keepVm) run("tart", ["stop", options.vmName], { allowFailure: true });
    if (!options.keepVm) run("tart", ["delete", options.vmName], { allowFailure: true });
    await rm(runRoot, { recursive: true, force: true });
  }
  const status = checks.failure ? "partial" : checks.startup?.passed && checks.gateway?.cleanStateObserved ? "passed" : "partial";
  const receipt = {
    schema: "opl_studio_macos_clean_vm_qualification.v1",
    status,
    candidate: "opl-studio",
    carrier: "electron_desktop",
    package: { dmg: options.dmg, bundleIdentifier: "cn.onepersonlab.opl.studio.preview", productName },
    checks,
    cleanVmReady: false,
    releaseReady: false,
    activeShellAdopted: false,
    blockers: [
      ...(checks.failure ? ["clean_vm_execution_incomplete"] : []),
      ...(checks.runtime?.readbackExitCode !== 0 ? ["OPL_Framework_runtime_readback_not_proven_in_clean_VM"] : []),
      ...(checks.gateway?.cleanStateObserved !== true ? ["Gateway_owner_projection_not_read_back_as_clean_setup_state"] : []),
      "App_owner_clean_VM_release_admission_is_separate_from_Studio_candidate_qualification"
    ]
  };
  await mkdir(path.dirname(options.outPath), { recursive: true });
  await writeFile(options.outPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const receipt = await qualifyCleanVm(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.status !== "passed") process.exitCode = 2;
}
