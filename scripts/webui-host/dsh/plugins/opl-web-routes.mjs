import { registerOplHttpRoutes } from "../../http-routes.mjs";

export const name = "opl-web-routes";
export const inject = ["webServer", "oplHostCore"];

export function apply(ctx) {
  ctx.effect(
    () => registerOplHttpRoutes(ctx.webServer, ctx.oplHostCore),
    "opl-web-routes: HTTP bridge"
  );
}
