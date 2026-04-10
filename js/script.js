/**
 * Flow — Life Dashboard
 * script.js
 *
 * Architecture: Feature modules as self-contained objects,
 * each initialised via .init(). Shared state lives in Storage.
 *
 * Modules:
 *  1. Storage   — localStorage read/write helpers
 *  2. Theme     — light / dark toggle
 *  3. Clock     — real-time clock + greeting + day progress
 *  4. Timer     — Pomodoro countdown with adjustable duration
 *  5. Tasks     — CRUD, sort, duplicate prevention
 *  6. Links     — quick-link CRUD
 *  7. UserName  — name personalisation
 *  8. Modal     — generic open/close helpers
 *  9. Toast     — brief notification popup
 */

'use strict';

/* ============================================================
   1. STORAGE — thin wrapper around localStorage
   ============================================================ */
const Storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Storage.set failed:', e);
    }
  },
};

/* ============================================================
   2. THEME — light / dark mode with LocalStorage persistence
   ============================================================ */
const Theme = {
  KEY: 'flow-theme',

  init() {
    const saved = Storage.get(this.KEY, 'light');
    this.apply(saved);

    document.getElementById('btn-theme').addEventListener('click', () => {
      const current = document.documentElement.dataset.theme;
      this.apply(current === 'light' ? 'dark' : 'light');
    });
  },

  apply(theme) {
    document.documentElement.dataset.theme = theme;
    Storage.set(this.KEY, theme);
  },
};

/* ============================================================
   3. CLOCK — real-time clock, date, greeting, day progress
   ============================================================ */
const Clock = {
  init() {
    this.tick();
    // Update every second
    setInterval(() => this.tick(), 1000);
  },

  tick() {
    const now  = new Date();
    const h    = now.getHours();
    const m    = now.getMinutes();
    const s    = now.getSeconds();

    // Format HH:MM:SS
    const timeStr = [h, m, s]
      .map(n => String(n).padStart(2, '0'))
      .join(':');

    // Format date: e.g. "Friday, 10 April 2026"
    const dateStr = now.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    document.getElementById('clock').textContent = timeStr;
    document.getElementById('date').textContent  = dateStr;
    this.updateGreeting(h);
    this.updateDayProgress(h, m, s);
  },

  updateGreeting(h) {
    const name = Storage.get('flow-username', '');
    let prefix;
    if      (h >= 5  && h < 12) prefix = 'Good morning';
    else if (h >= 12 && h < 17) prefix = 'Good afternoon';
    else if (h >= 17 && h < 21) prefix = 'Good evening';
    else                         prefix = 'Good night';

    const greeting = name ? `${prefix}, ${name} 👋` : `${prefix} 👋`;
    document.getElementById('greeting').textContent = greeting;
  },

  updateDayProgress(h, m, s) {
    const totalSeconds  = 24 * 3600;
    const elapsed       = h * 3600 + m * 60 + s;
    const pct           = Math.min(100, ((elapsed / totalSeconds) * 100).toFixed(1));

    document.getElementById('day-progress').style.width = `${pct}%`;
    document.getElementById('day-percent').textContent  = `${Math.floor(pct)}%`;
  },
};

/* ============================================================
   4. TIMER — Pomodoro with adjustable duration
   ============================================================ */
