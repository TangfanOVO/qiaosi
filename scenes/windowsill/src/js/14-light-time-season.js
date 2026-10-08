/* ── 光 ── 太阳从窗外右上方斜着照进来，光斑往左落在桌子中间（窗框和树影都在里面）；
   窗洞是一块柔和的面光；台灯和蜡烛是屋里的暖光，夜里就只剩它们 */
const sun = new THREE.DirectionalLight('#fff3e0', 3); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
Object.assign(sun.shadow.camera, {left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 230});
sun.target.position.set(3, -6, -12);
const hemi = new THREE.HemisphereLight('#dfe9f0', '#b9a58a', .9); scene.add(hemi);
const fill = new THREE.DirectionalLight('#f6ebde', .7); fill.position.set(4, 10, 20); scene.add(fill);
const WCX = (WIN.x0 + WIN.x1) / 2, WCY = (WIN.y0 + WIN.y1) / 2;
const winLight = new THREE.RectAreaLight('#e6eef5', 2.4, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0); winLight.position.set(WCX, WCY, GLASS_Z + .1); winLight.lookAt(WCX, WCY, 10); scene.add(winLight);
candle.updateMatrixWorld(true);
const candleLight = new THREE.PointLight('#ffad5a', 0, 13.5, 1.15); candleLight.position.copy(candle.localToWorld(V(.05, CANDLE_HC + .32, .05))); candleLight.castShadow = true; candleLight.shadow.mapSize.set(512, 512); candleLight.shadow.bias = -.002; candleLight.shadow.camera.near = .3; scene.add(candleLight);   // 光就在火苗那儿（窗台板下面，不会漏到窗台上去）；蜡烛自己不挡自己的光
/* 夜里写字角那边只有电脑屏幕亮着：一小团冷白的光，跟中间蜡烛的暖光对着 */
const screenGlow = new THREE.RectAreaLight('#b9c6de', 0, 2.7, 1.75); laptop.updateMatrixWorld(true); screenGlow.position.copy(laptop.localToWorld(V(0, 1.07, -1.3))); screenGlow.lookAt(laptop.localToWorld(V(0, 1.38, -.35))); scene.add(screenGlow);   // 屏幕那么大一块面光，反光也是一块屏幕的形状

/* 天色三档；切换时慢慢过去 */
const TOD = {
  day:   {top: '#8299ad', mid: '#c6d0d3', bot: '#d3d7cf', fog: '#c9d1cf', sunDir: [.4, .66, -.62], sunCol: '#f6e4c8', sunI: 4.2, hemiI: .34, fillI: .34, hemiS: '#dfe9f0', hemiG: '#a88f72', winI: 1.4, winC: '#e8f0f6', lamp: 0, candle: .12, env: .3, flowerE: .2, city: 0, exp: 1.06, fogN: 110, fogF: 520, cLit: '#ffffff', cShd: '#a7b2c0', cloudA: .95, skySun: [.4, .66, -.62], glow: '#16120e', moon: 0, stars: 0, dark: 0},
  dusk:  {top: '#5f6e9c', mid: '#eaa889', bot: '#f2c79f', fog: '#e2b597', sunDir: [.82, .3, -.48], candle: .5, sunCol: '#ffae78', sunI: 2.3, hemiI: .55, fillI: .7, hemiS: '#e9c2b0', hemiG: '#7d6450', winI: .8, winC: '#f2c4a2', lamp: .55, env: .35, flowerE: .1, city: .45, exp: 1.05, fogN: 60, fogF: 400, cLit: '#ffc49c', cShd: '#7e6a8c', cloudA: .92, skySun: [.12, .05, -.99], glow: '#ff9a5c', moon: .2, stars: 0, dark: .4},
  night: {top: '#0b1222', mid: '#1b2742', bot: '#28324a', fog: '#1c2537', sunDir: [-.3, .7, -.64], candle: 1.5, sunCol: '#9fb2d4', sunI: .18, hemiI: .14, fillI: .06, hemiS: '#4a5878', hemiG: '#2a2622', winI: .22, winC: '#5a6c96', lamp: 1, env: .12, flowerE: .14, city: 1, exp: 1.0, fogN: 40, fogF: 480, cLit: '#56637f', cShd: '#161c2a', cloudA: .55, skySun: [0, -1, 0], glow: '#000000', moon: 1, stars: 1, dark: 1}
};
const cur = (() => { const t = TOD.day, o = {}; for (const k in t) o[k] = Array.isArray(t[k]) ? new THREE.Vector3(...t[k]) : typeof t[k] === 'string' ? new THREE.Color(t[k]) : t[k]; return o; })();
let tod = 'day';
const ENVB = [];   // 单独接了环境反光的材质（下面会填）
/* 天色跟着现在的时间走（默认开着）：几档之间按钟点慢慢混过去；太阳早上从左边升起，中午在窗前偏左高高的，傍晚落在正前方偏右一点的海面上。
   月亮的圆缺跟着真的日子。以后后端可以用 fuyue.setClock(时间) 塞一个时间进来（比如他那边的时间） */
