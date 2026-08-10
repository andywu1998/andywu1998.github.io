(function () {
  "use strict";

  const state = {
    data: null,
    filteredLogs: [],
    filteredTasks: [],
    visibleMonth: new Date(),
    selectedDateKey: "",
    selectedEventId: "",
  };

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function decodeBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function deriveKey(passphrase, envelope) {
    const sourceKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: decodeBase64(envelope.kdf.salt),
        iterations: envelope.kdf.iterations,
        hash: envelope.kdf.hash,
      },
      sourceKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  async function decryptEnvelope(passphrase) {
    const response = await fetch("/assets/private/personal-assistant.encrypted.json", {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Encrypted data not found");
    }
    const envelope = await response.json();
    const key = await deriveKey(passphrase, envelope);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64(envelope.iv),
        tagLength: envelope.tagLength || 128,
      },
      key,
      decodeBase64(envelope.ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  function formatDateTime(entry) {
    return [entry.date, entry.time].filter(Boolean).join(" ");
  }

  function formatEntryTime(entry, compact) {
    const start = String(entry.startTime || "").trim();
    const end = String(entry.endTime || "").trim();
    if (!start && !end) return "全天";
    if (!end) return start;

    const absoluteEnd = end.match(/^(\d{4})-(\d{2})-(\d{2})\s+(.+)$/);
    if (absoluteEnd) {
      const endDate = `${absoluteEnd[1]}-${absoluteEnd[2]}-${absoluteEnd[3]}`;
      const endLabel = compact
        ? `${Number(absoluteEnd[2])}/${Number(absoluteEnd[3])} ${absoluteEnd[4]}`
        : `${absoluteEnd[2]}/${absoluteEnd[3]} ${absoluteEnd[4]}`;
      return endDate === entry.date ? `${start}~${absoluteEnd[4]}` : `${start} → ${endLabel}`;
    }
    if (end.startsWith("次日")) return `${start} → 次日${end.slice(2)}`;
    return `${start}~${end}`;
  }

  function normalize(value) {
    return String(value || "").toLowerCase();
  }

  function matchesQuery(item, query) {
    if (!query) return true;
    return normalize(JSON.stringify(item)).includes(query);
  }

  function applyFilter() {
    const query = normalize(els.search.value.trim());
    state.filteredLogs = state.data.dailyEntries.filter((entry) => matchesQuery(entry, query));
    state.filteredTasks = state.data.tasks.filter((task) => matchesQuery(task, query));
    if (state.selectedDateKey && !state.filteredLogs.some((entry) => entry.date === state.selectedDateKey)) {
      state.selectedDateKey = "";
      state.selectedEventId = "";
    }
    renderLogs();
    renderTasks();
    renderCalendar();
  }

  function renderTags(tags) {
    if (!tags || tags.length === 0) return "";
    return `<div class="entry-tags">${tags
      .map((tag) => `<span class="entry-tag">${escapeHtml(tag)}</span>`)
      .join("")}</div>`;
  }

  function findEntry(id) {
    return state.filteredLogs.find((entry) => entry.id === id) || state.data.dailyEntries.find((entry) => entry.id === id);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderLogs() {
    els.logList.innerHTML = state.filteredLogs
      .slice()
      .reverse()
      .map(
        (entry) => `
          <article class="entry-item">
            <div class="entry-item__meta">${escapeHtml(formatDateTime(entry))}</div>
            <div class="entry-item__title">${escapeHtml(entry.title)}</div>
            <p class="entry-item__body">${escapeHtml(entry.text)}</p>
            ${renderTags(entry.tags)}
          </article>
        `
      )
      .join("");
  }

  function renderTasks() {
    els.taskList.innerHTML = state.filteredTasks
      .map(
        (task) => `
          <article class="entry-item">
            <div class="entry-item__meta">${escapeHtml(task.priority || task.source)}</div>
            <div class="entry-item__title">${escapeHtml(task.title)}</div>
            <p class="entry-item__body">${escapeHtml(task.goal || "")}</p>
            ${task.nextAction ? `<p class="entry-item__body">Next: ${escapeHtml(task.nextAction)}</p>` : ""}
            ${task.due ? `<p class="entry-item__body">Due: ${escapeHtml(task.due)}</p>` : ""}
          </article>
        `
      )
      .join("");
  }

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function renderCalendar() {
    const month = state.visibleMonth.getMonth();
    const year = state.visibleMonth.getFullYear();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const monthLabel = `${year}-${String(month + 1).padStart(2, "0")}`;
    els.calendarTitle.textContent = monthLabel;

    const entriesByDate = new Map();
    for (const entry of state.filteredLogs) {
      if (!entriesByDate.has(entry.date)) entriesByDate.set(entry.date, []);
      entriesByDate.get(entry.date).push(entry);
    }

    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const parts = names.map((name) => `<div class="calendar-day-name">${name}</div>`);

    for (let i = 0; i < 42; i += 1) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const key = dateKey(current);
      const entries = entriesByDate.get(key) || [];
      const muted = current.getMonth() !== month ? " is-muted" : "";
      const empty = entries.length === 0 ? " is-empty" : "";
      const active = state.selectedDateKey === key ? " is-selected" : "";
      parts.push(`
        <button class="calendar-day${muted}${empty}${active}" type="button" data-date-key="${key}">
          <div class="calendar-date">
            <span class="calendar-date__day">${current.getDate()}</span>
            <span class="calendar-date__full">${key}</span>
          </div>
          ${entries
            .slice(0, 4)
            .map(
              (entry) => `
                <span class="calendar-entry${entry.id === state.selectedEventId ? " is-selected" : ""}">
                  <strong>${escapeHtml(formatEntryTime(entry, true))}</strong>
                  ${escapeHtml(entry.title)}
                </span>
              `
            )
            .join("")}
          ${
            entries.length > 4
              ? `<span class="calendar-entry calendar-more">+${entries.length - 4}</span>`
              : ""
          }
        </button>
      `);
    }

    els.calendarGrid.innerHTML = parts.join("");
    renderEventDetailForDate(entriesByDate);
  }

  function entryTimeValue(entry) {
    const value = String(entry.time || "").trim();
    const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return Number.MAX_SAFE_INTEGER;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] || 0);
    return hours * 3600 + minutes * 60 + seconds;
  }

  function getSortedEntries(entries) {
    return entries
      .slice()
      .sort((left, right) => entryTimeValue(left) - entryTimeValue(right) || left.title.localeCompare(right.title, "zh-Hans-CN"));
  }

  function renderEventDetailForDate(entriesByDate) {
    const key = state.selectedDateKey;
    if (!key) {
      els.eventDetail.innerHTML = '<div class="event-detail__empty">Select a day</div>';
      return;
    }

    const entries = getSortedEntries(entriesByDate.get(key) || []);
    if (entries.length === 0) {
      els.eventDetail.innerHTML = `
        <div class="event-detail__meta">${escapeHtml(key)}</div>
        <div class="event-detail__title">No events</div>
        <p class="event-detail__body">This day has no visible entries under the current filter.</p>
      `;
      return;
    }

    els.eventDetail.innerHTML = `
      <div class="event-detail__meta">${escapeHtml(key)}</div>
      <div class="event-detail__title">当天完整时间轴</div>
      <div class="calendar-timeline">
        ${entries
          .map(
            (entry) => `
              <button class="calendar-timeline__item${entry.id === state.selectedEventId ? " is-selected" : ""}" type="button" data-event-id="${escapeHtml(entry.id)}">
                <span class="calendar-timeline__dot" aria-hidden="true"></span>
                <span class="calendar-timeline__time">${escapeHtml(formatEntryTime(entry, false))}</span>
                <span class="calendar-timeline__content">
                  <span class="calendar-timeline__title">${escapeHtml(entry.title)}</span>
                  <span class="calendar-timeline__text">${escapeHtml(entry.text || entry.raw || "")}</span>
                </span>
              </button>
            `
          )
          .join("")}
      </div>
      ${renderSelectedEventCard(entries)}
    `;
  }

  function renderSelectedEventCard(entries) {
    const selectedEntry =
      entries.find((entry) => entry.id === state.selectedEventId) || entries[0] || null;
    if (!selectedEntry) return "";
    return `
      <div class="event-detail-card">
        <div class="event-detail-card__label">事件详情</div>
        <div class="event-detail__meta">${escapeHtml(formatDateTime(selectedEntry))}</div>
        <div class="event-detail__title">${escapeHtml(selectedEntry.title)}</div>
        <p class="event-detail__body">${escapeHtml(selectedEntry.text || selectedEntry.raw || "")}</p>
        ${renderTags(selectedEntry.tags)}
      </div>
    `;
  }

  function selectEvent(id) {
    const entry = findEntry(id);
    if (!entry) return;
    state.selectedDateKey = entry.date;
    state.selectedEventId = id;
    renderCalendar();
  }

  function selectDate(key) {
    if (state.selectedDateKey === key) return;
    state.selectedDateKey = key;
    const entries = getSortedEntries(state.filteredLogs.filter((entry) => entry.date === key));
    state.selectedEventId = entries[0] ? entries[0].id : "";
    renderCalendar();
  }

  function bindTabs() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("is-active"));
        document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.remove("is-active"));
        button.classList.add("is-active");
        document.querySelector(`[data-panel="${button.dataset.view}"]`).classList.add("is-active");
      });
    });
  }

  function bindCalendar() {
    $("calendar-prev").addEventListener("click", () => {
      state.visibleMonth = new Date(state.visibleMonth.getFullYear(), state.visibleMonth.getMonth() - 1, 1);
      renderCalendar();
    });
    $("calendar-next").addEventListener("click", () => {
      state.visibleMonth = new Date(state.visibleMonth.getFullYear(), state.visibleMonth.getMonth() + 1, 1);
      renderCalendar();
    });
    $("calendar-grid").addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target) return;
      const day = target.closest("[data-date-key]");
      if (day) {
        selectDate(day.dataset.dateKey);
        return;
      }
    });
    $("event-detail").addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      if (!target) return;
      const button = target.closest("[data-event-id]");
      if (!button) return;
      selectEvent(button.dataset.eventId);
    });
  }

  function initElements() {
    els.form = $("private-unlock-form");
    els.passphrase = $("private-passphrase");
    els.status = $("private-status");
    els.unlock = $("private-unlock");
    els.dashboard = $("private-dashboard");
    els.generatedAt = $("private-generated-at");
    els.search = $("private-search");
    els.logList = $("log-list");
    els.taskList = $("task-list");
    els.calendarGrid = $("calendar-grid");
    els.calendarTitle = $("calendar-title");
    els.eventDetail = $("event-detail");
  }

  function init() {
    initElements();
    bindTabs();
    bindCalendar();
    els.search.addEventListener("input", applyFilter);
    els.form.addEventListener("submit", async (event) => {
      event.preventDefault();
      els.status.textContent = "Decrypting...";
      try {
        const data = await decryptEnvelope(els.passphrase.value);
        state.data = data;
        state.visibleMonth = data.dailyEntries[0] ? new Date(`${data.dailyEntries[0].date}T00:00:00`) : new Date();
        els.generatedAt.textContent = `Generated ${new Date(data.generatedAt).toLocaleString()}`;
        els.unlock.hidden = true;
        els.dashboard.hidden = false;
        state.selectedDateKey = "";
        state.selectedEventId = "";
        applyFilter();
      } catch (error) {
        els.status.textContent = "Unlock failed";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
