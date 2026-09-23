const live = document.querySelector('.docs-live');
let liveTimer = 0;
const announce = (text) => {
  live.textContent = text;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { live.textContent = ''; }, 3000);
};

// Copy buttons report success only after the clipboard write resolves.
document.addEventListener('click', async (event) => {
  const button = event.target instanceof Element && event.target.closest('.copy-code');
  if (!button) return;
  const code = button.parentElement.querySelector('pre').textContent.replace(/\n$/, '');
  try {
    await navigator.clipboard.writeText(code);
    button.dataset.copied = '';
    button.setAttribute('aria-label', 'Copied');
    announce('Copied to clipboard');
    clearTimeout(button.copyTimer);
    button.copyTimer = setTimeout(() => {
      delete button.dataset.copied;
      button.setAttribute('aria-label', 'Copy code');
    }, 1600);
  } catch {
    announce("Couldn't copy. Select the code instead.");
  }
});

// Outline: the last heading above the reading line is current. No sliding indicator.
const outlineLinks = [...document.querySelectorAll('.docs-toc a')];
const headings = outlineLinks.map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1)))).filter(Boolean);
if (headings.length) {
  let frame = 0;
  let currentId = '';
  const update = () => {
    frame = 0;
    const line = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 88;
    let current = headings[0];
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top - line - 8 <= 0) current = heading;
      else break;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = headings.at(-1);
    if (current.id === currentId) return;
    currentId = current.id;
    for (const link of outlineLinks) {
      const active = link.hash === `#${current.id}`;
      link.classList.toggle('is-active', active);
      if (!active) {
        link.removeAttribute('aria-current');
        continue;
      }
      link.setAttribute('aria-current', 'location');
      const rail = link.closest('.docs-toc');
      const top = link.offsetTop - rail.scrollTop;
      if (top < 48 || top > rail.clientHeight - 48) rail.scrollTop = link.offsetTop - rail.clientHeight / 2;
    }
  };
  addEventListener('scroll', () => { frame ||= requestAnimationFrame(update); }, { passive: true });
  addEventListener('resize', () => { frame ||= requestAnimationFrame(update); });
  update();
}

// Page navigation: a sticky rail on wide screens, a drawer below 900px.
const sidebar = document.querySelector('.docs-sidebar');
const scrim = document.querySelector('.docs-scrim');
const menu = document.querySelector('.docs-menu');
if (sidebar && menu) {
  const current = sidebar.querySelector('[aria-current="page"]');
  if (current && current.offsetTop > sidebar.clientHeight - 96) sidebar.scrollTop = current.offsetTop - sidebar.clientHeight / 2;
  const narrow = matchMedia('(max-width: 899px)');
  const outside = ['.docs-header', '.docs-main', '.docs-toc', '.docs-footer'].map((selector) => document.querySelector(selector)).filter(Boolean);
  const setOpen = (open, restoreFocus = true) => {
    sidebar.classList.toggle('is-open', open);
    scrim.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
    menu.setAttribute('aria-expanded', String(open));
    for (const element of outside) element.inert = open;
    if (open) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      (current ?? sidebar.querySelector('a')).focus({ preventScroll: true });
      return;
    }
    sidebar.removeAttribute('role');
    sidebar.removeAttribute('aria-modal');
    if (restoreFocus) menu.focus();
  };
  menu.addEventListener('click', () => setOpen(true));
  sidebar.querySelector('.docs-menu-close').addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));
  sidebar.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a') && sidebar.classList.contains('is-open')) setOpen(false, false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) setOpen(false);
  });
  narrow.addEventListener('change', () => { if (!narrow.matches && sidebar.classList.contains('is-open')) setOpen(false, false); });
} else if (menu) {
  menu.hidden = true;
}

// Search: opens instantly from the header, "/" or Cmd/Ctrl+K. The index loads on first use.
const dialog = document.getElementById('docs-search');
const input = document.getElementById('docs-search-input');
const list = document.getElementById('docs-search-results');
const empty = dialog.querySelector('.search-empty');
let index;
let results = [];
let active = -1;

const loadIndex = () => {
  index ??= fetch('/docs/search.json').then((response) => {
    if (!response.ok) throw new Error(`Search index returned ${response.status}`);
    return response.json();
  });
  return index;
};

