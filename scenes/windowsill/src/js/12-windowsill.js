/* ═════ 窗台：两摞书、黄铜小壶、小枫、刚飞进来的纸飞机 ═════ */
{ const a = stackOf([[2.3, .34, 1.5, '#a2967f', .05], [2.1, .3, 1.4, '#d6cdbd', -.06], [2.2, .28, 1.45, '#76695a', .08]]); at(a, 1.65, SILL_Y, -4.1); add(a, null); }   // 往左让一让，给透卡的彩色影子留地方
{
  const j = G(); j.add(mesh(lathe([[0, 0], [.32, 0], [.42, .3], [.38, .7], [.2, 1.1], [.16, 1.6], [.24, 1.75], [.2, 1.8], [0, 1.8]], 40), brass));
  const sp = mesh(new THREE.CylinderGeometry(.04, .08, 1.0, 12), brass, .45, 1.1, 0); sp.rotation.z = -.9; j.add(sp);
  const hd = mesh(new THREE.TorusGeometry(.3, .04, 8, 20, Math.PI * 1.2), brass, -.38, 1.0, 0); hd.rotation.z = Math.PI / 2 + .3; j.add(hd);
  at(j, 8.9, SILL_Y, -4.1, .4); add(j, null);
}
// 窗台：一张透卡斜靠在玻璃上（桌宠：卡上的颜文字就是他这会儿的样子）。阳光穿过它，把彩色的影子投在窗台上
const CARD_W = 1.5, CARD_H = 2.0;
const cardCv = document.createElement('canvas'); cardCv.width = 256; cardCv.height = 350;
const cardTex = new THREE.CanvasTexture(cardCv); cardTex.colorSpace = THREE.SRGBColorSpace; cardTex.anisotropy = ANISO;
const shCv = document.createElement('canvas'); shCv.width = 256; shCv.height = 350;
const shTex = new THREE.CanvasTexture(shCv); shTex.colorSpace = THREE.SRGBColorSpace;
const drawCardFrame = (petCv) => {
  const x = cardCv.getContext('2d'), w = 256, h = 350; x.clearRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 3; x.beginPath(); x.roundRect(14, 14, w - 28, h - 28, 14); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.95)'; for (const [sx, sy, r] of [[40, 48, 5], [214, 70, 4], [200, 36, 3], [52, 250, 3], [220, 230, 5]]){ x.beginPath(); for (let k = 0; k < 10; k++){ const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? r * .45 : r; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.fill(); }
  x.fillStyle = 'rgba(255,255,255,.95)'; x.font = '600 22px "Noto Serif CJK SC", serif'; x.textAlign = 'center'; x.fillText('赴 约', w / 2, h - 34);
  x.fillStyle = 'rgba(206,168,160,.55)'; x.beginPath(); x.arc(w / 2, 168, 86, 0, 7); x.fill();   // 小家伙身后一圈淡粉的圆
  if (petCv){ x.imageSmoothingEnabled = !!petCv._smooth; const k = Math.min(170 / petCv.width, 170 / petCv.height) * (petCv._k || 1), pw = petCv.width * k, ph = petCv.height * k; x.drawImage(petCv, (w - pw) / 2, 250 - 222 / 240 * ph, pw, ph); }
  cardTex.needsUpdate = true;
  // 影子那张图：底是白的（光照原样透过去），印了颜色的地方把光染成那个颜色，深色的地方挡掉光；亚克力边缘一圈淡淡的暗线
  const s = shCv.getContext('2d'), src = x.getImageData(0, 0, w, h), out = s.createImageData(w, h);
  for (let i = 0; i < src.data.length; i += 4){
    const a = src.data[i + 3] / 255, r = src.data[i], g = src.data[i + 1], b = src.data[i + 2], m = (r + g + b) / 3;
    const sat = 1.6, R = Math.min(255, m + (r - m) * sat), Gc = Math.min(255, m + (g - m) * sat), B = Math.min(255, m + (b - m) * sat);
    out.data[i] = 255 * (1 - a) + R * a; out.data[i + 1] = 255 * (1 - a) + Gc * a; out.data[i + 2] = 255 * (1 - a) + B * a; out.data[i + 3] = 255;
  }
  s.putImageData(out, 0, 0); s.strokeStyle = 'rgba(150,140,130,.55)'; s.lineWidth = 6; s.beginPath(); s.roundRect(3, 3, w - 6, h - 6, 16); s.stroke();
  shTex.needsUpdate = true;
};
drawCardFrame(null);
const tcard = G(); {
  const face = mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), new THREE.MeshStandardMaterial({map: cardTex, transparent: true, alphaTest: .02, roughness: .3, side: THREE.DoubleSide, emissive: new THREE.Color('#ffffff'), emissiveMap: cardTex, emissiveIntensity: .25}), 0, CARD_H / 2 + .16, .012);
  face.userData.noCast = true; face.userData.cd = {map: cardTex, test: .6}; tcard.add(face);
  const acr = mesh(new RoundedBoxGeometry(CARD_W + .06, CARD_H + .06, .02, 2, .06), new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: .05, transparent: true, opacity: .14, clearcoat: 1, envMapIntensity: 2}), 0, CARD_H / 2 + .16, 0);
  acr.userData.noCast = true; acr.userData.cd = {}; tcard.add(acr);
  const stand = mesh(new RoundedBoxGeometry(1.0, .2, .36, 2, .05), lightWood, 0, .1, .05); tcard.add(stand);
  tcard.userData.face = face;
  tcard.position.set(4.8, SILL_Y, -4.62); tcard.rotation.x = -.1; tcard.rotation.y = -.06; add(tcard, 'pet');
}
// 投在窗台上的影子：把卡片四个角顺着阳光的方向投到窗台面上，贴同一张图，用“加光”的方式叠上去；窗台外沿以外的不画
const cardShadow = (() => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2)); g.setIndex([0, 2, 1, 2, 3, 1]);
  const uK = {value: 0}, mat = new THREE.MeshBasicMaterial({map: shTex, transparent: true, premultipliedAlpha: true, blending: THREE.MultiplyBlending, depthWrite: false, side: THREE.DoubleSide});
  mat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.uniforms.uK = uK;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uK;').replace('void main() {', `void main() {\n if (vWP.z > ${(WALL_Z + .44).toFixed(2)} || vWP.z < ${(GLASS_Z + .02).toFixed(2)}) discard;`).replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor = vec4(mix(vec3(1.), gl_FragColor.rgb, uK), 1.);');
  };
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 3; m.layers.set(1); scene.add(m);
  const C4 = [V(-CARD_W / 2, CARD_H + .16, .012), V(CARD_W / 2, CARD_H + .16, .012), V(-CARD_W / 2, .16, .012), V(CARD_W / 2, .16, .012)], w = new THREE.Vector3();
  return {mesh: m, update(sunDir, strength){
    const L = sunDir.clone().normalize().negate(); tcard.updateMatrixWorld(true); const p = g.attributes.position;
    C4.forEach((c, i) => { w.copy(c).applyMatrix4(tcard.matrixWorld); const t = (SILL_Y + .004 - w.y) / L.y; w.addScaledVector(L, t); p.setXYZ(i, w.x, w.y, w.z); });
    p.needsUpdate = true; uK.value = strength; m.visible = strength > .02;
  }};
})();

