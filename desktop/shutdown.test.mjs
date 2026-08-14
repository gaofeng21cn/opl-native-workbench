import assert from "node:assert/strict";
import test from "node:test";
import { createShutdownController } from "./shutdown.mjs";

test("desktop shutdown waits for the shared host core before allowing exit", async () => {
  const calls = [];
  const controller = createShutdownController({
    close: async () => {
      await new Promise((resolve) => setImmediate(resolve));
      calls.push("closed");
    },
    quit: () => calls.push("quit")
  });
  const event = { preventDefault: () => calls.push("prevented") };
  const first = controller.request(event);
  const second = controller.request(event);
  assert.equal(controller.exitAllowed, false);
  await Promise.all([first, second]);
  assert.equal(controller.exitAllowed, true);
  assert.deepEqual(calls, ["prevented", "prevented", "closed", "quit"]);
});
