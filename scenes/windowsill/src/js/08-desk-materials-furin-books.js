const C = {rose: '#6a4d43', sage: '#474a41', brass: '#8a7553'};
const brass = std(C.brass, .45, {metalness: .7});
const ceramic = new THREE.MeshPhysicalMaterial({color: '#ffffff', map: speckTex, roughness: .62, clearcoat: .15, clearcoatRoughness: .5});
const lightWood = new THREE.MeshStandardMaterial({map: woodPale, roughness: .7});
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
/* 空间：窗台上一只小小的风铃架——圆木底座、一根细铜杆、顶上弯成一只牧羊杖似的钩，钩上挂一只江户玻璃风铃。吹出来的薄玻璃，口沿故意不磨、毛毛的；里面手绘一圈靛青的水纹、两朵白玉兰；
   玻璃里吊一根小玻璃管当铃舌，下面拴一张短册（细长的和纸笺），风先吹动纸笺，纸笺带着铃舌碰响玻璃。
   风铃挂在钩上是一只摆：碰一下就来回荡，荡的幅度一下一下变小（简谐运动加一点阻尼）；下面的纸笺慢半拍跟着摆、还会打个转。
   他发了新动态，纸笺上就换成那条动态的一句话，风铃自己荡一下、叮一声；点它去空间 */
