import {
  createId,
  DEFAULT_SETTINGS,
  DEFAULT_SEARCH_PROVIDERS,
  getDomain,
  loadState,
  normalizeWebUrl,
  pinKeyForUrl,
  saveCustomImages,
  savePins,
  saveSettings,
  saveShortcuts,
  resetAllData
} from "./storage.js";
import {
  BUILTIN_BACKGROUNDS,
  createOnlineBackground,
  getAllBackgrounds,
  getEnabledBackgrounds,
  importImageFile,
  importImageUrl,
  normalizeImageApiTemplate,
  selectBackground,
  setElementBackground
} from "./backgrounds.js";
import { getLocale, resolveLocale, setLocale, t, translatePage } from "./i18n.js";

const DEFAULT_TILES = [
  { id: "default-youtube", title: "YouTube", url: "https://www.youtube.com/", icon: "icons/shortcuts/youtube.svg" }
].map((item) => ({ ...item, domain: getDomain(item.url), source: "default" }));

const elements = {
  root: document.documentElement,
  body: document.body,
  backgroundLayer: document.querySelector("#backgroundLayer"),
  backgroundLayerNext: document.querySelector("#backgroundLayerNext"),
  clock: document.querySelector("#clock"),
  settingsButton: document.querySelector("#settingsButton"),
  closeSettingsButton: document.querySelector("#closeSettingsButton"),
  panelBackdrop: document.querySelector("#panelBackdrop"),
  settingsPanel: document.querySelector("#settingsPanel"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  searchProviders: document.querySelector("#searchProviders"),
  pinnedSection: document.querySelector("#pinnedSection"),
  pinnedGrid: document.querySelector("#pinnedGrid"),
  quickSection: document.querySelector("#quickSection"),
  quickGrid: document.querySelector("#quickGrid"),
  themeSelect: document.querySelector("#themeSelect"),
  accentColorInput: document.querySelector("#accentColorInput"),
  resetAccentButton: document.querySelector("#resetAccentButton"),
  lightModeWarning: document.querySelector("#lightModeWarning"),
  focusModeToggle: document.querySelector("#focusModeToggle"),
  defaultTilesToggle: document.querySelector("#defaultTilesToggle"),
  defaultSearchSelect: document.querySelector("#defaultSearchSelect"),
  searchProviderForm: document.querySelector("#searchProviderForm"),
  providerLabelInput: document.querySelector("#providerLabelInput"),
  providerUrlInput: document.querySelector("#providerUrlInput"),
  searchProviderList: document.querySelector("#searchProviderList"),
  backgroundModeSelect: document.querySelector("#backgroundModeSelect"),
  backgroundSourceSelect: document.querySelector("#backgroundSourceSelect"),
  imageApiCategorySelect: document.querySelector("#imageApiCategorySelect"),
  preloadOnlineImagesToggle: document.querySelector("#preloadOnlineImagesToggle"),
  customApiSettings: document.querySelector("#customApiSettings"),
  customImageApiInput: document.querySelector("#customImageApiInput"),
  refreshBackgroundButton: document.querySelector("#refreshBackgroundButton"),
  imageFileInput: document.querySelector("#imageFileInput"),
  imageUrlForm: document.querySelector("#imageUrlForm"),
  imageUrlInput: document.querySelector("#imageUrlInput"),
  backgroundList: document.querySelector("#backgroundList"),
  shortcutForm: document.querySelector("#shortcutForm"),
  shortcutNameInput: document.querySelector("#shortcutNameInput"),
  shortcutUrlInput: document.querySelector("#shortcutUrlInput"),
  shortcutIconInput: document.querySelector("#shortcutIconInput"),
  shortcutList: document.querySelector("#shortcutList"),
  defaultTileIconList: document.querySelector("#defaultTileIconList"),
  showClockToggle: document.querySelector("#showClockToggle"),
  clockFormatSelect: document.querySelector("#clockFormatSelect"),
  languageSelect: document.querySelector("#languageSelect"),
  settingsNavItems: [...document.querySelectorAll("[data-settings-tab]")],
  settingsPages: [...document.querySelectorAll("[data-settings-page]")],
  resetButton: document.querySelector("#resetButton"),
  toast: document.querySelector("#toast")
};

let appState = {
  settings: null,
  customImages: [],
  shortcuts: [],
  pins: []
};

let toastTimer = null;
let onlineBackgroundSeed = "";
let nextOnlineBackgroundSeed = "";
let lastFocusedElement = null;
let activeBackgroundLayer = elements.backgroundLayer;
let standbyBackgroundLayer = elements.backgroundLayerNext;
let backgroundRequestId = 0;
const cancelableImageLoads = new Map();
let resumeOnlineLoadsAfterSettings = false;
let onlineBackgroundWasPreloaded = false;
const NEXT_BACKGROUND_SEED_KEY = "benni-newtab-next-background-seed";
const PRELOADED_BACKGROUND_SEED_KEY = "benni-newtab-preloaded-background-seed";
const renderedSettingsPages = new Set();

init().catch((error) => {
  console.error(error);
  showToast(t("toast.loadError"));
});

async function init() {
  appState = { ...appState, ...(await loadState()) };
  setLocale(resolveLocale(appState.settings.language));
  translatePage();
  prepareBackgroundSeeds();
  applySettingsToPage();
  bindEvents();
  updateClock();
  setInterval(updateClock, 1000);
  const backgroundReady = applyBackground();
  render();
  scheduleSettingsPrewarm();
  await backgroundReady;
}

function bindEvents() {
  elements.settingsButton.addEventListener("click", openSettings);
  elements.closeSettingsButton.addEventListener("click", closeSettings);
  elements.panelBackdrop.addEventListener("click", closeSettings);
  elements.settingsNavItems.forEach((button) => {
    button.addEventListener("click", () => activateSettingsPage(button.dataset.settingsTab));
  });

  elements.searchForm.addEventListener("submit", handleSearchSubmit);
  elements.searchInput.addEventListener("focus", () => elements.body.classList.add("search-active"));
  elements.searchForm.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      if (!elements.searchForm.contains(document.activeElement)) {
        elements.body.classList.remove("search-active");
      }
    });
  });

  elements.searchProviders.addEventListener("click", async (event) => {
    const button = event.target.closest(".engine-button");
    if (!button) {
      return;
    }
    const providerId = button.dataset.providerId;
    if (providerId) {
      appState.settings.searchProviderId = providerId;
      renderSearchProviders();
      await persistSettings();
      elements.body.classList.add("search-active");
      elements.searchInput.focus();
    }
  });

  elements.themeSelect.addEventListener("change", async () => {
    appState.settings.theme = elements.themeSelect.value === "light" ? "light" : "dark";
    applySettingsToPage();
    await persistSettings();
    if (appState.settings.theme === "light") {
      showToast(t("appearance.lightWarningTitle"));
    }
  });

  elements.accentColorInput.addEventListener("input", () => {
    elements.root.style.setProperty("--settings-accent", elements.accentColorInput.value);
  });

  elements.accentColorInput.addEventListener("change", async () => {
    appState.settings.accentColor = elements.accentColorInput.value;
    await persistSettings();
  });

  elements.resetAccentButton.addEventListener("click", async () => {
    appState.settings.accentColor = DEFAULT_SETTINGS.accentColor;
    await persistSettings();
  });

  elements.focusModeToggle.addEventListener("change", async () => {
    appState.settings.focusMode = elements.focusModeToggle.checked;
    applySettingsToPage();
    await persistSettings();
  });

  elements.defaultTilesToggle.addEventListener("change", async () => {
    appState.settings.showDefaultTiles = elements.defaultTilesToggle.checked;
    await persistSettings();
    render();
  });

  elements.defaultSearchSelect.addEventListener("change", async () => {
    appState.settings.searchProviderId = elements.defaultSearchSelect.value;
    await persistSettings();
    renderSearchProviders();
  });

  elements.searchProviderForm.addEventListener("submit", handleSearchProviderSubmit);

  elements.backgroundModeSelect.addEventListener("change", async () => {
    appState.settings.backgroundMode = elements.backgroundModeSelect.value;
    rotateBackgroundSeeds();
    if (appState.settings.backgroundMode === "fixed" && !appState.settings.fixedBackgroundId) {
      const current = selectBackground(appState.customImages, appState.settings);
      appState.settings.fixedBackgroundId = current?.id || BUILTIN_BACKGROUNDS[0].id;
    }
    await persistSettings();
    await applyBackground();
    renderBackgroundList();
  });

  elements.backgroundSourceSelect.addEventListener("change", async () => {
    appState.settings.backgroundSource = elements.backgroundSourceSelect.value;
    rotateBackgroundSeeds();
    await persistSettings();
    await applyBackground({ notifyFallback: true });
  });

  elements.imageApiCategorySelect.addEventListener("change", async () => {
    appState.settings.imageApiCategory = elements.imageApiCategorySelect.value;
    rotateBackgroundSeeds();
    await persistSettings();
    await applyBackground({ notifyFallback: true });
  });

  elements.preloadOnlineImagesToggle.addEventListener("change", async () => {
    appState.settings.preloadOnlineImages = elements.preloadOnlineImagesToggle.checked;
    await persistSettings();
    if (appState.settings.preloadOnlineImages) {
      scheduleNextBackgroundPreload();
    }
  });

  elements.customImageApiInput.addEventListener("change", async () => {
    const value = elements.customImageApiInput.value.trim();
    if (!value) {
      appState.settings.customImageApiUrl = "";
      await persistSettings();
      return;
    }
    try {
      appState.settings.customImageApiUrl = normalizeImageApiTemplate(value);
      rotateBackgroundSeeds();
      await persistSettings();
      if (appState.settings.backgroundSource === "custom") {
        await applyBackground({ notifyFallback: true });
      }
      showToast(t("toast.saved"));
    } catch {
      elements.customImageApiInput.value = appState.settings.customImageApiUrl;
      showToast(t("background.customMissing"));
    }
  });

  elements.refreshBackgroundButton.addEventListener("click", async () => {
    if (appState.settings.backgroundSource === "local") {
      showToast(t("background.localOnly"));
      return;
    }
    if (appState.settings.backgroundSource === "custom" && !appState.settings.customImageApiUrl) {
      showToast(t("background.customMissing"));
      return;
    }
    rotateBackgroundSeeds();
    await applyBackground({ notifyFallback: true });
  });

  elements.showClockToggle.addEventListener("change", async () => {
    appState.settings.showClock = elements.showClockToggle.checked;
    await persistSettings();
    updateClock();
  });

  elements.clockFormatSelect.addEventListener("change", async () => {
    appState.settings.clockFormat = elements.clockFormatSelect.value;
    await persistSettings();
    updateClock();
  });

  elements.languageSelect.addEventListener("change", async () => {
    appState.settings.language = elements.languageSelect.value;
    setLocale(resolveLocale(appState.settings.language));
    translatePage();
    await persistSettings();
    updateClock();
    render();
  });

  elements.imageFileInput.addEventListener("change", handleImageFiles);
  elements.imageUrlForm.addEventListener("submit", handleImageUrlSubmit);
  elements.shortcutForm.addEventListener("submit", handleShortcutSubmit);
  elements.resetButton.addEventListener("click", handleReset);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && elements.body.classList.contains("panel-open")) {
      trapSettingsFocus(event);
      return;
    }
    if (event.key !== "Escape") {
      return;
    }
    if (elements.body.classList.contains("panel-open")) {
      closeSettings();
      return;
    }
    elements.searchInput.blur();
    elements.body.classList.remove("search-active");
  });
}

