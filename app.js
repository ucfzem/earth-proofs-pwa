"use strict";

const LANGS = ["ar", "en", "fr", "es"];
const LANG_KEY = "earth-proofs-lang";
const THEME_KEY = "earth-proofs-theme";
const IMAGE_CACHE = "earth-proofs-images-v1";
const DATA_URL = "./data.json";
const CATEGORY_ORDER = ["water", "horizon", "physics", "astronomy", "atmosphere", "geometry", "observation", "navigation", "space", "polar"];

const state = {
  lang: "ar",
  theme: "light",
  category: "all",
  query: "",
  proofs: [],
  filtered: [],
  modalId: null,
  modalList: [],
  modalIndex: -1,
  lastFocus: null,
  drawerOpen: false,
  drawerQuery: "",
  drawerLastFocus: null,
  download: { visible: false, messageKey: "", done: 0, total: 0, percent: 0 }
};

const els = {};
const tvMode = document.documentElement.classList.contains("tv-mode");

function tvFocusables(container) {
  const nodes = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(nodes).filter((node) => node.offsetParent !== null);
}

function tvCenter(el) {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function tvFindNext(current, key, list) {
  const from = tvCenter(current);
  let best = null;
  let bestScore = Infinity;
  list.forEach((el) => {
    if (el === current) return;
    const to = tvCenter(el);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    let primary = 0;
    let secondary = 0;
    if (key === "ArrowDown") {
      if (dy <= 8) return;
      primary = dy;
      secondary = Math.abs(dx);
    } else if (key === "ArrowUp") {
      if (dy >= -8) return;
      primary = -dy;
      secondary = Math.abs(dx);
    } else if (key === "ArrowRight") {
      if (dx <= 8) return;
      primary = dx;
      secondary = Math.abs(dy);
    } else if (key === "ArrowLeft") {
      if (dx >= -8) return;
      primary = -dx;
      secondary = Math.abs(dy);
    } else {
      return;
    }
    const score = primary + secondary * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  });
  return best;
}

function tvReveal(el) {
  try {
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  } catch (error) {
    el.scrollIntoView(false);
  }
}

function setupTvNavigation() {
  if (!tvMode) return;
  document.addEventListener("keydown", (event) => {
    const key = event.key;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(key) === -1) return;
    if (event.defaultPrevented) return;
    if (event.target && event.target.matches && event.target.matches("input, textarea, select, [contenteditable='true']")) return;
    if (state.modalId != null && (key === "ArrowLeft" || key === "ArrowRight")) return;
    const container = state.modalId != null ? els.proofModal : (state.drawerOpen ? els.proofsDrawer : document);
    if (!container) return;
    const list = tvFocusables(container);
    if (!list.length) return;
    const current = document.activeElement;
    if (!current || current === document.body || list.indexOf(current) === -1) {
      event.preventDefault();
      list[0].focus();
      tvReveal(list[0]);
      return;
    }
    const next = tvFindNext(current, key, list);
    if (!next) return;
    event.preventDefault();
    try { next.focus({ preventScroll: true }); } catch (error) { next.focus(); }
    tvReveal(next);
  });
}

function byId(id) {
  return document.getElementById(id);
}

function t(key) {
  const pack = translations[state.lang] || translations.en;
  return pack[key] != null ? pack[key] : (translations.en[key] != null ? translations.en[key] : key);
}

function tFormat(key, values) {
  let value = t(key);
  Object.keys(values || {}).forEach((name) => {
    value = value.replace(new RegExp("\\{" + name + "\\}", "g"), String(values[name]));
  });
  return value;
}

function categoryLabel(key) {
  const pack = translations[state.lang] || translations.en;
  return (pack.categories && pack.categories[key]) ||
    (translations.en.categories && translations.en.categories[key]) || key;
}

