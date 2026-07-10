export const codexWorkbenchStyles = `
  :root {
    color-scheme: light;
    --opl-accent: #0d9488;
    --opl-accent-soft: #e7f5f3;
    --opl-canvas: #ffffff;
    --opl-sidebar: #f7f7f7;
    --opl-hover: #eeeeec;
    --opl-selected: #e9e9e7;
    --opl-border: #e7e7e5;
    --opl-text: #202123;
    --opl-muted: #73746f;
    --opl-faint: #9a9b96;
    --opl-danger: #d65342;
  }

  * {
    box-sizing: border-box;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  button:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .opl-native-workbench {
    width: 100vw;
    height: 100vh;
    min-width: 0;
    position: relative;
    display: grid;
    grid-template-columns: 272px minmax(0, 1fr);
    overflow: hidden;
    background: var(--opl-canvas);
    color: var(--opl-text);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
    font-size: 13px;
    line-height: 1.48;
    letter-spacing: 0;
  }

  .opl-native-workbench.sidebar-closed {
    grid-template-columns: 0 minmax(0, 1fr);
  }

  .sidebar {
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid var(--opl-border);
    background: var(--opl-sidebar);
  }

  .sidebar-closed .sidebar {
    display: none;
  }

  .brand-row {
    height: 54px;
    flex: 0 0 54px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
  }

  .brand-row img {
    display: none;
  }

  .brand-lockup {
    min-width: 0;
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
    font-size: 15px;
    font-weight: 650;
    white-space: nowrap;
  }

  .brand-mark {
    color: var(--opl-text);
  }

  .brand-name {
    color: var(--opl-accent);
    font-weight: 560;
  }

  .icon-button {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    display: inline-grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--opl-muted);
  }

  .icon-button:hover {
    background: var(--opl-hover);
    color: var(--opl-text);
  }

  .brand-row .icon-button {
    margin-left: auto;
  }

  .sidebar-close-mobile {
    display: none;
  }

  .sidebar-scroll {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    padding: 2px 10px 18px;
  }

  .quick-actions {
    display: grid;
    gap: 2px;
    margin-bottom: 18px;
  }

  .quick-actions button,
  .sidebar-primary button,
  .project-root,
  .project-context-link,
  .history-list li button,
  .sidebar-footer button {
    width: 100%;
    min-height: 34px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 9px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--opl-text);
    text-align: left;
    font-size: 13px;
    font-weight: 430;
  }

  .quick-actions button:hover,
  .sidebar-primary button:hover,
  .project-root:hover,
  .project-context-link:hover,
  .history-list li button:hover,
  .sidebar-footer button:hover {
    background: var(--opl-hover);
  }

  .kbd-hint {
    margin-left: auto;
    color: var(--opl-faint);
    font-size: 11px;
  }

  .sidebar-primary {
    display: grid;
    gap: 2px;
    margin-bottom: 18px;
  }

  .sidebar-primary button[aria-current="page"] {
    background: var(--opl-selected);
  }

  .sidebar-section-head {
    min-height: 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 9px;
    color: var(--opl-muted);
    font-size: 12px;
    font-weight: 500;
  }

  .sidebar-section-head strong {
    font: inherit;
  }

  .sidebar-panel,
  .history-list {
    margin: 0 0 12px;
  }

  .project-root {
    font-weight: 540;
  }

  .project-root .project-device {
    margin-left: auto;
    color: var(--opl-muted);
    font-size: 11px;
    font-weight: 430;
  }

  .project-root .project-status-dot {
    width: 7px;
    height: 7px;
    flex: 0 0 7px;
    border-radius: 50%;
    background: #20b15a;
  }

  .project-children {
    margin-left: 18px;
    padding-left: 10px;
    border-left: 1px solid var(--opl-border);
  }

  .project-context-links {
    display: grid;
    gap: 1px;
    margin: 2px 0 5px;
  }

  .project-context-link {
    min-height: 30px;
    color: #565751;
    font-size: 12px;
  }

  .project-context-link span:last-child {
    margin-left: auto;
    color: var(--opl-faint);
    font-size: 11px;
  }

  .sidebar-panel-card,
  .sidebar-source-list,
  .sidebar-add-item,
  .sidebar-project-pill {
    display: none;
  }

  .history-list ol {
    list-style: none;
    display: grid;
    gap: 1px;
    margin: 0;
    padding: 0;
  }

  .history-list li button {
    min-height: 32px;
    padding-left: 8px;
  }

  .history-list li button strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    font-weight: 430;
  }

  .history-list li button span {
    display: none;
  }

  .history-list li button small {
    margin-left: auto;
    color: var(--opl-faint);
    font-size: 10.5px;
    white-space: nowrap;
  }

  .history-list li.active button {
    background: var(--opl-selected);
  }

  .sidebar-footer {
    flex: 0 0 auto;
    padding: 8px 10px 10px;
    border-top: 1px solid var(--opl-border);
  }

  .sidebar-footer button {
    min-height: 40px;
  }

  .account-avatar {
    width: 22px;
    height: 22px;
    display: inline-grid;
    place-items: center;
    border-radius: 50%;
    background: var(--opl-accent);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
  }

  .account-copy {
    min-width: 0;
    display: grid;
    gap: 1px;
  }

  .account-copy strong {
    font-size: 12.5px;
    font-weight: 520;
  }

  .account-copy small {
    color: var(--opl-muted);
    font-size: 10.5px;
  }

  .sidebar-footer .settings-glyph {
    margin-left: auto;
    color: var(--opl-muted);
  }

  .sidebar-footer .status-pill {
    display: none;
  }

  .chat-shell {
    min-width: 0;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--opl-canvas);
  }

  .topbar {
    height: 54px;
    flex: 0 0 54px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 14px;
    border-bottom: 1px solid var(--opl-border);
    background: rgba(255, 255, 255, 0.94);
  }

  .topbar-copy,
  .topbar-title,
  .topbar-actions {
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .topbar-copy {
    gap: 6px;
  }

  .topbar-title {
    gap: 7px;
    color: var(--opl-text);
  }

  .topbar-title h1 {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0;
    font-size: 13px;
    font-weight: 540;
  }

  .topbar-actions {
    gap: 3px;
  }

  .topbar-meta,
  .topbar-config,
  .topbar-status {
    display: none;
  }

  .conversation,
  .settings-page {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
  }

  .conversation-inner {
    width: min(100%, 780px);
    min-height: 100%;
    display: flex;
    flex-direction: column;
    margin: 0 auto;
    padding: 34px 24px 0;
  }

  .workflow-strip,
  .thread-intro {
    display: none;
  }

  .thread {
    display: flex;
    flex-direction: column;
    gap: 26px;
    padding-bottom: 20px;
  }

  .empty-thread {
    min-height: calc(100vh - 250px);
    display: grid;
    place-items: center;
    text-align: center;
  }

  .empty-thread-inner {
    display: grid;
    gap: 9px;
    max-width: 520px;
  }

  .empty-thread-inner strong {
    font-size: 22px;
    font-weight: 560;
  }

  .empty-thread-inner p {
    margin: 0;
    color: var(--opl-muted);
    font-size: 14px;
  }

  .empty-starters {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 8px;
  }

  .empty-starters button {
    min-height: 32px;
    padding: 0 11px;
    border: 1px solid var(--opl-border);
    border-radius: 8px;
    background: #fff;
    color: #4f504c;
  }

  .empty-starters button:hover {
    background: var(--opl-sidebar);
  }

  .message {
    width: 100%;
    display: grid;
    gap: 7px;
  }

  .message-label {
    color: var(--opl-muted);
    font-size: 11.5px;
    font-weight: 520;
  }

  .message.assistant .message-label {
    color: var(--opl-accent);
  }

  .message-frame {
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
  }

  .message.user .message-frame {
    width: fit-content;
    max-width: 86%;
    justify-self: end;
    padding: 9px 12px;
    border-radius: 12px;
    background: #f1f1ef;
  }

  .message.system .message-frame {
    padding-left: 12px;
    border-left: 2px solid #e1b0a8;
    color: var(--opl-danger);
  }

  .message-frame p {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 14px;
    line-height: 1.58;
  }

  .message-meta {
    display: none;
  }

  .run-events {
    display: grid;
    gap: 5px;
    margin-top: 3px;
    color: var(--opl-muted);
    font-size: 11.5px;
  }

  .run-event {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .run-event::before {
    content: "";
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #b8b9b4;
  }

  .assistant-artifact-card {
    width: min(100%, 610px);
    margin-top: 6px;
    overflow: hidden;
    border: 1px solid var(--opl-border);
    border-radius: 10px;
    background: #fff;
  }

  .assistant-artifact-card header {
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 12px;
  }

  .assistant-artifact-card header strong {
    font-size: 12.5px;
    font-weight: 520;
  }

  .assistant-artifact-card header button {
    margin-left: auto;
    min-height: 28px;
    padding: 0 9px;
    border: 1px solid var(--opl-border);
    border-radius: 7px;
    background: #fff;
  }

  .assistant-artifact-card footer {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    padding: 8px 12px;
    border-top: 1px solid var(--opl-border);
    color: var(--opl-muted);
    font-size: 11px;
  }

  .progress-chip {
    display: inline-flex;
    align-items: center;
    min-height: 20px;
    padding: 0 6px;
    border-radius: 5px;
    background: var(--opl-accent-soft);
    color: #08766d;
  }

  .composer {
    position: sticky;
    bottom: 0;
    margin-top: auto;
    padding: 22px 0 12px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0), #fff 28%);
  }

  .composer-frame {
    padding: 11px 12px 9px;
    border: 1px solid #dededb;
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05);
  }

  .composer textarea {
    width: 100%;
    min-height: 54px;
    max-height: 180px;
    resize: vertical;
    padding: 2px 2px 8px;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--opl-text);
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    field-sizing: content;
    max-height: 180px;
    overflow-y: auto;
  }

  .composer textarea::placeholder {
    color: #aaa9a4;
  }

  .composer footer,
  .composer-meta,
  .composer-actions,
  .composer-model-controls {
    display: flex;
    align-items: center;
  }

  .composer footer {
    justify-content: space-between;
    gap: 10px;
  }

  .composer-meta,
  .composer-actions,
  .composer-model-controls {
    gap: 5px;
  }

  .composer-status {
    color: var(--opl-muted);
    font-size: 11px;
  }

  .composer-status.error {
    color: var(--opl-danger);
  }

  .composer .thread-note {
    display: none;
  }

  .composer-action,
  .composer-control,
  .composer-select,
  .composer-submit {
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 0 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: #666762;
    font-size: 11.5px;
  }

  .composer-action {
    width: 30px;
    padding: 0;
  }

  .composer-action:hover,
  .composer-control:hover,
  .composer-select:hover {
    background: var(--opl-hover);
    color: var(--opl-text);
  }

  .composer-select {
    position: relative;
    padding-right: 5px;
  }

  .composer-select select {
    max-width: 112px;
    height: 100%;
    padding: 0 15px 0 4px;
    border: 0;
    outline: 0;
    appearance: none;
    background: transparent;
    color: inherit;
    font-size: inherit;
    cursor: pointer;
  }

  .composer-select svg {
    position: absolute;
    right: 4px;
    pointer-events: none;
  }

  .composer-control[data-accent="true"] {
    color: var(--opl-accent);
  }

  .composer-submit {
    width: 30px;
    padding: 0;
    border-radius: 50%;
    background: #1f201e;
    color: #fff;
  }

  .composer-submit span {
    display: none;
  }

  .settings-content {
    width: min(100%, 820px);
    margin: 0 auto;
    padding: 32px 28px 60px;
  }

  .settings-page section {
    padding: 0;
    border: 0;
    background: transparent;
  }

  .settings-page section + section {
    margin-top: 30px;
  }

  .settings-page h2 {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 580;
  }

  .settings-page dl {
    margin: 0;
    border-top: 1px solid var(--opl-border);
  }

  .settings-page dl > div {
    min-height: 58px;
    display: grid;
    grid-template-columns: minmax(160px, 1fr) minmax(220px, 1.4fr);
    align-items: center;
    gap: 18px;
    padding: 10px 0;
    border-bottom: 1px solid var(--opl-border);
  }

  .settings-page dt,
  .settings-page dd {
    margin: 0;
  }

  .settings-page dt {
    font-weight: 500;
  }

  .settings-page dd {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: var(--opl-muted);
  }

  .settings-page small {
    color: var(--opl-faint);
    font-size: 10.5px;
  }

  .settings-page code {
    overflow-wrap: anywhere;
    color: #565752;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 11px;
  }

  .setting-toggle,
  .setting-select,
  .settings-page section > button {
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid var(--opl-border);
    border-radius: 7px;
    background: #fff;
    color: var(--opl-text);
  }

  .setting-select {
    min-width: 108px;
  }

  .setting-switch {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--opl-muted);
  }

  .setting-switch-track {
    width: 30px;
    height: 18px;
    position: relative;
    display: inline-block;
    border-radius: 9px;
    background: #c8c9c5;
    transition: background 160ms ease;
  }

  .setting-switch-track span {
    width: 14px;
    height: 14px;
    position: absolute;
    top: 2px;
    left: 2px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
    transition: transform 160ms ease;
  }

  .setting-switch[aria-checked="true"] .setting-switch-track {
    background: var(--opl-accent);
  }

  .setting-switch[aria-checked="true"] .setting-switch-track span {
    transform: translateX(12px);
  }

  .segmented-control {
    width: fit-content;
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--opl-border);
    border-radius: 8px;
    background: var(--opl-sidebar);
  }

  .segmented-control button {
    min-height: 27px;
    padding: 0 9px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--opl-muted);
  }

  .segmented-control button[data-active="true"] {
    background: #fff;
    color: var(--opl-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .context-inspector {
    position: absolute;
    top: 66px;
    right: 14px;
    bottom: auto;
    z-index: 30;
    width: min(320px, calc(100vw - 32px));
    max-height: min(680px, calc(100vh - 200px));
    display: none;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--opl-border);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.10);
  }

  .context-inspector.open {
    display: flex;
  }

  .inspector-header {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0 12px;
  }

  .inspector-header h2 {
    margin: 0;
    font-size: 12.5px;
    font-weight: 560;
  }

  .environment-detail-header {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .environment-detail-header h2 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .inspector-header button {
    width: 28px;
    height: 28px;
    display: inline-grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
  }

  .inspector-header button:hover {
    background: var(--opl-hover);
  }

  .context-summary {
    display: none;
  }

  .context-scroll {
    min-height: 0;
    overflow-y: auto;
  }

  .environment-menu {
    display: grid;
    gap: 2px;
    padding: 0 8px 10px;
  }

  .environment-menu-entry {
    display: grid;
  }

  .environment-menu-group {
    margin: 5px 8px 2px;
    color: var(--opl-muted);
    font-size: 10.5px;
    font-weight: 520;
  }

  .environment-menu-entry:first-of-type .environment-menu-group {
    margin-top: 0;
  }

  .environment-menu[hidden] {
    display: none;
  }

  .environment-menu > p {
    margin: 0;
    padding: 0 8px 9px;
    color: var(--opl-muted);
    font-size: 11px;
    line-height: 1.45;
  }

  .environment-menu-entry button {
    width: 100%;
    min-height: 44px;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) auto 16px;
    align-items: center;
    gap: 7px;
    padding: 5px 8px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--opl-text);
    text-align: left;
  }

  .environment-menu-entry button:hover {
    background: var(--opl-hover);
  }

  .environment-menu-icon {
    width: 22px;
    height: 22px;
    display: inline-grid;
    place-items: center;
    color: #646560;
  }

  .environment-menu-copy {
    min-width: 0;
    display: grid;
    gap: 1px;
  }

  .environment-menu-copy strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 540;
  }

  .environment-menu-copy small {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    color: var(--opl-muted);
    font-size: 11px;
    line-height: 1.3;
  }

  .environment-menu-meta {
    color: var(--opl-faint);
    font-size: 10.5px;
    white-space: nowrap;
  }

  .context-block {
    min-width: 0;
    padding: 14px;
  }

  .context-block *,
  .package-lifecycle-card *,
  .starter-form * {
    min-width: 0;
  }

  .context-block p,
  .context-block code,
  .context-block dd,
  .context-block button {
    overflow-wrap: anywhere;
  }

  .context-block header,
  .context-list-head,
  .delivery-head,
  .starter-form header,
  .package-lifecycle-card header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .context-block h3,
  .starter-form h3 {
    margin: 0;
    font-size: 12.5px;
    font-weight: 560;
  }

  .context-empty,
  .delivery-note,
  .runtime-note,
  .starter-form p,
  .starter-form small,
  .package-lifecycle-card p,
  .package-lifecycle-card small {
    color: var(--opl-muted);
    font-size: 11px;
    line-height: 1.45;
  }

  .context-list,
  .delivery-stack,
  .starter-stack,
  .utility-stack,
  .package-lifecycle-list {
    min-width: 0;
    display: grid;
    gap: 8px;
  }

  .context-list {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
  }

  .context-list li,
  .starter-form,
  .package-lifecycle-card,
  .delivery-card,
  .confirmation-card,
  .action-receipt-summary {
    min-width: 0;
    padding: 10px;
    border: 1px solid var(--opl-border) !important;
    border-radius: 9px !important;
    background: #fff !important;
  }

  .context-list li {
    display: grid;
    gap: 3px;
  }

  .context-list code,
  .context-code,
  .trace-list dd,
  .package-lifecycle-card code,
  output,
  pre {
    max-width: 100%;
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: pre-wrap;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 10px;
  }

  .context-quiet-action,
  .context-button,
  .provenance-actions button,
  .runtime-actions button,
  .starter-form button,
  .package-action-row button {
    min-height: 29px;
    padding: 0 8px;
    border: 1px solid var(--opl-border);
    border-radius: 7px;
    background: #fff;
    color: var(--opl-text);
    font-size: 11px;
  }

  .artifact-preview-tabs,
  .provenance-drawer,
  .starter-forms,
  .package-lifecycle-panel,
  .runtime-panel,
  .action-receipt-summary-list {
    min-width: 0;
  }

  .artifact-preview-tabs [role="tablist"] {
    display: flex;
    gap: 14px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--opl-border);
  }

  .artifact-preview-tabs [role="tab"] {
    min-height: 32px;
    padding: 0;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--opl-muted);
    font-size: 11px;
  }

  .artifact-preview-tabs [role="tab"][data-state="active"] {
    border-bottom-color: var(--opl-accent);
    color: var(--opl-text);
  }

  .artifact-preview-card {
    min-width: 0 !important;
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
  }

  .artifact-preview-card > header {
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .artifact-preview-card h3 {
    margin: 0;
    font-size: 12.5px;
  }

  .artifact-preview-card .status-pill,
  .delivery-card .status-pill {
    white-space: nowrap;
  }

  .delivery-cards {
    margin-top: 14px;
  }

  .delivery-card dl {
    grid-template-columns: 1fr !important;
  }

  .trace-list,
  .package-filter-list,
  .package-axis-list,
  .package-detail-list,
  .package-ref-list {
    display: grid;
    gap: 7px;
    margin: 10px 0;
  }

  .trace-list div,
  .package-filter-list div,
  .package-axis-list div,
  .package-detail-list div,
  .package-ref-list div {
    min-width: 0;
    display: grid;
    gap: 2px;
  }

  .trace-list dt,
  .package-filter-list dt,
  .package-axis-list dt,
  .package-detail-list dt,
  .package-ref-list dt {
    color: var(--opl-muted);
    font-size: 10.5px;
  }

  .trace-list dd,
  .package-filter-list dd,
  .package-axis-list dd,
  .package-detail-list dd,
  .package-ref-list dd {
    margin: 0;
  }

  .provenance-actions,
  .runtime-actions,
  .package-action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 10px 0;
  }

  .starter-form {
    display: grid;
    gap: 8px;
  }

  .starter-field {
    display: grid;
    gap: 4px;
    font-size: 11px;
  }

  .starter-field input,
  .starter-field textarea,
  .starter-field select {
    width: 100%;
    padding: 7px 8px;
    border: 1px solid var(--opl-border);
    border-radius: 7px;
    background: #fff;
  }

  .runtime-meta {
    display: grid;
    gap: 5px;
  }

  .session-chip,
  .status-pill {
    width: fit-content;
    display: inline-flex;
    align-items: center;
    min-height: 20px;
    padding: 0 6px;
    border-radius: 5px;
    background: var(--opl-accent-soft);
    color: #08766d;
    font-size: 10px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 980px) {
    .opl-native-workbench {
      grid-template-columns: 230px minmax(0, 1fr);
    }

    .conversation-inner {
      padding-inline: 18px;
    }

    .context-inspector {
      right: 10px;
      width: min(340px, calc(100vw - 24px));
    }
  }

  @media (max-width: 760px) {
    .opl-native-workbench,
    .opl-native-workbench.sidebar-closed {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 40;
      width: min(272px, 88vw);
      box-shadow: 12px 0 32px rgba(0, 0, 0, 0.10);
    }

    .sidebar-closed .sidebar {
      display: none;
    }

    .sidebar-search {
      display: none;
    }

    .sidebar-close-mobile {
      display: inline-grid;
    }

    .settings-page dl > div {
      grid-template-columns: 1fr;
      gap: 7px;
    }

    .composer-select select {
      max-width: 74px;
    }
  }
`;
