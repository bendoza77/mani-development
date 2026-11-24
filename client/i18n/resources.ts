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
import ruAbout from "./locales/ru/about.json";
import ruCommon from "./locales/ru/common.json";
import ruCompany from "./locales/ru/company.json";
import ruContact from "./locales/ru/contact.json";
import ruErrors from "./locales/ru/errors.json";
import ruHome from "./locales/ru/home.json";
import ruHouse from "./locales/ru/house.json";
import ruMeta from "./locales/ru/meta.json";
import ruProjects from "./locales/ru/projects.json";
import ruServices from "./locales/ru/services.json";
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


/** Typed against English too, so a key missing from a Russian file fails `tsc`. */
const ru: UIResources = {
  common: ruCommon,
  company: ruCompany,
  home: ruHome,
  house: ruHouse,
  projects: ruProjects,
  services: ruServices,
  about: ruAbout,
  contact: ruContact,
  errors: ruErrors,
  meta: ruMeta,
};

export const UI_RESOURCES: Record<Locale, UIResources> = { en, ka, ru };