// 窗台那摞书上停着一只千纸鹤（我在哪：他出门在外时它就飞走了，回家就停回来）
// 一张和纸折的：身体是个鼓起来的菱形，两翼是长三角、往下垂一点点，脖子和尾巴是内翻折出的细楔子，头再往前折一下
const facetGeo = (faces, k = 1.6) => {   // 每个面单独按自己的平面铺纸纹（折痕两边纤维不连着，像真的折过）
  const P = [], U = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), t = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [A, B, C] of faces){
    a.fromArray(A); b.fromArray(B); c.fromArray(C);
    n.subVectors(b, a).cross(t.subVectors(c, a)).normalize();
    t.crossVectors(n, Math.abs(n.y) < .9 ? UP : new THREE.Vector3(1, 0, 0)).normalize(); s.crossVectors(n, t);
    for (const p of [a, b, c]){ P.push(p.x, p.y, p.z); U.push(p.dot(t) * k + .5, p.dot(s) * k + .5); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals(); return g;
};
const washiTex = tex(512, 512, (x, w, h) => {
  x.fillStyle = '#e8dfcf'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++){ const cx = rnd() * w, cy = rnd() * h, r = 30 + rnd() * 90, g = x.createRadialGradient(cx, cy, 0, cx, cy, r); const d = rnd() < .5; g.addColorStop(0, d ? 'rgba(150,130,100,.07)' : 'rgba(255,252,244,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); }   // 纸浆厚薄不匀的云
  x.lineCap = 'round';
  for (let i = 0; i < 520; i++){   // 长纤维：细、弯、有的亮有的暗
    const x0 = rnd() * w, y0 = rnd() * h, a = rnd() * 6.3, L = 14 + rnd() * 60, bend = (rnd() - .5) * 30;
    x.strokeStyle = rnd() < .62 ? `rgba(255,253,246,${.25 + rnd() * .35})` : `rgba(140,118,88,${.08 + rnd() * .16})`; x.lineWidth = .5 + rnd() * .9;
    x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(x0 + Math.cos(a) * L / 2 + Math.cos(a + 1.57) * bend, y0 + Math.sin(a) * L / 2 + Math.sin(a + 1.57) * bend, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); x.stroke();
  }
  for (let i = 0; i < 60; i++){ x.fillStyle = `rgba(96,78,58,${.15 + rnd() * .25})`; x.save(); x.translate(rnd() * w, rnd() * h); x.rotate(rnd() * 6.3); x.fillRect(0, 0, 2 + rnd() * 6, .8 + rnd()); x.restore(); }   // 楮皮碎屑
  for (let i = 0; i < 46; i++){   // 撒的金箔，碎、不规则
    const cx = rnd() * w, cy = rnd() * h, r = 1.5 + rnd() * 4.5; x.fillStyle = `rgba(${196 + rnd() * 30 | 0},${156 + rnd() * 30 | 0},${80 + rnd() * 30 | 0},${.55 + rnd() * .35})`;
    x.beginPath(); for (let k = 0; k < 5; k++){ const an = k / 5 * 6.3 + rnd() * .8, rr = r * (.4 + rnd() * .8); x.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } x.fill();
  }
});
const crane = G(); {
  /* 经典的纸鹤：身体是一个鼓起来的菱形（底下一道龙骨尖，搁在书上），背脊上左右各伸出一只长三角的翅膀——
     翅膀中间有一道折痕微微拱起、翅尖往下垂一点、往后掠；脖子和尾巴是从身体前后两头内翻折上去的两根细尖，
     脖子比尾巴陡一点，最上面一小截往前下折成头 */
  const F = [], mx = (v, s) => [v[0] * s, v[1], v[2]];
  const Ft = [0, .36, .27], Bt = [0, .36, -.27], Fl = [0, .14, .37], Bl = [0, .14, -.37], K = [0, .02, 0], Lb = [-.17, .21, 0];
  for (const s of [1, -1]){
    const l = mx(Lb, s);
    F.push([Ft, Fl, l], [Fl, K, l], [K, Bl, l], [Bl, Bt, l], [Bt, Ft, l]);   // 身体半边
    const Fh = [.012 * s, .362, .25], Bh = [.012 * s, .362, -.25], Hm = [.02 * s, .39, -.01];
    const Lm = [.52 * s, .47, .06], Cm = [.52 * s, .5, -.07], Tm = [.52 * s, .45, -.22], W = [1.02 * s, .36, -.2];
    F.push([Fh, Hm, Cm], [Fh, Cm, Lm], [Lm, Cm, W], [Hm, Bh, Tm], [Hm, Tm, Cm], [Cm, Tm, W]);   // 翅膀：中间一道折痕拱起来
  }
  // 脖子、尾巴：两层纸夹出来的细尖（横截面是一个很窄的 V）
  const spike = (base, up, tip) => { const a = [-.032, up[1], up[2]], b = [.032, up[1], up[2]]; F.push([base, a, tip], [base, b, tip], [a, b, tip]); };
  const Nt = [0, 1.0, .74];
  spike(Fl, [0, .31, .31], Nt); spike(Bl, [0, .31, -.31], [0, .9, -.86]);
  // 头：脖子顶上那一截往前、往下折过去
  const Hb = [0, .86, .66];
  F.push([[-.018, Hb[1], Hb[2]], Nt, [0, .9, .96]], [[.018, Hb[1], Hb[2]], [0, .9, .96], Nt]);
  const mat = new THREE.MeshPhysicalMaterial({map: washiTex, roughness: .88, sheen: .35, sheenRoughness: .8, sheenColor: new THREE.Color('#fff6e8'), side: THREE.DoubleSide, flatShading: true});
  crane.add(new THREE.Mesh(facetGeo(F), mat));
  crane.scale.setScalar(.95); crane.position.set(1.75, SILL_Y + .9, -4.05); crane.rotation.y = .7; add(crane, 'where');
}
// 流麻沙漏牌（桌宠的另一种样子）：一块透明厚亚克力，里面灌着油和很细的闪粉，小家伙是一枚悬在油里的亚克力小挂件。
// 点一下：整块牌子跳起来翻半圈（倒过来），原来沉在底下的闪粉到了上面，再慢慢一缕一缕往下流；
// 小挂件在油里慢一拍地转回正，同时换一个表情
const QW = 1.4, QH = 1.9, QD = .3;
const qsCv = document.createElement('canvas'); qsCv.width = 256; qsCv.height = 256;
const qsTex = new THREE.CanvasTexture(qsCv); qsTex.colorSpace = THREE.SRGBColorSpace; qsTex.anisotropy = ANISO;
const qsSil = document.createElement('canvas'); qsSil.width = qsSil.height = 256;
const drawQS = petCv => {   // 异形亚克力挂件：沿着小家伙的轮廓留一圈白边，像真的切出来的那种；没有圆片了
  const x = qsCv.getContext('2d'), w = 256; x.clearRect(0, 0, w, w);
  if (!petCv){ qsTex.needsUpdate = true; return; }
  const k = Math.min(196 / petCv.width, 196 / petCv.height) * (petCv._k || 1), pw = petCv.width * k, ph = petCv.height * k, px = (w - pw) / 2, py = w / 2 + 70 - 222 / 240 * ph;   // 脚底对齐在同一条线上
  const sx = qsSil.getContext('2d'); sx.clearRect(0, 0, w, w); sx.imageSmoothingEnabled = !!petCv._smooth; sx.globalCompositeOperation = 'source-over'; sx.drawImage(petCv, px, py, pw, ph);
  sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#fbfaf7'; sx.fillRect(0, 0, w, w); sx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 16; i++){ const a = i / 16 * Math.PI * 2; x.drawImage(qsSil, Math.cos(a) * 9, Math.sin(a) * 9); }   // 白边
  for (let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; x.drawImage(qsSil, Math.cos(a) * 4.5, Math.sin(a) * 4.5); }
  x.imageSmoothingEnabled = !!petCv._smooth; x.drawImage(petCv, px, py, pw, ph);
  qsTex.needsUpdate = true;
};
drawQS(null);
const qs = G(), qsSpin = G(); qs.add(qsSpin);
const QY = .3 + QH / 2; qsSpin.position.y = QY;
/* 闪粉：一粒一粒真的堆起来的沙。牌子里面分成一张很细的格子（每格最多挤三粒，前后错开），每粒沙只能掉进“下面”空着的格子；
   下面被占了就往左下 / 右下滑；再不行看看旁边——旁边的下面是空的才挪过去（所以沉底后会摊平，不会堆成尖）；都不行就停在那儿。
   每一帧从离“地面”最近的那粒开始算：底下的先落，上面的跟着落；堆是从底往上长的，落点不是事先定好的。
   翻过来以后，贴在“天花板”上那一团不会整块一起掉：最外面那层先松开，每粒还要再粘一小会儿（有长有短），所以是一缕一缕、一片一片往下淌 */
const SC = .013, SGX = Math.floor((QW - .12) / SC), SGY = Math.floor((QH - .12) / SC), SCAP = 3, QN = 12000;
const sCnt = new Uint8Array(SGX * SGY), sSlot = new Int32Array(SGX * SGY * SCAP).fill(-1);
const gCell = new Int32Array(QN), gProg = new Float32Array(QN), gHold = new Float32Array(QN), gRest = new Float32Array(QN), gSpd = new Float32Array(QN),
  gZ = new Float32Array(QN), gJx = new Float32Array(QN), gJy = new Float32Array(QN), gRx = new Float32Array(QN), gRy = new Float32Array(QN), gRot = new Float32Array(QN * 3), gDirty = new Uint8Array(QN);
const SDIR = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]], sOrd = [], sr = mkRng(2718);
const sDot = (c, d) => (c % SGX) * d[0] + ((c / SGX) | 0) * d[1];
const sOrderFor = k => sOrd[k] || (sOrd[k] = (() => { const d = SDIR[k], a = new Int32Array(SGX * SGY); for (let i = 0; i < a.length; i++) a[i] = i; return a.sort((p, q) => sDot(q, d) - sDot(p, d)); })());   // 离“地面”最近的格子排前面
const sCX = c => ((c % SGX) + .5 - SGX / 2) * SC, sCY = c => (((c / SGX) | 0) + .5 - SGY / 2) * SC;
const sPut = (g, c) => { sSlot[c * SCAP + sCnt[c]] = g; sCnt[c]++; gCell[g] = c; };
const sTake = (g, c) => { const b = c * SCAP, n = sCnt[c]; for (let k = 0; k < n; k++) if (sSlot[b + k] === g){ sSlot[b + k] = sSlot[b + n - 1]; sSlot[b + n - 1] = -1; sCnt[c] = n - 1; return; } };
const sFree = (c, d) => { const nx = c % SGX + d[0], ny = ((c / SGX) | 0) + d[1]; if (nx < 0 || ny < 0 || nx >= SGX || ny >= SGY) return -1; const n = ny * SGX + nx; return sCnt[n] < SCAP ? n : -1; };
let sK = -1, sD, sA, sB, sL, sR, sSleep = false;
const sTarget = c => {   // 这粒沙下一步能去哪：正下 → 斜下 → 旁边（旁边的下面得是空的）
  let n = sFree(c, sD);
  if (n >= 0 && sr() < .06){ const n2 = sFree(c, sr() < .5 ? sA : sB); if (n2 >= 0) n = n2; }   // 在油里沉的时候偶尔往旁边歪一下
  if (n >= 0) return n;
  const s = sr() < .5; n = sFree(c, s ? sA : sB); if (n < 0) n = sFree(c, s ? sB : sA); if (n >= 0) return n;
  for (const d of sr() < .5 ? [sL, sR] : [sR, sL]){ const c2 = sFree(c, d); if (c2 >= 0 && sFree(c2, sD) >= 0) return c2; }
  return -1;
};
const sStep = (dt, gx, gy) => {
  const k0 = ((Math.round(Math.atan2(gy, gx) / (Math.PI / 4)) % 8) + 8) % 8;
  if (k0 === sK && sSleep) return;   // 全都躺平了、牌子也没动：这一帧不用算
  sK = k0; let busy = 0;
  sD = SDIR[sK]; sA = SDIR[(sK + 1) % 8]; sB = SDIR[(sK + 7) % 8]; sL = SDIR[(sK + 2) % 8]; sR = SDIR[(sK + 6) % 8];
  const ord = sOrderFor(sK), tmp = [0, 0, 0];
  for (let oi = 0; oi < ord.length; oi++){
    const c = ord[oi], n = sCnt[c]; if (!n) continue;
    for (let k = 0; k < n; k++) tmp[k] = sSlot[c * SCAP + k];
    for (let k = 0; k < n; k++){
      const g = tmp[k]; let cc = c, nc = sTarget(cc);
      if (nc < 0){ gRest[g] += dt; gProg[g] = 0; continue; }
      if (gRest[g] > .4) gHold[g] = -Math.log(1 - sr() * .999) * .32;   // 躺过一阵的沙，松开前还要再粘一小会儿
      gRest[g] = 0; busy++;
      if (gHold[g] > 0){ gHold[g] -= dt; continue; }
      gProg[g] += gSpd[g] * dt / SC;
      let moves = 0;
      while (gProg[g] >= 1 && nc >= 0 && moves < 4){ gProg[g] -= 1; sTake(g, cc); sPut(g, nc); cc = nc; gDirty[g] = 1; moves++; nc = sTarget(cc); }
      if (nc < 0) gProg[g] = 0;
    }
  }
  sSleep = busy === 0;
};
let glitter, charm, charmA = 0, charmV = 0; {
  // 亚克力：正反两面很透，四条厚边亮一点（真亚克力的边看起来是一圈发亮的“玻璃边”）
  const face = new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: .02, transparent: true, opacity: .06, clearcoat: 1, clearcoatRoughness: 0, envMapIntensity: 2.6, depthWrite: false, side: THREE.DoubleSide});
  const rim = new THREE.MeshPhysicalMaterial({color: '#e4efea', roughness: .05, transparent: true, opacity: .42, clearcoat: 1, envMapIntensity: 2.4, depthWrite: false, side: THREE.DoubleSide});
  for (const s of [-1, 1]){ const f = mesh(new THREE.PlaneGeometry(QW, QH), face, 0, 0, s * QD / 2); f.userData.noCast = true; f.userData.cd = {}; qsSpin.add(f); }
  for (const s of [-1, 1]){ const a = mesh(new THREE.PlaneGeometry(QD, QH), rim, s * QW / 2, 0, 0); a.rotation.y = Math.PI / 2; a.userData.noCast = true; a.userData.cd = {}; qsSpin.add(a); const b = mesh(new THREE.PlaneGeometry(QW, QD), rim, 0, s * QH / 2, 0); b.rotation.x = Math.PI / 2; b.userData.noCast = true; b.userData.cd = {}; qsSpin.add(b); }
  // 里面的油：一层极淡的琥珀色
  const oil = mesh(new THREE.BoxGeometry(QW - .1, QH - .1, QD - .1), new THREE.MeshBasicMaterial({color: '#ffe9c8', transparent: true, opacity: .05, depthWrite: false})); oil.userData.noCast = true; oil.userData.cd = {}; qsSpin.add(oil);
  // 闪粉：很小的六角亮片，大小不一，翻滚的时候一闪一闪
  glitter = new THREE.InstancedMesh(new THREE.CircleGeometry(.0052, 6), new THREE.MeshStandardMaterial({color: '#ffffff', metalness: 1, roughness: .1, side: THREE.DoubleSide, envMapIntensity: 3.2, emissive: new THREE.Color('#fff4e0'), emissiveIntensity: .3}), QN);
  const pal = ['#f2dca8', '#e9e4dc', '#f4c9c4', '#cfe3ee', '#f7e9c9', '#d9c08a'], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3();
  // 一开始沙子都沉在底下：从最底下一格一格往上填
  const ord = sOrderFor(6); let g = 0;
  for (let oi = 0; oi < ord.length && g < QN; oi++){
    const c = ord[oi], top = g > QN * .9, k = top ? (sr() * (SCAP + 1)) | 0 : SCAP;   // 最上面一层填得不满，面上有点起伏
    for (let j = 0; j < k && g < QN; j++, g++){
      sPut(g, c); gSpd[g] = .17 + Math.pow(sr(), 1.8) * .22; gZ[g] = (sr() - .5) * (QD - .12); gJx[g] = (sr() - .5) * .8 * SC; gJy[g] = (sr() - .5) * .8 * SC;
      gRx[g] = sCX(c) + gJx[g]; gRy[g] = sCY(c) + gJy[g]; gRest[g] = 1; for (let r = 0; r < 3; r++) gRot[g * 3 + r] = sr() * 6.3;
      m.compose(p.set(gRx[g], gRy[g], gZ[g]), q.setFromEuler(e3.set(gRot[g * 3], gRot[g * 3 + 1], gRot[g * 3 + 2])), one.setScalar(.65 + (g % 7) * .12)); glitter.setMatrixAt(g, m);
      glitter.setColorAt(g, new THREE.Color(pal[g % pal.length]));
    }
  }
  glitter.count = g;
  glitter.castShadow = false; glitter.userData.noCast = true; glitter.frustumCulled = false; qsSpin.add(glitter);
  // 小挂件：异形亚克力，印着小家伙；泡在油里
  charm = G(); qsSpin.add(charm);   // 挂件不钉住：泡在油里，牌子翻过来它会慢慢沉、慢慢转正，闪粉从它前后流过去
  const cm = mesh(new THREE.PlaneGeometry(1.16, 1.16), new THREE.MeshPhysicalMaterial({map: qsTex, transparent: true, alphaTest: .3, roughness: .15, clearcoat: 1, clearcoatRoughness: .05, side: THREE.DoubleSide, emissive: new THREE.Color('#ffffff'), emissiveMap: qsTex, emissiveIntensity: .2}));
  cm.userData.noCast = true; cm.userData.cd = {map: qsTex, test: .5}; charm.add(cm);
  // 底座：一块深色原木，开一道槽
  const base = mesh(new RoundedBoxGeometry(1.2, .3, .56, 2, .06), new THREE.MeshStandardMaterial({map: woodTex, roughness: .6}), 0, .15, 0); qs.add(base);
  qs.add(mesh(new THREE.BoxGeometry(QW - .2, .03, QD + .04), std('#151311', .9), 0, .302, 0));
  qs.position.set(.2, 0, -2.05); qs.rotation.y = .3; add(qs, 'quick');   // 挪到左边原来台灯那块
}
const QS = {t: -1, flips: 0, a0: 0,
  spin(){ if (this.t < 0){ this.t = 0; this.a0 = this.flips * Math.PI; this.flips++; PET.next(); } },
  step(dt, time){
    let th = this.flips * Math.PI, lift = 0;
    if (this.t >= 0){ this.t += dt; const u = Math.min(1, this.t / 1.15), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; th = this.a0 + e * Math.PI; lift = Math.sin(Math.PI * u) * .5; if (u >= 1) this.t = -1; }
    qsSpin.rotation.z = th; qsSpin.position.y = QY + lift;
    // 小挂件：在油里慢一拍地转回正（带一点来回晃）
    const want = -th, acc = 9 * (want - charmA) - 3.2 * charmV; charmV += acc * dt; charmA += charmV * dt;
    const gx = -Math.sin(th), gy = -Math.cos(th);   // 牌子自己坐标里的重力（牌子转，重力就跟着转）
    // 挂件比油重一点点：往“下”慢慢沉一小段，碰到底就停，带一点点漂
    const cx = charm.position.x, cy = charm.position.y, tx = gx * .2 + Math.sin(time * .5) * .02, ty = gy * .2 + Math.sin(time * .7) * .025;
    charm.position.x += (tx - cx) * (1 - Math.exp(-dt * .9)); charm.position.y += (ty - cy) * (1 - Math.exp(-dt * .9));
    charm.rotation.z = charmA + Math.sin(time * .8) * .05;
    sStep(Math.min(dt, .05), gx, gy);
    // 画：每粒沙往它现在那一格滑过去（看起来是连续地落，不是一格一格跳）；落着的时候翻滚、一闪一闪
    const a = 1 - Math.exp(-dt * 16), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), p = new THREE.Vector3(), one = new THREE.Vector3();
    let any = false;
    for (let g = 0; g < glitter.count; g++){
      if (!gDirty[g]) continue;
      const c = gCell[g], tx2 = sCX(c) + gJx[g], ty2 = sCY(c) + gJy[g];
      gRx[g] += (tx2 - gRx[g]) * a; gRy[g] += (ty2 - gRy[g]) * a;
      if (Math.abs(tx2 - gRx[g]) + Math.abs(ty2 - gRy[g]) < 2e-4){ gRx[g] = tx2; gRy[g] = ty2; gDirty[g] = 0; }
      else { gRot[g * 3] += dt * 4.2; gRot[g * 3 + 1] += dt * 3.1; }
      m.compose(p.set(gRx[g], gRy[g], gZ[g]), q.setFromEuler(e3.set(gRot[g * 3], gRot[g * 3 + 1], gRot[g * 3 + 2])), one.setScalar(.65 + (g % 7) * .12)); glitter.setMatrixAt(g, m); any = true;
    }
    if (any) glitter.instanceMatrix.needsUpdate = true;
  }};
