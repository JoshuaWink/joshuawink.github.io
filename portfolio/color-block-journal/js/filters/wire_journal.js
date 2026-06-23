// js/filters/wire_journal.js — Core behavior for the Color-Block Journal.
//
// Two cup-canvas elements are wired here:
//   #journal-canvas  — the main writing surface. Draws in the active pen color
//                      with journal-paper ruled lines as the background.
//   #story-canvas    — read-only visualization. Renders proportional color bands
//                      representing the day's entry sequence.

const STORAGE_ENTRIES_KEY = 'cbj.entries.v1';
const STORAGE_STATE_KEY = 'cbj.state.v1';

const PENS = [
  { id: 'sunrise', label: 'Sunrise' },
  { id: 'harbor',  label: 'Harbor'  },
  { id: 'fern',    label: 'Fern'    },
  { id: 'gold',    label: 'Gold'    },
  { id: 'plum',    label: 'Plum'    },
  { id: 'interrupt', label: 'Interrupt' },
];

const PEN_MAP = PENS.reduce((acc, pen) => { acc[pen.id] = pen; return acc; }, {});
const FOCUS_PENS = PENS.filter((p) => p.id !== 'interrupt').map((p) => p.id);

// CSS custom-property that carries each pen's resolved color.
const PEN_COLOR_VARS = {
  sunrise:   '--cup-color-primary',
  harbor:    '--cup-color-info',
  fern:      '--cup-color-success',
  gold:      '--cup-color-warning',
  plum:      '--cup-color-secondary',
  interrupt: '--cup-color-error',
};

function parseStored(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (_) { return fallback; }
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'entry-' + Date.now() + '-' + String(Math.random()).slice(2);
}

function getPenLabel(penId)  { return PEN_MAP[penId]  ? PEN_MAP[penId].label  : PEN_MAP.sunrise.label; }
function getKindLabel(kind)  {
  if (kind === 'interrupt') return 'Interruption';
  if (kind === 'break')     return 'Break';
  return 'Pause';
}

