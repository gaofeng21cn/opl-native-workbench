#!/usr/bin/python3
import argparse
import json
import time

import pyatspi


def process_id(accessible):
    try:
        return int(accessible.get_process_id())
    except Exception:
        return 0


def children(accessible):
    try:
        return [accessible[index] for index in range(accessible.childCount)]
    except Exception:
        return []


def walk(root, limit=5000):
    pending = [root]
    observed = []
    while pending and len(observed) < limit:
        current = pending.pop()
        observed.append(current)
        pending.extend(reversed(children(current)))
    return observed


parser = argparse.ArgumentParser()
parser.add_argument("--process-ids", required=True)
parser.add_argument("--expected-window-name", required=True)
args = parser.parse_args()
target_process_ids = {int(value) for value in args.process_ids.split(",") if value}
deadline = time.time() + 20
application = None
app_window = None
observed_applications = []

while app_window is None and time.time() < deadline:
    desktop = pyatspi.Registry.getDesktop(0)
    observed_applications = []
    for candidate in children(desktop):
        candidate_process_id = process_id(candidate)
        candidate_nodes = walk(candidate)
        window_names = []
        for node in candidate_nodes:
            try:
                if (node.getRoleName() or "").lower() in {"frame", "window"} and node.name:
                    window_names.append(node.name)
            except Exception:
                continue
        try:
            application_name = candidate.name or ""
        except Exception:
            application_name = ""
        observed_applications.append(
            {
                "processId": candidate_process_id,
                "name": application_name,
                "windows": window_names[:10],
            }
        )
        if candidate_process_id not in target_process_ids:
            continue
        for node in candidate_nodes:
            try:
                name = node.name or ""
            except Exception:
                name = ""
            if name == args.expected_window_name:
                application = candidate
                app_window = node
                break
        if app_window is not None:
            break
    if app_window is None:
        time.sleep(0.25)

if app_window is None:
    raise RuntimeError(
        f"AT-SPI did not expose {args.expected_window_name} for process tree "
        f"{sorted(target_process_ids)}; observed applications="
        f"{json.dumps(observed_applications[:20], separators=(',', ':'))}"
    )

interactive_roles = {
    "check box",
    "combo box",
    "entry",
    "link",
    "list item",
    "menu item",
    "page tab",
    "push button",
    "radio button",
    "slider",
    "text",
    "tree item",
}
nodes = walk(app_window)
interactive = []
for node in nodes:
    try:
        role_name = (node.getRoleName() or "").lower()
        name = node.name or ""
        states = node.getState()
    except Exception:
        continue
    if role_name in interactive_roles and (
        states.contains(pyatspi.STATE_FOCUSABLE) or states.contains(pyatspi.STATE_EDITABLE)
    ):
        interactive.append((role_name, name))

unnamed = [role for role, name in interactive if not name.strip()]
if not interactive:
    raise RuntimeError("AT-SPI exposed no interactive controls")
if unnamed:
    raise RuntimeError(
        f"AT-SPI exposed {len(unnamed)} unnamed interactive controls: {sorted(set(unnamed))}"
    )

role_counts = {}
for role, _name in interactive:
    role_counts[role] = role_counts.get(role, 0) + 1

print(
    json.dumps(
        {
            "schema": "opl_desktop_linux_atspi_qualification.v1",
            "status": "passed",
            "platform": "linux",
            "targetProcessIds": sorted(target_process_ids),
            "matchedProcessId": candidate_process_id,
            "applicationName": application.name or "",
            "windowName": app_window.name,
            "nodeCount": len(nodes),
            "interactiveNodeCount": len(interactive),
            "unnamedInteractiveCount": len(unnamed),
            "roles": role_counts,
        },
        separators=(",", ":"),
        sort_keys=True,
    )
)
