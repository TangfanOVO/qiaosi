/* health demo 用的数 —— 全是编的，不对应任何真人。
   用一个固定种子现生成 90 天：每次打开都是同一份，截图对得上。
   格式跟 README 里「数据格式」那一节一模一样，接自己的数据源时照这个喂就行。 */
(function (root) {
  'use strict';
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var R = rng(20260912);
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var iso = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  var DAYS = 90;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var steps = [], sleepH = [], bed = [], wake = [], hrv = [], rhr = [], mood = [];
  for (var i = DAYS - 1; i >= 0; i--) {
    var d = new Date(today); d.setDate(d.getDate() - i);
    var weekend = d.getDay() === 0 || d.getDay() === 6;
    var miss = i > 0 && R() < 0.06;                       /* 偶尔一天没戴表：给 null，不给 0 */
    var b = 23.1 + (weekend ? 0.8 : 0) + (R() - 0.5) * 1.5 + (R() < 0.12 ? 2.6 : 0);   /* 偶尔熬到两点以后 */
    var len = 6.3 + R() * 2.3 + (weekend ? 0.7 : 0);
    steps.push(miss ? null : Math.round(i === 0 ? 2600 + R() * 1500                     /* 今天还没过完 */
                                                : (weekend ? 5600 : 7800) + (R() - 0.45) * 5000));
    sleepH.push(miss ? null : +len.toFixed(2));
    bed.push(miss ? null : +(((b % 24) + 24) % 24).toFixed(2));
    wake.push(miss ? null : +((b + len) % 24).toFixed(2));
    hrv.push(miss ? null : +(46 + Math.sin(i / 5) * 7 + (R() - 0.5) * 12).toFixed(1));
    rhr.push(miss ? null : Math.round(62 + Math.cos(i / 6) * 3 + (R() - 0.5) * 5));
    mood.push(miss ? null : +clamp(Math.sin(i / 4) * 0.35 + (R() - 0.42) * 0.6, -1, 1).toFixed(2));
  }

  /* 最近 24 小时的心情读数：一两个小时一条，有的带词、有的不带 */
  var WORDS = ['满足', '安宁', '平静', '快乐', '有点累', '紧张'];
  var moods = [], v = 0.25;
  var stamp = function (t) {
    return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate())
         + 'T' + pad(t.getHours()) + ':' + pad(t.getMinutes());
  };
  for (var t = new Date(Date.now() - 23.2 * 3600 * 1000); t < new Date(Date.now() - 20 * 60 * 1000);
       t = new Date(t.getTime() + (60 + R() * 110) * 60 * 1000)) {
    v = clamp(v + (R() - 0.5) * 0.5, -0.8, 0.9);
    moods.push({t: stamp(t), v: +v.toFixed(2),
                labels: R() < 0.55 ? [WORDS[Math.floor(R() * WORDS.length)]] : []});
  }

  /* 周期：故意不是 28 天 —— 这块本来就不假设一个月一次 */
  var lastStart = new Date(today); lastStart.setDate(lastStart.getDate() - 23);
  var cycles = {last_start: iso(lastStart), gaps: [38, 45, 41, 52, 39]};

  function series(days) {
    var n = Math.max(1, Math.min(400, +days || 14));
    var take = function (arr) { var out = arr.slice(-n); while (out.length < n) out.unshift(null); return out; };
    var axis = [];
    for (var k = n - 1; k >= 0; k--) { var d2 = new Date(today); d2.setDate(d2.getDate() - k); axis.push(iso(d2)); }
    return {
      axis: axis,
      series: {steps: take(steps), sleep_h: take(sleepH), sleep_bed: take(bed), sleep_wake: take(wake),
               hrv_ms: take(hrv), resting_hr: take(rhr), mood: take(mood)},
      mood: moods,
      cycles: cycles
    };
  }

  function now() {
    var L = DAYS - 1;
    return {steps: steps[L], sleep_h: sleepH[L], resting_hr: rhr[L], hrv_ms: hrv[L],
            hr_now: 74, spo2: 97, resp_rate: 15, weight_kg: 51.6};
  }

  root.HEALTH_DEMO = {
    series: series,
    now: now,
    bio: {height: '163', weight: '51.6', born: '1999', sleepGoal: '8', stepGoal: '6000'},
    birthday: '04-20',
    /* 空态：什么都没有 */
    empty: {series: function () { return {axis: [], series: {}, mood: [], cycles: null}; },
            now: function () { return null; }}
  };
})(typeof self !== 'undefined' ? self : this);
