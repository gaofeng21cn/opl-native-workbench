window.__ModuleLoader__.load({
  id: "@one-person-lab/opl-studio-client",
  factory: () => ({
    name: "opl-studio-client",
    apply(ctx) {
      const plugin = globalThis.__OPL_STUDIO_CLIENT__;
      if (!plugin || typeof plugin.apply !== "function") {
        throw new Error("opl-studio-client: static renderer did not publish the OPL client plugin");
      }
      return plugin.apply(ctx);
    }
  })
});
