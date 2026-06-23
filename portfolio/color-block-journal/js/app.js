// js/app.js — App pipeline orchestrator.
// Assembles filters, builds a pipeline, runs it on DOMContentLoaded.
// Uses cup-pipe.js (JS runtime) — same Payload/Filter/Pipeline API.
//
// Pattern: one filter per file in js/filters/. This file only wires them.
//
// Docs: CONCEPTS.md (core types), cup-ui/docs/cup-pipe.js (JS runtime API),
//       .claude/skills/cup-ui-runtime/SKILL.md (JS vs WASM, when to use which)

import { Payload, Pipeline } from '../cup-ui/docs/cup-pipe.js';
import { WireTheme } from './filters/wire_theme.js';
import { WireJournal } from './filters/wire_journal.js';
import { CheckOffline } from './filters/check_offline.js';

// ── Build the app pipeline ──
function buildAppPipeline() {
  const pipeline = new Pipeline();
  pipeline.addFilter(new WireTheme(), 'wire_theme');
  pipeline.addFilter(new WireJournal(), 'wire_journal');
  pipeline.addFilter(new CheckOffline(), 'check_offline');
  return pipeline;
}

// ── Run on DOM ready ──
document.addEventListener('DOMContentLoaded', async () => {
  const pipeline = buildAppPipeline();
  const payload = new Payload({ app: 'color-block-journal', startedAt: Date.now() });

  try {
    const result = await pipeline.run(payload);
    console.log('[cup-app] Pipeline complete:', result.toDict());
  } catch (err) {
    console.error('[cup-app] Pipeline error:', err);
  }
});
