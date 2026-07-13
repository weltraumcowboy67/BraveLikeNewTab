import {
  createId,
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
  getAllBackgrounds,
  getEnabledBackgrounds,
  importImageFile,
  importImageUrl,
  selectBackground,
  setElementBackground
} from "./backgrounds.js";

const DEFAULT_TILES = [
  { id: "default-youtube", title: "YouTube", url: "https://www.youtube.com/", icon: "icons/shortcuts/youtube.svg" }
].map((item) => ({ ...item, domain: getDomain(item.url), source: "default" }));

const elements = {
  root: document.documentElement,
  body: document.body,
  backgroundLayer: document.querySelector("#backgroundLayer"),
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
  focusModeToggle: document.querySelector("#focusModeToggle"),
  defaultTilesToggle: document.querySelector("#defaultTilesToggle"),
  searchProviderForm: document.querySelector("#searchProviderForm"),
  providerLabelInput: document.querySelector("#providerLabelInput"),
  providerUrlInput: document.querySelector("#providerUrlInput"),
  searchProviderList: document.querySelector("#searchProviderList"),
  backgroundModeSelect: document.querySelector("#backgroundModeSelect"),
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

init().catch((error) => {
  console.error(error);
  showToast("Die Startseite konnte nicht vollstaendig geladen werden.");
});

async function init() {
  appState = { ...appState, ...(await loadState()) };
  applySettingsToPage();
  bindEvents();
  updateClock();
  setInterval(updateClock, 1000);
  await applyBackground();
  render();
}

function bindEvents() {
  elements.settingsButton.addEventListener("click", openSettings);
  elements.closeSettingsButton.addEventListener("click", closeSettings);
  elements.panelBackdrop.addEventListener("click", closeSettings);

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

  elements.searchProviderForm.addEventListener("submit", handleSearchProviderSubmit);

  elements.backgroundModeSelect.addEventListener("change", async () => {
    appState.settings.backgroundMode = elements.backgroundModeSelect.value;
    if (appState.settings.backgroundMode === "fixed" && !appState.settings.fixedBackgroundId) {
      const current = selectBackground(appState.customImages, appState.settings);
      appState.settings.fixedBackgroundId = current?.id || BUILTIN_BACKGROUNDS[0].id;
    }
    await persistSettings();
    await applyBackground();
    renderBackgroundList();
  });

  elements.imageFileInput.addEventListener("change", handleImageFiles);
  elements.imageUrlForm.addEventListener("submit", handleImageUrlSubmit);
  elements.shortcutForm.addEventListener("submit", handleShortcutSubmit);
  elements.resetButton.addEventListener("click", handleReset);

  document.addEventListener("keydown", (event) => {
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
  elements.clock.textContent = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);
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
    showToast("Maximal drei Suchbuttons.");
    return;
  }

  const label = elements.providerLabelInput.value.trim();
  const rawUrl = elements.providerUrlInput.value.trim();
  if (!label || !rawUrl) {
    showToast("Name und Such-URL fehlen.");
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
    showToast("Suchbutton gespeichert.");
  } catch (error) {
    showToast(error.message || "Such-URL ist ungueltig.");
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
    showToast(imported.length === 1 ? "Bild gespeichert." : `${imported.length} Bilder gespeichert.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Bild konnte nicht gespeichert werden.");
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
    showToast("Bild-URL lokal gespeichert.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Bild-URL konnte nicht importiert werden.");
  }
}

async function handleShortcutSubmit(event) {
  event.preventDefault();
  const name = elements.shortcutNameInput.value.trim();
  const rawUrl = elements.shortcutUrlInput.value.trim();
  if (!name || !rawUrl) {
    showToast("Name und URL fehlen.");
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
    showToast("Shortcut gespeichert.");
  } catch (error) {
    showToast(error.message || "URL ist ungueltig.");
  }
}

async function handleReset() {
  const confirmed = confirm("Alle lokalen Einstellungen, Bilder, Shortcuts und Pins dieser Extension loeschen?");
  if (!confirmed) {
    return;
  }
  await resetAllData();
  location.reload();
}

async function applyBackground() {
  const selected = selectBackground(appState.customImages, appState.settings);
  if (!selected) {
    return;
  }
  elements.backgroundLayer.classList.remove("loaded");
  setElementBackground(elements.backgroundLayer, selected.src);
  await waitForImage(selected.src).catch(() => null);
  elements.backgroundLayer.classList.add("loaded");
}

function applySettingsToPage() {
  elements.root.dataset.theme = appState.settings.theme;
  elements.body.classList.toggle("focus-mode", appState.settings.focusMode);
  elements.themeSelect.value = appState.settings.theme;
  elements.focusModeToggle.checked = appState.settings.focusMode;
  elements.defaultTilesToggle.checked = appState.settings.showDefaultTiles;
  elements.backgroundModeSelect.value = appState.settings.backgroundMode;
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
  renderBackgroundList();
  renderSearchProviderList();
  renderShortcutList();
  renderDefaultTileIconList();
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
    labelInput.ariaLabel = "Suchbutton-Name";

    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.value = provider.url;
    urlInput.ariaLabel = "Such-URL";

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const saveButton = smallButton("Speichern");
    saveButton.type = "submit";

    const deleteButton = iconButton("trash", "Suchbutton loeschen");
    deleteButton.disabled = providers.length <= 1;
    deleteButton.addEventListener("click", async () => {
      appState.settings.searchProviders = appState.settings.searchProviders.filter((itemProvider) => itemProvider.id !== provider.id);
      if (appState.settings.searchProviderId === provider.id) {
        appState.settings.searchProviderId = appState.settings.searchProviders[0]?.id || DEFAULT_SEARCH_PROVIDERS[0].id;
      }
      await persistSettings();
      render();
      showToast("Suchbutton geloescht.");
    });

    item.addEventListener("submit", async (event) => {
      event.preventDefault();
      const label = labelInput.value.trim();
      if (!label) {
        showToast("Name fehlt.");
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
        showToast("Suchbutton aktualisiert.");
      } catch (error) {
        showToast(error.message || "Such-URL ist ungueltig.");
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

    const preview = document.createElement("div");
    preview.className = "background-preview";
    setElementBackground(preview, image.src);

    const copy = document.createElement("div");
    copy.className = "item-copy";

    const name = document.createElement("strong");
    name.textContent = image.name;

    const meta = document.createElement("span");
    meta.textContent = image.type === "builtin" ? "Lokal gebuendelt" : "Lokal gespeichert";

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const fixedButton = smallButton(appState.settings.fixedBackgroundId === image.id ? "Festgelegt" : "Festlegen");
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
    const toggleButton = smallButton(isDisabled ? "Einblenden" : "Ausblenden");
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
      const deleteButton = smallButton("Loeschen");
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
    note.textContent = "Noch keine eigenen Shortcuts gespeichert.";
    elements.shortcutList.append(note);
    return;
  }

  for (const shortcut of appState.shortcuts) {
    const item = document.createElement("form");
    item.className = "shortcut-item";

    const iconEditor = createIconEditor({
      label: "Shortcut-Icon",
      title: shortcut.name,
      domain: getDomain(shortcut.url),
      icon: shortcut.icon,
      onRemove: async () => {
        appState.shortcuts = appState.shortcuts.map((itemShortcut) => (
          itemShortcut.id === shortcut.id ? { ...itemShortcut, icon: null } : itemShortcut
        ));
        await saveShortcuts(appState.shortcuts);
        render();
        showToast("Icon entfernt.");
      }
    });

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = shortcut.name;
    nameInput.maxLength = 36;
    nameInput.ariaLabel = "Shortcut-Name";

    const urlInput = document.createElement("input");
    urlInput.type = "text";
    urlInput.value = shortcut.url;
    urlInput.ariaLabel = "Shortcut-URL";

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const saveButton = smallButton("Speichern");
    saveButton.type = "submit";

    const deleteButton = iconButton("trash", "Shortcut loeschen");
    deleteButton.addEventListener("click", async () => {
      appState.shortcuts = appState.shortcuts.filter((itemShortcut) => itemShortcut.id !== shortcut.id);
      await saveShortcuts(appState.shortcuts);
      render();
      showToast("Shortcut geloescht.");
    });

    item.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const url = normalizeWebUrl(urlInput.value);
        const name = nameInput.value.trim();
        if (!name) {
          showToast("Name fehlt.");
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
        showToast("Shortcut aktualisiert.");
      } catch (error) {
        showToast(error.message || "URL ist ungueltig.");
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
            showToast("Standard-Icon wiederhergestellt.");
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
        showToast("Icon gespeichert.");
      } catch (error) {
        showToast(error.message || "Icon konnte nicht gespeichert werden.");
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
    const img = document.createElement("img");
    img.src = item.icon;
    img.alt = "";
    iconWrap.append(img);
  } else if (item.favicon && item.favicon.startsWith("data:image/")) {
    const img = document.createElement("img");
    img.src = item.favicon;
    img.alt = "";
    iconWrap.append(img);
  } else {
    const initial = document.createElement("span");
    initial.textContent = initialFor(item.title || item.domain);
    iconWrap.append(initial);
  }

  const copy = document.createElement("span");
  copy.className = "tile-copy";

  const title = document.createElement("span");
  title.className = "tile-title";
  title.textContent = item.title || item.domain || "Website";

  const domain = document.createElement("span");
  domain.className = "tile-domain";
  domain.textContent = item.domain || getDomain(item.url);

  copy.append(title, domain);
  link.append(iconWrap, copy);

  const pinButton = document.createElement("button");
  pinButton.className = "tile-pin";
  pinButton.type = "button";
  pinButton.title = isPinned(item.url) ? "Pin loesen" : "Anpinnen";
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
    showToast("Pin geloest.");
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
  showToast("Angepinnt.");
}

function isPinned(url) {
  const key = pinKeyForUrl(url);
  return appState.pins.some((pin) => pinKeyForUrl(pin.url) === key);
}

function openSettings() {
  elements.panelBackdrop.hidden = false;
  elements.settingsPanel.setAttribute("aria-hidden", "false");
  elements.body.classList.add("panel-open");
  elements.closeSettingsButton.focus();
}

function closeSettings() {
  elements.body.classList.remove("panel-open");
  elements.settingsPanel.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    if (!elements.body.classList.contains("panel-open")) {
      elements.panelBackdrop.hidden = true;
    }
  }, 260);
  elements.settingsButton.focus();
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
  uploadText.textContent = "Icon";
  uploadLabel.append(uploadText);

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.ariaLabel = label;
  uploadLabel.append(input);

  controls.append(uploadLabel);

  if (onRemove) {
    const removeButton = smallButton("Zurueck");
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
    const img = document.createElement("img");
    img.src = item.icon;
    img.alt = "";
    container.append(img);
    return;
  }
  if (item.favicon && item.favicon.startsWith("data:image/")) {
    const img = document.createElement("img");
    img.src = item.favicon;
    img.alt = "";
    container.append(img);
    return;
  }
  const initial = document.createElement("span");
  initial.textContent = initialFor(item.title || item.domain);
  container.append(initial);
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

function waitForImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", resolve);
    image.addEventListener("error", reject);
    image.src = src;
  });
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
