/**
 * runner.js — Experimental in-browser code runner.
 *
 * Loads a GitHub repo, displays its file tree, and executes code
 * via WASM runtimes (Pyodide for Python, sandboxed iframe for JS/TS).
 * Compiled languages get a code viewer + playground link.
 *
 * URL params: ?repo=NAME&owner=USER_OR_ORG
 */

const GITHUB_API = 'https://api.github.com';
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full';

const PLAYGROUND_URLS = {
  Rust: 'https://play.rust-lang.org/',
  Go: 'https://go.dev/play/',
  TypeScript: 'https://www.typescriptlang.org/play',
};

const ENTRY_POINTS = {
  Python: ['main.py', 'app.py', 'run.py', '__main__.py', 'index.py'],
  JavaScript: ['index.js', 'main.js', 'app.js', 'index.mjs'],
  TypeScript: ['index.ts', 'main.ts', 'app.ts', 'index.tsx'],
  Rust: ['src/main.rs', 'src/lib.rs', 'main.rs'],
  Go: ['main.go', 'cmd/main.go'],
};

const RUNNABLE_LANGUAGES = new Set(['Python', 'JavaScript']);

// ── State ──

const state = {
  owner: '',
  repo: '',
  language: null,
  files: [],
  selectedFile: null,
  fileContent: '',
  pyodide: null,
  running: false,
};

// ── DOM refs ──

const refs = {
  title: document.getElementById('runner-project-title'),
  desc: document.getElementById('runner-project-desc'),
  meta: document.getElementById('runner-project-meta'),
  fileTree: document.getElementById('runner-file-tree'),
  fileName: document.getElementById('runner-file-name'),
  code: document.getElementById('runner-code'),
  output: document.getElementById('runner-output'),
  runBtn: document.getElementById('runner-run-btn'),
  clearBtn: document.getElementById('runner-clear-btn'),
  playgroundLink: document.getElementById('runner-playground-link'),
  repoLink: document.getElementById('runner-repo-link'),
};

// ── Terminal output ──

function termWrite(text, type = 'stdout') {
  const line = document.createElement('span');
  line.className = `runner-terminal__${type}`;
  line.textContent = text;
  refs.output.appendChild(line);
  refs.output.scrollTop = refs.output.scrollHeight;
}

function termClear() {
  refs.output.innerHTML = '';
}

function termSystem(text) {
  termWrite(`[system] ${text}\n`, 'system');
}

function termError(text) {
  termWrite(`[error] ${text}\n`, 'stderr');
}

// ── GitHub API ──

async function fetchRepoMeta(owner, repo) {
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`Repo not found: ${res.status}`);
  return res.json();
}

async function fetchTree(owner, repo, branch = 'main') {
  // Try main, then master
  for (const ref of [branch, 'master']) {
    const res = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (res.ok) {
      const data = await res.json();
      return data.tree.filter((item) => item.type === 'blob');
    }
  }
  throw new Error('Could not fetch repo tree');
}

async function fetchFileContent(owner, repo, path) {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    { headers: { Accept: 'application/vnd.github.v3.raw' } }
  );
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.text();
}

// ── File tree rendering ──

function getFileExtIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    py: '🐍', js: '📜', ts: '📘', rs: '🦀', go: '🐹',
    md: '📝', json: '📋', toml: '⚙️', yaml: '⚙️', yml: '⚙️',
    html: '🌐', css: '🎨', sh: '🖥️', txt: '📄',
  };
  return icons[ext] || '📄';
}

function renderFileTree(files) {
  // Group into directories
  const tree = {};
  const rootFiles = [];

  for (const file of files) {
    const parts = file.path.split('/');
    if (parts.length === 1) {
      rootFiles.push(file);
    } else {
      const dir = parts[0];
      if (!tree[dir]) tree[dir] = [];
      tree[dir].push(file);
    }
  }

  let html = '';

  // Root files first
  for (const file of rootFiles) {
    html += renderFileItem(file);
  }

  // Then directories
  for (const [dir, dirFiles] of Object.entries(tree).sort()) {
    html += `<details class="runner-dir"><summary class="runner-dir__name">📁 ${escapeHtml(dir)}/</summary>`;
    for (const file of dirFiles) {
      html += renderFileItem(file);
    }
    html += '</details>';
  }

  refs.fileTree.innerHTML = html;

  // Wire click handlers
  refs.fileTree.querySelectorAll('.runner-file').forEach((el) => {
    el.addEventListener('click', () => selectFile(el.dataset.path));
  });
}

