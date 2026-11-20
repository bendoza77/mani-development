import "i18next";
import type { UIResources } from "./resources";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: UIResources;
    // Translation values never resolve to null, so `t()` always returns a string.
    returnNull: false;
  }
}
