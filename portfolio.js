import { Payload, Pipeline } from './cup-ui/docs/cup-pipe.js';

const GITHUB_USER = 'JoshuaWink';
const GITHUB_PAGES_ROOT = 'https://joshuawink.github.io';
const GITHUB_REPO_ROOT = `https://github.com/${GITHUB_USER}`;
const SEARCH_MENU_LIMIT = 8;

/*
 * FOLIO_DEFS — auto-grouping rules.
 * Any project whose name matches `match` bundles into that folio.
 * Folios render as collapsible groups; unmatched projects stay standalone.
 */
const FOLIO_DEFS = [
  {
    id: 'dbqhelp',
    title: 'DBQ Help',
    description: 'Veteran mental health evaluation service — design iterations and prototypes',
    match: /dbqhelp/i,
  },
];

const SEED_REPOS = [
  {
    name: 'dbqhelp',
    description: 'DBQHelp.com redesign prototype - veteran mental health evaluation service',
    homepage: null,
    updated_at: '2026-04-05T00:53:00Z',
  },
  {
    name: 'dbqhelp-mockup-a',
    description: 'DBQ Help - Design Mockup A',
    homepage: null,
    updated_at: '2026-04-21T22:58:49Z',
  },
  {
    name: 'dbqhelp-mockup-b',
    description: 'DBQ Help - Design Mockup B',
    homepage: null,
    updated_at: '2026-04-21T22:58:42Z',
  },
  {
    name: 'dbqhelp-mockup-c',
    description: 'DBQ Help - Design Mockup C',
    homepage: null,
    updated_at: '2026-04-21T22:58:54Z',
  },
  {
    name: 'dbqhelp-staging',
    description: 'DBQ Help - staging preview site',
    homepage: null,
    updated_at: '2026-04-21T21:22:59Z',
  },
  {
    name: 'mvp-dbqhelp',
    description: 'DBQ Help veteran evaluation prototype - built on cup/core design system',
    homepage: null,
    updated_at: '2026-04-21T21:27:21Z',
  },
  {
    name: 'space-invaders',
    description: 'Space Invaders Intel 8080 emulator - Rust/WASM',
    homepage: 'https://joshuawink.github.io/space-invaders',
    updated_at: '2026-04-22T01:39:17Z',
  },
  {
    name: 'zero-trust-deploy-config',
    description: 'Zero-trust deployment configuration router - validate env vars against platform contracts, export deployment-ready configs. Runs entirely in-browser.',
    homepage: null,
    updated_at: '2026-03-16T04:50:57Z',
  },
];

const state = {
  projects: [],
  filteredProjects: [],
  activeIndex: -1,
  menuOpen: false,
  wired: false,
  dataSource: 'seed',
  status: 'Starting cached project index...',
  error: null,
  lastScannedAt: null,
};