const furin = new THREE.Group(), furinPiv = new THREE.Group(), furinTan = new THREE.Group(), furinMid = new THREE.Object3D(); let furinPaint; {
  const fr = mkRng(808);
  // 支架
  const wood = new THREE.MeshStandardMaterial({map: woodTex, roughness: .55}), br = std('#a8885a', .32, {metalness: .9});
  furin.add(mesh(lathe([[0, 0], [.3, 0], [.32, .02], [.32, .07], [.29, .1], [0, .1]], 40), wood));
  furin.add(mesh(new THREE.CylinderGeometry(.06, .075, .05, 20), br, 0, .125, 0));
  const arm = new THREE.CatmullRomCurve3([V(0, .12, 0), V(0, 1.45, 0), V(-.03, 1.88, 0), V(-.19, 2.08, 0), V(-.44, 2.1, 0), V(-.6, 1.99, 0), V(-.63, 1.89, 0)], false, 'centripetal');   // 铜杆在右，钩往左弯，风铃挂在左边
  furin.add(mesh(new THREE.TubeGeometry(arm, 64, .02, 8), br));
  furin.add(mesh(new THREE.SphereGeometry(.03, 12, 8), br, -.63, 1.885, 0));   // 钩尖一颗小圆头
  furinPiv.position.set(-.63, 1.85, 0); furin.add(furinPiv);
  const hang = G(); hang.scale.setScalar(.42); furinPiv.add(hang);
  const cord = std('#8a2f2a', .7), L1 = .75;
  hang.add(mesh(new THREE.TorusGeometry(.06, .016, 6, 16), cord, 0, .02, 0).rotateY(Math.PI / 2));   // 挂在钩上的一个绳圈
  hang.add(mesh(new THREE.CylinderGeometry(.012, .012, L1, 5), cord, 0, -L1 / 2, 0));
  // 玻璃铃身
  const prof = [[0, .02], [.05, .02], [.08, 0], [.2, -.05], [.32, -.14], [.41, -.27], [.47, -.41], [.5, -.53], [.515, -.6]];
  const bell = new THREE.Group(); bell.position.y = -L1; hang.add(bell);
  const glassM = new THREE.MeshPhysicalMaterial({color: '#eef4f4', roughness: .04, transparent: true, opacity: .28, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2.4, side: THREE.DoubleSide, depthWrite: false});
  const shell = mesh(lathe(prof, 56), glassM); shell.renderOrder = 3; shell.userData.cd = {}; bell.add(shell);
  // 手绘：画在玻璃里面一层（贴图带透明）。贴图上方 = 口沿
  const paint = tex(1024, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(38,62,112,.92)'; x.fillRect(0, 0, w, 16);                                        // 口沿一道靛青
    x.strokeStyle = 'rgba(38,62,112,.85)'; x.lineWidth = 5; x.lineCap = 'round';
    for (let k = 0; k < 2; k++){ x.beginPath(); for (let u = 0; u <= w; u += 8){ const y = 34 + k * 20 + Math.sin(u / w * Math.PI * 2 * 9 + k * 1.3) * 6; u ? x.lineTo(u, y) : x.moveTo(u, y); } x.stroke(); }   // 两道水纹
    const flower = (cx, cy, s, a) => {   // 一朵白玉兰：五六片长瓣，灰青勾边，花心一点黄绿
      x.save(); x.translate(cx, cy); x.rotate(a);
      for (let i = 0; i < 6; i++){ x.save(); x.rotate(-1.1 + i * .44); x.beginPath(); x.ellipse(0, -s * .55, s * .2, s * .55, 0, 0, 7);
        const pg = x.createLinearGradient(0, 0, 0, -s * 1.1); pg.addColorStop(0, 'rgba(214,150,170,.95)'); pg.addColorStop(.45, 'rgba(252,246,244,.97)'); x.fillStyle = pg; x.fill(); x.strokeStyle = 'rgba(38,62,112,.9)'; x.lineWidth = 3; x.stroke(); x.restore(); }
      x.fillStyle = 'rgba(170,180,90,.9)'; x.beginPath(); x.arc(0, -s * .05, s * .1, 0, 7); x.fill(); x.restore();
    };
    const branch = (x0, y0, x1, y1) => { x.strokeStyle = 'rgba(70,58,50,.9)'; x.lineWidth = 5; x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo((x0 + x1) / 2, y0 - 26, x1, y1); x.stroke(); };
    branch(130, 210, 300, 120); flower(300, 128, 58, .2); flower(205, 170, 40, -.5);
    branch(640, 215, 800, 128); flower(800, 134, 62, -.15); flower(700, 190, 36, .6);
    for (let i = 0; i < 7; i++){ x.save(); x.translate(380 + fr() * 220, 120 + fr() * 100); x.rotate(fr() * 6.3); x.beginPath(); x.ellipse(0, 0, 6, 13, 0, 0, 7); x.fillStyle = 'rgba(250,248,242,.9)'; x.fill(); x.restore(); }   // 落下的花瓣
  });
  const inner = mesh(lathe(prof.map(([r, y]) => [r * .975, y]), 56), new THREE.MeshStandardMaterial({map: paint, transparent: true, roughness: .4, side: THREE.DoubleSide, depthWrite: false}));
  inner.renderOrder = 2; inner.userData.cd = {map: paint, test: .5}; bell.add(inner);
  // 毛口沿：一圈细玻璃，带一点不规则
  const rimG = new THREE.TorusGeometry(.515, .012, 6, 72); { const p = rimG.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + (fr() - .5) * .012); rimG.computeVertexNormals(); }
  const rim = mesh(rimG, new THREE.MeshPhysicalMaterial({color: '#f4f8f8', roughness: .2, transparent: true, opacity: .6, clearcoat: 1}), 0, -.6, 0); rim.rotation.x = Math.PI / 2; rim.userData.cd = {}; bell.add(rim);
  bell.add(mesh(new THREE.TorusGeometry(.05, .016, 6, 16), new THREE.MeshPhysicalMaterial({color: '#f4f8f8', roughness: .1, transparent: true, opacity: .7}), 0, .02, 0).rotateX(Math.PI / 2));   // 顶上吹管留下的小口
  // 铃舌：一根细玻璃管，吊在铃身里靠下
  furinTan.position.y = -L1 - .05; hang.add(furinTan);
  furinTan.add(mesh(new THREE.CylinderGeometry(.006, .006, .52, 4), cord, 0, -.26, 0));
  const tongue = mesh(new THREE.CylinderGeometry(.03, .03, .16, 12), new THREE.MeshPhysicalMaterial({color: '#dfeaf0', roughness: .05, transparent: true, opacity: .65, clearcoat: 1}), 0, -.5, 0); tongue.userData.cd = {}; furinTan.add(tongue);
  furinTan.add(mesh(new THREE.CylinderGeometry(.006, .006, .5, 4), cord, 0, -.83, 0));
  // 短册：和纸，竖着写一行字，下角一枚小红印
  furinPaint = (x, w, h, text) => {
    x.fillStyle = '#efe6d2'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++){ x.strokeStyle = `rgba(${fr() < .6 ? '255,252,244' : '150,128,96'},${.15 + fr() * .25})`; x.lineWidth = .6; const x0 = fr() * w, y0 = fr() * h, a = fr() * 6.3, L = 6 + fr() * 22; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); x.stroke(); }
    x.fillStyle = 'rgba(40,32,28,.82)'; x.textAlign = 'center';
    const chars = [...String(text)].slice(0, 7), step = Math.min(52, 330 / Math.max(1, chars.length));
    chars.forEach((ch, i) => { x.save(); x.translate(w / 2 + (fr() - .5) * 3, 70 + i * step); x.rotate((fr() - .5) * .08); x.font = `${(40 + fr() * 4).toFixed(0)}px ${HAND_FONT}`; x.fillText(ch, 0, 0); x.restore(); });
    x.fillStyle = 'rgba(170,44,36,.85)'; x.fillRect(w / 2 - 13, h - 64, 26, 26); x.fillStyle = 'rgba(239,230,210,.95)'; x.font = `18px ${HAND_FONT}`; x.fillText('约', w / 2, h - 45);
    x.fillStyle = 'rgba(80,60,40,.5)'; x.beginPath(); x.arc(w / 2, 16, 5, 0, 7); x.fill();   // 穿绳的小孔
  };
  const tanzaku = tex(128, 512, (x, w, h) => furinPaint(x, w, h, '云很低，风很软')); furin.userData.tz = tanzaku;
  const strip = mesh(new THREE.PlaneGeometry(.34, 1.36, 1, 6).translate(0, -.68, 0), new THREE.MeshStandardMaterial({map: tanzaku, roughness: .9, side: THREE.DoubleSide}), 0, -1.06, 0);
  { const p = strip.geometry.attributes.position; for (let i = 0; i < p.count; i++){ const y = p.getY(i); p.setZ(i, Math.sin(-y * 2.2) * .03); } strip.geometry.computeVertexNormals(); }   // 纸笺微微有点弯
  furinTan.add(strip);
  furinMid.position.y = 1.2; furin.add(furinMid);
  furin.position.set(6.6, SILL_Y, -4.2); furin.rotation.y = -.2; add(furin, 'space');   // 透卡右边：透卡的彩色影子往左边落，不挡它
}
/* 摆：θ'' = -ω²θ - 2ζωθ' + 一点点穿堂风；纸笺是挂在下面的第二只摆，被上面的摆带着走、慢半拍 */
const FS = {a: 0, va: 0, b: 0, vb: 0, c: 0, vc: 0, tw: 0, vt: 0, ac: null};
const furinRing = (k = 1) => {   // 叮——玻璃铃的声音：几个不成倍数的泛音，很快衰减
  try {
    const ac = FS.ac || (FS.ac = new (window.AudioContext || window.webkitAudioContext)()), t0 = ac.currentTime, out = ac.createGain(); out.gain.value = .05 * k; out.connect(ac.destination);
    for (const [f, a, d] of [[2093, 1, 1.6], [3150, .5, 1.1], [4410, .3, .7], [5960, .15, .4]]){ const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - .5) * .004); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + .004); g.gain.exponentialRampToValueAtTime(.0001, t0 + d); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + d + .05); }
  } catch (e){}
};
const swingFurin = (k = 1) => { FS.va += (FS.a > 0 ? -1 : 1) * .7 * k + (Math.random() - .5) * .15; FS.vc += (Math.random() - .5) * .35 * k; FS.vt += (Math.random() - .5) * 1.1 * k; furinRing(k); };   // 点一下、或者空间有新动态：轻轻荡一下
let furinLastHit = 0;
const stepFurin = (t, dt = 1 / 60) => {
  dt = Math.min(dt, .05);
  const w1 = 2 * Math.PI / 1.35, z1 = .09, w2 = 2 * Math.PI / 1.1, z2 = .12;   // 阻尼大一点：荡几下就收住
  const wk = .25 + 1.3 * WX.windS, gust = Math.max(0, Math.sin(t * .31) * Math.sin(t * .17 + 2)) * Math.max(0, WX.windS - .35) * 1.2;   // 风越大荡得越厉害；大风时一阵一阵地猛推
  const g = gustAt(6.6), breeze = (.057 * g + .016 * Math.sin(t * 1.9)) * wk + .1 * gust * (.5 + .5 * g) + .15 * Math.max(0, WX.windS - .3);   // 和柳条、纱帘同一阵风；窗台上风小，只轻轻晃
  const acc = -w1 * w1 * FS.a - 2 * z1 * w1 * FS.va + breeze * w1 * w1 * .5;
  FS.va += acc * dt; FS.a += FS.va * dt;
  FS.vc += (-w1 * w1 * FS.c - 2 * z1 * w1 * FS.vc + .007 * Math.sin(t * .5) * w1 * w1) * dt; FS.c += FS.vc * dt;     // 前后方向也荡一点点
  FS.vb += (-w2 * w2 * FS.b - 2 * z2 * w2 * FS.vb - acc * .5) * dt; FS.b += FS.vb * dt;                              // 纸笺：被带着走，慢半拍
  FS.vt += (-9 * FS.tw - 1.2 * FS.vt + .4 * Math.sin(t * .8)) * dt; FS.tw += FS.vt * dt;                             // 纸笺打转
  furinPiv.rotation.z = FS.a; furinPiv.rotation.x = FS.c;
  furinTan.rotation.z = FS.b; furinTan.rotation.y = FS.tw; furinTan.rotation.x = FS.c * .6;
  if (Math.abs(FS.b - FS.a) > .16 && t - furinLastHit > .6){ furinLastHit = t; furinRing(.35); }   // 铃舌碰到铃身：轻轻叮一下
};
const ribbon = (pts, w) => {
  const cv = new THREE.CatmullRomCurve3(pts), N = 60, P = [], I = [], UVs = [];
  for (let i = 0; i <= N; i++){
    const t = i / N, p = cv.getPoint(t), tg = cv.getTangent(t), sd = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(w / 2);
    P.push(p.x - sd.x, p.y, p.z - sd.z, p.x + sd.x, p.y, p.z + sd.z); UVs.push(0, t, 1, t);
    if (i < N) I.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UVs, 2)); g.setIndex(I); g.computeVertexNormals(); return g;
};
const COVERS = {};
const coverMat = c => COVERS[c] || (COVERS[c] = new THREE.MeshStandardMaterial({map: clothTex(c), roughness: .85}));
// 书芯侧面：一页页纸叠起来的细线
const pagesTex = tex(64, 512, (x, w, h) => { x.fillStyle = '#ddd3c1'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2){ x.fillStyle = `rgba(${rnd() < .5 ? '120,108,90' : '250,244,232'},${.12 + rnd() * .22})`; x.fillRect(0, y, w, 1); } }, {rep: [1, 1]});
const PAGES = new THREE.MeshStandardMaterial({map: pagesTex, roughness: .92});
/* ── 书 ──
   三种：布面精装（硬板比书芯大一圈、书脊是圆的、两头有堵头布）、皮面精装（深色、带皮纹、有点光泽）、平装（封皮和书芯齐平，印一道色带和书名块）。
   厚薄、颜色、哪种都不一样；侧面一律是一页页纸叠起来的细线 */