const Timer = {
  KEY_SESSIONS: 'flow-sessions',

  totalSeconds: 25 * 60,
  remaining:    25 * 60,
  interval:     null,
  running:      false,

  CIRCUMFERENCE: 2 * Math.PI * 68, // 427.26

  init() {
    this.$display    = document.getElementById('timer-display');
    this.$statusLbl  = document.getElementById('timer-status-label');
    this.$ring       = document.getElementById('ring-progress');
    this.$wrap       = document.querySelector('.timer-ring-wrap');
    this.$btnStart   = document.getElementById('btn-start-timer');
    this.$btnStop    = document.getElementById('btn-stop-timer');
    this.$btnReset   = document.getElementById('btn-reset-timer');
    this.$minInput   = document.getElementById('timer-minutes');
    this.$sessionCnt = document.getElementById('session-count');

    // Restore session count (resets per page load — intentional daily counter)
    this.sessions = 0;
    this.$sessionCnt.textContent = 0;

    // Set ring total length
    this.$ring.style.strokeDasharray = this.CIRCUMFERENCE;

    // Bind controls
    this.$btnStart.addEventListener('click',  () => this.start());
    this.$btnStop.addEventListener('click',   () => this.pause());
    this.$btnReset.addEventListener('click',  () => this.reset());

    // Adjustable duration (only when stopped)
    this.$minInput.addEventListener('change', () => {
      if (this.running) return;
      const val = Math.max(1, Math.min(120, parseInt(this.$minInput.value, 10) || 25));
      this.$minInput.value = val;
      this.totalSeconds    = val * 60;
      this.remaining       = this.totalSeconds;
      this.renderDisplay();
      this.renderRing(1); // full ring
    });

    this.renderDisplay();
    this.renderRing(1);
  },

  start() {
    if (this.running) return;
    this.running = true;
    this.$minInput.disabled = true;

    this.$btnStart.disabled = true;
    this.$btnStop.disabled  = false;
    this.$statusLbl.textContent = 'Focusing…';
    this.$wrap.classList.add('running');

    this.interval = setInterval(() => {
      this.remaining--;

      if (this.remaining <= 0) {
        this.remaining = 0;
        this.renderDisplay();
        this.renderRing(0);
        this.complete();
        return;
      }

      this.renderDisplay();
      this.renderRing(this.remaining / this.totalSeconds);
    }, 1000);
  },

  pause() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.interval);

    this.$btnStart.disabled = false;
    this.$btnStop.disabled  = true;
    this.$statusLbl.textContent = 'Paused';
    this.$wrap.classList.remove('running');
  },

  reset() {
    this.pause();
    const val        = parseInt(this.$minInput.value, 10) || 25;
    this.totalSeconds = val * 60;
    this.remaining    = this.totalSeconds;
    this.$minInput.disabled     = false;
    this.$btnStart.disabled     = false;
    this.$statusLbl.textContent = 'Ready';
    this.renderDisplay();
    this.renderRing(1);
  },

  complete() {
    clearInterval(this.interval);
    this.running = false;
    this.sessions++;
    this.$sessionCnt.textContent = this.sessions;
    this.$btnStart.disabled = false;
    this.$btnStop.disabled  = true;
    this.$minInput.disabled = false;
    this.$statusLbl.textContent = 'Done! 🎉';
    this.$wrap.classList.remove('running');
    this.$wrap.classList.add('timer-done');
    setTimeout(() => this.$wrap.classList.remove('timer-done'), 2200);
    Toast.show(`Focus session complete! Session #${this.sessions} ✅`);
  },

  renderDisplay() {
    const m = Math.floor(this.remaining / 60);
    const s = this.remaining % 60;
    this.$display.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  },

  renderRing(ratio) {
    // ratio 1 = full, 0 = empty
    const offset = this.CIRCUMFERENCE * (1 - ratio);
    this.$ring.style.strokeDashoffset = offset;
  },
};

/* ============================================================
   5. TASKS — Add, edit, delete, complete, sort, persist
   ============================================================ */