function renderLanguageSelector() {
  if (!els.langContainer) return;
  const fragment = document.createDocumentFragment();
  LANGS.forEach((key) => {
    const pack = translations[key] || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lang-btn" + (key === state.lang ? " active" : "");
    button.dataset.lang = key;
    button.setAttribute("aria-pressed", key === state.lang ? "true" : "false");
    const label = [pack.name, pack.initial ? "(" + pack.initial + ")" : ""].filter(Boolean).join(" ");
    button.setAttribute("aria-label", label);
    button.title = label;
    const flag = document.createElement("span");
    flag.className = "lang-flag";
    flag.setAttribute("aria-hidden", "true");
    flag.textContent = pack.flag || "";
    const initial = document.createElement("span");
    initial.className = "lang-initial";
    initial.textContent = pack.initial || key.toUpperCase();
    button.append(flag, initial);
    fragment.append(button);
  });
  els.langContainer.replaceChildren(fragment);
}

function animateLanguageChange() {
  const targets = [document.querySelector(".brand-title"), els.cardsGrid].filter(Boolean);
  targets.forEach((node) => {
    node.classList.remove("lang-animating");
    void node.offsetWidth;
    node.classList.add("lang-animating");
  });
}

function escapeHTML(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function normalize(value) {
  return String(value == null ? "" : value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, length) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? text.slice(0, length - 1).trimEnd() + "…" : text;
}

function getProof(id) {
  return state.proofs.find((proof) => proof.id === id) || null;
}

function getTranslation(proof) {
  const packs = proof.translations || {};
  return packs[state.lang] || packs.ar || packs.en || { title: "", content: "", scientific_note: "" };
}

function buildSearchText(proof) {
  const parts = [String(proof.id), proof.categoryKey || ""];
  LANGS.forEach((lang) => {
    const pack = translations[lang] || translations.en;
    const tr = (proof.translations && proof.translations[lang]) || {};
    if (pack.categories && pack.categories[proof.categoryKey]) parts.push(pack.categories[proof.categoryKey]);
    if (tr.title) parts.push(tr.title);
    if (tr.content) parts.push(tr.content);
    if (tr.scientific_note) parts.push(tr.scientific_note);
  });
  return normalize(parts.join(" "));
}

function iconForLanguageButton() {
  return state.theme === "dark" ? "☀️" : "🌙";
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  try { localStorage.setItem(THEME_KEY, state.theme); } catch (e) {}
  if (els.themeToggle) {
    els.themeToggle.textContent = iconForLanguageButton();
    els.themeToggle.setAttribute("aria-label", state.theme === "dark" ? t("themeLight") : t("themeDark"));
    els.themeToggle.setAttribute("title", state.theme === "dark" ? t("themeLight") : t("themeDark"));
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", state.theme === "dark" ? "#0e1116" : "#f7f4eb");
}

function applyLanguage(lang, persist) {
  const next = LANGS.indexOf(lang) !== -1 ? lang : "ar";
  state.lang = next;
  document.documentElement.lang = next;
  document.documentElement.dir = (translations[next] && translations[next].dir) || (next === "ar" ? "rtl" : "ltr");
  if (persist !== false) {
    try { localStorage.setItem(LANG_KEY, next); } catch (e) {}
  }
  renderLanguageSelector();
  applyTranslations();
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (key) node.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    if (key) node.setAttribute("placeholder", t(key));
  });

  if (els.langContainer) els.langContainer.setAttribute("aria-label", t("language"));
  if (els.searchInput) els.searchInput.setAttribute("aria-label", t("searchAria"));
  if (els.categoriesContainer) els.categoriesContainer.setAttribute("aria-label", t("categoryAria"));
  if (els.cardsGrid) els.cardsGrid.setAttribute("aria-label", t("resultsAria"));
  if (els.proofModal) els.proofModal.setAttribute("aria-label", t("modalAria"));
  if (els.hamburgerBtn) {
    els.hamburgerBtn.setAttribute("aria-label", t("indexButtonAria"));
    els.hamburgerBtn.setAttribute("title", t("indexButtonAria"));
  }
  if (els.proofsDrawer) els.proofsDrawer.setAttribute("aria-label", t("indexAria"));
  if (els.drawerSearchInput) els.drawerSearchInput.setAttribute("aria-label", t("indexSearchPlaceholder"));
  if (els.drawerClose) {
    els.drawerClose.setAttribute("aria-label", t("closeAria"));
    els.drawerClose.setAttribute("title", t("closeAria"));
  }
  if (els.modalClose) {
    els.modalClose.setAttribute("aria-label", t("closeAria"));
    els.modalClose.setAttribute("title", t("closeAria"));
  }
  if (els.clearSearchBtn) {
    els.clearSearchBtn.setAttribute("aria-label", t("clearSearch"));
    els.clearSearchBtn.setAttribute("title", t("clearSearch"));
  }
  if (els.emptyState && !els.emptyState.hidden) els.emptyState.textContent = t("noResults");

  updateConnection();
  applyTheme();
  renderCategories();
  filterProofs(false);
  refreshDownloadStatus();
  if (state.modalId != null) renderModal();
  if (state.drawerOpen) renderDrawerList(els.drawerSearchInput ? els.drawerSearchInput.value : "");
}