function updateClock() {
  const now = new Date();
  const format = appState.settings.clockFormat;
  const options = {
    hour: "2-digit",
    minute: "2-digit"
  };
  if (format === "12" || format === "24") {
    options.hour12 = format === "12";
  }
  elements.clock.hidden = !appState.settings.showClock;
  elements.clock.textContent = new Intl.DateTimeFormat(getLocale(), options).format(now);
  elements.clock.setAttribute("datetime", now.toISOString());
}

function handleSearchSubmit(event) {
  event.preventDefault();
  const query = elements.searchInput.value.trim();
  if (!query) {
    return;
  }
  const provider = getActiveSearchProvider();
  location.assign(buildSearchUrl(provider, query));
}

async function handleSearchProviderSubmit(event) {
  event.preventDefault();
  if (appState.settings.searchProviders.length >= 3) {
    showToast(t("searchSettings.max"));
    return;
  }

  const label = elements.providerLabelInput.value.trim();
  const rawUrl = elements.providerUrlInput.value.trim();
  if (!label || !rawUrl) {
    showToast(t("toast.nameUrlMissing"));
    return;
  }

  try {
    const provider = {
      id: createId("search"),
      label: label.slice(0, 14),
      url: normalizeSearchTemplate(rawUrl)
    };
    appState.settings.searchProviders = [...appState.settings.searchProviders, provider].slice(0, 3);
    appState.settings.searchProviderId = provider.id;
    elements.providerLabelInput.value = "";
    elements.providerUrlInput.value = "";
    await persistSettings();
    render();
    showToast(t("toast.providerSaved"));
  } catch (error) {
    console.warn(error);
    showToast(t("toast.invalidUrl"));
  }
}

