/**
 * @module @dreamer/plugin/i18n
 *
 * i18n for @dreamer/plugin: loader, manager, dependency-resolver, hot-reload messages.
 * Uses $tr + module instance, no install(); locale auto-detected from env.
 */

import {
  createI18n,
  type I18n,
  type TranslationData,
  type TranslationParams,
} from "@dreamer/i18n";
import { getEnv } from "@dreamer/runtime-adapter";
import enUS from "./locales/en-US.json" with { type: "json" };
import zhCN from "./locales/zh-CN.json" with { type: "json" };

export type Locale = "en-US" | "zh-CN";

export const DEFAULT_LOCALE: Locale = "en-US";

const PLUGIN_LOCALES: Locale[] = ["en-US", "zh-CN"];

const LOCALE_DATA: Record<string, TranslationData> = {
  "en-US": enUS as TranslationData,
  "zh-CN": zhCN as TranslationData,
};

let pluginI18n: I18n | null = null;

export function detectLocale(): Locale {
  const langEnv = getEnv("LANGUAGE") || getEnv("LC_ALL") || getEnv("LANG");
  if (!langEnv) return DEFAULT_LOCALE;
  const first = langEnv.split(/[:\s]/)[0]?.trim();
  if (!first) return DEFAULT_LOCALE;
  const match = first.match(/^([a-z]{2})[-_]([A-Z]{2})/i);
  if (match) {
    const normalized = `${match[1].toLowerCase()}-${
      match[2].toUpperCase()
    }` as Locale;
    if (PLUGIN_LOCALES.includes(normalized)) return normalized;
  }
  const primary = first.substring(0, 2).toLowerCase();
  if (primary === "zh") return "zh-CN";
  if (primary === "en") return "en-US";
  return DEFAULT_LOCALE;
}

/** 内部初始化，导入 i18n 时自动执行，不导出 */
function initPluginI18n(): void {
  if (pluginI18n) return;
  const i18n = createI18n({
    defaultLocale: DEFAULT_LOCALE,
    fallbackBehavior: "default",
    locales: [...PLUGIN_LOCALES],
    translations: LOCALE_DATA as Record<string, TranslationData>,
  });
  i18n.setLocale(detectLocale());
  pluginI18n = i18n;
}

initPluginI18n();

export function $tr(
  key: string,
  params?: Record<string, string | number>,
  lang?: Locale,
): string {
  if (!pluginI18n) initPluginI18n();
  if (!pluginI18n) return key;
  if (lang !== undefined) {
    const prev = pluginI18n.getLocale();
    pluginI18n.setLocale(lang);
    try {
      return pluginI18n.t(key, params as TranslationParams);
    } finally {
      pluginI18n.setLocale(prev);
    }
  }
  return pluginI18n.t(key, params as TranslationParams);
}
