// In-page layout sweep (runs inside the app page via page.evaluate). Returns plain JSON.
// Coordinates are document coordinates (rect + scroll) unless noted.
async function SWEEP(opts) {
  const vw = innerWidth, vh = innerHeight, phone = vw <= 430;
  const out = { vw, vh, hash: location.hash, docH: document.documentElement.scrollHeight };
  const sx = () => scrollX, sy = () => scrollY;
  const short = (s, n = 50) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const cls = (el) => (typeof el.className === 'string' ? el.className : el.className?.baseVal || '').trim().split(/\s+/).filter((c) => c && !/^svelte-/.test(c)).slice(0, 3).join('.');
  const desc = (el) => { if (!el || el.nodeType !== 1) return ''; const c = cls(el); return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (c ? '.' + c : ''); };
  const path = (el) => { const p = []; let e = el; for (let i = 0; e && e.nodeType === 1 && i < 4; i++, e = e.parentElement) p.unshift(desc(e)); return p.join(' > '); };
  const csCache = new Map();
  const cs = (el) => { let c = csCache.get(el); if (!c) { c = getComputedStyle(el); csCache.set(el, c); } return c; };
  const visible = (el) => el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true }) : true;
  // is the element inside a fixed / sticky layer? (returns that layer element or null)
  const layerCache = new Map();
  const layerOf = (el) => {
    if (layerCache.has(el)) return layerCache.get(el);
    let r = null;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const p = cs(e).position; if (p === 'fixed' || p === 'sticky') { r = e; break; } if (e.tagName === 'DIALOG' && e.open) { r = e; break; } }
    layerCache.set(el, r); return r;
  };
  // the part of an element's rect not clipped away by overflow ancestors (viewport coords)
  const clipCache = new Map();
  const clipBox = (el) => {
    if (clipCache.has(el)) return clipCache.get(el);
    let box = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 };
    const par = el.parentElement;
    if (par) {
      box = { ...clipBox(par) };
      const c = cs(par);
      if (c.overflowX !== 'visible' || c.overflowY !== 'visible' || c.contain.includes('paint')) {
        const r = par.getBoundingClientRect();
        if (c.overflowX !== 'visible') { box.l = Math.max(box.l, r.left); box.r = Math.min(box.r, r.right); }
        if (c.overflowY !== 'visible') { box.t = Math.max(box.t, r.top); box.b = Math.min(box.b, r.bottom); }
      }
    }
    clipCache.set(el, box); return box;
  };
  const clipRect = (el, r) => { const b = clipBox(el); const l = Math.max(r.left, b.l), t = Math.max(r.top, b.t), rr = Math.min(r.right, b.r), bb = Math.min(r.bottom, b.b); return rr - l > 1 && bb - t > 1 ? { l, t, r: rr, b: bb } : null; };
  const inDialogClosed = (el) => !!el.closest('dialog:not([open])');

  // ---------- sideways scroll ----------
  const se = document.scrollingElement;
  out.hscroll = se.scrollWidth > vw + 1 ? se.scrollWidth - vw : 0;
  if (out.hscroll) {
    const wide = [];
    for (const el of document.body.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 0 && clipRect(el, r) && clipRect(el, r).r > vw + 1) wide.push({ el: path(el), right: Math.round(r.right + sx()), text: short(el.textContent, 40) });
      if (wide.length > 400) break;
    }
    // the deepest culprits: keep those with no wide descendant listed after them
    out.hscrollBy = wide.filter((w, i) => !wide.slice(i + 1).some((x) => x.el.startsWith(w.el))).slice(0, 8);
  }

  // ---------- text fragments ----------
  const frags = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const range = document.createRange();
  const owners = new Set();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TITLE|OPTION)$/.test(el.tagName) || inDialogClosed(el) || !visible(el)) continue;
    if (el.closest('.sr-only, .visually-hidden')) continue;
    { const br = el.getBoundingClientRect(); if (br.width <= 1 || br.height <= 1) continue; }
    range.selectNodeContents(n);
    const rs = range.getClientRects();
    for (const r of rs) {
      if (r.width < 2 || r.height < 4) continue;
      const c = clipRect(el, r); if (!c) continue;
      frags.push({ el, layer: layerOf(el), l: c.l + sx(), t: c.t + sy(), r: c.r + sx(), b: c.b + sy(), h: r.height, text: short(n.nodeValue, 30) });
    }
    owners.add(el);
  }
  out.textFrags = frags.length;

  // ---------- controls ----------
  const CTRL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=option], [role=link], [tabindex="0"]';
  const ctrls = [];
  for (const el of document.querySelectorAll(CTRL)) {
    if (inDialogClosed(el) || !visible(el)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const c = clipRect(el, r); if (!c) continue;
    ctrls.push({ el, layer: layerOf(el), l: c.l + sx(), t: c.t + sy(), r: c.r + sx(), b: c.b + sy(), w: r.width, h: r.height });
  }

  // ---------- overlaps (same layer only; fixed/sticky vs flow is the cover check) ----------
  const nested = (a, b) => a === b || a.contains(b) || b.contains(a);
  const inter = (a, b) => ({ x: Math.min(a.r, b.r) - Math.max(a.l, b.l), y: Math.min(a.b, b.b) - Math.max(a.t, b.t) });
  const overlaps = [], seen = new Set();
  const add = (kind, a, b, ix, iy) => {
    const k = kind + '|' + desc(a.el) + '|' + desc(b.el) + '|' + (a.text || '') + '|' + (b.text || '');
    if (seen.has(k) || overlaps.length > 60) return; seen.add(k);
    overlaps.push({ kind, a: path(a.el), aText: a.text || short(a.el.textContent, 30), b: path(b.el), bText: b.text || short(b.el.textContent, 30), ix: Math.round(ix), iy: Math.round(iy), at: [Math.round(Math.max(a.l, b.l)), Math.round(Math.max(a.t, b.t))] });
  };
  const fs = frags.slice().sort((p, q) => p.t - q.t);
  for (let i = 0; i < fs.length; i++) {
    const a = fs[i];
    for (let j = i + 1; j < fs.length && fs[j].t < a.b; j++) {
      const b = fs[j];
      if (a.el === b.el || a.layer !== b.layer || nested(a.el, b.el)) continue;
      const { x, y } = inter(a, b);
      if (x >= 3 && y >= 0.4 * Math.min(a.h, b.h)) add('text/text', a, b, x, y);
    }
  }
  const cs2 = ctrls.slice().sort((p, q) => p.t - q.t);
  for (let i = 0; i < cs2.length; i++) {
    const a = cs2[i];
    for (let j = i + 1; j < cs2.length && cs2[j].t < a.b; j++) {
      const b = cs2[j];
      if (a.layer !== b.layer || nested(a.el, b.el)) continue;
      // a control inside a <label> that wraps another control is fine; same for an input and its own label
      if (a.el.closest('label') && a.el.closest('label') === b.el.closest('label')) continue;
      // an adornment inside a field (the password eye, a clear button) sits over its input on purpose
      if (a.el.parentElement === b.el.parentElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.el.tagName) || /^(INPUT|TEXTAREA|SELECT)$/.test(b.el.tagName))) continue;
      const { x, y } = inter(a, b);
      if (x > 2 && y > 2 && x * y > 0.12 * Math.min((a.r - a.l) * (a.b - a.t), (b.r - b.l) * (b.b - b.t))) add('control/control', a, b, x, y);
    }
  }
  for (const c of ctrls) {
    for (const f of fs) {
      if (f.t > c.b) break;
      if (f.b < c.t || f.layer !== c.layer || nested(c.el, f.el) || f.el.closest('label')?.contains(c.el)) continue;
      // text of a <label for> over its own input is the floating-label pattern: skip
      if (f.el.closest('label')?.htmlFor && f.el.closest('label').htmlFor === c.el.id) continue;
      const { x, y } = inter(c, f);
      if (x >= 3 && y >= 0.4 * f.h) {
        const k0 = cs(c.el), painted = k0.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(k0.borderTopWidth) > 0 || k0.boxShadow !== 'none';
        add(painted ? 'control/text' : 'hitarea/text', { el: c.el, text: short(c.el.getAttribute('aria-label') || c.el.textContent || c.el.placeholder, 30), ...c }, f, x, y);
      }
    }
  }
  out.overlaps = overlaps;

  // ---------- clipped / cut text ----------
  const clipped = [], cseen = new Set();
  const consider = new Set();
  for (const o of owners) { let e = o; for (let i = 0; e && i < 3; i++, e = e.parentElement) consider.add(e); }
  for (const el of consider) {
    if (el === document.body || el === document.documentElement || !visible(el)) continue;
    const c = cs(el);
    const ell = c.textOverflow === 'ellipsis', ox = c.overflowX !== 'visible', oy = c.overflowY !== 'visible', clamp = c.webkitLineClamp && c.webkitLineClamp !== 'none';
    if (!ox && !oy && !clamp) continue;
    if (c.overflowX === 'auto' || c.overflowX === 'scroll') continue;   // a scroller is not a cut
    const hcut = ox && el.scrollWidth > el.clientWidth + 1;
    const vcut = (oy || clamp) && el.scrollHeight > el.clientHeight + 2 && (c.overflowY !== 'auto' && c.overflowY !== 'scroll');
    if (!hcut && !vcut) continue;
    if (el.clientWidth < 2 || el.clientHeight < 2) continue;    // sr-only
    const t = short(el.textContent, 80); if (!t) continue;
    const k = desc(el) + t; if (cseen.has(k)) continue; cseen.add(k);
    clipped.push({ el: path(el), kind: hcut ? (ell ? 'ellipsis' : 'cut') : clamp ? 'line-clamp' : 'cut-v', text: t, has: el.clientWidth, needs: el.scrollWidth, hHas: el.clientHeight, hNeeds: el.scrollHeight, title: el.title || el.getAttribute('aria-label') || '' });
    if (clipped.length > 60) break;
  }
  out.clipped = clipped;

  // ---------- small tap targets on phones ----------
  if (phone) {
    const small = [];
    for (const c of ctrls) {
      const el = c.el;
      if (c.w >= 44 && c.h >= 44) continue;
      if (/^(INPUT)$/.test(el.tagName) && /^(checkbox|radio)$/.test(el.type) && el.closest('label')) continue;
      const disp = cs(el).display;
      const inline = disp === 'inline' && el.parentElement && short(el.parentElement.textContent, 400).length > short(el.textContent, 400).length + 8;
      small.push({ el: path(el), label: short(el.getAttribute('aria-label') || el.textContent || el.placeholder || el.title, 40), w: Math.round(c.w), h: Math.round(c.h), inline, layer: c.layer ? desc(c.layer) : '' });
    }
    out.small = small.slice(0, 120); out.smallN = small.length;
  }

  // ---------- content column at desktop ----------
  const main = document.querySelector('main#main') || document.querySelector('main');
  if (main) {
    const mr = main.getBoundingClientRect(), mc = cs(main);
    const inner = { l: mr.left + parseFloat(mc.paddingLeft), r: mr.right - parseFloat(mc.paddingRight) };
    let minL = 1e9, maxR = -1e9;
    const walk = (el, d) => {
      for (const ch of el.children) {
        if (!visible(ch) || /sr-only|toaster/.test(cls(ch)) || layerOf(ch)) continue;
        const r = ch.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
        // a full-width wrapper says little: go one level down for the real extent
        if (d < 3 && r.width >= inner.r - inner.l - 2 && ch.children.length) { walk(ch, d + 1); continue; }
        // text inside: use the text's own extent for plain blocks
        minL = Math.min(minL, r.left); maxR = Math.max(maxR, r.right);
      }
    };
    walk(main, 0);
    const sb = document.querySelector('aside.sidebar'); const sbw = sb && visible(sb) ? sb.getBoundingClientRect().width : 0;
    const rail = document.querySelector('nav.nav'); const railw = rail && vw >= 600 && vw < 1024 ? rail.getBoundingClientRect().width : 0;
    const avail = vw - sbw - railw;
    out.column = { vw, sidebar: Math.round(sbw || railw), avail: Math.round(avail), mainL: Math.round(mr.left), mainR: Math.round(mr.right), innerW: Math.round(inner.r - inner.l), usedL: Math.round(minL), usedR: Math.round(maxR), usedW: Math.round(maxR - minL), usedPctOfAvail: Math.round(100 * (maxR - minL) / avail), usedPctOfVw: Math.round(100 * (maxR - minL) / vw), emptyRight: Math.round(vw - maxR), emptyLeft: Math.round(minL - sbw - railw) };
    const pt = document.querySelector('.topbar .pagetitle');
    const tb = document.querySelector('header.topbar');
    if (pt && visible(pt)) {
      const range2 = document.createRange(); range2.selectNodeContents(pt); const tr = [...range2.getClientRects()].find((r) => r.width > 2) || pt.getBoundingClientRect();
      out.title = { text: short(pt.textContent, 40), left: Math.round(tr.left), contentLeft: Math.round(inner.l), usedLeft: Math.round(minL), dx: Math.round(tr.left - minL), clipped: pt.scrollWidth > pt.clientWidth + 1, tbL: Math.round(tb.getBoundingClientRect().left), tbR: Math.round(tb.getBoundingClientRect().right), mainAreaL: Math.round(sbw + railw), mainAreaR: vw };
    }
    // a second, in-page title repeating the top bar
    const h = [...main.querySelectorAll('h1, h2')].find((x) => visible(x));
    if (h && pt) out.inpageHeading = { tag: h.tagName, text: short(h.textContent, 40), sameAsBar: short(h.textContent).toLowerCase() === short(pt.textContent).toLowerCase(), font: cs(h).fontFamily.split(',')[0], size: cs(h).fontSize, weight: cs(h).fontWeight, top: Math.round(h.getBoundingClientRect().top + sy()) };
  }

  // ---------- chip / button rows that wrap to a nearly empty row ----------
  const wraps = [];
  for (const el of (main || document.body).querySelectorAll('*')) {
    const c = cs(el);
    if (!(c.display.includes('flex') && c.flexWrap === 'wrap') || !visible(el)) continue;
    const kids = [...el.children].filter((k) => visible(k) && k.getBoundingClientRect().width > 1 && (k.matches(CTRL) || k.querySelector(CTRL) || /chip|pill|tag/.test(cls(k))));
    if (kids.length < 2) continue;
    const rows = [];
    for (const k of kids) { const r = k.getBoundingClientRect(); let row = rows.find((x) => Math.abs(x.t - r.top) < 6); if (!row) rows.push(row = { t: r.top, l: r.left, r: r.right, n: 0, items: [] }); row.l = Math.min(row.l, r.left); row.r = Math.max(row.r, r.right); row.n++; row.items.push(short(k.textContent || k.getAttribute('aria-label'), 18)); }
    if (rows.length < 2) continue;
    rows.sort((a, b) => a.t - b.t);
    const er = el.getBoundingClientRect(), w = el.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight);
    const last = rows.at(-1), fill = (last.r - last.l) / w;
    if (fill < 0.34 && last.n <= 2) wraps.push({ el: path(el), rows: rows.length, lastFill: Math.round(fill * 100), last: last.items, first: rows[0].items.slice(0, 6), width: Math.round(er.width) });
    if (wraps.length > 20) break;
  }
  out.wraps = wraps;

  // ---------- sticky / fixed bars covering things ----------
  const bars = [...document.querySelectorAll('body *')].filter((el) => { const p = cs(el).position; return (p === 'fixed' || p === 'sticky') && visible(el) && !inDialogClosed(el) && el.getBoundingClientRect().width > 20 && el.getBoundingClientRect().height > 10; });
  out.bars = bars.map((b) => ({ el: path(b), pos: cs(b).position, top: cs(b).top, z: cs(b).zIndex, h: Math.round(b.getBoundingClientRect().height) })).slice(0, 15);
  const covers = [], kseen = new Set();
  const maxY = Math.max(0, document.documentElement.scrollHeight - vh);
  const stops = [...new Set([0, Math.round(maxY * 0.33), Math.round(maxY * 0.66), maxY])];
  for (const y of stops) {
    scrollTo(0, y);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // (a) a sticky/fixed bar under another bar
    for (const a of bars) {
      const ra = a.getBoundingClientRect(); if (ra.bottom <= 0 || ra.top >= vh) continue;
      for (const b of bars) {
        if (a === b || a.contains(b) || b.contains(a)) continue;
        const rb = b.getBoundingClientRect();
        const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ix < 4 || iy < 4) continue;
        const px = Math.max(ra.left, rb.left) + ix / 2, py = Math.max(ra.top, rb.top) + iy / 2;
        const top = document.elementFromPoint(px, py);
        if (top && b.contains(top) && !a.contains(top)) {
          const k = 'bar|' + desc(a) + '|' + desc(b); if (kseen.has(k)) continue; kseen.add(k);
          covers.push({ kind: 'bar under bar', under: path(a), underText: short(a.textContent, 40), over: path(b), hiddenPx: Math.round(iy), atScroll: y });
        }
      }
    }
    // (b) controls / text in the flow covered by a bar: at the top (top bars only) and at the end of the page (any bar)
    const atEnd = y === maxY;
    if (y === 0 || atEnd) {
      const things = [...ctrls.map((c) => ({ el: c.el, layer: c.layer, label: short(c.el.getAttribute('aria-label') || c.el.textContent, 30) })), ...frags.filter((_, i) => i % 1 === 0).map((f) => ({ el: f.el, layer: f.layer, label: f.text, frag: f }))];
      for (const t of things) {
        if (t.layer) continue;
        let r;
        if (t.frag) { r = { left: t.frag.l - sx(), top: t.frag.t - sy(), right: t.frag.r - sx(), bottom: t.frag.b - sy() }; }
        else r = t.el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
        const px = Math.min(Math.max((r.left + r.right) / 2, 1), vw - 2), py = Math.min(Math.max((r.top + r.bottom) / 2, 1), vh - 2);
        const top = document.elementFromPoint(px, py); if (!top) continue;
        if (t.el.contains(top) || top.contains(t.el)) continue;
        const bar = bars.find((b) => b.contains(top));
        if (!bar) continue;
        const br = bar.getBoundingClientRect();
        const topBar = br.top < vh / 2;
        // at the top of the page only a TOP bar may not cover anything; at the end of the page only a BOTTOM bar
        const counts = (y === 0 && topBar) || (atEnd && !topBar);
        if (counts) {
          const k = 'el|' + desc(t.el) + '|' + t.label + '|' + desc(bar); if (kseen.has(k)) continue; kseen.add(k);
          covers.push({ kind: topBar ? 'under top bar at page top' : 'under bottom bar at page end', el: path(t.el), label: t.label, bar: path(bar), atScroll: y });
        }
        if (covers.length > 40) break;
      }
    }
  }
  scrollTo(0, 0);
  out.covers = covers;

  // ---------- style inventory (for consistency across screens) ----------
  if (main) {
    const sig = new Map();
    for (const el of main.querySelectorAll('*')) {
      if (!visible(el) || layerOf(el)) continue;
      const c = cs(el), r = el.getBoundingClientRect();
      if (r.width < 0.4 * (out.column?.innerW || vw - 40) || r.height < 40) continue;
      const br = parseFloat(c.borderTopLeftRadius) || 0, bw = parseFloat(c.borderTopWidth) || 0, sh = c.boxShadow !== 'none', bg = c.backgroundColor !== 'rgba(0, 0, 0, 0)';
      if (br < 8 || !(bw > 0 || sh || bg)) continue;
      const k = `r${Math.round(br)} b${bw}${bw ? ' ' + c.borderTopStyle : ''} ${sh ? 'shadow' : 'flat'} p${Math.round(parseFloat(c.paddingTop))}/${Math.round(parseFloat(c.paddingLeft))}`;
      const e = sig.get(k) || { n: 0, cls: new Set() }; e.n++; e.cls.add(cls(el) || el.tagName.toLowerCase()); sig.set(k, e);
    }
    out.cards = [...sig.entries()].map(([k, v]) => ({ sig: k, n: v.n, cls: [...v.cls].slice(0, 5) }));
    const hs = new Map();
    for (const h of main.querySelectorAll('h1,h2,h3,.page-head, .section-h, legend')) {
      if (!visible(h)) continue; const c = cs(h);
      const k = `${h.tagName.toLowerCase()} ${c.fontFamily.split(',')[0].replace(/"/g, '')} ${c.fontSize} ${c.fontWeight} ${c.textTransform !== 'none' ? c.textTransform : ''}`.trim();
      const e = hs.get(k) || { n: 0, cls: new Set(), ex: short(h.textContent, 30) }; e.n++; e.cls.add(cls(h) || '-'); hs.set(k, e);
    }
    out.headings = [...hs.entries()].map(([k, v]) => ({ sig: k, n: v.n, cls: [...v.cls].slice(0, 4), ex: v.ex }));
    const bs = new Map();
    for (const b of main.querySelectorAll('button, a.btn, a.action, .btn')) {
      if (!visible(b) || layerOf(b)) continue; const c = cs(b), r = b.getBoundingClientRect(); if (r.width < 30) continue;
      const k = `h${Math.round(r.height)} r${Math.round(parseFloat(c.borderTopLeftRadius))} ${c.fontSize} ${c.fontWeight}`;
      bs.set(k, (bs.get(k) || 0) + 1);
    }
    out.buttons = [...bs.entries()].map(([k, n]) => ({ sig: k, n }));
  }

  // ---------- control inventory (wiring) ----------
  if (opts?.inventory) {
    const inv = [], iseen = new Set();
    for (const c of ctrls) {
      const el = c.el;
      const label = short(el.getAttribute('aria-label') || el.getAttribute('title') || (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? (el.labels?.[0]?.textContent || el.placeholder || el.name) : el.textContent) || el.value, 60);
      const item = { tag: el.tagName.toLowerCase(), type: el.type || el.getAttribute('role') || '', label, id: el.id || '', href: el.getAttribute('href') || '', cls: cls(el), layer: c.layer ? desc(c.layer) : '' };
      const k = item.tag + item.label + item.id + item.href; if (iseen.has(k)) continue; iseen.add(k); inv.push(item);
    }
    out.controls = inv;
  }
  out.mainText = main ? short(main.textContent, 300) : short(document.body.textContent, 300);
  return out;
}