async function handleImageFiles(event) {
  const files = [...event.target.files];
  if (!files.length) {
    return;
  }
  try {
    const imported = [];
    for (const file of files) {
      imported.push(await importImageFile(file));
    }
    appState.customImages = [...appState.customImages, ...imported];
    await saveCustomImages(appState.customImages);
    await applyBackground();
    render();
    showToast(imported.length === 1 ? t("toast.imageSaved") : t("toast.imagesSaved", { count: imported.length }));
  } catch (error) {
    console.error(error);
    showToast(t("toast.imageError"));
  } finally {
    elements.imageFileInput.value = "";
  }
}

async function handleImageUrlSubmit(event) {
  event.preventDefault();
  const value = elements.imageUrlInput.value.trim();
  if (!value) {
    return;
  }
  try {
    const image = await importImageUrl(value);
    appState.customImages = [...appState.customImages, image];
    await saveCustomImages(appState.customImages);
    elements.imageUrlInput.value = "";
    await applyBackground();
    render();
    showToast(t("toast.imageUrlSaved"));
  } catch (error) {
    console.error(error);
    showToast(t("toast.imageUrlError"));
  }
}

async function handleShortcutSubmit(event) {
  event.preventDefault();
  const name = elements.shortcutNameInput.value.trim();
  const rawUrl = elements.shortcutUrlInput.value.trim();
  if (!name || !rawUrl) {
    showToast(t("toast.nameUrlMissing"));
    return;
  }
  try {
    const url = normalizeWebUrl(rawUrl);
    const icon = elements.shortcutIconInput.files[0]
      ? await importShortcutIcon(elements.shortcutIconInput.files[0])
      : null;
    const shortcut = {
      id: createId("shortcut"),
      name: name.slice(0, 64),
      url,
      icon,
      createdAt: Date.now()
    };
    appState.shortcuts = [...appState.shortcuts, shortcut];
    await saveShortcuts(appState.shortcuts);
    elements.shortcutNameInput.value = "";
    elements.shortcutUrlInput.value = "";
    elements.shortcutIconInput.value = "";
    render();
    showToast(t("toast.shortcutSaved"));
  } catch (error) {
    console.warn(error);
    showToast(t("toast.invalidUrl"));
  }
}

async function handleReset() {
  const confirmed = confirm(t("data.confirm"));
  if (!confirmed) {
    return;
  }
  await resetAllData();
  location.reload();
}

async function applyBackground({ notifyFallback = false } = {}) {
  const requestId = ++backgroundRequestId;
  const fallback = selectBackground(appState.customImages, appState.settings);
  let online = null;
  try {
    online = createOnlineBackground(getOnlineBackgroundSettings(), onlineBackgroundSeed || createRefreshSeed());
  } catch (error) {
    console.warn("Online background configuration is invalid", error);
  }

  if (fallback && !activeBackgroundLayer.classList.contains("loaded")) {
    await waitForImage(fallback.src, 1200).catch(() => null);
    if (requestId !== backgroundRequestId) {
      return;
    }
    showBackground(fallback.src, { immediate: true });
  }

  if (!online) {
    if (fallback && activeBackgroundLayer.style.backgroundImage !== `url("${fallback.src}")`) {
      await waitForImage(fallback.src, 1200).catch(() => null);
      if (requestId === backgroundRequestId) {
        showBackground(fallback.src);
      }
    }
    return;
  }

  if (!onlineBackgroundWasPreloaded) {
    await delay(350);
  }
  if (requestId !== backgroundRequestId) {
    return;
  }
  if (elements.body.classList.contains("panel-open")) {
    resumeOnlineLoadsAfterSettings = true;
    return;
  }

  const loaded = await waitForImage(online.src, 5000, { cancelOnSettings: true }).then(() => true).catch(() => false);
  if (requestId !== backgroundRequestId) {
    return;
  }
  if (!loaded) {
    if (notifyFallback) {
      showToast(t("background.apiUnavailable"));
    }
    return;
  }
  showBackground(online.src);
  onlineBackgroundWasPreloaded = false;
  scheduleNextBackgroundPreload();
}