const Tasks = {
  KEY: 'flow-tasks',
  editingId: null,

  init() {
    this.$list      = document.getElementById('task-list');
    this.$form      = document.getElementById('task-form');
    this.$input     = document.getElementById('task-input');
    this.$warn      = document.getElementById('task-warn');
    this.$badge     = document.getElementById('tasks-badge');
    this.$empty     = document.getElementById('tasks-empty');
    this.$sort      = document.getElementById('task-sort');
    this.$editModal = document.getElementById('edit-modal');
    this.$editInput = document.getElementById('edit-modal-input');

    // Load and render
    this.tasks = Storage.get(this.KEY, []);
    this.render();

    // Add task on form submit
    this.$form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addTask();
    });

    // Sort change
    this.$sort.addEventListener('change', () => this.render());

    // Edit modal: save
    document.getElementById('btn-edit-save').addEventListener('click', () => {
      this.saveEdit();
    });
    // Edit modal: cancel
    document.getElementById('btn-edit-cancel').addEventListener('click', () => {
      Modal.close('edit-modal');
    });
    // Edit modal: Enter key
    this.$editInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.saveEdit();
    });
  },

  /* Create a unique ID */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  addTask() {
    const text = this.$input.value.trim();
    this.$warn.textContent = '';

    if (!text) return;

    // Duplicate prevention (case-insensitive)
    const isDuplicate = this.tasks.some(
      t => t.text.toLowerCase() === text.toLowerCase()
    );
    if (isDuplicate) {
      this.$warn.textContent = '⚠ That task already exists.';
      setTimeout(() => { this.$warn.textContent = ''; }, 3000);
      return;
    }

    const task = { id: this.uid(), text, completed: false, createdAt: Date.now() };
    this.tasks.push(task);
    this.save();
    this.render();
    this.$input.value = '';
    this.$input.focus();
    Toast.show('Task added ✓');
  },

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.save();
    this.render();
  },

  toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) task.completed = !task.completed;
    this.save();
    this.render();
  },

  openEdit(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    this.editingId          = id;
    this.$editInput.value   = task.text;
    Modal.open('edit-modal');
    setTimeout(() => this.$editInput.focus(), 50);
  },

  saveEdit() {
    const newText = this.$editInput.value.trim();
    if (!newText) return;

    // Duplicate check (excluding self)
    const isDuplicate = this.tasks.some(
      t => t.id !== this.editingId && t.text.toLowerCase() === newText.toLowerCase()
    );
    if (isDuplicate) {
      Toast.show('⚠ Duplicate task name');
      return;
    }

    const task = this.tasks.find(t => t.id === this.editingId);
    if (task) task.text = newText;
    this.save();
    this.render();
    Modal.close('edit-modal');
    this.editingId = null;
    Toast.show('Task updated ✓');
  },

  getSorted() {
    const mode  = document.getElementById('task-sort').value;
    const copy  = [...this.tasks];

    switch (mode) {
      case 'az':
        return copy.sort((a, b) => a.text.localeCompare(b.text));
      case 'za':
        return copy.sort((a, b) => b.text.localeCompare(a.text));
      case 'done-last':
        return copy.sort((a, b) => Number(a.completed) - Number(b.completed));
      case 'done-first':
        return copy.sort((a, b) => Number(b.completed) - Number(a.completed));
      default:
        return copy; // insertion order
    }
  },

  render() {
    this.$list.innerHTML = '';
    const sorted = this.getSorted();

    sorted.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item${task.completed ? ' completed' : ''}`;
      li.dataset.id = task.id;

      li.innerHTML = `
        <input
          type="checkbox"
          class="task-check"
          ${task.completed ? 'checked' : ''}
          aria-label="Mark complete"
          title="Toggle complete"
        />
        <span class="task-text">${this.escapeHtml(task.text)}</span>
        <div class="task-actions">
          <button class="btn-task-action edit" title="Edit task" aria-label="Edit task">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-task-action delete" title="Delete task" aria-label="Delete task">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      `;

      // Checkbox toggle
      li.querySelector('.task-check').addEventListener('change', () => {
        this.toggleTask(task.id);
      });
      // Edit button
      li.querySelector('.btn-task-action.edit').addEventListener('click', () => {
        this.openEdit(task.id);
      });
      // Delete button
      li.querySelector('.btn-task-action.delete').addEventListener('click', () => {
        this.deleteTask(task.id);
      });

      this.$list.appendChild(li);
    });

    // Badge: done / total
    const done  = this.tasks.filter(t => t.completed).length;
    const total = this.tasks.length;
    this.$badge.textContent = `${done} / ${total}`;

    // Empty state
    this.$empty.classList.toggle('visible', total === 0);
  },

  save() {
    Storage.set(this.KEY, this.tasks);
  },

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

/* ============================================================
   6. LINKS — add, delete, open quick links
   ============================================================ */
