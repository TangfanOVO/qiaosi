/* ═════ 左边：写字角 ═════ */
// 墙上的法式丝带留言板：细橡木框，里面绷一块亚麻，两条丝带斜着交叉成菱格，交叉处钉一颗小铜扣；便签、照片、车票都插在丝带下面
const BX = -2.95, BY = 8.7, BW = 4.3, BH = 4.9, BZ = WALL_Z + .06;
const linenPlain = tex(512, 512, (x, w, h) => {
  x.fillStyle = '#4c453d'; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2){ x.fillStyle = `rgba(${rnd() < .5 ? '150,132,108' : '255,250,240'},${.06 + rnd() * .12})`; x.fillRect(0, y, w, 1); }
  for (let X = 0; X < w; X += 2){ x.fillStyle = `rgba(${rnd() < .5 ? '140,124,100' : '255,252,244'},${.05 + rnd() * .1})`; x.fillRect(X, 0, 1, h); }
  for (let i = 0; i < 40; i++){ const y = rnd() * h; x.fillStyle = `rgba(160,140,112,${.06 + rnd() * .08})`; x.fillRect(0, y, w, 1 + rnd() * 2); }
}, {rep: [2, 2]});
const board = G(); {
  // 板面：亚麻包着一层软垫，四边往里收成圆边；外面一圈两级的深色木框（外框 + 往里退一级的内口）
  board.add(mesh(new RoundedBoxGeometry(BW, BH, .16, 4, .07), new THREE.MeshStandardMaterial({map: linenPlain, roughness: .95}), 0, 0, .06));
  const fr = new THREE.MeshStandardMaterial({map: woodTex, roughness: .55}), frIn = std('#1d1915', .7);
  for (const [w, h, x, y] of [[BW + .36, .18, 0, BH / 2 + .09], [BW + .36, .18, 0, -BH / 2 - .09], [.18, BH, -BW / 2 - .09, 0], [.18, BH, BW / 2 + .09, 0]]) board.add(mesh(new RoundedBoxGeometry(w, h, .24, 3, .04), fr, x, y, .12));
  for (const [w, h, x, y] of [[BW + .04, .05, 0, BH / 2 - .005], [BW + .04, .05, 0, -BH / 2 + .005], [.05, BH, -BW / 2 + .005, 0], [.05, BH, BW / 2 - .005, 0]]) board.add(mesh(new THREE.BoxGeometry(w, h, .2), frIn, x, y, .1));
  // 丝带：麻色的人字纹织带，有一点厚度；两组斜着交叉，一组压在另一组上面
  const ribT = tex(64, 32, (x, w, h) => { x.fillStyle = '#a8946f'; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2){ x.fillStyle = `rgba(${rnd() < .5 ? '70,58,40' : '220,205,175'},${.15 + rnd() * .2})`; x.fillRect(0, y, w, 1); } x.fillStyle = 'rgba(60,48,34,.35)'; x.fillRect(0, 0, w, 2); x.fillRect(0, h - 2, w, 2); });
  const rib = new THREE.MeshStandardMaterial({map: ribT, roughness: .85});
  const S = 1.35;
  for (const dir of [1, -1]) for (let k = -6; k <= 6; k++){
    const pts = [], hw = BW / 2 - .06, hh = BH / 2 - .06;
    for (const xx of [-hw, hw]){ const yy = dir * xx + k * S; if (Math.abs(yy) <= hh) pts.push([xx, yy]); }
    for (const yy of [-hh, hh]){ const xx = (yy - k * S) * dir; if (Math.abs(xx) <= hw) pts.push([xx, yy]); }
    if (pts.length < 2) continue;
    pts.sort((a, b) => a[0] - b[0]); const [a, b] = [pts[0], pts[pts.length - 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < .3) continue;
    const r = mesh(new THREE.BoxGeometry(L, .12, .014), rib, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, .148 + (dir > 0 ? 0 : .014)); r.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]); board.add(r);
  }
  // 交叉处的铜泡钉：圆圆的钉帽 + 一圈压着丝带的小垫圈
  const tack = mergeGeometries([new THREE.SphereGeometry(.075, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, .7), new THREE.TorusGeometry(.07, .012, 6, 20)]);
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++){ const x = (j * S - i * S) / 2, y = (j * S + i * S) / 2; if (Math.abs(x) < BW / 2 - .1 && Math.abs(y) < BH / 2 - .1) board.add(mesh(tack, brass, x, y, .176)); }
  board.position.set(BX, BY, BZ); add(board, null);
}
// 贴在板子上的纸：都是一张微微卷起来的纸（中间贴着、四个角翘一点），在丝带和泡钉前面
const paperM = (w, h, map, curl = .04) => { const g = new THREE.PlaneGeometry(w, h, 8, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++){ const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2); p.setZ(i, curl * (u * u * .6 + v * v * .4) + .012 * Math.sin(u * 3 + v * 2)); } g.computeVertexNormals();
  return mesh(g, new THREE.MeshStandardMaterial({map, roughness: .85, side: THREE.DoubleSide})); };
const onBoard = (obj, x, y, r = 0, dz = 0) => { obj.position.set(BX + x, BY + y, BZ + .25 + dz); obj.rotation.z = r; return obj; };   // 纸都在泡钉前面，泡钉不会从纸中间顶出来
/* 图钉：只钉在纸的一个角或两个角上——一颗小圆帽，下面一截钉身扎进板里 */
const PIN = mergeGeometries([new THREE.SphereGeometry(.052, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, .75).translate(0, 0, .012), new THREE.CylinderGeometry(.045, .05, .025, 16).rotateX(Math.PI / 2)]);
const pinIt = (paper, w, h, corners, curl = .04, mat = brass) => { for (const c of corners){ const sx = c.includes('l') ? -1 : 1, sy = c.includes('t') ? 1 : -1, u = sx * (w / 2 - .1), v = sy * (h / 2 - .1);
  const z = curl * ((u / (w / 2)) ** 2 * .6 + (v / (h / 2)) ** 2 * .4) + .012; paper.add(mesh(PIN, mat, u, v, z)); } return paper; };