/** Read a CSS custom property from :root at runtime. */
function resolvePenColor(penId) {
  const varName = PEN_COLOR_VARS[penId] || '--cup-color-primary';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

export class WireJournal {
  call(payload) {
    // ── Required DOM refs ────────────────────────────────────────────────────
    const penRack       = document.getElementById('pen-rack');
    const penButtons    = Array.from(document.querySelectorAll('.pen-dot[data-pen], .pen-btn[data-pen]'));
    const nextPenButton = document.getElementById('next-pen');
    const activePenLabel= document.getElementById('active-pen-label');
    const pauseForm     = document.getElementById('pause-form');
    const pauseInput    = document.getElementById('pause-input');
    const logBreakButton= document.getElementById('log-break');
    const interruptForm = document.getElementById('interrupt-form');
    const interruptInput= document.getElementById('interrupt-input');
    const clearDayButton= document.getElementById('clear-day');
    const timeline      = document.getElementById('timeline');
    const flowSummary   = document.getElementById('flow-summary');
    const storyStats    = document.getElementById('story-stats');

    if (
      !penRack || !penButtons.length || !nextPenButton || !activePenLabel ||
      !pauseForm || !pauseInput || !logBreakButton ||
      !interruptForm || !interruptInput || !clearDayButton ||
      !timeline || !flowSummary || !storyStats
    ) { return payload; }

    // cup-canvas elements — optional, degrade gracefully if absent.
    const journalCanvas = document.getElementById('journal-canvas');
    const storyCanvas   = document.getElementById('story-canvas');

    // ── State ────────────────────────────────────────────────────────────────
    let entries = parseStored(localStorage.getItem(STORAGE_ENTRIES_KEY), []);
    if (!Array.isArray(entries)) entries = [];

    const savedState = parseStored(localStorage.getItem(STORAGE_STATE_KEY), {});
    let activePen = PEN_MAP[savedState.activePen] ? savedState.activePen : FOCUS_PENS[0];

    const saveEntries = () => localStorage.setItem(STORAGE_ENTRIES_KEY, JSON.stringify(entries));
    const saveState   = () => localStorage.setItem(STORAGE_STATE_KEY,   JSON.stringify({ activePen }));

    const showToast = (message, variant) => {
      const toast = document.createElement('cup-toast');
      toast.setAttribute('variant', variant || 'info');
      toast.textContent = message;
      document.body.appendChild(toast);
    };

    // ── Journal canvas: paper texture ────────────────────────────────────────

    const initJournalCanvasPaper = () => {
      if (!journalCanvas) return;

      journalCanvas.drawBackground = function(ctx, w, h) {
        const style = getComputedStyle(document.documentElement);

        // Paper surface
        ctx.fillStyle = style.getPropertyValue('--cup-color-surface-alt').trim() || '#1a1b2e';
        ctx.fillRect(0, 0, w, h);

        // Ruled lines (journal paper feel)
        const lineSpacing = 30;
        const leftMargin  = 52;
        ctx.strokeStyle  = style.getPropertyValue('--cup-color-border').trim() || 'rgba(255,255,255,0.06)';
        ctx.lineWidth    = 0.5;
        ctx.globalAlpha  = 0.55;

        for (let y = lineSpacing * 1.5; y < h; y += lineSpacing) {
          ctx.beginPath();
          ctx.moveTo(leftMargin, y);
          ctx.lineTo(w - 20, y);
          ctx.stroke();
        }

        // Margin rule (the classic red line)
        ctx.strokeStyle = style.getPropertyValue('--cup-color-error').trim() || '#ef4444';
        ctx.lineWidth   = 1;
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.moveTo(leftMargin - 10, 0);
        ctx.lineTo(leftMargin - 10, h);
        ctx.stroke();

        ctx.globalAlpha = 1;
      };

      journalCanvas.redraw();
    };

    /** Update the journal canvas line color + width to match the active pen. */
    const updateJournalCanvasColor = () => {
      if (!journalCanvas) return;
      const color = resolvePenColor(activePen);
      if (color) journalCanvas.setAttribute('line-color', color);
      // Interrupt strokes are thinner — a quick scratch, not a deliberate line.
      journalCanvas.setAttribute('line-width', activePen === 'interrupt' ? '1' : '2');
    };

    // ── Story canvas: color-band visualization ───────────────────────────────

    /**
     * Renders a proportional sequence of rounded color bands representing
     * today's entries. Interruption entries appear shorter (top-centered).
     * Uses the cup-canvas drawBackground override — no stroke interaction.
     */
    const renderStoryCanvas = () => {
      if (!storyCanvas) return;

      // Prevent any stroke input on the story canvas.
      storyCanvas.drawStroke = () => {};

      storyCanvas.drawBackground = function(ctx, w, h) {
        const style = getComputedStyle(document.documentElement);

        // Base fill
        ctx.fillStyle = style.getPropertyValue('--cup-color-surface').trim() || '#111820';
        ctx.fillRect(0, 0, w, h);

        if (!entries.length) {
          ctx.fillStyle = style.getPropertyValue('--cup-color-text-muted').trim() || '#555';
          ctx.font = `${Math.max(10, Math.round(h * 0.19))}px system-ui, sans-serif`;
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('No blocks yet. Log your first pause.', w / 2, h / 2);
          return;
        }

        const gap    = 2;
        const blockW = Math.max(3, (w - (entries.length - 1) * gap) / entries.length);

        entries.forEach((entry, i) => {
          const x       = i * (blockW + gap);
          const color   = resolvePenColor(entry.penId);
          const isInt   = entry.kind === 'interrupt';
          const blockH  = isInt ? h * 0.36 : h * 0.74;
          const y       = (h - blockH) / 2;

          ctx.fillStyle   = color || '#4fc3f7';
          ctx.globalAlpha = isInt ? 0.55 : 0.88;

          const r = Math.min(4, blockW / 2, blockH / 2);
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, blockW, blockH, r);
          } else {
            // Fallback for older browsers
            ctx.rect(x, y, blockW, blockH);
          }
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      };

      storyCanvas.redraw();
    };

    // ── Pen management ───────────────────────────────────────────────────────

    const setActivePen = (penId) => {
      if (!PEN_MAP[penId]) return;
      activePen = penId;
      penButtons.forEach((btn) => {
        btn.setAttribute('aria-checked', btn.dataset.pen === activePen ? 'true' : 'false');
      });
      activePenLabel.textContent = getPenLabel(activePen);
      updateJournalCanvasColor();
      saveState();
    };

    // ── Entry management ─────────────────────────────────────────────────────

    const appendEntry = (text, penId, kind) => {
      const cleaned = normalizeText(text);
      if (!cleaned) return false;
      entries.push({
        id:    makeId(),
        text:  cleaned,
        penId: PEN_MAP[penId] ? penId : FOCUS_PENS[0],
        kind:  kind || 'pause',
      });
      saveEntries();
      render();
      return true;
    };

    // ── Rendering ────────────────────────────────────────────────────────────

    const renderTimeline = () => {
      timeline.innerHTML = '';

      if (!entries.length) {
        const empty = document.createElement('li');
        empty.className   = 'timeline-empty';
        empty.textContent = 'Your sequence appears here as you move through transitions.';
        timeline.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      entries.forEach((entry) => {
        const item = document.createElement('li');
        item.className = 'timeline-entry pen--' + entry.penId;

        const head = document.createElement('div');
        head.className = 'entry-head';

        const pen  = document.createElement('span');
        pen.textContent = getPenLabel(entry.penId);

        const kind = document.createElement('span');
        kind.className   = 'entry-kind';
        kind.textContent = getKindLabel(entry.kind);

        const text = document.createElement('p');
        text.className   = 'entry-text';
        text.textContent = entry.text;

        head.appendChild(pen);
        head.appendChild(kind);
        item.appendChild(head);
        item.appendChild(text);
        fragment.appendChild(item);
      });

      timeline.appendChild(fragment);
    };

    const renderStory = () => {
      if (!entries.length) {
        flowSummary.textContent = 'Add your first pause to begin the story of today.';
        storyStats.textContent  = '';
        return;
      }

      let switches = 0;
      for (let i = 1; i < entries.length; i++) {
        if (entries[i - 1].penId !== entries[i].penId) switches++;
      }

      const interruptions = entries.filter((e) => e.kind === 'interrupt').length;
      const focusOnly     = entries.filter((e) => e.kind !== 'interrupt');

      const runLengths = [];
      let currentPen = '', currentRun = 0;
      focusOnly.forEach((e) => {
        if (e.penId === currentPen) { currentRun++; return; }
        if (currentRun > 0) runLengths.push(currentRun);
        currentPen = e.penId; currentRun = 1;
      });
      if (currentRun > 0) runLengths.push(currentRun);

      const avgRun    = runLengths.length ? runLengths.reduce((s, v) => s + v, 0) / runLengths.length : 0;
      const switchRate= entries.length > 1 ? switches / (entries.length - 1) : 0;

      if (avgRun >= 2.3 && switchRate < 0.5 && interruptions <= 2) {
        flowSummary.textContent = 'Big, clean color blocks: you protected deep focus and stayed with one thing at a time.';
      } else if (switchRate >= 0.7 || interruptions >= 4) {
        flowSummary.textContent = 'Choppy color changes: today demanded a lot of context-switching energy. No guilt, just signal.';
      } else {
        flowSummary.textContent = 'Mixed pattern: you found focus stretches and handled real-life interruptions with intention.';
      }

      storyStats.textContent = `${entries.length} blocks  |  ${switches} shifts  |  ${interruptions} interruptions isolated`;
    };

    const render = () => {
      renderStoryCanvas();
      renderTimeline();
      renderStory();
    };

    // ── Event wiring ─────────────────────────────────────────────────────────

    penButtons.forEach((btn) => {
      btn.addEventListener('click', () => setActivePen(btn.dataset.pen || FOCUS_PENS[0]));
    });

    penRack.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const idx = penButtons.findIndex((b) => b.dataset.pen === activePen);
      if (idx < 0) return;
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const next  = penButtons[(idx + delta + penButtons.length) % penButtons.length];
      if (!next) return;
      next.focus();
      setActivePen(next.dataset.pen || FOCUS_PENS[0]);
      e.preventDefault();
    });

    nextPenButton.addEventListener('click', () => {
      const base  = activePen === 'interrupt' ? FOCUS_PENS[0] : activePen;
      const idx   = FOCUS_PENS.indexOf(base);
      const next  = FOCUS_PENS[(idx + 1) % FOCUS_PENS.length];
      setActivePen(next);
    });

    pauseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const note = normalizeText(pauseInput.value);
      if (!note) { showToast('Write a short pause line first.', 'warning'); return; }
      if (!appendEntry(note, activePen, 'pause')) return;
      pauseForm.reset();
      pauseInput.focus();
    });

    logBreakButton.addEventListener('click', () => {
      if (!appendEntry('Break boundary. Returning with fresh focus.', activePen, 'break')) return;
      const base = activePen === 'interrupt' ? FOCUS_PENS[0] : activePen;
      const idx  = FOCUS_PENS.indexOf(base);
      setActivePen(FOCUS_PENS[(idx + 1) % FOCUS_PENS.length]);
    });

    interruptForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const note = normalizeText(interruptInput.value);
      if (!note) { showToast('Capture the interruption with a word or two.', 'warning'); return; }
      const returnPen = activePen === 'interrupt' ? FOCUS_PENS[0] : activePen;
      if (!appendEntry(note, 'interrupt', 'interrupt')) return;
      interruptForm.reset();
      interruptInput.focus();
      setActivePen(returnPen);
      showToast('Interruption isolated. Return to your main color.', 'success');
    });

    clearDayButton.addEventListener('click', () => {
      if (!window.confirm("Start a fresh page and clear today's sequence?")) return;
      entries = [];
      saveEntries();
      if (journalCanvas) journalCanvas.clear();
      render();
      showToast('Fresh page ready.', 'info');
    });

    // ── Init ─────────────────────────────────────────────────────────────────

    initJournalCanvasPaper();
    setActivePen(activePen);
    render();

    return payload
      .insert('journal_wired', true)
      .insert('entry_count',   entries.length)
      .insert('active_pen',    activePen);
  }
}