const Links = {
  KEY: 'flow-links',

  init() {
    this.$form  = document.getElementById('link-form');
    this.$label = document.getElementById('link-label');
    this.$url   = document.getElementById('link-url');
    this.$grid  = document.getElementById('links-grid');
    this.$empty = document.getElementById('links-empty');
    this.$warn  = document.getElementById('link-warn');

    this.links = Storage.get(this.KEY, []);
    this.render();

    this.$form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addLink();
    });
  },

  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  normaliseUrl(raw) {
    let url = raw.trim();
    if (!url.match(/^https?:\/\//i)) url = 'https://' + url;
    return url;
  },

  getFaviconUrl(url) {
    try {
      const { hostname } = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
      return '';
    }
  },

  addLink() {
    const label = this.$label.value.trim();
    const rawUrl = this.$url.value.trim();
    this.$warn.textContent = '';

    if (!label || !rawUrl) {
      this.$warn.textContent = '⚠ Please fill in both label and URL.';
      setTimeout(() => { this.$warn.textContent = ''; }, 3000);
      return;
    }

    const url = this.normaliseUrl(rawUrl);

    // Validate URL
    try { new URL(url); } catch {
      this.$warn.textContent = '⚠ Invalid URL format.';
      setTimeout(() => { this.$warn.textContent = ''; }, 3000);
      return;
    }

    const link = { id: this.uid(), label, url };
    this.links.push(link);
    this.save();
    this.render();
    this.$label.value = '';
    this.$url.value   = '';
    this.$label.focus();
    Toast.show(`Link "${label}" saved ✓`);
  },

  deleteLink(id) {
    this.links = this.links.filter(l => l.id !== id);
    this.save();
    this.render();
  },

  render() {
    this.$grid.innerHTML = '';

    this.links.forEach(link => {
      const chip = document.createElement('div');
      chip.className = 'link-chip';
      chip.title     = link.url;

      const favicon = this.getFaviconUrl(link.url);
      // Extract short domain for subtitle
      let domain = '';
      try { domain = new URL(link.url).hostname.replace('www.', ''); } catch {}

      chip.innerHTML = `
        <img class="link-favicon" src="${favicon}" alt="" loading="lazy" onerror="this.style.display='none'" />
        <span class="link-label-text">${this.escapeHtml(link.label)}</span>
        <span class="link-url-text">${this.escapeHtml(domain)}</span>
        <button class="btn-link-delete" title="Remove link" aria-label="Remove link">✕</button>
      `;

      // Open link on chip click (except delete button)
      chip.addEventListener('click', (e) => {
        if (e.target.closest('.btn-link-delete')) return;
        window.open(link.url, '_blank', 'noopener,noreferrer');
      });

      // Delete
      chip.querySelector('.btn-link-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteLink(link.id);
      });

      this.$grid.appendChild(chip);
    });

    this.$empty.classList.toggle('visible', this.links.length === 0);
  },

  save() {
    Storage.set(this.KEY, this.links);
  },

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};

/* ============================================================
   7. USERNAME — personalise the greeting
   ============================================================ */
const UserName = {
  KEY: 'flow-username',

  init() {
    this.$btn         = document.getElementById('btn-set-name');
    this.$display     = document.getElementById('display-username');
    this.$modalInput  = document.getElementById('name-modal-input');

    const saved = Storage.get(this.KEY, '');
    this.updateDisplay(saved);

    // Open modal on click
    this.$btn.addEventListener('click', () => {
      this.$modalInput.value = Storage.get(this.KEY, '');
      Modal.open('name-modal');
      setTimeout(() => this.$modalInput.focus(), 50);
    });

    // Save
    document.getElementById('btn-name-save').addEventListener('click', () => {
      this.save();
    });
    // Cancel
    document.getElementById('btn-name-cancel').addEventListener('click', () => {
      Modal.close('name-modal');
    });
    // Enter to save
    this.$modalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.save();
    });
  },

  save() {
    const name = document.getElementById('name-modal-input').value.trim();
    Storage.set(this.KEY, name);
    this.updateDisplay(name);
    Modal.close('name-modal');
    Toast.show(name ? `Welcome, ${name}! 👋` : 'Name cleared');
  },

  updateDisplay(name) {
    document.getElementById('display-username').textContent = name || 'Set name';
  },
};

/* ============================================================
   8. MODAL — open / close helper
   ============================================================ */
const Modal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  },
};

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
    }
  });
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

/* ============================================================
   9. TOAST — brief status notification
   ============================================================ */
const Toast = {
  $el: null,
  timer: null,

  init() {
    this.$el = document.getElementById('toast');
  },

  show(msg, duration = 2800) {
    if (!this.$el) return;
    this.$el.textContent = msg;
    this.$el.classList.add('show');

    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.$el.classList.remove('show');
    }, duration);
  },
};

/* ============================================================
   APP BOOTSTRAP — initialise all modules on DOMContentLoaded
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  Toast.init();
  Theme.init();
  Clock.init();
  Timer.init();
  Tasks.init();
  Links.init();
  UserName.init();
});