const pinDark = std('#2a2622', .35, {metalness: .6});
const washi = (w, col) => mesh(new THREE.PlaneGeometry(w, .14), new THREE.MeshStandardMaterial({map: tex(64, 16, (x, ww, hh) => { x.fillStyle = col; x.fillRect(0, 0, ww, hh); for (let i = 0; i < ww; i += 6){ x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(i, 0, 3, hh); } }), transparent: true, opacity: .82, roughness: .7}));
// 挂历（在一起，演示数字）
const cal = G(); {
  const tx = tex(240, 320, (x) => {
    x.fillStyle = '#ece5d8'; x.fillRect(0, 0, 240, 320); noiseDots(x, 240, 320, 900, .06, ['rgba(140,120,96,A)']);
    x.fillStyle = '#6e4a40'; x.fillRect(0, 0, 240, 34);
    x.fillStyle = '#efe7da'; x.font = '500 18px system-ui, "Noto Sans CJK SC", sans-serif'; x.textAlign = 'center'; x.fillText('十 月', 120, 24);
    x.fillStyle = '#2f2b28'; x.font = '600 96px "Noto Serif CJK SC", serif'; x.fillText('121', 120, 170);
    x.fillStyle = '#6f6862'; x.font = '400 22px system-ui, "Noto Sans CJK SC", sans-serif'; x.fillText('在一起 · 天', 120, 214);
    x.strokeStyle = '#cfc6b6'; x.lineWidth = 1; for (let i = 0; i < 3; i++){ x.beginPath(); x.moveTo(36, 248 + i * 22); x.lineTo(204, 248 + i * 22); x.stroke(); }
  });
  cal.add(paperM(1.35, 1.8, tx, .03));
  const clip = G(); clip.add(mesh(new RoundedBoxGeometry(.5, .16, .05, 2, .02), std('#1c1a18', .35, {metalness: .7}), 0, 0, .03)); clip.add(mesh(new THREE.TorusGeometry(.08, .012, 6, 16, Math.PI), std('#2a2724', .3, {metalness: .8}), -.1, .1, .05)); clip.add(mesh(new THREE.TorusGeometry(.08, .012, 6, 16, Math.PI), std('#2a2724', .3, {metalness: .8}), .1, .1, .05));
  clip.position.set(0, .86, .02); cal.add(clip);   // 顶上一只黑色长尾夹
  onBoard(cal, -1.25, 1.2, .03); add(cal, 'cal');
}
// 碎碎念：三张便签（手写的几行），一张用纸胶带贴着，两张塞在丝带下面
const notes = G(); {
  for (const [x, y, r, bg, i] of [[.3, 1.5, -.05, '#e2dacb', 0], [.55, .38, .06, '#d9cfc5', 1], [.3, -.74, -.04, '#d2d4c8', 2]]){   // 最近三条竖着排一列：凑近看的时候三张一起看得到
    const n = paperM(.85, 1.08, noteTex(bg, 'rgba(60,54,50,.75)', 5, i), .035); onBoard(n, x, y, r, .004 * i); notes.add(n);
    if (i === 1) pinIt(n, .85, 1.08, ['tl'], .035, pinDark); if (i === 2) pinIt(n, .85, 1.08, ['tr'], .035);
  }
  const t = washi(.5, '#8c7b66'); onBoard(t, .3, 2.03, -.22, .03); notes.add(t);
  add(notes, 'notes');
}
// 拍立得、明信片、车票、一条三连拍、一片压干的玉兰花瓣
{
  const pol = tex(200, 240, (x, w, h) => { x.fillStyle = '#eee9df'; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 14, 0, 186); g.addColorStop(0, '#8d8a85'); g.addColorStop(1, '#45484a'); x.fillStyle = g; x.fillRect(14, 14, 172, 172); x.fillStyle = 'rgba(236,230,220,.75)'; for (const [cx, cy, r] of [[70, 80, 22], [120, 110, 14], [90, 140, 10]]){ x.beginPath(); x.ellipse(cx, cy, r, r * 1.6, -.4, 0, 7); x.fill(); } });
  add(onBoard(paperM(.85, 1.02, pol), 1.55, 1.6, .09, .01), null);
  const tw = washi(.42, '#6b5d52'); onBoard(tw, 1.7, 2.08, .5, .04); add(tw, null);
  const pc = tex(320, 220, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#b8bfbe'); g.addColorStop(.55, '#d9cdbb'); g.addColorStop(1, '#7f8b88'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(70,82,84,.65)'; x.beginPath(); x.moveTo(0, 130); for (let i = 0; i <= 10; i++) x.lineTo(i * 32, 112 - Math.sin(i * .9) * 18 - (i % 3) * 6); x.lineTo(w, 140); x.lineTo(0, 140); x.fill();
    x.fillStyle = 'rgba(236,230,220,.9)'; x.fillRect(0, 0, w, 8); x.fillRect(0, h - 8, w, 8); x.fillRect(0, 0, 8, h); x.fillRect(w - 8, 0, 8, h);
  });
  add(onBoard(pinIt(paperM(1.5, 1.03, pc, .05), 1.5, 1.03, ['tl', 'tr'], .05), -1.2, -.95, -.05), null);
  const tk = tex(240, 100, (x, w, h) => { x.fillStyle = '#d6c5a8'; x.fillRect(0, 0, w, h); noiseDots(x, w, h, 300, .08, ['rgba(80,60,40,A)']); x.strokeStyle = 'rgba(90,72,54,.6)'; x.setLineDash([5, 5]); x.beginPath(); x.moveTo(176, 0); x.lineTo(176, h); x.stroke(); x.fillStyle = 'rgba(48,42,36,.85)'; x.font = '600 26px "Noto Serif CJK SC", serif'; x.fillText('ADMIT ONE', 20, 46); x.font = '400 16px system-ui'; x.fillText('ROW 7 · SEAT 12', 20, 76); });
  add(onBoard(pinIt(paperM(1.1, .46, tk, .02), 1.1, .46, ['tl'], .02, pinDark), 1.45, -1.75, -.12), null);
  const strip = tex(80, 280, (x, w, h) => { x.fillStyle = '#f0ebe2'; x.fillRect(0, 0, w, h); for (let i = 0; i < 3; i++){ const g = x.createLinearGradient(0, 10 + i * 88, 0, 90 + i * 88); g.addColorStop(0, '#5e5a56'); g.addColorStop(1, '#2e2c2a'); x.fillStyle = g; x.fillRect(8, 10 + i * 88, w - 16, 78); x.fillStyle = 'rgba(230,224,214,.6)'; x.beginPath(); x.arc(w / 2, 46 + i * 88, 14, 0, 7); x.fill(); } });
  add(onBoard(pinIt(paperM(.42, 1.45, strip, .03), .42, 1.45, ['tr'], .03), 1.68, .02, .1, .006), null);
  const pet = tex(128, 200, (x, w, h) => { x.clearRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#efe6dc'); g.addColorStop(1, '#c69aa6'); x.fillStyle = g; x.beginPath(); x.ellipse(w / 2, h / 2, w * .4, h * .46, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(150,110,118,.35)'; x.lineWidth = 2; for (let k = -2; k <= 2; k++){ x.beginPath(); x.moveTo(w / 2, h * .95); x.quadraticCurveTo(w / 2 + k * 10, h / 2, w / 2 + k * 6, h * .08); x.stroke(); } });
  const pm = paperM(.42, .66, pet, .02); pm.material.transparent = true; pm.material.alphaTest = .3; add(onBoard(pm, -.25, -1.95, .5, .012), null);
}
/* ── 书架上的书：每本书脊上都有书名（竖排）。布面的烫金、或者贴一张米色纸签；皮面的贴一块深红皮签、金字；平装的是印上去的。
   书名都是编的 ── */
const SERIF = '"Noto Serif CJK SC","Songti SC","STSong",serif';
const SPINE_TITLES = ['海边的信', '慢车', '雨季', '云的形状', '灯下', '岛屿', '星期六', '旧地图', '潮汐表', '夜航', '晚风', '南方', '散步', '书信集', '四季', '小城', '远方', '诗', '灯塔', '花事', '山中', '纸鹤'];
const spineMat = (title, kind, lw, lh, seed) => {
  const r = mkRng(seed), H = 512, Wc = Math.max(40, Math.round(H * lw / lh));
  const style = kind === 'paper' ? 'print' : kind === 'leather' ? 'label' : (r() < .45 ? 'paper' : 'stamp');
  const gold = 'rgba(218,186,118,.96)', ink = 'rgba(40,35,30,.9)';
  const t = tex(Wc, H, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    let col = gold, top = .12, bot = .56;
    if (style === 'print'){ x.fillStyle = 'rgba(238,230,214,.94)'; x.fillRect(0, h * .05, w, h * .55); col = ink; x.fillStyle = ['rgba(168,104,124,.85)', 'rgba(70,96,110,.85)', 'rgba(150,120,70,.85)'][seed % 3]; x.fillRect(0, h * .82, w, h * .05); }
    else if (style === 'label'){ top = .27; bot = .53; x.fillStyle = '#5e241d'; x.fillRect(w * .1, h * top, w * .8, h * (bot - top)); x.strokeStyle = gold; x.lineWidth = 1.5; x.strokeRect(w * .15, h * top + 3, w * .7, h * (bot - top) - 6); }
    else if (style === 'paper'){ x.fillStyle = '#ebe2cd'; x.fillRect(w * .12, h * top, w * .76, h * (bot - top)); x.strokeStyle = 'rgba(120,100,80,.35)'; x.lineWidth = 1; x.strokeRect(w * .16, h * top + 4, w * .68, h * (bot - top) - 8); col = ink; }
    else { x.fillStyle = gold; for (const yy of [.05, .065, .935, .95]) x.fillRect(w * .08, h * yy, w * .84, 2); }
    const chars = [...title], fs = Math.min(w * .6, (h * (bot - top) - 20) / (chars.length * 1.1), 40);
    x.fillStyle = col; x.font = `600 ${fs}px ${SERIF}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const y0 = h * (top + bot) / 2 - (chars.length - 1) * fs * 1.1 / 2;
    chars.forEach((ch, i) => x.fillText(ch, w / 2, y0 + i * fs * 1.1));
    x.fillStyle = style === 'paper' || style === 'print' ? ink : gold; x.globalAlpha = .8;
    x.font = `400 ${fs * .45}px ${SERIF}`; x.fillText('著', w / 2, h * .68);
    x.beginPath(); x.arc(w / 2, h * .885, Math.max(3, fs * .18), 0, 7); x.fill(); x.globalAlpha = 1;   // 出版社的小记号
  });
  return new THREE.MeshStandardMaterial({map: t, transparent: true, alphaTest: .3, roughness: style === 'stamp' ? .35 : .75, metalness: style === 'stamp' ? .6 : style === 'label' ? .25 : 0});
};
/* 竖着放的一本，书脊朝前，书脊上带书名：h 书高，t 厚，d 书脊到书口 */
const shelfBook = (h, t, d, col, kind, title, seed) => {
  const b = G(), f = bookFlat(d, t, h, col, kind); f.quaternion.copy(UPR); f.position.set(t / 2, h / 2, 0); b.add(f);
  const sp = Math.min(t * .32, .14), paper = kind === 'paper', lw = t * (paper ? .9 : .5), lh = h * .93;
  const lab = mesh(new THREE.PlaneGeometry(lw, lh), spineMat(title, kind, lw, lh, seed), 0, h / 2, d / 2 - (paper ? 0 : .1 * sp) + .004);
  lab.userData.noCast = true; b.add(lab);
  return b;
};
// 桌上的小格架（参考图 5）
const shelf = G(); {
  const W = 3.5, H = 2.8, D = .95, T = .1;
  for (const y of [T / 2, 1.42, H - T / 2]) shelf.add(mesh(new THREE.BoxGeometry(W, T, D), lightWood, 0, y, 0));
  for (const x of [-W / 2 + T / 2, W / 2 - T / 2]) shelf.add(mesh(new THREE.BoxGeometry(T, H, D), lightWood, x, H / 2, 0));
  shelf.add(mesh(new THREE.BoxGeometry(T, 1.32, D), lightWood, -.35, .76, 0)); shelf.add(mesh(new THREE.BoxGeometry(T, 1.28, D), lightWood, .75, 2.06, 0));
  shelf.add(mesh(new THREE.BoxGeometry(W, H, .04), std('#1f1a16', .85), 0, H / 2, -D / 2 + .02));
  // 下左：竖着的几本小书
  for (const [h, t, c] of [[1.15, .22, '#474a41'], [1.05, .18, '#857a69'], [1.2, .26, '#353b41'], [.95, .2, '#6a4d43']]) bookUp(h, t, .7, c);   // 原来那几本照样做（随机数不变），不摆上去
  shelf.userData.old = [...shelf.children];
  // 下左：一排竖着的书，书脊上有书名；最后一本斜靠在隔板上
  { const br = mkRng(5353), BR = (a, b) => a + br() * (b - a), PAL = ['#474a41', '#857a69', '#353b41', '#6a4d43', '#a2967f', '#5d6b73', '#9b6b55', '#c9bfa8'], KINDS = ['cloth', 'leather', 'paper', 'cloth'];
    let x = -W / 2 + T + .03, n = 11;
    for (;;){ const t = BR(.13, .24), h = BR(.92, 1.16), d = BR(.66, .74); if (x + t > -.62) break;
      const b = shelfBook(h, t, d, PAL[(br() * PAL.length) | 0], KINDS[(br() * KINDS.length) | 0], SPINE_TITLES[n++ % SPINE_TITLES.length], 100 + n); b.position.set(x + t / 2, T, .42 - d / 2); shelf.add(b); x += t + BR(.008, .02); }
    // 斜靠的一本：书底角顶在前一本旁边，上角靠在隔板上
    // 往右倒：右下角着地，右上角顶住隔板；t·cos a + h·sin a = 可用的宽度
    const t = .18, h = 1.02, d = .7, sp = -.4 - x - .01;
    if (sp > t){ const a = Math.asin(Math.min(1, sp / Math.hypot(t, h))) - Math.atan2(t, h), xb = x + .01 + t * Math.cos(a), lb = shelfBook(h, t, d, '#7a8a84', 'cloth', '纸鹤', 140);
      lb.position.set(xb - t / 2 * Math.cos(a), T + t / 2 * Math.sin(a), .42 - d / 2); lb.rotation.z = -a; shelf.add(lb); } }
  // 下右：一只铁皮茶叶罐（锤目纹、腰上缠一圈手写“茶”字的和纸）+ 一只装着茶叶的小玻璃罐
  { const tin = G(), hammer = (() => { const c = document.createElement('canvas'), S = 128; c.width = c.height = S; const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, S, S); for (let i = 0; i < 160; i++){ const r = 4 + rnd() * 6, g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(60,60,60,.6)'); g.addColorStop(1, 'rgba(128,128,128,0)'); x.save(); x.translate(rnd() * S, rnd() * S); x.fillStyle = g; x.fillRect(-r, -r, 2 * r, 2 * r); x.restore(); }
      const src = x.getImageData(0, 0, S, S).data, out = x.createImageData(S, S), o = out.data, H = (i, j) => src[(((j + S) % S) * S + ((i + S) % S)) * 4] / 255;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++){ const dx = (H(i + 1, j) - H(i - 1, j)) * 3, dy = (H(i, j + 1) - H(i, j - 1)) * 3, l = Math.hypot(dx, dy, 1), q = (j * S + i) * 4; o[q] = (-dx / l * .5 + .5) * 255; o[q + 1] = (dy / l * .5 + .5) * 255; o[q + 2] = (1 / l * .5 + .5) * 255; o[q + 3] = 255; }
      x.putImageData(out, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t; })();
    const iron = new THREE.MeshPhysicalMaterial({color: '#3a3836', metalness: .75, roughness: .42, normalMap: hammer, clearcoat: .2});
    tin.add(mesh(new THREE.CylinderGeometry(.28, .28, .74, 40), iron, 0, .37, 0));
    tin.add(mesh(new THREE.CylinderGeometry(.295, .295, .16, 40), iron, 0, .8, 0)); tin.add(mesh(new THREE.CylinderGeometry(.297, .297, .012, 40), std('#1a1918', .5, {metalness: .6}), 0, .72, 0));
    tin.add(mesh(new THREE.SphereGeometry(.06, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron, 0, .88, 0));
    const lab = tex(256, 96, (x, w, h) => { x.fillStyle = '#d9cfbc'; x.fillRect(0, 0, w, h); noiseDots(x, w, h, 900, .1, ['rgba(110,90,66,A)']); x.fillStyle = 'rgba(40,34,30,.85)'; x.font = '600 52px "Noto Serif CJK SC", serif'; x.textAlign = 'center'; x.fillText('茶', w * .3, 66); x.fillStyle = 'rgba(120,40,30,.8)'; x.fillRect(w * .62, 30, 30, 30); });
    tin.add(mesh(new THREE.CylinderGeometry(.283, .283, .3, 40, 1, true), new THREE.MeshStandardMaterial({map: lab, roughness: .85}), 0, .36, 0));
    tin.position.set(.15, T, 0); tin.rotation.y = 2.4; shelf.add(tin); }
  { const j = G(); j.add(mesh(new THREE.CylinderGeometry(.22, .22, .5, 24, 1, true), new THREE.MeshPhysicalMaterial({color: '#eef3f2', roughness: .05, transparent: true, opacity: .28, side: THREE.DoubleSide}), 0, .25, 0));
    const tl = new THREE.InstancedMesh(new THREE.BoxGeometry(.05, .012, .02), std('#2e2a1e', .8), 60), mm = new THREE.Matrix4();
    for (let i = 0; i < 60; i++){ mm.compose(V((rnd() - .5) * .3, .03 + (i / 60) * .26, (rnd() - .5) * .3), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), V(1, 1, 1)); tl.setMatrixAt(i, mm); } j.add(tl);
    j.add(mesh(new THREE.CylinderGeometry(.2, .2, .08, 20), lightWood, 0, .54, 0)); j.position.set(.98, T, .05); shelf.add(j); }
  // 上左：一台旧收音机：深色皮纹外壳、左边一大片冲孔喇叭网、右边刻度窗和两颗滚花旋钮、顶上一条皮提手、斜着一根拉杆天线
  { const r = G(), body = new THREE.MeshPhysicalMaterial({color: '#3a332d', roughness: .6, normalMap: leatherN, normalScale: new THREE.Vector2(.5, .5)});
    r.add(mesh(new RoundedBoxGeometry(1.3, .8, .6, 4, .12), body, 0, .4, 0));
    r.add(mesh(new RoundedBoxGeometry(1.18, .62, .02, 3, .06), std('#2a2724', .35, {metalness: .6}), 0, .41, .3));
    const grill = tex(160, 128, (x, w, h) => { x.fillStyle = '#9a948a'; x.fillRect(0, 0, w, h); x.fillStyle = '#141312'; for (let j = 6; j < h; j += 8) for (let i = (j / 8 % 2) * 4 + 4; i < w; i += 8){ x.beginPath(); x.arc(i, j, 2.3, 0, 7); x.fill(); } });
    r.add(mesh(new THREE.PlaneGeometry(.64, .5), new THREE.MeshStandardMaterial({map: grill, metalness: .7, roughness: .45}), -.24, .41, .312));
    const dial = tex(160, 80, (x, w, h) => { x.fillStyle = '#c9b993'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(40,32,24,.8)'; x.lineWidth = 1; for (let i = 10; i < w - 6; i += 6){ x.beginPath(); x.moveTo(i, 46); x.lineTo(i, i % 30 < 6 ? 30 : 38); x.stroke(); } x.fillStyle = 'rgba(40,32,24,.8)'; x.font = '10px system-ui'; ['54', '70', '90', '120', '160'].forEach((t, k) => x.fillText(t, 8 + k * 32, 66)); x.fillStyle = '#8a2a1e'; x.fillRect(84, 22, 2, 30); });
    r.add(mesh(new THREE.PlaneGeometry(.38, .2), new THREE.MeshStandardMaterial({map: dial, roughness: .3, emissive: new THREE.Color('#ffd9a0'), emissiveMap: dial, emissiveIntensity: .12}), .33, .54, .313));
    const knurl = new THREE.CylinderGeometry(.075, .075, .07, 28); { const p = knurl.attributes.position; for (let i = 0; i < p.count; i++){ const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + .06 * Math.max(0, Math.cos(a * 14)); if (Math.abs(p.getY(i)) < .034){ p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } } knurl.computeVertexNormals(); }
    for (const x of [.24, .43]) r.add(R_(mesh(knurl, brass, x, .27, .34), Math.PI / 2, 0, 0));
    r.add(mesh(new THREE.TorusGeometry(.32, .035, 8, 24, Math.PI), new THREE.MeshPhysicalMaterial({color: '#4a3326', roughness: .5, normalMap: leatherN}), 0, .82, 0));
    for (const x of [-.32, .32]) r.add(mesh(new THREE.CylinderGeometry(.04, .04, .06, 12), brass, x, .82, 0));
    const ant = mesh(new THREE.CylinderGeometry(.012, .018, 1.3, 8), std('#bdb6aa', .2, {metalness: 1}), .5, 1.25, -.15); ant.rotation.z = -.5; r.add(ant);
    r.position.set(-.55, 1.47, .05); shelf.add(r); }
  // 上右：一只粗陶小杯，插着几根干芦苇
  { const c = G(); c.add(mesh(lathe([[0, 0], [.17, 0], [.2, .1], [.2, .38], [.17, .4], [.15, .38], [0, .37]], 24), ceramic));
    const st = std('#a08d6c', .9);
    for (let k = 0; k < 5; k++){ const a = k * 1.3, h = 1.0 + rnd() * .6; c.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(Math.cos(a) * .04, .3, Math.sin(a) * .04), V(Math.cos(a) * .15, .3 + h * .6, Math.sin(a) * .1), V(Math.cos(a) * .3, .3 + h, Math.sin(a) * .2)]), 10, .01, 4), st)); const pl = mesh(new THREE.ConeGeometry(.045, .3, 6), std('#c4b08a', 1), Math.cos(a) * .3, .3 + h + .08, Math.sin(a) * .2); pl.rotation.z = -Math.cos(a) * .3; c.add(pl); }
    c.position.set(1.15, 1.47, .05); shelf.add(c); }
  shelf.position.set(-3.3, 0, -2.75); add(shelf, null);
}
// 格架顶上：纸星星罐（梗库）
/* 玻璃：边上（斜着看的地方）更不透、更亮，正对着看几乎全透——真玻璃就是这样，所以看得出是一只罐子 */
const fresnelGlass = (o = {}) => {
  const m = new THREE.MeshPhysicalMaterial({color: '#eef5f2', roughness: .03, transparent: true, opacity: .07, clearcoat: 1, clearcoatRoughness: .02, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 3, ...o});
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      float fgl = pow(1. - abs(dot(normalize(normal), normalize(vViewPosition))), 2.6);
      diffuseColor.a = mix(diffuseColor.a, .62, fgl); outgoingLight += vec3(.9, .95, .93) * fgl * .12;
      #include <opaque_fragment>`); };
  m.customProgramCacheKey = () => 'fglass'; return m;
};
const jar = G(); {
  const jr = mkRng(5050), JR = .45, JT = .035, JH = 1.1, BASE = .07;
  const gl = fresnelGlass();
  // 罐身：外壁 + 内壁（玻璃有厚度），厚厚的底，口沿一圈圆边
  const outer = mesh(lathe([[JR - .02, 0], [JR, .03], [JR, JH - .02], [JR - .01, JH]], 48), gl); outer.renderOrder = 4; outer.userData.cd = {}; jar.add(outer);
  const inner = mesh(lathe([[JR - JT, BASE], [JR - JT, JH]], 48), fresnelGlass({opacity: .04})); inner.renderOrder = 4; inner.userData.cd = {}; jar.add(inner);
  const base = mesh(new THREE.CylinderGeometry(JR - .02, JR - .025, BASE, 48), fresnelGlass({opacity: .22, color: '#dfeae6'}), 0, BASE / 2, 0); base.userData.cd = {}; jar.add(base);
  const lip = mesh(new THREE.TorusGeometry(JR - JT / 2, JT / 2 + .006, 8, 48).rotateX(Math.PI / 2), fresnelGlass({opacity: .3}), 0, JH, 0); lip.userData.cd = {}; jar.add(lip);
  // 木塞盖子
  jar.add(mesh(new THREE.CylinderGeometry(.4, .38, .16, 32), lightWood, 0, JH + .08, 0));
  jar.add(mesh(new THREE.CylinderGeometry(.43, .43, .05, 32), lightWood, 0, JH + .17, 0));
  // 纸星星：一张纸条折出来的那种小胖星，五个角圆鼓鼓的
  const starGeo = (() => { const sh = new THREE.Shape(); for (let k = 0; k <= 10; k++){ const a = k / 10 * Math.PI * 2 + Math.PI / 2, r = k % 2 ? .052 : .098; const x = Math.cos(a) * r, y = Math.sin(a) * r; k ? sh.lineTo(x, y) : sh.moveTo(x, y); }
    const g = new THREE.ExtrudeGeometry(sh, {depth: .045, bevelEnabled: true, bevelThickness: .03, bevelSize: .022, bevelSegments: 3}); g.center(); return g; })();
  /* 真的倒进去堆起来：每颗星当成一个小球，从上面一颗一颗落下去，碰到底、碰到罐壁、碰到别的星就停住或者滑开，
     算几百步，直到全部沉下来叠在一起；最后每颗星随便朝一个方向躺着 */
  const N = 130, rS = .078, IN = JR - JT - rS, P = [];
  for (let i = 0; i < N; i++){ const a = jr() * 6.3, r = Math.sqrt(jr()) * IN; P.push(new THREE.Vector3(Math.cos(a) * r, BASE + rS + .2 + i * .02 + jr() * .05, Math.sin(a) * r)); }
  const prev = P.map(p => p.clone()), tmp = new THREE.Vector3();
  for (let it = 0; it < 520; it++){
    for (let i = 0; i < N; i++){ const p = P[i], v = tmp.subVectors(p, prev[i]).multiplyScalar(.9); prev[i].copy(p); p.add(v); p.y -= .0016; }   // 带一点速度的下落（油里一样慢）
    for (let pass = 0; pass < 3; pass++){
      for (let i = 0; i < N; i++){
        const p = P[i];
        if (p.y < BASE + rS){ p.y = BASE + rS; }
        const rr = Math.hypot(p.x, p.z); if (rr > IN){ p.x *= IN / rr; p.z *= IN / rr; }
        for (let j = i + 1; j < N; j++){
          const q = P[j], dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, d2 = dx * dx + dy * dy + dz * dz, md = rS * 1.86;
          if (d2 < md * md && d2 > 1e-9){ const d = Math.sqrt(d2), k = (md - d) / d * .5; p.x -= dx * k; p.y -= dy * k; p.z -= dz * k; q.x += dx * k; q.y += dy * k; q.z += dz * k; }
        }
      }
    }
  }
  const st = new THREE.InstancedMesh(starGeo, new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: .5, sheen: .4, sheenColor: new THREE.Color('#fff6ec'), clearcoat: .2}), N), mm = new THREE.Matrix4(), q = new THREE.Quaternion();
  const pal = ['#c9b5ad', '#cfc09f', '#a9b3a6', '#b6b2bd', '#ddd5c8', '#d4b8a0', '#9fb1b6'];
  for (let i = 0; i < N; i++){ q.setFromEuler(new THREE.Euler(jr() * 6.3, jr() * 6.3, jr() * 6.3)); mm.compose(P[i], q, V(1, 1, 1).multiplyScalar(.92 + jr() * .16)); st.setMatrixAt(i, mm); st.setColorAt(i, new THREE.Color(pal[(jr() * pal.length) | 0])); }
  st.castShadow = true; jar.add(st);
  jar.userData.fill = Math.max(...P.map(p => p.y));
  jar.position.set(-2.3, 2.8, -2.7); add(jar, 'jar');
}
// 格架顶上另一头：一枝干花插在细瓶里
{
  const v = G(); v.add(mesh(lathe([[0, 0], [.16, 0], [.18, .3], [.08, .75], [.06, 1.1], [.08, 1.14], [0, 1.14]], 20), new THREE.MeshPhysicalMaterial({color: '#7e8b84', roughness: .2, clearcoat: .6})));
  const st = std('#8a7b60', .9);
  for (const [a, h] of [[.2, 2.2], [-.3, 1.9], [.5, 1.6]]){ const pts = [V(0, 1.0, 0), V(Math.sin(a) * .3, 1.0 + h * .6, .05), V(Math.sin(a) * .7, 1.0 + h, .1)]; v.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, .015, 5), st)); for (let k = 0; k < 4; k++){ const b = mesh(new THREE.SphereGeometry(.06, 8, 6), std('#c9a46e', .9), Math.sin(a) * (.4 + k * .1), 1.0 + h * (.7 + k * .1), .08); v.add(b); } }
  v.position.set(-4.5, 2.8, -2.75); add(v, null);
}
/* 一起听：电脑屏幕上的播放器。现在放的是演示用的一首（只有歌名、歌手和时长，没有真的歌词）；
   黑胶在转、进度条在走、歌词那几行跟着时间往上滚。接上真的前后端以后，把正在一起听的歌和带时间的歌词塞给 fuyue.setNowPlaying 就行 */