function updateConnection() {
  if (!els.connectionStatus) return;
  const online = navigator.onLine;
  els.connectionStatus.classList.toggle("online", online);
  els.connectionStatus.classList.toggle("offline", !online);
  const label = els.connectionStatus.querySelector("[data-i18n]") || els.connectionStatus.lastElementChild;
  if (label) label.textContent = online ? t("online") : t("offline");
  els.connectionStatus.setAttribute("title", online ? t("online") : t("offline"));
}

function updateResultsMeta() {
  if (els.resultsMeta) {
    els.resultsMeta.textContent = tFormat("resultsCount", { n: state.filtered.length });
  }
  if (els.clearSearchBtn) {
    els.clearSearchBtn.hidden = !state.query;
  }
}

function renderCategories() {
  if (!els.categoriesContainer) return;
  const counts = {};
  state.proofs.forEach((proof) => {
    counts[proof.categoryKey] = (counts[proof.categoryKey] || 0) + 1;
  });
  const items = [{ key: "all", label: t("allCategories") }].concat(
    CATEGORY_ORDER.map((key) => ({ key, label: categoryLabel(key) }))
  );

  els.categoriesContainer.innerHTML = items.map((item) => {
    const active = state.category === item.key;
    const count = item.key === "all" ? state.proofs.length : (counts[item.key] || 0);
    return '<button type="button" class="category-pill' + (active ? ' active' : '') + '" data-category="' + escapeHTML(item.key) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
      escapeHTML(item.label) + ' <span class="pill-count">' + count + '</span></button>';
  }).join("");
}

function renderCards() {
  if (!els.cardsGrid) return;
  const list = state.filtered;
  els.cardsGrid.innerHTML = list.map((proof) => {
    const tr = getTranslation(proof);
    const title = tr.title || ("#" + proof.id);
    const snippet = truncate(tr.content || tr.scientific_note || "", 150);
    return '<article class="proof-card" tabindex="0" role="button" data-id="' + proof.id + '" aria-label="' + escapeHTML(title + " — " + t("openProof")) + '">' +
      '<div class="card-image-wrapper">' +
        '<img src="' + escapeHTML(proof.image_url || "") + '" alt="' + escapeHTML(title) + '" loading="eager" decoding="async">' +
        '<span class="proof-badge">#' + proof.id + '</span>' +
        '<span class="category-tag">' + escapeHTML(categoryLabel(proof.categoryKey)) + '</span>' +
      '</div>' +
      '<div class="card-body">' +
        '<h3>' + escapeHTML(title) + '</h3>' +
        '<p>' + escapeHTML(snippet) + '</p>' +
        '<div class="card-footer"><span>' + escapeHTML(t("readMore")) + '</span><span class="arrow" aria-hidden="true">→</span></div>' +
      '</div>' +
    '</article>';
  }).join("");

  if (els.emptyState) els.emptyState.hidden = list.length !== 0;
}

