import { Payload, Pipeline } from './cup-ui/docs/cup-pipe.js';

const GITHUB_USER = 'JoshuaWink';
const GITHUB_PAGES_ROOT = 'https://joshuawink.github.io';
const GITHUB_REPO_ROOT = `https://github.com/${GITHUB_USER}`;
const SEARCH_MENU_LIMIT = 8;

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
  clearButton: document.querySelector('#clear-search'),
  projectGrid: document.querySelector('#project-grid'),
  projectMenu: document.querySelector('#project-menu'),
  projectSearch: document.querySelector('#project-search'),
  projectTotal: document.querySelector('#project-total'),
  scanSource: document.querySelector('#scan-source'),
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

  const sourceLabel = state.dataSource === 'live' ? 'Live GitHub scan' : 'Seed cache';

  refs.scanSource.textContent = sourceLabel;
  refs.scanSourceLabel.textContent = sourceLabel;

  if (state.lastScannedAt) {
    refs.scanUpdated.textContent = formatUpdatedLabel(state.lastScannedAt);
  } else {
    refs.scanUpdated.textContent = 'Scanning GitHub now';
  }

  const status = state.error
    ? `${state.status} (${state.error})`
    : state.status;

  refs.scanStatus.textContent = status;
}

function updateSearchHint() {
  const query = refs.projectSearch.value.trim();
  const matchCount = state.filteredProjects.length;

  if (!query) {
    refs.searchHint.textContent = `Showing ${state.projects.length} known Pages project${state.projects.length === 1 ? '' : 's'}. Type to filter, then press Enter to open the first match.`;
    return;
  }

  if (!matchCount) {
    refs.searchHint.textContent = `No Pages projects matched "${query}". Try a repo name like space-invaders or dbqhelp.`;
    return;
  }

  const firstMatch = state.filteredProjects[0];
  refs.searchHint.textContent = `${matchCount} match${matchCount === 1 ? '' : 'es'} for "${query}". Press Enter to open ${firstMatch.name}.`;
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
          <h3>No Pages projects match the current search</h3>
          <p>Clear the filter or try a narrower keyword. The live scan is indexing repos with GitHub Pages enabled under joshuawink.github.io/*.</p>
        </div>
      </article>
    `;
    return;
  }

  refs.projectGrid.innerHTML = state.filteredProjects.map((project) => `
    <article class="cup-card site-project" data-effect="slide-up">
      <div class="cup-card___body">
        <div class="site-project__meta">
          <span class="cup-badge cup-badge--success">Live</span>
          <span class="cup-badge cup-badge--default">${escapeHtml(project.name)}</span>
          <span class="cup-badge cup-badge--info">Updated ${escapeHtml(project.updatedLabel)}</span>
        </div>
        <div>
          <h3>${escapeHtml(project.title)}</h3>
          <p>${escapeHtml(project.description)}</p>
        </div>
        <div class="site-project__url">${escapeHtml(project.url)}</div>
      </div>
      <div class="cup-card___footer">
        <a class="cup-button cup-button--primary" href="${escapeHtml(project.url)}">Open project</a>
        <a class="cup-button cup-button--secondary" href="${escapeHtml(project.repoUrl)}" target="_blank" rel="noreferrer">Source</a>
      </div>
    </article>
  `).join('');
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

  refs.clearButton.addEventListener('click', () => {
    refs.projectSearch.value = '';
    state.activeIndex = 0;
    syncFilteredProjects();
    openMenu();
    renderView();
    refs.projectSearch.focus();
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
      .insert('status', 'Showing the cached Pages index while GitHub is scanned live.')
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
        .insert('status', `Scanned ${liveRepos.length} repositories with GitHub Pages enabled.`)
        .insert('error', null)
        .insert('lastScannedAt', new Date().toISOString());
    } catch (error) {
      return payload
        .insert('liveRepos', [])
        .insert('source', payload.get('source', 'seed'))
        .insert('status', 'GitHub scan failed. Keeping the cached Pages index in place.')
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
  state.status = 'The project index could not finish booting.';
  state.error = error instanceof Error ? error.message : String(error);
  state.projects = dedupeProjects(SEED_REPOS);
  renderView();
});