export const extensionApi = globalThis.browser || globalThis.chrome || null;

export const STORAGE_KEYS = {
  settings: "settings",
  customImages: "customImages",
  shortcuts: "shortcuts",
  pins: "pins"
};

export const DEFAULT_SEARCH_PROVIDERS = [
  {
    id: "brave",
    label: "Brave",
    url: "https://search.brave.com/search?q={query}"
  },
  {
    id: "youtube",
    label: "YouTube",
    url: "https://www.youtube.com/results?search_query={query}"
  },
  {
    id: "maps",
    label: "Maps",
    url: "https://www.google.com/maps/search/{query}"
  }
];

export const DEFAULT_SETTINGS = {
  theme: "dark",
  accentColor: "#8274ff",
  showDefaultTiles: true,
  focusMode: false,
  showClock: true,
  clockFormat: "auto",
  language: "auto",
  backgroundMode: "random",
  backgroundSource: "picsum",
  imageApiCategory: "all",
  preloadOnlineImages: true,
  customImageApiUrl: "",
  fixedBackgroundId: null,
  disabledBackgrounds: [],
  searchProviderId: "brave",
  searchProviders: DEFAULT_SEARCH_PROVIDERS,
  tileIconOverrides: {}
};

const FALLBACK_STORAGE_KEY = "benni-newtab-state";

export async function loadState() {
  const defaults = {
    [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
    [STORAGE_KEYS.customImages]: [],
    [STORAGE_KEYS.shortcuts]: [],
    [STORAGE_KEYS.pins]: []
  };
  const stored = await storageGet(defaults);

  return {
    settings: normalizeSettings(stored[STORAGE_KEYS.settings]),
    customImages: normalizeArray(stored[STORAGE_KEYS.customImages]),
    shortcuts: normalizeShortcuts(stored[STORAGE_KEYS.shortcuts]),
    pins: normalizePins(stored[STORAGE_KEYS.pins])
  };
}

export async function saveSettings(settings) {
  await storageSet({ [STORAGE_KEYS.settings]: normalizeSettings(settings) });
}

export async function saveCustomImages(images) {
  await storageSet({ [STORAGE_KEYS.customImages]: normalizeArray(images) });
}

export async function saveShortcuts(shortcuts) {
  await storageSet({ [STORAGE_KEYS.shortcuts]: normalizeShortcuts(shortcuts) });
}

export async function savePins(pins) {
  await storageSet({ [STORAGE_KEYS.pins]: normalizePins(pins) });
}

export async function resetAllData() {
  const keys = Object.values(STORAGE_KEYS);
  const local = extensionApi?.storage?.local;
  if (local?.remove) {
    try {
      const result = local.remove(keys);
      if (isPromise(result)) {
        await result;
        return;
      }
      await new Promise((resolve) => local.remove(keys, resolve));
      return;
    } catch (error) {
      console.warn("storage.remove failed", error);
    }
  }
  localStorage.removeItem(FALLBACK_STORAGE_KEY);
}

export function normalizeWebUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("URL fehlt.");
  }
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Nur http:// und https:// URLs sind erlaubt.");
  }
  return url.href;
}

export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function createId(prefix) {
  if (crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function pinKeyForUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return String(url || "").trim();
  }
}

