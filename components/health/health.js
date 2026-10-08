/* 健康 —— 参考前端（只画，不接数据源）
   ════════════════════════════════════════════════════════════════
   零依赖、零网络。你把数据喂进来，它画两层：
     · 主页：今天四个大数 / 心情 24 小时 / 最近 14 天三条小走势 / 几点睡几点醒 / 此刻 / 周期
     · 趋势：心情、步数、HRV、静息心率四张能点能滑的曲线 ＋ 睡眠节律 ＋ 这一刻
             ＋ 折叠在最底下的基本信息（身高体重这些，拿来算 BMI、步幅、最大心率）
   主页上四个大数点哪个都进趋势，趋势页左上角回来。

   ★ 这块**不接任何数据源，也不替你适配**：手机健康、快捷指令、手表、各家 app 的口径都不一样，
     接哪家、怎么存是你的事。它只认一种格式，README 里写全了。

   用法：
     var page = HealthPage(host, {
       series:   (days) => ({axis, series, mood, cycles}),   // 可以返回 Promise
       now:      ()     => ({steps, sleep_h, resting_hr, hrv_ms, hr_now, spo2, resp_rate, weight_kg}),
       bio:      {height, weight, born, sleepGoal, stepGoal},  // 可选：基本信息的初值
       birthday: 'MM-DD',                                     // 可选：算年龄更准
       onSaveBio: (bio) => true,                               // 可选：返回 false 或抛错 = 没存上
     });
     page.refresh(); page.openTrend(); page.closeTrend();

   ★ 画法上的几条规矩（都是真踩过的，别当装饰改掉）：
     · 缺的那天是 null，不是 0 —— 「那天没数据」和「那天走了 0 步」不是一回事，画成 0 会砸出假谷。
     · 有正负的线（心情）填充收在零线上，不收在底边 —— 否则 −0.4 会读成「矮一点的正柱」。
     · 主页那三条小线，各自按自己有数的那几天铺满整宽（它们没坐标轴，看的是形状）。
     · 睡眠画成竖条（从躺下画到起床），轴从真实的数里取 —— 作息会转，写死 20:00→12:00 装不下。
     · 周期不假设 28 天、不预测哪一天、不判断正不正常，只说上次哪天、走到第几天、以往间隔多少。
     · 点 / 滑取值只走 pointer 事件：浏览器在 touchend 后补发的 click 会把刚选中的切回去。
       松手保留落点；只有「没挪过、又落回本来选中的那一点」才算再点一次、取消。
     · 生长动画滚进视野才长，而且只长一遍（滚回来重播，看着像加载圈）。
   ════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HealthPage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
    });
  };
  var num = function (v) { var x = Array.isArray(v) ? v[0] : v; return (x == null || x === '') ? null : +x; };
  var stag = function (i) { return Math.min(i * 48, 336) + 'ms'; };   /* 错峰 48ms，最多 8 档 */
  var sign = function (v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2); };
  function plen(P) {
    var L = 0;
    for (var i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    return L;
  }
  function clk(h) {
    if (h == null) return '—';
    var hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60) % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  /* 数据口子：可以直接给值，也可以给返回值 / Promise 的函数。出错或没给就用兜底，页面照画。 */
  function ask(src, arg, fallback) {
    var v;
    try { v = typeof src === 'function' ? src(arg) : src; } catch (e) { return Promise.resolve(fallback); }
    return Promise.resolve(v).then(function (x) { return x == null ? fallback : x; },
                                   function () { return fallback; });
  }

  /* 睡眠的几何，主页那张和趋势页那张共用。
     钟点摊到一条从 18:00 起算的连续轴上（0＝18:00，24＝次日 18:00），起床早于躺下就 +24；
     轴的上下界从真实的数里取，不写死。 */
  function sleepGeo(bed, wake, axisLen) {
    var idx = [];
    for (var k = 0; k < axisLen; k++) if (bed[k] != null && wake[k] != null) idx.push(k);
    if (idx.length < 2) return null;
    var shift = function (h) { return (h - 18 + 24) % 24; };
    var seg = idx.map(function (k) {
      var b = shift(bed[k]), w = shift(wake[k]);
      if (w <= b) w += 24;
      return {k: k, b: b, w: w};
    });
    var lo = Math.floor(Math.min.apply(null, seg.map(function (x) { return x.b; })));
    var hi = Math.ceil(Math.max.apply(null, seg.map(function (x) { return x.w; })));
    if (hi - lo < 8) hi = lo + 8;          /* 挤在一起时至少留 8 小时的高度 */
    /* 网格线：轴窄每 4 小时一条，轴宽了改 8 小时 —— 作息转得厉害时轴能拉到 28 小时 */
    var grid = [];
    var hours = (hi - lo) > 16 ? [0, 8, 16] : [0, 4, 8, 12, 16, 20];
    hours.forEach(function (c) {
      [shift(c), shift(c) + 24].forEach(function (x) {
        if (x > lo + 0.4 && x < hi - 0.4) grid.push({x: x, c: c});
      });
    });
    grid.sort(function (a, b) { return a.x - b.x; });
    var avgB = seg.reduce(function (a, x) { return a + x.b; }, 0) / seg.length;
    return {idx: idx, seg: seg, lo: lo, hi: hi, grid: grid, avgB: avgB,
            last: seg[seg.length - 1],
            /* 「两点以后才睡」按钟点判：02:00–12:00 之间躺下算 */
            lateN: idx.filter(function (k) { return bed[k] >= 2 && bed[k] < 12; }).length,
            avgClock: (avgB + 18) % 24};
  }

  function HealthPage(host, opts) {
    if (!host) throw new Error('HealthPage：要给一个容器');
    opts = opts || {};
    host.classList.add('hl');
    host.innerHTML =
        '<div class="hl-page"><div class="hl-list"><p class="dnone">翻一下…</p></div></div>'
      + '<div class="hl-trend" hidden>'
      +   '<div class="hl-bar"><button type="button" data-hl-back aria-label="返回">'
      +     '<svg viewBox="0 0 24 24"><path d="M5 12l14 0"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/></svg>'
      +   '</button><b>趋势</b></div>'
      +   '<div class="hrange"><span class="pill"></span><div class="rr">'
      +     '<button type="button" data-days="7">7 天</button>'
      +     '<button type="button" data-days="14" class="on">14 天</button>'
      +     '<button type="button" data-days="30">1 个月</button>'
      +     '<button type="button" data-days="90">3 个月</button>'
      +   '</div></div>'
      +   '<div class="hl-sublist"></div>'
      + '</div>';
    var page = host.querySelector('.hl-page'), list = host.querySelector('.hl-list');
    var trend = host.querySelector('.hl-trend'), sublist = host.querySelector('.hl-sublist');
    var rangebox = host.querySelector('.hrange'), rangepill = host.querySelector('.hrange .pill');

    /* 基本信息：收进来的每一样都真的被下游用上 ——
       身高体重 → BMI、步幅、今天走了多远；出生年 → 年龄、最大心率、心率储备；两个目标 → 还差多少。 */
    var BIO = {height: '', weight: '', born: '', sleepGoal: '8', stepGoal: '4000'};
    if (opts.bio) for (var bk in BIO) if (opts.bio[bk] != null) BIO[bk] = String(opts.bio[bk]);
    var LIVE = {};   /* 主页那份「此刻」，趋势页直接借用，不重取 */

    /* ── 生长动画：滚进视野才长，而且只长一遍 ── */
    var HIO = null;
    function hGrow(rootEl) {
      if (!rootEl || !('IntersectionObserver' in window)) return;
      if (!HIO) HIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting || e.target.dataset.grown) return;
          e.target.dataset.grown = '1';
          /* ★ 重播必须 cancel() 再 play()：只把 currentTime 拨回 0，对已经播完的 CSS 动画不生效 */
          if (e.target.getAnimations) e.target.getAnimations({subtree: true}).forEach(function (a) {
            try { a.cancel(); a.play(); } catch (err) {}
          });
        });
      }, {threshold: .18});
      rootEl.querySelectorAll('[data-grow]').forEach(function (b) { delete b.dataset.grown; HIO.observe(b); });
    }

    /* ══════════ 主页 ══════════ */

    /* 心情那张图的状态：选中哪个点 / 选中哪个词 */
    var mSel = null, mTag = null, MOOD = [], SLEEPSPAN = null, MOOD_POP = true;

    function moodCard() {
      if (!MOOD.length) return '';
      /* 窗口＝「最后一条往前推 24 小时」，不是「今天 0 点到现在」—— 夜里那几条恰恰最该看 */
      var t1 = new Date(MOOD[MOOD.length - 1].ts), t0 = new Date(t1.getTime() - 24 * 3600 * 1000);
      var span = t1 - t0;
      var dx = function (ts) { return 10 + (new Date(ts) - t0) / span * 329; };
      var dy = function (v) { return 78 - v * 54; };
      var P = MOOD.map(function (m) { return [dx(m.ts), dy(m.v)]; });
      var line = P.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
      var L = plen(P).toFixed(1);
      var zeroY = dy(0).toFixed(1);
      /* ★ 有正负的填充收在零线上；零线画在填充之后，不然被盖掉。
         两头收在第一条、最后一条读数的横坐标上 —— 第一条不一定正好在窗口最左边，
         收到最左边会在前头多出一个斜角。 */
      var area = 'M' + line.split(' ').join(' L')
               + ' L' + P[P.length - 1][0].toFixed(1) + ',' + zeroY
               + ' L' + P[0][0].toFixed(1) + ',' + zeroY + ' Z';

      /* 睡着那一段铺一层底色 */
      var slp = '';
      if (SLEEPSPAN && SLEEPSPAN.a && SLEEPSPAN.b) {
        var a = Math.max(10, dx(SLEEPSPAN.a)), b = Math.min(339, dx(SLEEPSPAN.b));
        if (b > a) slp = '<rect class="slp" x="' + a.toFixed(1) + '" y="6" width="'
                       + (b - a).toFixed(1) + '" height="102" rx="3"/>';
      }

      /* 热区落到最近的一条带词的读数上 */
      var worded = [];
      MOOD.forEach(function (m, k) { if (m.labels && m.labels.length) worded.push(k); });
      var near = function (k) {
        if (!worded.length) return -1;
        return worded.reduce(function (a, b) { return Math.abs(b - k) < Math.abs(a - k) ? b : a; }, worded[0]);
      };
      var hits = MOOD.map(function (m, k) {
        var a = k === 0 ? 10 : (P[k - 1][0] + P[k][0]) / 2;
        var b = k === MOOD.length - 1 ? 339 : (P[k][0] + P[k + 1][0]) / 2;
        return '<rect class="hit" x="' + a.toFixed(1) + '" y="6" width="'
             + Math.max(8, b - a).toFixed(1) + '" height="102" data-mk="' + near(k) + '"/>';
      }).join('');

      /* 词表：每个词出现几次 */
      var cnt = {}, order = [];
      MOOD.forEach(function (m) {
        (m.labels || []).forEach(function (w) { if (!(w in cnt)) { cnt[w] = 0; order.push(w); } cnt[w]++; });
      });
      var matches = mTag ? MOOD.map(function (m, k) {
        return (m.labels || []).indexOf(mTag) >= 0 ? k : -1;
      }).filter(function (k) { return k >= 0; }) : [];

      /* 读数只有一个槽 —— 点点、点词，都换到这儿，屏幕上不另起气泡 */
      var hhmm = function (ts) {
        var d = new Date(ts);
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      };
      var head;
      if (mTag) {
        var av = matches.reduce(function (a, k) { return a + MOOD[k].v; }, 0) / (matches.length || 1);
        head = {eb: mTag + ' · ' + matches.length + ' 次', big: sign(av),
                sub: matches.slice(0, 8).map(function (k) { return hhmm(MOOD[k].ts); }).join('   '),
                col: 'var(--maple)'};
      } else {
        var k0 = mSel === null ? MOOD.length - 1 : mSel;
        var m0 = MOOD[k0];
        head = {eb: mSel === null ? '此刻' : hhmm(m0.ts), big: sign(m0.v),
                sub: hhmm(m0.ts) + ((m0.labels && m0.labels[0]) ? ' · ' + m0.labels.join('·') : ''),
                col: mSel === null ? 'var(--ink)' : 'var(--maple)'};
      }

      /* 不铺灰点：只画此刻那一个，和点中 / 选词命中的那些。
         滑动取值时点不该一路蹦 —— pop 只在点词、或第一次落点时给。 */
      var show = mTag ? matches : [mSel === null ? MOOD.length - 1 : mSel];
      var dots = '<g class="mdots">' + show.map(function (k, j) {
        return '<circle class="pt" cx="' + P[k][0].toFixed(1) + '" cy="' + P[k][1].toFixed(1)
             + '" r="3.5"' + (MOOD_POP ? ' style="animation:hl-pop .34s var(--spring-pop) both;'
             + 'animation-delay:' + (mTag ? stag(j) : '0ms') + '"' : '') + '/>';
      }).join('') + (mTag ? matches.map(function (k, j) {
        return '<circle class="halo" cx="' + P[k][0].toFixed(1) + '" cy="' + P[k][1].toFixed(1)
             + '" r="5" style="animation-delay:' + stag(j) + '"/>';
      }).join('') : '') + '</g>';

      /* 钟点标签六个。★ 两头靠边贴，不用 translateX(-50%) ——
         否则各有一半悬在容器外，把 scrollWidth 顶出几个 px，冒出一条横向滚动条 */
      var hours = '';
      for (var i = 0; i <= 5; i++) {
        var ts = new Date(t0.getTime() + span * i / 5);
        var pct = (10 + 329 * i / 5) / 345 * 100;
        var st = i === 0 ? 'left:0' : (i === 5 ? 'right:0' : 'left:' + pct.toFixed(2) + '%;transform:translateX(-50%)');
        hours += '<span style="' + st + '">' + String(ts.getHours()).padStart(2, '0') + ':00</span>';
      }

      return '<div class="hb tide hl-mood" data-grow>'
        + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">'
        +   '<div class="eyebrow">MOOD · 24 小时</div>'
        +   '<div style="font-size:11px;color:var(--hint)">' + MOOD.length + ' 条读数</div></div>'
        + '<div data-fx style="animation:hl-rise .26s var(--e-out) both;margin:2px 0 4px">'
        +   '<div class="eyebrow" style="margin-bottom:1px">' + esc(head.eb) + '</div>'
        +   '<div class="big" style="color:' + head.col + '">' + head.big + '</div>'
        +   '<div class="u">' + esc(head.sub) + '</div></div>'
        + '<svg viewBox="0 0 345 114" class="hl-moodsvg">'
        +   slp
        +   '<path class="ar" d="' + area + '" style="animation:hl-fade .5s var(--e-out) .34s both"/>'
        +   '<line class="zero" x1="10" y1="' + zeroY + '" x2="339" y2="' + zeroY + '"/>'
        +   '<polyline class="ln" points="' + line + '" stroke-dasharray="' + L + '" '
        +     'style="--len:' + L + ';animation:hl-draw .82s var(--e-out) both"/>'
        +   dots + hits
        + '</svg>'
        + '<div class="hours">' + hours + '</div>'
        + (order.length ? '<div class="tags">' + order.map(function (w) {
            return '<button type="button" data-mtag="' + esc(w) + '"' + (mTag === w ? ' class="on"' : '') + '>'
                 + esc(w) + '<i>' + cnt[w] + '</i></button>';
          }).join('') + '</div>' : '')
        + '</div>';
    }

    /* ── 最近几天那三条小线（步数 / 睡眠 / HRV）── */
    function miniLines(SER, axis) {
      var defs = [
        {k: 'steps',   n: '走了多少', u: '步',   d: 0},
        {k: 'sleep_h', n: '睡了多久', u: '小时', d: 1},
        {k: 'hrv_ms',  n: 'HRV',      u: 'ms',   d: 0}
      ].filter(function (m) { return (SER[m.k] || []).some(function (v) { return v != null; }); });
      if (!defs.length) return '';
      var rows = defs.map(function (m, mi) {
        var arr = SER[m.k], n = arr.length;
        var vals = arr.filter(function (v) { return v != null; });
        var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), sp = (hi - lo) || 1;
        /* ★ 每条按自己有数的那几天铺满整宽：三条各自缺的天数不一样，
           共用一个横坐标的话，某一条会「有一节很空」 */
        var got = [];
        arr.forEach(function (v, k) { if (v != null) got.push(k); });
        var gi = {}; got.forEach(function (k, i) { gi[k] = i; });
        var X = function (k) { return 10 + (gi[k] || 0) * (325 / Math.max(1, got.length - 1)); };
        /* ★ 留 4px 地板（36 而不是 40）：最低那一点要是正好压在底边，那一处的阴影就没了 */
        var Y = function (v) { return 36 - (v - lo) / sp * 28; };
        /* 缺的那天不打断线，跳过它 —— 「没数据」和「0」不是一回事 */
        var pts = [];
        arr.forEach(function (v, k) { if (v != null) pts.push([X(k), Y(v)]); });
        if (pts.length < 2) return '';
        var line = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
        var L = plen(pts).toFixed(1);
        var last = null; for (var k = n - 1; k >= 0; k--) { if (arr[k] != null) { last = arr[k]; break; } }
        var base = mi * 90;
        return '<div class="r" data-metric="' + m.k + '">'
          + '<div class="hd"><b>' + m.n + '</b><s>'
          +   (m.d ? last.toFixed(m.d) : Math.round(last).toLocaleString('en-US'))
          +   '<i>' + m.u + '</i></s></div>'
          + '<svg viewBox="0 0 345 44">'
          +   '<path class="ar" d="M' + line.split(' ').join(' L') + ' L' + pts[pts.length - 1][0].toFixed(1)
          +     ',40 L' + pts[0][0].toFixed(1) + ',40 Z" style="animation:hl-fade .5s var(--e-out) '
          +     (base + 420) + 'ms both"/>'
          +   '<polyline class="ln" points="' + line + '" stroke-dasharray="' + L + '" '
          +     'style="--len:' + L + ';animation:hl-draw .78s var(--e-out) ' + base + 'ms both"/>'
          +   '<circle class="tp" cx="' + pts[pts.length - 1][0].toFixed(1) + '" cy="'
          +     pts[pts.length - 1][1].toFixed(1) + '" r="2.8" style="animation:hl-pop .34s var(--spring-pop) '
          +     (base + 700) + 'ms both"/>'
          + '</svg></div>';
      }).join('');
      var span = axis.length ? (axis[0].slice(5) + ' — ' + axis[axis.length - 1].slice(5)) : '';
      return '<div class="hb" data-grow><div class="eyebrow" style="margin-bottom:14px">RECENT · '
        + axis.length + ' 天 <span style="letter-spacing:0;color:var(--hint)">' + esc(span) + '</span></div>'
        + '<div class="mini">' + rows + '</div></div>';
    }

    /* ── 睡眠：一天一根竖条，从躺下画到起床 ──
       折线只说得出睡了几个小时，说不出从几点到几点；几点睡比睡了多久更要紧。 */
    function bedChart(SER, axis) {
      var G = sleepGeo(SER.sleep_bed || [], SER.sleep_wake || [], axis.length);
      if (!G) return '';
      var H = 96, TOP = 6;
      var Y = function (x) { return TOP + (x - G.lo) / (G.hi - G.lo) * H; };
      var bw = 325 / axis.length;
      var bars = G.seg.map(function (sg, j) {
        var y0 = Y(sg.b), y1 = Y(sg.w);
        return '<rect class="slpbar' + (sg.k === axis.length - 1 ? ' today' : '') + '" x="'
             + (10 + sg.k * bw + bw * .2).toFixed(1) + '" y="' + y0.toFixed(1)
             + '" width="' + (bw * .6).toFixed(1) + '" height="' + Math.max(2, y1 - y0).toFixed(1)
             + '" rx="' + Math.min(3, bw * .3).toFixed(1) + '" style="animation-delay:' + stag(j)
             + '"><title>' + esc(axis[sg.k].slice(5)) + ' · ' + clk((SER.sleep_bed || [])[sg.k])
             + ' → ' + clk((SER.sleep_wake || [])[sg.k]) + '</title></rect>';
      }).join('');
      var gl = G.grid.map(function (g) {
        return '<line class="gl" x1="10" y1="' + Y(g.x).toFixed(1) + '" x2="335" y2="' + Y(g.x).toFixed(1) + '"/>'
             + '<text class="lbl" x="0" y="' + (Y(g.x) + 2.6).toFixed(1) + '">'
             + String(g.c).padStart(2, '0') + '</text>';
      }).join('');
      var lb = (SER.sleep_bed || [])[G.last.k], lw = (SER.sleep_wake || [])[G.last.k];
      return '<div class="hb beds" data-grow>'
        + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">'
        +   '<div class="eyebrow">SLEEP · 几点睡，几点醒</div>'
        +   '<div style="font-size:12.5px;font-weight:600">' + clk(lb) + ' → ' + clk(lw) + '</div></div>'
        + '<svg viewBox="0 0 345 ' + (H + TOP * 2) + '">' + gl
        +   '<line class="avg" x1="10" y1="' + Y(G.avgB).toFixed(1) + '" x2="335" y2="'
        +     Y(G.avgB).toFixed(1) + '"/>' + bars + '</svg></div>';
    }

    /* ── 周期 ──
       ★ 不预测某一天：很多人的周期本来就不是一个月一次。只说上次是哪天、走到第几天、以往间隔多少到多少。
       ★ 环画到「第几天 / 以往最长那次间隔」，用最长的当分母，环就不会绕过头。
       ★ 不给「正常 / 异常」的判断 —— 那是医生的话。 */
    function cycleCard(cy) {
      if (!cy || !cy.last_start) return '';
      var last = new Date(cy.last_start + 'T00:00:00');
      var dayIn = Math.round((new Date(new Date().toDateString()) - last) / 86400000) + 1;
      var gaps = cy.gaps || [];
      var lo = gaps.length ? Math.min.apply(null, gaps) : null;
      var hi = gaps.length ? Math.max.apply(null, gaps) : null;
      var avg = gaps.length ? Math.round(gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length) : null;

      var R = 18, CIRC = 2 * Math.PI * R;
      var frac = hi ? Math.min(1, dayIn / hi) : 0;
      var OFF = CIRC - CIRC * frac;

      var stats = [{k: '第几天', v: dayIn}];
      if (lo != null && hi != null) stats.push({k: '以往间隔', v: (lo === hi ? lo : lo + '–' + hi)});
      if (avg != null) stats.push({k: '平均', v: avg});

      var line;
      if (lo == null) line = '还只有这一次记录，攒够两次才说得出间隔。';
      else if (dayIn < lo) line = '离以往最短的那次间隔还有 ' + (lo - dayIn) + ' 天。';
      else if (dayIn <= hi) line = '已经进到以往的区间里了（' + lo + '–' + hi + ' 天），随时可能来。';
      else line = '比以往最长那次（' + hi + ' 天）还多了 ' + (dayIn - hi) + ' 天。';

      return '<div class="hb" data-grow>'
        + '<div class="cyc">'
        +   '<svg width="46" height="46" viewBox="0 0 46 46">'
        +     '<circle class="ring" cx="23" cy="23" r="' + R + '"/>'
        +     '<circle class="arc" cx="23" cy="23" r="' + R + '" transform="rotate(-90 23 23)" '
        +       'stroke-dasharray="' + CIRC.toFixed(1) + '" stroke-dashoffset="' + OFF.toFixed(1) + '" '
        +       'style="--circ:' + CIRC.toFixed(1) + ';--off:' + OFF.toFixed(1) + '"/></svg>'
        +   '<div style="min-width:0;flex:1">'
        +     '<div class="eyebrow">CYCLE</div>'
        +     '<div style="font-size:15px;font-weight:600;margin-top:2px">上次是 '
        +       esc(String(cy.last_start).slice(5)) + '，走到第 ' + dayIn + ' 天</div></div></div>'
        + '<p style="font-size:13.5px;line-height:1.65;margin:11px 0 0;text-wrap:pretty">' + line + '</p>'
        + '<div class="cstat">' + stats.map(function (s, i) {
            return '<div><s>' + s.k + '</s><b style="animation-delay:' + stag(i) + '">' + s.v + '</b></div>';
          }).join('') + '</div>'
        + '</div>';
    }

    /* ── 拉数据 → 画主页 ── */
    function render() {
      return Promise.all([ask(opts.series, 14, null), ask(opts.now, undefined, null)]).then(function (r) {
        var S = r[0] || {axis: [], series: {}, mood: [], cycles: null};
        var live = r[1] || {};
        var L = {steps: num(live.steps), sleep_h: num(live.sleep_h), resting_hr: num(live.resting_hr),
                 hrv_ms: num(live.hrv_ms), hr_now: num(live.hr_now), spo2: num(live.spo2),
                 resp_rate: num(live.resp_rate), weight_kg: num(live.weight_kg)};
        LIVE = L;
        var hasLive = Object.keys(L).some(function (k) { return L[k] != null; });

        MOOD = (S.mood || []).map(function (m) { return {ts: m.t, v: +m.v, labels: m.labels || []}; });
        var axis = S.axis || [], SER = S.series || {};
        /* 睡着那一段（给心情图铺底色）：拿最近一天的躺下 / 起床钟点还原成真实时刻 */
        SLEEPSPAN = null;
        var bd = SER.sleep_bed || [], wk = SER.sleep_wake || [];
        for (var k = axis.length - 1; k >= 0; k--) {
          if (bd[k] != null && wk[k] != null) {
            var a = new Date(axis[k] + 'T00:00:00'), b = new Date(axis[k] + 'T00:00:00');
            a.setHours(0, Math.round(bd[k] * 60)); b.setHours(0, Math.round(wk[k] * 60));
            if (a > b) a.setDate(a.getDate() - 1);      /* 跨夜：躺下是前一天 */
            SLEEPSPAN = {a: a.toISOString(), b: b.toISOString()};
            break;
          }
        }

        /* ── 今天四个大数（点哪个都进趋势页）── */
        var goal = {steps: +BIO.stepGoal || 4000, sleep: +BIO.sleepGoal || 8};
        var four = [
          {k: '步数', v: L.steps, u: '步', p: L.steps == null ? 0 : Math.min(1, L.steps / goal.steps), d: 0},
          {k: '睡眠', v: L.sleep_h, u: '小时', p: L.sleep_h == null ? 0 : Math.min(1, L.sleep_h / goal.sleep), d: 1},
          {k: '静息心率', v: L.resting_hr, u: '次/分', p: L.resting_hr == null ? 0 : Math.min(1, L.resting_hr / 100), d: 0},
          {k: 'HRV', v: L.hrv_ms, u: 'ms', p: L.hrv_ms == null ? 0 : Math.min(1, L.hrv_ms / 80), d: 0}
        ];
        var fourHTML = '<div class="h4" data-grow>' + four.map(function (f, i) {
          return '<div class="c" data-healthsub="' + f.k + '" role="button" tabindex="0"><div class="k">' + f.k + '</div>'
            + '<div class="n"><b style="animation:hl-rise .42s var(--e-out) both;animation-delay:' + stag(i) + '">'
            +   (f.v == null ? '—' : (f.d ? f.v.toFixed(f.d) : Math.round(f.v).toLocaleString('en-US')))
            + '</b><i>' + f.u + '</i></div>'
            + '<div class="t"><s style="--p:' + f.p.toFixed(3) + ';animation-delay:' + stag(i) + '"></s></div></div>';
        }).join('') + '</div>';

        /* ── 此刻那几行 ── */
        var nowRows = [
          {v: L.hr_now, u: '次/分', n: '心率', note: '刚才那一下测的'},
          {v: L.spo2, u: '%', n: '血氧', note: '95 以上算正常'},
          {v: L.resp_rate, u: '次/分', n: '呼吸', note: '睡着时 12–20 常见'}
        ].filter(function (x) { return x.v != null; });
        var nowHTML = nowRows.length ? '<div class="hb" data-grow>'
          + '<div class="eyebrow" style="margin-bottom:4px">RIGHT NOW</div>'
          + nowRows.map(function (x, i) {
              return '<div class="nowrow" style="animation-delay:' + stag(i) + '"><b>'
                   + Math.round(x.v) + '</b><span>' + x.n + ' <i style="font-style:normal;color:var(--hint)">'
                   + x.u + '</i></span><em>' + x.note + '</em></div>';
            }).join('')
          + '</div>' : '';

        if (!MOOD.length && !axis.length && !hasLive) {
          list.innerHTML = '<p class="dnone">还没有数据。</p>';
          return;
        }
        /* 基本信息不在这一页 —— 它折叠在趋势页最下面，不常驻 */
        list.innerHTML = fourHTML + moodCard() + miniLines(SER, axis) + bedChart(SER, axis)
                       + nowHTML + cycleCard(S.cycles);
        hGrow(list);
      });
    }

    /* ── 心情图：点 / 滑取值（只走 pointer 事件，理由见文件头）── */
    var MDOWN = false, MPREV = null, MMOVED = false, MX0 = 0, MY0 = 0, MGAVE = false;

    function moodSet(k) {
      if (k < 0 || k == null) return;
      if (mSel === k && !mTag) return;
      mSel = k; mTag = null;
      repaintMood(true);
    }

    function repaintMood(soft) {
      var card = list.querySelector('.hl-mood');
      if (!card) return;
      MOOD_POP = !soft;
      var tmp = document.createElement('div');
      tmp.innerHTML = moodCard();
      var fresh = tmp.firstElementChild;
      MOOD_POP = true;
      if (!fresh) return;
      if (soft) {
        /* 滑动取值：只换读数、点和词的选中态，折线和阴影一个字节都不碰 */
        var a = card.querySelector('[data-fx]'), b = fresh.querySelector('[data-fx]');
        if (a && b) a.innerHTML = b.innerHTML;
        var g1 = card.querySelector('.mdots'), g2 = fresh.querySelector('.mdots');
        if (g1 && g2) g1.replaceWith(g2);
        var t1 = card.querySelectorAll('[data-mtag]'), t2 = fresh.querySelectorAll('[data-mtag]');
        for (var i = 0; i < t1.length && i < t2.length; i++) t1[i].className = t2[i].className;
        return;
      }
      card.replaceWith(fresh);
      fresh.dataset.grown = '1';                     /* 已经在视野里，别再等观察者 */
      if (fresh.getAnimations) fresh.getAnimations({subtree: true}).forEach(function (x) {
        try { x.cancel(); x.play(); } catch (err) {}
      });
    }

    list.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      var svg = list.querySelector('.hl-moodsvg');
      if (!svg || !svg.contains(e.target)) return;
      MDOWN = true; MMOVED = false; MGAVE = false;
      MX0 = e.clientX; MY0 = e.clientY;
      MPREV = mTag ? null : mSel;
      var v = scrubAt(svg, e.clientX, 'data-mk');
      if (v != null) moodSet(+v);
    });
    list.addEventListener('pointermove', function (e) {
      if (!MDOWN || MGAVE) return;
      var dx = e.clientX - MX0, dy = e.clientY - MY0;
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        MGAVE = true;
        mSel = MPREV; mTag = null; repaintMood(true);   /* 变成滚页了，还原 */
        return;
      }
      var svg = list.querySelector('.hl-moodsvg');
      if (!svg) return;
      var v = scrubAt(svg, e.clientX, 'data-mk');
      if (v == null) return;
      if (mSel !== +v) MMOVED = true;
      moodSet(+v);
    });
    function mend() {
      if (!MDOWN) return;
      MDOWN = false;
      if (MGAVE) { MPREV = null; return; }
      if (!MMOVED && MPREV !== null && mSel === MPREV) { mSel = null; repaintMood(true); }
      MPREV = null;
    }
    list.addEventListener('pointerup', mend);
    list.addEventListener('pointercancel', mend);
    list.addEventListener('pointerleave', mend);

    /* 词那一行和进趋势页的门走 click（那几处是普通按钮，没有补发冲突） */
    list.addEventListener('click', function (e) {
      var tg = e.target.closest && e.target.closest('[data-mtag]');
      if (tg) {
        var w = tg.getAttribute('data-mtag');
        mTag = (mTag === w ? null : w); mSel = null;
        repaintMood();                       /* 点词要弹那一下，走完整重画 */
        return;
      }
      if (e.target.closest && e.target.closest('[data-healthsub], .mini .r')) openTrend();
    });
    list.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-healthsub]')) {
        e.preventDefault(); openTrend();
      }
    });

    /* ══════════ 趋势页 ══════════
       一个详情页，不是四个二级页 —— 四个大数点哪个都进这儿。 */
    var SUBDAYS = 14, SUBDATA = null, DSEL = null, SUBBUSY = false, DGEO = {}, INFOOPEN = false;
    var RG = [7, 14, 30, 90];
    /* 四张图：心情 / 步数 / HRV / 静息心率。睡眠不在这儿，并进下面那块节律 */
    var DMETRICS = [
      {id: 'mood',       n: '心情',     u: '',      dec: 2, signed: true},
      {id: 'steps',      n: '步数',     u: '步',    dec: 0, signed: false},
      {id: 'hrv_ms',     n: 'HRV',      u: 'ms',    dec: 1, signed: false},
      {id: 'resting_hr', n: '静息心率', u: '次/分', dec: 0, signed: false}
    ];

    function fmtV(v, dec, signed) {
      if (v == null) return '—';
      if (signed) return sign(v);
      return dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US');
    }

    function detailCard(m, mi) {
      var arr = (SUBDATA.series || {})[m.id] || [], axis = SUBDATA.axis || [];
      var have = [];
      arr.forEach(function (v, k) { if (v != null) have.push(k); });
      if (have.length < 2) return '';
      var vals = have.map(function (k) { return arr[k]; });
      var lo = m.signed ? -1 : Math.min.apply(null, vals);
      var hi = m.signed ?  1 : Math.max.apply(null, vals);
      var sp = (hi - lo) || 1;
      var VBW = 313, n = axis.length;
      var X = function (k) { return 4 + k * ((VBW - 8) / Math.max(1, n - 1)); };
      /* 非正负的那几张留 4px 地板，不然最低那天阴影塌成零；心情那张收在零线上 */
      var Y = m.signed ? function (v) { return 66 - (v - lo) / sp * 58; }
                       : function (v) { return 62 - (v - lo) / sp * 54; };
      var pts = have.map(function (k) { return [X(k), Y(arr[k])]; });
      var line = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
      var Ln = plen(pts).toFixed(1);
      var closeY = m.signed ? Y(0) : 66;
      var area = 'M' + line.split(' ').join(' L') + ' L' + pts[pts.length - 1][0].toFixed(1)
               + ',' + closeY.toFixed(1) + ' L' + pts[0][0].toFixed(1) + ',' + closeY.toFixed(1) + ' Z';

      var selK = (DSEL && DSEL.id === m.id) ? DSEL.k : null;
      var lastK = have[have.length - 1];
      var showK = selK != null ? selK : lastK;
      var base = mi * 90;

      /* 初次渲染只画「今天」那个静态点；选中的那个由 pickDay 就地建、就地平移 */
      var dots = '<circle class="pt todaypt" cx="' + X(lastK).toFixed(1) + '" cy="'
               + Y(arr[lastK]).toFixed(1) + '" r="3"/>';

      /* 热区铺满，点在没数据的那一段落到最近的有数据点，不留死区 */
      var near = function (k) {
        return have.reduce(function (a, b) { return Math.abs(b - k) < Math.abs(a - k) ? b : a; }, have[0]);
      };
      var hits = '';
      for (var k = 0; k < n; k++) {
        var a = k === 0 ? 0 : (X(k - 1) + X(k)) / 2, b = k === n - 1 ? VBW : (X(k) + X(k + 1)) / 2;
        hits += '<rect class="hit" x="' + a.toFixed(1) + '" y="0" width="'
              + Math.max(6, b - a).toFixed(1) + '" height="72" data-dsel="' + m.id + ':' + near(k) + '"/>';
      }

      /* 横轴只标六个；两头靠边贴。离末尾不足一个步长的中间标签不画，不然会跟最后一个叠在一起 */
      var step = Math.max(1, Math.round(n / 6)), xa = '';
      for (var k2 = 0; k2 < n; k2++) {
        if (k2 % step !== 0 && k2 !== n - 1) continue;
        if (k2 !== n - 1 && n - 1 - k2 < step) continue;
        var first = k2 === 0, lastLbl = k2 === n - 1;
        var st = first ? 'left:0' : (lastLbl ? 'right:0'
               : 'left:' + (X(k2) / VBW * 100).toFixed(2) + '%;transform:translateX(-50%)');
        xa += '<span style="' + st + '">' + esc(String(axis[k2]).slice(5)) + '</span>';
      }

      var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
      var av = vals.reduce(function (a2, b2) { return a2 + b2; }, 0) / vals.length;

      DGEO[m.id] = {X: X, Y: Y, lastK: lastK};     /* 就地更新那个小点要用 */
      return '<div class="dcard" data-grow data-mid="' + m.id + '">'
        + '<div class="hd"><b>' + m.n + '</b></div>'
        + '<div class="rd"><b style="color:' + (selK != null ? 'var(--maple)' : 'var(--ink)') + '">'
        +   fmtV(arr[showK], m.dec, m.signed) + '</b>'
        +   (m.u ? '<i>' + m.u + '</i>' : '')
        +   '<em>' + (selK != null ? esc(String(axis[selK]).slice(5)) : '今天') + '</em></div>'
        + '<svg viewBox="0 0 ' + VBW + ' 72" style="margin-top:8px">'
        +   '<line class="base" x1="4" y1="66" x2="' + (VBW - 4) + '" y2="66"/>'
        +   '<path class="ar" d="' + area + '" style="animation:hl-fade .3s var(--e-out) '
        +     (base + 420) + 'ms both"/>'
        +   (m.signed ? '<line class="zl" x1="4" y1="' + Y(0).toFixed(1) + '" x2="' + (VBW - 4)
        +     '" y2="' + Y(0).toFixed(1) + '"/>' : '')
        +   '<polyline class="ln" points="' + line + '" stroke-dasharray="' + Ln + '" '
        +     'style="--len:' + Ln + ';animation:hl-draw .82s var(--e-out) ' + base + 'ms both"/>'
        +   dots + hits
        + '</svg>'
        + '<div class="xax">' + xa + '</div>'
        + '<div class="st3">'
        +   '<div><s>最低</s><b>' + fmtV(mn, m.dec, m.signed) + '</b></div>'
        +   '<div><s>平均</s><b>' + fmtV(av, m.dec, m.signed) + '</b></div>'
        +   '<div><s>最高</s><b>' + fmtV(mx, m.dec, m.signed) + '</b></div>'
        + '</div></div>';
    }

    /* ── 睡眠节律：一天一根竖条，从躺下画到起床 ── */
    function rhythmCard() {
      var S = SUBDATA.series || {}, axis = SUBDATA.axis || [];
      var bed = S.sleep_bed || [], wake = S.sleep_wake || [];
      var G = sleepGeo(bed, wake, axis.length);
      if (!G) return '';
      var ry = function (x) { return 10 + (x - G.lo) / (G.hi - G.lo) * 66; };
      var bwd = Math.max(2.4, Math.min(11, 250 / axis.length));
      var lastK = G.last.k;
      var diffMin = Math.round((G.avgB - G.last.b) * 60);

      var gl = '', gt = '';
      G.grid.forEach(function (g) {
        gl += '<line class="gl" x1="34" y1="' + ry(g.x).toFixed(1) + '" x2="309" y2="' + ry(g.x).toFixed(1) + '"/>';
        gt += '<span class="gt" style="top:' + (ry(g.x) / 96 * 100).toFixed(2) + '%">'
            + String(g.c).padStart(2, '0') + ':00</span>';
      });
      var bars = G.seg.map(function (sg, j) {
        var x = 40 + sg.k * (265 / Math.max(1, axis.length - 1));
        var y1 = ry(sg.b), y2 = ry(sg.w);
        return '<rect class="slpbar" x="' + (x - bwd / 2).toFixed(1) + '" y="' + y1.toFixed(1)
             + '" width="' + bwd.toFixed(1) + '" height="' + Math.max(2, y2 - y1).toFixed(1)
             + '" rx="' + Math.min(bwd / 2, 3).toFixed(1) + '" fill="'
             + (sg.k === lastK ? 'var(--maple)' : 'var(--thread,#ddd2c6)') + '" style="animation-delay:'
             + stag(j) + '"><title>' + esc(String(axis[sg.k]).slice(5)) + ' · ' + clk(bed[sg.k]) + ' → '
             + clk(wake[sg.k]) + '</title></rect>';
      }).join('');

      var slept = G.last.w - G.last.b;
      return '<div class="dcard" data-grow>'
        + '<div class="hd"><b>睡眠</b></div>'
        + '<p class="insight">'
        +   (diffMin >= 0 ? '最近一觉比平均早睡 ' + diffMin + ' 分钟。'
                          : '最近一觉比平均晚睡 ' + (-diffMin) + ' 分钟。')
        +   '这 ' + axis.length + ' 天里有 ' + G.lateN + ' 天两点以后才睡。</p>'
        + '<div class="st3">'
        +   '<div class="wide"><s>最近一觉</s><b class="big wide" style="color:var(--maple)">'
        +     clk(bed[lastK]) + '→' + clk(wake[lastK]) + '</b></div>'
        +   '<div><s>睡了</s><b class="big" style="animation-delay:70ms">' + slept.toFixed(1) + ' 时</b></div>'
        +   '<div><s>平均就寝</s><b class="big" style="animation-delay:140ms">' + clk(G.avgClock) + '</b></div>'
        + '</div>'
        + '<div class="rh">' + gt
        +   '<span class="from">' + axis.length + ' 天前</span>'
        +   '<svg viewBox="0 0 313 96">' + gl + bars
        +     '<line class="avg" x1="34" y1="' + ry(G.avgB).toFixed(1) + '" x2="309" y2="'
        +       ry(G.avgB).toFixed(1) + '"/>'
        +     '<text x="309" y="94" font-size="9" letter-spacing="1" fill="var(--hint)" '
        +       'text-anchor="end">最近</text>'
        +   '</svg></div></div>';
    }

    /* ── 这一刻 ── */
    function spotCard(L) {
      var R = [
        {k: '心跳', v: L.hr_now,    u: '次/分'},
        {k: '血氧', v: L.spo2,      u: '%'},
        {k: '呼吸', v: L.resp_rate, u: '次/分'}
      ].filter(function (x) { return x.v != null; });
      if (!R.length) return '';
      return '<div class="dcard" data-grow>'
        + '<div class="hd" style="margin-bottom:11px"><b>这一刻</b></div>'
        + '<div class="spot">' + R.map(function (x, i) {
            return '<div><s>' + x.k + '</s><b style="animation-delay:' + stag(i) + '">'
                 + Math.round(x.v) + '</b><i>' + x.u + '</i></div>';
          }).join('')
        + '</div></div>';
    }

    /* ── 基本信息：折叠在这一页最下面，不常驻 ── */
    function infoCard(L) {
      var F = [
        {k: 'height',    n: '身高',     u: 'cm'},
        {k: 'weight',    n: '体重',     u: 'kg'},
        {k: 'born',      n: '出生年',   u: ''},
        {k: 'sleepGoal', n: '想睡够',   u: '小时'},
        {k: 'stepGoal',  n: '每天想走', u: '步'}
      ];
      var h = +BIO.height / 100, w = +BIO.weight, born = +BIO.born;
      var nowD = new Date(), age = 0;
      if (born > 1900) {
        age = nowD.getFullYear() - born;
        /* 只收出生年的话，生日前会多算一岁 —— 给了 opts.birthday（'MM-DD'）就扣准 */
        var bd = /^(\d{1,2})-(\d{1,2})$/.exec(String(opts.birthday || ''));
        if (bd && (nowD.getMonth() + 1) * 100 + nowD.getDate() < (+bd[1]) * 100 + (+bd[2])) age -= 1;
      }
      var D = [];
      if (h > 0 && w > 0) {
        D.push({k: 'BMI', v: (w / (h * h)).toFixed(1), note: '体重 ÷ 身高²'});
        D.push({k: '步幅', v: Math.round(h * 100 * 0.415) + ' cm', note: '身高 × 0.415'});
        if (L.steps != null)
          D.push({k: '今天走了', v: (L.steps * h * 0.415 / 1000).toFixed(2) + ' km', note: '按你的步幅'});
      }
      if (age > 0) {
        D.push({k: '年龄', v: age + ' 岁', note: ''});
        /* Tanaka：208 − 0.7×年龄，比老的 220−年龄 准 */
        var hrMax = Math.round(208 - 0.7 * age);
        D.push({k: '最大心率', v: hrMax + ' 次/分', note: '208 − 0.7×年龄'});
        if (L.resting_hr != null)
          D.push({k: '心率储备', v: (hrMax - Math.round(L.resting_hr)) + ' 次/分', note: '减你的静息'});
      }
      if (+BIO.sleepGoal > 0 && L.sleep_h != null) {
        var gap = L.sleep_h - (+BIO.sleepGoal);
        D.push({k: '离你想睡的', v: (gap >= 0 ? '多 ' : '少 ') + Math.abs(gap).toFixed(1) + ' 时',
                note: '你自己定的 ' + BIO.sleepGoal + ' 时'});
      }
      if (+BIO.stepGoal > 0 && L.steps != null)
        D.push({k: '离你想走的', v: Math.round(L.steps / (+BIO.stepGoal) * 100) + '%',
                note: '你自己定的 ' + (+BIO.stepGoal).toLocaleString('en-US')});

      return '<div class="infobox">'
        + '<button type="button" data-infotoggle><span>基本信息</span>'
        +   '<svg viewBox="0 0 24 24"><path d="M9 6l6 6l-6 6"/></svg></button>'
        + '<div class="infowrap"><div>'
        +   '<div class="bio">' + F.map(function (f) {
              return '<label><s>' + f.n + '</s><span class="fld">'
                   + '<input type="text" inputmode="decimal" data-bio="' + f.k + '" value="'
                   + esc(String(BIO[f.k] || '')) + '" aria-label="' + f.n + '">'
                   + (f.u ? '<i>' + f.u + '</i>' : '') + '</span></label>';
            }).join('') + '</div>'
        +   (D.length ? '<div class="derived"><s>算出来的</s>' + D.map(function (d) {
              return '<p><span>' + d.k + '</span><b>' + d.v + '</b><em>' + d.note + '</em></p>';
            }).join('') + '</div>' : '')
        +   '<button type="button" class="biosave" data-biosave>保存</button>'
        + '</div></div></div>';
    }

    function toggleInfo() {
      var box = sublist.querySelector('.infobox'); if (!box) return;
      INFOOPEN = !INFOOPEN;
      box.classList.toggle('open', INFOOPEN);
      var w = box.querySelector('.infowrap'), inner = w && w.firstElementChild;
      if (w && inner) w.style.maxHeight = INFOOPEN ? (inner.scrollHeight + 'px') : '0px';
    }

    /* 先说存好了，存不上再改回去。存成功后「算出来的」那几行跟着重算。 */
    function saveBio() {
      var btn = sublist.querySelector('[data-biosave]');
      if (btn) { btn.textContent = '存好了'; btn.classList.add('saved'); }
      var p;
      try { p = Promise.resolve(opts.onSaveBio ? opts.onSaveBio(Object.assign({}, BIO)) : true); }
      catch (e) { p = Promise.resolve(false); }
      p.then(function (ok) { return ok !== false; }, function () { return false; }).then(function (ok) {
        if (!ok) {
          var b0 = sublist.querySelector('[data-biosave]');
          if (b0) { b0.textContent = '没存上，再点一下'; b0.classList.remove('saved'); }
          return;
        }
        if (SUBDATA) paintSub();
        var b1 = sublist.querySelector('[data-biosave]');
        if (b1) { b1.textContent = '存好了'; b1.classList.add('saved'); }
        setTimeout(function () {
          var b2 = sublist.querySelector('[data-biosave]');
          if (b2) { b2.textContent = '保存'; b2.classList.remove('saved'); }
        }, 1800);
      });
    }

    /* 点某一天不重画整块：只换读数、挪小点、挪虚线，折线和阴影一个字节都不碰。
       toggle=true 是点击（再点一次取消）；滑过来的传 false（一路滑不该来回闪）。 */
    function pickDay(id, k, toggle) {
      var same = DSEL && DSEL.id === id && DSEL.k === k;
      if (same && !toggle) return;
      DSEL = (same && toggle) ? null : {id: id, k: k};
      var m = null;
      for (var i = 0; i < DMETRICS.length; i++) if (DMETRICS[i].id === id) m = DMETRICS[i];
      var card = sublist.querySelector('[data-mid="' + id + '"]');
      var G = DGEO[id];
      if (!m || !card || !G) return;
      var arr = (SUBDATA.series || {})[id] || [], axis = SUBDATA.axis || [];
      var showK = DSEL ? DSEL.k : G.lastK;

      var rd = card.querySelector('.rd');
      if (rd) {
        var bb = rd.querySelector('b'), em = rd.querySelector('em');
        if (bb) { bb.textContent = fmtV(arr[showK], m.dec, m.signed);
                  bb.style.color = DSEL ? 'var(--maple)' : 'var(--ink)'; }
        if (em) em.textContent = DSEL ? String(axis[DSEL.k]).slice(5) : '今天';
      }
      var svg = card.querySelector('svg'); if (!svg) return;
      var NS = 'http://www.w3.org/2000/svg';

      /* 同一个节点一直留着，靠 transform 平移（CSS 过渡）；只有第一次出现时弹那一下 */
      var sel = svg.querySelector('.selwrap'), gd = svg.querySelector('.gdwrap');
      if (!DSEL) {
        if (sel) sel.remove();
        if (gd) gd.remove();
      } else {
        var x = G.X(DSEL.k), y = G.Y(arr[DSEL.k]);
        if (!gd) {
          gd = document.createElementNS(NS, 'g');
          gd.setAttribute('class', 'gdwrap');
          var ln = document.createElementNS(NS, 'line');
          ln.setAttribute('class', 'gd');
          ln.setAttribute('x1', 0); ln.setAttribute('y1', 0);
          ln.setAttribute('x2', 0); ln.setAttribute('y2', y.toFixed(1));
          gd.appendChild(ln);
          svg.appendChild(gd);
        } else {
          gd.firstChild.setAttribute('y2', y.toFixed(1));
        }
        gd.setAttribute('transform', 'translate(' + x.toFixed(1) + ',0)');
        if (!sel) {
          sel = document.createElementNS(NS, 'g');
          sel.setAttribute('class', 'selwrap');
          var c = document.createElementNS(NS, 'circle');
          c.setAttribute('class', 'pt'); c.setAttribute('r', 3.5);
          c.setAttribute('cx', 0); c.setAttribute('cy', 0);
          c.style.animation = 'hl-pop .34s var(--spring-pop) both';
          sel.appendChild(c);
          svg.appendChild(sel);
        }
        sel.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
      }

      /* 「今天」那个点是静态的：没选中、或选的不是今天时才画 */
      var tp = svg.querySelector('.todaypt');
      var showToday = !DSEL || DSEL.k !== G.lastK;
      if (showToday && !tp) {
        tp = document.createElementNS(NS, 'circle');
        tp.setAttribute('class', 'pt todaypt'); tp.setAttribute('r', 3);
        tp.setAttribute('cx', G.X(G.lastK).toFixed(1));
        tp.setAttribute('cy', G.Y(arr[G.lastK]).toFixed(1));
        svg.appendChild(tp);
      } else if (!showToday && tp) { tp.remove(); }
    }

    /* 滑动选点：不存几何、不算坐标，直接问热区自己 ——
       手指的横坐标换算成 viewBox 单位，谁的 x 区间罩住它就是谁；没罩住就取最近的一个。 */
    function scrubAt(svg, clientX, attr) {
      var r = svg.getBoundingClientRect(); if (!r.width) return null;
      var vb = (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) || r.width;
      var x = (clientX - r.left) / r.width * vb;
      var hits = svg.querySelectorAll('[' + attr + ']'), best = null, bd = Infinity;
      for (var i = 0; i < hits.length; i++) {
        var a = +hits[i].getAttribute('x'), w = +hits[i].getAttribute('width');
        if (x >= a && x <= a + w) return hits[i].getAttribute(attr);
        var d = x < a ? a - x : x - (a + w);
        if (d < bd) { bd = d; best = hits[i].getAttribute(attr); }
      }
      return best;
    }

    function paintSub() {
      if (!SUBDATA) return;
      var L = SUBDATA._live || {};
      var html = DMETRICS.map(detailCard).join('') + rhythmCard() + spotCard(L) + infoCard(L);
      sublist.innerHTML = html || '<p class="dnone">这个区间还没有数据。</p>';
      /* 重画会丢掉展开状态，所以记在 INFOOPEN 里，重画后还原 */
      if (INFOOPEN) {
        var box = sublist.querySelector('.infobox');
        if (box) {
          box.classList.add('open');
          var w = box.querySelector('.infowrap'), inner = w && w.firstElementChild;
          if (w && inner) w.style.maxHeight = inner.scrollHeight + 'px';
        }
      }
      hGrow(sublist);
    }

    function loadSub(days) {
      if (SUBBUSY) return Promise.resolve();
      SUBBUSY = true;
      return ask(opts.series, days, null).then(function (S) {
        S = S || {};
        SUBDATA = {axis: S.axis || [], series: S.series || {}, _live: LIVE};   /* 「这一刻」用主页那份 */
        DSEL = null;
        paintSub();
      }).then(function () { SUBBUSY = false; }, function () { SUBBUSY = false; });
    }

    /* 区间条：切区间＝换一批内容，所以整块重新长 */
    rangebox.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-days]');
      if (!b) return;
      var d = +b.getAttribute('data-days');
      if (d === SUBDAYS) return;
      SUBDAYS = d;
      rangebox.querySelectorAll('[data-days]').forEach(function (x) {
        x.classList.toggle('on', +x.getAttribute('data-days') === d);
      });
      if (rangepill) rangepill.style.transform = 'translateX(' + (RG.indexOf(d) * 100) + '%)';
      loadSub(d);
    });

    /* 点 / 滑取值：pointerdown 立刻选中；一路拖，点跟着走；松手保留落点；
       中途变成纵向滚页（|dy|>12 且比 dx 大）就放弃这次手势，还原成按下前的样子。 */
    var PDOWN = false, PPREV = null, PMOVED = false, PX0 = 0, PY0 = 0, PGAVE = false;
    function pickAt(svg, clientX) {
      var v = scrubAt(svg, clientX, 'data-dsel');
      if (!v) return null;
      var parts = v.split(':');
      return {id: parts[0], k: +parts[1]};
    }
    sublist.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      var svg = e.target.closest && e.target.closest('svg');
      if (!svg || !svg.querySelector('[data-dsel]')) return;
      PDOWN = true; PMOVED = false; PGAVE = false;
      PX0 = e.clientX; PY0 = e.clientY;
      PPREV = DSEL ? {id: DSEL.id, k: DSEL.k} : null;
      var p = pickAt(svg, e.clientX);
      if (p) pickDay(p.id, p.k, false);
    });
    sublist.addEventListener('pointermove', function (e) {
      if (!PDOWN || PGAVE) return;
      var dx = e.clientX - PX0, dy = e.clientY - PY0;
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        PGAVE = true;
        if (!PPREV && DSEL) pickDay(DSEL.id, DSEL.k, true);
        else if (PPREV) pickDay(PPREV.id, PPREV.k, false);
        return;
      }
      var svg = e.target.closest && e.target.closest('svg');
      if (!svg) return;
      var p = pickAt(svg, e.clientX);
      if (!p) return;
      if (!DSEL || DSEL.id !== p.id || DSEL.k !== p.k) PMOVED = true;
      pickDay(p.id, p.k, false);
    });
    function pend() {
      if (!PDOWN) return;
      PDOWN = false;
      if (PGAVE) { PPREV = null; return; }
      if (!PMOVED && PPREV && DSEL && PPREV.id === DSEL.id && PPREV.k === DSEL.k)
        pickDay(DSEL.id, DSEL.k, true);
      PPREV = null;
    }
    sublist.addEventListener('pointerup', pend);
    sublist.addEventListener('pointercancel', pend);
    sublist.addEventListener('pointerleave', pend);

    /* 折线以外的点击（展开基本信息、保存）走 click —— 那两处没有补发冲突 */
    sublist.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('[data-infotoggle]')) { toggleInfo(); return; }
      if (e.target.closest && e.target.closest('[data-biosave]')) saveBio();
    });
    sublist.addEventListener('input', function (e) {
      var f = e.target.closest && e.target.closest('[data-bio]');
      if (f) BIO[f.getAttribute('data-bio')] = f.value.replace(/[^\d.]/g, '');
    });

    /* ── 两层之间来回 ── */
    function openTrend() {
      page.classList.add('hl-off'); trend.hidden = false;   /* 主页原地藏着，回来时动画不重播（见 css） */
      INFOOPEN = false;               /* 每次进来基本信息都收着 */
      var r = host.getBoundingClientRect();
      if (r.top < 0 && host.scrollIntoView) host.scrollIntoView({block: 'start'});
      return loadSub(SUBDAYS);
    }
    function closeTrend() { trend.hidden = true; page.classList.remove('hl-off'); }
    trend.querySelector('[data-hl-back]').addEventListener('click', closeTrend);

    render();
    return {refresh: render, openTrend: openTrend, closeTrend: closeTrend};
  }

  return HealthPage;
});
