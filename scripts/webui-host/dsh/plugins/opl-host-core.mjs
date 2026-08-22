import { OplHostCore } from "../../host-core.mjs";

export const name = "opl-host-core";
export const inject = ["oplStudioHostOptions", "oplCodexNative", "oplFrameworkBridge"];

export function apply(ctx) {
  ctx.provide("oplHostCore", new OplHostCore({
    ...ctx.oplStudioHostOptions,
    codex: ctx.oplCodexNative,
    framework: ctx.oplFrameworkBridge,
    managedByDsh: true
  }));
}