function filterProofs(shouldScroll) {
  const query = normalize(state.query);
  state.filtered = state.proofs.filter((proof) => {
    if (state.category !== "all" && proof.categoryKey !== state.category) return false;
    if (query && !proof.searchText.includes(query)) return false;
    return true;
  });

  updateResultsMeta();
  renderCards();
  if (shouldScroll && els.cardsGrid) {
    els.cardsGrid.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function openModal(id, sourceList) {
  const base = Array.isArray(sourceList) ? sourceList : (state.filtered.length ? state.filtered : state.proofs);
  const list = base.some((proof) => proof.id === id) ? base : state.proofs;
  const index = list.findIndex((proof) => proof.id === id);
  if (index === -1) return;
  state.modalList = list.map((proof) => proof.id);
  state.modalIndex = index;
  state.modalId = id;
  state.lastFocus = document.activeElement;
  renderModal();
  if (els.proofModal) {
    els.proofModal.hidden = false;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      if (els.modalClose) els.modalClose.focus();
      else if (els.modalContentBox) els.modalContentBox.focus();
    });
  }
}

function renderModal() {
  if (state.modalId == null) return;
  const proof = getProof(state.modalId);
  if (!proof) {
    closeModal();
    return;
  }
  const tr = getTranslation(proof);
  if (els.modalKicker) {
    els.modalKicker.textContent = t("proofNumber") + " " + proof.id + " · " + categoryLabel(proof.categoryKey);
  }
  if (els.modalTitle) els.modalTitle.textContent = tr.title || "";
  if (els.modalContent) els.modalContent.textContent = tr.content || "";
  if (els.modalScientificNote) els.modalScientificNote.textContent = tr.scientific_note || "";
  if (els.modalImage) {
    els.modalImage.src = proof.image_url || "";
    els.modalImage.alt = (tr.title || "") + " — " + t("imageAlt");
  }
  if (els.modalCounter) {
    els.modalCounter.textContent = (state.modalIndex + 1) + " / " + state.modalList.length;
  }
  if (els.prevCardBtn) els.prevCardBtn.disabled = state.modalIndex <= 0;
  if (els.nextCardBtn) els.nextCardBtn.disabled = state.modalIndex >= state.modalList.length - 1;
}

function closeModal() {
  const modalId = state.modalId;
  if (els.proofModal) els.proofModal.hidden = true;
  document.body.style.overflow = "";
  state.modalId = null;
  state.modalIndex = -1;
  state.modalList = [];
  const card = modalId != null && els.cardsGrid
    ? els.cardsGrid.querySelector('[data-id="' + modalId + '"]')
    : null;
  const restore = card || state.lastFocus;
  if (restore && typeof restore.focus === "function") {
    restore.focus();
  }
  state.lastFocus = null;
}

function stepModal(direction) {
  if (state.modalIndex < 0) return;
  const nextIndex = state.modalIndex + direction;
  if (nextIndex < 0 || nextIndex >= state.modalList.length) return;
  state.modalIndex = nextIndex;
  state.modalId = state.modalList[nextIndex];
  renderModal();
}

function createDrawerItem(proof) {
  const tr = getTranslation(proof);
  const title = tr.title || ("#" + proof.id);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "drawer-item";
  button.dataset.id = String(proof.id);
  button.setAttribute("aria-label", "#" + proof.id + " — " + title);
  const number = document.createElement("span");
  number.className = "drawer-item-num";
  number.textContent = "#" + proof.id;
  const titleNode = document.createElement("span");
  titleNode.className = "drawer-item-title";
  titleNode.textContent = title;
  button.append(number, titleNode);
  return button;
}

