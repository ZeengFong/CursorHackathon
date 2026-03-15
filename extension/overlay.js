// ── BrainDump overlay — runs inside the extension iframe ──────────────

const APP_URL = (() => {
  // For local dev:    'http://localhost:3000'
  // For production:   'https://your-deployed-url.vercel.app'
  return 'http://localhost:3000';
})();
const STORAGE_KEY = 'BrainDump_tasks';
const PANIC_KEY   = 'panic_url';
const PANIC_DEFAULT = 'https://poki.com/en/g/subway-surfers';

// ── Element refs ──────────────────────────────────────────────────────
const card          = document.getElementById('card');
const progressBar   = document.getElementById('progressBar');
const closeBtn      = document.getElementById('closeBtn');
const newDumpLink   = document.getElementById('newDumpLink');
const paneDefault   = document.getElementById('paneDefault');
const paneResults   = document.getElementById('paneResults');
const dumpInput     = document.getElementById('dumpInput');
const micBtn        = document.getElementById('micBtn');
const submitBtn     = document.getElementById('submitBtn');
const errorMsg      = document.getElementById('errorMsg');
const taskList      = document.getElementById('taskList');
const badge         = document.getElementById('badge');
const newDumpBtn    = document.getElementById('newDumpBtn');
const openDashboard = document.getElementById('openDashboard');
const panicBtn      = document.getElementById('panicBtn');

// ── App state ─────────────────────────────────────────────────────────
let tasks      = [];
let checkedIds = new Set();
let recognition = null;
let isRecording = false;

// ── Init: check for persisted tasks ───────────────────────────────────
chrome.storage.local.get([STORAGE_KEY], (result) => {
  const stored = result[STORAGE_KEY];
  if (Array.isArray(stored) && stored.length > 0) {
    tasks = stored;
    showResults(/* fromStorage= */ true);
  }
});

// ── Close overlay ─────────────────────────────────────────────────────
function closeOverlay() {
  window.parent.postMessage({ action: 'BrainDump-close' }, '*');
}

closeBtn.addEventListener('click', closeOverlay);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeOverlay();
});

// ── Textarea auto-resize (80px min → 160px max) ───────────────────────
dumpInput.addEventListener('input', () => {
  dumpInput.style.height = 'auto';
  const next = Math.min(dumpInput.scrollHeight, 160);
  dumpInput.style.height = next + 'px';
});

// ── Mic / Voice recognition ───────────────────────────────────────────
micBtn.addEventListener('click', toggleMic);

function toggleMic() {
  if (isRecording) {
    recognition?.stop();
    return;
  }

  const API = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!API) {
    showError('Voice input not supported in this browser.');
    return;
  }

  const base = dumpInput.value.trim();
  recognition = new API();
  recognition.continuous     = false;
  recognition.interimResults = true;
  recognition.lang           = 'en-US';

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add('recording');
    micBtn.title = 'Stop recording';
  };

  recognition.onresult = (event) => {
    let interim = '', final = '';
    for (let i = 0; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      event.results[i].isFinal ? (final += t) : (interim += t);
    }
    const appended = (final || interim).trim();
    dumpInput.value = base ? `${base} ${appended}` : appended;
    // Trigger resize
    dumpInput.dispatchEvent(new Event('input'));
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove('recording');
    micBtn.title = 'Voice input';
    recognition = null;
  };

  recognition.onerror = () => {
    isRecording = false;
    micBtn.classList.remove('recording');
    recognition = null;
    showError('Voice error — please try again.');
  };

  recognition.start();
}

// ── Submit ────────────────────────────────────────────────────────────
submitBtn.addEventListener('click', handleSubmit);
dumpInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
});

async function handleSubmit() {
  const text = dumpInput.value.trim();
  if (!text) return;

  setLoading(true);
  hideError();

  try {
    const res = await fetch(`${APP_URL}/api/dump`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    checkedIds.clear();

    chrome.storage.local.set({ [STORAGE_KEY]: tasks });
    showResults(false);

  } catch {
    showError(
      "Could not reach BrainDump. Make sure the app is running at localhost:3000 or update APP_URL in overlay.js for production."
    );
  } finally {
    setLoading(false);
  }
}

// ── Loading state ─────────────────────────────────────────────────────
function setLoading(on) {
  progressBar.hidden  = !on;
  submitBtn.textContent = on ? 'Thinking...' : 'Clear it →';
  submitBtn.classList.toggle('loading', on);
  submitBtn.disabled  = on;
  dumpInput.disabled  = on;
  micBtn.disabled     = on;
}

// ── Error ─────────────────────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden      = false;
}

