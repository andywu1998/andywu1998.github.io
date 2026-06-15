(function () {
  "use strict";

  const state = {
    data: null,
    filteredLogs: [],
    filteredTasks: [],
    visibleMonth: new Date(),
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
      parts.push(`
        <div class="calendar-day${muted}${empty}">
          <div class="calendar-date">
            <span class="calendar-date__day">${current.getDate()}</span>
            <span class="calendar-date__full">${key}</span>
          </div>
          ${entries
            .slice(0, 4)
            .map(
              (entry) => `
                <button class="calendar-entry${entry.id === state.selectedEventId ? " is-selected" : ""}" type="button" data-event-id="${escapeHtml(entry.id)}">
                  ${entry.time ? `<strong>${escapeHtml(entry.time)}</strong> ` : ""}
                  ${escapeHtml(entry.title)}
                </button>
              `
            )
            .join("")}
          ${entries.length > 4 ? `<div class="calendar-entry calendar-more">+${entries.length - 4}</div>` : ""}
        </div>
      `);
    }

    els.calendarGrid.innerHTML = parts.join("");
  }

  function renderEventDetail(entry) {
    if (!entry) {
      els.eventDetail.innerHTML = '<div class="event-detail__empty">Select an event</div>';
      return;
    }

    els.eventDetail.innerHTML = `
      <div class="event-detail__meta">${escapeHtml(formatDateTime(entry))}</div>
      <div class="event-detail__title">${escapeHtml(entry.title)}</div>
      <p class="event-detail__body">${escapeHtml(entry.text || entry.raw || "")}</p>
      ${renderTags(entry.tags)}
    `;
  }

  function selectEvent(id) {
    state.selectedEventId = id;
    renderCalendar();
    renderEventDetail(findEntry(id));
    if (window.matchMedia("(max-width: 760px)").matches) {
      els.eventDetail.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
      const button = event.target.closest("[data-event-id]");
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
        state.selectedEventId = "";
        renderEventDetail(null);
        applyFilter();
      } catch (error) {
        els.status.textContent = "Unlock failed";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