function renderDrawerList(filter) {
  if (!els.drawerList) return;
  const query = normalize(filter == null ? state.drawerQuery : filter);
  const items = state.proofs.filter((proof) => {
    if (!query) return true;
    const tr = getTranslation(proof);
    const haystack = [String(proof.id), tr.title || "", categoryLabel(proof.categoryKey)].join(" ");
    return normalize(haystack).includes(query);
  });
  els.drawerList.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "drawer-empty";
    empty.textContent = t("indexNoResults");
    els.drawerList.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  items.forEach((proof) => fragment.append(createDrawerItem(proof)));
  els.drawerList.append(fragment);
}

function openDrawer() {
  if (!els.proofsDrawer || state.drawerOpen) return;
  state.drawerOpen = true;
  state.drawerQuery = "";
  state.drawerLastFocus = document.activeElement;
  if (els.drawerSearchInput) els.drawerSearchInput.value = "";
  els.proofsDrawer.hidden = false;
  if (els.hamburgerBtn) els.hamburgerBtn.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
  renderDrawerList("");
  requestAnimationFrame(() => {
    if (tvMode) {
      const first = els.drawerList ? els.drawerList.querySelector(".drawer-item") : null;
      if (first) {
        first.focus();
        return;
      }
    }
    if (els.drawerClose) els.drawerClose.focus();
  });
}

function closeDrawer(restoreFocus) {
  if (!els.proofsDrawer) return;
  els.proofsDrawer.hidden = true;
  state.drawerOpen = false;
  state.drawerQuery = "";
  if (els.drawerSearchInput) els.drawerSearchInput.value = "";
  if (els.hamburgerBtn) els.hamburgerBtn.setAttribute("aria-expanded", "false");
  if (state.modalId == null) document.body.style.overflow = "";
  if (restoreFocus !== false && state.drawerLastFocus && typeof state.drawerLastFocus.focus === "function") {
    state.drawerLastFocus.focus();
  }
  state.drawerLastFocus = null;
}

function trapFocus(event, container) {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(container.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
  )).filter((node) => node.offsetParent !== null);
  if (!focusable.length) return;
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

function setDownloadStatus(messageKey, done, total, percent) {
  state.download = {
    visible: true,
    messageKey,
    done: done || 0,
    total: total || 0,
    percent: typeof percent === "number" ? percent : 0
  };
  refreshDownloadStatus();
}

function refreshDownloadStatus() {
  if (!els.downloadStatus) return;
  const download = state.download;
  els.downloadStatus.hidden = !download.visible;
  if (!download.visible) return;
  if (els.downloadStatusText) {
    els.downloadStatusText.textContent = download.messageKey === "downloadProgress"
      ? tFormat("downloadProgress", { done: download.done, total: download.total })
      : t(download.messageKey);
  }
  if (els.downloadFill) els.downloadFill.style.width = Math.max(0, Math.min(100, download.percent)) + "%";
}

function hideDownloadStatusLater(delay) {
  window.setTimeout(() => {
    state.download.visible = false;
    refreshDownloadStatus();
  }, delay || 4500);
}

async function downloadImages() {
  if (!("caches" in window)) {
    setDownloadStatus("downloadFailed", 0, 0, 0);
    hideDownloadStatusLater();
    return;
  }
  const urls = Array.from(new Set(state.proofs.map((proof) => proof.image_url).filter(Boolean)));
  if (!urls.length) return;

  if (els.downloadImagesBtn) els.downloadImagesBtn.disabled = true;
  setDownloadStatus("downloading", 0, urls.length, 0);
  let done = 0;
  let failed = 0;
  let cache;
  try {
    cache = await caches.open(IMAGE_CACHE);
  } catch (error) {
    setDownloadStatus("downloadFailed", 0, urls.length, 0);
    if (els.downloadImagesBtn) els.downloadImagesBtn.disabled = false;
    hideDownloadStatusLater();
    return;
  }

  for (const url of urls) {
    try {
      const request = new Request(url, { cache: "no-cache" });
      const existing = await cache.match(request);
      if (existing) {
        done += 1;
      } else {
        const response = await fetch(request);
        if (!response || !response.ok) throw new Error("Image request failed");
        await cache.put(request, response.clone());
        done += 1;
      }
    } catch (error) {
      failed += 1;
    }
    setDownloadStatus("downloadProgress", done + failed, urls.length, Math.round(((done + failed) / urls.length) * 100));
  }

  if (els.downloadImagesBtn) els.downloadImagesBtn.disabled = false;
  if (failed) {
    setDownloadStatus("downloadFailed", done, urls.length, 100);
  } else {
    setDownloadStatus("downloadComplete", urls.length, urls.length, 100);
  }
  hideDownloadStatusLater(6000);
}

