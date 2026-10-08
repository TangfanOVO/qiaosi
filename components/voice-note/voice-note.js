/* ══ 语音条（voice-note.js）══
   跟 voice-note.css 一对。聊天列表里放一个占位
     <div class="vn" data-vn='{"id":…,"en":…,"zh":…,"audio_url":…}'></div>
   扫到就就地长成语音条（MutationObserver），列表重建了也会重新长回来，播放状态按 id 续上。

   三块：
   ① 气泡 —— 珠子＋波形胶囊；点＝播放/暂停；按住波形 0.6 秒＝浮起来，上面「原文 / 中文 | 演示」，下面长按菜单
   ② 演示 —— 全屏，一个点和线连成的图形跟着声音流（星星 / 小花 / 四叶草 / 嫩芽，也可以自己给一条 SVG 路径）；
             逐字渐显的细体字幕；控件两三秒后自己退下去（给录屏）
   ③ 声音 —— 整页共用一个 <audio>（新的一响就掐掉旧的）；
             有音频就解一次码：静止波形和图形的起伏都用真的响度，没解出来之前用文字估的模型

   「」和 [ ] 里是写给语音模型的神态（比如 ElevenLabs v3 的 [whispers]），前端一律不显示。 */
(function () {
  'use strict';
  if (window.VoiceNote) return;

  var root = document.documentElement;
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  /* 最近一次是按键盘还是手指 / 鼠标 */
  var KEYNAV = false;
  document.addEventListener('keydown', function () { KEYNAV = true; }, true);
  ['pointerdown', 'touchstart'].forEach(function (t) { document.addEventListener(t, function () { KEYNAV = false; }, { capture: true, passive: true }); });

  /* ── 接口：接手的人只需要改这一张表（VoiceNote.config({...})）── */
  var CFG = {
    /* 这条语音的音频从哪来。返回 url，或者一个给 url 的 Promise；返回 null 就没有声音、按估的时长走（预览用）。
       比如：d => d.audio_url || myTTS(d.en)   ← myTTS 是你自己的合成接口，回一个 blob URL */
    audio: function (d) { return d.audio || d.audio_url || null; },
    /* 浮起来时「别的东西」是谁：默认是最近的 [data-vn-scope]，没有就找最近的滚动容器 */
    scope: null,
    /* 浮起来时还要一起糊的（顶栏、打字框）——选择器 */
    blurToo: '',
    /* 玻璃皮那块整页的画布（liquid-core.js 的 <liquid-stage>） */
    stage: function () { return document.getElementById('liqstage') || document.querySelector('liquid-stage:not(.vn-dm-stage)'); },
    /* 演示页玻璃皮的底图：默认跟整页那块画布用同一张，再在这边压暗 / 洗淡一档 */
    wallpaper: null,
    /* 菜单里点了什么：(key, data, note) —— 收藏 / 引用 / 多选 / 重说 / 只藏不删 接到你应用里现成的那几个动作上 */
    onAction: null,
    menu: null,
    title: '语音',
    /* 演示页里那个点线图形：'star' 星星 / 'flower' 小花 / 'clover' 四叶草 / 'sprout' 嫩芽；
       也可以自己给：{ d: 'SVG 路径（画在 512×512 里）', cx: 256, cy: 256 }，cx / cy 是波往外漂的起点，不给就用重心 */
    shape: 'star',
    /* 演示页挂在哪（默认 body；预览里挂进那个假手机） */
    container: null,
    sub: function (d) { return '语音' + (d.time ? ' · ' + d.time : ''); },
    zIndex: 9000
  };

  /* ═══════════ 小工具 ═══════════ */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function chars(s) { return Array.from ? Array.from(String(s)) : String(s).split(''); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sstep(a, b, v) { v = (v - a) / (b - a); v = v < 0 ? 0 : v > 1 ? 1 : v; return v * v * (3 - 2 * v); }
  function mix3(a, b, f) { return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f)]; }
  function now() { return performance.now(); }
  function noop() {}
  function isGlass() { return root.getAttribute('data-skin') === 'liquid'; }
  function isDark() {
    if (isGlass()) return root.getAttribute('data-glasstone') !== 'light';
    var th = root.getAttribute('data-theme');
    if (th === 'dark') return true;
    if (th === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function fmt(x) { x = Math.max(0, Math.floor(x)); return Math.floor(x / 60) + ':' + (x % 60 < 10 ? '0' : '') + (x % 60); }

  var ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l10.5 -6.5z"></path></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h3v13h-3z"></path><path d="M14 5.5h3v13h-3z"></path></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5l10 -10"></path></svg>',
    orig: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 15.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0"></path><path d="M3 19v-10.5a3.5 3.5 0 0 1 7 0v10.5"></path><path d="M3 13h7"></path><path d="M21 12v7"></path></svg>',
    zh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h7"></path><path d="M9 3v2c0 4.418 -2.239 8 -5 8"></path><path d="M5 9c0 2.144 2.952 3.908 6.7 4"></path><path d="M12 20l4 -9l4 9"></path><path d="M19.1 18h-6.2"></path></svg>',
    demo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z"></path></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6l6 -6"></path></svg>'
  };
  /* 长按菜单：跟聊天里文字泡那张一个口径（Tabler Icons，MIT） */
  var MENU = [
    { key: 'star',  label: '收藏这句', icon: '<path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"></path>' },
    { key: 'copy',  label: '复制这段', icon: '<path d="M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666"></path><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path>' },
    { key: 'quote', label: '引用它说话', icon: '<path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5"></path><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5"></path>' },
    { key: 'multi', label: '多选几条', icon: '<path d="M9 11l3 3l8 -8"></path><path d="M20 12v6a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h9"></path>' },
    { key: 'redo',  label: '让我重说', icon: '<path d="M4 9a8 8 0 0 1 13 -3l3 3"></path><path d="M20 4v5h-5"></path>' },
    { key: 'hide',  label: '只藏不删', icon: '<path d="M10.585 10.587a2 2 0 0 0 2.829 2.828"></path><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87"></path><path d="M3 3l18 18"></path>' }
  ];

  /* ═══════════ ① 字：拆句、拆神态、对中文 ═══════════
     「soft, warm」Hey. 「small laugh」You pressed it. …   ← 神态不显示，只用来估这一段说得多轻多重
     中文按句号对到英文的句子上；句数对不上时按长度比例分。 */
  var TAG_RE = /「([^」]*)」|\[([^\]\n]{1,48})\]/g;
  var CJK = /[㐀-鿿豈-﫿]/;
  function sentences(s, zh) {
    var re = zh ? /[^。！？!?…\n]+(?:[。！？!?…]+[”’」』）)"']*|$)/g : /[^.!?…\n]+(?:[.!?…]+["'”’)]*|$)/g;
    return (String(s || '').match(re) || []).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  }
  function tagInfo(t) {
    var s = t.toLowerCase();
    if (/laugh|chuckl|giggl|笑/.test(s)) return { laugh: true };
    if (/pause|beat|silence|停|顿/.test(s)) return { pause: true };
    if (/sigh|叹/.test(s)) return { sigh: true };
    if (/whisper|quiet|hush|softly|murmur|低声|耳语|小声|悄/.test(s)) return { mood: 0.42 };
    if (/excit|happy|bright|loud|shout|开心|兴奋|大声/.test(s)) return { mood: 1 };
    if (/sad|tired|low|难过|累|委屈/.test(s)) return { mood: 0.6 };
    if (/tender|soft|warm|gentle|close|温柔|轻|软/.test(s)) return { mood: 0.75 };
    return {};
  }
  function parse(en, zh) {
    en = String(en || '');
    var segs = [], m, last = 0;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(en))) {
      if (m.index > last) segs.push({ t: en.slice(last, m.index) });
      segs.push({ d: (m[1] != null ? m[1] : m[2] || '').trim() });
      last = TAG_RE.lastIndex;
    }
    if (last < en.length) segs.push({ t: en.slice(last) });
    var plain = segs.map(function (g) { return g.t || ''; }).join(' ');
    /* 只有中文、没给英文：那就是中文嗓子念的，原文本身就是中文 */
    var han = (plain.match(/[㐀-鿿]/g) || []).length, lat = (plain.match(/[A-Za-z]/g) || []).length;
    var zhOnly = han > lat;
    var items = [];
    segs.forEach(function (g) {
      if (g.d != null) { if (g.d) items.push({ kind: 'd', text: g.d, info: tagInfo(g.d) }); return; }
      sentences(g.t, zhOnly).forEach(function (s) { items.push({ kind: 't', text: s, zh: '' }); });
    });
    var ts = items.filter(function (x) { return x.kind === 't'; });
    if (!zhOnly) align(ts, sentences(String(zh || '').replace(TAG_RE, ''), true));
    return { items: items, zhOnly: zhOnly };
  }
  function align(ts, zs) {
    if (!ts.length || !zs.length) return;
    if (ts.length === zs.length) { ts.forEach(function (t, i) { t.zh = zs[i]; }); return; }
    var TT = 0, ZT = 0, cum = [], c = 0, zc = 0;
    ts.forEach(function (t) { TT += t.text.length; });
    zs.forEach(function (z) { ZT += z.length; });
    ts.forEach(function (t) { c += t.text.length; cum.push(c / TT); });
    zs.forEach(function (z) {
      var mid = (zc + z.length / 2) / ZT, k = 0; zc += z.length;
      while (k < cum.length - 1 && mid > cum[k]) k++;
      ts[k].zh += z;
    });
  }
  function sylCount(w) {
    var s = w.toLowerCase().replace(/[^a-z]/g, ''), m = s.match(/[aeiouy]+/g), n = m ? m.length : 1;
    if (n > 1 && /[^aeiouy]e$/.test(s)) n--;
    return Math.max(1, n);
  }
  function zhTokens(s) {          /* 一个字一个音节；标点挂在前一个字上 */
    var out = [];
    chars(s).forEach(function (ch) {
      if (CJK.test(ch) || /[A-Za-z0-9]/.test(ch) || !out.length) out.push(ch);
      else out[out.length - 1] += ch;
    });
    return out;
  }

  /* ═══════════ ② 时间线：没有真音频时，按字估一份「什么时候说哪个字、多响」 ═══════════
     有音频以后整条按真时长等比缩放；响度换成解码出来的真包络。 */
  function timeline(P) {
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var syl = [], t0 = 0.15, mood = 0.8;
    P.items.forEach(function (it) {
      if (it.kind === 'd') {
        var f = it.info; if (f.mood) mood = f.mood;
        it.a = t0;
        if (f.laugh) { t0 += 0.08; for (var j = 0; j < 3; j++) { syl.push({ a: t0, d: 0.1, p: 0.46 + 0.14 * rnd() }); t0 += 0.17; } t0 += 0.24; }
        if (f.sigh) { syl.push({ a: t0, d: 0.5, p: 0.26 }); t0 += 0.72; }
        if (f.pause) t0 += 1.2;
        it.b = t0; return;
      }
      var ws = P.zhOnly ? zhTokens(it.text) : it.text.split(' ').filter(Boolean);
      it.text = P.zhOnly ? ws.join('') : ws.join(' ');
      it.a = t0; it.words = [];
      ws.forEach(function (w, wi) {
        var n = P.zhOnly ? (CJK.test(w) ? 1 : 0) : sylCount(w);
        var wd = { t: w, a: t0 }; it.words.push(wd);
        for (var q = 0; q < n; q++) {
          var d = P.zhOnly ? 0.17 + 0.06 * rnd() : 0.13 + 0.1 * rnd();
          var p = mood * (0.42 + 0.58 * rnd()) * (q === 0 ? 1.1 : 0.9);
          if (wi === ws.length - 1 && q === n - 1) p *= 0.72;
          syl.push({ a: t0, d: d, p: Math.min(1, p) });
          t0 += d + 0.02;
        }
        wd.e = t0;                                     /* 这个词念完的时刻（停顿不算） */
        t0 += /[,，、;；:：]$/.test(w) ? 0.22 : (/[.?!。！？…]["'”’」』）)]*$/.test(w) ? 0.42 : (P.zhOnly ? 0 : 0.06));
      });
      it.b = t0;
    });
    var pmax = 0; syl.forEach(function (s) { pmax = Math.max(pmax, s.p); });
    return { syl: syl, end: t0 + 0.1, pmax: pmax || 1 };
  }
  function scaleTimeline(note, D) {
    var k = D / note.D; if (!isFinite(k) || k <= 0 || Math.abs(k - 1) < 1e-4) return;
    note.tl.syl.forEach(function (s) { s.a *= k; s.d *= k; });
    note.items.forEach(function (x) {
      x.a *= k; x.b *= k;
      if (x.words) x.words.forEach(function (w) { w.a *= k; w.e *= k; });
    });
    note.D = D;
    note.retimed = true;                             /* 字幕的逐字时刻要重算 */
  }
  function modelAmp(tl, x) {
    var v = 0, S = tl.syl;
    for (var i = 0; i < S.length; i++) {
      var s = S[i]; if (x < s.a) break;
      if (x < s.a + s.d) v = Math.max(v, s.p * Math.pow(Math.sin(Math.PI * (x - s.a) / s.d), 0.7));
    }
    return v / tl.pmax;
  }

  /* ═══════════ ③ 声音 ═══════════ */
  var AU = null, ACX = null;
  var SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  function au() {
    if (AU) return AU;
    AU = new Audio(); AU.preload = 'auto'; AU.setAttribute('playsinline', '');
    AU.addEventListener('ended', function () { if (PL.owner && !PL.sim) PL.finish(); });
    AU.addEventListener('loadedmetadata', function () {
      var o = PL.owner; if (!o || PL.sim || !isFinite(AU.duration) || AU.duration <= 0) return;
      if (Math.abs(AU.duration - o.D) > 0.05) { scaleTimeline(o, AU.duration); o.paint(); }
      if (PL.seekTo != null) { try { AU.currentTime = PL.seekTo; } catch (e) {} PL.seekTo = null; }
    });
    return AU;
  }
  /* 解一次码：真的响度包络（50 帧/秒）＋ 31 根静止波形。按 id 记在本机，下次进来波形直接是真的 */
  var ENV = {};
  function decode(note, url) {
    if (!url || ENV[note.id] || note._decoding) return;
    note._decoding = true;
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      ACX = ACX || new C();
      fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
        return new Promise(function (res, rej) { ACX.decodeAudioData(buf, res, rej); });
      }).then(function (ab) {
        var ch = ab.numberOfChannels, n = ab.length, sr = ab.sampleRate, data = [];
        for (var c = 0; c < ch; c++) data.push(ab.getChannelData(c));
        var hop = Math.round(sr / 50), F = Math.ceil(n / hop), env = new Float32Array(F);
        for (var f = 0; f < F; f++) {
          var s = 0, cnt = 0;
          for (var i = f * hop, e = Math.min(n, i + hop); i < e; i += 2) {
            var v = 0; for (c = 0; c < ch; c++) v += data[c][i]; v /= ch; s += v * v; cnt++;
          }
          env[f] = Math.sqrt(s / Math.max(1, cnt));
        }
        var srt = Array.prototype.slice.call(env).sort(function (a, b) { return a - b; });
        var ref = srt[Math.floor(srt.length * 0.96)] || 1;
        for (f = 0; f < F; f++) env[f] = Math.min(1, env[f] / ref);
        ENV[note.id] = env;
        var pk = peaksFrom(function (t) { return env[Math.min(F - 1, Math.floor(t * 50))]; }, ab.duration);
        try { localStorage.setItem('vn.pk.' + note.id, JSON.stringify(pk.map(function (x) { return +x.toFixed(3); }))); } catch (e) {}
        note.peaks = pk; note.setBars();
        if (Math.abs(ab.duration - note.D) > 0.05 && (PL.owner !== note || PL.sim)) { scaleTimeline(note, ab.duration); note.paint(); }
      }).catch(noop);
    } catch (e) {}
  }
  function peaksFrom(ampAt, D) {
    var N = 31, out = [], mx = 0;
    for (var i = 0; i < N; i++) {
      var a1 = i / N * D, b1 = (i + 1) / N * D, sum = 0, pk = 0;
      for (var j = 0; j < 24; j++) { var v = ampAt(a1 + (j + 0.5) / 24 * (b1 - a1)); sum += v * v; pk = Math.max(pk, v); }
      var val = 0.25 * pk + 0.75 * Math.sqrt(sum / 24); out.push(val); mx = Math.max(mx, val);
    }
    return out.map(function (x) { return x / (mx || 1); });
  }

  /* 播放器：整页一个。谁在放、放到哪 —— 气泡和演示读的是同一个钟 */
  var PL = {
    owner: null, playing: false, sim: false, base: 0, t0: 0, raf: 0, want: false, seekTo: null,
    time: function () {
      if (!this.owner) return 0;
      if (!this.sim) return AU ? (AU.currentTime || 0) : 0;
      return this.playing ? this.base + (now() - this.t0) / 1000 : this.base;
    },
    play: function (note, from) {
      if (this.owner && this.owner !== note) this.halt();
      this.owner = note; this.want = true; this.playing = true; this.sim = true;
      this.base = from; this.t0 = now();             /* 拿到 url 之前先按模拟的钟走，进度不卡在那儿 */
      var a = au(), self = this;
      function go(url) {
        if (self.owner !== note || !self.want) return;
        if (!url) return;                             /* 没有声音：就按估的时长走（预览） */
        var at = self.time();
        self.sim = false;
        if (self.src !== url) { self.src = url; a.src = url; self.seekTo = at; }   /* a.src 读回来是绝对地址，比不了，自己记一份 */
        else { try { a.currentTime = at; } catch (e) { self.seekTo = at; } }
        var pr = a.play();
        /* 放不出来（没解锁、源坏了）：退回模拟的钟，画面不卡住 */
        if (pr && pr.catch) pr.catch(function () { if (self.owner === note && !self.sim) { self.sim = true; self.base = at; self.t0 = now(); } });
        decode(note, url);
      }
      /* url 已经在手：同步放（还在手势里）。要现合成：先拿静音把这个 audio 解锁（iOS 只认手势里的第一次 play），回来再放 */
      if (note._url !== undefined) go(note._url);
      else {
        try { a.src = SILENT; self.src = SILENT; var p0 = a.play(); if (p0 && p0.catch) p0.catch(noop); } catch (e) {}
        note.url().then(go);
      }
      this.loop();
    },
    pause: function () {
      if (!this.owner) return;
      this.base = this.time(); this.playing = false; this.want = false; this.sim = true;
      try { if (AU) AU.pause(); } catch (e) {}
    },
    halt: function () {                              /* 换人了：旧的那条停在原地 */
      var o = this.owner; if (!o) return;
      o.tHold = this.time(); this.pause(); this.owner = null; o.paint();
    },
    finish: function () {
      var o = this.owner; if (!o) return;
      this.playing = false; this.want = false; this.sim = true; this.base = o.D;
      o.onEnded();
    },
    loop: function () {
      if (this.raf) return;
      var self = this;
      (function f() {
        self.raf = 0;
        var o = self.owner;
        if (o && self.playing && self.sim && self.time() >= o.D) self.finish();
        if (o) o.paint();
        if (DEMO.open) DEMO.frame();
        if ((o && self.playing) || DEMO.open) self.raf = requestAnimationFrame(f);
      })();
    }
  };

  /* ═══════════ 弹簧（苹果那两个参数，跟 liquid-core 同一个式子）═══════════ */
  function Spring(x) { this.x = x; this.v = 0; this.t = x; this.r = 0.4; this.z = 1; }
  Spring.prototype.step = function (dt) {
    if (REDUCE) { this.x = this.t; this.v = 0; return; }
    dt = Math.min(dt, 0.25);                       /* 掉帧时按真实时间分几小步走完，不变成慢动作 */
    var w = 2 * Math.PI / this.r;
    while (dt > 0) {
      var h = Math.min(dt, 1 / 120); dt -= h;
      var a = -2 * this.z * w * this.v - w * w * (this.x - this.t);
      this.v += a * h; this.x += this.v * h;
    }
    if (Math.abs(this.v) < 0.0008 && Math.abs(this.x - this.t) < 0.0008) { this.x = this.t; this.v = 0; }
  };

  /* ═══════════ ④ 气泡 ═══════════ */
  var NOTES = {}, SEQ = 0;
  function Note(d) {
    this.data = d || {};
    this.id = String(this.data.id || ('vn' + (++SEQ)));
    var P = parse(this.data.en || this.data.text || '', this.data.zh || '');
    this.items = P.items; this.zhOnly = P.zhOnly;
    this.tl = timeline(P);
    this.D = this.tl.end;
    if (this.data.duration > 0) scaleTimeline(this, +this.data.duration);
    var pk = null;
    try { pk = JSON.parse(localStorage.getItem('vn.pk.' + this.id) || 'null'); } catch (e) {}
    var self = this;
    this.peaks = this.data.peaks || pk || peaksFrom(function (t) { return modelAmp(self.tl, t); }, this.D);
    this.S = { orig: false, zh: false, menu: false };
    this.tHold = 0;
    this.el = null;
  }
  Note.prototype.url = function () {
    var self = this;
    if (this._url !== undefined) return Promise.resolve(this._url);
    if (!this._urlP) {
      this._urlP = Promise.resolve().then(function () { return CFG.audio(self.data); })
        .then(function (u) { self._url = u || null; return self._url; }, function () { self._url = null; return null; });
    }
    return this._urlP;
  };
  Note.prototype.t = function () { return PL.owner === this ? PL.time() : this.tHold; };
  Note.prototype.playing = function () { return PL.owner === this && PL.playing; };
  Note.prototype.amp = function (t) {
    var env = ENV[this.id];
    if (env && !(PL.owner === this && PL.sim && this._url)) return env[Math.min(env.length - 1, Math.max(0, Math.floor(t * 50)))] || 0;
    return modelAmp(this.tl, t);
  };
  Note.prototype.toggle = function () {
    if (this.playing()) { PL.pause(); this.tHold = PL.time(); }
    else PL.play(this, this.t() >= this.D - 0.05 ? 0 : this.t());
    this.paint();
  };
  Note.prototype.onEnded = function () {
    this.tHold = 0;
    if (DEMO.open && DEMO.note === this) { PL.base = this.D; DEMO.ended(); }
    else { PL.owner = null; }
    this.paint();
  };
  Note.prototype.plainEn = function () {
    return this.items.filter(function (x) { return x.kind === 't'; }).map(function (x) { return x.text; }).join(' ');
  };
  Note.prototype.plainZh = function () {
    return this.items.filter(function (x) { return x.kind === 't'; }).map(function (x) { return x.zh; }).join('');
  };

  Note.prototype.mount = function (el) {
    var self = this;
    this.el = el; el.__vn = this; el.setAttribute('data-vn-on', '');
    if (!el.classList.contains('vn')) el.classList.add('vn');
    var ts = this.items.filter(function (x) { return x.kind === 't'; });
    var hasZh = !this.zhOnly && ts.some(function (x) { return x.zh; });
    var bars = this.barsHTML();
    var menu = (CFG.menu || MENU).map(function (m) {
      return '<button class="vn-mi" type="button" role="menuitem" data-k="' + esc(m.key) + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + m.icon + '</svg>' + esc(m.label) + '</button>';
    }).join('');
    el.innerHTML =
      '<div class="vn-card">' +
        '<div class="vn-row">' +
          '<button class="vn-bead" type="button" data-glass data-press data-tint="0.18"></button>' +
          '<button class="vn-cap" type="button" tabindex="-1" aria-hidden="true" data-glass data-tint="0.18">' +
            '<span class="vn-wave"><span class="vn-bars">' + bars + '</span>' +
            '<span class="vn-lit"><span class="vn-bars on">' + bars + '</span></span></span>' +
            '<span class="vn-dur"></span>' +
          '</button>' +
        '</div>' +
        '<div class="vn-text" data-glass data-tint="0.18" data-radius="20" hidden>' +
          '<p class="vn-tx" lang="' + (this.zhOnly ? 'zh-CN' : 'en') + '" hidden>' +
            ts.map(function (x, i) { return '<span class="vn-w" data-i="' + i + '">' + esc(x.text) + (self.zhOnly ? '' : ' ') + '</span>'; }).join('') + '</p>' +
          (hasZh ? '<p class="vn-tx zh" lang="zh-CN" hidden>' +
            ts.map(function (x, i) { return '<span class="vn-w" data-i="' + i + '">' + esc(x.zh) + '</span>'; }).join('') + '</p>' : '') +
        '</div>' +
      '</div>' +
      '<div class="vn-cap2" role="group" aria-label="这条语音显示什么" hidden>' +
        '<button class="vn-cb" type="button" data-t="orig" aria-pressed="false"></button>' +
        (hasZh ? '<button class="vn-cb" type="button" data-t="zh" aria-pressed="false"></button>' : '') +
        '<span class="vn-capsep" aria-hidden="true"></span>' +
        '<button class="vn-cb" type="button" data-t="demo">' + ICON.demo + '演示</button>' +
      '</div>' +
      '<div class="vn-menu" role="menu" aria-label="这条语音" hidden>' + menu + '</div>';
    var q = function (s) { return el.querySelector(s); };
    this.$ = {
      card: q('.vn-card'), row: q('.vn-row'), bead: q('.vn-bead'), cap: q('.vn-cap'), dur: q('.vn-dur'),
      lit: q('.vn-lit'), litbars: q('.vn-lit > .vn-bars'), bars: q('.vn-bars'),
      text: q('.vn-text'), txo: q('.vn-tx'), txz: q('.vn-tx.zh'),
      tog: q('.vn-cap2'), tgo: q('[data-t="orig"]'), tgz: q('[data-t="zh"]'), menu: q('.vn-menu')
    };
    this.ws = Array.prototype.slice.call(el.querySelectorAll('.vn-w'));
    this.wire();
    this.paint();
  };
  Note.prototype.barsHTML = function () {
    return this.peaks.map(function (x) {
      return '<i class="vn-bar" style="transform:scaleY(' + (0.07 + 0.93 * Math.pow(clamp(x, 0, 1), 1.8)).toFixed(3) + ')"></i>';
    }).join('');
  };
  Note.prototype.setBars = function () {
    if (!this.$ || !this.el) return;
    var h = this.barsHTML(); this.$.bars.innerHTML = h; this.$.litbars.innerHTML = h;
  };

  /* 字那块往下撑开：开的时候高度 0 → 全高；开着换「原文 / 中文 / 双语」从旧高度滑到新高度；收就一下收。
     收不做合拢：hidden 一挂上，玻璃画布量不到它了，合拢那几帧玻璃会停在旧大小上。 */
  var UNFOLD = { grow: 'height .32s var(--e-out), padding .32s var(--e-out), opacity .26s var(--e-out)', shrink: 'height .22s var(--e-in), opacity .16s var(--e-in)' };
  function unfoldBare(box) { box.style.height = box.style.opacity = box.style.overflow = box.style.transition = box.style.paddingTop = box.style.paddingBottom = ''; }
  function unfold(box, from, open) {
    var seq = box.__vnSeq = (box.__vnSeq || 0) + 1;
    if (!open || REDUCE) { unfoldBare(box); return; }
    box.style.transition = 'none'; box.style.height = 'auto';
    var to = box.offsetHeight;
    if (Math.abs(to - from) < 1) { unfoldBare(box); return; }
    box.style.overflow = 'hidden'; box.style.height = from + 'px';
    if (!from) { box.style.opacity = '0'; box.style.paddingTop = box.style.paddingBottom = '0px'; }   /* 从 0 开：内边距也从 0 撑，下面的消息不会先被推开一截 */
    void box.offsetHeight;
    box.style.transition = to < from ? UNFOLD.shrink : UNFOLD.grow;
    box.style.height = to + 'px'; box.style.opacity = ''; box.style.paddingTop = box.style.paddingBottom = '';
    var done = false, tm = 0;
    function fin(e) {
      if (e && (e.target !== box || e.propertyName !== 'height')) return;
      if (done) return; done = true;
      box.removeEventListener('transitionend', fin); clearTimeout(tm);
      if (box.__vnSeq === seq) unfoldBare(box);
    }
    box.addEventListener('transitionend', fin);
    tm = setTimeout(fin, 520);   /* transitionend 偶尔不来（中途打断、页面藏着），兜底 */
  }

  Note.prototype.paint = function () {
    var $ = this.$; if (!$ || !this.el) return;
    var S = this.S, t = this.t(), playing = this.playing(), D = this.D;
    var active = playing || t > 0.01, pct = active ? Math.min(100, t / D * 100) : 0;
    var html = playing ? ICON.pause : ICON.play;
    if ($.bead.__h !== html) { $.bead.innerHTML = html; $.bead.__h = html; }
    $.bead.setAttribute('aria-label', playing ? '暂停语音' : '播放语音，' + Math.round(D) + ' 秒');
    $.lit.style.transform = 'translateX(' + (pct - 100).toFixed(2) + '%)';
    $.litbars.style.transform = 'translateX(' + (100 - pct).toFixed(2) + '%)';
    $.dur.textContent = (active ? Math.max(1, Math.ceil(D - t)) : Math.round(D)) + '″';
    var hasZh = !!$.txz, open = S.orig || (hasZh && S.zh);
    /* 只有开的段落变了才量高度（paint 播放时每帧都跑，别每帧强制排版） */
    var sig = open ? (S.orig ? 1 : 0) + (hasZh && S.zh ? 2 : 0) : 0, first = $.text.__sig == null;
    var from = (!first && sig !== $.text.__sig) ? ($.text.hidden ? 0 : $.text.getBoundingClientRect().height) : -1;
    $.text.hidden = !open; $.txo.hidden = !S.orig; if ($.txz) { $.txz.hidden = !S.zh; $.txz.classList.toggle('zh2', S.orig); }
    $.text.__sig = sig;
    $.card.classList.toggle('open', open);
    if (from >= 0) unfold($.text, from, open);   /* 等气泡变宽以后再量，不然字折行不一样，量出来的高度不对 */
    if (open) {
      var ts = this.items.filter(function (x) { return x.kind === 't'; });
      this.ws.forEach(function (w) { w.classList.toggle('next', active && ts[+w.getAttribute('data-i')].a > t + 0.01); });
    }
    if ($.tgo) {
      $.tgo.className = 'vn-cb' + (S.orig ? ' on' : ''); $.tgo.setAttribute('aria-pressed', String(S.orig));
      var lo = (S.orig ? ICON.check : ICON.orig) + (this.zhOnly ? '文字' : '原文');
      if ($.tgo.__h !== lo) { $.tgo.innerHTML = lo; $.tgo.__h = lo; }
    }
    if ($.tgz) {
      $.tgz.className = 'vn-cb' + (S.zh ? ' on' : ''); $.tgz.setAttribute('aria-pressed', String(S.zh));
      var lz = (S.zh ? ICON.check : ICON.zh) + '中文';
      if ($.tgz.__h !== lz) { $.tgz.innerHTML = lz; $.tgz.__h = lz; }
    }
  };

  /* ── 按住、浮起、放回：都是同一根弹簧在推，随时能被打断、反向，不会「撞墙」。
     纸那一族推整个气泡；玻璃皮只推波形那条（珠子和字不动）。 ── */
  Note.prototype.liftEl = function () { return isGlass() ? this.$.cap : this.$.row; };
  Note.prototype.drive = function (to, response, damping) {
    var self = this, el = this.liftEl();
    if (this.spEl && this.spEl !== el) this.spEl.style.transform = '';
    this.spEl = el;
    if (!this.sp) this.sp = new Spring(1);
    this.sp.t = to; this.sp.r = response; this.sp.z = damping;
    if (this.spRaf) return;
    var last = now();
    (function f(n) {
      var dt = Math.max(0, ((n || now()) - last) / 1000); last = n || now();   /* rAF 的时间戳可能比 performance.now() 早一帧 */
      self.sp.step(dt);
      self.spEl.style.transform = (self.sp.x === 1 && self.sp.t === 1) ? '' : 'scale(' + self.sp.x.toFixed(4) + ')';
      self.spRaf = (self.sp.v !== 0 || self.sp.x !== self.sp.t) ? requestAnimationFrame(f) : 0;
    })();
  };

  Note.prototype.wire = function () {
    var self = this, $ = this.$, hold = null, sx = 0, sy = 0;
    this.longFired = false;
    function tap() { if (self.longFired) { self.longFired = false; return; } self.toggle(); }
    $.bead.addEventListener('click', tap);
    $.cap.addEventListener('click', tap);
    function cancelHold() { clearTimeout(hold); hold = null; if (!self.S.menu) self.drive(1, 0.3, 1); }
    $.cap.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || self.S.menu) return;
      sx = e.clientX; sy = e.clientY; self.longFired = false;
      self.drive(0.955, 0.6, 1);                   /* 按住：慢慢陷下去，这 600ms 就是进度 */
      clearTimeout(hold);
      hold = setTimeout(function () { hold = null; self.openMenu(); }, 600);
    });
    $.cap.addEventListener('pointermove', function (e) {
      if (hold && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) cancelHold();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (k) { $.cap.addEventListener(k, function () { if (hold) cancelHold(); }); });
    $.cap.addEventListener('contextmenu', function (e) { e.preventDefault(); if (!self.S.menu) self.openMenu(); });
    /* 键盘：珠子上按菜单键 / Shift+F10 也能打开 */
    $.bead.addEventListener('keydown', function (e) {
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); self.openMenu(); }
    });
    $.tog.addEventListener('click', function (e) {
      var b = e.target.closest('.vn-cb'); if (!b) return;
      var k = b.getAttribute('data-t');
      if (k === 'orig') { self.S.orig = !self.S.orig; self.paint(); }
      else if (k === 'zh') { self.S.zh = !self.S.zh; self.paint(); }
      else if (k === 'demo') { self.closeMenu(); DEMO.show(self); }
    });
    $.menu.addEventListener('click', function (e) {
      var b = e.target.closest('.vn-mi'); if (!b) return;
      var k = b.getAttribute('data-k');
      self.closeMenu();
      if (k === 'copy') {
        var txt = self.plainEn() + (self.plainZh() ? '\n' + self.plainZh() : '');
        try { navigator.clipboard.writeText(txt); } catch (err) {}
      }
      if (CFG.onAction) { try { CFG.onAction(k, self.data, self); } catch (err) { console.warn('[voice-note]', err); } }
    });
    [$.menu, $.tog].forEach(function (x) { x.addEventListener('keydown', function (e) { if (e.key === 'Escape') self.closeMenu(); }); });
  };

  /* ── 浮起来：iMessage 那种。消息浮起，别的东西退到后面 —— 是糊，不是压一层黑 ── */
  function scrollParent(el) {
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return p;
    }
    return null;
  }
  var gRaf = 0;
  function groundTo(stage, to, ms) {
    cancelAnimationFrame(gRaf);
    var from = parseFloat(stage.getAttribute('bg-blur')) || 0, t0 = now();
    if (REDUCE) { stage.setAttribute('bg-blur', String(to)); return; }
    (function f(n) {
      var k = clamp(((n || now()) - t0) / ms, 0, 1), e = 1 - Math.pow(1 - k, 3);
      stage.setAttribute('bg-blur', (from + (to - from) * e).toFixed(3));
      if (k < 1) gRaf = requestAnimationFrame(f);
    })();
  }
  var OPEN = null;
  Note.prototype.openMenu = function () {
    if (OPEN && OPEN !== this) OPEN.closeMenu();
    var self = this, el = this.el, $ = this.$;
    this.longFired = true; this.S.menu = true; OPEN = this;
    this.drive(1.05, 0.42, 0.62);                    /* 浮起来：带一点回弹 */
    el.classList.add('menuon');
    /* 作用域里别的东西各自糊一点 */
    var scope = (CFG.scope && CFG.scope(el)) || el.closest('[data-vn-scope]') || scrollParent(el) || el.parentElement;
    var keep = el; while (keep && keep.parentElement !== scope) keep = keep.parentElement;
    this._scope = scope; this._keep = keep;
    if (scope && keep) { scope.classList.add('vn-focusing', 'vn-focus'); keep.classList.add('vn-keep'); }
    if (CFG.blurToo) document.querySelectorAll(CFG.blurToo).forEach(function (x) { x.classList.add('vn-blurtoo'); });
    root.classList.add('vn-focus-on');
    /* 玻璃皮：地面由画布自己糊下去；别的玻璃也让着色器整块糊一点（跟它们上面被糊掉的字对得上） */
    var stage = isGlass() && CFG.stage && CFG.stage();
    this._stage = stage || null;
    if (stage) {
      this._bg0 = parseFloat(stage.getAttribute('bg-blur')) || 0;
      groundTo(stage, this._bg0 + 0.30, 320);
      document.querySelectorAll('[data-glass]').forEach(function (g) {
        if (el.contains(g) || g.hasAttribute('data-drag') || g.closest('.vn-demo')) return;
        g.__vnBlur = g.getAttribute('data-blur'); g.setAttribute('data-blur', '0.6');
      });
    }
    [$.tog, $.menu].forEach(function (x) { x.classList.remove('out'); x.hidden = false; });
    /* 底下放不下就往上收 */
    var rv = el.getBoundingClientRect(), bottom = window.innerHeight;
    if (scope) bottom = Math.min(bottom, scope.getBoundingClientRect().bottom);
    /* 菜单挂在播放条正下方（字开着也一样，盖在字上 —— iMessage 那样）；底下放不下就往上收 */
    var room = bottom - rv.top, mh = $.menu.offsetHeight || 272, top0 = $.row.offsetHeight + 12;
    $.menu.style.top = (top0 + mh + 10 > room) ? Math.max(8, room - mh - 10) + 'px' : top0 + 'px';
    /* 点外面任何地方收起 —— 那一下不落到下面的东西上 */
    this._outside = function (e) {
      if (el.contains(e.target)) return;
      e.preventDefault(); e.stopPropagation(); self.closeMenu();
    };
    setTimeout(function () { if (self.S.menu) { document.addEventListener('click', self._outside, true); document.addEventListener('keydown', self._esc = function (e) { if (e.key === 'Escape') self.closeMenu(); }); } }, 0);
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {}
    try { ($.tgo || $.menu.querySelector('.vn-mi')).focus({ preventScroll: true }); } catch (e) {}
    this.paint();
  };
  Note.prototype.closeMenu = function () {
    if (!this.S.menu) return;
    var self = this, $ = this.$, el = this.el;
    this.S.menu = false; if (OPEN === this) OPEN = null;
    this.drive(1, 0.34, 1);                          /* 放回去：不过冲 */
    document.removeEventListener('click', this._outside, true);
    if (this._esc) document.removeEventListener('keydown', this._esc);
    var scope = this._scope, keep = this._keep;
    if (scope) scope.classList.remove('vn-focus');
    root.classList.remove('vn-focus-on');
    setTimeout(function () {
      if (scope && !self.S.menu) scope.classList.remove('vn-focusing');
      if (keep && !self.S.menu) keep.classList.remove('vn-keep');
      if (CFG.blurToo && !self.S.menu) document.querySelectorAll('.vn-blurtoo').forEach(function (x) { x.classList.remove('vn-blurtoo'); });
    }, 380);
    if (this._stage) {
      groundTo(this._stage, this._bg0 || 0, 240);
      document.querySelectorAll('[data-glass]').forEach(function (g) {
        if (!('__vnBlur' in g)) return;
        if (g.__vnBlur == null) g.removeAttribute('data-blur'); else g.setAttribute('data-blur', g.__vnBlur);
        delete g.__vnBlur;
      });
    }
    [$.tog, $.menu].forEach(function (x) { x.classList.add('out'); });
    setTimeout(function () {
      if (self.S.menu) return;
      [$.tog, $.menu].forEach(function (x) { x.hidden = true; x.classList.remove('out'); });
      el.classList.remove('menuon');
    }, 190);
    /* 焦点只在用键盘的时候放回珠子：手指点的也放回去，iPhone 上珠子外面会留一圈焦点框 */
    if (KEYNAV) { try { $.bead.focus({ preventScroll: true }); } catch (e) {} }
  };

  /* ═══════════ ⑤ 演示：点线图形 ═══════════
     不画边：在图形里撒点（抖动网格），每 4 颗挑一个枢纽连最近的三个枢纽，
     线的三分点不在图形里就不连 —— 瓣和瓣、叶和叶之间的缝自己就空着。
     动的是图形里面：一张慢慢流的噪声场，亮处从中心冒出来、往外漂、半路散掉（像水，像丝绸，不像硅胶）；
     声音只改两件事：流得多急（V）、被流到的那片有多大（A）。重点色是另一张流得更快的场。
     播完（或暂停）L 落到 0：两只时钟都停，亮区和重点色退回底色，图形静下来。 */
  var DM = { skin: 'dark', tone: 'dark', E: 0, As: 0, V: 0, A: 0, L: 0, last: 0 };
  var dmLeaf = null;
  /* 现成的几个形状，都画在 512×512 里；cx / cy ＝ 波往外漂的起点 */
  var SHAPES = {
    star:   { cx: 256, cy: 272, d: 'M241.9 54.2Q256.0 24.0 270.1 54.2L315.2 150.8Q326.5 174.9 353.0 178.2L458.8 191.3Q491.9 195.4 467.5 218.1L389.6 290.9Q370.1 309.1 375.2 335.3L395.4 439.9Q401.8 472.6 372.6 456.5L279.3 404.9Q256.0 392.0 232.7 404.9L139.4 456.5Q110.2 472.6 116.6 439.9L136.8 335.3Q141.9 309.1 122.4 290.9L44.5 218.1Q20.1 195.4 53.2 191.3L159.0 178.2Q185.5 174.9 196.8 150.8Z' },
    flower: { cx: 256, cy: 264, d: 'M256.0 248.0C202.0 208.0 152.0 94.0 202.0 38.0C224.0 16.0 246.0 26.0 256.0 50.0C266.0 26.0 288.0 16.0 310.0 38.0C360.0 94.0 310.0 208.0 256.0 248.0ZM271.2 259.1C292.6 195.3 385.5 112.6 454.3 142.8C482.0 156.9 479.3 180.9 459.5 197.9C485.4 200.0 501.8 217.8 487.6 245.5C449.8 310.4 325.9 298.1 271.2 259.1ZM265.4 276.9C332.6 277.6 440.1 340.4 432.5 415.1C427.7 445.8 404.0 450.7 381.8 437.1C387.8 462.4 375.9 483.4 345.2 478.6C271.8 462.7 245.2 341.0 265.4 276.9ZM246.6 276.9C266.8 341.0 240.2 462.7 166.8 478.6C136.1 483.4 124.2 462.4 130.2 437.1C108.0 450.7 84.3 445.8 79.5 415.1C71.9 340.4 179.4 277.6 246.6 276.9ZM240.8 259.1C186.1 298.1 62.2 310.4 24.4 245.5C10.2 217.8 26.6 200.0 52.5 197.9C32.7 180.9 30.0 156.9 57.7 142.8C126.5 112.6 219.4 195.3 240.8 259.1ZM296 264A40 40 0 1 1 216 264A40 40 0 1 1 296 264Z' },
    clover: { cx: 256, cy: 234, d: 'M267.7 222.3C264.3 168.9 256.0 67.1 316.1 30.4C356.1 7.0 406.2 40.4 394.5 95.5C449.6 83.8 483.0 133.9 459.6 173.9C422.9 234.0 321.1 225.7 267.7 222.3ZM267.7 245.7C321.1 242.3 422.9 234.0 459.6 294.1C483.0 334.1 449.6 384.2 394.5 372.5C406.2 427.6 356.1 461.0 316.1 437.6C256.0 400.9 264.3 299.1 267.7 245.7ZM244.3 245.7C247.7 299.1 256.0 400.9 195.9 437.6C155.9 461.0 105.8 427.6 117.5 372.5C62.4 384.2 29.0 334.1 52.4 294.1C89.1 234.0 190.9 242.3 244.3 245.7ZM244.3 222.3C190.9 225.7 89.1 234.0 52.4 173.9C29.0 133.9 62.4 83.8 117.5 95.5C105.8 40.4 155.9 7.0 195.9 30.4C256.0 67.1 247.7 168.9 244.3 222.3ZM248 234C246 344 266 434 326 504L340 492C284 428 264 342 264 234Z' },
    sprout: { cx: 258, cy: 200, d: 'M250 250C214 120 110 60 18 92C30 230 140 290 250 250ZM262 222C296 76 404 14 500 40C488 186 380 262 262 222ZM244 496C250 400 246 300 248 222L270 222C268 300 272 400 268 496Z' }
  };
  var LP = null, LPFOR = null, LINKS = [], lctx = null, LW = 0, LH = 0, ldpr = 1, CEN = { x: 0, y: 0 }, FT = 0;
  var lrand = (function () { var s = 9152026; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

  /* simplex 3D（Stefan Gustavson 的公开实现，压短了） */
  var PERM = new Uint8Array(512), PM12 = new Uint8Array(512);
  (function () { var p = [], i, j, t; for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { j = Math.floor(lrand() * (i + 1)); t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 512; i++) { PERM[i] = p[i & 255]; PM12[i] = PERM[i] % 12; } })();
  var GR = [1,1,0, -1,1,0, 1,-1,0, -1,-1,0, 1,0,1, -1,0,1, 1,0,-1, -1,0,-1, 0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1];
  function noise3(x, y, z) {
    var s = (x + y + z) / 3, i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    var t = (i + j + k) / 6, x0 = x - i + t, y0 = y - j + t, z0 = z - k + t, i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    var G6 = 1 / 6;
    var x1 = x0 - i1 + G6, y1 = y0 - j1 + G6, z1 = z0 - k1 + G6;
    var x2 = x0 - i2 + 2 * G6, y2 = y0 - j2 + 2 * G6, z2 = z0 - k2 + 2 * G6;
    var x3 = x0 - 0.5, y3 = y0 - 0.5, z3 = z0 - 0.5;
    var ii = i & 255, jj = j & 255, kk = k & 255, n = 0, g, q;
    q = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (q > 0) { g = PM12[ii + PERM[jj + PERM[kk]]] * 3; q *= q; n += q * q * (GR[g] * x0 + GR[g + 1] * y0 + GR[g + 2] * z0); }
    q = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (q > 0) { g = PM12[ii + i1 + PERM[jj + j1 + PERM[kk + k1]]] * 3; q *= q; n += q * q * (GR[g] * x1 + GR[g + 1] * y1 + GR[g + 2] * z1); }
    q = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (q > 0) { g = PM12[ii + i2 + PERM[jj + j2 + PERM[kk + k2]]] * 3; q *= q; n += q * q * (GR[g] * x2 + GR[g + 1] * y2 + GR[g + 2] * z2); }
    q = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (q > 0) { g = PM12[ii + 1 + PERM[jj + 1 + PERM[kk + 1]]] * 3; q *= q; n += q * q * (GR[g] * x3 + GR[g + 1] * y3 + GR[g + 2] * z3); }
    return 32 * n;
  }

  function buildLeaf() {
    var sh = CFG.shape;
    sh = typeof sh === 'string' ? (SHAPES[sh] || SHAPES.star) : (sh && sh.d ? sh : SHAPES.star);
    LPFOR = CFG.shape; LINKS = [];
    var c = document.createElement('canvas'), S = 512; c.width = c.height = S;
    var x = c.getContext('2d'), P = new Path2D(sh.d);
    x.fill(P);
    var d = x.getImageData(0, 0, S, S).data, cell = 7.4, pts = [];
    var inside = function (px, py) { px |= 0; py |= 0; return px >= 0 && py >= 0 && px < S && py < S && d[(py * S + px) * 4 + 3] > 128; };
    for (var gy = 0; gy < S; gy += cell) for (var gx = 0; gx < S; gx += cell) {
      var jx = gx + lrand() * cell, jy = gy + lrand() * cell;
      if (!inside(jx, jy)) continue;
      pts.push({ x: (jx - 256) / 512, y: (jy - 256) / 512, z: (lrand() - 0.5) * 0.5,
                 r: 0, ca: 0, sa: 0, px: 0, py: 0, d: 1, nr: 0, lit: 0, ac: 0 });
    }
    /* 「内」：形状给了 cx / cy 就从那儿往外漂，没给就用重心 */
    if (sh.cx != null && sh.cy != null) { CEN.x = (sh.cx - 256) / 512; CEN.y = (sh.cy - 256) / 512; }
    else {
      var sx = 0, sy = 0, cn = 0;
      pts.forEach(function (p) { sx += p.x; sy += p.y; cn++; });
      CEN.x = cn ? sx / cn : 0; CEN.y = cn ? sy / cn : 0;
    }
    pts.forEach(function (p) {
      var dx = p.x - CEN.x, dy = p.y - CEN.y; p.r = Math.hypot(dx, dy) || 1e-4; p.ca = dx / p.r; p.sa = dy / p.r;
      p.nr = Math.max(0, Math.min(1, p.z + 0.5));
    });
    var step = 4, hubs = [], seen = {};
    for (var i = 0; i < pts.length; i += step) hubs.push(i);
    hubs.forEach(function (i) {
      var a = pts[i];
      hubs.filter(function (j) { return j !== i; })
        .map(function (j) { var b = pts[j]; return { j: j, d: Math.hypot(a.x - b.x, a.y - b.y) }; })
        .sort(function (u, v) { return u.d - v.d; }).slice(0, 3)
        .forEach(function (o) {
          var j = o.j, b = pts[j], id = i < j ? i + ':' + j : j + ':' + i;
          if (seen[id] || o.d > 0.075) return;
          var ok = [0.25, 0.5, 0.75].every(function (f) {
            return inside(256 + (a.x + (b.x - a.x) * f) * 512, 256 + (a.y + (b.y - a.y) * f) * 512);
          });
          if (!ok) return;
          seen[id] = 1; LINKS.push(i, j);
        });
    });
    LP = pts;
  }
  function initLeaf() {
    if (!LP || LPFOR !== CFG.shape) buildLeaf();
    ldpr = Math.min(2, window.devicePixelRatio || 1);
    LW = 360; LH = 360;
    dmLeaf.width = Math.round(LW * ldpr); dmLeaf.height = Math.round(LH * ldpr);
    lctx = dmLeaf.getContext('2d');
    lctx.setTransform(ldpr, 0, 0, ldpr, 0, 0);
    return true;
  }
  /* 颜色：暗处是蓝灰点＋淡紫线；亮处发白；说得重的时候亮处才带一点重点色 */
  var PAL = {
    /* lf ＝ 没被流到的那层底子有多实：液态两套只加深一点点，纸和夜色加得多一些 */
    dark:  { ink: [176, 186, 204], glow: [236, 232, 255], line: [160, 148, 228], hot: [232, 150, 118], inkA: 0.39, pA: 0.48, lA1: 0.40, lA2: 0.15, lf: 0.29, hA: 0.80 },
    light: { ink: [76, 90, 110],   glow: [40, 46, 72],    line: [104, 92, 184],  hot: [176, 82, 52],   inkA: 0.41, pA: 0.40, lA1: 0.32, lA2: 0.10, lf: 0.29, hA: 0.70 },
    /* 纸：底子的墨点和线都实一些；流到的地方只是墨稍浓，重点色也收浅，不再一块块发黑 */
    paper: { ink: [122, 108, 97],  glow: [88, 77, 68],    line: [168, 136, 118], hot: [200, 128, 102], inkA: 0.50, pA: 0.28, lA1: 0.30, lA2: 0.06, lf: 0.40, hA: 0.62 },
    /* 夜色：同理，底子亮一些，流到的地方白得收敛一点 */
    night: { ink: [140, 153, 172], glow: [214, 222, 233], line: [154, 171, 191], hot: [214, 164, 126], inkA: 0.48, pA: 0.38, lA1: 0.36, lA2: 0.10, lf: 0.40, hA: 0.66 }
  };
  var NB = 24, PB = [], LB = [], AB = [], AL = [];
  for (var q0 = 0; q0 < NB; q0++) { PB.push([]); LB.push([]); AB.push([]); AL.push([]); }
  var ST = 0, TA = 0, LFRESH = true;
  function sstep(a, b, v) { v = (v - a) / (b - a); v = v < 0 ? 0 : v > 1 ? 1 : v; return v * v * (3 - 2 * v); }
  /* 像丝绸，不像硅胶：
     · 所有「形变的幅度」只跟很慢的包络走（A：半秒起、一秒落），不跟音节走 —— 所以不会一下鼓起来又弹回去；
     · 每个点在屏幕上的位置、亮度都带一点惯性（0.3 秒 / 0.2 秒追过去），哪怕场本身有急转，点也是被拖着滑过去；
     · 形变用的是很低频的一张场（大褶子），再叠一层很淡的细褶。
     播完（或暂停）以后 L 慢慢落到 0：两只时钟都停、亮区和重点色都退回底色，图形静下来。 */
  function drawLeaf(dt, now) {
    if (!lctx) return;
    var pal = PAL[DM.skin] || PAL.dark;
    var Lv = DM.L, A = DM.A, V = DM.V, Es = DM.As;
    /* 主场的时钟：活着时 1×，说话时最多 2×；重点色那层自己一只表，大约快一倍多 */
    FT += dt * Lv * (REDUCE ? 0.25 : (0.9 + 1.1 * Math.pow(V, 1.1)));
    TA += dt * Lv * (REDUCE ? 0.4 : (1.4 + 1.2 * V));
    ST += dt * Lv;
    var T = FT;
    var span = LW * 0.84, cx = LW / 2, cy = LH / 2 + 2, F = span * 2.6;
    var vX = REDUCE ? 0 : Math.sin(ST * 0.11) * 0.12, vY = REDUCE ? 0 : Math.sin(ST * 0.083 + 1) * 0.06;
    var flowA = REDUCE ? 0 : (0.013 + 0.007 * A);
    var th = 0.14 - 0.40 * A;                       /* 说得越满，流到的那片越大 */
    var W = Math.min(1, Es * 1.8) * Lv;             /* 重点色只在说话时出来 */
    var kp = LFRESH ? 1 : 1 - Math.exp(-dt / 0.3), kl = LFRESH ? 1 : 1 - Math.exp(-dt / 0.2);
    var i, p, n = LP.length;
    for (i = 0; i < n; i++) {
      p = LP[i];
      var f1 = noise3(p.r * 3.1 - T * 0.13, p.ca * 0.85 + 7.3, p.sa * 0.85 - 2.1);
      var f2 = noise3(p.x * 3.4 + 31.7, p.y * 3.4 - 5.2, T * 0.07);
      var f = 0.62 * f1 + 0.48 * f2;
      var lit = sstep(th, th + 0.85, f) * (1 - 0.45 * sstep(0.18, 0.52, p.r)) * Lv;
      /* 重点色：另一张往外漂得更快的场，只染在已经亮起来的地方 */
      var g = 0.72 * noise3(p.r * 3.7 - TA * 0.3, p.ca * 1.1 + 3.1, p.sa * 1.1 - 8.7) + 0.4 * noise3(p.x * 4.1 - 9.3, p.y * 4.1 + 2.2, TA * 0.12);
      var ac = sstep(0.04, 0.62, g) * W;
      /* 大褶子＋一层淡淡的细褶 */
      var wx = noise3(p.x * 1.7, p.y * 1.7 + 13.1, T * 0.05) + 0.3 * noise3(p.x * 3.6 + 5.5, p.y * 3.6, T * 0.08);
      var wy = noise3(p.x * 1.7 - 21.4, p.y * 1.7, T * 0.05 + 3.3) + 0.3 * noise3(p.x * 3.6, p.y * 3.6 - 7.7, T * 0.08 + 1.9);
      var swell = f * 0.004;
      var x = p.x + wx * flowA + p.ca * swell, y = p.y + wy * flowA + p.sa * swell;
      var zz = p.z * 0.26;
      var x1 = x + zz * vX * 2.2, y1 = y - zz * vY * 2.2, dp = F / (F - zz * span);
      var tx = cx + x1 * span * dp, ty = cy + y1 * span * dp;
      p.px += (tx - p.px) * kp; p.py += (ty - p.py) * kp; p.d = dp;
      p.lit += (lit - p.lit) * kl; p.ac += (ac * p.lit - p.ac) * kl;
    }
    LFRESH = false;
    lctx.clearRect(0, 0, LW, LH);
    for (var q = 0; q < NB; q++) { LB[q].length = 0; PB[q].length = 0; AB[q].length = 0; AL[q].length = 0; }
    /* 线：底色一层；被重点色流过的，再描一层重点色 */
    for (var k = 0; k < LINKS.length; k += 2) {
      var Pa = LP[LINKS[k]], Pb = LP[LINKS[k + 1]];
      var len = Math.hypot(Pa.px - Pb.px, Pa.py - Pb.py) / span;
      var stretch = Math.max(0, 1 - Math.max(0, len - 0.06) / 0.08);
      var lv = Math.min(Pa.lit, Pb.lit) * 0.7 + Math.max(Pa.lit, Pb.lit) * 0.3;
      var al = stretch * (pal.lf + (1 - pal.lf) * lv);
      if (al > 0.05) LB[Math.min(NB - 1, (al * (NB - 1)) | 0)].push(Pa, Pb);
      var av = stretch * (Pa.ac + Pb.ac) * 0.5;
      if (av > 0.05) AL[Math.min(NB - 1, (av * (NB - 1)) | 0)].push(Pa, Pb);
    }
    var m, Lq, a;
    for (q = 1; q < NB; q++) {
      Lq = LB[q]; if (!Lq.length) continue;
      a = q / (NB - 1);
      lctx.lineWidth = 0.6 + 0.35 * a;
      lctx.strokeStyle = 'rgba(' + pal.line + ',' + (a * pal.lA1 + a * a * pal.lA2).toFixed(3) + ')';
      lctx.beginPath();
      for (m = 0; m < Lq.length; m += 2) { lctx.moveTo(Lq[m].px, Lq[m].py); lctx.lineTo(Lq[m + 1].px, Lq[m + 1].py); }
      lctx.stroke();
    }
    for (q = 1; q < NB; q++) {
      Lq = AL[q]; if (!Lq.length) continue;
      a = q / (NB - 1);
      lctx.lineWidth = 0.8;
      lctx.strokeStyle = 'rgba(' + pal.hot + ',' + (a * pal.hA * 0.7).toFixed(3) + ')';
      lctx.beginPath();
      for (m = 0; m < Lq.length; m += 2) { lctx.moveTo(Lq[m].px, Lq[m].py); lctx.lineTo(Lq[m + 1].px, Lq[m + 1].py); }
      lctx.stroke();
    }
    /* 点：底色按亮度分桶；重点色那层盖在上面，按浓淡分桶 */
    for (i = 0; i < n; i++) {
      p = LP[i];
      PB[Math.min(NB - 1, (p.lit * (NB - 1) + 0.5) | 0)].push(p);
      if (p.ac > 0.05) AB[Math.min(NB - 1, (p.ac * (NB - 1) + 0.5) | 0)].push(p);
    }
    var Pq, b, rr, pp;
    for (q = 0; q < NB; q++) {
      Pq = PB[q]; if (!Pq.length) continue;
      b = q / (NB - 1);
      lctx.fillStyle = 'rgba(' + mix3(pal.ink, pal.glow, b) + ',' + (pal.inkA + b * pal.pA).toFixed(3) + ')';
      var rad = 0.62 + 0.7 * b;
      lctx.beginPath();
      for (m = 0; m < Pq.length; m++) { pp = Pq[m]; rr = rad * pp.d * (0.8 + 0.4 * pp.nr); lctx.moveTo(pp.px + rr, pp.py); lctx.arc(pp.px, pp.py, rr, 0, 6.283); }
      lctx.fill();
    }
    for (q = 1; q < NB; q++) {
      Pq = AB[q]; if (!Pq.length) continue;
      b = q / (NB - 1);
      lctx.fillStyle = 'rgba(' + pal.hot + ',' + (b * pal.hA).toFixed(3) + ')';
      lctx.beginPath();
      for (m = 0; m < Pq.length; m++) { pp = Pq[m]; rr = (0.62 + 0.7 * pp.lit) * pp.d * (0.8 + 0.4 * pp.nr) * 1.05; lctx.moveTo(pp.px + rr, pp.py); lctx.arc(pp.px, pp.py, rr, 0, 6.283); }
      lctx.fill();
    }
  }

  /* 纸和玻璃以外的皮：从它自己的 token 现算一份图形的颜色 */
  var CC = null;
  function rgbOf(str) {
    CC = CC || document.createElement('canvas').getContext('2d');
    CC.fillStyle = '#000'; CC.fillStyle = String(str || '').trim() || '#000';
    var v = CC.fillStyle;
    if (v.charAt(0) === '#') return [parseInt(v.substr(1, 2), 16), parseInt(v.substr(3, 2), 16), parseInt(v.substr(5, 2), 16)];
    var m = v.match(/[\d.]+/g) || [0, 0, 0]; return [+m[0], +m[1], +m[2]];
  }
  function derivePal(el, dark) {
    var cs = getComputedStyle(el), g = function (k) { return rgbOf(cs.getPropertyValue(k)); };
    var ink = g('--ink'), hint = g('--hint'), acc = g('--accent'), bg = g('--bg');
    return { ink: hint, glow: mix3(ink, bg, dark ? 0.08 : 0.15), line: mix3(hint, acc, 0.3), hot: mix3(acc, bg, 0.22),
             inkA: dark ? 0.46 : 0.48, pA: dark ? 0.38 : 0.30, lA1: 0.32, lA2: 0.08, lf: 0.40, hA: 0.62 };
  }

  /* 玻璃皮的地面：跟整页同一张壁纸，在这边压暗（黑）/ 洗淡（白）一档 —— 细线才浮得出来 */
  var WALLC = {};
  function demoWall(tone) {
    var stage = CFG.stage && CFG.stage();
    var src = CFG.wallpaper ? CFG.wallpaper(tone) : (stage && stage.getAttribute('wallpaper'));
    if (!src) return Promise.resolve(null);
    var key = tone + '|' + src;
    if (WALLC[key]) return WALLC[key];
    WALLC[key] = new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        try {
          var k = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight));
          var w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h);
          var d = x.getImageData(0, 0, w, h), p = d.data;
          for (var i = 0; i < p.length; i += 4) {
            var r = p[i], g = p[i + 1], b = p[i + 2], l = 0.299 * r + 0.587 * g + 0.114 * b;
            if (tone === 'dark') {               /* 亮度 ×0.38，饱和 ×1.2 */
              r = l + (r - l) * 1.2; g = l + (g - l) * 1.2; b = l + (b - l) * 1.2;
              r *= 0.38; g *= 0.38; b *= 0.38;
            } else {                              /* 饱和 ×0.7，对比 ×0.55，再往纸白里兑 42% */
              r = l + (r - l) * 0.7; g = l + (g - l) * 0.7; b = l + (b - l) * 0.7;
              r = 128 + (r - 128) * 0.55; g = 128 + (g - 128) * 0.55; b = 128 + (b - 128) * 0.55;
              r = r * 0.58 + 244 * 0.42; g = g * 0.58 + 246 * 0.42; b = b * 0.58 + 250 * 0.42;
            }
            p[i] = clamp(r, 0, 255); p[i + 1] = clamp(g, 0, 255); p[i + 2] = clamp(b, 0, 255);
          }
          x.putImageData(d, 0, 0);
          res(c.toDataURL('image/jpeg', 0.86));
        } catch (e) { res(src); }               /* 跨域读不了像素：就用原图 */
      };
      im.onerror = function () { res(src); };
      im.src = src;
    });
    return WALLC[key];
  }

  var DEMO = {
    open: false, note: null, el: null, mode: 'both', wake: 0, lines: null, cur: -2,
    build: function () {
      if (this.el) return;
      var el = document.createElement('div');
      el.className = 'vn-demo';
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '演示'); el.setAttribute('aria-hidden', 'true');
      el.style.setProperty('--vn-demo-z', String(CFG.zIndex));
      el.innerHTML =
        '<div class="vn-dm-ui"><div class="vn-dm-in">' +
          '<div class="vn-dm-top">' +
            '<button class="vn-dm-close" type="button" data-vn-glass data-press data-clear data-tint="0.1" aria-label="收起">' + ICON.down + '</button>' +
            '<div class="vn-dm-title"><b></b><i></i></div><span class="vn-dm-sp" aria-hidden="true"></span>' +
          '</div>' +
          '<div class="vn-dm-mid">' +
            '<div class="vn-dm-leaf" aria-hidden="true"><canvas></canvas></div>' +
            '<div class="vn-dm-subs" aria-live="off"></div>' +
          '</div>' +
          '<div class="vn-dm-ctl">' +
            '<div class="vn-dm-prog"><span class="vn-dm-cur">0:00</span><span class="vn-dm-track"><i></i></span><span class="vn-dm-dur">0:00</span></div>' +
            '<button class="vn-dm-play" type="button" data-vn-glass data-press data-clear data-tint="0.1" aria-label="暂停"></button>' +
            '<div class="vn-dm-seg" role="radiogroup" aria-label="字幕"><span class="vn-dm-segglass" data-vn-glass data-clear data-tint="0.12" aria-hidden="true"></span></div>' +
          '</div>' +
          '<div class="vn-dm-hair"><i></i></div>' +
        '</div></div>';
      ((CFG.container && CFG.container()) || document.body).appendChild(el);
      this.el = el;
      var q = function (s) { return el.querySelector(s); };
      this.$ = { ui: q('.vn-dm-ui'), close: q('.vn-dm-close'), title: q('.vn-dm-title b'), sub: q('.vn-dm-title i'),
        subs: q('.vn-dm-subs'), cur: q('.vn-dm-cur'), dur: q('.vn-dm-dur'), fill: q('.vn-dm-track i'), hair: q('.vn-dm-hair i'),
        play: q('.vn-dm-play'), seg: q('.vn-dm-seg'), segglass: q('.vn-dm-segglass') };
      dmLeaf = q('.vn-dm-leaf canvas');
      var self = this;
      this.$.close.addEventListener('click', function () { self.hide(); });
      this.$.play.addEventListener('click', function () { var n = self.note; if (n) { n.toggle(); self.paintPlay(); } self.wakeUp(); });
      this.$.seg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; self.setMode(b.getAttribute('data-m')); self.wakeUp(); });
      el.addEventListener('pointerdown', function () { self.wakeUp(); });
      el.addEventListener('keydown', function (e) {
        self.wakeUp();
        if (e.key === 'Escape') { e.preventDefault(); self.hide(); }
        if (e.key === 'Tab') {                    /* 焦点留在这一页里 */
          var f = Array.prototype.filter.call(el.querySelectorAll('button'), function (b) { return b.offsetParent !== null; });
          if (!f.length) return;
          var i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      });
    },
    wakeUp: function () { this.wake = now(); },
    skin: function () {
      var glass = isGlass(), dark = isDark(), s = root.getAttribute('data-skin') || 'paper';
      var el = this.el, stage = el.querySelector('liquid-stage');
      DM.tone = dark ? 'dark' : 'light';
      el.classList.toggle('flat', !glass);
      el.classList.toggle('tone-dark', dark); el.classList.toggle('tone-light', !dark);
      if (glass) DM.skin = dark ? 'dark' : 'light';
      else if (s === 'paper') DM.skin = dark ? 'night' : 'paper';
      else { PAL.custom = derivePal(el, dark); DM.skin = 'custom'; }
      /* 玻璃皮才要画布；纸那一族连画布都不挂（不在背后白白画一张看不见的图） */
      if (glass && window.customElements && customElements.get('liquid-stage')) {
        if (!stage) {
          stage = document.createElement('liquid-stage');
          stage.className = 'vn-dm-stage';
          stage.setAttribute('hosts', '[data-vn-glass]');   /* 只画演示页自己那三颗，不跟整页抢那 14 块的预算 */
          [['merge', '0'], ['light', '132'], ['shadow', '0'], ['frost-level', '0.42'], ['data-bg-y', '0.16'], ['bg-blur', '0.5']]
            .forEach(function (a) { stage.setAttribute(a[0], a[1]); });
          el.insertBefore(stage, el.firstChild);
        }
        stage.setAttribute('tone', DM.tone);
        /* 配方跟整页那块画布走：那边写了新配方（lobes、saturate…），演示页这块也照抄 */
        var main = CFG.stage && CFG.stage();
        if (main && main !== stage) ['lobes', 'saturate', 'lift', 'disp-px', 'edge-adapt', 'phys', 'refract', 'bevel', 'bevel-max', 'soft-corner', 'ior', 'dispersion', 'thick-mul', 'specular']
          .forEach(function (k) { var v = main.getAttribute(k); if (v != null) stage.setAttribute(k, v); else stage.removeAttribute(k); });
        stage.setAttribute('tint', dark ? '0.22' : '0.10');
        stage.setAttribute('frost-tint', dark ? '0.34' : '0.52');
        demoWall(DM.tone).then(function (u) {
          if (!u || !stage.isConnected) return;
          if (stage.setWallpaper) stage.setWallpaper(u); else stage.setAttribute('wallpaper', u);
        });
      } else if (stage) stage.remove();
    },
    show: function (note) {
      if (PL.owner && PL.owner !== note) PL.halt();
      this.build();
      this.note = note; this.open = true;
      this.skin();
      initLeaf();
      /* 矮屏上图形自己缩：画布是 360 的逻辑尺寸，只改 CSS 大小 */
      var H = this.el.clientHeight || window.innerHeight;
      this.el.style.setProperty('--leaf', clamp(H - 470, 200, 360) + 'px');
      var hasZh = !note.zhOnly && note.items.some(function (x) { return x.kind === 't' && x.zh; });
      this.modes = note.zhOnly ? [['off', '无字幕'], ['orig', '字幕']] : hasZh ? [['off', '无字幕'], ['orig', '原文'], ['zh', '中文'], ['both', '双语']] : [['off', '无字幕'], ['orig', '原文']];
      var seg = this.$.seg, keep = this.$.segglass;
      seg.innerHTML = ''; seg.appendChild(keep);
      this.modes.forEach(function (m) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('data-m', m[0]); b.textContent = m[1];
        seg.appendChild(b);
      });
      seg.style.gridTemplateColumns = 'repeat(' + this.modes.length + ',minmax(0,1fr))';
      keep.style.width = 'calc((100% - 8px) / ' + this.modes.length + ')';
      if (!this.modes.some(function (m) { return m[0] === DEMO.mode; })) this.mode = hasZh ? 'both' : 'orig';
      this.$.title.textContent = CFG.title;
      this.$.sub.textContent = CFG.sub(note.data) + ' · ' + Math.round(note.D) + '″';
      this.buildSubs();
      DM.E = DM.As = DM.V = DM.A = DM.L = 0; LFRESH = true; DM.last = now();
      this.setMode(this.mode);
      PL.play(note, 0);
      this.paintPlay();
      this.el.classList.add('on'); this.el.classList.remove('idle'); this.el.setAttribute('aria-hidden', 'false');
      this._prevFocus = document.activeElement;
      this.wakeUp();
      var self = this;
      setTimeout(function () { try { self.$.close.focus({ preventScroll: true }); } catch (e) {} }, 60);
    },
    hide: function () {
      if (!this.open) return;
      var n = this.note;
      this.open = false;
      if (PL.owner === n) { PL.pause(); PL.owner = null; }
      if (n) { n.tHold = 0; n.paint(); }
      this.el.classList.remove('on', 'idle'); this.el.setAttribute('aria-hidden', 'true');
      try { (n && n.$ && n.el.isConnected ? n.$.bead : this._prevFocus).focus({ preventScroll: true }); } catch (e) {}
    },
    ended: function () { this.wake = now(); this.paintPlay(); },
    paintPlay: function () {
      var p = this.note && this.note.playing();
      this.$.play.innerHTML = p ? ICON.pause.replace('M7 5.5h3v13h-3z', 'M7 5h3.2v14h-3.2z') : ICON.play;
      this.$.play.setAttribute('aria-label', p ? '暂停' : '播放');
    },
    setMode: function (m) {
      this.mode = m;
      var idx = 0;
      this.$.seg.querySelectorAll('button').forEach(function (b, i) {
        var on = b.getAttribute('data-m') === m; if (on) idx = i;
        b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
      });
      this.$.segglass.style.transform = 'translateX(' + (idx * 100) + '%)';
      this.el.classList.toggle('subs-off', m === 'off');
      var showEn = m === 'orig' || m === 'both', showZh = m === 'zh' || m === 'both';
      (this.lineEls || []).forEach(function (el) {
        var c = el.children;
        c[0].hidden = !showEn;
        if (c[1]) { c[1].hidden = !showZh; c[1].className = 'vn-dm-zh' + (m === 'zh' ? ' solo' : ''); }
      });
    },

    /* 字幕：一次只给一句，换句是上下交叉淡入。句子里面是「流式」的：
       每个字有自己的出场时刻（在它那个词念的那段时间里摊开；中文跟着英文念到的比例走），
       到点以后用 0.45 秒慢慢浮出来 —— 前沿永远是一段软的渐变，不会一个词一个词地蹦。
       没念到的字一开始就占好位置（只是透明），排版从头到尾不会跳。 */
    buildSubs: function () {
      var note = this.note, L = note.items.filter(function (x) { return x.kind === 't'; });
      var sep = note.zhOnly ? '' : ' ';
      L.forEach(function (x) {
        var W = x.words || [], tEn = [];
        W.forEach(function (w, k) {
          var tok = chars(w.t + (k < W.length - 1 ? sep : '')), n = tok.length;
          var a = w.a, e = Math.max(a + 0.1, w.e);
          for (var c = 0; c < n; c++) tEn.push(a + (e - a) * (c / n));
        });
        var zc = chars(x.zh || ''), tZh = [], ne = tEn.length;
        for (var i = 0; i < zc.length; i++) {
          var f = Math.min(ne - 1, (i + 0.5) / zc.length * ne), i0 = Math.floor(f), i1 = Math.min(ne - 1, i0 + 1);
          tZh.push(ne ? tEn[i0] + (tEn[i1] - tEn[i0]) * (f - i0) : x.a);
        }
        x.tEn = tEn; x.tZh = tZh;
      });
      function spans(s) { return chars(s).map(function (ch) { return '<span style="opacity:0">' + esc(ch) + '</span>'; }).join(''); }
      this.$.subs.innerHTML = L.map(function (x) {
        return '<div class="vn-dm-line"><p class="vn-dm-en" lang="' + (note.zhOnly ? 'zh-CN' : 'en') + '">' + spans(x.text) + '</p>' +
          (x.zh ? '<p class="vn-dm-zh" lang="zh-CN">' + spans(x.zh) + '</p>' : '') + '</div>';
      }).join('');
      this.lineEls = Array.prototype.slice.call(this.$.subs.querySelectorAll('.vn-dm-line'));
      this.lines = L;
      L.forEach(function (x, i) {
        var el = DEMO.lineEls[i];
        x.sEn = el.querySelectorAll('.vn-dm-en span'); x.sZh = el.querySelectorAll('.vn-dm-zh span');
        x.oEn = new Float32Array(x.sEn.length); x.oZh = new Float32Array(x.sZh.length);
      });
      this.cur = -2;
    },
    paintSubs: function (t, active) {
      var L = this.lines; if (!L || !L.length) return;
      if (this.note.retimed) { this.note.retimed = false; this.buildSubs(); this.setMode(this.mode); L = this.lines; }
      var cur = 0;
      if (active) for (var i = 0; i < L.length; i++) if (L[i].a <= t + 0.05) cur = i;
      var FADE = REDUCE ? 0.001 : 0.45;
      function set(list, ops, v, times, tt) {
        for (var j = 0; j < list.length; j++) {
          var o = times ? (tt - times[j]) / FADE : v;
          o = o < 0 ? 0 : o > 1 ? 1 : o * o * (3 - 2 * o);
          if (ops[j] === o || (Math.abs(ops[j] - o) < 0.008 && o !== 0 && o !== 1)) continue;
          ops[j] = o; list[j].style.opacity = o.toFixed(3);
        }
      }
      if (cur !== this.cur) {
        this.lineEls.forEach(function (el, j) { el.className = 'vn-dm-line' + (j === cur ? ' now' : (j < cur ? ' past' : '')); });
        L.forEach(function (x, j) { if (j === cur) return; set(x.sEn, x.oEn, j < cur ? 1 : 0); set(x.sZh, x.oZh, j < cur ? 1 : 0); });
        this.cur = cur;
      }
      var x = L[cur], tt = active ? t : -9;
      set(x.sEn, x.oEn, 0, x.tEn, tt); set(x.sZh, x.oZh, 0, x.tZh, tt);
    },

    frame: function () {
      var note = this.note; if (!note) return;
      var n = now(), dt = clamp((n - DM.last) / 1000, 0, 0.1); DM.last = n;   /* 负的 dt 会让包络炸掉 */
      var t = note.t(), playing = note.playing();
      /* 几条包络都故意慢：图形跟着「一句话」变，不跟着每个音节抽
         V 管流速（0.3 起 / 0.7 落），A 管亮区大小（0.55 起 / 1.1 落），As 管重点色（1.6），L 管「还活着」（播完一秒静下来） */
      var raw = playing ? note.amp(t) : 0;
      DM.As += (raw - DM.As) * (1 - Math.exp(-dt / 1.6));
      DM.V += (raw - DM.V) * (1 - Math.exp(-dt / (raw > DM.V ? 0.3 : 0.7)));
      DM.A += (raw - DM.A) * (1 - Math.exp(-dt / (raw > DM.A ? 0.55 : 1.1)));
      var alive = playing ? 1 : 0;
      DM.L += (alive - DM.L) * (1 - Math.exp(-dt / (alive > DM.L ? 0.7 : 1.0)));
      if (!alive && DM.L < 0.004) DM.L = 0;
      drawLeaf(dt, n);
      var pr = Math.min(1, t / note.D), tf = 'scaleX(' + pr.toFixed(4) + ')';
      this.$.fill.style.transform = tf; this.$.hair.style.transform = tf;
      this.$.cur.textContent = fmt(t); this.$.dur.textContent = fmt(note.D);
      this.paintSubs(t, playing || t > 0);
      if (this.$.play.__p !== playing) { this.$.play.__p = playing; this.paintPlay(); }
      this.el.classList.toggle('idle', playing && n - this.wake > 2800);
    }
  };

  /* ═══════════ ⑥ 挂上去 ═══════════
     聊天列表常常是 innerHTML 拼的：只要吐一个占位，这边扫到就长成语音条。
     列表重建了，同一个 id 会接回同一个实例（播放到哪、开没开字都还在）。 */
  function hydrate(el) {
    if (el.__vn && el.__vn.el === el) return;
    var d = {};
    try { d = JSON.parse(el.getAttribute('data-vn') || '{}') || {}; } catch (e) {}
    var note = (d.id != null && NOTES[d.id]) || new Note(d);
    NOTES[note.id] = note;
    note.mount(el);
  }
  var scanQueued = false;
  function scan() {
    scanQueued = false;
    var list = document.querySelectorAll('.vn[data-vn]:not([data-vn-on])');
    for (var i = 0; i < list.length; i++) hydrate(list[i]);
  }
  function queueScan() { if (scanQueued) return; scanQueued = true; requestAnimationFrame(scan); }
  function start() {
    scan();
    if ('MutationObserver' in window) new MutationObserver(queueScan).observe(document.body, { childList: true, subtree: true });
    /* 换皮：开着的演示页跟着换 */
    if ('MutationObserver' in window) new MutationObserver(function () { if (DEMO.open) DEMO.skin(); })
      .observe(root, { attributes: true, attributeFilter: ['data-skin', 'data-theme', 'data-glasstone'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.VoiceNote = {
    config: function (o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) CFG[k] = o[k]; return CFG; },
    /* 给 innerHTML 拼接用：吐一个占位，挂上去以后自己长出来 */
    html: function (d, cls) { return '<div class="vn' + (cls ? ' ' + esc(cls) : '') + '" data-vn="' + esc(JSON.stringify(d || {})) + '"></div>'; },
    /* 直接要一个元素 */
    render: function (d, cls) { var el = document.createElement('div'); el.className = 'vn' + (cls ? ' ' + cls : ''); el.setAttribute('data-vn', JSON.stringify(d || {})); hydrate(el); return el; },
    demo: function (d) { var note = (d && d.id != null && NOTES[d.id]) || new Note(d || {}); NOTES[note.id] = note; DEMO.show(note); return note; },
    stop: function () { if (DEMO.open) DEMO.hide(); if (PL.owner) PL.halt(); },
    parse: function (en, zh) { return parse(en, zh).items.filter(function (x) { return x.kind === 't'; }).map(function (x) { return { en: x.text, zh: x.zh }; }); },
    notes: NOTES
  };
})();