const todDark = () => cur.dark;   // 桌宠那边有个同名的 cur，用这个取天黑没黑
const AUTO = {on: true, date: null, cur: null, at: -1, name: '白天'};
const TKEYS = [[0, 'night'], [4.9, 'night'], [5.8, 'dusk'], [7, 'day'], [16.4, 'day'], [17.7, 'dusk'], [18.7, 'dusk'], [19.7, 'night'], [24, 'night']];
const mixTod = (a, b, f) => { const o = {}; for (const k in a){ const va = a[k], vb = b[k]; o[k] = Array.isArray(va) ? va.map((v, i) => v + (vb[i] - v) * f) : typeof va === 'string' ? '#' + new THREE.Color(va).lerp(new THREE.Color(vb), f).getHexString() : va + (vb - va) * f; } return o; };
const moonPhase = d => { const syn = 29.530588853, age = (((d - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % syn + syn) % syn; return age / syn * Math.PI * 2; };   // 0 新月，π 满月
const autoTod = () => {
  let now = AUTO.date ? new Date(AUTO.date) : new Date(); if (isNaN(now)) now = new Date();   // 塞进来的时间看不懂，就用手机时间
  const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  let i = 0; while (i < TKEYS.length - 2 && h >= TKEYS[i + 1][0]) i++;
  const [h0, a] = TKEYS[i], [h1, b] = TKEYS[i + 1], f0 = Math.min(1, Math.max(0, (h - h0) / (h1 - h0))), o = mixTod(TOD[a], TOD[b], f0 * f0 * (3 - 2 * f0));
  const rise = 5.9, set = 18.2, fd = (h - rise) / (set - rise);
  if (fd > -.04 && fd < 1.04){
    const c = Math.min(1, Math.max(0, fd)), az = (-75 + 79 * c) * Math.PI / 180, el = Math.sin(Math.PI * c) * 56 * Math.PI / 180 - .035;
    const dir = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
    o.skySun = dir; if (fd > .03 && fd < .97){ const le = Math.max(el, .22); o.sunDir = [Math.sin(az) * Math.cos(le), Math.sin(le), -Math.cos(az) * Math.cos(le)]; }   // 屋里的光：太阳再低也按十几度算，影子别拖太长
  }
  AUTO.cur = o; AUTO.name = h < 4.9 || h >= 19.7 ? '夜里' : h < 7 ? '清晨' : h < 16.4 ? '白天' : h < 18.7 ? '傍晚' : '入夜';
  SKYU.phase.value = moonPhase(now.getTime());
};
autoTod(); if (AUTO.on) tod = 'auto';
function stepTod(k){
  const t = tod === 'auto' ? AUTO.cur : TOD[tod];
  for (const n in t){
    const v = t[n];
    if (Array.isArray(v)) cur[n].lerp(new THREE.Vector3(...v), k);
    else if (typeof v === 'string') cur[n].lerp(new THREE.Color(v), k);
    else cur[n] += (v - cur[n]) * k;
  }
  const u = SKYU; u.top.value.copy(cur.top); u.mid.value.copy(cur.mid); u.bot.value.copy(cur.bot); u.sunCol.value.copy(cur.sunCol); u.sunDir.value.copy(cur.skySun); u.glow.value.copy(cur.glow);
  const lum = .15 + .85 * (1 - Math.cos(u.phase.value)) / 2; u.moonK.value = cur.moon; u.starK.value = cur.stars * (1 - .5 * lum);   // 月亮越圆，星星越少
  SEA.uMoonK.value = cur.moon * lum;
  scene.fog.color.copy(cur.fog); scene.fog.near = cur.fogN; scene.fog.far = cur.fogF;
  sun.color.copy(cur.sunCol); sun.intensity = cur.sunI; sun.position.copy(sun.target.position).addScaledVector(cur.sunDir.clone().normalize(), 110);
  hemi.intensity = cur.hemiI; fill.intensity = cur.fillI; hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG);
  winLight.intensity = cur.winI; winLight.color.copy(cur.winC);
  scene.environmentIntensity = cur.env;
  CLOUDU.lit.value.copy(cur.cLit); CLOUDU.shd.value.copy(cur.cShd); CLOUDU.alpha.value = cur.cloudA; CLOUDU.fog.value.copy(cur.fog);
  SEA.uSun.value.copy(cur.skySun); SEA.uSunCol.value.copy(cur.sunCol); SEA.uSkyT.value.copy(cur.top); SEA.uSkyM.value.copy(cur.mid); SEA.uFog.value.copy(cur.fog);
  SEA.uFogN.value = cur.fogN * 1.4; SEA.uFogF.value = cur.fogF * 1.5; SEA.uLight.value = Math.min(1, cur.sunI / 4.2 * .85 + cur.hemiI * .6);
  headM.color.copy(cur.fog).lerp(cur.top, .12).multiplyScalar(.86);
  renderer.toneMappingExposure = cur.exp;
  for (const m of ENVB) m.envMapIntensity = m.userData.envb * cur.env;
}

/* ── 季节 ── */
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_NAME = {spring: '春 · 柳芽新绿', summer: '夏 · 柳荫', autumn: '秋 · 柳叶黄了', winter: '冬 · 只剩柳条'};
let season = 'spring';
function applySeason(){
  /* 柳：春天嫩黄绿带柳絮穗子；夏天深绿；秋天转黄、掉一半；冬天只剩金黄的光柳条 */
  const c = new THREE.Color(), dry = new THREE.Color('#9a7a3a');
  WL.leaves.visible = season !== 'winter'; WL.cats.visible = season === 'spring';
  WL.seed.forEach((r, i) => {
    const u = WL.uPos[i], r2 = (r * 7.31) % 1;
    if (season === 'spring') c.setHSL(.2 + r * .04 - u * .02, .5 + r * .2, .44 + r * .08 + u * .12);                  // 梢头新芽更嫩更黄
    else if (season === 'summer') c.setHSL(.25 + r * .05, .36 + r * .15, .26 + r * .08 + u * .05).lerp(dry, r2 < .04 ? .35 : 0);   // 偶尔一片早黄的
    else c.setHSL(.13 - r * .05 + (r2 < .3 ? .07 : 0), .58 + r * .15, .44 + r * .12).lerp(dry, r < .2 ? .45 : 0);   // 秋天黄绿夹杂
    WL.leaves.setColorAt(i, c);
  });
  WL.leaves.count = season === 'autumn' ? Math.floor(WL.n * .55) : WL.n; WL.leaves.instanceColor.needsUpdate = true;
  WL.twigM.color.set({spring: '#8a8a48', summer: '#6a6838', autumn: '#857640', winter: '#a88e50'}[season]);
  vaseFl.visible = season === 'spring'; (vaseTips.petals || []).forEach(p => p.visible = season === 'spring'); vaseBd.visible = season === 'winter'; vaseLf.visible = season === 'summer' || season === 'autumn';
  for (let i = 0; i < vaseLf.count; i++) vaseLf.setColorAt(i, c.setHSL(season === 'summer' ? .26 : .1, season === 'summer' ? .4 : .6, season === 'summer' ? .34 : .5));
  vaseLf.instanceColor.needsUpdate = true;
  FALL.reset();
}

