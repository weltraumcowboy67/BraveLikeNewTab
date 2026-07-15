import { createId, extensionApi, normalizeWebUrl } from "./storage.js";

export const BUILTIN_BACKGROUNDS = [
  {
    id: "builtin-misty-lake",
    name: "Nebel am See",
    nameKey: "background.mistyLake",
    src: runtimeUrl("backgrounds/misty-lake.png"),
    type: "builtin"
  },
  {
    id: "builtin-canyon-dusk",
    name: "Canyonlicht",
    nameKey: "background.canyonDusk",
    src: runtimeUrl("backgrounds/canyon-dusk.png"),
    type: "builtin"
  },
  {
    id: "builtin-basalt-coast",
    name: "Basaltkueste",
    nameKey: "background.basaltCoast",
    src: runtimeUrl("backgrounds/basalt-coast.png"),
    type: "builtin"
  },
  {
    id: "builtin-forest-meadow",
    name: "Waldlichtung",
    nameKey: "background.forestMeadow",
    src: runtimeUrl("backgrounds/forest-meadow.png"),
    type: "builtin"
  }
];

const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 1200;
const JPEG_QUALITY = 0.88;
const PICSUM_CATEGORY_IDS = {
  nature: [10, 11, 13, 15, 16, 17, 18, 19, 25, 27, 28, 29, 33, 37, 44, 54, 62, 66, 67, 69, 70, 71, 74, 79, 81, 83, 85, 89, 93, 94, 95],
  architecture: [32, 42, 43, 47, 49, 57, 58, 61, 68, 76, 77, 78, 84, 88, 99],
  technology: [0, 1, 2, 3, 4, 5, 6, 8, 9, 20, 26, 36, 45, 48, 60, 96],
  people: [1, 3, 4, 5, 22, 31, 64, 65, 73, 91],
  minimal: [12, 14, 21, 23, 24, 38, 39, 41, 50, 51, 53, 56, 63, 80, 87, 92]
};

export function getAllBackgrounds(customImages = []) {
  return [...BUILTIN_BACKGROUNDS, ...customImages.map((image) => ({ ...image, type: "custom" }))];
}

export function getEnabledBackgrounds(customImages, settings) {
  const disabled = new Set(settings.disabledBackgrounds || []);
  const enabled = getAllBackgrounds(customImages).filter((image) => !disabled.has(image.id));
  return enabled.length ? enabled : getAllBackgrounds(customImages);
}

export function selectBackground(customImages, settings) {
  const backgrounds = getEnabledBackgrounds(customImages, settings);
  if (!backgrounds.length) {
    return null;
  }

  if (settings.backgroundMode === "fixed" && settings.fixedBackgroundId) {
    const fixed = backgrounds.find((image) => image.id === settings.fixedBackgroundId);
    if (fixed) {
      return fixed;
    }
  }

  if (settings.backgroundMode === "daily") {
    const today = new Date().toISOString().slice(0, 10);
    const index = stableIndex(`${today}:${backgrounds.map((item) => item.id).join("|")}`, backgrounds.length);
    return backgrounds[index];
  }

  return backgrounds[randomIndex(backgrounds.length)];
}

export function createOnlineBackground(settings, refreshSeed = "") {
  if (settings.backgroundSource === "local" || settings.backgroundMode === "fixed") {
    return null;
  }

  const seed = settings.backgroundMode === "daily"
    ? new Date().toISOString().slice(0, 10)
    : refreshSeed || createRandomSeed();
  const width = clampDimension(settings.imageWidth, 1280, 1920, 1920);
  const height = clampDimension(settings.imageHeight, 800, 1200, 1200);

  if (settings.backgroundSource === "picsum") {
    const categoryIds = PICSUM_CATEGORY_IDS[settings.imageApiCategory];
    const imageId = categoryIds?.[stableIndex(seed, categoryIds.length)];
    return {
      id: `picsum-${seed}`,
      name: "Picsum Photos",
      src: imageId === undefined
        ? `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}.webp`
        : `https://picsum.photos/id/${imageId}/${width}/${height}.webp`,
      type: "api"
    };
  }

  if (settings.backgroundSource === "custom" && settings.customImageApiUrl) {
    return {
      id: `custom-api-${seed}`,
      name: "Custom API",
      src: buildCustomImageUrl(settings.customImageApiUrl, seed, settings.imageApiCategory, width, height),
      type: "api"
    };
  }

  return null;
}