const leatherN = (() => { const c = document.createElement('canvas'), S = 256; c.width = c.height = S; const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++){ const v = 100 + rnd() * 70 | 0; x.fillStyle = `rgba(${v},${v},${v},.5)`; x.beginPath(); x.arc(rnd() * S, rnd() * S, .8 + rnd() * 2.2, 0, 7); x.fill(); }
  const src = x.getImageData(0, 0, S, S).data, out = x.createImageData(S, S), o = out.data, H = (i, j) => src[(((j + S) % S) * S + ((i + S) % S)) * 4] / 255;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++){ const dx = (H(i + 1, j) - H(i - 1, j)) * 2, dy = (H(i, j + 1) - H(i, j - 1)) * 2, l = Math.hypot(dx, dy, 1), q = (j * S + i) * 4; o[q] = (-dx / l * .5 + .5) * 255; o[q + 1] = (dy / l * .5 + .5) * 255; o[q + 2] = (1 / l * .5 + .5) * 255; o[q + 3] = 255; }
  x.putImageData(out, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t; })();
const LEATHER = {}, PAPERB = {};
const leatherMat = c => LEATHER[c] || (LEATHER[c] = new THREE.MeshPhysicalMaterial({color: new THREE.Color(c).multiplyScalar(.7), roughness: .5, clearcoat: .25, clearcoatRoughness: .5, normalMap: leatherN, normalScale: new THREE.Vector2(.6, .6)}));
const paperbackMat = c => PAPERB[c] || (PAPERB[c] = new THREE.MeshStandardMaterial({roughness: .8, map: tex(256, 256, (x, w, h) => {
  x.fillStyle = c; x.fillRect(0, 0, w, h); noiseDots(x, w, h, 900, .08, ['rgba(255,255,255,A)', 'rgba(0,0,0,A)']);
  x.fillStyle = 'rgba(230,220,200,.55)'; x.fillRect(0, h * .62, w, h * .07); x.fillStyle = 'rgba(230,220,200,.35)'; x.fillRect(w * .18, h * .2, w * .5, 10); x.fillRect(w * .18, h * .27, w * .32, 7);
})}));
const BAND = std('#5a2a20', .7), BAND2 = std('#3e4a3a', .7);
let bookSeed = 0;
/* 平放的一本：x 是书脊到书口（书脊在 -x），y 是厚度（0 到 t），z 是书的高 */
const bookFlat = (w, t, d, col, kind) => {
  const b = G(), k = kind || ['cloth', 'cloth', 'leather', 'paper'][(bookSeed++ * 7 + Math.round(w * 13 + t * 31)) % 4];
  if (k === 'paper'){
    // 平装：上下两张薄封皮 + 书脊一条，和书芯齐平，三面露出纸页
    const cov = paperbackMat(col), ct = Math.min(.012, t * .08);
    for (const y of [ct / 2, t - ct / 2]) b.add(mesh(new RoundedBoxGeometry(w, ct, d, 1, ct * .4), cov, 0, y, 0));
    b.add(mesh(new RoundedBoxGeometry(ct * 2, t, d, 1, ct * .8), cov, -w / 2 + ct, t / 2, 0));
    b.add(mesh(new THREE.BoxGeometry(w - ct * 2 - .004, t - 2 * ct, d - .006), PAGES, ct, t / 2, 0));
    return b;
  }
  const cov = k === 'leather' ? leatherMat(col) : coverMat(col), bt = Math.min(.035, t * .14), sq = .04, sp = Math.min(t * .32, .14);
  for (const y of [bt / 2, t - bt / 2]) b.add(mesh(new RoundedBoxGeometry(w - sp * .6, bt, d, 2, bt * .45), cov, sp * .3, y, 0));
  const spine = mesh(new THREE.CylinderGeometry(t / 2, t / 2, d, 20, 1, false), cov, -w / 2 + sp, t / 2, 0); spine.rotation.x = Math.PI / 2; spine.scale.set(sp / (t / 2) * .9, 1, 1); b.add(spine);
  b.add(mesh(new THREE.BoxGeometry(w - sp - sq, t - 2 * bt + .004, d - 2 * sq), PAGES, -w / 2 + sp + (w - sp - sq) / 2, t / 2, 0));
  const hb = (bookSeed % 2) ? BAND : BAND2;
  for (const z of [-d / 2 + sq + .012, d / 2 - sq - .012]) b.add(mesh(new THREE.CylinderGeometry(.022, .022, t - 2 * bt, 8), hb, -w / 2 + sp + .02, t / 2, z));
  if (k === 'leather') for (const z of [-d * .3, d * .3]) b.add(mesh(new THREE.TorusGeometry(t * .44, .006, 4, 16, Math.PI), brass, -w / 2 + sp * .1, t / 2, z).rotateY(Math.PI / 2).rotateZ(Math.PI / 2));
  return b;
};
/* 一摞书：[宽, 厚, 深, 颜色, 转角]；有的书脊朝左、有的朝右 */
const stackOf = (list) => { const s = G(); let y = 0; for (const [w, h, d, c, r, dx = 0, dz = 0] of list){ const b = bookFlat(w, h, d, c); b.position.set(dx, y, dz); b.rotation.y = r + ((bookSeed % 3) ? 0 : Math.PI); s.add(b); y += h; } s.userData.h = y; return s; };
/* 竖着放的一本（书脊朝前）：h 是书高，t 是厚，d 是书脊到书口 */
const UPR = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(0, -1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 0, 0, 0, 0, 1));
const bookUp = (h, t, d, col) => { const b = G(), f = bookFlat(d, t, h, col); f.quaternion.copy(UPR); f.position.set(t / 2, h / 2, 0); b.add(f); return b; };
/* 手写：真的一个字一个字写上去——楷体，每个字大小、歪斜、高低都差一点点，墨色深浅也不匀，看着就是手写的。便签、信纸都用它 */
const handText = (x, str, x0, y, x1, z, ink, lh = 1.7) => {   // 写到 x1 就换行；返回写完以后的 y
  let px = x0; x.textBaseline = 'alphabetic';
  for (const ch of str){
    if (ch === '\n' || px > x1 - z * .9){ px = x0; y += z * lh; if (ch === '\n') continue; }
    const k = .9 + rnd() * .16; x.save(); x.translate(px + z * .5, y + (rnd() - .5) * z * .1); x.rotate((rnd() - .5) * .1);
    x.font = `${(z * k).toFixed(1)}px ${HAND_FONT}`; x.fillStyle = ink.replace('A', (.62 + rnd() * .3).toFixed(2)); x.textAlign = 'center'; x.fillText(ch, 0, 0); x.restore();
    px += z * (/[，。、！？：；]/.test(ch) ? .78 : .98 + rnd() * .06);
  }
  return y + z * lh;
};
/* 手写的纸条（便签、碎碎念） */
const NOTE_TEXT = ['周六去看海\n带上相机\n胶卷还剩十二张', '降温了，\n记得加衣服。\n热水袋在柜子\n第二层', '新歌单：\n下雨天听\n第三首最好听', '买牛奶\n浇花\n回信'];
const drawNote = (x, w, h, bg, ink, text) => {
  x.fillStyle = bg; x.fillRect(0, 0, w, h); noiseDots(x, w, h, 300, .06, ['rgba(120,100,80,A)']);
  handText(x, text, 26, 74, w - 22, 34, ink.replace(/[\d.]+\)$/, 'A)'), 1.42);
};
const NOTE_TEX = [];
const noteTex = (bg, ink, lines = 5, seed = 1) => {
  const t = tex(256, 320, (x, w, h) => drawNote(x, w, h, bg, ink, NOTE_TEXT[seed % NOTE_TEXT.length]));
  t.userData.set = text => { drawNote(t.image.getContext('2d'), 256, 320, bg, ink, text); t.needsUpdate = true; };
  NOTE_TEX.push(t); return t;
};
const clipPin = () => { const c = G(); c.add(mesh(new THREE.BoxGeometry(.12, .5, .07), lightWood, -.035, 0, 0)); c.add(mesh(new THREE.BoxGeometry(.12, .5, .07), lightWood, .035, 0, .02)); c.add(mesh(new THREE.TorusGeometry(.05, .012, 6, 12), brass, 0, -.02, .05)); return c; };