const refs = {
  projectGrid: document.querySelector('#project-grid'),
  projectMenu: document.querySelector('#project-menu'),
  projectSearch: document.querySelector('#project-search'),
  projectTotal: document.querySelector('#project-total'),
  scanSourceLabel: document.querySelector('#scan-source-label'),
  scanStatus: document.querySelector('#scan-status'),
  scanUpdated: document.querySelector('#scan-updated'),
  searchForm: document.querySelector('#project-jump-form'),
  searchHint: document.querySelector('#search-hint'),
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function humanizeName(name) {
  const knownTokens = {
    api: 'API',
    dbqhelp: 'DBQHelp',
    gh: 'GH',
    mvp: 'MVP',
    ui: 'UI',
    wasm: 'WASM',
  };

  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => {
      const token = knownTokens[part.toLowerCase()];

      if (token) {
        return token;
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function ensureTrailingSlash(url) {
  if (!url) {
    return url;
  }

  return /[/?#]$/.test(url) ? url : `${url}/`;
}

function formatUpdatedLabel(updatedAt) {
  const timestamp = Date.parse(updatedAt);

  if (Number.isNaN(timestamp)) {
    return 'Unknown';
  }

  return dateFormatter.format(new Date(timestamp));
}

function normalizeRepo(repo) {
  if (!repo || !repo.name || repo.name === 'joshuawink.github.io') {
    return null;
  }

  const homepage = typeof repo.homepage === 'string' ? repo.homepage.trim() : '';
  const url = homepage.startsWith(GITHUB_PAGES_ROOT)
    ? ensureTrailingSlash(homepage)
    : `${GITHUB_PAGES_ROOT}/${repo.name}/`;
  const updatedAt = repo.updated_at || new Date().toISOString();
  const updatedAtMs = Date.parse(updatedAt) || 0;
  const title = humanizeName(repo.name);
  const description = (repo.description || 'GitHub Pages project published under joshuawink.github.io.').trim();

  return {
    description,
    name: repo.name,
    repoUrl: repo.html_url || `${GITHUB_REPO_ROOT}/${repo.name}`,
    searchable: [repo.name, title, description, url].join(' ').toLowerCase(),
    title,
    updatedAt,
    updatedAtMs,
    updatedLabel: formatUpdatedLabel(updatedAt),
    url,
  };
}

function dedupeProjects(rawRepos) {
  const byName = new Map();

  for (const repo of rawRepos) {
    const normalized = normalizeRepo(repo);

    if (!normalized) {
      continue;
    }

    const existing = byName.get(normalized.name);

    if (!existing || normalized.updatedAtMs >= existing.updatedAtMs) {
      byName.set(normalized.name, normalized);
    }
  }

  return Array.from(byName.values()).sort((left, right) => {
    if (right.updatedAtMs !== left.updatedAtMs) {
      return right.updatedAtMs - left.updatedAtMs;
    }

    return left.name.localeCompare(right.name);
  });
}

function filterProjects(projects, query) {
  const cleaned = query.trim().toLowerCase();

  if (!cleaned) {
    return [...projects];
  }

  return projects.filter((project) => project.searchable.includes(cleaned));
}

/**
 * Group projects into folios and standalone items.
 * Returns { folios: [...], standalone: [...] }
 */
function groupIntoFolios(projects) {
  const folios = [];
  const claimed = new Set();

  for (const def of FOLIO_DEFS) {
    const members = projects.filter((p) => def.match.test(p.name));

    if (members.length < 2) {
      continue;
    }

    for (const m of members) {
      claimed.add(m.name);
    }

    const latestMs = Math.max(...members.map((m) => m.updatedAtMs));
    const latestMember = members.find((m) => m.updatedAtMs === latestMs) || members[0];

    folios.push({
      id: def.id,
      title: def.title,
      description: def.description,
      members: members,
      count: members.length,
      updatedAtMs: latestMs,
      updatedLabel: latestMember.updatedLabel,
    });
  }

  const standalone = projects.filter((p) => !claimed.has(p.name));

  // Sort folios + standalone together by most recent update
  folios.sort((a, b) => b.updatedAtMs - a.updatedAtMs);

  return { folios, standalone };
}

function getVisibleProjects() {
  return state.filteredProjects.slice(0, SEARCH_MENU_LIMIT);
}

function syncFilteredProjects() {
  state.filteredProjects = filterProjects(state.projects, refs.projectSearch.value);

  if (!state.filteredProjects.length) {
    state.activeIndex = -1;
    return;
  }

  if (state.activeIndex < 0 || state.activeIndex >= Math.min(state.filteredProjects.length, SEARCH_MENU_LIMIT)) {
    state.activeIndex = 0;
  }
}

function openMenu() {
  if (!state.filteredProjects.length) {
    closeMenu();
    return;
  }

  state.menuOpen = true;
  refs.projectMenu.hidden = false;
  refs.projectSearch.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
  state.menuOpen = false;
  refs.projectMenu.hidden = true;
  refs.projectSearch.setAttribute('aria-expanded', 'false');
}

function updateHeaderMeta() {
  refs.projectTotal.textContent = String(state.projects.length);

  const sourceLabel = state.dataSource === 'live' ? 'Live scan' : 'Cached';
  refs.scanSourceLabel.textContent = sourceLabel;

  if (state.lastScannedAt) {
    refs.scanUpdated.textContent = `Last scanned ${formatUpdatedLabel(state.lastScannedAt)}`;
  } else {
    refs.scanUpdated.textContent = '';
  }

  refs.scanStatus.textContent = state.error
    ? `${state.status} (${state.error})`
    : state.status;
}

function updateSearchHint() {
  const query = refs.projectSearch.value.trim();
  const matchCount = state.filteredProjects.length;

  if (!query) {
    refs.searchHint.innerHTML = `<span id="project-total">${state.projects.length}</span> projects · <span id="scan-source-label">${state.dataSource === 'live' ? 'Live scan' : 'Cached'}</span>`;
    refs.projectTotal = document.querySelector('#project-total');
    refs.scanSourceLabel = document.querySelector('#scan-source-label');
    return;
  }

  if (!matchCount) {
    refs.searchHint.textContent = `No matches for "${query}"`;
    return;
  }

  refs.searchHint.textContent = `${matchCount} match${matchCount === 1 ? '' : 'es'}`;
}

function renderMenu() {
  const visibleProjects = getVisibleProjects();

  if (!state.menuOpen || !visibleProjects.length) {
    closeMenu();
    refs.projectMenu.innerHTML = '';
    return;
  }

  refs.projectMenu.innerHTML = visibleProjects.map((project, index) => `
    <button
      class="site-menu-item"
      type="button"
      role="option"
      data-index="${index}"
      data-url="${escapeHtml(project.url)}"
      aria-selected="${index === state.activeIndex ? 'true' : 'false'}"
      ${index === state.activeIndex ? 'data-active="true"' : ''}
    >
      <span class="site-menu-item__title">${escapeHtml(project.title)}</span>
      <span class="site-menu-item__meta">${escapeHtml(project.name)} · Updated ${escapeHtml(project.updatedLabel)}</span>
    </button>
  `).join('');

  refs.projectMenu.hidden = false;
  refs.projectSearch.setAttribute('aria-expanded', 'true');
}

function renderGrid() {
  if (!state.filteredProjects.length) {
    refs.projectGrid.innerHTML = `
      <article class="cup-card site-empty">
        <div class="cup-card___body">
          <h3>No projects match your search</h3>
          <p>Try a different keyword.</p>
        </div>
      </article>
    `;
    return;
  }

  const { folios, standalone } = groupIntoFolios(state.filteredProjects);

  // Standalone cards first (fill grid rows), then folios (full-width)
  standalone.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  folios.sort((a, b) => b.updatedAtMs - a.updatedAtMs);

  const items = [];
  for (const project of standalone) {
    items.push({ type: 'project', data: project, updatedAtMs: project.updatedAtMs });
  }
  for (const folio of folios) {
    items.push({ type: 'folio', data: folio, updatedAtMs: folio.updatedAtMs });
  }

  refs.projectGrid.innerHTML = items.map((item) => {
    if (item.type === 'folio') {
      return renderFolioCard(item.data);
    }

    return renderProjectCard(item.data);
  }).join('');
}

function renderProjectCard(project) {
  return `
    <article class="cup-card site-project">
      <div class="cup-card___body">
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.description)}</p>
        <span class="site-project__updated">Updated ${escapeHtml(project.updatedLabel)}</span>
      </div>
      <div class="cup-card___footer">
        <a class="cup-button cup-button--primary" href="${escapeHtml(project.url)}">Open</a>
        <a class="cup-button cup-button--secondary" href="${escapeHtml(project.repoUrl)}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </article>
  `;
}

function renderFolioCard(folio) {
  return `
    <details class="site-folio">
      <summary class="site-folio__summary cup-card">
        <div class="cup-card___body">
          <h3>${escapeHtml(folio.title)} <span class="site-folio__count">${folio.count}</span></h3>
          <p>${escapeHtml(folio.description)}</p>
          <span class="site-project__updated">Updated ${escapeHtml(folio.updatedLabel)}</span>
        </div>
      </summary>
      <div class="site-folio__children">
        ${folio.members.map((project) => renderProjectCard(project)).join('')}
      </div>
    </details>
  `;
}

function renderView() {
  syncFilteredProjects();
  updateHeaderMeta();
  updateSearchHint();
  renderMenu();
  renderGrid();
}

function getNavigationTarget() {
  const query = refs.projectSearch.value.trim().toLowerCase();

  if (!state.filteredProjects.length) {
    return null;
  }

  const exactMatch = state.filteredProjects.find((project) => {
    return project.name.toLowerCase() === query || project.title.toLowerCase() === query;
  });

  if (exactMatch) {
    return exactMatch;
  }

  return state.filteredProjects[state.activeIndex] || state.filteredProjects[0];
}

function navigateToProject(project) {
  if (!project) {
    return;
  }

  window.location.assign(project.url);
}

function wireInteractions() {
  if (state.wired) {
    return;
  }

  refs.projectSearch.addEventListener('focus', () => {
    syncFilteredProjects();
    openMenu();
    renderMenu();
  });

  refs.projectSearch.addEventListener('input', () => {
    syncFilteredProjects();
    openMenu();
    renderView();
  });

  refs.projectSearch.addEventListener('keydown', (event) => {
    const visibleCount = Math.min(state.filteredProjects.length, SEARCH_MENU_LIMIT);

    if (event.key === 'ArrowDown' && visibleCount) {
      event.preventDefault();
      state.activeIndex = state.activeIndex < 0 ? 0 : (state.activeIndex + 1) % visibleCount;
      openMenu();
      renderMenu();
      return;
    }

    if (event.key === 'ArrowUp' && visibleCount) {
      event.preventDefault();
      state.activeIndex = state.activeIndex <= 0 ? visibleCount - 1 : state.activeIndex - 1;
      openMenu();
      renderMenu();
      return;
    }

    if (event.key === 'Escape') {
      closeMenu();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      navigateToProject(getNavigationTarget());
    }
  });

  refs.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    navigateToProject(getNavigationTarget());
  });

  refs.projectMenu.addEventListener('click', (event) => {
    const button = event.target.closest('.site-menu-item');

    if (!button) {
      return;
    }

    const index = Number.parseInt(button.dataset.index || '-1', 10);
    const project = getVisibleProjects()[index];

    navigateToProject(project);
  });

  document.addEventListener('click', (event) => {
    if (!refs.searchForm.contains(event.target)) {
      closeMenu();
    }
  });

  state.wired = true;
}

async function fetchPagesRepos() {
  const repos = [];
  let page = 1;

  while (true) {
    const response = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&page=${page}&sort=updated`, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}`);
    }

    const pageRepos = await response.json();

    repos.push(...pageRepos);

    if (pageRepos.length < 100) {
      break;
    }

    page += 1;
  }

  return repos.filter((repo) => repo.has_pages && repo.name !== 'joshuawink.github.io');
}

class SeedProjectsFilter {
  async call(payload) {
    return payload
      .insert('projects', dedupeProjects(SEED_REPOS))
      .insert('source', 'seed')
      .insert('status', 'Loading from cache…')
      .insert('error', null)
      .insert('lastScannedAt', null);
  }
}

class WireInteractionsFilter {
  async call(payload) {
    wireInteractions();
    return payload;
  }
}

class RenderProjectsFilter {
  async call(payload) {
    state.projects = payload.get('projects', []);
    state.dataSource = payload.get('source', 'seed');
    state.status = payload.get('status', state.status);
    state.error = payload.get('error', null);
    state.lastScannedAt = payload.get('lastScannedAt', null);

    renderView();
    return payload;
  }
}

class ScanLiveProjectsFilter {
  async call(payload) {
    try {
      const liveRepos = await fetchPagesRepos();

      return payload
        .insert('liveRepos', liveRepos)
        .insert('source', 'live')
        .insert('status', `${liveRepos.length} repos scanned`)
        .insert('error', null)
        .insert('lastScannedAt', new Date().toISOString());
    } catch (error) {
      return payload
        .insert('liveRepos', [])
        .insert('source', payload.get('source', 'seed'))
        .insert('status', 'Scan failed — showing cached data')
        .insert('error', error instanceof Error ? error.message : String(error))
        .insert('lastScannedAt', new Date().toISOString());
    }
  }
}

class MergeProjectsFilter {
  async call(payload) {
    const mergedProjects = dedupeProjects([...SEED_REPOS, ...payload.get('liveRepos', [])]);

    return payload.insert('projects', mergedProjects);
  }
}

async function boot() {
  const pipeline = new Pipeline()
    .addFilter(new SeedProjectsFilter(), 'seed-projects')
    .addFilter(new WireInteractionsFilter(), 'wire-interactions')
    .addFilter(new RenderProjectsFilter(), 'render-seed')
    .addFilter(new ScanLiveProjectsFilter(), 'scan-live-projects')
    .addFilter(new MergeProjectsFilter(), 'merge-projects')
    .addFilter(new RenderProjectsFilter(), 'render-live');

  await pipeline.run(new Payload({}));
}

boot().catch((error) => {
  state.status = 'Failed to load — showing cached projects';
  state.error = error instanceof Error ? error.message : String(error);
  state.projects = dedupeProjects(SEED_REPOS);
  renderView();
});