function applySettingsToPage() {
  elements.root.dataset.theme = appState.settings.theme;
  elements.root.style.setProperty("--settings-accent", appState.settings.accentColor);
  elements.body.classList.toggle("focus-mode", appState.settings.focusMode);
  elements.themeSelect.value = appState.settings.theme;
  elements.accentColorInput.value = appState.settings.accentColor;
  elements.lightModeWarning.hidden = appState.settings.theme !== "light";
  elements.focusModeToggle.checked = appState.settings.focusMode;
  elements.defaultTilesToggle.checked = appState.settings.showDefaultTiles;
  elements.showClockToggle.checked = appState.settings.showClock;
  elements.clockFormatSelect.value = appState.settings.clockFormat;
  elements.clockFormatSelect.querySelector('option[value="auto"]').textContent = `${t("clock.auto")} (${getLocale()})`;
  elements.languageSelect.value = appState.settings.language;
  elements.backgroundModeSelect.value = appState.settings.backgroundMode;
  elements.backgroundSourceSelect.value = appState.settings.backgroundSource;
  elements.imageApiCategorySelect.value = appState.settings.imageApiCategory;
  elements.imageApiCategorySelect.disabled = appState.settings.backgroundSource === "local";
  elements.preloadOnlineImagesToggle.checked = appState.settings.preloadOnlineImages;
  elements.preloadOnlineImagesToggle.disabled = appState.settings.backgroundSource === "local" || appState.settings.backgroundMode === "fixed";
  elements.customImageApiInput.value = appState.settings.customImageApiUrl;
  elements.customApiSettings.hidden = appState.settings.backgroundSource !== "custom";
  elements.refreshBackgroundButton.disabled = appState.settings.backgroundSource === "local" || appState.settings.backgroundMode === "fixed";
  renderSearchProviders();
}

function renderSearchProviders() {
  clearNode(elements.searchProviders);
  const providers = getSearchProviders();
  for (const provider of providers) {
    const button = document.createElement("button");
    button.className = "engine-button";
    button.type = "button";
    button.dataset.providerId = provider.id;
    button.textContent = provider.label;
    button.classList.toggle("active", provider.id === getActiveSearchProvider().id);
    elements.searchProviders.append(button);
  }
}

function render() {
  applySettingsToPage();
  renderPinned();
  renderQuickAccess();
  if (elements.body.classList.contains("panel-open")) {
    renderSettingsPage(getActiveSettingsPage(), { force: true });
  }
}

function getActiveSettingsPage() {
  return elements.settingsPages.find((page) => !page.hidden)?.dataset.settingsPage || "appearance";
}

function renderSettingsPage(pageName, { force = false } = {}) {
  if (!force && renderedSettingsPages.has(pageName)) {
    return;
  }
  if (pageName === "background") {
    renderBackgroundList();
  } else if (pageName === "search") {
    renderDefaultSearchSelect();
    renderSearchProviderList();
  } else if (pageName === "websites") {
    renderShortcutList();
    renderDefaultTileIconList();
  }
  renderedSettingsPages.add(pageName);
}

function renderDefaultSearchSelect() {
  clearNode(elements.defaultSearchSelect);
  for (const provider of getSearchProviders()) {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = provider.label;
    option.selected = provider.id === getActiveSearchProvider().id;
    elements.defaultSearchSelect.append(option);
  }
}

function renderPinned() {
  clearNode(elements.pinnedGrid);
  const pins = appState.pins.map((pin) => {
    const defaultTile = DEFAULT_TILES.find((tile) => tile.id === pin.tileId);
    return defaultTile ? { ...pin, icon: getTileIcon(defaultTile) || pin.icon } : pin;
  });
  elements.pinnedSection.hidden = pins.length === 0;
  for (const pin of pins) {
    elements.pinnedGrid.append(createTile(pin, { source: pin.source || "pin" }));
  }
}

function renderQuickAccess() {
  clearNode(elements.quickGrid);
  const defaults = appState.settings.showDefaultTiles
    ? DEFAULT_TILES.map((tile) => ({ ...tile, icon: getTileIcon(tile) }))
    : [];
  const custom = appState.shortcuts.map((shortcut) => ({
    id: shortcut.id,
    title: shortcut.name,
    url: shortcut.url,
    domain: getDomain(shortcut.url),
    icon: shortcut.icon,
    source: "custom"
  }));
  const items = [...defaults, ...custom].filter((item) => !isPinned(item.url));
  elements.quickSection.hidden = items.length === 0;
  for (const item of items) {
    elements.quickGrid.append(createTile(item, { source: item.source }));
  }
}