function normalizeSettings(value) {
  const rawSettings = isPlainObject(value) ? value : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (Object.prototype.hasOwnProperty.call(rawSettings, key)) {
      settings[key] = rawSettings[key];
    }
  }
  settings.theme = settings.theme === "light" ? "light" : "dark";
  settings.accentColor = /^#[0-9a-f]{6}$/i.test(settings.accentColor)
    ? settings.accentColor.toLowerCase()
    : DEFAULT_SETTINGS.accentColor;
  settings.showDefaultTiles = Boolean(settings.showDefaultTiles);
  settings.focusMode = Boolean(settings.focusMode);
  settings.showClock = settings.showClock !== false;
  settings.clockFormat = ["auto", "12", "24"].includes(settings.clockFormat) ? settings.clockFormat : "auto";
  settings.language = ["auto", "de", "en", "es", "it", "pl", "ru", "fr"].includes(settings.language)
    ? settings.language
    : "auto";
  settings.backgroundMode = ["random", "daily", "fixed"].includes(settings.backgroundMode)
    ? settings.backgroundMode
    : DEFAULT_SETTINGS.backgroundMode;
  settings.backgroundSource = ["local", "picsum", "custom"].includes(settings.backgroundSource)
    ? settings.backgroundSource
    : DEFAULT_SETTINGS.backgroundSource;
  // Existing installations remain local until the user explicitly enables an online source.
  if (Object.keys(rawSettings).length && !Object.prototype.hasOwnProperty.call(rawSettings, "backgroundSource")) {
    settings.backgroundSource = "local";
  }
  settings.imageApiCategory = ["all", "nature", "architecture", "technology", "people", "minimal"].includes(settings.imageApiCategory)
    ? settings.imageApiCategory
    : "all";
  settings.preloadOnlineImages = settings.preloadOnlineImages !== false;
  settings.customImageApiUrl = typeof settings.customImageApiUrl === "string"
    ? settings.customImageApiUrl.trim().slice(0, 2048)
    : "";
  settings.fixedBackgroundId = typeof settings.fixedBackgroundId === "string" ? settings.fixedBackgroundId : null;
  settings.disabledBackgrounds = normalizeArray(settings.disabledBackgrounds).filter((item) => typeof item === "string");
  settings.searchProviders = normalizeSearchProviders(settings.searchProviders);
  settings.tileIconOverrides = normalizeIconOverrides(settings.tileIconOverrides);
  if (!rawSettings.searchProviderId && typeof rawSettings.searchEngine === "string") {
    settings.searchProviderId = rawSettings.searchEngine === "google" ? "brave" : rawSettings.searchEngine;
  }
  if (!settings.searchProviders.some((provider) => provider.id === settings.searchProviderId)) {
    settings.searchProviderId = settings.searchProviders[0]?.id || "brave";
  }
  delete settings.searchEngine;
  return settings;
}

function normalizeSearchProviders(providers) {
  const seen = new Set();
  const normalized = normalizeArray(providers)
    .filter((item) => isPlainObject(item) && item.label && item.url)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : createId("search"),
      label: String(item.label).trim().slice(0, 14),
      url: String(item.url).trim()
    }))
    .filter((item) => {
      if (!item.label || !item.url || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    })
    .slice(0, 3);

  return normalized.length ? normalized : DEFAULT_SEARCH_PROVIDERS;
}

function normalizeShortcuts(shortcuts) {
  return normalizeArray(shortcuts)
    .filter((item) => isPlainObject(item) && item.name && item.url)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : createId("shortcut"),
      name: String(item.name).slice(0, 64),
      url: String(item.url),
      icon: isSafeInlineImage(item.icon) ? item.icon : null,
      createdAt: Number(item.createdAt) || Date.now()
    }));
}

function normalizePins(pins) {
  const seen = new Set();
  return normalizeArray(pins)
    .filter((item) => isPlainObject(item) && item.title && item.url)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : createId("pin"),
      title: String(item.title).slice(0, 96),
      url: String(item.url),
      domain: typeof item.domain === "string" ? item.domain : getDomain(item.url),
      tileId: typeof item.tileId === "string" ? item.tileId : null,
      icon: isSafeTileIcon(item.icon) ? item.icon : null,
      favicon: isSafeInlineImage(item.favicon) ? item.favicon : null,
      source: typeof item.source === "string" ? item.source : "custom",
      pinnedAt: Number(item.pinnedAt) || Date.now()
    }))
    .filter((item) => {
      const key = pinKeyForUrl(item.url);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.pinnedAt - b.pinnedAt);
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeIconOverrides(value) {
  if (!isPlainObject(value)) {
    return {};
  }
  return Object.entries(value).reduce((result, [key, icon]) => {
    if (typeof key === "string" && isSafeInlineImage(icon)) {
      result[key] = icon;
    }
    return result;
  }, {});
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isPromise(value) {
  return value && typeof value.then === "function";
}

function isSafeInlineImage(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function isSafeTileIcon(value) {
  return isSafeInlineImage(value) || (typeof value === "string" && value.startsWith("icons/"));
}

async function storageGet(defaults) {
  const local = extensionApi?.storage?.local;
  if (local?.get) {
    try {
      const result = local.get(defaults);
      if (isPromise(result)) {
        return await result;
      }
    } catch (error) {
      console.warn("storage.get promise failed", error);
    }

    return new Promise((resolve) => {
      try {
        local.get(defaults, (items) => resolve(items || defaults));
      } catch (error) {
        console.warn("storage.get callback failed", error);
        resolve(defaults);
      }
    });
  }

  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

async function storageSet(values) {
  const local = extensionApi?.storage?.local;
  if (local?.set) {
    try {
      const result = local.set(values);
      if (isPromise(result)) {
        await result;
        return;
      }
    } catch (error) {
      console.warn("storage.set promise failed", error);
    }

    await new Promise((resolve, reject) => {
      try {
        local.set(values, () => {
          const lastError = extensionApi?.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
    return;
  }

  const current = await storageGet({});
  localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify({ ...current, ...values }));
}
