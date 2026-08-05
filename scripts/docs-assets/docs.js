/* EdgePannel docs portal — client runtime.
   Kept as an external file (no inline script) so the site's strict CSP needs no
   per-page hash. Progressive enhancement only: every page is fully readable
   with JS disabled. */
(function () {
  'use strict';

  var docsBase = document.documentElement.getAttribute('data-docs-base') || '/docs/';

  // ── Mobile sidebar ────────────────────────────────────────────────────
  var burger = document.getElementById('d-burger');
  var side = document.getElementById('d-side');
  if (burger && side) {
    burger.addEventListener('click', function () {
      var open = side.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // ── Search ────────────────────────────────────────────────────────────
  var input = document.getElementById('d-search-input');
  var results = document.getElementById('d-search-results');
  if (!input || !results) return;

  var index = null;
  var loading = false;
  var activeIdx = -1;

  function loadIndex() {
    if (index || loading) return Promise.resolve(index);
    loading = true;
    return fetch(docsBase + 'search-index.json')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { index = data; loading = false; return index; })
      .catch(function () { index = []; loading = false; return index; });
  }

  function score(entry, terms) {
    var title = entry.t.toLowerCase();
    var body = (entry.d || '').toLowerCase();
    var section = (entry.s || '').toLowerCase();
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      var hit = 0;
      if (title === term) hit += 100;
      if (title.indexOf(term) !== -1) hit += 40;
      if (section.indexOf(term) !== -1) hit += 10;
      if (body.indexOf(term) !== -1) hit += 6;
      if (hit === 0) return 0; // every term must match somewhere
      total += hit;
    }
    return total;
  }

  function render(hits, query) {
    results.innerHTML = '';
    activeIdx = -1;
    if (!query) { results.classList.remove('is-open'); return; }
    if (!hits.length) {
      var empty = document.createElement('div');
      empty.className = 'd-search-empty';
      empty.textContent = 'No matches for "' + query + '"';
      results.appendChild(empty);
      results.classList.add('is-open');
      return;
    }
    hits.forEach(function (hit) {
      var a = document.createElement('a');
      a.href = hit.u;
      var title = document.createElement('div');
      title.className = 'd-search-hit-title';
      title.textContent = hit.t;
      var meta = document.createElement('div');
      meta.className = 'd-search-hit-meta';
      meta.textContent = hit.s || '';
      a.appendChild(title);
      a.appendChild(meta);
      results.appendChild(a);
    });
    results.classList.add('is-open');
  }

  function run() {
    var query = input.value.trim();
    if (!query) { render([], ''); return; }
    loadIndex().then(function (data) {
      var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      var hits = (data || [])
        .map(function (e) { return { e: e, score: score(e, terms) }; })
        .filter(function (x) { return x.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 12)
        .map(function (x) { return x.e; });
      render(hits, query);
    });
  }

  var debounce;
  input.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(run, 110);
  });
  input.addEventListener('focus', loadIndex);

  input.addEventListener('keydown', function (e) {
    var items = results.querySelectorAll('a');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      if (activeIdx >= 0 && items[activeIdx]) items[activeIdx].classList.remove('is-active');
      activeIdx = e.key === 'ArrowDown'
        ? (activeIdx + 1) % items.length
        : (activeIdx <= 0 ? items.length - 1 : activeIdx - 1);
      items[activeIdx].classList.add('is-active');
      items[activeIdx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault();
        window.location.href = items[activeIdx].getAttribute('href');
      }
    } else if (e.key === 'Escape') {
      input.blur();
      results.classList.remove('is-open');
    }
  });

  document.addEventListener('click', function (e) {
    if (!results.contains(e.target) && e.target !== input) results.classList.remove('is-open');
  });

  // "/" focuses search, matching the dashboard's keyboard-first feel.
  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
      e.preventDefault();
      input.focus();
    }
  });
})();