const NP = {title: '电话皇后', artist: '蔡依林', dur: 238, pos: 61, playing: true, lyrics: null, acc: 0};
const npFmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const drawNP = (x, w, h) => {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#121110'); g.addColorStop(1, '#1d1b19'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  const glow = x.createRadialGradient(170, 190, 30, 170, 190, 220); glow.addColorStop(0, 'rgba(150,90,70,.2)'); glow.addColorStop(1, 'rgba(120,80,60,0)'); x.fillStyle = glow; x.fillRect(0, 0, w, h);
  // 黑胶：一圈圈纹路 + 一道斜着的反光，跟着唱片转；中间的标签上有个小记号，看得出在转
  const ang = NP.pos * Math.PI * 2 * .55;
  x.save(); x.translate(170, 190);
  x.fillStyle = '#0b0a0a'; x.beginPath(); x.arc(0, 0, 118, 0, 7); x.fill();
  for (let r = 44; r < 116; r += 4){ x.strokeStyle = `rgba(255,255,255,${.025 + (r % 12 === 0 ? .03 : 0)})`; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  x.rotate(ang);
  const sheen = x.createLinearGradient(-118, -118, 118, 118); sheen.addColorStop(.35, 'rgba(255,255,255,0)'); sheen.addColorStop(.5, 'rgba(255,255,255,.07)'); sheen.addColorStop(.65, 'rgba(255,255,255,0)');
  x.fillStyle = sheen; x.beginPath(); x.arc(0, 0, 116, 0, 7); x.fill();
  const lg = x.createRadialGradient(-6, -8, 2, 0, 0, 40); lg.addColorStop(0, '#b0544a'); lg.addColorStop(1, '#6e2c28'); x.fillStyle = lg; x.beginPath(); x.arc(0, 0, 40, 0, 7); x.fill();
  x.fillStyle = 'rgba(240,226,206,.85)'; x.font = '600 11px system-ui, "Noto Sans CJK SC", sans-serif'; x.textAlign = 'center'; x.fillText(NP.artist, 0, -14); x.fillRect(-16, 10, 32, 2);
  x.fillStyle = '#0b0a0a'; x.beginPath(); x.arc(0, 0, 5, 0, 7); x.fill();
  x.restore();
  // 唱臂：搭在唱片外圈
  x.strokeStyle = 'rgba(200,190,176,.75)'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(300, 70); x.lineTo(286, 170); x.lineTo(250, 236); x.stroke();
  x.fillStyle = 'rgba(200,190,176,.85)'; x.beginPath(); x.arc(300, 70, 9, 0, 7); x.fill();
  // 歌名、歌手
  x.textAlign = 'left'; x.fillStyle = 'rgba(240,232,220,.95)'; x.font = '600 30px "Noto Sans CJK SC", system-ui, sans-serif'; x.fillText(NP.title, 330, 92);
  x.fillStyle = 'rgba(230,222,210,.55)'; x.font = '400 18px "Noto Sans CJK SC", system-ui, sans-serif'; x.fillText(NP.artist, 330, 122);
  // 歌词：当前这一行亮、上下几行淡，慢慢往上滚。没接真歌词时，用长短不一的灰条代替（不放真的歌词）
  const LH = 30, y0 = 214;
  x.save(); x.beginPath(); x.rect(320, 150, 300, 160); x.clip();
  if (NP.lyrics && NP.lyrics.length){
    let k = 0; for (let i = 0; i < NP.lyrics.length; i++) if (NP.lyrics[i].t <= NP.pos) k = i;
    const nx = NP.lyrics[k + 1], f = nx ? Math.min(1, Math.max(0, (NP.pos - NP.lyrics[k].t) / Math.max(.6, nx.t - NP.lyrics[k].t))) : 0, sc = Math.max(0, f - .8) / .2;
    for (let i = k - 2; i <= k + 4; i++){ const L = NP.lyrics[i]; if (!L) continue; const yy = y0 + (i - k - sc) * LH, on = i === k;
      x.fillStyle = on ? 'rgba(244,228,206,.95)' : `rgba(230,222,210,${.32 - Math.abs(i - k) * .05})`; x.font = `${on ? 600 : 400} ${on ? 19 : 17}px "Noto Sans CJK SC", system-ui, sans-serif`; x.fillText(L.text, 330, yy); }
  } else {
    const per = 4.2, k = Math.floor(NP.pos / per), f = (NP.pos / per) % 1, sc = Math.max(0, f - .82) / .18, eased = sc * sc * (3 - 2 * sc);
    for (let i = k - 2; i <= k + 4; i++){
      const yy = y0 + (i - k - eased) * LH, on = i === k, len = 120 + ((i * 97) % 140);
      x.fillStyle = on ? 'rgba(244,228,206,.92)' : `rgba(230,222,210,${Math.max(.06, .22 - Math.abs(i - k) * .045)})`;
      x.beginPath(); x.roundRect(330, yy - 14, len, on ? 12 : 9, 5); x.fill();
      if (on){ x.fillStyle = 'rgba(214,170,130,.9)'; x.beginPath(); x.roundRect(330, yy - 14, len * Math.min(1, f / .82), 12, 5); x.fill(); }   // 唱到这一行的哪儿了
    }
  }
  x.restore();
  // 进度条 + 时间
  const pf = NP.pos / NP.dur;
  x.fillStyle = 'rgba(230,222,210,.16)'; x.fillRect(60, 360, 520, 3); x.fillStyle = 'rgba(214,178,140,.75)'; x.fillRect(60, 360, 520 * pf, 3);
  x.fillStyle = 'rgba(214,178,140,.95)'; x.beginPath(); x.arc(60 + 520 * pf, 361.5, 6, 0, 7); x.fill();
  x.fillStyle = 'rgba(230,222,210,.5)'; x.font = '400 15px system-ui, sans-serif'; x.textAlign = 'left'; x.fillText(npFmt(NP.pos), 60, 390); x.textAlign = 'right'; x.fillText(npFmt(NP.dur), 580, 390);
  // 暂停键
  x.fillStyle = 'rgba(240,232,220,.8)'; if (NP.playing){ x.fillRect(312, 380, 5, 18); x.fillRect(323, 380, 5, 18); } else { x.beginPath(); x.moveTo(313, 379); x.lineTo(329, 389); x.lineTo(313, 399); x.fill(); }
  x.textAlign = 'left';
};
// 电脑（一起听：屏幕上在放歌）
const laptop = G(); {
  const alu = std('#4d4b49', .35, {metalness: .6});
  laptop.add(mesh(new RoundedBoxGeometry(3.1, .1, 2.15, 2, .04), alu, 0, .05, 0));
  const kb = tex(512, 340, (x, w, h) => { x.fillStyle = '#3e3c3a'; x.fillRect(0, 0, w, h); x.fillStyle = '#1a1918'; for (let r = 0; r < 6; r++) for (let c = 0; c < 14; c++){ const kw = (w - 60) / 14; x.fillRect(30 + c * kw + 2, 20 + r * 32 + 2, kw - 4, 28); } x.fillStyle = '#444240'; x.fillRect(w / 2 - 90, 220, 180, 104); });
  laptop.add(R_(mesh(new THREE.PlaneGeometry(2.9, 1.95), std('#ffffff', .6, {map: kb}), 0, .101, .05), -Math.PI / 2, 0, 0));
  const lid = G(); lid.position.set(0, .1, -1.06); lid.rotation.x = -.32; laptop.add(lid);
  lid.add(mesh(new RoundedBoxGeometry(3.1, 2.05, .07, 2, .03), alu, 0, 1.03, -.02));
  const scr = tex(640, 420, (x, w, h) => drawNP(x, w, h));

  lid.add(mesh(new THREE.PlaneGeometry(2.86, 1.86), new THREE.MeshStandardMaterial({map: scr, emissiveMap: scr, emissive: new THREE.Color('#ffffff'), emissiveIntensity: .55, roughness: .25}), 0, 1.04, .016));
  laptop.position.set(-2.55, 0, .45); laptop.rotation.y = .26; add(laptop, 'music');
  laptop.userData.old = [...laptop.children];
  const scr2 = scr.clone(); scr2.flipY = false; scr2.colorSpace = THREE.SRGBColorSpace; scr2.needsUpdate = true; laptop.userData.scr = [scr, scr2];
  swapIn('./models/laptop.gltf.json', laptop, {alu, key: std('#1a1918', .6), well: std('#232221', .5, {metalness: .3}), pad: new THREE.MeshPhysicalMaterial({color: '#4a4846', roughness: .22, metalness: .5}),
    bezel: std('#0a0a0b', .08), screen: new THREE.MeshStandardMaterial({map: scr2, emissiveMap: scr2, emissive: new THREE.Color('#ffffff'), emissiveIntensity: .38, roughness: .2}), hinge: std('#2c2b2a', .4, {metalness: .7}), foot: std('#111111', .9)}, 'music');
}
// 本子 + 扣在上面的手机（对话）
{
  const nb = G(); nb.add(mesh(new RoundedBoxGeometry(2.0, .12, 2.7, 2, .03), coverMat('#5a4b3c'), 0, .06, 0));
  const ring = new THREE.InstancedMesh(new THREE.TorusGeometry(.09, .016, 6, 14), brass, 13), mm = new THREE.Matrix4();
  for (let i = 0; i < 13; i++){ mm.compose(V(-1.0, .07, -1.2 + i * .2), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2), V(1, 1, 1)); ring.setMatrixAt(i, mm); }
  nb.add(ring); nb.position.set(-.6, 0, 2.5); nb.rotation.y = -.18; add(nb, null);
}
// 手机（对话）：就是连环桌上那台（Blender 建的，深蓝铝机身、横贯的相机台、三颗镜头），扣在本子上；点开它会翻过来，亮着聊天
const phone = G(), phoneBody = G(); phone.add(phoneBody);
const phoneFlip = {v: 0, from: 0, to: 0, t: 1};
const flipPhone = on => { const t = on ? 1 : 0; if (t === phoneFlip.to) return; phoneFlip.from = phoneFlip.v; phoneFlip.to = t; phoneFlip.t = 0; };
{
  /* 翻过来是聊天：用连环那套演示用的假对话（不是真记录），字放大，凑近看得清 */
  const screen = tex(1080, 2220, (g, W, H) => { g.scale(2, 2); const w = 540, h = 1110;   // 两倍分辨率画，凑近看字是锐的
    g.fillStyle = '#050608'; g.fillRect(0, 0, w, h);
    g.translate(w, h); g.scale(-1, -1);
    g.fillStyle = '#14171c'; g.beginPath(); g.roundRect(10, 10, w - 20, h - 20, 64); g.fill();
    g.fillStyle = '#020203'; g.beginPath(); g.roundRect(w / 2 - 74, 30, 148, 42, 21); g.fill();   // 灵动岛
    const F = (wt, sz) => `${wt} ${sz}px system-ui, "PingFang SC", "Noto Sans CJK SC", sans-serif`;
    g.fillStyle = '#d8d2c8'; g.font = F(600, 26); g.textAlign = 'left'; g.fillText('14:09', 52, 62);
    g.fillStyle = '#ece6dc'; g.font = F(600, 34); g.textAlign = 'center'; g.fillText('他', w / 2, 140);
    g.fillStyle = '#8f8a82'; g.font = F(400, 20); g.fillText('在线', w / 2, 170);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(30, 196, w - 60, 2);
    let y = 230;
    const bub = (me, text) => {
      g.font = F(500, 36); const maxW = w * .66, lines = []; let cur = '';
      for (const ch of text){ if (g.measureText(cur + ch).width > maxW && !/[，。、！？：；）」]/.test(ch)){ lines.push(cur); cur = ch; } else cur += ch; } if (cur) lines.push(cur);   // 标点不放到行首
      const bw = Math.max(...lines.map(l => g.measureText(l).width)) + 48, bh = lines.length * 50 + 34, x0 = me ? w - 36 - bw : 36;
      g.fillStyle = me ? '#c9b49a' : '#2a2e36'; g.beginPath(); g.roundRect(x0, y, bw, bh, 26); g.fill();
      g.fillStyle = me ? '#231c16' : '#ece6dc'; g.textAlign = 'left'; lines.forEach((l, i) => g.fillText(l, x0 + 24, y + 54 + i * 50));
      y += bh + 18;
    };
    bub(true, '今天想吃火锅');
    bub(false, '那就吃。牛油还是清汤？');
    bub(false, '你要是嫌辣，我把毛肚烫好了给你涮清汤那边。');
    bub(true, '这句我要截图存起来');
    bub(false, '存吧。以后赖不掉了。');
    g.fillStyle = '#1d2128'; g.beginPath(); g.roundRect(36, h - 140, w - 72, 70, 35); g.fill();
    g.fillStyle = '#6f7680'; g.font = F(400, 26); g.textAlign = 'left'; g.fillText('说点什么…', 70, h - 96);
  });
  const scr = new THREE.MeshPhysicalMaterial({map: screen, roughness: .15, emissive: '#ffffff', emissiveMap: screen, emissiveIntensity: .9, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: .9});   // 屏幕上一层玻璃，斜着看会映一点窗光
  const frost = tex(256, 256, (g, w, h) => { g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, w, h); for (let k = 0; k < 5000; k++){ g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${.03 + rnd() * .07})`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); } }, {rep: [4, 8], color: false});
  const PM = {
    alu: new THREE.MeshPhysicalMaterial({color: '#28324a', metalness: .8, roughness: .34, clearcoat: .3, clearcoatRoughness: .35, envMapIntensity: 1.7}),   // 阳极氧化的深蓝铝：金属感要靠反光撑起来
    glassBack: new THREE.MeshPhysicalMaterial({color: '#39445c', roughness: .55, roughnessMap: frost, clearcoat: .5, clearcoatRoughness: .4, envMapIntensity: 1.8}),
    ring: new THREE.MeshPhysicalMaterial({color: '#323c52', metalness: .9, roughness: .25, envMapIntensity: 2.6}), bezel: new THREE.MeshPhysicalMaterial({color: '#aab3c4', metalness: 1, roughness: .2, envMapIntensity: 3}),
    lens: new THREE.MeshPhysicalMaterial({color: '#11151f', roughness: .03, clearcoat: 1, iridescence: .8, iridescenceIOR: 1.8, iridescenceThicknessRange: [300, 600], envMapIntensity: 3}),
    flash: std('#efe9da', .3), dark: std('#0d0d0f', .3), band: std('#262d3b', .6), screen: scr};
  // 加载前（或者模型文件没取到时）顶着的那台：照连环里程序画的那台来，相机台、三颗镜头、闪光灯、屏幕都有
  {
    const fb = G(), PW_ = 1.68, PL = 3.5, PT = .17, glassM = new THREE.MeshPhysicalMaterial({color: '#0e1014', roughness: .05, clearcoat: 1});
    fb.add(mesh(new RoundedBoxGeometry(PW_, PT, PL, 6, .075), PM.alu));
    const PLT = 1.03; fb.add(mesh(new RoundedBoxGeometry(PW_ - .03, .07, PLT, 6, .03), PM.alu, 0, PT / 2 + .018, -PL / 2 + PLT / 2 + .015));
    const GL = PL - PLT - .15; fb.add(mesh(new RoundedBoxGeometry(PW_ - .14, .01, GL, 3, .004), PM.glassBack, 0, PT / 2 + .003, -PL / 2 + PLT + .06 + GL / 2));
    fb.add(mesh(new RoundedBoxGeometry(PW_ - .03, .012, PL - .03, 3, .005), [glassM, glassM, glassM, scr, glassM, glassM], 0, -PT / 2 - .003, 0));
    const yTop = PT / 2 + .053;
    for (const [x, z] of [[-.51, -1.41], [-.09, -1.2], [-.51, -.98]]){
      fb.add(mesh(new THREE.CylinderGeometry(.19, .2, .06, 40), PM.ring, x, yTop + .03, z));
      fb.add(R_(mesh(new THREE.TorusGeometry(.18, .011, 8, 40), PM.bezel, x, yTop + .06, z), Math.PI / 2, 0, 0));
      const lens = mesh(new THREE.SphereGeometry(.105, 24, 10, 0, 6.29, 0, 1.0), PM.lens, x, yTop + .058, z); lens.scale.y = .32; fb.add(lens);
    }
    fb.add(mesh(new THREE.CylinderGeometry(.07, .07, .012, 24), PM.flash, .53, yTop + .006, -1.45));
    fb.add(mesh(new THREE.CylinderGeometry(.075, .075, .012, 24), glassM, .52, yTop + .006, -.97));
    for (const [x, z, L] of [[-PW_ / 2, -1.02, .2], [-PW_ / 2, -.62, .36], [-PW_ / 2, -.18, .36], [PW_ / 2, -.72, .5]]) fb.add(mesh(new RoundedBoxGeometry(.03, .06, L, 2, .012), PM.alu, x + Math.sign(x) * .01, 0, z));
    fb.scale.setScalar(.48); phoneBody.add(fb);
  }
  loadGL('./models/phone.gltf.json', gl => {
    const old = [...phoneBody.children];
    gl.scene.traverse(o => { if (o.isMesh){ const nm = o.material.name; o.material = PM[nm] || o.material; o.castShadow = o.receiveShadow = true; o.userData.key = 'phone';
      if (nm === 'screen'){ const uv = o.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - uv.getY(i)); uv.needsUpdate = true; } } });
    gl.scene.scale.setScalar(.48); phoneBody.add(gl.scene); old.forEach(o => o.visible = false);
  });
  phone.position.set(-.45, .17, 2.55); phone.rotation.y = .25; add(phone, 'phone');
}
const stepPhone = dt => {
  phoneFlip.t = Math.min(1, phoneFlip.t + dt / .75); const p = phoneFlip.t, e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  phoneFlip.v = phoneFlip.from + (phoneFlip.to - phoneFlip.from) * e;
  phoneBody.rotation.z = phoneFlip.v * Math.PI; phoneBody.position.y = Math.sin(phoneFlip.v * Math.PI) * .45;
};

