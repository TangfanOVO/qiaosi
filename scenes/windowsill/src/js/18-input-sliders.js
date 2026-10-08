/* ── 手势：左右拖转椅子、上滑抬头、下滑低头、点东西推过去；点空处 / 下滑 / 退回 回来 ── */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); ray.layers.enable(1);   // 玻璃、亚克力挪到了第 1 层，照样点得到
const toast = document.getElementById('toast'); let toastT = 0;
const say = s => { toast.textContent = s; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 2200); };
const CARD = document.getElementById('card'), BACK = document.getElementById('back'), HEADEL = document.getElementById('head'), HINT = document.getElementById('hint'), CTLBTN = [...CTL.querySelectorAll(':scope > button')];
function setView(v){
  if (focusKey) unfocus();
  view = v; document.getElementById('cView').textContent = v ? '低头看桌上 ↓' : '抬头看窗外 ↑';
  hint.classList.add('off');
}
function focus(key){
  const t = BYKEY[key]; if (!t || !t.obj || t.noFocus) return;
  const s = shotFor(t);
  if (focusKey && focusKey !== key && focusT > .3 && !reduce){ SW.fp.copy(cFP); SW.ft.copy(cFT); SW.ff.copy(cFF); SW.fov = cFOV; SW.lift = Math.min(1.6, Math.max(.4, cFP.distanceTo(s.pos) * .14)); SW.t0 = performance.now(); }
  else { SW.fp.copy(s.pos); SW.ft.copy(s.tgt); SW.ff.copy(s.focus); SW.fov = s.fov; SW.t0 = 0; }
  FP.copy(s.pos); FT.copy(s.tgt); FF.copy(s.focus); FFOV = s.fov;
  focusKey = key;
  document.getElementById('k-lab').textContent = t.lab; document.getElementById('k-title').textContent = t.fn;
  document.getElementById('k-sub').textContent = t.name; document.getElementById('k-note').textContent = t.note; document.getElementById('k-go-t').textContent = t.go;
  CARD.classList.add('on'); BACK.classList.add('on'); document.body.classList.add('focused'); hint.classList.add('off');
  flipPhone(key === 'phone');
}
function unfocus(){ flipPhone(false); CARD._closedAt = performance.now(); focusKey = null; CARD.classList.remove('on'); BACK.classList.remove('on'); document.body.classList.remove('focused'); }
BACK.onclick = unfocus;
document.getElementById('k-go').onclick = () => { if (focusKey === 'pet'){ PET.next(); return; } if (focusKey === 'quick'){ QS.spin(); return; } if (focusKey === 'candle'){ blowCandle(); return; } if (focusKey === 'maple'){ window.open('https://github.com/TangfanOVO', '_blank', 'noopener'); return; } say('草稿里先不跳转，之后接到真功能'); };
function tap(lx, ly){
  ndc.set(lx / VW() * 2 - 1, -(ly / VH()) * 2 + 1); ray.setFromCamera(ndc, camera);
  /* 先看手指正对着的第一样“实在的东西”（桌子、墙、窗台、书堆都算，会挡住后面的东西；光晕、热气、烟、窗玻璃不算）。
     它本身能点就是它；点到的是空桌面、墙这些，再看是不是落在某样小东西周围很窄的一圈里（而且那圈不能在挡住的东西后面） */
  const first = (x, y) => { ndc.set(x / VW() * 2 - 1, -(y / VH()) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects([room, things], true).find(h => pickable(h.object)); };
  let hit = first(lx, ly); if (hit && !hit.object.userData.key) hit = null;
  if (!hit){   // 手指没正好落在东西上：在手指周围一小圈（十几个像素）里再看看，挨得最近、被点中次数最多的那样东西才算
    const votes = {};
    for (const [rad, w] of [[8, 2], [16, 1], [26, 1]]) for (let k = 0; k < 8; k++){ const a = k / 8 * Math.PI * 2, h = first(lx + Math.cos(a) * rad, ly + Math.sin(a) * rad), key = h && h.object.userData.key; if (key && BYKEY[key] && !!BYKEY[key].out === !!view) votes[key] = (votes[key] || 0) + w; }
    const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 2) hit = {object: {userData: {key: best[0]}}};
  }
  ndc.set(lx / VW() * 2 - 1, -(ly / VH()) * 2 + 1); ray.setFromCamera(ndc, camera);
  if (hit && hit.object.userData.key === 'quick'){ QS.spin(); if (focusKey !== 'quick') focus('quick'); return; }
  if (hit && hit.object.userData.key === 'space'){ swingFurin(); if (focusKey !== 'space') focus('space'); return; }   // 碰一下风铃就荡
  if (hit && hit.object.userData.key === 'candle' && focusKey === 'candle'){ blowCandle(); return; }
  if (hit && hit.object.userData.key === 'phone' && focusKey === 'phone'){ flipPhone(phoneFlip.to < .5); return; }
  if (focusKey){ if (hit && hit.object.userData.key === 'pet' && focusKey === 'pet'){ PET.next(); return; } if (!hit || hit.object.userData.key === focusKey) unfocus(); else focus(hit.object.userData.key); return; }
  if (hit){ const t = BYKEY[hit.object.userData.key]; if (!!t.out === !!view) return focus(t.key); }
  // 点到窗户就抬头；抬头时点下半屏回到桌上
  const o = ray.ray.origin, d = ray.ray.direction, k = (GLASS_Z - o.z) / d.z, px = o.x + d.x * k, py = o.y + d.y * k;
  if (!view && k > 0 && px > WIN.x0 && px < WIN.x1 && py > WIN.y0 && py < WIN.y1) setView(1);
  else if (view && ly > VH() * .72) setView(0);
}
let down = null;
canvas.addEventListener('pointerdown', e => { if (!framed && WXP.classList.contains('on')){ WXP.classList.remove('on'); cWx.setAttribute('aria-expanded', false); } const [x, y] = local(e); down = {x, y, lx: x, lt: performance.now(), pan0: panTo, mode: ''}; panV = 0; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!down) return; const [x, y] = local(e), dx = x - down.x, dy = y - down.y;
  if (!down.mode && Math.hypot(dx, dy) > 8) down.mode = Math.abs(dx) > Math.abs(dy) ? 'pan' : 'tilt';
  if (down.mode === 'pan' && !view && !focusKey){
    panTo = Math.max(-1, Math.min(1, down.pan0 - dx / (VW() * .55)));
    const now = performance.now(); panV = -(x - down.lx) / (VW() * .55) / Math.max(.008, (now - down.lt) / 1000); down.lx = x; down.lt = now;
    hint.classList.add('off');
  }
});
canvas.addEventListener('pointerup', e => {
  if (!down) return; const [x, y] = local(e), dy = y - down.y;
  if (down.mode === 'tilt' && Math.abs(dy) > 50){ if (focusKey) unfocus(); else setView(dy < 0 ? 1 : 0); }
  else if (!down.mode) tap(x, y);
  if (down.mode !== 'pan') panV = 0;
  down = null;
});
canvas.addEventListener('pointercancel', () => { down = null; panV = 0; });
canvas.addEventListener('wheel', e => {
  if (focusKey) return;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)){ if (!view) panTo = Math.max(-1, Math.min(1, panTo + e.deltaX / 500)); }
  else if (Math.abs(e.deltaY) > 20) setView(e.deltaY > 0 ? 1 : 0);
}, {passive: true});
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;   // 在拉杆上按方向键是在调拉杆，不是转椅子
  if (e.key === 'Escape' && focusKey) unfocus();
  if (focusKey) return;
  if (e.key === 'ArrowLeft' && !view) panTo = Math.max(-1, panTo - .5);
  if (e.key === 'ArrowRight' && !view) panTo = Math.min(1, panTo + .5);
  if (e.key === 'ArrowUp') setView(1); if (e.key === 'ArrowDown') setView(0);
});