function renderSearchProviderList() {
  clearNode(elements.searchProviderList);
  const providers = getSearchProviders();
  const isFull = providers.length >= 3;
  elements.providerLabelInput.disabled = isFull;
  elements.providerUrlInput.disabled = isFull;
  elements.searchProviderForm.querySelector("button").disabled = isFull;

  for (const provider of providers) {
    const item = document.createElement("form");
    item.className = "provider-item";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = provider.label;
    labelInput.maxLength = 14;
    labelInput.ariaLabel = t("common.name");

    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.value = provider.url;
    urlInput.ariaLabel = t("searchSettings.url");

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const saveButton = smallButton(t("common.save"));
    saveButton.type = "submit";

    const deleteButton = iconButton("trash", t("common.delete"));
    deleteButton.disabled = providers.length <= 1;
    deleteButton.addEventListener("click", async () => {
      appState.settings.searchProviders = appState.settings.searchProviders.filter((itemProvider) => itemProvider.id !== provider.id);
      if (appState.settings.searchProviderId === provider.id) {
        appState.settings.searchProviderId = appState.settings.searchProviders[0]?.id || DEFAULT_SEARCH_PROVIDERS[0].id;
      }
      await persistSettings();
      render();
      showToast(t("toast.providerDeleted"));
    });

    item.addEventListener("submit", async (event) => {
      event.preventDefault();
      const label = labelInput.value.trim();
      if (!label) {
        showToast(t("toast.nameMissing"));
        return;
      }
      try {
        const url = normalizeSearchTemplate(urlInput.value);
        appState.settings.searchProviders = appState.settings.searchProviders.map((itemProvider) => (
          itemProvider.id === provider.id
            ? { ...itemProvider, label: label.slice(0, 14), url }
            : itemProvider
        ));
        await persistSettings();
        render();
        showToast(t("toast.providerUpdated"));
      } catch (error) {
        console.warn(error);
        showToast(t("toast.invalidUrl"));
      }
    });

    actions.append(saveButton, deleteButton);
    item.append(labelInput, urlInput, actions);
    elements.searchProviderList.append(item);
  }
}

function renderBackgroundList() {
  clearNode(elements.backgroundList);
  const all = getAllBackgrounds(appState.customImages);
  const enabled = getEnabledBackgrounds(appState.customImages, appState.settings);
  const disabled = new Set(appState.settings.disabledBackgrounds || []);

  for (const image of all) {
    const item = document.createElement("div");
    item.className = "background-item";

    const preview = document.createElement("img");
    preview.className = "background-preview";
    preview.src = image.src;
    preview.alt = "";
    preview.loading = "lazy";
    preview.decoding = "async";

    const copy = document.createElement("div");
    copy.className = "item-copy";

    const name = document.createElement("strong");
    name.textContent = image.nameKey ? t(image.nameKey) : image.name;

    const meta = document.createElement("span");
    meta.textContent = image.type === "builtin" ? t("background.builtin") : t("background.custom");

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const fixedButton = smallButton(appState.settings.fixedBackgroundId === image.id ? t("background.setActive") : t("background.set"));
    fixedButton.disabled = appState.settings.fixedBackgroundId === image.id && appState.settings.backgroundMode === "fixed";
    fixedButton.addEventListener("click", async () => {
      appState.settings.backgroundMode = "fixed";
      appState.settings.fixedBackgroundId = image.id;
      await persistSettings();
      await applyBackground();
      render();
    });
    actions.append(fixedButton);

    const isDisabled = disabled.has(image.id);
    const toggleButton = smallButton(isDisabled ? t("background.show") : t("background.hide"));
    toggleButton.disabled = !isDisabled && enabled.length <= 1;
    toggleButton.addEventListener("click", async () => {
      const next = new Set(appState.settings.disabledBackgrounds);
      if (next.has(image.id)) {
        next.delete(image.id);
      } else {
        next.add(image.id);
      }
      appState.settings.disabledBackgrounds = [...next];
      await persistSettings();
      await applyBackground();
      render();
    });
    actions.append(toggleButton);

    if (image.type === "custom") {
      const deleteButton = smallButton(t("common.delete"));
      deleteButton.addEventListener("click", async () => {
        appState.customImages = appState.customImages.filter((custom) => custom.id !== image.id);
        appState.settings.disabledBackgrounds = appState.settings.disabledBackgrounds.filter((id) => id !== image.id);
        if (appState.settings.fixedBackgroundId === image.id) {
          appState.settings.fixedBackgroundId = null;
          appState.settings.backgroundMode = "random";
        }
        await saveCustomImages(appState.customImages);
        await persistSettings();
        await applyBackground();
        render();
      });
      actions.append(deleteButton);
    }

    copy.append(name, meta, actions);
    item.append(preview, copy);
    elements.backgroundList.append(item);
  }
}

function renderShortcutList() {
  clearNode(elements.shortcutList);

  if (!appState.shortcuts.length) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = t("websites.empty");
    elements.shortcutList.append(note);
    return;
  }

  for (const shortcut of appState.shortcuts) {
    const item = document.createElement("form");
    item.className = "shortcut-item";

    const iconEditor = createIconEditor({
      label: t("common.icon"),
      title: shortcut.name,
      domain: getDomain(shortcut.url),
      icon: shortcut.icon,
      onRemove: async () => {
        appState.shortcuts = appState.shortcuts.map((itemShortcut) => (
          itemShortcut.id === shortcut.id ? { ...itemShortcut, icon: null } : itemShortcut
        ));
        await saveShortcuts(appState.shortcuts);
        render();
        showToast(t("toast.iconRemoved"));
      }
    });

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = shortcut.name;
    nameInput.maxLength = 36;
    nameInput.ariaLabel = t("common.name");

    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.value = shortcut.url;
    urlInput.ariaLabel = "URL";

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const saveButton = smallButton(t("common.save"));
    saveButton.type = "submit";

    const deleteButton = iconButton("trash", t("common.delete"));
    deleteButton.addEventListener("click", async () => {
      appState.shortcuts = appState.shortcuts.filter((itemShortcut) => itemShortcut.id !== shortcut.id);
      await saveShortcuts(appState.shortcuts);
      render();
      showToast(t("toast.shortcutDeleted"));
    });

    item.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const url = normalizeWebUrl(urlInput.value);
        const name = nameInput.value.trim();
        if (!name) {
          showToast(t("toast.nameMissing"));
          return;
        }
        const iconFile = iconEditor.input.files[0];
        const icon = iconFile ? await importShortcutIcon(iconFile) : shortcut.icon;
        appState.shortcuts = appState.shortcuts.map((itemShortcut) => (
          itemShortcut.id === shortcut.id
            ? { ...itemShortcut, name: name.slice(0, 64), url, icon }
            : itemShortcut
        ));
        await saveShortcuts(appState.shortcuts);
        render();
        showToast(t("toast.shortcutUpdated"));
      } catch (error) {
        console.warn(error);
        showToast(t("toast.invalidUrl"));
      }
    });

    actions.append(saveButton, deleteButton);
    item.append(iconEditor.element, nameInput, urlInput, actions);
    elements.shortcutList.append(item);
  }
}