async function checkImageCache() {
  if (!("caches" in window) || !state.proofs.length) return;
  try {
    const cache = await caches.open(IMAGE_CACHE);
    const urls = Array.from(new Set(state.proofs.map((proof) => proof.image_url).filter(Boolean)));
    const matches = await Promise.all(urls.map((url) => cache.match(new Request(url))));
    if (matches.every(Boolean)) {
      setDownloadStatus("cacheReady", urls.length, urls.length, 100);
      hideDownloadStatusLater(4500);
    }
  } catch (error) {
    /* Cache API can be unavailable in private modes. */
  }
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) throw new Error("Empty dataset");
    state.proofs = data.map((proof) => Object.assign({}, proof, {
      searchText: buildSearchText(proof)
    })).sort((a, b) => a.id - b.id);
    renderCategories();
    filterProofs(false);
    if (state.drawerOpen) renderDrawerList(els.drawerSearchInput ? els.drawerSearchInput.value : "");
    checkImageCache();
  } catch (error) {
    if (els.emptyState) {
      els.emptyState.hidden = false;
      els.emptyState.textContent = t("loadError");
    }
    if (els.resultsMeta) els.resultsMeta.textContent = "";
    if (els.cardsGrid) els.cardsGrid.innerHTML = "";
  }
}

