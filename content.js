(function() {
  "use strict";
  const DEFAULT_CONFIG = {
    maxCount: 500,
    timeout: 6e5,
    pollDelay: 300,
    dryRun: false,
    actionTimeout: 15e3,
    endOfListAttempts: 3,
    scrollSettleMs: 1500,
    selectionSettleMs: 200
  };
  const SELECTOR_DEFS = {
    counter: {
      name: "Selected photo count",
      primary: ".rtExYb",
      fallbacks: [
        "[data-selection-count]",
        ".Mfixef .rtExYb"
      ]
    },
    checkbox: {
      name: "Photo checkbox",
      primary: ".ckGgle[aria-checked=false]",
      fallbacks: [
        '[role="checkbox"][aria-checked="false"]',
        '[data-lat][aria-checked="false"]'
      ]
    },
    checkboxChecked: {
      name: "Photo checkbox (checked)",
      primary: ".ckGgle[aria-checked=true]",
      fallbacks: [
        '[role="checkbox"][aria-checked="true"]',
        '[data-lat][aria-checked="true"]'
      ]
    },
    photoContainer: {
      name: "Photo container",
      primary: ".yDSiEe.uGCjIb.zcLWac.eejsDc.TWmIyd",
      fallbacks: [
        ".yDSiEe.uGCjIb.zcLWac",
        '[role="main"]',
        '[role="list"]',
        '[role="grid"]'
      ]
    }
  };
  const FALLBACK_WARN_CAP = 32;
  const warnedFallbacks = /* @__PURE__ */ new Set();
  function warnFallback(def, fallback) {
    const key = `${def.name}:${fallback}`;
    if (warnedFallbacks.has(key)) return;
    if (warnedFallbacks.size >= FALLBACK_WARN_CAP) return;
    warnedFallbacks.add(key);
    console.warn(
      `[gpdt:selectors] primary selector for "${def.name}" failed (${def.primary}), using fallback: ${fallback}`
    );
  }
  function queryOne(def, root = document) {
    const primary = root.querySelector(def.primary);
    if (primary) return primary;
    for (const fallback of def.fallbacks) {
      const el = root.querySelector(fallback);
      if (el) {
        warnFallback(def, fallback);
        return el;
      }
    }
    return null;
  }
  function queryAll(def, root = document) {
    const primary = [...root.querySelectorAll(def.primary)];
    if (primary.length > 0) return primary;
    for (const fallback of def.fallbacks) {
      const els = [...root.querySelectorAll(fallback)];
      if (els.length > 0) {
        warnFallback(def, fallback);
        return els;
      }
    }
    return [];
  }
  const DELETE_KEYWORDS = Object.freeze([
    "trash", "bin", "delete", "remove", "corbeille", "supprimer", "supprime",
    "papelera", "eliminar", "borrar", "papierkorb", "loschen", "entfernen",
    "cestino", "elimina", "rimuovi", "lixo", "lixeira", "excluir", "remover",
    "prullenbak", "verwijder", "kosz", "usun", "kos", "odstranit", "smazat",
    "sterge", "papirkorg", "papperskorg", "slett", "radera", "roskakori", "poista",
    "διαγραφ", "κάδος", "καδος", "σκουπιδ", "корзин", "удалить", "кошик", "видалити",
    "silmek", "kaldir", "ゴミ箱", "削除", "ごみ箱", "휴지통", "삭제", "回收站",
    "废纸篓", "垃圾桶", "删除", "刪除", "אשפה", "מחק", "مهملات", "حذف"
  ]);
  const CONTEXTUAL_REMOVE_KEYWORDS = Object.freeze([
    "album", "shared album", "from album", "collage", "animation",
    "retirer de l album", "retirer de l album partage", "quitar del album",
    "eliminar del album", "aus album entfernen", "rimuovi dall মোহ",
    "remover do album", "remove from album"
  ]);
  const CANCEL_KEYWORDS = Object.freeze([
    "cancel", "dismiss", "close", "annuler", "fermer", "retour", "cancelar",
    "cerrar", "abbrechen", "schliessen", "nein", "annulla", "chiudi", "indietro",
    "annuleren", "sluiten", "anuluj", "zamknij", "wstecz", "zrusit", "zavrit",
    "avbryt", "stang", "tilbake", "avbryta", "avsluta", "peruuta", "sulje",
    "ακύρωση", "ακυρωση", "отмена", "закрыть", "скасувати", "iptal", "kapat",
    "キャンセル", "閉じる", "戻る", "취소", "닫기", "取消", "关闭", "關閉",
    "ביטול", "סגור", "إلغاء", "إغلاق"
  ]);
  const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;
  function normalizeText(s) {
    if (!s) return "";
    return s.toLowerCase().normalize("NFD").replace(COMBINING_DIACRITICS, "").normalize("NFC").replace(/\s+/g, " ").trim();
  }
  const normCache = /* @__PURE__ */ new WeakMap();
  function getNormalizedKeywords(keywords) {
    let cached = normCache.get(keywords);
    if (!cached) {
      cached = keywords.map(normalizeText).filter((k) => k.length > 0);
      normCache.set(keywords, cached);
    }
    return cached;
  }
  function containsAnyKeyword(text, keywords) {
    const normalized = normalizeText(text);
    if (!normalized) return false;
    const normKeywords = getNormalizedKeywords(keywords);
    return normKeywords.some((k) => normalized.includes(k));
  }
  function getButtonTextCandidates(el) {
    const parts = [];
    const al = el.getAttribute?.("aria-label");
    if (al) parts.push(al);
    const dt = el.getAttribute?.("data-tooltip");
    if (dt) parts.push(dt);
    const title = el.getAttribute?.("title");
    if (title) parts.push(title);
    const text = el.textContent?.trim();
    if (text) parts.push(text);
    return parts.join(" ");
  }
  function isVisible(el) {
    if (typeof window === "undefined") return true;
    const he = el;
    if (!he.isConnected) return false;
    const rect = he.getBoundingClientRect?.();
    if (rect && rect.width === 0 && rect.height === 0) return false;
    if (he.hidden) return false;
    const style = window.getComputedStyle?.(he);
    if (style && (style.display === "none" || style.visibility === "hidden" || style.opacity === "0")) {
      return false;
    }
    return true;
  }
  function isInsideDialog(el) {
    return !!el.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
  }
  function scoreActionButton(el, positive = DELETE_KEYWORDS, negative = CANCEL_KEYWORDS) {
    const candidate = getButtonTextCandidates(el);
    let score = 0;
    if (containsAnyKeyword(candidate, positive)) score += 100;
    if (containsAnyKeyword(candidate, negative)) score -= 1e3;
    return score;
  }
  function findDeleteToolbarButton() {
    const cssCandidates = [
      'button[aria-label="Move to trash"]',
      'button[aria-label="Delete"]',
      "button[data-delete-origin]"
    ];
    for (const sel of cssCandidates) {
      const el = document.querySelector(sel);
      if (el && isVisible(el) && !isInsideDialog(el)) return el;
    }
    if (queryAll(SELECTOR_DEFS.checkboxChecked).length === 0) {
      return null;
    }
    const scored = [
      ...document.querySelectorAll('button, [role="button"]')
    ].filter((btn) => isVisible(btn) && !isInsideDialog(btn)).map((btn) => ({
      btn,
      label: getButtonTextCandidates(btn),
      score: scoreActionButton(btn)
    })).filter(({ label }) => label && !containsAnyKeyword(label, CONTEXTUAL_REMOVE_KEYWORDS)).sort((a, b) => b.score - a.score);
    return scored[0]?.score > 0 ? scored[0].btn : null;
  }
  function findConfirmDialog() {
    const candidates = [
      ...document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"], [aria-modal="true"]'
      )
    ].filter(isVisible);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    candidates.sort((a, b) => {
      const za = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
      const zb = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
      return zb - za;
    });
    return candidates[0];
  }
  function findConfirmButton(dialog) {
    const buttons = [
      ...dialog.querySelectorAll('button, [role="button"]')
    ].filter(isVisible);
    if (buttons.length === 0) return null;
    const scored = buttons.map((btn) => ({ btn, score: scoreActionButton(btn) }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].score > 0 ? scored[0].btn : null;
  }
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitUntil = async (condition, timeout, pollDelay) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = await condition();
      if (result) return result;
      await sleep(pollDelay);
    }
    throw new Error(`Timed out after ${timeout}ms`);
  };
  const formatElapsed = (ms) => {
    const totalSeconds = Math.floor(ms / 1e3);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };
  const formatEta = (ms) => {
    if (ms <= 0) return "0s";
    const totalSeconds = Math.ceil(ms / 1e3);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };
  class EventEmitter {
    listeners = /* @__PURE__ */ new Map();
    on(event, listener) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, /* @__PURE__ */ new Set());
      }
      const set = this.listeners.get(event);
      const wrapped = listener;
      set.add(wrapped);
      return () => {
        set.delete(wrapped);
      };
    }
    once(event, listener) {
      const unsub = this.on(event, ((...args) => {
        unsub();
        listener(...args);
      }));
      return unsub;
    }
    emit(event, ...args) {
      const set = this.listeners.get(event);
      if (!set) return;
      for (const listener of set) {
        try {
          listener(...args);
        } catch (err) {
          console.error(`[EventEmitter] Error in "${String(event)}" listener:`, err);
        }
      }
    }
    removeAllListeners(event) {
      if (event) {
        this.listeners.delete(event);
      } else {
        this.listeners.clear();
      }
    }
    listenerCount(event) {
      return this.listeners.get(event)?.size ?? 0;
    }
  }
  class DeletionLog {
    entries = [];
    startTime = 0;
    start() {
      this.entries = [];
      this.startTime = Date.now();
    }
    record(count) {
      if (count <= 0) return;
      this.entries.push({ count, timestamp: Date.now() });
    }
    get totalDeleted() {
      return this.entries.reduce((sum, e) => sum + e.count, 0);
    }
    get batchCount() {
      return this.entries.length;
    }
    get elapsed() {
      return this.startTime > 0 ? Date.now() - this.startTime : 0;
    }
    ratePerMinute(windowMs = 12e4) {
      const now = Date.now();
      const windowStart = now - windowMs;
      const recentEntries = this.entries.filter((e) => e.timestamp >= windowStart);
      if (recentEntries.length === 0) return 0;
      const recentCount = recentEntries.reduce((sum, e) => sum + e.count, 0);
      const elapsedSinceStart = this.startTime > 0 ? now - this.startTime : windowMs;
      const denominator = Math.min(windowMs, elapsedSinceStart);
      if (denominator <= 0) return 0;
      return recentCount / denominator * 6e4;
    }
    estimateRemaining(targetCount) {
      const rate = this.ratePerMinute();
      if (rate <= 0) return null;
      const remaining = targetCount - this.totalDeleted;
      if (remaining <= 0) return 0;
      return remaining / rate * 6e4;
    }
    getEntries() {
      return [...this.entries];
    }
  }
  const LOG = "[gpdt]";
  const LABEL_LOG_CAP = 40;
  function describeButton(el) {
    const label = (el.getAttribute("aria-label") ?? "").slice(0, LABEL_LOG_CAP);
    const text = (el.textContent ?? "").trim().slice(0, LABEL_LOG_CAP);
    return `aria-label="${label}" text="${text}"`;
  }
  class DeleteEngine extends EventEmitter {
    config;
    progress;
    onProgress;
    stopped = false;
    paused = false;
    pausePromise = null;
    pauseResolve = null;
    log = new DeletionLog();
    constructor(config = {}, onProgress) {
      super();
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.onProgress = onProgress;
      this.progress = {
        deleted: 0,
        selected: 0,
        status: "idle",
        startedAt: Date.now()
      };
    }
    pause() {
      if (this.paused || this.stopped) return;
      this.paused = true;
      this.pausePromise = new Promise((resolve) => {
        this.pauseResolve = resolve;
      });
      this.progress.status = "paused";
      this.emitProgress();
      this.emit("paused");
    }
    resume() {
      if (!this.paused) return;
      this.paused = false;
      this.pauseResolve?.();
      this.pausePromise = null;
      this.pauseResolve = null;
      this.emit("resumed");
    }
    stop() {
      this.stopped = true;
      if (this.paused) {
        this.paused = false;
        this.pauseResolve?.();
        this.pausePromise = null;
        this.pauseResolve = null;
      }
    }
    abort() {
      this.stop();
    }
    get isPaused() {
      return this.paused;
    }
    get isStopped() {
      return this.stopped;
    }
    async run() {
      this.stopped = false;
      this.paused = false;
      this.progress.startedAt = Date.now();
      this.progress.status = "selecting";
      this.log.start();
      this.emitProgress();
      
      const effectiveMax = this.config.maxCount;
      let consecutiveNoProgress = 0;
      try {
        while (!this.stopped) {
          await this.checkPause();
          if (this.stopped) break;
          const beforeCount = this.getCount();
          const remainingCapacity = effectiveMax - beforeCount;
          const clicked = await this.selectVisibleCheckboxes(remainingCapacity);
          const currentCount = this.getCount();
          const counterGain = currentCount - beforeCount;
          const cappedByGoogle = clicked > 0 && counterGain === 0 && currentCount > 0;
          this.progress.selected = currentCount;
          this.emitProgress();
          if (currentCount >= effectiveMax || cappedByGoogle) {
            await this.deleteSelected();
            consecutiveNoProgress = 0;
            continue;
          }
          this.progress.status = "scrolling";
          this.emitProgress();
          const scrolled = await this.tryScrollForMore();
          this.progress.status = "selecting";
          this.emitProgress();
          if (counterGain <= 0 && !scrolled) {
            consecutiveNoProgress++;
            if (consecutiveNoProgress >= this.config.endOfListAttempts) {
              break;
            }
            await sleep(this.config.pollDelay);
          } else {
            consecutiveNoProgress = 0;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.progress.status = "error";
        this.progress.error = msg;
        this.emitProgress();
        this.emit("error", err instanceof Error ? err : new Error(msg));
      } finally {
        try {
          const remaining = this.getCount();
          if (remaining > 0 && !this.stopped && this.progress.status !== "error") {
            await this.deleteSelected();
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (this.progress.status !== "error") {
            this.progress.status = "error";
            this.progress.error = msg;
            this.emitProgress();
            this.emit("error", err instanceof Error ? err : new Error(msg));
          }
        }
        if (this.progress.status !== "error") {
          this.progress.status = this.stopped ? "idle" : "done";
        }
        this.emitProgress();
        if (this.progress.status === "done") {
          this.emit("done", { ...this.progress });
        }
      }
      return this.progress;
    }

    async checkPause() {
      if (this.pausePromise) {
        await this.pausePromise;
      }
    }
    emitProgress() {
      const snapshot = { ...this.progress };
      this.onProgress?.(snapshot);
      this.emit("progress", snapshot);
    }
    getCount() {
      const el = queryOne(SELECTOR_DEFS.counter);
      if (!el) return 0;
      const digitsOnly = (el.textContent ?? "").replace(/[^\d]/g, "");
      return parseInt(digitsOnly, 10) || 0;
    }
    async selectVisibleCheckboxes(maxToSelect) {
      if (maxToSelect <= 0) return 0;
      const visible = queryAll(SELECTOR_DEFS.checkbox);
      const clickable = visible.filter((el) => {
        const he = el;
        if (he.hasAttribute("disabled")) return false;
        if (he.getAttribute("aria-disabled") === "true") return false;
        return true;
      });
      if (clickable.length === 0) return 0;
      const batch = clickable.slice(0, maxToSelect);
      for (const cb of batch) {
        cb.click();
      }
      await sleep(this.config.selectionSettleMs);
      return batch.length;
    }
    async tryScrollForMore() {
      const target = this.findScrollTarget();
      if (!target) {
        return false;
      }
      const measure = () => ({
        top: target.scrollTop,
        height: target.scrollHeight,
        checkboxes: queryAll(SELECTOR_DEFS.checkbox).length
      });
      const before = measure();
      const step = Math.max(200, target.clientHeight || 800);
      target.scrollBy({ top: step, left: 0, behavior: "auto" });
      const start = Date.now();
      while (Date.now() - start < this.config.scrollSettleMs) {
        await sleep(Math.min(this.config.pollDelay, 200));
        const after = measure();
        const movedScroll = after.top > before.top;
        const grewHeight = after.height > before.height;
        const moreCheckboxes = after.checkboxes > before.checkboxes;
        if (movedScroll || grewHeight || moreCheckboxes) {
          return true;
        }
      }
      return false;
    }
    findScrollTarget() {
      const container = queryOne(SELECTOR_DEFS.photoContainer);
      if (container && container.scrollHeight > container.clientHeight + 1) {
        return container;
      }
      const docScroll = document.scrollingElement || document.documentElement;
      if (docScroll && docScroll.scrollHeight > docScroll.clientHeight + 1) {
        return docScroll;
      }
      return null;
    }

    async waitForNewContent() {
      console.log(`${LOG} Waiting for DOM to repopulate after deletion...`);
      try {
        await waitUntil(
          () => queryAll(SELECTOR_DEFS.checkbox).length > 0,
          10000, 
          500 
        );
        console.log(`${LOG} New items detected in DOM.`);
      } catch {
        console.log(`${LOG} No new items loaded within 10s. Gallery might be empty.`);
      }
      await sleep(1500); 
    }

    async deleteSelected() {
      const count = this.getCount();
      if (count <= 0) return;
      
      this.progress.status = "deleting";
      this.emitProgress();
      
      const deleteBtn = await this.waitForToolbarDeleteButton();
      deleteBtn.click();
      
      const dialog = await this.waitForConfirmDialog();
      const confirmBtn = await this.waitForDialogConfirmButton(dialog);
      confirmBtn.click();
      
      try {
        await waitUntil(
          () => this.getCount() === 0,
          this.config.actionTimeout,
          this.config.pollDelay
        );
      } catch {
        throw new Error(
          `Google Photos is taking a moment to process the deletion, which is completely normal. Just click Start again to continue deleting.`
        );
      }
      
      this.progress.deleted += count;
      this.progress.selected = 0;
      this.log.record(count);
      
      this.progress.status = "scrolling"; 
      this.emitProgress();

      const scrollTarget = this.findScrollTarget();
      if (scrollTarget) {
        scrollTarget.scrollTop = 0;
      }
      
      await this.waitForNewContent();
    }

    async waitForToolbarDeleteButton() {
      try {
        return await waitUntil(
          () => findDeleteToolbarButton(),
          this.config.actionTimeout,
          this.config.pollDelay
        );
      } catch {
        throw new Error(
          `Delete/trash button not found in toolbar.`
        );
      }
    }
    async waitForConfirmDialog() {
      try {
        return await waitUntil(
          () => findConfirmDialog(),
          this.config.actionTimeout,
          this.config.pollDelay
        );
      } catch {
        throw new Error(
          `Confirmation dialog did not appear.`
        );
      }
    }
    async waitForDialogConfirmButton(dialog) {
      try {
        return await waitUntil(
          () => findConfirmButton(dialog),
          this.config.actionTimeout,
          this.config.pollDelay
        );
      } catch {
        throw new Error(
          `Confirm button not found inside the confirmation dialog.`
        );
      }
    }
  }

  const PANEL_ID = "gpdt-panel";
  const createStyles = () => `
  #${PANEL_ID} {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: #e0e0e0;
    background: rgba(30, 30, 50, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    width: 280px;
    overflow: hidden;
    transition: all 0.3s ease;
    user-select: none;
  }
  #${PANEL_ID}.minimized {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #${PANEL_ID}.minimized .gpdt-body { display: none; }
  #${PANEL_ID}.minimized .gpdt-mini-icon { display: flex; }
  .gpdt-mini-icon {
    display: none;
    font-size: 20px;
    align-items: center;
    justify-content: center;
  }
  .gpdt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: rgba(255,255,255,0.05);
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .gpdt-title {
    font-weight: 700;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .gpdt-header-btns {
    display: flex;
    gap: 4px;
  }
  .gpdt-header-btns button {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
    transition: all 0.15s;
  }
  .gpdt-header-btns button:hover { color: #fff; background: rgba(255,255,255,0.1); }
  .gpdt-content {
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .gpdt-status-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #a1a1aa;
  }
  .gpdt-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #666;
    flex-shrink: 0;
    transition: background 0.2s;
  }
  .gpdt-status-dot.running { background: #22c55e; animation: gpdt-pulse 1.5s infinite; }
  .gpdt-status-dot.paused { background: #f59e0b; animation: gpdt-pulse 2s infinite; }
  .gpdt-status-dot.done { background: #4f8cff; }
  .gpdt-status-dot.error { background: #ef4444; }
  @keyframes gpdt-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }
  .gpdt-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .gpdt-stat {
    background: rgba(255,255,255,0.05);
    border-radius: 10px;
    padding: 10px 12px;
    text-align: center;
  }
  .gpdt-stat-value {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }
  .gpdt-stat-label {
    font-size: 10px;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }
`;

  let engine = null;
  let panel = null;
  let lastProgress = {
      status: 'idle',
      deleted: 0,
      startedAt: 0,
      maxCount: 500
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "idle": return "";
      case "paused": return "paused";
      case "done": return "done";
      case "error": return "error";
      default: return "running";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "idle": return "Ready";
      case "selecting": return "Selecting photos…";
      case "deleting": return "Deleting batch…";
      case "scrolling": return "Loading more…";
      case "paused": return "Paused";
      case "done": return "Complete!";
      case "error": return "Error";
      default: return status;
    }
  };

  const createPinnedPanel = () => {
    if (document.getElementById(PANEL_ID)) return document.getElementById(PANEL_ID);

    const style = document.createElement("style");
    style.textContent = createStyles();
    document.head.appendChild(style);
    
    panel = document.createElement("div");
    panel.id = PANEL_ID;

    const createEl = (tag, className, textContent = "") => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (textContent) el.textContent = textContent;
        return el;
    };

    const miniIcon = createEl("div", "gpdt-mini-icon", "🗑️");
    const body = createEl("div", "gpdt-body");
    
    const header = createEl("div", "gpdt-header");
    const title = createEl("span", "gpdt-title", "🗑️ Photos Delete (Pinned)");
    const headerBtns = createEl("div", "gpdt-header-btns");
    const minBtn = createEl("button", "gpdt-minimize", "−");
    minBtn.title = "Minimize";
    const closeBtn = createEl("button", "gpdt-close", "×");
    closeBtn.title = "Close UI";
    headerBtns.append(minBtn, closeBtn);
    header.append(title, headerBtns);

    const content = createEl("div", "gpdt-content");
    const statusBar = createEl("div", "gpdt-status-bar");
    const statusDot = createEl("span", "gpdt-status-dot");
    const statusText = createEl("span", "gpdt-status-text", "Ready");
    statusBar.append(statusDot, statusText);

    const stats = createEl("div", "gpdt-stats");
    const statGroups = [
        { valClass: "gpdt-deleted", val: "0", lbl: "Deleted" },
        { valClass: "gpdt-speed", val: "—", lbl: "Per min" }
    ];
    statGroups.forEach(g => {
        const s = createEl("div", "gpdt-stat");
        const v = createEl("div", `gpdt-stat-value ${g.valClass}`, g.val);
        const l = createEl("div", "gpdt-stat-label", g.lbl);
        s.append(v, l);
        stats.appendChild(s);
    });

    const settings = createEl("div", "gpdt-settings");
    settings.style.display = "flex";
    settings.style.justifyContent = "space-between";
    settings.style.alignItems = "center";
    settings.style.fontSize = "12px";
    settings.style.marginBottom = "8px";
    const settingsLabel = createEl("label", "", "Batch size:");
    const maxCountInput = createEl("input", "");
    maxCountInput.type = "number";
    maxCountInput.value = "500";
    maxCountInput.min = "1";
    maxCountInput.style.width = "60px";
    maxCountInput.style.background = "rgba(255,255,255,0.1)";
    maxCountInput.style.color = "#fff";
    maxCountInput.style.border = "1px solid rgba(255,255,255,0.2)";
    maxCountInput.style.borderRadius = "4px";
    maxCountInput.style.padding = "2px 4px";
    settings.append(settingsLabel, maxCountInput);

    const controls = createEl("div", "gpdt-controls");
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.marginTop = "8px";
    
    const startBtn = createEl("button", "gpdt-btn gpdt-btn-start", "▶ Start");
    startBtn.style.flex = "1";
    startBtn.style.padding = "6px";
    startBtn.style.background = "linear-gradient(135deg, #4f8cff, #6c5ce7)";
    startBtn.style.color = "#fff";
    startBtn.style.border = "none";
    startBtn.style.borderRadius = "6px";
    startBtn.style.cursor = "pointer";

    const stopBtn = createEl("button", "gpdt-btn gpdt-btn-stop", "⏹ Stop");
    stopBtn.style.flex = "1";
    stopBtn.style.padding = "6px";
    stopBtn.style.background = "#ef4444";
    stopBtn.style.color = "#fff";
    stopBtn.style.border = "none";
    stopBtn.style.borderRadius = "6px";
    stopBtn.style.cursor = "pointer";
    stopBtn.style.display = "none";

    controls.append(startBtn, stopBtn);

    content.append(settings, statusBar, stats, controls);
    body.append(header, content);
    panel.append(miniIcon, body);

    document.body.appendChild(panel);

    minBtn.addEventListener("click", () => panel.classList.add("minimized"));
    panel.addEventListener("click", (e) => {
      if (panel.classList.contains("minimized") && e.target === miniIcon) {
        panel.classList.remove("minimized");
      }
    });
    closeBtn.addEventListener("click", () => {
      panel.remove();
      panel = null;
    });

    startBtn.addEventListener("click", () => {
      if (engine && !engine.isStopped) engine.stop();
      const maxCount = parseInt(maxCountInput.value, 10) || 500;
      lastProgress.maxCount = maxCount;
      engine = new DeleteEngine({ maxCount }, broadcastProgress);
      
      engine.on('error', (err) => { broadcastLog(`Error: ${err.message}`); });
      engine.on('done', () => { broadcastLog(`Done.`); });
      
      engine.run().catch(err => broadcastLog(`Fatal error: ${err.message}`));
      startBtn.style.display = "none";
      maxCountInput.disabled = true;
      stopBtn.style.display = "block";
    });

    stopBtn.addEventListener("click", () => {
      if (engine) engine.stop();
      startBtn.style.display = "block";
      maxCountInput.disabled = false;
      stopBtn.style.display = "none";
    });

    // expose controls to global so updateUI can toggle them
    panel._startBtn = startBtn;
    panel._stopBtn = stopBtn;
    panel._maxCountInput = maxCountInput;

    return panel;
  };

  const updatePinnedPanelUI = (progress) => {
    if (!panel) return;
    const $deleted = panel.querySelector(".gpdt-deleted");
    const $speed = panel.querySelector(".gpdt-speed");
    const $dot = panel.querySelector(".gpdt-status-dot");
    const $statusText = panel.querySelector(".gpdt-status-text");

    $deleted.textContent = progress.deleted.toLocaleString();
    const elapsed = Date.now() - progress.startedAt;
    if (progress.deleted > 0 && elapsed > 0) {
      const rate = Math.round(progress.deleted / (elapsed / 6e4));
      $speed.textContent = rate.toLocaleString();
    } else if (elapsed > 0) {
      $speed.textContent = "Calc...";
    }
    $dot.className = `gpdt-status-dot ${getStatusClass(progress.status)}`;
    $statusText.textContent = getStatusText(progress.status);
    
    // Toggle start/stop buttons if they exist
    if (panel._startBtn && panel._stopBtn) {
        if (progress.status === "idle" || progress.status === "done" || progress.status === "error") {
            panel._startBtn.style.display = "block";
            panel._stopBtn.style.display = "none";
            panel._maxCountInput.disabled = false;
        } else {
            panel._startBtn.style.display = "none";
            panel._stopBtn.style.display = "block";
            panel._maxCountInput.disabled = true;
        }
    }
  };

  const broadcastProgress = (progress) => {
      lastProgress = { ...progress, maxCount: engine?.config?.maxCount || lastProgress.maxCount };
      try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ type: 'progress', payload: lastProgress }).catch(() => {});
          }
      } catch (e) {}
      updatePinnedPanelUI(lastProgress);
  };

  const broadcastLog = (msg) => {
      console.log(LOG, msg);
      try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
              chrome.runtime.sendMessage({ type: 'log', payload: msg }).catch(() => {});
          }
      } catch (e) {}
  };

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getState') {
          sendResponse({ progress: lastProgress });
          return;
      }
      if (request.action === 'start') {
          if (engine && !engine.isStopped) {
              engine.stop();
          }
          const maxCount = request.maxCount || 500;
          lastProgress.maxCount = maxCount;
          engine = new DeleteEngine({ maxCount }, broadcastProgress);
          
          engine.on('error', (err) => {
              broadcastLog(`Error: ${err.message}`);
          });
          engine.on('done', () => {
              broadcastLog(`Deletion complete! Deleted ${lastProgress.deleted} photos.`);
          });
          
          engine.run().catch(err => {
              broadcastLog(`Fatal error: ${err.message}`);
          });
          broadcastLog(`Started deletion engine.`);
      } else if (request.action === 'pause') {
          if (engine) engine.pause();
      } else if (request.action === 'resume') {
          if (engine) engine.resume();
      } else if (request.action === 'stop') {
          if (engine) {
              engine.stop();
              broadcastLog("Stopped deletion.");
          }
      } else if (request.action === 'pinPanel') {
          createPinnedPanel();
          updatePinnedPanelUI(lastProgress);
      }
  });

})();