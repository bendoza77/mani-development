import enAbout from "./locales/en/about.json";
import enCommon from "./locales/en/common.json";
import enCompany from "./locales/en/company.json";
import enContact from "./locales/en/contact.json";
import enErrors from "./locales/en/errors.json";
import enHome from "./locales/en/home.json";
import enHouse from "./locales/en/house.json";
import enMeta from "./locales/en/meta.json";
import enProjects from "./locales/en/projects.json";
import enServices from "./locales/en/services.json";
import kaAbout from "./locales/ka/about.json";
import kaCommon from "./locales/ka/common.json";
import kaCompany from "./locales/ka/company.json";
import kaContact from "./locales/ka/contact.json";
import kaErrors from "./locales/ka/errors.json";
import kaHome from "./locales/ka/home.json";
import kaHouse from "./locales/ka/house.json";
import kaMeta from "./locales/ka/meta.json";
import kaProjects from "./locales/ka/projects.json";
import kaServices from "./locales/ka/services.json";
import kaContent from "./content/ka.json";
import type { Locale } from "./config";

/** English is the source language: its shape defines every key the UI may use. */
const en = {
  common: enCommon,
  company: enCompany,
  home: enHome,
  house: enHouse,
  projects: enProjects,
  services: enServices,
  about: enAbout,
  contact: enContact,
  errors: enErrors,
  meta: enMeta,
};

export type UIResources = typeof en;
export type Namespace = keyof UIResources;
export const NAMESPACES = Object.keys(en) as Namespace[];
export const DEFAULT_NS = "common" satisfies Namespace;

/** Typed against English, so a key missing from a Georgian file fails `tsc`. */
const ka: UIResources = {
  common: kaCommon,
  company: kaCompany,
  home: kaHome,
  house: kaHouse,
  projects: kaProjects,
  services: kaServices,
  about: kaAbout,
  contact: kaContact,
  errors: kaErrors,
  meta: kaMeta,
};

export const UI_RESOURCES: Record<Locale, UIResources> = { en, ka };

/**
 * Translations of the seeded demo content (projects, services, testimonials, team, settings),
 * keyed by record id. English needs none: the seed itself is English.
 */
export type ContentOverlay = {
  settings?: Partial<Record<"tagline" | "address" | "hours", string>>;
  projects?: Record<
    string,
    Partial<Record<"title" | "summary" | "description" | "location" | "city", string>> & {
      specs?: { label: string; value: string }[];
    }
  >;
  services?: Record<string, Partial<Record<"title" | "summary" | "description", string>> & { features?: string[] }>;
  testimonials?: Record<string, Partial<Record<"quote" | "author" | "role", string>>>;
  team?: Record<string, Partial<Record<"name" | "role" | "bio", string>>>;
};

export const CONTENT_OVERLAYS: Record<Locale, ContentOverlay> = {
  en: {},
  ka: kaContent satisfies ContentOverlay,
};