function renderFileItem(file) {
  const name = file.path.split('/').pop();
  const icon = getFileExtIcon(name);
  const isEntry = isEntryPoint(file.path);
  return `<button class="runner-file${isEntry ? ' runner-file--entry' : ''}" data-path="${escapeHtml(file.path)}">${icon} ${escapeHtml(file.path)}</button>`;
}

function isEntryPoint(path) {
  if (!state.language) return false;
  const entries = ENTRY_POINTS[state.language] || [];
  return entries.includes(path);
}

// ── File selection ──

async function selectFile(path) {
  state.selectedFile = path;
  refs.fileName.textContent = path;

  // Highlight active file
  refs.fileTree.querySelectorAll('.runner-file').forEach((el) => {
    el.classList.toggle('runner-file--active', el.dataset.path === path);
  });

  try {
    state.fileContent = await fetchFileContent(state.owner, state.repo, path);
    refs.code.querySelector('code').textContent = state.fileContent;

    // Enable run button if language is runnable
    const ext = path.split('.').pop().toLowerCase();
    const canRun =
      (ext === 'py' && RUNNABLE_LANGUAGES.has('Python')) ||
      ((ext === 'js' || ext === 'mjs') && RUNNABLE_LANGUAGES.has('JavaScript'));

    refs.runBtn.disabled = !canRun;

    // Show playground link for compiled languages
    if (PLAYGROUND_URLS[state.language] && !canRun) {
      refs.playgroundLink.href = PLAYGROUND_URLS[state.language];
      refs.playgroundLink.hidden = false;
    } else {
      refs.playgroundLink.hidden = true;
    }
  } catch (err) {
    refs.code.querySelector('code').textContent = `Error loading file: ${err.message}`;
    refs.runBtn.disabled = true;
  }
}

// ── Runners ──

async function loadPyodide() {
  if (state.pyodide) return state.pyodide;

  termSystem('Loading Python runtime (Pyodide)…');
  const script = document.createElement('script');
  script.src = `${PYODIDE_CDN}/pyodide.js`;

  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Pyodide'));
    document.head.appendChild(script);
  });

  // eslint-disable-next-line no-undef
  state.pyodide = await loadPyodide({
    indexURL: PYODIDE_CDN,
    stdout: (text) => termWrite(text + '\n', 'stdout'),
    stderr: (text) => termWrite(text + '\n', 'stderr'),
  });

  termSystem('Python runtime ready.');
  return state.pyodide;
}