const hint = document.getElementById('hint');
setTimeout(() => hint.classList.add('off'), 7000);
document.getElementById('cView').onclick = () => setView(view ? 0 : 1);
const TOD_NAME = {day: '白天', dusk: '傍晚', night: '夜里'}, TODS = ['day', 'dusk', 'night'];
/* ── 拉杆：季节、天色、风、雨、雪、雷。拉到哪儿是“目标”，画面慢慢跟过去 ── */
const WXP = document.getElementById('wxp'), cAuto = document.getElementById('cAuto'), cWx = document.getElementById('cWx');
const SL = {season: 'sSeason', tod: 'sTod', wind: 'sWind', rain: 'sRain', snow: 'sSnow', thunder: 'sThun'};
for (const k in SL) SL[k] = document.getElementById(SL[k]);
const WX_WORD = {
  wind: v => v < .04 ? '没风' : v < .2 ? '微风' : v < .42 ? '和风' : v < .66 ? '大风' : v < .86 ? '烈风' : '狂风',
  rain: v => v < .02 ? '—' : v < .25 ? '细雨' : v < .5 ? '小雨' : v < .75 ? '中雨' : v < .92 ? '大雨' : '暴雨',
  snow: v => v < .02 ? '—' : v < .3 ? '小雪' : v < .6 ? '中雪' : v < .85 ? '大雪' : '暴雪',
  thunder: v => v < .02 ? '—' : v < .4 ? '远雷' : v < .75 ? '雷阵' : '雷暴'
};
const SEASON_SHORT = {spring: '春', summer: '夏', autumn: '秋', winter: '冬'};
const syncWxUI = () => {
  const autoOn = tod === 'auto', todIdx = autoOn ? ({'白天': 0, '夜里': 2}[AUTO.name] ?? 1) : TODS.indexOf(tod), todName = autoOn ? AUTO.name : TOD_NAME[tod];
  SL.season.value = SEASONS.indexOf(season); SL.tod.value = todIdx; cAuto.setAttribute('aria-pressed', autoOn);
  SL.wind.value = Math.round(WXS.wind * 100); SL.rain.value = Math.round(WXS.rain * 100); SL.snow.value = Math.round(WXS.snow * 100); SL.thunder.value = Math.round(WXS.thunder * 100);
  for (const k in SL){ const i = SL[k]; i.style.setProperty('--p', (i.value - i.min) / (i.max - i.min) * 100 + '%'); }
  SL.season.nextElementSibling.textContent = SEASON_SHORT[season]; SL.tod.nextElementSibling.textContent = todName;
  for (const k of ['wind', 'rain', 'snow', 'thunder']) SL[k].nextElementSibling.textContent = WX_WORD[k](WXS[k]);
  const now = WXS.thunder > .02 ? (WXS.rain > .02 ? '雷雨' : '打雷') : WXS.rain > .02 && WXS.snow > .02 ? '雨夹雪' : WXS.rain > .02 ? WX_WORD.rain(WXS.rain) : WXS.snow > .02 ? WX_WORD.snow(WXS.snow) : WX_WORD.wind(WXS.wind);
  cWx.textContent = `${SEASON_SHORT[season]} · ${todName} · ${now}`;
};
const setSeason = s => {
  if (s === season) return;
  if (season === 'winter' && WXS.autoSnow){ WXS.snow = 0; WXS.autoSnow = false; }           // 离开冬天：冬天自带的那场雪停了
  season = s; applySeason();
  if (s === 'winter' && WXS.snow < .02 && WXS.rain < .02){ WXS.snow = .4; WXS.autoSnow = true; }   // 到了冬天、又没别的天气：下一场中雪
};
SL.season.oninput = () => { setSeason(SEASONS[+SL.season.value]); syncWxUI(); };
SL.tod.oninput = () => { AUTO.on = false; tod = TODS[+SL.tod.value]; syncWxUI(); };   // 自己拉了天色，就不再跟着钟点
cAuto.onclick = () => { AUTO.on = tod !== 'auto'; if (AUTO.on){ autoTod(); tod = 'auto'; } else tod = TODS[+SL.tod.value]; syncWxUI(); };
for (const k of ['wind', 'rain', 'snow', 'thunder']) SL[k].oninput = () => { WXS[k] = SL[k].value / 100; if (k === 'snow') WXS.autoSnow = false; syncWxUI(); };
cWx.onclick = () => { const on = !WXP.classList.contains('on'); WXP.classList.toggle('on', on); cWx.setAttribute('aria-expanded', on); };   // 手机上：点一下摊开拉杆，点画面收起来
syncWxUI();
document.getElementById('cLab').onclick = e => { labsOn = !labsOn; LABS.classList.toggle('off', !labsOn); e.currentTarget.textContent = labsOn ? '标注 开' : '标注 关'; e.currentTarget.setAttribute('aria-pressed', labsOn); };