function renderDefaultTileIconList() {
  clearNode(elements.defaultTileIconList);
  const overrides = appState.settings.tileIconOverrides || {};

  for (const tile of DEFAULT_TILES) {
    const item = document.createElement("div");
    item.className = "icon-override-item";

    const iconEditor = createIconEditor({
      label: `${tile.title} Icon`,
      title: tile.title,
      domain: tile.domain,
      icon: getTileIcon(tile),
      onRemove: overrides[tile.id]
        ? async () => {
            const next = { ...appState.settings.tileIconOverrides };
            delete next[tile.id];
            appState.settings.tileIconOverrides = next;
            await persistSettings();
            render();
            showToast(t("toast.iconRestored"));
          }
        : null
    });

    iconEditor.input.addEventListener("change", async () => {
      const file = iconEditor.input.files[0];
      if (!file) {
        return;
      }
      try {
        const icon = await importShortcutIcon(file);
        appState.settings.tileIconOverrides = {
          ...(appState.settings.tileIconOverrides || {}),
          [tile.id]: icon
        };
        await persistSettings();
        render();
        showToast(t("toast.iconSaved"));
      } catch (error) {
        console.warn(error);
        showToast(t("toast.iconError"));
      }
    });

    const copy = document.createElement("div");
    copy.className = "item-copy";

    const name = document.createElement("strong");
    name.textContent = tile.title;

    const domain = document.createElement("span");
    domain.textContent = tile.domain;

    copy.append(name, domain);
    item.append(iconEditor.element, copy);
    elements.defaultTileIconList.append(item);
  }
}

function createTile(item) {
  const tile = document.createElement("article");
  tile.className = "site-tile";

  const link = document.createElement("a");
  link.href = item.url;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    location.assign(item.url);
  });

  const iconWrap = document.createElement("span");
  iconWrap.className = "tile-icon";

  if (isDisplayableIcon(item.icon)) {
    appendImageWithFallback(iconWrap, item.icon, item.title || item.domain);
  } else if (item.favicon && item.favicon.startsWith("data:image/")) {
    appendImageWithFallback(iconWrap, item.favicon, item.title || item.domain);
  } else {
    const initial = document.createElement("span");
    initial.textContent = initialFor(item.title || item.domain);
    iconWrap.append(initial);
  }

  const copy = document.createElement("span");
  copy.className = "tile-copy";

  const title = document.createElement("span");
  title.className = "tile-title";
  title.textContent = item.title || item.domain || t("tiles.website");

  const domain = document.createElement("span");
  domain.className = "tile-domain";
  domain.textContent = item.domain || getDomain(item.url);

  copy.append(title, domain);
  link.append(iconWrap, copy);

  const pinButton = document.createElement("button");
  pinButton.className = "tile-pin";
  pinButton.type = "button";
  pinButton.title = isPinned(item.url) ? t("tiles.unpin") : t("tiles.pin");
  pinButton.ariaLabel = pinButton.title;
  pinButton.classList.toggle("active", isPinned(item.url));
  pinButton.append(createIcon("pin"));
  pinButton.addEventListener("click", async () => togglePin(item));

  tile.append(link, pinButton);
  return tile;
}

async function togglePin(item) {
  const key = pinKeyForUrl(item.url);
  const existing = appState.pins.find((pin) => pinKeyForUrl(pin.url) === key);
  if (existing) {
    appState.pins = appState.pins.filter((pin) => pinKeyForUrl(pin.url) !== key);
    await savePins(appState.pins);
    render();
    showToast(t("toast.unpinned"));
    return;
  }

  appState.pins = [
    ...appState.pins,
    {
      id: createId("pin"),
      tileId: item.source === "default" ? item.id : null,
      title: item.title || item.name || getDomain(item.url),
      url: item.url,
      domain: item.domain || getDomain(item.url),
      icon: isDisplayableIcon(item.icon) ? item.icon : null,
      favicon: item.favicon && item.favicon.startsWith("data:image/") ? item.favicon : null,
      source: item.source || "custom",
      pinnedAt: Date.now()
    }
  ];
  await savePins(appState.pins);
  render();
  showToast(t("toast.pinned"));
}

function isPinned(url) {
  const key = pinKeyForUrl(url);
  return appState.pins.some((pin) => pinKeyForUrl(pin.url) === key);
}

function openSettings() {
  lastFocusedElement = document.activeElement;
  elements.settingsPanel.classList.remove("settings-prewarm");
  if (cancelPerformanceSensitiveImageLoads()) {
    resumeOnlineLoadsAfterSettings = true;
  }
  elements.settingsPanel.setAttribute("aria-hidden", "false");
  elements.settingsPanel.inert = false;
  elements.body.classList.add("panel-open");
  const activeNavItem = elements.settingsNavItems.find((item) => item.classList.contains("active"));
  (activeNavItem || elements.closeSettingsButton).focus();
}

