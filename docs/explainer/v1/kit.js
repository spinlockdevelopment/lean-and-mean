/* lean-and-mean explainer kit v1. A page is a short shell:
 *   <!doctype html><meta charset="utf-8">
 *   <script src=".../explainer/v1/kit.js" data-style="dark dense #14b8a6"></script>
 *   <xmp> markdown + component fences </xmp>
 * The kit loads its CSS, fonts, marked, highlight.js and (only when used) mermaid,
 * then renders the <xmp> body. Offline, the browser shows the <xmp> source as text.
 * Breaking syntax or look changes go to v2/; v1 pages must keep rendering. */
(function () {
  'use strict';

  var LIB = {
    marked: 'https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js',
    hljs: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
    mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js',
    fonts: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;600&family=Schibsted+Grotesk:wght@600;700&display=swap'
  };

  // ---------- pure helpers (exported for tests) ----------

  function parseStyle(s) {
    var o = { theme: 'auto', density: 'dense', accent: null };
    String(s || '').split(/\s+/).forEach(function (t) {
      if (/^(dark|light|auto)$/.test(t)) o.theme = t;
      else if (/^(dense|airy)$/.test(t)) o.density = t;
      else if (/^#[0-9a-f]{3,8}$/i.test(t)) o.accent = t;
    });
    return o;
  }

  // Leading `---` block of `key: value` lines.
  function frontmatter(src) {
    var m = /^\s*---\n([\s\S]*?)\n---\n?/.exec(src);
    if (!m) return { meta: {}, body: src };
    var meta = {};
    m[1].split('\n').forEach(function (l) {
      var i = l.indexOf(':');
      if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim();
    });
    return { meta: meta, body: src.slice(m[0].length) };
  }

  // Strip the common indent so the <xmp> body may be indented; `<\/xmp>` is the escape for a literal end tag.
  function dedent(s) {
    var lines = s.replace(/\t/g, '  ').split('\n');
    var min = Infinity;
    lines.forEach(function (l) { if (l.trim()) min = Math.min(min, l.match(/^ */)[0].length); });
    return lines.map(function (l) { return l.slice(min === Infinity ? 0 : min); }).join('\n').trim().replace(/<\\\/xmp>/gi, '</xmp>') + '\n';
  }

  // Component bodies: a line starting with `# ` opens an item; nested fences are skipped.
  function items(body) {
    var out = [], cur = null, fence = null, intro = [];
    body.split('\n').forEach(function (l) {
      var f = /^\s*(`{3,}|~{3,})/.exec(l);
      if (f) fence = fence ? (f[1][0] === fence[0] && f[1].length >= fence.length ? null : fence) : f[1];
      if (!fence && !f && /^# /.test(l)) { cur = { title: l.slice(2).trim(), body: [] }; out.push(cur); return; }
      (cur ? cur.body : intro).push(l);
    });
    out.forEach(function (it) { it.body = it.body.join('\n').trim(); });
    out.intro = intro.join('\n').trim();
    return out;
  }

  // Columns that divide the count: 4 → 2×2, 6 → 3×2, 8 → 4×2, 5 → 3+2.
  function gridCols(n) {
    if (n <= 3) return n;
    if (n % 3 === 0) return 3;
    if (n === 4) return 2;
    if (n % 4 === 0) return 4;
    return n % 2 === 0 ? 2 : 3;
  }

  // `|`-separated rows, trimmed; blank lines dropped.
  function rows(body) {
    return body.split('\n').filter(function (l) { return l.trim(); })
      .map(function (l) { return l.split('|').map(function (c) { return c.trim(); }); });
  }

  // Indented file tree → [{name, note, prefix}] with box-drawing connectors.
  function tree(body) {
    var ls = body.split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
      var ind = l.match(/^ */)[0].length, t = l.trim(), h = t.search(/\s+#\s/);
      return { ind: ind, name: h < 0 ? t : t.slice(0, h).trim(), note: h < 0 ? '' : t.slice(h).replace(/^\s+#\s/, '') };
    });
    var unit = ls.reduce(function (u, l) { return l.ind && (!u || l.ind < u) ? l.ind : u; }, 0) || 2;
    ls.forEach(function (l) { l.d = Math.round(l.ind / unit); });
    var open = [];
    return ls.map(function (l, i) {
      var next = false;
      for (var j = i + 1; j < ls.length; j++) { if (ls[j].d < l.d) break; if (ls[j].d === l.d) { next = true; break; } }
      var pre = '';
      for (var d = 1; d < l.d; d++) pre += open[d] ? '│  ' : '   ';
      if (l.d > 0) pre += next ? '├─ ' : '└─ ';
      open[l.d] = next;
      return { name: l.name, note: l.note, prefix: pre, dir: /\/$/.test(l.name) };
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function slug(s) {
    return String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/&\w+;/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 's';
  }

  var PATH = /^(?=[^/]*\/)[\w.@~\/-]+(:\d+(-\d+)?)?$|^[\w.-]+\.[a-z]{1,5}(:\d+(-\d+)?)?$/i;

  var api = { parseStyle: parseStyle, frontmatter: frontmatter, dedent: dedent, items: items, gridCols: gridCols, rows: rows, tree: tree, isPath: function (s) { return PATH.test(s); } };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ---------- boot: style before first paint ----------

  var me = document.currentScript;
  var base = me.src.replace(/[^/]*$/, '');
  var style = parseStyle(me.getAttribute('data-style'));
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('x-theme'); } catch (e) { /* storage blocked: use page style */ }
  var theme = saved || style.theme; // a saved light/dark choice wins; Auto clears it back to the page style
  if (theme !== 'auto') root.setAttribute('data-theme', theme);
  root.setAttribute('data-density', style.density);
  if (style.accent) root.style.setProperty('--accent', style.accent);
  root.lang = root.lang || 'en';

  function head(tag, attrs) {
    var el = document.createElement(tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    document.head.appendChild(el);
    return el;
  }
  if (!document.querySelector('meta[name=viewport]')) head('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' });
  head('style', {}).textContent = 'xmp{display:none}';
  head('link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' });
  head('link', { rel: 'stylesheet', href: LIB.fonts });
  head('link', { rel: 'stylesheet', href: base + 'kit.css' });

  var loading = {};
  function load(name) {
    return loading[name] || (loading[name] = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = LIB[name]; s.onload = ok; s.onerror = function () { fail(new Error('Could not load ' + name)); };
      document.head.appendChild(s);
    }));
  }
  load('marked'); load('hljs');

  // ---------- components ----------

  var md; // marked.parse, bound after load
  var ICON = {
    note: '<path d="M12 8v.01M11 12h1v5h1"/><circle cx="12" cy="12" r="9"/>',
    tip: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    warn: '<path d="M12 9v4M12 17v.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    risk: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    why: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.01"/>'
  };
  var LABEL = { note: 'Note', tip: 'Tip', warn: 'Warning', risk: 'Risk', ok: 'Works', why: 'Why' };
  function icon(k) { return '<svg class="x-ico" viewBox="0 0 24 24" aria-hidden="true">' + ICON[k] + '</svg>'; }

  var uid = 0;
  var C = {};

  Object.keys(ICON).forEach(function (k) {
    C[k] = function (b, arg) {
      return '<aside class="x-callout x-' + k + '" role="note"><div class="x-callout-h">' + icon(k) +
        '<span>' + esc(arg || LABEL[k]) + '</span></div><div class="x-callout-b">' + md(b) + '</div></aside>';
    };
  });

  C.cards = function (b) {
    var it = items(b);
    return '<div class="x-cards" style="--cols:' + gridCols(it.length) + '">' + it.map(function (c) {
      return '<section class="x-card"><h3>' + md.inline(c.title) + '</h3>' + md(c.body) + '</section>';
    }).join('') + '</div>';
  };

  C.stats = function (b) {
    var r = rows(b);
    return '<div class="x-stats" style="--cols:' + gridCols(r.length) + '">' + r.map(function (c) {
      var d = c[2] || '', dir = /^\+/.test(d) ? 'up' : /^[-−]/.test(d) ? 'down' : '';
      return '<div class="x-stat"><div class="x-stat-v">' + md.inline(c[0]) + '</div><div class="x-stat-l">' + md.inline(c[1] || '') +
        '</div>' + (d ? '<div class="x-stat-d ' + dir + '">' + md.inline(d) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  };

  C.steps = function (b) {
    return '<ol class="x-steps">' + items(b).map(function (s, i) {
      return '<li><span class="x-step-n" aria-hidden="true">' + (i + 1) + '</span><div><h3>' + md.inline(s.title) + '</h3>' + md(s.body) + '</div></li>';
    }).join('') + '</ol>';
  };

  C.tabs = function (b) {
    var it = items(b), id = 'x-t' + (++uid);
    return '<div class="x-tabs"><div class="x-tablist" role="tablist">' + it.map(function (t, i) {
      return '<button role="tab" id="' + id + i + '" aria-controls="' + id + i + 'p" aria-selected="' + (i === 0) + '" tabindex="' + (i ? -1 : 0) + '">' + md.inline(t.title) + '</button>';
    }).join('') + '</div>' + it.map(function (t, i) {
      return '<div role="tabpanel" id="' + id + i + 'p" aria-labelledby="' + id + i + '"' + (i ? ' hidden' : '') + '>' + md(t.body) + '</div>';
    }).join('') + '</div>';
  };

  C.compare = function (b) {
    var it = items(b);
    return '<div class="x-compare" style="--cols:' + gridCols(it.length) + '">' + it.map(function (o) {
      var star = /\s\*$/.test(o.title), title = o.title.replace(/\s\*$/, '');
      var rest = [], list = [];
      o.body.split('\n').forEach(function (l) {
        var m = /^([+\-=])\s+(.*)$/.exec(l);
        if (m) list.push('<li class="x-' + { '+': 'pro', '-': 'con', '=': 'meh' }[m[1]] + '"><span><span class="x-sr">' + { '+': 'Pro: ', '-': 'Con: ', '=': 'Neutral: ' }[m[1]] + '</span>' + md.inline(m[2]) + '</span></li>');
        else rest.push(l);
      });
      return '<section class="x-option' + (star ? ' x-pick' : '') + '"><h3>' + md.inline(title) + (star ? ' <span class="x-badge">Pick</span>' : '') + '</h3>' +
        md(rest.join('\n')) + (list.length ? '<ul class="x-pc">' + list.join('') + '</ul>' : '') + '</section>';
    }).join('') + '</div>';
  };

  C.flow = function (b) {
    return '<div class="x-flow">' + b.split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
      return '<ol class="x-flow-row">' + l.split(/\s*->\s*/).map(function (n) {
        var m = /^(.*?)\s*\((.*)\)$/.exec(n);
        return '<li><span class="x-node">' + md.inline(m ? m[1] : n) + (m ? '<small>' + md.inline(m[2]) + '</small>' : '') + '</span></li>';
      }).join('') + '</ol>';
    }).join('') + '</div>';
  };

  C.tree = function (b) {
    return '<div class="x-scroll"><pre class="x-tree" role="tree">' + tree(b).map(function (l) {
      return '<span class="x-tree-row" role="treeitem"><span class="x-tree-pre">' + l.prefix + '</span><span class="' + (l.dir ? 'x-dir' : 'x-file') + '">' + esc(l.name) +
        '</span>' + (l.note ? '<span class="x-tree-note">' + md.inline(l.note) + '</span>' : '') + '</span>';
    }).join('\n') + '</pre></div>';
  };

  C.timeline = function (b) {
    return '<ol class="x-timeline">' + rows(b).map(function (r) {
      return '<li><time>' + esc(r[0]) + '</time><div>' + md.inline(r.slice(1).join(' | ')) + '</div></li>';
    }).join('') + '</ol>';
  };

  C.bars = function (b, unit) {
    var r = rows(b), max = Math.max.apply(null, r.map(function (x) { return parseFloat(x[1]) || 0; })) || 1;
    return '<figure class="x-bars">' + r.map(function (x) {
      var v = parseFloat(x[1]) || 0;
      return '<div class="x-bar"><span class="x-bar-l">' + md.inline(x[0]) + '</span><span class="x-bar-t"><span style="width:' + (v / max * 100).toFixed(1) +
        '%"></span></span><span class="x-bar-v">' + esc(x[1]) + (unit ? ' ' + esc(unit) : '') + '</span></div>';
    }).join('') + '</figure>';
  };

  C.layers = function (b) {
    return '<ol class="x-layers">' + rows(b).map(function (r) {
      return '<li><strong>' + md.inline(r[0]) + '</strong>' + (r[1] ? '<span>' + md.inline(r.slice(1).join(' | ')) + '</span>' : '') + '</li>';
    }).join('') + '</ol>';
  };

  C.defs = function (b) {
    return '<dl class="x-defs">' + b.split('\n').filter(function (l) { return l.trim(); }).map(function (l) {
      var i = l.indexOf(':');
      return '<div><dt>' + md.inline(l.slice(0, i).trim()) + '</dt><dd>' + md.inline(l.slice(i + 1).trim()) + '</dd></div>';
    }).join('') + '</dl>';
  };

  C.faq = function (b) {
    return '<div class="x-faq">' + items(b).map(function (q) {
      return '<details><summary>' + md.inline(q.title) + '</summary><div>' + md(q.body) + '</div></details>';
    }).join('') + '</div>';
  };

  C.mermaid = function (b, arg) {
    return '<figure class="x-diagram"><div class="x-scroll"><pre class="mermaid" data-src="' + esc(b) + '">' + esc(b) + '</pre></div>' +
      (arg ? '<figcaption>' + md.inline(arg) + '</figcaption>' : '') + '<button class="x-zoom-btn" type="button" aria-label="Enlarge diagram">⤢</button></figure>';
  };

  function codeBlock(code, lang, arg) {
    var m = /^(.*?)(?::(\d+))?(?:-\d+)?$/.exec(arg || ''), path = m[1], start = m[2] ? +m[2] : 0;
    var cls = lang ? ' class="language-' + esc(lang) + '"' : '';
    return '<figure class="x-code">' + (path || lang ? '<figcaption><span class="x-path">' + esc(arg || '') + '</span><span class="x-lang">' + esc(lang || '') + '</span></figcaption>' : '') +
      '<div class="x-scroll x-codebody">' + (start ? '<pre class="x-gutter" aria-hidden="true">' + code.replace(/\n$/, '').split('\n').map(function (_, i) { return start + i; }).join('\n') + '</pre>' : '') +
      '<pre><code' + cls + '>' + esc(code.replace(/\n$/, '')) + '</code></pre></div>' +
      '<button class="x-copy" type="button">Copy</button></figure>';
  }

  // ---------- render ----------

  function render() {
    var x = document.querySelector('xmp');
    if (!x) return;
    var fm = frontmatter(dedent(x.textContent));
    var toc = [], title = null, seen = {};

    var renderer = {
      code: function (code, info) {
        var p = (info || '').trim().split(/\s+/), name = p.shift() || '', arg = p.join(' ');
        if (C[name]) return C[name](code, arg);
        return codeBlock(code, name, arg);
      },
      codespan: function (t) {
        var raw = t.replace(/&amp;/g, '&');
        return api.isPath(raw) ? '<code class="x-path">' + t + '</code>' : false;
      },
      heading: function (text, level, raw) {
        if (level === 1 && !title) { title = text; return '<h1 class="x-title">' + text + '</h1>'; }
        var id = slug(raw); if (seen[id]) id += '-' + (++seen[id]); else seen[id] = 1;
        if (level === 2) toc.push({ id: id, text: text });
        return '<h' + level + ' id="' + id + '"><a class="x-anchor" href="#' + id + '" aria-label="Link to this section">#</a>' + text + '</h' + level + '>';
      },
      table: function (h, b) { return '<div class="x-scroll x-table"><table><thead>' + h + '</thead><tbody>' + b + '</tbody></table></div>'; },
      tablecell: function (c, f) {
        var t = c.trim().toLowerCase(), mark = { yes: 'ok', '✓': 'ok', no: 'risk', '✗': 'risk', partial: 'warn', '~': 'warn' }[t];
        var tag = f.header ? 'th' : 'td', al = f.align ? ' style="text-align:' + f.align + '"' : '';
        return '<' + tag + al + '>' + (mark && !f.header ? '<span class="x-mark x-mark-' + mark + '">' + c + '</span>' : c) + '</' + tag + '>';
      }
    };
    window.marked.use({ renderer: renderer, gfm: true });
    md = function (s) { return s ? window.marked.parse(s) : ''; };
    md.inline = function (s) { return window.marked.parseInline(s || ''); };

    var html = md(fm.body);
    var t = document.createElement('div');
    t.innerHTML = html;
    var h1 = t.querySelector('h1.x-title');
    var lede = h1 && h1.nextElementSibling && h1.nextElementSibling.tagName === 'P' ? h1.nextElementSibling : null;
    if (h1) h1.remove();
    if (lede) lede.remove();
    if (!document.title) document.title = (h1 ? h1.textContent : 'Explainer');

    var date = fm.meta.date ? new Date(fm.meta.date) : null;
    var dateText = date && !isNaN(date) ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : esc(fm.meta.date || '');

    var page = document.createElement('div');
    page.className = 'x-page';
    page.innerHTML =
      '<div class="x-progress" aria-hidden="true"><span></span></div>' +
      '<header class="x-head">' +
        '<div class="x-head-row"><span class="x-eyebrow">' + esc(fm.meta.eyebrow || 'Explainer') + '</span>' +
        '<button class="x-theme" type="button" aria-label="Theme"><span></span></button></div>' +
        (h1 ? '<h1>' + h1.innerHTML + '</h1>' : '') +
        (lede ? '<p class="x-lede">' + lede.innerHTML + '</p>' : '') +
      '</header>' +
      (toc.length > 2 ? '<nav class="x-toc" aria-label="On this page"><p>On this page</p><ol>' + toc.map(function (h) {
        return '<li><a href="#' + h.id + '">' + h.text.replace(/<a[^>]*>#<\/a>/, '') + '</a></li>';
      }).join('') + '</ol></nav>' : '') +
      '<main class="x-main">' + t.innerHTML + '</main>' +
      '<footer class="x-foot"><span>' + (dateText ? '<time datetime="' + esc(fm.meta.date) + '">' + dateText + '</time>' : '') + '</span>' +
      '<details><summary>Source</summary><pre></pre></details></footer>' +
      '<dialog class="x-zoom" aria-label="Diagram"><button type="button" class="x-zoom-close" aria-label="Close">×</button><div></div></dialog>';
    page.querySelector('.x-foot pre').textContent = x.textContent.trim();
    x.replaceWith(page);
    if (toc.length > 2) page.classList.add('has-toc');

    wire(page);
    if (location.hash) { var target = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (target) target.scrollIntoView(); }
  }

  // ---------- behavior ----------

  function wire(page) {
    // Theme toggle: auto → light → dark → auto, remembered per browser.
    var btn = page.querySelector('.x-theme');
    function label() {
      var cur = root.getAttribute('data-theme') || 'auto';
      btn.firstChild.textContent = { auto: 'Auto', light: 'Light', dark: 'Dark' }[cur];
      btn.setAttribute('aria-label', 'Theme: ' + cur + '. Change theme');
    }
    btn.onclick = function () {
      var next = { auto: 'light', light: 'dark', dark: 'auto' }[root.getAttribute('data-theme') || 'auto'];
      if (next === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', next);
      try { if (next === 'auto') localStorage.removeItem('x-theme'); else localStorage.setItem('x-theme', next); } catch (e) { /* not remembered */ }
      label(); diagrams(page);
    };
    label();
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { diagrams(page); });

    // Tabs with arrow keys.
    page.querySelectorAll('.x-tablist').forEach(function (list) {
      var tabs = [].slice.call(list.children);
      function pick(i) {
        tabs.forEach(function (t, j) {
          t.setAttribute('aria-selected', i === j); t.tabIndex = i === j ? 0 : -1;
          document.getElementById(t.getAttribute('aria-controls')).hidden = i !== j;
        });
        tabs[i].focus(); diagrams(page);
      }
      tabs.forEach(function (t, i) {
        t.onclick = function () { pick(i); };
        t.onkeydown = function (e) {
          var n = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
          if (n) { e.preventDefault(); pick((i + n + tabs.length) % tabs.length); }
        };
      });
    });

    // Copy buttons.
    page.querySelectorAll('.x-copy').forEach(function (b) {
      b.onclick = function () {
        var code = b.parentNode.querySelector('code');
        function done(t) { b.textContent = t; setTimeout(function () { b.textContent = 'Copy'; }, 1400); }
        function fallback() { var r = document.createRange(); r.selectNodeContents(code); var s = getSelection(); s.removeAllRanges(); s.addRange(r); done('Selected'); }
        if (navigator.clipboard) navigator.clipboard.writeText(code.textContent).then(function () { done('Copied'); }, fallback); else fallback();
      };
    });

    // Diagram zoom.
    var dlg = page.querySelector('.x-zoom');
    page.querySelectorAll('.x-zoom-btn').forEach(function (b) {
      b.onclick = function () {
        var svg = b.parentNode.querySelector('svg');
        if (!svg || !dlg.showModal) return;
        var c = svg.cloneNode(true); c.removeAttribute('style'); c.removeAttribute('width');
        dlg.lastChild.replaceChildren(c); dlg.showModal();
      };
    });
    dlg.querySelector('.x-zoom-close').onclick = function () { dlg.close(); };
    dlg.onclick = function (e) { if (e.target === dlg) dlg.close(); };

    // Reading progress and TOC scrollspy.
    var bar = page.querySelector('.x-progress span');
    var links = {};
    page.querySelectorAll('.x-toc a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var heads = page.querySelectorAll('.x-main h2');
    var tick = false;
    function onScroll() {
      if (tick) return; tick = true;
      requestAnimationFrame(function () {
        tick = false;
        var max = document.documentElement.scrollHeight - innerHeight;
        bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 1) + ')';
        var cur = null;
        heads.forEach(function (h) { if (h.getBoundingClientRect().top < innerHeight * 0.3) cur = h.id; });
        for (var k in links) links[k].classList.toggle('on', k === cur);
      });
    }
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    // Syntax highlighting.
    var blocks = page.querySelectorAll('pre code[class*="language-"]');
    if (blocks.length) load('hljs').then(function () {
      blocks.forEach(function (c) { if (window.hljs.getLanguage(c.className.replace('language-', ''))) window.hljs.highlightElement(c); });
    }, function () { /* plain code stays readable */ });

    diagrams(page);
  }

  // Resolve a CSS color (including color-mix) to #rrggbb for mermaid: computed style first, canvas as fallback.
  var probe, cv;
  function hex(v) {
    if (!probe) { probe = document.createElement('i'); probe.hidden = true; document.body.appendChild(probe); }
    probe.style.color = ''; probe.style.color = v;
    var c = getComputedStyle(probe).color, m, n;
    if ((m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(c))) n = [+m[1], +m[2], +m[3]];
    else if ((m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c))) n = [m[1] * 255, m[2] * 255, m[3] * 255];
    else {
      cv = cv || document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = v; cv.fillRect(0, 0, 1, 1);
      n = [].slice.call(cv.getImageData(0, 0, 1, 1).data, 0, 3);
    }
    return '#' + n.map(function (x) { return ('0' + Math.round(Math.min(255, Math.max(0, x))).toString(16)).slice(-2); }).join('');
  }

  var drawing = Promise.resolve();
  function diagrams(page) {
    var pres = [].filter.call(page.querySelectorAll('pre.mermaid'), function (p) { return p.offsetParent; });
    if (!pres.length) return;
    drawing = drawing.then(function () { return load('mermaid'); }).then(function () {
      var cs = getComputedStyle(page), v = function (n) { return hex(cs.getPropertyValue(n).trim()); };
      window.mermaid.initialize({
        startOnLoad: false, theme: 'base', securityLevel: 'strict', fontFamily: cs.getPropertyValue('--font-body'),
        themeVariables: {
          background: v('--surface'), primaryColor: v('--raised'), primaryTextColor: v('--fg'), primaryBorderColor: v('--accent'),
          secondaryColor: v('--accent-soft'), secondaryTextColor: v('--fg'), secondaryBorderColor: v('--line'),
          tertiaryColor: v('--surface'), tertiaryTextColor: v('--fg'), tertiaryBorderColor: v('--line'),
          lineColor: v('--muted'), textColor: v('--fg'), mainBkg: v('--raised'), nodeBorder: v('--accent'),
          clusterBkg: v('--surface'), clusterBorder: v('--line'), edgeLabelBackground: v('--surface'),
          noteBkgColor: v('--accent-soft'), noteTextColor: v('--fg'), noteBorderColor: v('--accent'),
          actorBkg: v('--raised'), actorBorder: v('--accent'), actorTextColor: v('--fg'), actorLineColor: v('--muted'),
          signalColor: v('--fg'), signalTextColor: v('--fg'), labelBoxBkgColor: v('--raised'), labelTextColor: v('--fg'),
          fontSize: '14px'
        }
      });
      pres.forEach(function (p) { p.removeAttribute('data-processed'); p.textContent = p.getAttribute('data-src'); });
      return window.mermaid.run({ nodes: pres });
    }).catch(function (e) {
      pres.forEach(function (p) { if (!p.querySelector('svg')) p.classList.add('x-failed'); });
      console.warn('explainer kit:', e);
    });
  }

  function start() {
    load('marked').then(render, function () {
      var x = document.querySelector('xmp');
      if (x) x.style.display = 'block'; // offline: show the source
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