function hideError() {
  errorMsg.hidden = true;
}

// ── Results state ─────────────────────────────────────────────────────
function showResults(fromStorage) {
  paneDefault.hidden = true;
  paneResults.hidden = false;
  // Show "＋ New dump" link in header when restoring from storage (State 4)
  newDumpLink.hidden = !fromStorage;
  renderTasks();
}

function resetToDefault() {
  tasks = [];
  checkedIds.clear();
  chrome.storage.local.remove([STORAGE_KEY]);

  dumpInput.value      = '';
  dumpInput.style.height = '';
  hideError();
  newDumpLink.hidden   = true;

  paneResults.hidden   = true;
  paneDefault.hidden   = false;
}

// ── Render task list ──────────────────────────────────────────────────
const SECTIONS = [
  { category: 'now',   label: 'Right now', cls: 'section-now'   },
  { category: 'later', label: 'Later',     cls: 'section-later' },
  { category: 'drop',  label: 'Drop',      cls: 'section-drop'  },
];

function renderTasks() {
  taskList.innerHTML = '';

  SECTIONS.forEach(({ category, label, cls }) => {
    const sectionTasks = tasks.filter((t) => t.category === category);
    if (sectionTasks.length === 0) return;

    const section  = document.createElement('div');
    section.className = `task-section ${cls}`;

    const labelEl  = document.createElement('div');
    labelEl.className = 'section-label';
    labelEl.textContent = label;
    section.appendChild(labelEl);

    sectionTasks.forEach((task) => {
      section.appendChild(createTaskItem(task));
    });

    taskList.appendChild(section);
  });

  updateBadge();
}

function createTaskItem(task) {
  const item    = document.createElement('div');
  item.className = 'task-item';
  item.dataset.id = task.id;

  const cbId    = `ck-${task.id}`;
  const checkbox = document.createElement('input');
  checkbox.type  = 'checkbox';
  checkbox.id    = cbId;
  checkbox.checked = checkedIds.has(task.id);
  if (checkbox.checked) item.classList.add('done');

  const labelEl  = document.createElement('label');
  labelEl.htmlFor    = cbId;
  labelEl.textContent = task.text;

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      checkedIds.add(task.id);
      requestAnimationFrame(() => item.classList.add('done'));
    } else {
      checkedIds.delete(task.id);
      item.classList.remove('done');
    }
    updateBadge();
  });

  item.appendChild(checkbox);
  item.appendChild(labelEl);
  return item;
}

function updateBadge() {
  const active = (cat) =>
    tasks.filter((t) => t.category === cat && !checkedIds.has(t.id)).length;

  const nowCount   = active('now');
  const laterCount = active('later');
  const dropCount  = tasks.filter((t) => t.category === 'drop').length;

  const parts = [];
  if (nowCount   > 0) parts.push(`${nowCount} now`);
  if (laterCount > 0) parts.push(`${laterCount} later`);
  if (dropCount  > 0) parts.push(`${dropCount} dropped`);

  badge.textContent = parts.join(' · ') || 'All clear.';
}

// ── Footer / header actions ───────────────────────────────────────────
newDumpBtn.addEventListener('click', resetToDefault);
newDumpLink.addEventListener('click', resetToDefault);

openDashboard.addEventListener('click', () => {
  window.parent.postMessage(
    { action: 'BrainDump-open-url', url: `${APP_URL}/dashboard` },
    '*'
  );
});

// ── Panic button ──────────────────────────────────────────────────────
panicBtn.addEventListener('click', () => {
  chrome.storage.local.get([PANIC_KEY], (result) => {
    const url = result[PANIC_KEY] ?? PANIC_DEFAULT;
    window.parent.postMessage({ action: 'BrainDump-open-url', url }, '*');
  });
});