function setupEvents() {
  if (els.langContainer) {
    els.langContainer.addEventListener("click", (event) => {
      const button = event.target.closest("[data-lang]");
      if (!button) return;
      const lang = button.getAttribute("data-lang");
      if (!lang || lang === state.lang) return;
      applyLanguage(lang, true);
      animateLanguageChange();
    });
  }

  if (els.themeToggle) {
    els.themeToggle.addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      applyTheme();
    });
  }

  if (els.hamburgerBtn) els.hamburgerBtn.addEventListener("click", openDrawer);
  if (els.drawerClose) els.drawerClose.addEventListener("click", () => closeDrawer());

  if (els.proofsDrawer) {
    els.proofsDrawer.addEventListener("click", (event) => {
      if (event.target === els.proofsDrawer) closeDrawer();
    });
  }

  if (els.drawerSearchInput) {
    els.drawerSearchInput.addEventListener("input", () => {
      state.drawerQuery = els.drawerSearchInput.value;
      renderDrawerList(state.drawerQuery);
    });
  }

  if (els.drawerList) {
    els.drawerList.addEventListener("click", (event) => {
      const item = event.target.closest("[data-id]");
      if (!item) return;
      const id = Number(item.getAttribute("data-id"));
      if (!Number.isFinite(id)) return;
      closeDrawer();
      openModal(id, state.proofs);
    });
  }

  let searchTimer = 0;
  if (els.searchInput) {
    els.searchInput.addEventListener("input", () => {
      state.query = els.searchInput.value;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => filterProofs(false), 120);
    });
    els.searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        els.searchInput.value = "";
        state.query = "";
        filterProofs(false);
      }
    });
  }

  if (els.clearSearchBtn) {
    els.clearSearchBtn.addEventListener("click", () => {
      state.query = "";
      if (els.searchInput) els.searchInput.value = "";
      state.category = "all";
      filterProofs(true);
    });
  }

  if (els.categoriesContainer) {
    els.categoriesContainer.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      state.category = button.getAttribute("data-category") || "all";
      filterProofs(true);
    });
  }

  if (els.cardsGrid) {
    els.cardsGrid.addEventListener("error", (event) => {
      const img = event.target;
      if (!img || img.tagName !== "IMG") return;
      img.classList.add("image-error");
      img.alt = "";
    }, true);
    els.cardsGrid.addEventListener("click", (event) => {
      const card = event.target.closest("[data-id]");
      if (card) openModal(Number(card.getAttribute("data-id")));
    });
    els.cardsGrid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest("[data-id]");
      if (!card) return;
      event.preventDefault();
      openModal(Number(card.getAttribute("data-id")));
    });
  }

  if (els.downloadImagesBtn) {
    els.downloadImagesBtn.addEventListener("click", downloadImages);
  }

  if (els.modalClose) els.modalClose.addEventListener("click", closeModal);
  if (els.prevCardBtn) els.prevCardBtn.addEventListener("click", () => stepModal(-1));
  if (els.nextCardBtn) els.nextCardBtn.addEventListener("click", () => stepModal(1));

  if (els.proofModal) {
    els.proofModal.addEventListener("click", (event) => {
      if (event.target === els.proofModal) closeModal();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.modalId != null) {
        closeModal();
        return;
      }
      if (state.drawerOpen) {
        closeDrawer();
        return;
      }
    }
    if (state.drawerOpen) trapFocus(event, els.proofsDrawer);
    if (state.modalId != null && els.proofModal) {
      trapFocus(event, els.proofModal);
      if (event.key === "ArrowLeft") {
        const direction = document.documentElement.dir === "rtl" ? 1 : -1;
        stepModal(direction);
      }
      if (event.key === "ArrowRight") {
        const direction = document.documentElement.dir === "rtl" ? -1 : 1;
        stepModal(direction);
      }
    }
  });

  setupTvNavigation();

  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" })
        .catch(() => { /* The app still works without the service worker. */ });
    });
  }
}

function init() {
  els.langContainer = byId("langContainer");
  els.themeToggle = byId("themeToggle");
  els.hamburgerBtn = byId("hamburgerBtn");
  els.proofsDrawer = byId("proofsDrawer");
  els.drawerClose = byId("drawerClose");
  els.drawerSearchInput = byId("drawerSearchInput");
  els.drawerList = byId("drawerList");
  els.connectionStatus = byId("connectionStatus");
  els.searchInput = byId("searchInput");
  els.clearSearchBtn = byId("clearSearchBtn");
  els.resultsMeta = byId("resultsMeta");
  els.categoriesContainer = byId("categoriesContainer");
  els.cardsGrid = byId("cardsGrid");
  els.emptyState = byId("emptyState");
  els.downloadImagesBtn = byId("downloadImagesBtn");
  els.downloadStatus = byId("downloadStatus");
  els.downloadStatusText = byId("downloadStatusText");
  els.downloadFill = byId("downloadFill");
  els.proofModal = byId("proofModal");
  els.modalContentBox = document.querySelector("#proofModal .modal-content");
  els.modalKicker = byId("modalKicker");
  els.modalTitle = byId("modalTitle");
  els.modalImage = byId("modalImage");
  els.modalContent = byId("modalContent");
  els.modalScientificNote = byId("modalScientificNote");
  els.modalCounter = byId("modalCounter");
  els.modalClose = byId("modalClose");
  els.prevCardBtn = byId("prevCardBtn");
  els.nextCardBtn = byId("nextCardBtn");

  let savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
  state.theme = savedTheme || document.documentElement.getAttribute("data-theme") || "dark";
  state.lang = document.documentElement.lang && LANGS.indexOf(document.documentElement.lang) !== -1
    ? document.documentElement.lang
    : "ar";

  applyTheme();
  applyLanguage(state.lang, false);
  setupEvents();
  loadData();
}

document.addEventListener("DOMContentLoaded", init);