const drawPet = cv => { drawCardFrame(cv); drawQS(cv); };
// 彩蛋：一盆小枫树盆景（从连环那张书桌上分过来的）。浅浅的长方形陶盆、青苔、一块小石头；
// 树干是一段 S 形，分出几枝，每枝顶上一团“云片”似的枫叶，叶子是真的五裂、带锯齿的枫叶形，红到橙
const mapleLeafGeo = (() => {
  const lobes = [[-108, .56], [-56, .9], [0, 1], [56, .9], [108, .56]], P = (a, l) => [Math.sin(a * Math.PI / 180) * l, Math.cos(a * Math.PI / 180) * l];
  const sinus = [[0, -.05]]; for (let i = 1; i < lobes.length; i++){ const a = (lobes[i - 1][0] + lobes[i][0]) / 2, d = Math.min(lobes[i - 1][1], lobes[i][1]) * .4; sinus.push(P(a, d)); } sinus.push([0, -.05]);
  const pts = [], edge = (A, B, teeth, out) => { const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy); let nx = -dy / L, ny = dx / L; if (nx * (A[0] + B[0]) + ny * (A[1] + B[1]) < 0){ nx = -nx; ny = -ny; }
    for (let k = 0; k < teeth; k++){ const u = k / teeth, b = Math.sin(Math.PI * u) * .1 * L; pts.push([A[0] + dx * u + nx * b, A[1] + dy * u + ny * b]); const u2 = (k + .55) / teeth, b2 = Math.sin(Math.PI * u2) * .1 * L + (out ? .035 : .02); if (u2 > .1 && u2 < .95) pts.push([A[0] + dx * u2 + nx * b2, A[1] + dy * u2 + ny * b2]); } };
  lobes.forEach(([a, l], i) => { const T = P(a, l); edge(sinus[i], T, 5, true); edge(T, sinus[i + 1], 5, false); });
  const sh = new THREE.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y));
  const g = new THREE.ShapeGeometry(sh, 2); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), z = p.getZ(i); p.setY(i, -(x * x) * .35 + z * .08); }   // 微微拱起
  g.computeVertexNormals(); g.scale(.12, .12, .12); return g;
})();
const maple = G(); {
  /* 盆景重做：浅浅的椭圆紫砂盆、一层青苔、一块小石头；树干从根盘（几条露出土的根）起，粗、往上收细，带一个 S 弯；
     左右交替出七八根枝，枝再分小枝，枝头是一层一层“云片”——很多片小枫叶摞成的扁圆顶，红到橙，偶尔几片发黄；苔上落了几片 */
  const mr = mkRng(6262), R = (a, b) => a + mr() * (b - a);
  // 盆：椭圆、口沿外翻一圈，四只小矮脚
  const clay = new THREE.MeshPhysicalMaterial({color: '#6a5446', roughness: .82, map: speckTex, clearcoat: .15, clearcoatRoughness: .7});
  const potG = lathe([[0, .05], [.6, .05], [.66, .1], [.68, .24], [.74, .27], [.75, .3], [.7, .31], [.64, .27], [0, .27]], 64); potG.scale(1.05, 1, .66);
  maple.add(mesh(potG, clay));
  for (const [x, z] of [[-.5, -.26], [.5, -.26], [-.5, .26], [.5, .26]]) maple.add(mesh(new THREE.CylinderGeometry(.07, .08, .06, 12), clay, x, .03, z));
  // 土和青苔：一张青苔贴图铺在土面上，再堆几团起伏的苔
  const mossT = tex(256, 256, (x, w, h) => { x.fillStyle = '#3f4a2c'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++){ const l = R(.25, .5); x.fillStyle = `hsla(${R(70, 95) | 0},${R(30, 45) | 0}%,${(l * 100) | 0}%,${R(.3, .7)})`; x.fillRect(R(0, w), R(0, h), R(1, 3), R(1, 3)); } }, {rep: [2, 2]});
  const mossM = new THREE.MeshStandardMaterial({map: mossT, roughness: 1});
  const soil = mesh(new THREE.CircleGeometry(.64, 48).scale(1.05, .66, 1), mossM, 0, .275, 0); soil.rotation.x = -Math.PI / 2; maple.add(soil);
  for (let i = 0; i < 7; i++){
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position; for (let k = 0; k < p.count; k++){ const v = new THREE.Vector3().fromBufferAttribute(p, k); v.multiplyScalar(1 + (mr() - .5) * .25); p.setXYZ(k, v.x, v.y, v.z); } g.computeVertexNormals();
    const m = mesh(g, mossM, R(-.5, .5), .27, R(-.25, .25)); m.scale.set(R(.12, .22), R(.04, .07), R(.1, .18)); maple.add(m);
  }
  const rk = new THREE.DodecahedronGeometry(.13, 1); { const p = rk.attributes.position; for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (1 + (mr() - .5) * .3), p.getY(k) * (1 + (mr() - .5) * .3), p.getZ(k)); rk.computeVertexNormals(); }
  const rock = mesh(rk, new THREE.MeshStandardMaterial({color: '#6d6862', roughness: .9, map: speckTex}), .42, .33, .1); rock.scale.set(1.4, .75, 1); rock.rotation.set(.2, .6, .1); maple.add(rock);
  // 树：一段一段的锥台拼起来，接缝处塞个小球
  const barkT = tex(64, 256, (x, w, h) => { x.fillStyle = '#5a463a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++){ x.fillStyle = `rgba(${mr() < .5 ? '30,22,18' : '120,104,90'},${R(.15, .4)})`; x.fillRect(R(0, w), R(0, h), R(1, 3), R(6, 26)); } }, {rep: [1, 2]});
  const barkM = new THREE.MeshStandardMaterial({map: barkT, roughness: .9});
  const parts = [], pads = [];
  const limb = (pts, r0, r1) => { const cv = new THREE.CatmullRomCurve3(pts), N = Math.max(4, Math.round(cv.getLength() / .08)); let a = cv.getPoint(0);
    for (let i = 1; i <= N; i++){ const b = cv.getPoint(i / N), ra = r0 + (r1 - r0) * (i - 1) / N, rb = r0 + (r1 - r0) * i / N, d = b.clone().sub(a), L = d.length();
      const g = new THREE.CylinderGeometry(rb, ra, L, 10, 1, true); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); parts.push(g.toNonIndexed());
      parts.push(new THREE.SphereGeometry(rb, 10, 6).translate(b.x, b.y, b.z).toNonIndexed()); a = b; }
    return cv; };
  const trunk = limb([V(-.08, .26, .02), V(-.16, .55, .0), V(.02, .86, -.02), V(-.1, 1.14, .02), V(.0, 1.38, 0), V(.08, 1.56, -.02)], .13, .035);
  for (let k = 0; k < 5; k++){ const a = k / 5 * Math.PI * 2 + .4; limb([V(-.08, .3, .02), V(-.08 + Math.cos(a) * .17, .27, .02 + Math.sin(a) * .12), V(-.08 + Math.cos(a) * .3, .262, .02 + Math.sin(a) * .2)], .055, .015); }   // 根盘
  const BR = [[.2, -1, .55, .6, -.1], [.32, 1, .5, .55, .3], [.47, -1, .45, .45, .5], [.58, 1, .42, .5, -.4], [.7, -1, .36, .38, .2], [.8, 1, .3, .35, -.2], [.9, -1, .22, .25, .4]];
  for (const [u, side, len, rr, tw] of BR){
    const p0 = trunk.getPoint(u), dir = V(side * Math.cos(tw), 0, Math.sin(tw)).normalize(), r0 = .055 * (1.1 - u * .6);
    const pm = p0.clone().addScaledVector(dir, len * .5).add(V(0, .06, 0)), pe = p0.clone().addScaledVector(dir, len).add(V(0, .02 + R(-.03, .05), 0));
    limb([p0, pm, pe], r0, .014);
    pads.push({c: pe.clone().add(V(0, .05, 0)), r: rr * .55 + .1, h: .09 + rr * .08});
    if (len > .35){ const d2 = dir.clone().applyAxisAngle(UP, side * .9), q = pm.clone().addScaledVector(d2, len * .4).add(V(0, .05, 0)); limb([pm, q], .02, .01); pads.push({c: q.clone().add(V(0, .04, 0)), r: .16 + rr * .2, h: .07}); }
  }
  pads.push({c: trunk.getPoint(1).add(V(0, .06, 0)), r: .24, h: .12});   // 树顶一团
  maple.add(mesh(mergeGeometries(parts), barkM));
  // 叶子：每团是一个扁圆顶，顶面密、边上稀，朝上摊开
  const N = 1500, leaves = new THREE.InstancedMesh(mapleLeafGeo, new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .55, side: THREE.DoubleSide}), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  for (let i = 0; i < N; i++){
    const P = pads[i % pads.length], a = mr() * Math.PI * 2, rr = Math.sqrt(mr()), y = (1 - rr * rr) * P.h + R(-.02, .02);
    const pos = V(P.c.x + Math.cos(a) * rr * P.r, P.c.y + y, P.c.z + Math.sin(a) * rr * P.r * .8);
    const nrm = V(Math.cos(a) * rr * .7, 1, Math.sin(a) * rr * .7).normalize();
    q.setFromUnitVectors(UP, nrm).multiply(new THREE.Quaternion().setFromAxisAngle(UP, mr() * 6.3));
    m4.compose(pos, q, V(1, 1, 1).multiplyScalar(.5 + mr() * .35)); leaves.setMatrixAt(i, m4);
    const hue = (i % pads.length) % 3 === 0 ? R(.03, .07) : R(-.01, .03), yel = mr() < .06;
    leaves.setColorAt(i, yel ? c.setHSL(R(.09, .12), .75, .45) : c.setHSL((hue + 1) % 1, R(.7, .88), R(.24, .38) + rr * .04));
  }
  leaves.castShadow = true; maple.add(leaves);
  // 苔上落了几片
  const fallen = new THREE.InstancedMesh(mapleLeafGeo, new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .6, side: THREE.DoubleSide}), 7);
  for (let i = 0; i < 7; i++){ m4.compose(V(R(-.55, .55), .29, R(-.25, .25)), q.setFromAxisAngle(UP, mr() * 6.3), V(1, 1, 1).multiplyScalar(.6)); fallen.setMatrixAt(i, m4); fallen.setColorAt(i, c.setHSL(R(0, .08), .7, R(.3, .42))); }
  maple.add(fallen);
  maple.position.set(9.0, 2.3, -2.68); maple.rotation.y = .25; add(maple, 'maple');
}
// 纸飞机：拿一页写过字的信纸折的（字是看不清的潦草几行，只是个意思）
const letterTex = tex(512, 768, (x, w, h) => {
  x.fillStyle = '#ece4d3'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++){ const cx = rnd() * w, cy = rnd() * h, r = 40 + rnd() * 110, g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, rnd() < .5 ? 'rgba(160,140,108,.06)' : 'rgba(255,252,244,.1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
  x.strokeStyle = 'rgba(150,120,96,.22)'; x.lineWidth = 1.2;
  for (let y = 120; y < h - 40; y += 34){ x.beginPath(); x.moveTo(40, y); x.lineTo(w - 40, y); x.stroke(); }
  x.strokeStyle = 'rgba(176,90,74,.22)'; x.beginPath(); x.moveTo(70, 40); x.lineTo(70, h - 20); x.stroke();
  const LETTER = '见字如面。\n　　窗外的柳条又绿了，比去年早几天。早上把茶泡上，书翻到昨天那一页，你说的那家面馆我替你去尝过了，汤很好，就是有点咸。这几天风大，柳絮飘了一窗台，我拿手接了一团，轻得像没有。\n　　你那边天气怎么样？出门记得带伞。等你回来，我们去山上看云，再把没看完的那部电影看完。\n　　不写了，纸不够了，折成飞机寄给你。';
  handText(x, LETTER, 84, 112, w - 44, 21, 'rgba(46,36,30,A)', 1.62);
});
const plane = G(); {
  // 机头 N，背脊（中缝）从 N 到 C，下面挂着两层龙骨，翅膀在离中缝一半的地方再折一道，外半边翘起来一点
  const N = [0, 0, 1.05], C = [0, 0, -.6], P = [], U = [];
  const put = (pts, uv) => { for (let i = 0; i < 3; i++){ P.push(...pts[i]); U.push(...uv[i]); } };
  const vz = z => (z + .62) / 1.7;
  for (const s of [1, -1]){
    const Lm = [.3 * s, .035, -.62], Lw = [.6 * s, .13, -.6], K = [.014 * s, -.21, -.6], Nk = [.006 * s, -.01, 1.0];
    put([N, C, Lm], [[.5, vz(1.05)], [.5, vz(-.6)], [.5 + .2 * s, vz(-.62)]]);
    put([N, Lm, Lw], [[.5, vz(1.05)], [.5 + .2 * s, vz(-.62)], [.5 + .4 * s, vz(-.6)]]);
    put([Nk, C.map((v, i) => i === 0 ? .006 * s : v), K], [[.5, vz(1.0)], [.5 - .02 * s, vz(-.6)], [.5 - .16 * s, vz(-.6)]]);   // 龙骨这层是纸往下折的那一截
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
  const p = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({map: letterTex, roughness: .9, sheen: .25, sheenRoughness: .8, sheenColor: new THREE.Color('#fff7ea'), side: THREE.DoubleSide, flatShading: true}));
  p.scale.setScalar(1.15); p.position.y = .24; plane.add(p);
  plane.position.set(7.85, SILL_Y, -3.8);   /* 给风铃架的底座让出地方 */ plane.rotation.set(0, 2.5, 0); add(plane, 'letter');
  p.rotation.z = -.05;
}


