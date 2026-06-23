// js/filters/wire_journal.js — Core behavior for the Color-Block Journal.

const STORAGE_ENTRIES_KEY = 'cbj.entries.v1';
const STORAGE_STATE_KEY = 'cbj.state.v1';

const PENS = [
  { id: 'sunrise', label: 'Sunrise' },
  { id: 'harbor', label: 'Harbor' },
  { id: 'fern', label: 'Fern' },
  { id: 'gold', label: 'Gold' },
  { id: 'plum', label: 'Plum' },
  { id: 'interrupt', label: 'Interrupt' },
];

const PEN_MAP = PENS.reduce((acc, pen) => {
  acc[pen.id] = pen;
  return acc;
}, {});

const FOCUS_PENS = PENS.filter((pen) => pen.id !== 'interrupt').map((pen) => pen.id);

function parseStored(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'entry-' + String(Date.now()) + '-' + String(Math.random()).slice(2);
}

function getPenLabel(penId) {
  return PEN_MAP[penId] ? PEN_MAP[penId].label : PEN_MAP.sunrise.label;
}

function getKindLabel(kind) {
  if (kind === 'interrupt') return 'Interruption';
  if (kind === 'break') return 'Break';
  return 'Pause';
}

export class WireJournal {
  call(payload) {
    const penRack = document.getElementById('pen-rack');
    const penButtons = Array.from(document.querySelectorAll('.pen-btn[data-pen]'));
    const nextPenButton = document.getElementById('next-pen');
    const activePenLabel = document.getElementById('active-pen-label');
    const pauseForm = document.getElementById('pause-form');
    const pauseInput = document.getElementById('pause-input');
    const logBreakButton = document.getElementById('log-break');
    const interruptForm = document.getElementById('interrupt-form');
    const interruptInput = document.getElementById('interrupt-input');
    const clearDayButton = document.getElementById('clear-day');
    const timeline = document.getElementById('timeline');
    const colorMap = document.getElementById('color-map');
    const flowSummary = document.getElementById('flow-summary');
    const storyStats = document.getElementById('story-stats');

    if (
      !penRack ||
      !penButtons.length ||
      !nextPenButton ||
      !activePenLabel ||
      !pauseForm ||
      !pauseInput ||
      !logBreakButton ||
      !interruptForm ||
      !interruptInput ||
      !clearDayButton ||
      !timeline ||
      !colorMap ||
      !flowSummary ||
      !storyStats
    ) {
      return payload;
    }

    let entries = parseStored(localStorage.getItem(STORAGE_ENTRIES_KEY), []);
    if (!Array.isArray(entries)) entries = [];

    const savedState = parseStored(localStorage.getItem(STORAGE_STATE_KEY), {});
    let activePen = PEN_MAP[savedState.activePen] ? savedState.activePen : FOCUS_PENS[0];

    const saveEntries = () => {
      localStorage.setItem(STORAGE_ENTRIES_KEY, JSON.stringify(entries));
    };

    const saveState = () => {
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify({ activePen: activePen }));
    };

    const showToast = (message, variant) => {
      const toast = document.createElement('cup-toast');
      toast.setAttribute('variant', variant || 'info');
      toast.textContent = message;
      document.body.appendChild(toast);
    };

