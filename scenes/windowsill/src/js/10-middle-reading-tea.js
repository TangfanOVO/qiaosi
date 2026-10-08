/* ═════ 中间：读书喝茶 ═════ */
// 两本书上一只深色陶盘，盘里一支粗蜡烛（晚安：点一下吹灭，就是说了晚安；再点一下重新点上）
// 蜡烛顶上烧出一个浅浅的蜡池，边沿高低不平，侧面挂着几道蜡泪；火苗分三层（外焰、焰心、底下一点蓝），会轻轻晃
const candle = G(); let flame, flameCore, halo, candleOn = 1, candleTo = 1; const smoke = []; {
  const st = stackOf([[2.2, .3, 1.55, '#857a69', .06], [1.9, .26, 1.35, '#474a41', -.1]]); at(st, 2.15, 0, -2.45); add(st, null);
  candle.add(mesh(lathe([[0, 0], [.62, 0], [.7, .04], [.74, .1], [.7, .12], [.6, .06], [0, .05]], 48), ceramic));   // 陶盘
  // 蜡烛本体：外圈 r .36，高 .95；顶上往里凹一个蜡池
  const R = .36, Hc = .95, prof = [[0, .05], [R, .05], [R, Hc - .04], [R - .01, Hc], [R - .05, Hc - .02], [R - .12, Hc - .07], [.06, Hc - .09], [0, Hc - .09]];
  const wg = lathe(prof, 64), wp = wg.attributes.position;
  for (let i = 0; i < wp.count; i++){ const x = wp.getX(i), y = wp.getY(i), z = wp.getZ(i), a = Math.atan2(z, x); if (y > Hc - .06 && Math.hypot(x, z) > R - .06) wp.setY(i, y + .06 * Math.sin(a * 3 + 1) + .035 * Math.sin(a * 7)); }
  wg.computeVertexNormals(); { const uv = wg.attributes.uv; for (let i = 0; i < wp.count; i++) uv.setY(i, Math.min(1, Math.max(0, wp.getY(i) / Hc))); }   // 自发光图按高度贴
  // 蜡是半透的：越靠近火苗，被火从里面照得越亮（用一张从下到上渐亮的自发光图来做）
  const waxE = tex(4, 128, (x, w, h) => { const g = x.createLinearGradient(0, h, 0, 0); g.addColorStop(0, '#3a2010'); g.addColorStop(.5, '#5c3218'); g.addColorStop(.8, '#8a4a22'); g.addColorStop(.93, '#b06a34'); g.addColorStop(1, '#d68a50'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  waxE.wrapS = THREE.RepeatWrapping;
  M.wax = new THREE.MeshPhysicalMaterial({color: '#e6dac8', roughness: .55, sheen: .3, emissive: new THREE.Color('#ffffff'), emissiveMap: waxE, emissiveIntensity: 0});
  const body = mesh(wg, M.wax, 0, 0, 0); body.userData.noCast = true; candle.add(body);
  M.waxDrip = new THREE.MeshPhysicalMaterial({color: '#e6dac8', roughness: .5, sheen: .3, emissive: new THREE.Color('#ff9a50'), emissiveIntensity: 0});
  for (const m of [M.wax, M.waxDrip]){ m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = min(gl_FragColor.rgb, vec3(1.35, 1.1, .85));\n#include <tonemapping_fragment>'); }; m.customProgramCacheKey = () => 'waxclamp'; }   // 蜡离火太近，亮度封个顶：亮，但不会糊成一团白
  // 顶上被火照透的一圈（夜里看得见蜡是半透明的）
  M.waxGlow = new THREE.MeshBasicMaterial({color: '#ffb766', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false});
  // 蜡泪
  for (const [a, L] of [[.6, .32], [2.1, .5], [3.4, .22], [4.6, .4], [5.5, .28]]){
    const d = mesh(new THREE.CapsuleGeometry(.035, L, 4, 8), M.waxDrip, Math.cos(a) * (R - .005), Hc - .05 - L / 2, Math.sin(a) * (R - .005)); d.userData.noCast = true; candle.add(d);
    const drop = mesh(new THREE.SphereGeometry(.05, 10, 8), M.waxDrip, Math.cos(a) * (R + .01), Hc - .08 - L, Math.sin(a) * (R + .01)); drop.scale.y = .8; drop.userData.noCast = true; candle.add(drop);
  }
  // 烛芯：一根弯着的黑线，尖上一点红
  candle.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, Hc - .09, 0), V(.005, Hc - .01, 0), V(.025, Hc + .06, .005), V(.05, Hc + .1, .01)]), 12, .011, 5), std('#1a1614', .9)));
  M.ember = new THREE.MeshBasicMaterial({color: new THREE.Color('#ff5a1e').multiplyScalar(2)});
  candle.add(mesh(new THREE.SphereGeometry(.016, 8, 6), M.ember, .05, Hc + .1, .01));
  // 火苗：两张一直朝着镜头的贴图——外焰（橙、上尖下圆、底部一点蓝）和焰心（白黄）
  const flameTex = tex(64, 160, (x, w, h) => {
    const sh = (s, c0, c1, c2) => { x.save(); x.translate(w / 2, h * .78); x.scale(s, 1); const g = x.createRadialGradient(0, 0, 2, 0, -h * .2, h * .6); g.addColorStop(0, c0); g.addColorStop(.35, c1); g.addColorStop(1, c2); x.fillStyle = g;
      x.beginPath(); x.moveTo(0, -h * .74); x.bezierCurveTo(w * .36, -h * .4, w * .36, h * .06, 0, h * .12); x.bezierCurveTo(-w * .36, h * .06, -w * .36, -h * .4, 0, -h * .74); x.fill(); x.restore(); };
    sh(1, 'rgba(255,214,140,1)', 'rgba(255,150,60,.85)', 'rgba(255,90,20,0)');
    x.globalCompositeOperation = 'lighter'; const b = x.createRadialGradient(w / 2, h * .86, 1, w / 2, h * .86, 14); b.addColorStop(0, 'rgba(120,150,255,.55)'); b.addColorStop(1, 'rgba(80,110,255,0)'); x.fillStyle = b; x.fillRect(0, 0, w, h);
  });
  const coreTex = tex(64, 160, (x, w, h) => { const g = x.createRadialGradient(w / 2, h * .66, 1, w / 2, h * .6, h * .32); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(.5, 'rgba(255,236,180,.8)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  flame = new THREE.Sprite(new THREE.SpriteMaterial({map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(1.5, 1.5, 1.5)}));
  flame.center.set(.5, .2); flame.scale.set(.2, .5, 1); flame.position.set(.05, Hc + .07, .01); flame.layers.set(1); candle.add(flame);
  flameCore = new THREE.Sprite(new THREE.SpriteMaterial({map: coreTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color(1.6, 1.6, 1.6)}));
  flameCore.center.set(.5, .2); flameCore.scale.set(.1, .28, 1); flameCore.position.set(.05, Hc + .08, .01); flameCore.layers.set(1); candle.add(flameCore);
  const gl = tex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,190,110,.6)'); g.addColorStop(.25, 'rgba(255,160,70,.16)'); g.addColorStop(1, 'rgba(255,140,50,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  halo = new THREE.Sprite(new THREE.SpriteMaterial({map: gl, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .7})); halo.scale.setScalar(.7); halo.position.set(.05, Hc + .3, .01); halo.layers.set(1); candle.add(halo);   // 光晕圈在火苗上，不罩着整根蜡烛
  // 吹灭以后冒起来的一缕烟
  const smT = tex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(210,205,200,.5)'); g.addColorStop(1, 'rgba(200,195,190,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  for (let i = 0; i < 18; i++){ const s = new THREE.Sprite(new THREE.SpriteMaterial({map: smT, transparent: true, depthWrite: false, opacity: 0})); s.layers.set(1); s.userData.t = -99; candle.add(s); smoke.push(s); }
  candle.position.set(2.15, .56, -2.45); add(candle, 'candle');
}
const CANDLE_HC = .95;
const blowCandle = () => {
  candleTo = candleTo > .5 ? 0 : 1;
  if (!candleTo) smoke.forEach((s, i) => { s.userData.t = -i * .12; s.position.set(.05, CANDLE_HC + .1, .01); });
  say(candleTo ? '蜡烛点上了' : '晚安');
};
const stepCandle = (dt, t) => {
  candleOn += (candleTo - candleOn) * (1 - Math.exp(-dt * (candleTo ? 3 : 9)));
  const fl = 1 + .12 * Math.sin(t * 13) * Math.sin(t * 7.3) + .06 * Math.sin(t * 23), sw = Math.sin(t * 2.3) * .015 + Math.sin(t * 5.1) * .008;
  for (const f of [flame, flameCore]){ f.visible = candleOn > .02; f.material.opacity = candleOn; }
  flame.scale.set(.2 * (.6 + .4 * candleOn), .5 * fl * candleOn, 1); flameCore.scale.set(.1, .28 * fl * candleOn, 1);
  flame.position.x = .05 + sw; flameCore.position.x = .05 + sw * .6;
  halo.material.opacity = .32 * candleOn * fl; M.wax.emissiveIntensity = 1.0 * candleOn * Math.min(1.1, .35 + cur.candle * .45); M.waxDrip.emissiveIntensity = .05 * candleOn * cur.candle;
  M.ember.color.setRGB(2 * (.3 + .7 * candleOn), .45 * (.3 + .7 * candleOn), .15);
  candleLight.intensity = cur.candle * 21 * fl * candleOn;   // 火苗本身收着点，光往外铺得更开：桌上、书、墙都该被它照到
  screenGlow.intensity = cur.lamp * 5 * (1 + .03 * Math.sin(t * 1.7));
  for (const s of smoke){
    if (s.userData.t < -50) continue; s.userData.t += dt; const u = s.userData.t;
    if (u < 0){ s.material.opacity = 0; continue; }
    if (u > 4){ s.material.opacity = 0; s.userData.t = -99; continue; }
    s.position.set(.05 + Math.sin(u * 2.2 + s.id) * .06 * u, CANDLE_HC + .12 + u * .55, .01 + Math.cos(u * 1.7) * .03 * u);
    s.scale.setScalar(.08 + u * .16); s.material.opacity = .35 * (1 - u / 4) * Math.min(1, u * 3);
  }
};
// 亚麻桌布：中间这一块的“底”
{
  const g = new THREE.PlaneGeometry(4.6, 7.2, 1, 1); g.rotateX(-Math.PI / 2);
  const m = mesh(g, new THREE.MeshStandardMaterial({map: linenTex, roughness: .95, alphaTest: .5, side: THREE.DoubleSide}), 3.5, .012, .8);
  m.rotation.y = Math.PI / 2 + .07; m.receiveShadow = true; things.add(m);
}
// 压在下面的书 + 摊开的书（共读）
{ const u = bookFlat(2.6, .36, 3.5, '#353b41'); at(u, 3.5, .015, .95, -.32); add(u, null); }
const book = G(); {
  const W = 1.75, D = 2.5, cover = coverMat('#474a41');
  book.add(mesh(new RoundedBoxGeometry(W * 2 + .22, .06, D + .2, 2, .02), cover, 0, .03, 0));
  const lift = (u) => .07 + .17 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, u * 1.05))), .55) * (1 - .25 * u);
  for (const s of [-1, 1]){
    const sh = new THREE.Shape(); sh.moveTo(0, .05); for (let i = 0; i <= 20; i++){ const u = i / 20; sh.lineTo(s * u * W, lift(u) + .03); } sh.lineTo(s * W, .05); sh.lineTo(0, .05);
    const blk = new THREE.ExtrudeGeometry(sh, {depth: D, bevelEnabled: false}); blk.translate(0, 0, -D / 2);
    book.add(mesh(blk, std('#ede4d2', .9)));
    const pg = new THREE.PlaneGeometry(W, D, 24, 1), pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++){ const u = pp.getX(i) / W + .5; pp.setXYZ(i, s * u * W, lift(u) + .031, -pp.getY(i)); }
    pg.computeVertexNormals(); if (s < 0){ const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    const ptx = pageTex(s, s > 0 ? '五　十' : ''); BOOK_PAGES[s > 0 ? 1 : 0] = ptx; book.add(mesh(pg, new THREE.MeshStandardMaterial({map: ptx, roughness: .9, side: THREE.DoubleSide})));
  }
  book.position.set(3.35, .39, 1.05); book.rotation.y = .1; add(book, 'book');
}
// 茶（健康）
// 一杯茶（健康）：照连环那只品茗杯做——哥窑那种月白釉，开片是“金丝铁线”：粗的一层深铁色，细的一层泛金；
// 圈足不上釉，露一圈米褐色的胎；同釉的浅托；杯里大半杯琥珀色的茶，贴杯壁一圈稍亮（弯月面）；上面两缕热气
const mug = G(), STEAM_T = {value: 0}; let steamG; {
  const tr = mkRng(4242), R = (a, b) => a + tr() * (b - a);
  const crackTex = (base, foot) => tex(512, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++){ g.fillStyle = `rgba(${tr() < .5 ? '255,255,250' : '110,104,90'},${R(.02, .05)})`; g.beginPath(); g.ellipse(R(0, w), R(0, h), R(20, 70), R(10, 30), 0, 0, 6.29); g.fill(); }
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const layer = (cw, ch, dark, width) => { const nx = Math.round(w / cw), ny = Math.ceil(h / ch) + 1, P = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) P.push([(i + .15 + tr() * .7) * cw, (j + .15 + tr() * .7) * ch]);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
        const ci = Math.floor(x / cw), cj = Math.floor(y / ch); let d1 = 1e9, d2 = 1e9;
        for (let dj = -1; dj <= 1; dj++){ const jj = cj + dj; if (jj < 0 || jj >= ny) continue;
          for (let di = -1; di <= 1; di++){ const p = P[jj * nx + ((ci + di) % nx + nx) % nx]; let dx = x - p[0]; if (dx > w / 2) dx -= w; else if (dx < -w / 2) dx += w;
            const dd = Math.hypot(dx, y - p[1]); if (dd < d1){ d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd; } }
        const e = Math.max(0, 1 - (d2 - d1) * .5 / width); if (e <= 0) continue; const k = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) d[k + c] *= 1 - e * dark[c]; } };
    layer(58, 34, [.52, .55, .58], 1.15);   // 铁线：粗、深
    layer(21, 13, [.04, .13, .34], .75);    // 金丝：细、泛金
    g.putImageData(img, 0, 0);
    if (foot){ const gr = g.createLinearGradient(0, h * (1 - foot) - 6, 0, h * (1 - foot) + 2); gr.addColorStop(0, 'rgba(150,118,86,0)'); gr.addColorStop(1, 'rgba(150,118,86,1)'); g.fillStyle = gr; g.fillRect(0, h * (1 - foot) - 6, w, h); }   // 圈足露胎
  });
  // 按弧长给贴图坐标，开片不会在弯的地方挤成一团
  const lathe2 = (pts, seg) => { const geo = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
    const L = [0]; for (let j = 1; j < pts.length; j++) L.push(L[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, L[Math.round(uv.getY(i) * (pts.length - 1))] / L[L.length - 1]);
    return {geo, L}; };
  const S = 1.18, sc = pts => pts.map(([x, y]) => [x * S, y * S]);
  const CUP = sc([[0, .012], [.17, .012], [.2, .022], [.205, .06], [.19, .072], [.21, .088], [.27, .14], [.34, .24], [.395, .37], [.43, .5], [.447, .58], [.452, .6],
               [.444, .609], [.431, .597], [.414, .5], [.378, .37], [.322, .24], [.245, .14], [.15, .1], [0, .09]]);
  const cupL = lathe2(CUP, 64), footV = cupL.L[4] / cupL.L[cupL.L.length - 1];
  const glaze = map => new THREE.MeshPhysicalMaterial({map, color: '#ffffff', roughness: .3, clearcoat: .85, clearcoatRoughness: .14, sheen: .15});
  const cup = mesh(cupL.geo, glaze(crackTex('#c9cbc2', footV)), 0, .062 * S, 0); mug.add(cup);
  const SAU = sc([[0, .004], [.44, .004], [.47, .016], [.462, .03], [.52, .046], [.63, .072], [.675, .1], [.682, .112], [.672, .12], [.62, .094], [.5, .072], [.36, .063], [0, .061]]);
  const sauL = lathe2(SAU, 64), sauT = crackTex('#c4c6bd', sauL.L[2] / sauL.L[sauL.L.length - 1]); sauT.wrapS = THREE.RepeatWrapping; sauT.repeat.x = 3;
  mug.add(mesh(sauL.geo, glaze(sauT)));
  // 茶汤：琥珀色，半透，越靠杯壁越浅；很滑，照得出窗
  const liq = tex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, '#6e3f16'); gr.addColorStop(.7, '#8a5520'); gr.addColorStop(.93, '#b47d3c'); gr.addColorStop(1, '#d6ae74'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const surf = mesh(new THREE.CircleGeometry(.392 * S, 56), new THREE.MeshPhysicalMaterial({map: liq, roughness: .1, specularIntensity: .28, envMapIntensity: .4}), 0, (.062 + .44) * S, 0);
  surf.rotation.x = -Math.PI / 2; surf.userData.noCast = true; mug.add(surf);
  // 热气：两缕竖着的软带子，总是正对着镜头，往上飘着摆，越高越淡（跟连环的一样）
  steamG = G(); steamG.position.y = (.062 + .6) * S; mug.add(steamG);   // 从杯口往上一点才开始冒
  const sg = new THREE.PlaneGeometry(.4, 1.3, 1, 24); sg.translate(0, .65, 0);
  for (const [x, ph] of [[-.08, 0], [.1, 2.3]]){
    const sm = new THREE.ShaderMaterial({uniforms: {uT: STEAM_T, uPh: {value: ph}, uA: {value: .2}}, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `uniform float uT, uPh; varying vec2 vUv;
        void main(){ vUv = uv; vec3 p = position; float v = uv.y;
          p.x += (sin(v * 5. - uT * 1.3 + uPh) * .13 + sin(v * 11. - uT * 2.1 + uPh * 2.) * .04) * v;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); }`,
      fragmentShader: `uniform float uT, uPh, uA; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
        void main(){ float v = vUv.y, w = .5 - abs(vUv.x - .5);
          float nz = n(vec2(vUv.x * 3. + uPh, v * 4. - uT * .9)) * .65 + n(vec2(vUv.x * 7. + uPh, v * 9. - uT * 1.6)) * .35;
          float a = smoothstep(0., .45, w) * smoothstep(0., .12, v) * (1. - smoothstep(.4, 1., v)) * smoothstep(.38, .78, nz) * uA;
          gl_FragColor = vec4(vec3(1.), a); }`});
    const m = mesh(sg, sm, x, 0, 0); m.renderOrder = 5; m.layers.set(1); m.userData.noCast = true; steamG.add(m);
  }
  mug.position.set(4.9, .015, -2.05); mug.rotation.y = .4; add(mug, 'mug');
  steamG.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = false; });
}
const stepNP = dt => {   // 屏幕一秒画十来次就够；凑近看的时候画得勤一点
  if (NP.playing){ NP.pos += dt; if (NP.pos >= NP.dur) NP.pos = 0; }
  NP.acc += dt; if (NP.acc < (focusKey === 'music' ? 1 / 24 : 1 / 10)) return; NP.acc = 0;
  const [a, b] = laptop.userData.scr; drawNP(a.image.getContext('2d'), 640, 420); a.needsUpdate = true; b.needsUpdate = true;
};
const stepSteam = (dt, t) => {
  STEAM_T.value = t;
  steamG.rotation.y = Math.atan2(camera.position.x - mug.position.x, camera.position.z - mug.position.z) - mug.rotation.y;   // 热气总是正对着镜头
  // 离得远、从上往下看的时候，热气薄薄一层会罩住整杯茶、把茶色冲成粉的：只在凑近看茶的时候才明显
  const near = focusKey === 'mug' ? focusT : 0, a = (.05 + .17 * near) * (1 - .55 * grade.uniforms.dark.value); steamG.children.forEach(m => m.material.uniforms.uA.value = a);
};
// 信（照连环那两封信的样子做）：下面一封正面朝上，贴一张小邮票、盖一个邮戳；上面一封背面朝上，三道折边、封口片，
// 封口片尖上一块火漆，火漆中间压着一朵玉兰（用一张“高度图”算出凹凸，光一照就看得出浮雕）
const normalFromHeight = (draw, S = 512, k = 3) => {
  const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); draw(x, S);
  const src = x.getImageData(0, 0, S, S).data, out = x.createImageData(S, S), o = out.data, H = (i, j) => src[(((j + S) % S) * S + ((i + S) % S)) * 4] / 255;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++){
    const dx = (H(i + 1, j) - H(i - 1, j)) * k, dy = (H(i, j + 1) - H(i, j - 1)) * k, l = Math.hypot(dx, dy, 1), q = (j * S + i) * 4;
    o[q] = (-dx / l * .5 + .5) * 255; o[q + 1] = (dy / l * .5 + .5) * 255; o[q + 2] = (1 / l * .5 + .5) * 255; o[q + 3] = 255;
  }
  x.putImageData(out, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
};
const magnoliaSeal = normalFromHeight((x, S) => {
  x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, S, S); const c = S / 2;
  x.lineWidth = 16; x.strokeStyle = 'rgb(200,200,200)'; x.beginPath(); x.arc(c, c, S * .43, 0, 7); x.stroke();
  x.lineWidth = 5; x.strokeStyle = 'rgb(90,90,90)'; x.beginPath(); x.arc(c, c, S * .39, 0, 7); x.stroke();
  // 枝：从左下斜上来，分一小杈托着一颗花苞
  x.lineCap = 'round'; x.strokeStyle = 'rgb(205,205,205)'; x.lineWidth = 14; x.beginPath(); x.moveTo(c - 120, c + 150); x.quadraticCurveTo(c - 40, c + 100, c - 4, c + 40); x.stroke();
  x.lineWidth = 9; x.beginPath(); x.moveTo(c - 70, c + 112); x.quadraticCurveTo(c - 110, c + 70, c - 118, c + 20); x.stroke();
  const tepal = (cx, cy, rx, ry, a, v) => { x.save(); x.translate(cx, cy); x.rotate(a); const g = x.createRadialGradient(0, ry * .2, 2, 0, 0, ry); g.addColorStop(0, `rgb(${v},${v},${v})`); g.addColorStop(1, `rgb(${v - 40},${v - 40},${v - 40})`); x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, 7); x.fill(); x.restore(); };
  // 花苞
  tepal(c - 120, c - 8, 18, 36, -.15, 225);
  // 花：后面两瓣低一点，前面三瓣高一点，中间那瓣最高
  tepal(c - 34, c - 70, 34, 80, -.32, 190); tepal(c + 42, c - 70, 34, 80, .32, 190);
  tepal(c - 46, c - 30, 40, 84, -.55, 230); tepal(c + 50, c - 30, 40, 84, .55, 230);
  tepal(c + 2, c - 40, 44, 96, 0, 250);
  x.strokeStyle = 'rgb(150,150,150)'; x.lineWidth = 3;
  for (const a of [-.55, .55, 0]){ x.save(); x.translate(c + (a > 0 ? 50 : a < 0 ? -46 : 2), c - (a ? 30 : 40)); x.rotate(a); x.beginPath(); x.moveTo(0, 60); x.lineTo(0, -50); x.stroke(); x.restore(); }
  x.filter = 'blur(2px)'; x.drawImage(x.canvas, 0, 0); x.filter = 'none';
}, 512, 4);
const letter = G(); {
  const EW = 2.3, ED = 1.55;
  const paper = (draw, base) => tex(1024, 690, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); noiseDots(x, w, h, 7000, .06, ['rgba(120,100,76,A)', 'rgba(255,250,240,A)']); draw && draw(x, w, h); });
  const front = paper((x, w, h) => {
    const sx = w - 210, sy = 44, sw = 160, sh = 196;   // 邮票：齿孔边，里面画一枝玉兰
    x.fillStyle = '#f2ece0'; x.fillRect(sx - 6, sy - 6, sw + 12, sh + 12); x.fillStyle = '#e9e1d2'; for (let i = sx - 6; i <= sx + sw + 6; i += 16){ for (const yy of [sy - 6, sy + sh + 6]){ x.beginPath(); x.arc(i, yy, 6, 0, 7); x.fill(); } } for (let j = sy - 6; j <= sy + sh + 6; j += 16){ for (const xx of [sx - 6, sx + sw + 6]){ x.beginPath(); x.arc(xx, j, 6, 0, 7); x.fill(); } }
    x.fillStyle = '#3a3f40'; x.fillRect(sx + 12, sy + 12, sw - 24, sh - 56);
    x.strokeStyle = '#8a7a66'; x.lineWidth = 4; x.beginPath(); x.moveTo(sx + 40, sy + sh - 50); x.quadraticCurveTo(sx + 70, sy + 90, sx + 110, sy + 40); x.stroke();
    x.fillStyle = '#efe8dc'; for (const [px, py] of [[sx + 108, sy + 42], [sx + 78, sy + 84], [sx + 58, sy + 116]]){ x.beginPath(); x.ellipse(px, py, 12, 20, -.3, 0, 7); x.fill(); }
    x.fillStyle = '#5a5248'; x.font = '600 22px system-ui'; x.textAlign = 'center'; x.fillText('121', sx + sw / 2, sy + sh - 18);
    x.strokeStyle = 'rgba(60,52,46,.42)'; x.lineWidth = 4; x.beginPath(); x.arc(sx - 30, sy + 110, 64, 0, 7); x.stroke();
    for (let k = 0; k < 4; k++){ x.beginPath(); for (let t = 0; t <= 1; t += .05) x.lineTo(sx - 260 + t * 200, sy + 76 + k * 22 + Math.sin(t * Math.PI * 2) * 8); x.stroke(); }
    x.strokeStyle = 'rgba(60,52,46,.2)'; x.lineWidth = 3; for (const yy of [h - 190, h - 90]){ x.beginPath(); x.moveTo(90, yy); x.lineTo(w * .62, yy); x.stroke(); }
  }, '#e3d9c6');
  const back = paper((x, w, h) => {
    x.strokeStyle = 'rgba(110,92,70,.26)'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, h); x.lineTo(w * .42, h * .5); x.lineTo(w * .58, h * .5); x.lineTo(w, h); x.stroke();
    const g = x.createLinearGradient(0, h * .5, 0, h); g.addColorStop(0, 'rgba(110,92,70,.1)'); g.addColorStop(1, 'rgba(110,92,70,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, h); x.lineTo(w * .42, h * .5); x.lineTo(w * .58, h * .5); x.lineTo(w, h); x.fill();
  }, '#e8dfcd');
  const flapT = tex(512, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e2d8c6'); g.addColorStop(1, '#e8dfcd'); x.fillStyle = g; x.fillRect(0, 0, w, h); noiseDots(x, w, h, 1500, .06, ['rgba(120,100,76,A)', 'rgba(255,250,240,A)']); });   // 封口片和信封是同一张纸；边靠它自己抬起来的那点影子看出来
  const bulge = (x, z, a) => a * Math.max(0, 1 - Math.pow(2 * x / EW, 4)) * Math.max(0, 1 - Math.pow(2 * z / ED, 4));
  const edgeM = std('#e2d8c5', .9), H0 = .028;
  const env = (map, a) => {
    const e = G(), g = new THREE.PlaneGeometry(EW, ED, 28, 18); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++){ const X = p.getX(i), Z = p.getZ(i); p.setY(i, H0 + bulge(X, Z, a) + Math.sin(X * 3.1 - Z * 2.3) * .004); }
    g.computeVertexNormals(); e.add(mesh(g, new THREE.MeshStandardMaterial({map, roughness: .92})));
    e.add(mesh(new THREE.BoxGeometry(EW - .006, .022, ED - .006), edgeM, 0, .012, 0)); e.userData.top = (X, Z) => H0 + bulge(X, Z, a); return e;
  };
  const low = env(front, .025); low.position.set(-.2, 0, .18); low.rotation.y = -.2; letter.add(low);
  const up = env(back, .05); up.position.set(.05, .04, -.04); up.rotation.y = .06; letter.add(up);
  // 封口片：从远边的两个角收到中间一个尖，贴着信封鼓起来的面，再抬一点点
  const fs = new THREE.Shape(); fs.moveTo(-EW / 2, -ED / 2); fs.quadraticCurveTo(-.35, -.22, 0, .08); fs.quadraticCurveTo(.35, -.22, EW / 2, -ED / 2); fs.lineTo(-EW / 2, -ED / 2);
  const fg = new THREE.ShapeGeometry(fs, 24); fg.rotateX(Math.PI / 2); const fp = fg.attributes.position, fuv = fg.attributes.uv;
  for (let i = 0; i < fp.count; i++){ const X = fp.getX(i), Z = fp.getZ(i); fp.setY(i, up.userData.top(X, Z) + .01 + Math.max(0, Math.abs(X) - .9) * .02); fuv.setXY(i, X / EW + .5, (Z + ED / 2) / (ED / 2 + .08)); }
  fg.computeVertexNormals(); const flap = mesh(fg, new THREE.MeshStandardMaterial({map: flapT, roughness: .9, side: THREE.DoubleSide})); flap.position.z = 0; up.add(flap);
  // 火漆：边不规整地摊开，贴在封口片的尖上
  const tipZ = .08, tipY = up.userData.top(0, tipZ) + .012;
  const wg = lathe([[0, 0], [.27, 0], [.3, .012], [.29, .03], [.24, .042], [.2, .046], [0, .046]], 64), wp = wg.attributes.position;
  for (let i = 0; i < wp.count; i++){ const a = Math.atan2(wp.getZ(i), wp.getX(i)), r = Math.hypot(wp.getX(i), wp.getZ(i)); if (r > .18){ const k = 1 + .09 * Math.sin(a * 5 + 1) + .05 * Math.sin(a * 11 + 2); wp.setX(i, wp.getX(i) * k); wp.setZ(i, wp.getZ(i) * k); } }
  wg.computeVertexNormals(); const wax = new THREE.MeshPhysicalMaterial({color: '#6a221b', roughness: .38, clearcoat: .45, clearcoatRoughness: .3});
  up.add(mesh(wg, wax, 0, tipY - .004, tipZ));
  const top = new THREE.CircleGeometry(.205, 48); top.rotateX(-Math.PI / 2);
  up.add(mesh(top, new THREE.MeshPhysicalMaterial({color: '#6a221b', roughness: .42, clearcoat: .35, normalMap: magnoliaSeal, normalScale: new THREE.Vector2(1.4, 1.4)}), 0, tipY + .043, tipZ));
  letter.position.set(6.45, .015, 2.7); letter.rotation.y = -.3; add(letter, 'letter');
}