async function runPython(code) {
  const pyodide = await loadPyodide();

  // Collect all Python files and make them importable
  const pyFiles = state.files.filter((f) => f.path.endsWith('.py'));
  for (const file of pyFiles) {
    if (file.path === state.selectedFile) continue;
    try {
      const content = await fetchFileContent(state.owner, state.repo, file.path);
      const modulePath = file.path.replace(/\//g, '_');
      pyodide.FS.writeFile(`/home/pyodide/${modulePath}`, content);
    } catch {
      // Non-critical — skip files we can't fetch
    }
  }

  try {
    await pyodide.runPythonAsync(code);
  } catch (err) {
    termError(err.message);
  }
}

function runJavaScript(code) {
  // Run in a sandboxed iframe for isolation
  const iframe = document.createElement('iframe');
  iframe.sandbox = 'allow-scripts';
  iframe.style.display = 'none';
  document.body.appendChild(iframe);

  return new Promise((resolve) => {
    // Listen for messages from the sandbox
    const handler = (event) => {
      if (event.source !== iframe.contentWindow) return;
      const { type, data } = event.data || {};
      if (type === 'stdout') termWrite(data + '\n', 'stdout');
      if (type === 'stderr') termError(data);
      if (type === 'done') {
        window.removeEventListener('message', handler);
        iframe.remove();
        resolve();
      }
    };
    window.addEventListener('message', handler);

    // Inject code with console capture
    const wrappedCode = `
      <script>
        const _parent = window.parent;
        const _send = (type, data) => _parent.postMessage({ type, data }, '*');
        console.log = (...args) => _send('stdout', args.map(String).join(' '));
        console.error = (...args) => _send('stderr', args.map(String).join(' '));
        console.warn = (...args) => _send('stdout', '[warn] ' + args.map(String).join(' '));
        try {
          ${code}
          _send('done', '');
        } catch (e) {
          _send('stderr', e.message);
          _send('done', '');
        }
      <\/script>
    `;

    iframe.srcdoc = wrappedCode;

    // Safety timeout — kill after 10s
    setTimeout(() => {
      window.removeEventListener('message', handler);
      iframe.remove();
      termError('Execution timed out (10s limit)');
      resolve();
    }, 10000);
  });
}

async function runCode() {
  if (state.running || !state.fileContent || !state.selectedFile) return;

  state.running = true;
  refs.runBtn.disabled = true;
  refs.runBtn.textContent = '⏳ Running…';
  termClear();

  const ext = state.selectedFile.split('.').pop().toLowerCase();

  try {
    if (ext === 'py') {
      termSystem(`Running ${state.selectedFile}…`);
      await runPython(state.fileContent);
    } else if (ext === 'js' || ext === 'mjs') {
      termSystem(`Running ${state.selectedFile} (sandboxed)…`);
      await runJavaScript(state.fileContent);
    }
    termSystem('Done.');
  } catch (err) {
    termError(`Runtime error: ${err.message}`);
  }

  state.running = false;
  refs.runBtn.disabled = false;
  refs.runBtn.textContent = '▶ Run';
}

// ── Utilities ──

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ── Boot ──

async function boot() {
  const params = new URLSearchParams(window.location.search);
  state.owner = params.get('owner') || 'JoshuaWink';
  state.repo = params.get('repo');

  if (!state.repo) {
    refs.title.textContent = 'No project specified';
    refs.fileTree.innerHTML = '<p>Add <code>?repo=NAME</code> to the URL.</p>';
    return;
  }

  refs.repoLink.href = `https://github.com/${state.owner}/${state.repo}`;
  refs.title.textContent = state.repo.replace(/[-_]/g, ' ');
  termSystem(`Loading ${state.owner}/${state.repo}…`);

  try {
    // Fetch repo metadata
    const meta = await fetchRepoMeta(state.owner, state.repo);
    state.language = meta.language;

    refs.title.textContent = meta.name.replace(/[-_]/g, ' ');
    refs.desc.textContent = meta.description || '';

    const langLabel = state.language || 'Unknown';
    const canRun = RUNNABLE_LANGUAGES.has(state.language);
    const runtimeLabel = canRun
      ? (state.language === 'Python' ? 'Pyodide WASM' : 'Sandboxed iframe')
      : (PLAYGROUND_URLS[state.language] ? 'External playground' : 'View only');

    refs.meta.innerHTML = `
      <span class="runner-meta__lang">${escapeHtml(langLabel)}</span>
      <span class="runner-meta__runtime">${escapeHtml(runtimeLabel)}</span>
    `;

    // Fetch file tree
    termSystem('Fetching file tree…');
    state.files = await fetchTree(state.owner, state.repo);
    renderFileTree(state.files);

    termSystem(`${state.files.length} files found.`);

    // Auto-select entry point
    const entries = ENTRY_POINTS[state.language] || [];
    const entryFile = entries.find((e) => state.files.some((f) => f.path === e));
    if (entryFile) {
      termSystem(`Entry point: ${entryFile}`);
      await selectFile(entryFile);
    } else if (state.files.length > 0) {
      // Fall back to README or first file
      const readme = state.files.find((f) => /^readme/i.test(f.path));
      await selectFile(readme ? readme.path : state.files[0].path);
    }
  } catch (err) {
    termError(`Failed to load project: ${err.message}`);
    refs.fileTree.innerHTML = `<p class="runner-sidebar__error">Could not load repo. It may be private or rate-limited.</p>`;
  }
}

// ── Event wiring ──

refs.runBtn.addEventListener('click', runCode);
refs.clearBtn.addEventListener('click', termClear);

// Keyboard shortcut: Ctrl/Cmd+Enter to run
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runCode();
  }
});

boot();