function scheduleSettingsPrewarm() {
  const prewarm = () => {
    if (elements.body.classList.contains("panel-open")) {
      return;
    }
    elements.settingsPanel.classList.add("settings-prewarm");
    void elements.settingsPanel.offsetWidth;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(() => elements.settingsPanel.classList.remove("settings-prewarm"), 80);
      });
    });
  };
  requestAnimationFrame(() => window.setTimeout(prewarm, 0));
}

function closeSettings() {
  if (!elements.body.classList.contains("panel-open")) {
    return;
  }
  elements.body.classList.remove("panel-open");
  elements.settingsPanel.setAttribute("aria-hidden", "true");
  elements.settingsPanel.inert = true;
  if (lastFocusedElement instanceof HTMLElement) {
    lastFocusedElement.focus();
  }
  if (resumeOnlineLoadsAfterSettings) {
    resumeOnlineLoadsAfterSettings = false;
    window.setTimeout(() => applyBackground(), 220);
  }
}

function activateSettingsPage(pageName) {
  let activeButton = null;
  for (const button of elements.settingsNavItems) {
    const active = button.dataset.settingsTab === pageName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    if (active) {
      activeButton = button;
    }
  }
  for (const page of elements.settingsPages) {
    const active = page.dataset.settingsPage === pageName;
    page.classList.toggle("active", active);
    page.hidden = !active;
  }
  renderSettingsPage(pageName);
  elements.settingsPanel.querySelector(".settings-content").scrollTop = 0;
  if (activeButton && elements.settingsPanel.clientWidth <= 760) {
    requestAnimationFrame(() => activeButton.scrollIntoView({ block: "nearest", inline: "center" }));
  }
}

function trapSettingsFocus(event) {
  const focusable = [...elements.settingsPanel.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), [href]")]
    .filter((element) => !element.closest("[hidden]") && element.getClientRects().length);
  if (!focusable.length) {
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function persistSettings() {
  applySettingsToPage();
  await saveSettings(appState.settings);
}

function getSearchProviders() {
  if (!Array.isArray(appState.settings.searchProviders) || !appState.settings.searchProviders.length) {
    appState.settings.searchProviders = DEFAULT_SEARCH_PROVIDERS;
  }
  appState.settings.searchProviders = appState.settings.searchProviders.slice(0, 3);
  return appState.settings.searchProviders;
}

function getActiveSearchProvider() {
  const providers = getSearchProviders();
  const active = providers.find((provider) => provider.id === appState.settings.searchProviderId) || providers[0];
  if (active && appState.settings.searchProviderId !== active.id) {
    appState.settings.searchProviderId = active.id;
  }
  return active || DEFAULT_SEARCH_PROVIDERS[0];
}

function getTileIcon(tile) {
  const override = appState.settings.tileIconOverrides?.[tile.id];
  return isDisplayableIcon(override) ? override : tile.icon;
}

function isDisplayableIcon(value) {
  return typeof value === "string" && (value.startsWith("icons/") || value.startsWith("data:image/"));
}

function buildSearchUrl(provider, query) {
  const template = provider?.url || DEFAULT_SEARCH_PROVIDERS[0].url;
  const encodedQuery = encodeURIComponent(query);
  if (template.includes("{query}")) {
    return template.replaceAll("{query}", encodedQuery);
  }
  const url = new URL(normalizeWebUrl(template));
  url.searchParams.set("q", query);
  return url.href;
}

function normalizeSearchTemplate(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("Such-URL fehlt.");
  }

  const marker = "BENNI_QUERY_PLACEHOLDER";
  const marked = trimmed.replaceAll("{query}", marker);
  let normalized = normalizeWebUrl(marked)
    .replaceAll(encodeURIComponent(marker), "{query}")
    .replaceAll(marker, "{query}");

  if (!normalized.includes("{query}")) {
    const url = new URL(normalized);
    url.searchParams.set("q", "{query}");
    normalized = url.href.replaceAll("%7Bquery%7D", "{query}");
  }

  return normalized;
}

async function importShortcutIcon(file) {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("Diese Datei ist kein Bild.");
  }
  const dataUrl = await fileToDataUrl(file);
  return resizeIconDataUrl(dataUrl);
}

function createIconEditor({ label, title, domain, icon, onRemove }) {
  const element = document.createElement("div");
  element.className = "icon-editor";

  const preview = document.createElement("span");
  preview.className = "tile-icon icon-editor-preview";
  appendIconContent(preview, { icon, title, domain });

  const controls = document.createElement("div");
  controls.className = "icon-editor-controls";

  const uploadLabel = document.createElement("label");
  uploadLabel.className = "file-button icon-file-button";
  uploadLabel.append(createIcon("image"));

  const uploadText = document.createElement("span");
  uploadText.textContent = t("common.icon");
  uploadLabel.append(uploadText);

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.ariaLabel = label;
  uploadLabel.append(input);

  controls.append(uploadLabel);

  if (onRemove) {
    const removeButton = smallButton(t("common.restore"));
    removeButton.addEventListener("click", onRemove);
    controls.append(removeButton);
  }

  element.append(preview, controls);
  return { element, input };
}

function createIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

function smallButton(label) {
  const button = document.createElement("button");
  button.className = "compact-button";
  button.type = "button";
  button.textContent = label;
  return button;
}

function iconButton(iconName, label) {
  const button = document.createElement("button");
  button.className = "compact-button";
  button.type = "button";
  button.ariaLabel = label;
  button.title = label;
  button.append(createIcon(iconName));
  return button;
}

