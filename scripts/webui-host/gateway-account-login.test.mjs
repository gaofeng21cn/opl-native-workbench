import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createGatewayAccountLogin } from "./gateway-account-login.mjs";

function fakeSpawn(response, observed) {
  return (command, args, options) => {
    observed.command = command;
    observed.args = args;
    observed.options = options;
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdout.setEncoding = () => undefined;
    child.stderr.setEncoding = () => undefined;
    child.kill = () => undefined;
    child.stdin = {
      end(input) {
        observed.stdin = input;
        queueMicrotask(() => {
          if (response.stdout) child.stdout.emit("data", response.stdout);
          if (response.stderr) child.stderr.emit("data", response.stderr);
          child.emit("close", response.exitCode ?? 0);
        });
      }
    };
    return child;
  };
}

test("Gateway account login keeps credentials on stdin and returns only the typed result", async () => {
  const observed = {};
  const password = "gateway-secret-must-not-escape";
  const login = createGatewayAccountLogin({
    command: "/test/opl",
    cwd: "/workspace",
    spawnImpl: fakeSpawn({ stdout: JSON.stringify({ ok: true, account: "user@example.com" }) }, observed)
  });

  const result = await login({ email: " user@example.com ", password, deviceLabel: " Test Mac " });

  assert.deepEqual(result, { ok: true, stateRefreshRequired: true });
  assert.equal(observed.command, "/test/opl");
  assert.deepEqual(observed.args, ["connect", "gateway", "login", "--credentials-stdin", "--json"]);
  assert.deepEqual(observed.options.stdio, ["pipe", "pipe", "pipe"]);
  assert.equal(observed.stdin, `${JSON.stringify({ email: "user@example.com", password, device_label: "Test Mac" })}\n`);
  assert.equal(JSON.stringify({ result, args: observed.args }).includes(password), false);
  assert.equal("stdout" in result || "stderr" in result, false);
});

test("Gateway account login rejects unexpected request fields before spawning", async () => {
  let spawned = false;
  const login = createGatewayAccountLogin({
    spawnImpl: () => {
      spawned = true;
      throw new Error("must not spawn");
    }
  });

  assert.deepEqual(
    await login({ email: "user@example.com", password: "secret", rawSecret: "secret" }),
    { ok: false, errorCode: "invalid_request", stateRefreshRequired: false }
  );
  assert.equal(spawned, false);
});

test("Gateway account login rejects secret-bearing CLI output without returning it", async () => {
  const observed = {};
  const login = createGatewayAccountLogin({
    spawnImpl: fakeSpawn({ stdout: JSON.stringify({ ok: true, password: "echoed-secret" }) }, observed)
  });

  const result = await login({ email: "user@example.com", password: "input-secret" });
  assert.deepEqual(result, {
    ok: false,
    errorCode: "internal_contract_violation",
    stateRefreshRequired: false
  });
  assert.equal(JSON.stringify(result).includes("echoed-secret"), false);
});

test("Gateway account login rejects a secret value echoed under a non-secret field", async () => {
  const observed = {};
  const password = "echoed-under-message";
  const login = createGatewayAccountLogin({
    spawnImpl: fakeSpawn({ stdout: JSON.stringify({ ok: true, message: password }) }, observed)
  });

  assert.deepEqual(await login({ email: "user@example.com", password }), {
    ok: false,
    errorCode: "internal_contract_violation",
    stateRefreshRequired: false
  });
});

test("Gateway account login maps structured failures without returning stderr", async () => {
  const observed = {};
  const login = createGatewayAccountLogin({
    spawnImpl: fakeSpawn({
      exitCode: 1,
      stdout: JSON.stringify({ ok: false, error: { code: "credentials_stdin_invalid" } }),
      stderr: "private diagnostic"
    }, observed)
  });

  const result = await login({ email: "user@example.com", password: "input-secret" });
  assert.deepEqual(result, { ok: false, errorCode: "invalid_request", stateRefreshRequired: false });
  assert.equal(JSON.stringify(result).includes("private diagnostic"), false);
});
