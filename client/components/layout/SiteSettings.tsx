"use client";

import { createContext, useContext, type ReactNode } from "react";
import { EMPTY_SETTINGS, type PublicSettings } from "@/lib/public-types";

/**
 * Public site settings (company name, contact details, feature switches), read on the server by
 * the root layout and shared with Client Components here. Outside the provider, or when the API
 * can't be reached, the defaults apply: the company name and every optional feature off.
 */
const SettingsContext = createContext<PublicSettings>(EMPTY_SETTINGS);

export function SiteSettingsProvider({ settings, children }: { settings: PublicSettings; children: ReactNode }) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSiteSettings(): PublicSettings {
  return useContext(SettingsContext);
}
