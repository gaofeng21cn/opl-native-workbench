import { spawn } from "node:child_process";

const ERROR_CODES = new Set([
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
  "codex_configuration_failed",
  "invalid_request",
  "internal_contract_violation",
  "gateway_account_failed"
]);

const ERROR_ALIASES = new Map([
  ["credentials_stdin_invalid", "invalid_request"],
  ["reauth_required", "auth_expired"],
  ["network_timeout", "network_unreachable"],
  ["gateway_unavailable", "network_unreachable"]
]);

const SECRET_FIELDS = new Set([
  "password", "token", "accesstoken", "refreshtoken", "apikey", "key",
  "keyvalue", "keyplaintext", "plaintextkey", "secret"
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function containsSecretField(value) {
  if (Array.isArray(value)) return value.some(containsSecretField);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([field, nested]) => {
    const normalized = field.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
    return SECRET_FIELDS.has(normalized) || containsSecretField(nested);
  });
}

function normalizeErrorCode(value) {
  if (typeof value !== "string") return undefined;
  return ERROR_CODES.has(value) ? value : ERROR_ALIASES.get(value);
}

function readErrorCode(value) {
  if (!isRecord(value)) return undefined;
  const error = isRecord(value.error) ? value.error : undefined;
  const details = isRecord(value.details) ? value.details : undefined;
  const errorDetails = isRecord(error?.details) ? error.details : undefined;
  return [value.error_code, error?.code, details?.reason_code, errorDetails?.reason_code]
    .map(normalizeErrorCode)
    .find(Boolean);
}

function inferErrorCode(result, fallback = "gateway_account_failed") {
  const structured = readErrorCode(result.parsed);
  if (structured) return structured;
  const text = `${result.stderr ?? ""}`.toLowerCase();
  const encoded = [...text.matchAll(/"(?:reason_code|error_code)"\s*:\s*"([^"]+)"/gi)]
    .map((match) => normalizeErrorCode(match[1]))
    .find(Boolean);
  if (encoded) return encoded;
  if (/invalid credentials|invalid password|unauthorized|401/.test(text)) return "invalid_credentials";
  if (/disabled|suspended/.test(text)) return "account_disabled";
  if (/turnstile|captcha|totp|two-factor|mfa|challenge/.test(text)) return "mfa_or_challenge_required";
  if (/429|rate limit/.test(text)) return "rate_limited";
  if (/network|enotfound|econn|timeout|timed out/.test(text)) return "network_unreachable";
  return fallback;
}

function sanitizeResult(result, secretValues = [], fallbackErrorCode = "gateway_account_failed") {
  if (result.outputTruncated) {
    return { ok: false, errorCode: "internal_contract_violation", stateRefreshRequired: false };
  }
  if (secretValues.some((secret) => secret && (`${result.stdout ?? ""}${result.stderr ?? ""}`).includes(secret))) {
    return { ok: false, errorCode: "internal_contract_violation", stateRefreshRequired: false };
  }
  if (!isRecord(result.parsed)) {
    return {
      ok: false,
      errorCode: result.exitCode === 0 ? "internal_contract_violation" : inferErrorCode(result, fallbackErrorCode),
      stateRefreshRequired: false
    };
  }
  if (containsSecretField(result.parsed)) {
    return { ok: false, errorCode: "internal_contract_violation", stateRefreshRequired: false };
  }
  if (result.exitCode !== 0 || result.parsed.ok === false) {
    return { ok: false, errorCode: inferErrorCode(result, fallbackErrorCode), stateRefreshRequired: false };
  }
  return { ok: true, stateRefreshRequired: true };
}

function commandResult({ command, args, cwd, env, stdin, spawnImpl, timeoutMs, maxOutputBytes }) {
  return new Promise((resolve) => {
    const child = spawnImpl(command, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let outputTruncated = false;
    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        parsed = undefined;
      }
      resolve({ exitCode, parsed, stdout, stderr, timedOut, outputTruncated });
    };
    const append = (current, chunk) => {
      const combined = `${current}${chunk}`;
      if (Buffer.byteLength(combined) > maxOutputBytes) outputTruncated = true;
      return combined.slice(-maxOutputBytes);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
    child.once("error", (error) => {
      stderr = append(stderr, error.message);
      finish(-1);
    });
    child.once("close", (code) => finish(timedOut ? -1 : (code ?? -1)));
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdin.end(stdin);
  });
}

export function createGatewayAccountLogin({
  command = process.env.OPL_APP_OPL_BIN ?? "opl",
  cwd = process.cwd(),
  env = process.env,
  spawnImpl = spawn,
  timeoutMs = 45_000,
  maxOutputBytes = 65_536
} = {}) {
  return async function loginGatewayAccount(request) {
    if (!isRecord(request)) {
      return { ok: false, errorCode: "invalid_request", stateRefreshRequired: false };
    }
    const allowedFields = new Set(["email", "password", "deviceLabel"]);
    if (Object.keys(request).some((field) => !allowedFields.has(field))) {
      return { ok: false, errorCode: "invalid_request", stateRefreshRequired: false };
    }
    const email = typeof request.email === "string" ? request.email.trim() : "";
    const password = typeof request.password === "string" ? request.password : "";
    const deviceLabel = typeof request.deviceLabel === "string" ? request.deviceLabel.trim() : "";
    if (!email || !password) {
      return { ok: false, errorCode: "invalid_request", stateRefreshRequired: false };
    }
    const stdin = `${JSON.stringify({ email, password, ...(deviceLabel ? { device_label: deviceLabel } : {}) })}\n`;
    const result = await commandResult({
      command,
      args: ["connect", "gateway", "login", "--credentials-stdin", "--json"],
      cwd,
      env,
      stdin,
      spawnImpl,
      timeoutMs,
      maxOutputBytes
    });
    return sanitizeResult(result, [password]);
  };
}

export function createCodexApiKeyConfiguration({
  command = process.env.OPL_APP_OPL_BIN ?? "opl",
  cwd = process.cwd(),
  env = process.env,
  spawnImpl = spawn,
  timeoutMs = 45_000,
  maxOutputBytes = 65_536
} = {}) {
  return async function configureCodexApiKey(request) {
    if (!isRecord(request) || Object.keys(request).some((field) => field !== "apiKey")) {
      return { ok: false, errorCode: "invalid_request", stateRefreshRequired: false };
    }
    const apiKey = typeof request.apiKey === "string" ? request.apiKey.trim() : "";
    if (!apiKey || Buffer.byteLength(apiKey, "utf8") > 65_536) {
      return { ok: false, errorCode: "invalid_request", stateRefreshRequired: false };
    }
    const result = await commandResult({
      command,
      args: ["system", "configure-codex", "--api-key-stdin", "--json"],
      cwd,
      env,
      stdin: `${apiKey}\n`,
      spawnImpl,
      timeoutMs,
      maxOutputBytes
    });
    return sanitizeResult(result, [apiKey], "codex_configuration_failed");
  };
}

export const gatewayAccountLoginTestApi = { containsSecretField, sanitizeResult };
