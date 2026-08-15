import assert from "node:assert/strict";

const namedInteractiveRoles = new Set([
  "button",
  "checkbox",
  "combobox",
  "dialog",
  "link",
  "listbox",
  "menuitem",
  "radio",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "treeitem"
]);

function textValue(value) {
  return typeof value?.value === "string" ? value.value.trim() : "";
}

export function summarizeAccessibilityTree(nodes) {
  assert.ok(Array.isArray(nodes), "Chromium accessibility tree must be an array");
  const exposed = nodes.filter((node) => node?.ignored !== true);
  const root = exposed.find((node) => textValue(node.role) === "RootWebArea");
  const interactive = exposed.filter((node) => namedInteractiveRoles.has(textValue(node.role).toLowerCase()));
  const unnamed = interactive.filter((node) => !textValue(node.name));
  const roles = {};
  for (const node of interactive) {
    const role = textValue(node.role).toLowerCase();
    roles[role] = (roles[role] ?? 0) + 1;
  }
  return {
    schema: "opl_desktop_chromium_ax_tree_smoke.v1",
    status: unnamed.length === 0 && interactive.length > 0 && textValue(root?.name) === "One Person Lab"
      ? "passed"
      : "failed",
    documentName: textValue(root?.name),
    exposedNodeCount: exposed.length,
    interactiveNodeCount: interactive.length,
    unnamedInteractiveCount: unnamed.length,
    unnamedInteractiveRoles: [...new Set(unnamed.map((node) => textValue(node.role)))].sort(),
    roles
  };
}

export async function captureDesktopAccessibility(webContents) {
  const debug = webContents.debugger;
  let attachedHere = false;
  try {
    if (!debug.isAttached()) {
      debug.attach("1.3");
      attachedHere = true;
    }
    await debug.sendCommand("Accessibility.enable");
    const tree = await debug.sendCommand("Accessibility.getFullAXTree");
    const receipt = summarizeAccessibilityTree(tree?.nodes);
    assert.equal(receipt.status, "passed", `Chromium AX tree smoke failed: ${JSON.stringify(receipt)}`);
    return receipt;
  } finally {
    if (attachedHere && debug.isAttached()) debug.detach();
  }
}
