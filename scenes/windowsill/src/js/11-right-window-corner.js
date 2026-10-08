/* ═════ 右边：窗边一角 ═════ */
// 玻璃瓶里插一枝玉兰（跟着窗外的季节变）
const vase = G(), vaseTips = []; let vaseFl, vaseLf, vaseBd; {
  /* 窗边的玉兰枝：一只长颈玻璃瓶，里面三分之一的水，枝条在水里看得见、到水面处一折；
     枝是下粗上细的老枝，灰褐的皮带几个皮孔；枝头一朵开的、两朵高脚杯形、几颗还裹着绒毛苞片的花苞；桌上落了两三片花瓣 */
  const vr = mkRng(7331), Rr = (a, b) => a + vr() * (b - a);
  const prof = [[0, 0], [.34, 0], [.43, .22], [.45, .7], [.3, 1.15], [.13, 1.45], [.12, 1.95], [.16, 2.0]];
  const glassM = new THREE.MeshPhysicalMaterial({color: '#e6eeea', roughness: .05, transparent: true, opacity: .2, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: .03, envMapIntensity: 2});
  const vg = mesh(lathe(prof, 48), glassM); vg.userData.cd = {}; vg.renderOrder = 3; vase.add(vg);
  const vb = mesh(new THREE.CylinderGeometry(.33, .33, .05, 40), new THREE.MeshPhysicalMaterial({color: '#dfe9e5', roughness: .1, transparent: true, opacity: .5}), 0, .025, 0); vb.userData.cd = {}; vase.add(vb);   // 厚玻璃底
  const water = mesh(lathe([[0, .05], [.33, .05], [.41, .22], [.42, .62], [0, .62]], 40), new THREE.MeshPhysicalMaterial({color: '#c9d8cf', roughness: .02, transparent: true, opacity: .22, depthWrite: false}));
  water.userData.cd = {}; water.renderOrder = 2; vase.add(water);
  const wl = mesh(new THREE.RingGeometry(.05, .42, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: '#f3f7f4', transparent: true, opacity: .25, depthWrite: false}), 0, .62, 0); wl.userData.cd = {}; vase.add(wl);   // 水面一圈亮
  // 枝：自己做一根下粗上细的管
  const barkT = tex(64, 256, (x, w, h) => { x.fillStyle = '#7a7065'; x.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++){ x.fillStyle = `rgba(${vr() < .5 ? '60,52,44' : '160,150,138'},${Rr(.15, .4)})`; x.fillRect(Rr(0, w), Rr(0, h), Rr(1, 3), Rr(4, 14)); } for (let i = 0; i < 10; i++){ x.fillStyle = 'rgba(200,190,170,.7)'; x.fillRect(Rr(0, w), Rr(0, h), Rr(4, 8), 2); } }, {rep: [1, 3]});
  const barkM = new THREE.MeshStandardMaterial({map: barkT, roughness: .85});
  const twig = (pts, r0, r1) => {
    const cv = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(cv, 32, 1, 7), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++){ const u = Math.floor(i / 8) / 32, c = cv.getPoint(Math.min(1, u)), r = r0 + (r1 - r0) * u; p.setXYZ(i, c.x + n.getX(i) * r, c.y + n.getY(i) * r, c.z + n.getZ(i) * r); }
    g.computeVertexNormals(); vase.add(mesh(g, barkM)); return cv;
  };
  const main = twig([V(.02, .08, 0), V(.04, 1.3, .01), V(.06, 1.95, 0), V(-.22, 3.5, .08), V(-.58, 5.3, .05)], .055, .018);
  const b1 = twig([main.getPoint(.6), V(.25, 3.9, -.08), V(.48, 4.6, -.12), V(.78, 5.35, -.15)], .032, .014);
  const b2 = twig([main.getPoint(.47), V(-.4, 3.0, .15), V(-.75, 3.4, .25), V(-1.08, 3.8, .3)], .03, .013);
  const spots = [[main, 1, 'open', .5], [b1, 1, 'goblet', .44], [b2, 1, 'goblet', .4], [main, .82, 'bud', .38], [b1, .66, 'bud', .34], [b2, .7, 'bud', .32], [main, .7, 'bud', .3]];
  const fm = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .5, side: THREE.DoubleSide, emissive: new THREE.Color('#fff4ee'), emissiveIntensity: .07});
  const G3 = {open: flowerStage('open', true), goblet: flowerStage('goblet', true), bud: flowerStage('bud', true)};
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const flG = G(); vase.add(flG); vaseFl = flG;
  for (const [cv, u, st, sc] of spots){
    const p = cv.getPoint(u), d = cv.getTangent(u); vaseTips.push({p, d});
    const f = mesh(G3[st], fm); f.position.copy(p); f.quaternion.setFromUnitVectors(UP, d.clone().multiplyScalar(.5).add(UP).normalize()); f.rotateY(Rr(0, 6.3)); f.scale.setScalar(sc); flG.add(f);
  }
  vaseBd = new THREE.InstancedMesh(budGeo, std('#9a9784', 1), vaseTips.length);
  vaseLf = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .6, side: THREE.DoubleSide}), vaseTips.length * 3);
  vaseTips.forEach((t, i) => {
    q.setFromUnitVectors(UP, t.d.clone().multiplyScalar(.5).add(UP).normalize());
    m4.compose(t.p, q, new THREE.Vector3().setScalar(.35)); vaseBd.setMatrixAt(i, m4);
    for (let k = 0; k < 3; k++){ const a = perp(t.d).addScaledVector(t.d, .5).normalize(); m4.compose(t.p.clone().addScaledVector(t.d, -k * .2), new THREE.Quaternion().setFromUnitVectors(UP, a), new THREE.Vector3().setScalar(.32)); vaseLf.setMatrixAt(i * 3 + k, m4); vaseLf.setColorAt(i * 3 + k, new THREE.Color()); }
  });
  vase.add(vaseBd, vaseLf);
  // 桌上落的花瓣
  const pet = petalGeo(1.0, .32, .4, .1), pm = new THREE.MeshStandardMaterial({vertexColors: true, roughness: .55, side: THREE.DoubleSide});
  for (const [x, z, a] of [[.75, .55, .4], [-.55, .7, 2.1], [.95, .2, 4.0]]){ const pt = mesh(pet, pm, x, .02, z); pt.rotation.set(-Math.PI / 2 + Rr(-.1, .1), 0, a); pt.scale.setScalar(.36); vase.add(pt); vaseTips.petals = (vaseTips.petals || []).concat(pt); }
  vase.position.set(7.75, .006, -2.75); vase.rotation.y = .4; add(vase, null);   // 瓶底抬起一丝，不跟桌面抢深度（之前一直在闪）
}
// 窗下一只矮书柜（收纳台）：下层左边一排竖着的书、右边两只抽屉；上层几本竖的、一小摞平放的书、小相框、小罐子；柜顶放一盆绿植
const bookcase = G(); {
  const W = 3.0, H = 2.3, D = 1.0, T = .1;
  for (const y of [.12, 1.12, H - T / 2]) bookcase.add(mesh(new THREE.BoxGeometry(W, T, D), lightWood, 0, y, 0));
  for (const x of [-W / 2 + T / 2, W / 2 - T / 2]) bookcase.add(mesh(new THREE.BoxGeometry(T, H, D), lightWood, x, H / 2, 0));
  bookcase.add(mesh(new THREE.BoxGeometry(W, H, .04), std('#1f1a16', .85), 0, H / 2, -D / 2 + .02));
  // 原来那一版的书照样做出来（让后面摆件的随机数不变），但不摆上去
  const cols = ['#474a41', '#857a69', '#353b41', '#d6cdbd', '#6a4d43', '#4f5354', '#a2967f', '#5a4b3c', '#474a41'];
  cols.forEach((c, i) => bookUp(.78 + ((i * 37) % 23) / 100, .14 + ((i * 13) % 9) / 100, .78, c));
  for (const [h, t, c] of [[.9, .2, '#d6cdbd'], [.82, .16, '#474a41'], [.75, .18, '#6a4d43']]) bookUp(h, t, .74, c);
  // 后备的柜子（模型没加载出来时顶着）：右下两只抽屉
  bookcase.add(mesh(new THREE.BoxGeometry(.08, .9, D - .08), lightWood, .55, .62, 0));
  for (const y of [.395, .845]){ bookcase.add(mesh(new RoundedBoxGeometry(.78, .42, .06, 2, .015), lightWood, .995, y, D / 2 - .05)); bookcase.add(mesh(new THREE.SphereGeometry(.05, 16, 10), brass, .995, y, D / 2 - .01)); }
  bookcase.userData.old = [...bookcase.children];
  /* 书：下层左边一排竖着的，高矮厚薄不一，最右边一只铁书挡、一只带盖的小陶罐；
     上层左边四五本竖着的，挨着一小摞平放的书，书上压一块圆石头 */
  const br = mkRng(4242), BR = (a, b) => a + br() * (b - a);
  const PAL = ['#474a41', '#857a69', '#353b41', '#d6cdbd', '#6a4d43', '#4f5354', '#a2967f', '#5a4b3c', '#7a8a84', '#9b6b55', '#c9bfa8', '#2c2825', '#5d6b73'];
  const KINDS = ['cloth', 'cloth', 'leather', 'paper', 'cloth', 'paper'];
  let ti = 0, sd = 1;
  const fillRow = (xa, xb, y, hMin, hMax) => {
    let x = xa;
    for (;;){
      const t = BR(.12, .24), h = BR(hMin, hMax), d = BR(.66, .78);
      if (x + t > xb) break;
      const b = shelfBook(h, t, d, PAL[(br() * PAL.length) | 0], KINDS[(br() * KINDS.length) | 0], SPINE_TITLES[ti++ % SPINE_TITLES.length], sd++);
      b.position.set(x + t / 2, y, .4 - d / 2); b.rotation.y = BR(-.03, .03); bookcase.add(b); x += t + BR(.006, .02);
    }
    return x;
  };
  const xe = fillRow(-W / 2 + T + .02, .16, .17, .7, .86);
  const iron = std('#2b2a28', .55, {metalness: .6});
  bookcase.add(mesh(new THREE.BoxGeometry(.02, .5, .36), iron, xe + .012, .17 + .25, .1));
  bookcase.add(mesh(new THREE.BoxGeometry(.16, .012, .36), iron, xe + .1, .176, .1));   // 书挡：竖着一片，脚往右伸
  { const jar = G(), jm = new THREE.MeshPhysicalMaterial({color: '#c9c0b0', map: speckTex, roughness: .55, clearcoat: .3});
    jar.add(mesh(lathe([[0, 0], [.1, 0], [.115, .03], [.12, .14], [.1, .17], [0, .17]], 32), jm));
    jar.add(mesh(lathe([[0, .2], [.105, .17], [.11, .16], [0, .16]], 32), jm)); jar.add(mesh(new THREE.SphereGeometry(.025, 12, 8), std('#6a4d43', .6), 0, .21, 0));
    jar.position.set(Math.min(.37, xe + .27), .17, .05); bookcase.add(jar); }
  const xu = fillRow(-W / 2 + T + .03, -.68, 1.17, .72, .92);
  { const st = G(); let y = 0;
    for (const [w, t, d, c, r, k] of [[.56, .1, .74, '#d6cdbd', .04, 'cloth'], [.52, .12, .7, '#5d6b73', -.06, 'leather'], [.48, .09, .66, '#9b6b55', .08, 'paper']]){ const b = bookFlat(w, t, d, c, k); b.position.y = y; b.rotation.y = r; st.add(b); y += t; }
    st.position.set((xu + .12) / 2 + .02, 1.17, -.03); bookcase.add(st);
    const stone = mesh(new THREE.SphereGeometry(.12, 24, 16), new THREE.MeshPhysicalMaterial({color: '#b3ada2', map: speckTex, roughness: .6, clearcoat: .2}), 0, 0, 0); stone.scale.set(1.2, .62, .95); stone.position.set(st.position.x + .03, 1.17 + y + .07, -.02); bookcase.add(stone); }   // 书上压一块圆石头
  { const fr = G(), pic = tex(160, 200, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#cfdbe0'); g.addColorStop(1, '#efe0cc'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(214,170,180,.9)'; for (let i = 0; i < 9; i++){ x.beginPath(); x.ellipse(40 + (i % 3) * 38, 60 + Math.floor(i / 3) * 34, 14, 9, i, 0, 7); x.fill(); } x.strokeStyle = 'rgba(110,100,90,.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(80, 190); x.lineTo(80, 70); x.stroke(); });
    fr.add(mesh(new RoundedBoxGeometry(.66, .84, .06, 2, .02), brass, 0, .42, 0)); fr.add(mesh(new THREE.PlaneGeometry(.52, .68), std('#ffffff', .8, {map: pic}), 0, .42, .035)); fr.rotation.x = -.12; fr.position.set(.5, 1.17, .05); bookcase.add(fr); }
  { const j = G(); j.add(mesh(new THREE.CylinderGeometry(.2, .2, .42, 20, 1, true), new THREE.MeshPhysicalMaterial({color: '#eef3f2', roughness: .05, transparent: true, opacity: .3, side: THREE.DoubleSide}), 0, .21, 0)); j.add(mesh(new THREE.CylinderGeometry(.17, .17, .26, 16), std('#d9b06a', .7), 0, .14, 0)); j.add(mesh(new THREE.CylinderGeometry(.19, .19, .07, 16), lightWood, 0, .45, 0)); j.position.set(1.15, 1.17, .05); bookcase.add(j); }
  bookcase.position.set(9.7, 0, -2.75); add(bookcase, null);
}
{
  const COVER = {c0: '#353b41', c1: '#474a41', c2: '#6a4d43', c3: '#857a69', c4: '#2c2825', c5: '#a2967f'}, FM = {wood: lightWood, back: new THREE.MeshStandardMaterial({map: woodPale, color: '#8a7a68', roughness: .8}), pages: PAGES, band: std('#5a2a20', .7), gilt: brass};
  for (const k in COVER) FM[k] = coverMat(COVER[k]);
  swapIn('./models/bookcase.gltf.json', bookcase, FM); swapIn('./models/organizer.gltf.json', shelf, FM);
}
// 柜顶一盆绿萝：哑光米白陶盆，几根藤从盆沿拱出来，一根往窗那边伸，两根顺着柜子边垂下去；叶子是心形的，带一点黄白的斑，越往藤梢越小
{
  const pr = mkRng(5151), R = (a, b) => a + pr() * (b - a);
  const pl = G();
  const potM = new THREE.MeshPhysicalMaterial({color: '#d8d0c3', map: speckTex, roughness: .78, clearcoat: .1});
  pl.add(mesh(lathe([[0, .02], [.3, .02], [.33, .06], [.37, .5], [.4, .56], [.41, .6], [.38, .61], [.35, .56], [0, .56]], 48), potM));
  pl.add(mesh(new THREE.CircleGeometry(.36, 32).rotateX(-Math.PI / 2), std('#3a2e25', 1), 0, .55, 0));
  pl.add(mesh(new THREE.CylinderGeometry(.33, .33, .02, 32), new THREE.MeshStandardMaterial({color: '#6b5e52', roughness: .9}), 0, .01, 0));   // 盆底垫的一片小陶盘
  // 叶子：心形，沿主脉对折一点、整片往下弯；贴图是深绿底、几道浅色的斑和叶脉
  const leafT = tex(256, 256, (x, w, h) => {
    x.fillStyle = '#3f6a35'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++){ x.save(); x.translate(w / 2, h * .9); x.rotate(R(-.9, .9)); const g = x.createLinearGradient(0, 0, 0, -h); g.addColorStop(0, 'rgba(214,214,150,0)'); g.addColorStop(.5, `rgba(214,214,150,${R(.25, .55)})`); g.addColorStop(1, 'rgba(214,214,150,0)'); x.fillStyle = g; x.fillRect(-R(3, 9), -h, R(6, 18), h); x.restore(); }
    x.strokeStyle = 'rgba(200,220,170,.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, h * .95); x.lineTo(w / 2, h * .05); x.stroke();
    x.lineWidth = 1.5; for (let k = 0; k < 5; k++){ const y = h * (.8 - k * .14); for (const s of [-1, 1]){ x.beginPath(); x.moveTo(w / 2, y); x.quadraticCurveTo(w / 2 + s * w * .2, y - h * .06, w / 2 + s * w * .36, y - h * .18); x.stroke(); } }
  });
  const hs = new THREE.Shape(); hs.moveTo(0, 0); hs.bezierCurveTo(-.32, .06, -.5, .42, -.3, .7); hs.bezierCurveTo(-.18, .86, -.06, .95, 0, 1.05); hs.bezierCurveTo(.06, .95, .18, .86, .3, .7); hs.bezierCurveTo(.5, .42, .32, .06, 0, 0);
  const lg = new THREE.ShapeGeometry(hs, 10), lp = lg.attributes.position, luv = lg.attributes.uv;
  for (let i = 0; i < lp.count; i++){ const x = lp.getX(i), y = lp.getY(i); luv.setXY(i, x * .95 + .5, y / 1.05); lp.setZ(i, Math.abs(x) * .28 - y * y * .12); }   // 对折 + 下弯
  lg.rotateX(-Math.PI / 2); lg.computeVertexNormals();
  const leafM = new THREE.MeshPhysicalMaterial({map: leafT, roughness: .42, clearcoat: .35, clearcoatRoughness: .4, side: THREE.DoubleSide});
  const vineM = std('#5d7a43', .7), stemM = std('#6f8a4e', .7);
  const vines = [
    [V(.05, .56, 0), V(.2, .9, -.15), V(.55, 1.05, -.25), V(.95, .95, -.2), V(1.2, .7, -.1)],                      // 往窗那边拱
    [V(-.1, .56, .1), V(-.3, .8, .25), V(-.45, .65, .45), V(-.5, .2, .55), V(-.55, -.3, .55), V(-.58, -.75, .53)],  // 顺着柜子前沿垂下
    [V(.15, .56, .12), V(.3, .75, .32), V(.35, .55, .5), V(.36, .0, .54), V(.38, -.45, .53)],
    [V(0, .56, -.05), V(-.05, 1.0, -.1), V(.05, 1.35, -.2), V(.15, 1.5, -.3)],                                    // 中间立起来的一根
    [V(-.15, .56, -.1), V(-.35, .85, -.2), V(-.6, .9, -.15), V(-.8, .7, -.05)],
  ];
  for (const pts of vines){
    const cv = new THREE.CatmullRomCurve3(pts), L = cv.getLength();
    pl.add(mesh(new THREE.TubeGeometry(cv, 40, .014, 5), vineM));
    const n = Math.max(4, Math.round(L / .17));
    for (let k = 1; k <= n; k++){
      const u = k / (n + .3), p = cv.getPoint(u), tg = cv.getTangent(u), side = k % 2 ? 1 : -1, sz = .32 * (1 - u * .55) * R(.85, 1.1);
      const out = new THREE.Vector3().crossVectors(tg, UP).normalize().multiplyScalar(side); if (out.lengthSq() < .1) out.set(side, 0, 0);
      const pe = p.clone().addScaledVector(out, .07).add(V(0, .05, 0));
      pl.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p, p.clone().addScaledVector(out, .04).add(V(0, .05, 0)), pe]), 4, .007, 4), stemM));
      const lf = mesh(lg, leafM); lf.scale.setScalar(sz); lf.position.copy(pe);
      const face = out.clone().multiplyScalar(.7).add(V(0, .5, 0)).addScaledVector(tg, .3).normalize();   // 叶尖朝外、微微朝上
      lf.lookAt(pe.clone().add(face)); lf.rotateX(Math.PI / 2 - R(.2, .6)); lf.rotateY(R(-.4, .4));
      pl.add(lf);
    }
  }
  pl.position.set(10.7, 2.3, -2.45); pl.rotation.y = .2; add(pl, null);
}
// 右前：一摞书，上面放小木盒（玩具厅）
{ const st = stackOf([[2.4, .34, 1.7, '#a2967f', .04], [2.2, .3, 1.55, '#353b41', -.1], [2.0, .3, 1.4, '#6a4d43', .14]]); at(st, 11.0, 0, 1.55, -.2); add(st, null); }
const toys = G(); {
  /* 玩具厅：一只曲木盒（杉木薄板弯成一圈，接口处两层木板叠着，用樱树皮一针针缝起来；盒口里还套着一圈矮一点的内圈，原来盖子就扣在它上面）。
     盖子收起来了，盒子敞着：一只描了红蓝圈的木陀螺和一卷绕陀螺的棉绳、两颗骰子、两枚铜钱、三颗玻璃弹珠；一小叠塔罗牌斜靠在盒壁上，最上面那张翻开着 */
  const tr = mkRng(3131), R = (a, b) => a + tr() * (b - a);
  const SEAM = .35, r0 = .62, H0 = .42, t0 = .035;   // 接口在哪个角度、盒子半径、高、壁厚
  const woodT = tex(1024, 256, (x, w, h) => {   // 杉木：直纹顺着一圈走，夹着几道红褐色的心材带；接口处外层板的边削薄了，看得见一道斜的边
    x.fillStyle = '#9c734b'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++){ const y = R(0, h), t = R(6, 24), g = x.createLinearGradient(0, y - t, 0, y + t); g.addColorStop(0, 'rgba(118,58,30,0)'); g.addColorStop(.5, `rgba(118,58,30,${R(.12, .3)})`); g.addColorStop(1, 'rgba(118,58,30,0)'); x.fillStyle = g; x.fillRect(0, y - t, w, 2 * t); }
    for (let i = 0; i < 170; i++){ const y = R(0, h); x.strokeStyle = `rgba(${tr() < .65 ? '72,44,24' : '206,170,124'},${R(.08, .3)})`; x.lineWidth = R(.4, 1.8); x.beginPath(); x.moveTo(0, y); for (let u = 0; u <= w; u += 24) x.lineTo(u, y + Math.sin(u * .006 + i) * 1.6); x.stroke(); }
    for (let i = 0; i < 2600; i++){ x.fillStyle = `rgba(${tr() < .5 ? '60,38,20' : '220,190,150'},${R(.03, .1)})`; x.fillRect(R(0, w), R(0, h), R(1, 6), 1); }   // 细细的木刺、导管
    const sx = SEAM / (2 * Math.PI) * w; const g = x.createLinearGradient(sx - 40, 0, sx, 0); g.addColorStop(0, 'rgba(60,36,18,0)'); g.addColorStop(1, 'rgba(60,36,18,.35)'); x.fillStyle = g; x.fillRect(sx - 40, 0, 40, h);
    x.fillStyle = 'rgba(48,28,14,.55)'; x.fillRect(sx, 0, 2, h);
  });
  woodT.wrapS = THREE.RepeatWrapping;
  const woodM = new THREE.MeshPhysicalMaterial({map: woodT, roughness: .55, clearcoat: .18, clearcoatRoughness: .55, side: THREE.DoubleSide}), inM = new THREE.MeshStandardMaterial({color: '#a5805a', roughness: .8});
  // 盒身：薄壁 + 底
  const wall = (r, H, t) => [[r - t, H], [r - t, .03], [0, .03], [0, 0], [r, 0], [r, H], [r - t * .3, H + .006]];
  toys.add(mesh(lathe(wall(r0, H0, t0), 64), woodM));
  toys.add(mesh(new THREE.CircleGeometry(r0 - t0 + .001, 48).rotateX(-Math.PI / 2), inM, 0, .031, 0));
  // 内圈：比外壁高出一截
  const ri = r0 - t0 - .022, ro = r0 - t0;
  toys.add(mesh(lathe([[ri, H0 + .045], [ri, H0 - .16], [ro, H0 - .16], [ro, H0 + .045], [ro - .005, H0 + .056], [ri + .006, H0 + .056], [ri, H0 + .045]], 64), woodM));
  // 樱树皮缝的接口：深褐发亮的一条，上面一针针斜着压过去
  const barkT = tex(64, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    for (let y = 6; y < h - 6; y += 13){ const gr = x.createLinearGradient(0, y, 0, y + 9); gr.addColorStop(0, '#2c1d16'); gr.addColorStop(.45, '#6b4a38'); gr.addColorStop(1, '#24170f'); x.fillStyle = gr;
      x.beginPath(); x.moveTo(8, y + 4); x.lineTo(w - 8, y); x.lineTo(w - 8, y + 7); x.lineTo(8, y + 11); x.closePath(); x.fill(); }
  });
  const barkM = new THREE.MeshPhysicalMaterial({map: barkT, transparent: true, alphaTest: .4, roughness: .35, clearcoat: .6, side: THREE.DoubleSide});
  for (const [rr, y0, y1] of [[r0 + .003, .05, H0 - .04], [ri - .002, H0 - .13, H0 + .03]]){
    const g = new THREE.CylinderGeometry(rr, rr, y1 - y0, 4, 1, true, SEAM - .06, .12); g.translate(0, (y0 + y1) / 2, 0); toys.add(mesh(g, barkM));
  }
  // 陀螺：横躺着；旁边一卷绕陀螺的棉绳，绳头散出来一截
  const topT = tex(64, 128, (x, w, h) => { x.fillStyle = '#c9a072'; x.fillRect(0, 0, w, h); [['#9c3b2e', 30, 10], ['#2e3f63', 52, 8], ['#9c3b2e', 70, 5], ['#2e3f63', 96, 9]].forEach(([c, y, t]) => { x.fillStyle = c; x.fillRect(0, y, w, t); }); });
  const top = mesh(lathe([[0, 0], [.03, .02], [.18, .14], [.24, .2], [.22, .25], [.05, .27], [.03, .36], [0, .37]], 32), new THREE.MeshPhysicalMaterial({map: topT, roughness: .38, clearcoat: .5}), -.22, .05, .12);
  top.rotation.set(.3, 0, .9); toys.add(top);
  { const P = []; for (let k = 0; k <= 120; k++){ const a = k / 120 * Math.PI * 2 * 3.3, rr = .028 + .0165 * a / (2 * Math.PI); P.push(V(Math.cos(a) * rr, .012 + .006 * Math.sin(a * 3) * (k / 120), Math.sin(a) * rr)); }
    const a1 = Math.PI * 2 * 3.3, end = P[P.length - 1]; P.push(V(end.x + .06, .012, end.z + .05), V(end.x + .12, .014, end.z + .14), V(end.x + .1, .012, end.z + .22));
    const cord = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P), 260, .0085, 6), std('#d9ceb6', .95), .0, .031, .25); cord.rotation.y = 2.6; toys.add(cord); }
  // 骰子：象牙白，点是凹进去的深红/黑
  const pip = n => tex(64, 64, (x) => { x.fillStyle = '#efe8da'; x.fillRect(0, 0, 64, 64); const P = {1: [[32, 32]], 2: [[18, 18], [46, 46]], 3: [[16, 16], [32, 32], [48, 48]], 4: [[18, 18], [46, 18], [18, 46], [46, 46]], 5: [[16, 16], [48, 16], [32, 32], [16, 48], [48, 48]], 6: [[18, 14], [46, 14], [18, 32], [46, 32], [18, 50], [46, 50]]}[n];
    x.fillStyle = n === 1 ? '#9c2a24' : '#1d1a18'; P.forEach(([a, b]) => { x.beginPath(); x.arc(a, b, n === 1 ? 8 : 5.5, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(a + 1.5, b + 1.5, n === 1 ? 5 : 3, 0, 7); x.fill(); x.fillStyle = n === 1 ? '#9c2a24' : '#1d1a18'; }); });
  const dm = [1, 6, 2, 5, 3, 4].map(n => new THREE.MeshPhysicalMaterial({map: pip(n), roughness: .3, clearcoat: .4}));
  for (const [x, z, ry] of [[.3, .1, .4], [.2, .33, 1.1]]){ const d = mesh(new RoundedBoxGeometry(.16, .16, .16, 2, .025), dm, x, .11, z); d.rotation.set(0, ry, 0); toys.add(d); }
  // 铜钱：外圆内方，正面四个字（编的），边上一圈高起来的郭，带一点铜绿
  const coinT = tex(128, 128, (x, w, h) => {
    x.fillStyle = '#8c6b3d'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++){ x.fillStyle = tr() < .55 ? `rgba(70,120,96,${R(.08, .3)})` : `rgba(60,40,20,${R(.08, .25)})`; x.beginPath(); x.arc(R(0, w), R(0, h), R(1, 5), 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(214,176,112,.75)'; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, h / 2, w * .44, 0, 7); x.stroke();
    x.lineWidth = 4; x.strokeRect(w / 2 - 19, h / 2 - 19, 38, 38);
    x.fillStyle = 'rgba(222,186,120,.85)'; x.font = `700 24px ${SERIF}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    [['赴', 0, -1], ['约', 0, 1], ['通', 1, 0], ['宝', -1, 0]].forEach(([c, a, b]) => x.fillText(c, w / 2 + a * 36, h / 2 + b * 36));
  });
  coinT.repeat.set(1 / .22, 1 / .22); coinT.offset.set(.5, .5);
  const coinS = new THREE.Shape(); coinS.absarc(0, 0, .11, 0, Math.PI * 2); const hole = new THREE.Path(); hole.moveTo(-.03, -.03); hole.lineTo(.03, -.03); hole.lineTo(.03, .03); hole.lineTo(-.03, .03); coinS.holes.push(hole);
  const coinG = new THREE.ExtrudeGeometry(coinS, {depth: .014, bevelEnabled: true, bevelSize: .004, bevelThickness: .003, bevelSegments: 1, curveSegments: 28}).rotateX(-Math.PI / 2);
  const coinM = [new THREE.MeshStandardMaterial({map: coinT, metalness: .75, roughness: .45}), new THREE.MeshStandardMaterial({color: '#8a6a3c', metalness: .8, roughness: .45})];
  for (const [x, z, rx] of [[.4, -.18, 0], [.3, -.3, .25]]){ const cn = mesh(coinG, coinM, x, .04 + rx * .1, z); cn.rotation.x = rx; toys.add(cn); }
  // 玻璃弹珠：透明的球，里面一瓣彩色的芯
  const glassM = new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: .02, transparent: true, opacity: .35, clearcoat: 1, envMapIntensity: 2.2});
  for (const [x, z, col] of [[-.4, -.18, '#2f6f8f'], [-.05, .45, '#c9783a'], [-.28, -.4, '#3f7a52']]){
    toys.add(mesh(new THREE.SphereGeometry(.07, 20, 14), glassM, x, .1, z));
    const core = mesh(new THREE.SphereGeometry(.045, 12, 8), new THREE.MeshStandardMaterial({color: col, roughness: .3, emissive: col, emissiveIntensity: .15}), x, .1, z); core.scale.set(.35, 1, .9); core.rotation.z = R(0, 3); toys.add(core);
  }
  // 塔罗牌：一小叠，深蓝底、金线画的星月；最上面一张翻开：十七号「星」（自己画的：一颗八角大星、七颗小星、底下一汪水）
  const backT = tex(128, 220, (x, w, h) => { x.fillStyle = '#1d2638'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c9a85c'; x.lineWidth = 2; x.strokeRect(8, 8, w - 16, h - 16);
    x.beginPath(); x.arc(w / 2, h / 2, 26, 0, 7); x.stroke(); x.fillStyle = '#1d2638'; x.beginPath(); x.arc(w / 2 + 10, h / 2 - 6, 22, 0, 7); x.fill();
    x.fillStyle = '#c9a85c'; for (const [a, b] of [[30, 40], [98, 52], [40, 176], [92, 168], [64, 30]]){ x.beginPath(); for (let k = 0; k < 10; k++){ const an = k / 10 * Math.PI * 2, rr = k % 2 ? 2.5 : 6; x.lineTo(a + Math.cos(an) * rr, b + Math.sin(an) * rr); } x.fill(); } });
  const star = (x, cx, cy, R1, R2, n) => { x.beginPath(); for (let k = 0; k < n * 2; k++){ const an = k / (n * 2) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? R2 : R1; x.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } x.closePath(); };
  const faceT = tex(256, 440, (x, w, h) => {
    x.fillStyle = '#efe6d2'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++){ x.fillStyle = `rgba(150,120,80,${R(.03, .08)})`; x.fillRect(R(0, w), R(0, h), R(1, 3), R(1, 3)); }
    x.strokeStyle = '#b8954e'; x.lineWidth = 3; x.strokeRect(12, 12, w - 24, h - 24); x.lineWidth = 1; x.strokeRect(19, 19, w - 38, h - 38);
    const sky = x.createLinearGradient(0, 40, 0, 300); sky.addColorStop(0, '#22304a'); sky.addColorStop(1, '#5b6f86'); x.fillStyle = sky; x.fillRect(26, 52, w - 52, 250);
    x.fillStyle = '#e8c878'; star(x, w / 2, 150, 58, 22, 8); x.fill(); x.strokeStyle = '#b8954e'; x.lineWidth = 1.5; x.stroke();
    for (const [a, b] of [[58, 78], [198, 80], [52, 196], [204, 200], [86, 250], [170, 246], [128, 70]]){ star(x, a, b, 10, 4, 8); x.fill(); }
    x.fillStyle = '#7e95a8'; x.fillRect(26, 302, w - 52, 74); x.strokeStyle = 'rgba(240,236,224,.7)'; x.lineWidth = 2;
    for (let k = 0; k < 4; k++){ x.beginPath(); for (let u = 30; u <= w - 30; u += 8) x.lineTo(u, 318 + k * 16 + Math.sin(u * .08 + k) * 3); x.stroke(); }
    x.fillStyle = '#3a3128'; x.font = `600 22px ${SERIF}`; x.textAlign = 'center'; x.fillText('XVII', w / 2, 44); x.font = `600 24px ${SERIF}`; x.fillText('星', w / 2, 410);
  });
  const edge = new THREE.MeshStandardMaterial({color: '#e9e2d2'});
  const cardM = [edge, edge, new THREE.MeshStandardMaterial({map: backT, roughness: .5}), edge, edge, edge];
  const deck = G(); for (let i = 0; i < 6; i++){ const cd = mesh(new THREE.BoxGeometry(.36, .008, .6), cardM, R(-.01, .01), i * .009, R(-.01, .01)); cd.rotation.y = R(-.05, .05); deck.add(cd); }
  const faceUp = mesh(new THREE.BoxGeometry(.36, .008, .6), [edge, edge, new THREE.MeshPhysicalMaterial({map: faceT, roughness: .45, clearcoat: .3}), edge, edge, edge], .07, .056, .03); faceUp.rotation.y = .2; deck.add(faceUp);
  deck.position.set(.05, .21, -.3); deck.rotation.set(.62, .15, 0); toys.add(deck);   // 塔罗也收进盒子里，斜靠在盒壁上
  toys.position.set(10.95, .94, 1.5); toys.rotation.y = -.35; add(toys, 'toys');
}
// 摊开的旅行手帐：左页贴着照片和车票，右页压着一片玉兰花瓣、一张邮票，几条纸胶带
const journal = G();   // 摊开的旅行手帐（出门走走）
{
  const jL = tex(720, 1024, (x, w, h) => {
    x.fillStyle = '#f3ecdf'; x.fillRect(0, 0, w, h); noiseDots(x, w, h, 2500, .06, ['rgba(140,120,96,A)']);
    for (let y = 90; y < h - 60; y += 46){ x.strokeStyle = 'rgba(150,140,128,.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(60, y); x.lineTo(w - 50, y); x.stroke(); }
    // 拍立得照片（画的是一片湖和远山）
    x.save(); x.translate(250, 330); x.rotate(-.06); x.fillStyle = '#fbfaf6'; x.fillRect(-170, -190, 340, 400); const g = x.createLinearGradient(0, -170, 0, 140); g.addColorStop(0, '#c9dbe3'); g.addColorStop(.55, '#f1dcc4'); g.addColorStop(1, '#9fb3ad'); x.fillStyle = g; x.fillRect(-150, -170, 300, 300);
    x.fillStyle = 'rgba(110,130,128,.7)'; x.beginPath(); x.moveTo(-150, 40); for (let i = 0; i <= 10; i++) x.lineTo(-150 + i * 30, 20 - Math.sin(i * .8) * 26 - (i % 3) * 8); x.lineTo(150, 60); x.lineTo(-150, 60); x.fill(); x.restore();
    x.fillStyle = 'rgba(221,196,150,.75)'; x.save(); x.translate(250, 140); x.rotate(.12); x.fillRect(-70, -18, 140, 36); x.restore();
    // 车票
    x.save(); x.translate(400, 700); x.rotate(.08); x.fillStyle = '#e9dcc6'; x.fillRect(-200, -70, 400, 140); x.strokeStyle = 'rgba(120,100,80,.6)'; x.setLineDash([6, 6]); x.beginPath(); x.moveTo(110, -70); x.lineTo(110, 70); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(60,54,48,.85)'; x.font = '600 34px "Noto Serif CJK SC", serif'; x.fillText('赴 约', -170, -10); x.font = '400 20px system-ui, sans-serif'; x.fillText('No. 0121 · 单程', -170, 30); x.fillStyle = 'rgba(168,104,124,.8)'; x.beginPath(); x.arc(160, 0, 26, 0, 7); x.fill(); x.restore();
    handText(x, '江边起风了，坐了一站慢车，\n在终点站买了一张明信片。', 80, 868, w - 70, 30, 'rgba(58,48,42,A)', 1.55);
  });
  const jR = tex(720, 1024, (x, w, h) => {
    x.fillStyle = '#f3ecdf'; x.fillRect(0, 0, w, h); noiseDots(x, w, h, 2500, .06, ['rgba(140,120,96,A)']);
    for (let y = 90; y < h - 60; y += 46){ x.strokeStyle = 'rgba(150,140,128,.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(50, y); x.lineTo(w - 60, y); x.stroke(); }
    // 压干的玉兰花瓣
    x.save(); x.translate(300, 300); x.rotate(-.5); const pg = x.createLinearGradient(0, -160, 0, 160); pg.addColorStop(0, '#f6efe9'); pg.addColorStop(1, '#d8a9b6'); x.fillStyle = pg; x.beginPath(); x.ellipse(0, 0, 80, 170, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(170,120,130,.4)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 160); x.lineTo(0, -140); x.stroke(); x.restore();
    x.fillStyle = 'rgba(200,214,196,.7)'; x.save(); x.translate(300, 120); x.rotate(-.2); x.fillRect(-80, -16, 160, 32); x.restore();
    // 邮票：锯齿边，里面一棵小树
    x.save(); x.translate(540, 220); x.rotate(.06); x.fillStyle = '#fbf8f1'; x.fillRect(-90, -110, 180, 220); x.fillStyle = '#f3ecdf'; for (let i = -90; i <= 90; i += 18){ x.beginPath(); x.arc(i, -110, 6, 0, 7); x.arc(i, 110, 6, 0, 7); x.fill(); } for (let i = -110; i <= 110; i += 18){ x.beginPath(); x.arc(-90, i, 6, 0, 7); x.arc(90, i, 6, 0, 7); x.fill(); }
    x.fillStyle = '#d9e4e6'; x.fillRect(-72, -92, 144, 150); x.fillStyle = '#474a41'; x.beginPath(); x.arc(0, -30, 46, 0, 7); x.fill(); x.fillStyle = '#6b5a48'; x.fillRect(-5, 0, 10, 52); x.fillStyle = 'rgba(60,54,48,.8)'; x.font = '500 22px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('121', 0, 92); x.restore();
    handText(x, '路过一棵玉兰，捡了一片花瓣夹在这页。回来的路上下了点小雨，在车站等了一会儿，看云从山那边过来。下次一起去。', 70, 628, w - 66, 30, 'rgba(58,48,42,A)', 1.55);
  });
  const J = journal, W = 1.6, D = 2.2;
  J.add(mesh(new RoundedBoxGeometry(W * 2 + .16, .05, D + .14, 2, .02), coverMat('#5a4b3c'), 0, .025, 0));
  const lift = (u) => .05 + .07 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, u * 1.05))), .6);
  for (const s of [-1, 1]){
    const pg = new THREE.PlaneGeometry(W, D, 16, 1), pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++){ const u = pp.getX(i) / W + .5; pp.setXYZ(i, s * u * W, lift(u) + .03, -pp.getY(i)); }
    pg.computeVertexNormals(); if (s < 0){ const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    const pm = mesh(pg, new THREE.MeshStandardMaterial({map: s < 0 ? jL : jR, roughness: .9, side: THREE.DoubleSide})); pm.userData.noCast = true; J.add(pm);
    const blk = new THREE.BoxGeometry(W - .1, .04, D - .04); blk.translate(s * (W / 2 + .02), .05, 0); J.add(mesh(blk, PAGES));
  }
  J.position.set(7.75, 0, .5); J.rotation.y = -.18; add(J, 'trips');
}
/* ── 笔：铅笔是六棱的，漆面有一点光，一面烫着金字；削过的一头露出木头锥和石墨芯，锥和漆面交界是一圈波浪边；
   另一头是一截压了纹的铝箍和粉橡皮（没橡皮的那头看得见木头截面和芯）。钢笔：黑漆笔杆、金夹子金环；圆珠笔：哑光的杆、按头、金属夹 ── */
const penR = mkRng(2510);
const PEN = {
  wood: std('#d8bb90', .82), lead: std('#2a2a2d', .35, {metalness: .55}), rub: std('#d9a39b', .9),
  alu: std('#cfc8ba', .32, {metalness: .9}), gold: std('#c9a35e', .28, {metalness: .95}), steel: std('#c4c6c8', .25, {metalness: .95})
};
const pencilTex = (col, label) => tex(192, 512, (x, w, h) => {
  x.fillStyle = col; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++){ x.fillStyle = `rgba(255,255,255,${.015 + penR() * .03})`; x.fillRect(penR() * w, 0, 1 + penR() * 2, h); }   // 漆面上顺着笔杆的细刷痕
  for (let k = 0; k < 6; k++){ x.fillStyle = k % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.035)'; x.fillRect(k * w / 6, 0, w / 6, h); }   // 六个面亮暗不一
  x.save(); x.translate(w / 12, h * .5); x.rotate(-Math.PI / 2); x.fillStyle = 'rgba(214,182,112,.92)'; x.font = '600 15px "Noto Serif CJK SC", serif'; x.textAlign = 'center'; x.fillText(label, 0, 5); x.restore();   // 烫金字
});
const endTex = tex(64, 64, (x, w, h) => {   // 没削的那头：木头截面，年轮一圈圈，中间一点黑芯
  x.fillStyle = '#d2b388'; x.fillRect(0, 0, w, h);
  for (let r = 4; r < 34; r += 2.5){ x.strokeStyle = `rgba(150,110,70,${.12 + penR() * .15})`; x.lineWidth = 1; x.beginPath(); x.arc(w / 2 + 3, h / 2 - 2, r, 0, 7); x.stroke(); }
  x.fillStyle = '#2b2b2e'; x.beginPath(); x.arc(w / 2, h / 2, 6.5, 0, 7); x.fill();
});
const mkPencil = (L, col, {eraser = true, label = 'HB'} = {}) => {
  const g = G(), r = .042, coneL = .2, ferL = eraser ? .11 : 0, erL = eraser ? .075 : 0, bodyL = L - coneL - ferL - erL;
  const paint = new THREE.MeshPhysicalMaterial({map: pencilTex(col, label), roughness: .34, clearcoat: .55, clearcoatRoughness: .3, flatShading: true});
  let y = 0;
  if (eraser){
    const er = new THREE.CylinderGeometry(r * .92, r * .92, erL, 18); er.translate(0, erL / 2, 0);
    const top = new THREE.SphereGeometry(r * .92, 18, 4, 0, Math.PI * 2, 0, Math.PI / 2); top.scale(1, .22, 1); top.translate(0, erL, 0);   // 橡皮头用过一点：圆圆的
    g.add(mesh(mergeGeometries([er.toNonIndexed(), top.toNonIndexed()].map(q => (q.deleteAttribute('uv'), q))), PEN.rub));
    y = erL;
    g.add(mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.04, ferL, 20), PEN.alu, 0, y + ferL / 2, 0));
    for (const k of [.2, .32, .68, .8]){ const t = new THREE.TorusGeometry(r * 1.04, .0045, 4, 20); t.rotateX(Math.PI / 2); g.add(mesh(t, PEN.alu, 0, y + ferL * k, 0)); }   // 铝箍上压的几道纹
    y += ferL;
  } else {
    const c = new THREE.CircleGeometry(r, 6); c.rotateX(Math.PI / 2); g.add(mesh(c, new THREE.MeshStandardMaterial({map: endTex, roughness: .85}), 0, .001, 0));
  }
  g.add(mesh(new THREE.CylinderGeometry(r, r, bodyL, 6), paint, 0, y + bodyL / 2, 0)); y += bodyL;
  // 削过的一头：圆锥从六棱里削出来，六个平面上露出木头、六个棱角上留着尖尖的漆：一圈波浪边
  const cone = new THREE.CylinderGeometry(.014, r * .985, coneL * .84, 24, 3); cone.translate(0, coneL * .42 - .028, 0);
  g.add(mesh(cone, PEN.wood, 0, y, 0));
  g.add(mesh(new THREE.CylinderGeometry(.0015, .014, coneL * .2, 12), PEN.lead, 0, y - .028 + coneL * .84 + coneL * .1, 0));
  return g;
};
const mkPen = (L, body, {fountain = false} = {}) => {   // 笔尖在 y=L；笔帽（按头）那头在 y=0
  const g = G(), pts = fountain
    ? [[0, 0], [.04, 0], [.05, .02], [.052, .45], [.05, .62], [.044, .64], [.046, .66], [.05, L * .62], [.045, L * .82], [.03, L * .93], [0, L]]
    : [[0, 0], [.02, 0], [.022, .06], [.04, .07], [.044, .1], [.044, L * .7], [.04, L * .86], [.022, L * .96], [.006, L * .995], [0, L]];
  g.add(mesh(lathe(pts, 24), body));
  if (fountain){
    for (const yy of [.44, .64]){ const t = new THREE.TorusGeometry(.052, .007, 6, 24); t.rotateX(Math.PI / 2); g.add(mesh(t, PEN.gold, 0, yy, 0)); }
    const nib = new THREE.ConeGeometry(.022, .1, 12, 1, true); g.add(mesh(nib, PEN.gold, 0, L + .03, 0));
  } else g.add(mesh(new THREE.ConeGeometry(.007, .025, 10), PEN.steel, 0, L + .008, 0));
  // 夹子：一条薄薄的长片，顶上一个小圆头，往下贴着笔杆
  const cl = new THREE.BoxGeometry(.022, .34, .012); cl.translate(0, -.17, 0);
  const cy = fountain ? .4 : .44, clip = mesh(cl, fountain ? PEN.gold : PEN.steel, 0, cy, .058); clip.rotation.x = -.04; g.add(clip);   // 夹子根在笔帽顶上，往笔尖那边伸
  g.add(mesh(new THREE.SphereGeometry(.014, 10, 8), fountain ? PEN.gold : PEN.steel, 0, cy - .012, .062));
  return g;
};
// 笔筒：一支黑铅笔（橡皮朝上）、一支原木色铅笔（笔尖朝上）、一支钢笔、一支哑光绿的圆珠笔、一支没橡皮的红铅笔
{
  const pc = G(); pc.add(mesh(lathe([[0, 0], [.32, 0], [.34, .85], [.31, .85], [.29, .06], [0, .06]], 32), ceramic));
  const items = [
    () => { const p = mkPencil(1.62, '#2f3437', {label: '赴约 HB'}); p.rotation.z = Math.PI; p.position.y = 1.62; const w = G(); w.add(p); return w; },
    () => mkPencil(1.5, '#d9c7a2', {label: '2B'}),
    () => { const p = mkPen(1.42, new THREE.MeshPhysicalMaterial({color: '#141414', roughness: .18, clearcoat: 1, clearcoatRoughness: .1}), {fountain: true}); p.rotation.z = Math.PI; p.position.y = 1.45; const w = G(); w.add(p); return w; },   // 笔尖朝下插着，笔帽朝上
    () => { const p = mkPen(1.38, std('#6f7a68', .62)); p.rotation.z = Math.PI; p.position.y = 1.4; const w = G(); w.add(p); return w; },
    () => mkPencil(1.34, '#9a4d43', {eraser: false, label: 'B'})
  ];
  items.forEach((f, i) => { const a = i * 1.26 + .3, o = f(), w = G(); o.rotation.y = penR() * 6.3; w.add(o); w.position.set(Math.cos(a) * .12, .07, Math.sin(a) * .12); w.rotation.set(Math.sin(a) * .19, 0, -Math.cos(a) * .19); pc.add(w); });   // 顶上往外斜
  pc.position.set(-1.05, 0, -2.55); add(pc, null);
}
// 便签本：一沓六十来张，侧面看得见一张张纸的细线；最上面那张写着一行字，右下角翘起来一点
{
  for (let i = 0; i < 6; i++) rnd();   // 原来这里用过六个随机数：照样消耗掉，后面摆件的样子就不会变
  const W = .9, H = .2, sn = G();
  const side = tex(256, 64, (x, w, h) => { x.fillStyle = '#ecd096'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 1.1){ x.fillStyle = `rgba(${penR() < .5 ? '150,118,60' : '255,246,220'},${.18 + penR() * .25})`; x.fillRect(0, y, w, .6); } });
  const topT = tex(256, 256, (x, w, h) => {
    x.fillStyle = '#f1d79f'; x.fillRect(0, 0, w, h); noiseDots(x, w, h, 900, .05, ['rgba(160,120,60,A)', 'rgba(255,255,240,A)']);
    x.fillStyle = 'rgba(205,170,100,.35)'; x.fillRect(0, 0, w, 34);   // 背面背胶那一条透过来，颜色深一点
    x.fillStyle = 'rgba(70,64,58,.78)'; x.font = '30px "Noto Serif CJK SC", serif'; x.save(); x.translate(26, 108); x.rotate(-.03); x.fillText('周六 · 海边', 0, 0); x.restore();
    x.strokeStyle = 'rgba(70,64,58,.6)'; x.lineWidth = 2; x.lineCap = 'round'; x.beginPath(); x.moveTo(30, 150); for (let k = 0; k < 9; k++) x.quadraticCurveTo(46 + k * 18, 138 + (k % 2) * 22, 56 + k * 18, 150); x.stroke();   // 后面一行草草的
  });
  const blk = new THREE.BoxGeometry(W, H, W);
  sn.add(mesh(blk, [side, side, std('#efd29a', .9), std('#e2c488', .9), side, side].map(m => m.isMaterial ? m : new THREE.MeshStandardMaterial({map: m, roughness: .9})), 0, H / 2, 0));
  const tg = new THREE.PlaneGeometry(W, W, 10, 10), tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++){ const u = tp.getX(i) / W + .5, v = .5 - tp.getY(i) / W, lift = Math.max(0, u + v - 1.3); tp.setZ(i, lift * lift * .38); }   // 右下角翘起来一点
  tg.computeVertexNormals(); tg.rotateX(-Math.PI / 2);
  sn.add(mesh(tg, new THREE.MeshStandardMaterial({map: topT, roughness: .9, side: THREE.DoubleSide}), 0, H + .003, 0));
  at(sn, 8.4, 0, 2.95, .3); add(sn, null);
  // 桌上两支铅笔：一支黑的带橡皮，一支原木色没橡皮；六棱的平面贴着桌面
  for (const [x, z, r, c, e] of [[9.0, 3.55, .9, '#2f3437', true], [9.2, 3.9, 1.1, '#d9c7a2', false]]){
    const p = mkPencil(1.6, c, {eraser: e, label: e ? '赴约 HB' : '2B'}); p.position.y = -.8;   // 六棱柱默认 ±x 是两个平面：躺下以后正好一个平面朝下
    const w = G(); w.add(p); w.rotation.set(0, r, Math.PI / 2); w.position.set(x, .042 * Math.cos(Math.PI / 6), z); add(w, null);
  }
}

