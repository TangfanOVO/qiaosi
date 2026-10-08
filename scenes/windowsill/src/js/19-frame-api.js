/* ── 每一帧 ── */
const clock = new THREE.Clock();
applySeason(); stepTod(1);
let hold = false, instant = false, lowQ = false, ftAcc = 0, ftN = 0;
/* 凑近看手机屏幕的时候，临时把画面分辨率提到手机屏幕本来的清晰度（字是一个个像素画出来的，分辨率不够就糊）；退出来再降回去 */
let crispOn = false;
const stepCrisp = () => {
  const want = focusKey === 'phone' && focusT > .97 && phoneFlip.v > .97;
  if (want === crispOn) return; crispOn = want;
  const pr = want ? Math.min(window.devicePixelRatio || 1, 2.6) : (lowQ ? 1 : DPR);
  renderer.setPixelRatio(pr); composer.setPixelRatio(pr); resize();
};
const goLowQ = () => { lowQ = true; gtao.enabled = false; renderer.setPixelRatio(1); composer.setPixelRatio(1); resize(); sun.shadow.mapSize.set(1024, 1024); sun.shadow.map?.dispose(); sun.shadow.map = null; };   // 设备跑不动时降一档
function frame(){
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  const k = instant ? 1 : 1 - Math.exp(-dt * 2.2);
  if (!hold) viewT += ((view) - viewT) * (instant ? 1 : 1 - Math.exp(-dt * 1.6));
  if (Math.abs(view - viewT) < .0005) viewT = view;
  if (!down && panV){ panTo = Math.max(-1, Math.min(1, panTo + panV * dt)); panV *= Math.exp(-dt * 5); if (Math.abs(panV) < .01) panV = 0; }
  pan += (panTo - pan) * (instant ? 1 : 1 - Math.exp(-dt * 7));
  focusT += ((focusKey ? 1 : 0) - focusT) * (instant ? 1 : 1 - Math.exp(-dt * 2.4)); if (Math.abs(focusT - (focusKey ? 1 : 0)) < .001) focusT = focusKey ? 1 : 0;
  stepCandle(dt, t); stepPhone(dt); stepSteam(dt, t); stepNP(dt); stepCrisp();
  stepTod(instant ? 1 : 1 - Math.exp(-dt * 1.5));
  if (tod === 'auto' && t - AUTO.at > 1){ AUTO.at = t; const nm = AUTO.name; autoTod(); if (nm !== AUTO.name) syncWxUI(); }   // 跟着钟点：一秒算一次
  stepWeather(dt, t); SKYU.uT.value = t; LIFE.step(dt, t);
  WIND.uT.value += dt * (.55 + 1.8 * WX.windS); SEA.uT.value = window.__seaT ?? (t % 1000);
  placeCamera(viewT);
  // 风铃、鸟、电车、CD
  stepFurin(t, dt);
  for (const c of clouds){ c.position.x += dt * (1 + 14 * WX.windS); if (c.position.x > 700) c.position.x -= 1400; }
  FALL.step(dt, t);
  PET.tick(dt); QS.step(dt, t); cardShadow.update(cur.sunDir, Math.max(0, Math.min(1, (cur.sunI - .4) / 3.2)) * .85);
  placeTags();
  glassSync(); grade.uniforms.time.value = t % 10; grade.uniforms.dark.value = cur.dark;
  composer.render();
  instant = false;
  // 手机跑不动就降一档：分辨率降到 1，影子图减半
  if (!lowQ && t > 2){ ftAcc += dt; ftN++; if (ftN >= 90){ if (ftAcc / ftN > 1 / 34) goLowQ(); ftAcc = 0; ftN = 0; } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* 自查截图用 */
/* ── 给前后端接的口：页面外面拿到数据以后调这几个就行 ──
   fuyue.setNotes(['…','…','…'])                 留言板上的三张便签（最近三条碎碎念）
   fuyue.setNowPlaying({title, artist, dur, pos, playing, lyrics: [{t: 秒, text}]})   电脑上一起听的歌
   fuyue.setBookPage({left, right, title, pages: ['214', '215']})                   摊开的书正翻在哪一页
   fuyue.setSpace('最新一条动态里的一句话')                                          风铃纸笺换字、荡一下 */
window.fuyue = {
  setSpace(text){ const t = furin.userData.tz; furinPaint(t.image.getContext('2d'), 128, 512, text || ''); t.needsUpdate = true; swingFurin(.8); },   // 空间有新动态：纸笺换成那一句，风铃荡一下
  setNotes(list){ (list || []).slice(0, NOTE_TEX.length).forEach((t, i) => NOTE_TEX[i].userData.set(t)); },
  setNowPlaying(o){ Object.assign(NP, o || {}); NP.acc = 1; },
  /* 天色、天气接后端：
     fuyue.setClock('2026-10-03T19:30:00')   用这个时间来算天色（不传就用手机自己的时间）；fuyue.setClock(null) 回到手机时间
     fuyue.setAuto(true/false)               天色跟不跟着时间走
     fuyue.setWeather({wind: 0~1, rain: 0~1, snow: 0~1, thunder: 0~1})   或者直接给天气预报的数：{windMs: 米/秒, rainMmH: 毫米/小时, snowCmH: 厘米/小时, thunder: true}
     fuyue.setFootprints(true/false)         沙滩上那串脚印（比如他出门了才有） */
  setClock(d){ AUTO.date = d || null; if (tod === 'auto') autoTod(); },
  setAuto(on){ AUTO.on = !!on; if (on){ autoTod(); tod = 'auto'; } else if (tod === 'auto') tod = 'day'; syncWxUI(); },
  setWeather(o = {}){ const c = v => Math.max(0, Math.min(1, v));
    if (o.windMs !== undefined) o.wind = c(o.windMs / 17); if (o.rainMmH !== undefined) o.rain = c(Math.sqrt(o.rainMmH / 20)); if (o.snowCmH !== undefined) o.snow = c(Math.sqrt(o.snowCmH / 4)); if (typeof o.thunder === 'boolean') o.thunder = o.thunder ? .7 : 0;
    for (const k of ['wind', 'rain', 'snow', 'thunder']) if (typeof o[k] === 'number') WXS[k] = c(o[k]); WXS.autoSnow = false; syncWxUI(); },
  setFootprints(on){ SANDU.steps.value = on ? 1 : 0; },
  setBookPage(o){ const {left = '', right = '', title = '', pages = ['', '']} = o || {}; BOOK_PAGES[0].userData.set(left, '', pages[0]); BOOK_PAGES[1].userData.set(right, title, pages[1]); }
};
window.__fy = {
  set(o){ if (o.season) setSeason(o.season); if (o.tod){ AUTO.on = o.tod === 'auto'; if (o.date) AUTO.date = o.date; if (AUTO.on) autoTod(); tod = o.tod; } if (o.wx){ Object.assign(WXS, o.wx); wxJump(); } syncWxUI(); if (o.view !== undefined){ setView(o.view); viewT = o.view; } if (o.pan !== undefined){ pan = panTo = o.pan; } if (o.focus !== undefined){ if (o.focus) focus(o.focus); else unfocus(); focusT = o.focus ? 1 : 0; phoneFlip.v = phoneFlip.to; phoneFlip.t = 1; } if (o.vt !== undefined){ viewT = o.vt; hold = true; } else hold = false; instant = true; },
  obj(k){ return BYKEY[k].obj; },
  spin(){ QS.spin(); },
  qs(){ return {t: QS.t, rz: qsSpin.rotation.z, y: qsSpin.position.y}; },
  state(){ return {flip: phoneFlip.v, flipTo: phoneFlip.to, focusKey, focusT, view, viewT, pan, body: document.body.className, card: CARD.className}; },
  tags(){ return TAGS.map(t => t.key + ':' + (t.el.classList.contains('hide') ? '-' : '+') + ':' + t.el.style.transform); },
  lowq(){ goLowQ(); },
  tapKey(k){ instant = false; focus(k); },
  swing(){ swingFurin(); },
  tapAt(x, y){ tap(x, y); return {focusKey, view}; },
  warm(sec){ for (let i = 0; i < sec * 30; i++) FALL.step(1 / 30, i / 30); },
  topMap(){ renderTop(); const b = new Uint8Array(512 * 288 * 4); renderer.readRenderTargetPixels(topRT, 0, 0, 512, 288, b); const c = document.createElement('canvas'); c.width = 512; c.height = 288; const x = c.getContext('2d'), im = x.createImageData(512, 288); for (let y = 0; y < 288; y++) for (let i = 0; i < 512; i++){ const s = ((287 - y) * 512 + i) * 4, d = (y * 512 + i) * 4, v = b[s]; im.data[d] = im.data[d + 1] = im.data[d + 2] = v; im.data[d + 3] = 255; } x.putImageData(im, 0, 0); return c.toDataURL(); },
  camera, scene, THREE, tips: tips.length + '/' + WL.n, segs: segs.length, tipList: tips, segList: segs
};
