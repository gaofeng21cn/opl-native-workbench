export function unsupportedNativeAppUpdate(operation) {
  return {
    schema: "opl_native_app_updater.v1",
    owner: "one-person-lab-app_native_host",
    host: "web",
    operation,
    supported: false,
    state: "unsupported",
    restartRequired: false,
    reasonCode: "native_host_required",
    ownerFallback: "one-person-lab-app"
  };
}