    const setActivePen = (penId) => {
      if (!PEN_MAP[penId]) return;
      activePen = penId;
      penButtons.forEach((button) => {
        const isActive = button.dataset.pen === activePen;
        button.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
      activePenLabel.textContent = 'Current color: ' + getPenLabel(activePen);
      saveState();
    };

    const appendEntry = (text, penId, kind) => {
      const cleaned = normalizeText(text);
      if (!cleaned) return false;

      entries.push({
        id: makeId(),
        text: cleaned,
        penId: PEN_MAP[penId] ? penId : FOCUS_PENS[0],
        kind: kind || 'pause',
      });

      saveEntries();
      render();
      return true;
    };

    const renderColorMap = () => {
      colorMap.innerHTML = '';

      if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'timeline-empty';
        empty.textContent = 'No blocks yet. Log your first pause.';
        colorMap.appendChild(empty);
        return;
      }

      const fragment = document.createDocumentFragment();
      entries.forEach((entry) => {
        const block = document.createElement('span');
        block.className = 'color-block pen--' + entry.penId;
        block.title = getPenLabel(entry.penId) + ': ' + entry.text;
        fragment.appendChild(block);
      });
      colorMap.appendChild(fragment);
    };

    const renderTimeline = () => {
      timeline.innerHTML = '';

      if (!entries.length) {
        const empty = document.createElement('li');
        empty.className = 'timeline-empty';
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

        const pen = document.createElement('span');
        pen.textContent = getPenLabel(entry.penId);

        const kind = document.createElement('span');
        kind.className = 'entry-kind';
        kind.textContent = getKindLabel(entry.kind);

        const text = document.createElement('p');
        text.className = 'entry-text';
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
        storyStats.textContent = '';
        return;
      }

      let switches = 0;
      for (let i = 1; i < entries.length; i += 1) {
        if (entries[i - 1].penId !== entries[i].penId) switches += 1;
      }

      const interruptions = entries.filter((entry) => entry.kind === 'interrupt').length;
      const focusOnly = entries.filter((entry) => entry.kind !== 'interrupt');

      const runLengths = [];
      let currentPen = '';
      let currentRun = 0;
      focusOnly.forEach((entry) => {
        if (entry.penId === currentPen) {
          currentRun += 1;
          return;
        }

        if (currentRun > 0) runLengths.push(currentRun);
        currentPen = entry.penId;
        currentRun = 1;
      });
      if (currentRun > 0) runLengths.push(currentRun);

      const avgRun = runLengths.length
        ? runLengths.reduce((sum, value) => sum + value, 0) / runLengths.length
        : 0;
      const switchRate = entries.length > 1 ? switches / (entries.length - 1) : 0;

      if (avgRun >= 2.3 && switchRate < 0.5 && interruptions <= 2) {
        flowSummary.textContent = 'Big, clean color blocks: you protected deep focus and stayed with one thing at a time.';
      } else if (switchRate >= 0.7 || interruptions >= 4) {
        flowSummary.textContent = 'Choppy color changes: today demanded a lot of context-switching energy. No guilt, just signal.';
      } else {
        flowSummary.textContent = 'Mixed pattern: you found focus stretches and still handled real-life interruptions with intention.';
      }

      storyStats.textContent =
        String(entries.length) +
        ' blocks  |  ' +
        String(switches) +
        ' shifts  |  ' +
        String(interruptions) +
        ' interruptions isolated';
    };

    const render = () => {
      renderColorMap();
      renderTimeline();
      renderStory();
    };

    penButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setActivePen(button.dataset.pen || FOCUS_PENS[0]);
      });
    });

    penRack.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

      const activeIndex = penButtons.findIndex((button) => button.dataset.pen === activePen);
      if (activeIndex < 0) return;

      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (activeIndex + delta + penButtons.length) % penButtons.length;
      const nextButton = penButtons[nextIndex];
      if (!nextButton) return;

      nextButton.focus();
      setActivePen(nextButton.dataset.pen || FOCUS_PENS[0]);
      event.preventDefault();
    });

    nextPenButton.addEventListener('click', () => {
      const currentFocusPen = activePen === 'interrupt' ? FOCUS_PENS[0] : activePen;
      const idx = FOCUS_PENS.indexOf(currentFocusPen);
      const next = FOCUS_PENS[(idx + 1) % FOCUS_PENS.length];
      setActivePen(next);
    });

    pauseForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const note = normalizeText(pauseInput.value);

      if (!note) {
        showToast('Write a short pause line first.', 'warning');
        return;
      }

      const ok = appendEntry(note, activePen, 'pause');
      if (!ok) return;

      pauseForm.reset();
      pauseInput.focus();
    });

    logBreakButton.addEventListener('click', () => {
      const ok = appendEntry('Break boundary. Returning with fresh focus.', activePen, 'break');
      if (!ok) return;

      const idx = FOCUS_PENS.indexOf(activePen === 'interrupt' ? FOCUS_PENS[0] : activePen);
      const next = FOCUS_PENS[(idx + 1) % FOCUS_PENS.length];
      setActivePen(next);
    });

    interruptForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const note = normalizeText(interruptInput.value);

      if (!note) {
        showToast('Capture the interruption with a word or two.', 'warning');
        return;
      }

      const returnPen = activePen === 'interrupt' ? FOCUS_PENS[0] : activePen;
      const ok = appendEntry(note, 'interrupt', 'interrupt');
      if (!ok) return;

      interruptForm.reset();
      interruptInput.focus();
      setActivePen(returnPen);
      showToast('Interruption isolated. Return to your main color.', 'success');
    });

    clearDayButton.addEventListener('click', () => {
      const shouldClear = window.confirm('Start a fresh page and clear today\'s sequence?');
      if (!shouldClear) return;

      entries = [];
      saveEntries();
      render();
      showToast('Fresh page ready.', 'info');
    });

    setActivePen(activePen);
    render();

    return payload
      .insert('journal_wired', true)
      .insert('entry_count', entries.length)
      .insert('active_pen', activePen);
  }
}