export function normalizeImageApiTemplate(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    throw new Error("Image API URL is missing.");
  }
  const marker = "IMAGE_API_PLACEHOLDER";
  const marked = trimmed
    .replaceAll("{width}", marker)
    .replaceAll("{height}", marker)
    .replaceAll("{seed}", marker)
    .replaceAll("{category}", marker);
  const parsed = new URL(marked);
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS image API URLs are allowed.");
  }
  return trimmed.slice(0, 2048);
}

export async function importImageFile(file) {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("Diese Datei ist kein Bild.");
  }
  const dataUrl = await blobToDataUrl(file);
  const src = await resizeDataUrl(dataUrl);
  return {
    id: createId("image"),
    name: cleanName(file.name || "Eigenes Bild"),
    src,
    createdAt: Date.now()
  };
}

export async function importImageUrl(input) {
  const url = normalizeWebUrl(input);
  await requestImageHostPermission(url);
  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Bild konnte nicht geladen werden (${response.status}).`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Die URL liefert kein Bild.");
  }
  const blob = await response.blob();
  if (!blob.type?.startsWith("image/") && !contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Die URL liefert kein Bild.");
  }
  const dataUrl = await blobToDataUrl(blob);
  const src = await resizeDataUrl(dataUrl);
  return {
    id: createId("image"),
    name: cleanName(nameFromUrl(url)),
    src,
    createdAt: Date.now()
  };
}

async function requestImageHostPermission(url) {
  const permissions = extensionApi?.permissions;
  if (!permissions?.contains || !permissions?.request) {
    return;
  }
  const parsed = new URL(url);
  const origin = `${parsed.protocol}//${parsed.host}/*`;
  const hasPermission = await permissions.contains({ origins: [origin] });
  if (hasPermission) {
    return;
  }
  const granted = await permissions.request({ origins: [origin] });
  if (!granted) {
    throw new Error("Permission to load this image was denied.");
  }
}

export function setElementBackground(element, src) {
  element.style.backgroundImage = `url("${String(src).replace(/"/g, '\\"')}")`;
}

function runtimeUrl(path) {
  return extensionApi?.runtime?.getURL ? extensionApi.runtime.getURL(path) : path;
}

function randomIndex(length) {
  if (crypto?.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % length;
  }
  return Math.floor(Math.random() * length);
}

function createRandomSeed() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildCustomImageUrl(template, seed, category, width, height) {
  const normalized = normalizeImageApiTemplate(template);
  return normalized
    .replaceAll("{width}", String(width))
    .replaceAll("{height}", String(height))
    .replaceAll("{seed}", encodeURIComponent(seed))
    .replaceAll("{category}", encodeURIComponent(category || "all"));
}

function clampDimension(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, Math.round(number))) : fallback;
}

function stableIndex(value, length) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("Bild konnte nicht gelesen werden.")));
    reader.readAsDataURL(blob);
  });
}

async function resizeDataUrl(dataUrl) {
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_IMAGE_WIDTH / image.naturalWidth, MAX_IMAGE_HEIGHT / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#0b1118";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Bild konnte nicht verarbeitet werden.")));
    image.src = src;
  });
}

function cleanName(value) {
  const withoutExtension = String(value || "Eigenes Bild").replace(/\.[a-z0-9]{2,5}$/i, "");
  return withoutExtension.trim().slice(0, 64) || "Eigenes Bild";
}

function nameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : parsed.hostname;
  } catch {
    return "Bild-URL";
  }
}