const score = (entry, terms) => {
  const title = entry.t.toLowerCase();
  const heading = entry.h.toLowerCase();
  const text = entry.x.toLowerCase();
  const product = entry.p.toLowerCase();
  let total = entry.h ? 0 : 1;
  for (const term of terms) {
    const inTitle = title.includes(term);
    const inHeading = heading.includes(term);
    const inText = text.includes(term);
    const inProduct = product.includes(term);
    if (!inTitle && !inHeading && !inText && !inProduct) return 0;
    total += (inTitle ? 8 : 0) + (inHeading ? 6 : 0) + (inText ? 1 : 0) + (inProduct ? 2 : 0);
    if (heading.startsWith(term) || title.startsWith(term)) total += 2;
  }
  return total;
};

const highlight = (text, terms) => {
  const lower = text.toLowerCase();
  const ranges = [];
  for (const term of terms) {
    for (let at = lower.indexOf(term); at !== -1; at = lower.indexOf(term, at + term.length)) ranges.push([at, at + term.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    fragment.append(text.slice(cursor, start));
    const mark = document.createElement('mark');
    mark.textContent = text.slice(start, end);
    fragment.append(mark);
    cursor = end;
  }
  fragment.append(text.slice(cursor));
  return fragment;
};

const snippet = (text, terms) => {
  const lower = text.toLowerCase();
  const first = Math.min(...terms.map((term) => lower.indexOf(term)).filter((at) => at >= 0));
  const start = Number.isFinite(first) && first > 60 ? text.lastIndexOf(' ', first - 50) + 1 : 0;
  return (start > 0 ? '…' : '') + text.slice(start, start + 180);
};

const select = (next, scroll = true) => {
  active = next;
  input.removeAttribute('aria-activedescendant');
  for (const [i, option] of [...list.children].entries()) {
    option.setAttribute('aria-selected', String(i === active));
    if (i === active) {
      input.setAttribute('aria-activedescendant', option.id);
      if (scroll) option.scrollIntoView({ block: 'nearest' });
    }
  }
};

const render = async () => {
  const query = input.value.trim();
  if (!query) {
    results = [];
    list.replaceChildren();
    empty.textContent = '';
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    return;
  }
  let entries;
  try {
    entries = await loadIndex();
  } catch {
    index = undefined;
    empty.textContent = 'Search could not load. Check your connection and try again.';
    return;
  }
  if (query !== input.value.trim()) return;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  results = entries
    .map((entry) => ({ entry, value: score(entry, terms) }))
    .filter((result) => result.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 20)
    .map((result) => result.entry);
  list.replaceChildren(...results.map((entry, i) => {
    const option = document.createElement('li');
    option.id = `docs-search-option-${i}`;
    option.setAttribute('role', 'option');
    const link = document.createElement('a');
    link.href = entry.u;
    link.tabIndex = -1;
    const path = document.createElement('span');
    path.className = 'result-path';
    path.textContent = entry.h ? `${entry.p} › ${entry.t}` : entry.p;
    const title = document.createElement('span');
    title.className = 'result-title';
    title.append(highlight(entry.h || entry.t, terms));
    const text = document.createElement('span');
    text.className = 'result-text';
    text.append(highlight(snippet(entry.x, terms), terms));
    link.append(path, title, text);
    option.append(link);
    option.addEventListener('pointermove', () => { if (active !== i) select(i, false); });
    return option;
  }));
  empty.textContent = results.length ? '' : `No results for "${query}".`;
  input.setAttribute('aria-expanded', String(results.length > 0));
  select(results.length ? 0 : -1);
};

const openSearch = () => {
  if (dialog.open) return;
  dialog.showModal();
  input.select();
  loadIndex().catch(() => { index = undefined; });
};
const go = (url) => {
  const target = new URL(url, location.href);
  dialog.close();
  if (target.pathname === location.pathname) location.hash = target.hash;
  else location.href = target.href;
};

for (const trigger of document.querySelectorAll('.docs-search-trigger, [data-open-search]')) trigger.addEventListener('click', openSearch);
document.addEventListener('keydown', (event) => {
  const typing = event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]');
  const shortcut = (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey);
  if (!shortcut) return;
  event.preventDefault();
  openSearch();
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
  const link = event.target instanceof Element && event.target.closest('.search-results a');
  if (link && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
    event.preventDefault();
    go(link.href);
  }
});
dialog.querySelector('.search-close').addEventListener('click', () => dialog.close());
input.addEventListener('input', render);
input.addEventListener('keydown', (event) => {
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length) {
    event.preventDefault();
    select((active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
  } else if (event.key === 'Enter' && results[active]) {
    event.preventDefault();
    go(results[active].u);
  }
});
