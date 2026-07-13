import assert from "node:assert/strict";
import { deriveWorkbenchModelFromState } from "../src/workbench/workbenchModel";

function stateWithGateway(overrides: Record<string, unknown> = {}) {
  return {
    app_state: {
      settings_control_center: {
        app_settings_read_model: {
          opl_gateway_account: {
            surface_kind: "opl_gateway_account_read_model.v1",
            connection_mode: "account",
            status: "connected",
            account_card_visible: true,
            account: {
              display_name: "OPL User",
              masked_email: "g***@example.com"
            },
            ...overrides
          }
        }
      }
    }
  };
}

const connected = deriveWorkbenchModelFromState(stateWithGateway());
assert.deepEqual(connected.gatewayAccount, {
  displayName: "OPL User",
  status: "connected",
  sourceRef: "app_state.settings_control_center.app_settings_read_model.opl_gateway_account.account.display_name"
});
assert.equal(JSON.stringify(connected.gatewayAccount).includes("example.com"), false);

for (const projection of [
  { connection_mode: "manual_key" },
  { status: "not_connected" },
  { account_card_visible: false },
  { account: { display_name: "" } },
  { surface_kind: "unknown" }
]) {
  assert.equal(deriveWorkbenchModelFromState(stateWithGateway(projection)).gatewayAccount, undefined);
}

for (const status of ["setup_required", "reauth_required", "attention_needed", "disconnect_pending"]) {
  assert.equal(deriveWorkbenchModelFromState(stateWithGateway({ status })).gatewayAccount?.displayName, "OPL User");
}
