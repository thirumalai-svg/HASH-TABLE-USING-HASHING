/**
 * script.js — HashSearch Frontend Logic
 * Communicates with the Flask API to manage documents, run searches,
 * display hash table stats, visualize buckets, and show history.
 */

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────
let lastSearchTime = null;
let lastLinearTime = null;
let toastTimer = null;

// Quick-fill sample texts
const SAMPLE_TEXTS = {
  science: {
    name: "Science & Biology",
    text: "DNA carries genetic information in all living organisms. Cells are the basic unit of life in biology. Photosynthesis converts sunlight into chemical energy in plants. Evolution by natural selection drives biodiversity on Earth. The human genome contains approximately three billion base pairs of DNA. Proteins are complex molecules that carry out biological functions."
  },
  technology: {
    name: "Technology & Computing",
    text: "Artificial intelligence is transforming computing and automation. Cloud computing delivers on-demand computing resources over the internet. Cybersecurity protects digital systems from unauthorized access and attacks. Quantum computing uses quantum mechanics to solve complex computational challenges. Machine learning algorithms improve performance through experience and data analysis."
  },
  history: {
    name: "World History",
    text: "The Roman Empire dominated Europe for centuries with powerful armies and engineering. The Renaissance period saw a rebirth of art, science, and philosophy in Europe. World War II reshaped global politics and led to the United Nations formation. The Industrial Revolution transformed manufacturing and urban societies in the 19th century. Ancient Egypt built the pyramids as monumental tombs for pharaohs and kings."
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB SWITCHING
// ─────────────────────────────────────────────────────────────────────────────
function switchTab(name) {
  // Hide all panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });

  // Show selected
  document.getElementById('panel-' + name).classList.add('active');
  const btn = document.getElementById('tab-' + name);
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');

  // Load tab-specific data
  if (name === 'stats')      loadStats();
  if (name === 'visualize')  loadVisualize();
  if (name === 'history')    loadHistory();
  if (name === 'upload')     loadDocumentList();
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK MESSAGES (inline card messages)
// ─────────────────────────────────────────────────────────────────────────────
function showFeedback(id, message, type) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = 'feedback-msg ' + type;
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD SAMPLE DATASET
// ─────────────────────────────────────────────────────────────────────────────
async function loadSamples() {
  const btn = document.getElementById('btn-load-samples');
  btn.textContent = '⏳ Loading…';
  btn.disabled = true;
  try {
    const resp = await fetch('/api/load-samples', { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      showToast('✅ ' + data.message, 'success');
      loadDocumentList();
    } else {
      showToast('ℹ️ ' + (data.message || 'Samples already loaded'), 'info');
    }
  } catch (e) {
    showToast('❌ Failed to load samples', 'error');
  } finally {
    btn.textContent = '🚀 Load Sample Dataset';
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK FILL
// ─────────────────────────────────────────────────────────────────────────────
function fillSample(type) {
  const s = SAMPLE_TEXTS[type];
  document.getElementById('doc-name').value = s.name;
  document.getElementById('doc-content').value = s.text;
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEX DOCUMENT (manual input)
// ─────────────────────────────────────────────────────────────────────────────
async function indexDocument() {
  const name    = document.getElementById('doc-name').value.trim();
  const content = document.getElementById('doc-content').value.trim();

  if (!name || !content) {
    showFeedback('index-feedback', '⚠️ Please enter both a name and content.', 'error');
    return;
  }

  const btn = document.getElementById('btn-index-doc');
  btn.textContent = '⏳ Indexing…';
  btn.disabled = true;

  try {
    const resp = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content })
    });
    const data = await resp.json();

    if (data.success) {
      showFeedback('index-feedback', `✅ "${name}" indexed! ${data.document.unique_words} unique words found.`, 'success');
      document.getElementById('doc-name').value = '';
      document.getElementById('doc-content').value = '';
      loadDocumentList();
      showToast('✅ Document indexed successfully', 'success');
    } else {
      showFeedback('index-feedback', '❌ ' + (data.error || 'Failed to index'), 'error');
    }
  } catch (e) {
    showFeedback('index-feedback', '❌ Server error. Is Flask running?', 'error');
  } finally {
    btn.textContent = 'Index Document →';
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD FILE
// ─────────────────────────────────────────────────────────────────────────────
async function uploadFile(input) {
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const btn = document.getElementById('btn-upload-file');
  btn.textContent = '⏳ Uploading…';
  btn.disabled = true;

  try {
    const resp = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await resp.json();

    if (data.success) {
      showFeedback('upload-feedback', `✅ "${data.name}" uploaded (${data.characters} chars)`, 'success');
      loadDocumentList();
      showToast('✅ File uploaded and indexed', 'success');

      // Update dropzone text
      document.querySelector('.dropzone-text').textContent = '✅ ' + file.name;
    } else {
      showFeedback('upload-feedback', '❌ ' + (data.error || 'Upload failed'), 'error');
    }
  } catch (e) {
    showFeedback('upload-feedback', '❌ Server error', 'error');
  } finally {
    btn.textContent = 'Upload File →';
    btn.disabled = false;
    input.value = '';
  }
}

function handleDrop(event) {
  event.preventDefault();
  document.getElementById('dropzone').classList.remove('drag-over');
  const file = event.dataTransfer.files[0];
  if (!file) return;

  // Create a DataTransfer to pass to uploadFile
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.getElementById('file-input');
  input.files = dt.files;
  uploadFile(input);
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD DOCUMENT LIST
// ─────────────────────────────────────────────────────────────────────────────
async function loadDocumentList() {
  try {
    const resp = await fetch('/api/documents');
    const data = await resp.json();
    renderDocumentList(data.documents, data.count);
  } catch (e) {
    console.error('Failed to load documents:', e);
  }
}

function renderDocumentList(docs, count) {
  const list  = document.getElementById('docs-list');
  const badge = document.getElementById('doc-count-badge');
  badge.textContent = count + ' doc' + (count !== 1 ? 's' : '');

  if (!docs || docs.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-text">No documents uploaded yet.</div>
        <div class="empty-sub">Add documents above or load the sample dataset.</div>
      </div>`;
    return;
  }

  list.innerHTML = docs.map(doc => `
    <div class="doc-item" id="doc-${doc.id}">
      <div class="doc-info">
        <div class="doc-name">📄 ${escHtml(doc.name)}</div>
        <div class="doc-preview">${escHtml(doc.preview)}</div>
        <div class="doc-meta">${doc.token_count} tokens · ${doc.unique_words} unique words · ID: ${doc.id}</div>
      </div>
      <button class="btn-delete" onclick="deleteDocument('${doc.id}')" title="Remove document">🗑</button>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────
async function deleteDocument(docId) {
  try {
    const resp = await fetch('/api/documents/' + docId, { method: 'DELETE' });
    const data = await resp.json();
    if (data.success) {
      showToast('🗑️ Document removed', 'info');
      loadDocumentList();
    }
  } catch (e) {
    showToast('❌ Failed to delete document', 'error');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────────────────────
function setQuery(q) {
  document.getElementById('search-input').value = q;
  doSearch();
}

async function doSearch() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) return;

  const startTime = performance.now();

  try {
    const resp = await fetch('/api/search?q=' + encodeURIComponent(query));
    const data = await resp.json();
    const elapsed = (performance.now() - startTime).toFixed(2);

    lastSearchTime = parseFloat(elapsed);
    renderSearchResults(data, query, elapsed);
    updateSpeedComparison(data.total);
  } catch (e) {
    document.getElementById('search-results').innerHTML =
      '<div class="no-results"><div class="no-results-icon">⚠️</div><p>Search failed. Is Flask running?</p></div>';
  }
}

function renderSearchResults(data, query, elapsed) {
  const meta    = document.getElementById('search-meta');
  const results = document.getElementById('search-results');
  const tokens  = data.tokens || [];

  // Show meta bar
  meta.classList.remove('hidden');
  document.getElementById('meta-time').textContent  = `⏱ ${elapsed} ms`;
  document.getElementById('meta-tokens').textContent = `🔑 Tokens: ${tokens.join(', ') || 'none'}`;
  document.getElementById('meta-count').textContent  = `📄 ${data.total} result${data.total !== 1 ? 's' : ''}`;

  if (!data.results || data.results.length === 0) {
    results.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <p>No documents match "${escHtml(query)}"</p>
        <p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Try different keywords or add more documents.</p>
      </div>`;
    return;
  }

  results.innerHTML = data.results.map((r, i) => {
    const highlighted = highlightTerms(r.preview, tokens);
    return `
      <div class="result-card" onclick="void(0)">
        <div class="result-header">
          <div class="result-name">📄 ${escHtml(r.name)}</div>
          <div class="result-score">⭐ Score: ${r.score}</div>
        </div>
        <div class="result-rank">#${i + 1} of ${data.results.length}</div>
        <div class="result-preview">${highlighted}</div>
      </div>`;
  }).join('');
}

function highlightTerms(text, terms) {
  if (!terms || !terms.length) return escHtml(text);
  let safe = escHtml(text);
  terms.forEach(term => {
    const re = new RegExp('(' + escRegex(term) + ')', 'gi');
    safe = safe.replace(re, '<mark>$1</mark>');
  });
  return safe;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const resp = await fetch('/api/stats');
    const data = await resp.json();
    renderStats(data);
  } catch (e) {
    document.getElementById('stats-grid').innerHTML = '<div class="loading-state">Failed to load stats</div>';
  }
}

function renderStats(data) {
  const idx = data.inverted_index;
  const doc = data.doc_store;

  const statCards = [
    { icon: '📄', val: data.total_documents,     label: 'Documents Indexed' },
    { icon: '#️⃣', val: data.total_unique_words,  label: 'Unique Words',        sub: 'hash table keys' },
    { icon: '🪣', val: idx.capacity,              label: 'Buckets (Capacity)',  sub: 'total slots' },
    { icon: '📊', val: idx.load_factor,           label: 'Load Factor',         sub: '> 0.7 = resize needed' },
    { icon: '💥', val: idx.collision_count,       label: 'Collisions',          sub: 'separate chaining' },
    { icon: '🔗', val: idx.max_chain_length,      label: 'Max Chain Length',    sub: 'longest bucket chain' },
    { icon: '✅', val: idx.occupied_buckets,      label: 'Occupied Buckets' },
    { icon: '⬜', val: idx.empty_buckets,         label: 'Empty Buckets' },
    { icon: '📈', val: idx.average_chain_length,  label: 'Avg Chain Length' },
  ].map(s => `
    <div class="stat-card">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-val">${s.val}</div>
      <div class="stat-label">${s.label}</div>
      ${s.sub ? `<div class="stat-sublabel">${s.sub}</div>` : ''}
    </div>`).join('');

  document.getElementById('stats-grid').innerHTML = statCards;

  // Collisions
  const badge = document.getElementById('collision-badge');
  badge.textContent = idx.collision_count;

  const log = document.getElementById('collision-log');
  if (!idx.collision_details || idx.collision_details.length === 0) {
    log.innerHTML = '<div class="empty-state">No collisions yet — add more documents to trigger them.</div>';
  } else {
    log.innerHTML = idx.collision_details.map(c => `
      <div class="collision-entry">
        <span class="collision-bucket">Bucket [${c.bucket}]</span>
        <span class="collision-keys">"${escHtml(c.existing_key)}" ← collided with → "${escHtml(c.new_key)}"</span>
      </div>`).join('');
  }

  updateSpeedComparison(data.total_documents);
}

function updateSpeedComparison(docCount) {
  if (!lastSearchTime) return;
  const linearEst = (docCount * 0.08).toFixed(2); // O(n) estimate
  const hashVal   = lastSearchTime.toFixed(2);
  const ratio     = Math.max(parseFloat(linearEst) / parseFloat(hashVal), 1);

  document.getElementById('val-linear').textContent = linearEst + ' ms';
  document.getElementById('val-hash').textContent   = hashVal + ' ms';
  document.getElementById('bar-linear').style.width = '90%';
  document.getElementById('bar-hash').style.width   = Math.max(5, 90 / ratio) + '%';
  document.getElementById('speed-note').textContent =
    `Hash table is ~${ratio.toFixed(0)}× faster than linear scan across ${docCount} documents.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// VISUALIZE
// ─────────────────────────────────────────────────────────────────────────────
function onVizSlider(input) {
  document.getElementById('viz-limit-val').textContent = input.value;
  loadVisualize();
}

async function loadVisualize() {
  const limit = document.getElementById('viz-limit').value;
  try {
    const resp = await fetch('/api/visualize?limit=' + limit);
    const data = await resp.json();
    renderBuckets(data.buckets);
  } catch (e) {
    document.getElementById('bucket-viz').innerHTML = '<div class="loading-state">Failed to load visualization</div>';
  }
}

function renderBuckets(buckets) {
  const container = document.getElementById('bucket-viz');
  if (!buckets || buckets.length === 0) {
    container.innerHTML = '<div class="empty-state">Add documents to see the hash table buckets.</div>';
    return;
  }

  container.innerHTML = buckets.map(b => {
    if (!b.chain || b.chain.length === 0) {
      return `
        <div class="bucket-row">
          <span class="bucket-idx">${b.bucket}</span>
          <div class="bucket-visual"><div class="bucket-empty"></div></div>
        </div>`;
    }

    const nodes = b.chain.map((node, i) => {
      const isCollision = i > 0;
      const arrow = i > 0 ? '<span class="chain-arrow">→</span>' : '';
      return `${arrow}<div class="bucket-node ${isCollision ? 'collision' : ''}" title="${escHtml(node.key)}: ${JSON.stringify(node.value)}">${escHtml(node.key)}</div>`;
    }).join('');

    return `
      <div class="bucket-row">
        <span class="bucket-idx">${b.bucket}</span>
        <div class="bucket-visual">${nodes}</div>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const resp = await fetch('/api/history');
    const data = await resp.json();
    renderHistory(data.history);
  } catch (e) {
    console.error('Failed to load history:', e);
  }
}

function renderHistory(history) {
  const list = document.getElementById('history-list');
  if (!history || history.length === 0) {
    list.innerHTML = '<div class="empty-state">No searches yet — go to the Search tab and run a query!</div>';
    return;
  }

  list.innerHTML = history.map(item => `
    <div class="history-item" onclick="goSearch('${escHtml(item.query)}')">
      <div class="history-query">🔍 "${escHtml(item.query)}"</div>
      <div class="history-meta">
        <span class="history-count">searched ${item.count}×</span>
        <button class="history-search-btn" onclick="event.stopPropagation(); goSearch('${escHtml(item.query)}')">Search again</button>
      </div>
    </div>`).join('');
}

function goSearch(query) {
  document.getElementById('search-input').value = query;
  switchTab('search');
  doSearch();
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadDocumentList();

  // Allow pressing Enter in search from any page
  document.getElementById('search-input').addEventListener('keyup', e => {
    if (e.key === 'Enter') doSearch();
  });
});