function appendIconContent(container, item) {
  clearNode(container);
  if (isDisplayableIcon(item.icon)) {
    appendImageWithFallback(container, item.icon, item.title || item.domain);
    return;
  }
  if (item.favicon && item.favicon.startsWith("data:image/")) {
    appendImageWithFallback(container, item.favicon, item.title || item.domain);
    return;
  }
  const initial = document.createElement("span");
  initial.textContent = initialFor(item.title || item.domain);
  container.append(initial);
}

function appendImageWithFallback(container, src, label) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.addEventListener("error", () => {
    clearNode(container);
    const initial = document.createElement("span");
    initial.textContent = initialFor(label);
    container.append(initial);
  }, { once: true });
  container.append(img);
}

function initialFor(value) {
  const cleaned = String(value || "").trim();
  return (cleaned[0] || "?").toUpperCase();
}

function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function showBackground(src, { immediate = false } = {}) {
  if (activeBackgroundLayer.style.backgroundImage.includes(src)) {
    activeBackgroundLayer.classList.add("loaded");
    return;
  }

  if (immediate || !activeBackgroundLayer.classList.contains("loaded")) {
    setElementBackground(activeBackgroundLayer, src);
    activeBackgroundLayer.classList.add("loaded");
    return;
  }

  const previousLayer = activeBackgroundLayer;
  const incomingLayer = standbyBackgroundLayer;
  setElementBackground(incomingLayer, src);
  incomingLayer.classList.remove("loaded");
  requestAnimationFrame(() => {
    incomingLayer.classList.add("loaded");
    previousLayer.classList.remove("loaded");
  });
  activeBackgroundLayer = incomingLayer;
  standbyBackgroundLayer = previousLayer;
  window.setTimeout(() => {
    if (previousLayer !== activeBackgroundLayer) {
      previousLayer.style.backgroundImage = "none";
    }
  }, 520);
}

function waitForImage(src, timeoutMs = 0, { cancelOnSettings = false } = {}) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let timeoutId = null;
    const settle = (callback) => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      cancelableImageLoads.delete(image);
      callback();
    };
    image.decoding = "async";
    image.addEventListener("load", () => settle(resolve), { once: true });
    image.addEventListener("error", () => settle(() => reject(new Error("Image failed to load."))), { once: true });
    if (timeoutMs > 0) {
      timeoutId = window.setTimeout(() => settle(() => reject(new Error("Image load timed out."))), timeoutMs);
    }
    if (cancelOnSettings) {
      cancelableImageLoads.set(image, () => {
        image.src = "";
        settle(() => reject(new Error("Image load paused for settings.")));
      });
    }
    image.src = src;
  });
}

function cancelPerformanceSensitiveImageLoads() {
  const pending = [...cancelableImageLoads.values()];
  for (const cancel of pending) {
    cancel();
  }
  return pending.length > 0;
}

function delay(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function prepareBackgroundSeeds() {
  if (appState.settings.backgroundSource === "local" || appState.settings.backgroundMode !== "random") {
    onlineBackgroundSeed = createRefreshSeed();
    nextOnlineBackgroundSeed = createRefreshSeed();
    return;
  }
  onlineBackgroundSeed = localStorage.getItem(NEXT_BACKGROUND_SEED_KEY) || createRefreshSeed();
  onlineBackgroundWasPreloaded = localStorage.getItem(PRELOADED_BACKGROUND_SEED_KEY) === onlineBackgroundSeed;
  localStorage.removeItem(PRELOADED_BACKGROUND_SEED_KEY);
  nextOnlineBackgroundSeed = createRefreshSeed();
  localStorage.setItem(NEXT_BACKGROUND_SEED_KEY, nextOnlineBackgroundSeed);
}

function rotateBackgroundSeeds() {
  onlineBackgroundSeed = createRefreshSeed();
  onlineBackgroundWasPreloaded = false;
  nextOnlineBackgroundSeed = createRefreshSeed();
  localStorage.removeItem(PRELOADED_BACKGROUND_SEED_KEY);
  localStorage.setItem(NEXT_BACKGROUND_SEED_KEY, nextOnlineBackgroundSeed);
}

function scheduleNextBackgroundPreload() {
  if (!appState.settings.preloadOnlineImages || appState.settings.backgroundSource === "local" || appState.settings.backgroundMode !== "random") {
    return;
  }
  const preloadSeed = nextOnlineBackgroundSeed || createRefreshSeed();
  const nextBackground = createOnlineBackground(getOnlineBackgroundSettings(), preloadSeed);
  if (!nextBackground) {
    return;
  }
  const preload = () => waitForImage(nextBackground.src, 12000, { cancelOnSettings: true })
    .then(() => localStorage.setItem(PRELOADED_BACKGROUND_SEED_KEY, preloadSeed))
    .catch(() => null);
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preload, { timeout: 1800 });
  } else {
    window.setTimeout(preload, 700);
  }
}

function createRefreshSeed() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOnlineBackgroundSettings() {
  const width = Math.min(1920, Math.max(1280, Math.ceil(window.innerWidth / 160) * 160));
  const height = Math.min(1200, Math.max(800, Math.ceil(window.innerHeight / 100) * 100));
  return { ...appState.settings, imageWidth: width, imageHeight: height };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("Datei konnte nicht gelesen werden.")));
    reader.readAsDataURL(file);
  });
}

function resizeIconDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, size, size);

      const ratio = Math.min(size / image.naturalWidth, size / image.naturalHeight);
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const left = Math.round((size - width) / 2);
      const top = Math.round((size - height) / 2);
      context.imageSmoothingQuality = "high";
      context.drawImage(image, left, top, width, height);
      resolve(canvas.toDataURL("image/png"));
    });
    image.addEventListener("error", () => reject(new Error("Icon konnte nicht verarbeitet werden.")));
    image.src = dataUrl;
  });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 3200);
}
