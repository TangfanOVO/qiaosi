/* ── 材质 ── */
const std = (color, rough = .8, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: rough, ...extra});
const M = {
  wall: std('#ece4d8', .95), sill: std('#4a4540', .55), desk: std('#a57e57', .5),
  steel: std('#231e1a', .6),
  glass: new THREE.MeshPhysicalMaterial({color: '#dfeaee', transparent: true, opacity: .1, roughness: .04, metalness: 0, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4}),
  paper: std('#f4f1ea', .9, {side: THREE.DoubleSide}), bark: std('#a39d94', .78),
  ground: std('#a9b09a', 1), city: std('#c6cbcc', .95), concrete: std('#b9b8b2', .95)
};

/* ── 贴图：全部用代码现画（木纹、墙面、亚麻、书页、釉面），不用任何图片素材 ── */
const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const tex = (w, h, draw, {rep, color = true} = {}) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
  if (rep){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};
const noiseDots = (x, w, h, n, a, cols) => { for (let i = 0; i < n; i++){ x.fillStyle = cols[(rnd() * cols.length) | 0].replace('A', (a * (.4 + rnd() * .6)).toFixed(3)); x.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } };
// 桌面木纹：顺着长边走的细纹 + 几条宽的深浅带
const woodDraw = (base, bandD, bandL, lineD, lineL) => (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let b = 0; b < 14; b++){ const y = rnd() * h, hh = 20 + rnd() * 70; x.fillStyle = rnd() < .5 ? `rgba(${bandD},${.05 + rnd() * .08})` : `rgba(${bandL},${.05 + rnd() * .08})`; x.fillRect(0, y, w, hh); }
  for (let i = 0; i < 1100; i++){
    const y = rnd() * h, L = 300 + rnd() * 1500, x0 = rnd() * w - 300, dark = rnd() < .62;
    x.strokeStyle = dark ? `rgba(${lineD},${.05 + rnd() * .13})` : `rgba(${lineL},${.04 + rnd() * .09})`; x.lineWidth = .5 + rnd() * 1.8;
    x.beginPath(); x.moveTo(x0, y); const ph = rnd() * 6, amp = rnd() * 4; for (let k = 1; k <= 12; k++) x.lineTo(x0 + L * k / 12, y + Math.sin(k * .7 + ph) * amp); x.stroke();
  }
  noiseDots(x, w, h, 6000, .07, ['rgba(30,24,20,A)', 'rgba(200,190,175,A)']);   // 旧木头上的细小斑驳
};
// 桌面：烟熏过的旧橡木，偏灰褐；小件用一块浅一点的风化木
const woodTex = tex(2048, 680, woodDraw('#2c241e', '16,12,9', '74,62,50', '8,6,5', '96,82,68'));
const woodPale = tex(1024, 340, woodDraw('#4f453c', '34,28,23', '104,92,80', '22,18,14', '120,108,94'));
M.desk.map = woodTex; M.desk.color.set('#ffffff'); M.desk.roughness = .62; M.desk.needsUpdate = true;
// 窗台：深色的磨石面，细细的浅色和深色碎粒，几道很淡的纹
M.sill.map = tex(512, 512, (x, w, h) => { x.fillStyle = '#3f3b37'; x.fillRect(0, 0, w, h); noiseDots(x, w, h, 9000, .5, ['rgba(150,140,128,A)', 'rgba(18,16,14,A)', 'rgba(110,98,86,A)']);
  x.strokeStyle = 'rgba(160,150,138,.08)'; x.lineWidth = 2; for (let i = 0; i < 6; i++){ x.beginPath(); let px = rnd() * w, py = rnd() * h; x.moveTo(px, py); for (let k = 0; k < 20; k++){ px += (rnd() - .3) * 30; py += (rnd() - .5) * 30; x.lineTo(px, py); } x.stroke(); } }, {rep: [3, 1]});
M.sill.color.set('#ffffff'); M.sill.roughness = .42; M.sill.needsUpdate = true;
M.steel.map = woodTex; M.steel.color.set('#d8cfc4'); M.steel.roughness = .55; M.steel.needsUpdate = true;   // 窗框：深色木头，看得见木纹
// 墙：很淡的大块深浅（手抹灰泥）
const wallTex = tex(512, 512, (x, w, h) => {
  x.fillStyle = '#3b352f'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 320; i++){ const r = 20 + rnd() * 110, g = x.createRadialGradient(0, 0, 0, 0, 0, r); const c = rnd() < .55 ? '18,15,12' : '96,88,78'; g.addColorStop(0, `rgba(${c},${.05 + rnd() * .07})`); g.addColorStop(1, `rgba(${c},0)`); x.save(); x.translate(rnd() * w, rnd() * h); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); x.restore(); }
  noiseDots(x, w, h, 5000, .06, ['rgba(120,100,80,A)', 'rgba(255,255,255,A)']);
}, {rep: [4, 4]});
M.wall.map = wallTex; M.wall.color.set('#ffffff'); M.wall.needsUpdate = true;
// 亚麻：经纬线 + 粗细不匀的纱 + 两头各两道织进去的细条 + 流苏（透明）
const linenTex = tex(512, 1440, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  const top = 46, bot = h - 46;
  x.fillStyle = '#5e574d'; x.fillRect(0, top, w, bot - top);
  for (let y = top; y < bot; y += 2){ x.fillStyle = `rgba(${rnd() < .5 ? '150,132,108' : '255,250,240'},${.06 + rnd() * .14})`; x.fillRect(0, y, w, 1); }
  for (let X = 0; X < w; X += 2){ x.fillStyle = `rgba(${rnd() < .5 ? '140,124,100' : '255,252,244'},${.05 + rnd() * .12})`; x.fillRect(X, top, 1, bot - top); }
  for (let i = 0; i < 90; i++){ const y = top + rnd() * (bot - top); x.fillStyle = `rgba(160,140,112,${.08 + rnd() * .1})`; x.fillRect(0, y, w, 1 + rnd() * 2); }   // 粗一点的纱（竹节）
  for (const yy of [top + 60, top + 72, bot - 72, bot - 60]){ x.fillStyle = 'rgba(176,164,146,.45)'; x.fillRect(0, yy, w, 3); }
  for (let X = 2; X < w; X += 5){ x.strokeStyle = `rgba(104,96,86,${.8 + rnd() * .2})`; x.lineWidth = 2; x.beginPath(); x.moveTo(X, top); x.lineTo(X + (rnd() - .5) * 6, top - 20 - rnd() * 24); x.stroke(); x.beginPath(); x.moveTo(X, bot); x.lineTo(X + (rnd() - .5) * 6, bot + 20 + rnd() * 24); x.stroke(); }
});
// 书页：一页一张图，像真的排版（字是随便挑的常用字，只是看起来像一页书）
const POOL = '春风细雨山河人间日月星辰远近江湖花开落叶归来去留天地光影清浅深长相见如初夜色温柔时候慢慢走过街灯窗外树影安静记得那年我们一起看海听雨等你回家路上';
const drawPage = (x, w, h, side, head, text, no) => {
  x.fillStyle = '#e9e1d1'; x.fillRect(0, 0, w, h);
  const g = side < 0 ? x.createLinearGradient(w, 0, w - 140, 0) : x.createLinearGradient(0, 0, 140, 0);
  g.addColorStop(0, 'rgba(120,96,70,.28)'); g.addColorStop(1, 'rgba(120,96,70,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  noiseDots(x, w, h, 2500, .05, ['rgba(140,120,96,A)']);
  x.fillStyle = 'rgba(52,46,40,.82)'; x.textBaseline = 'top';
  const mL = side < 0 ? 84 : 110, mR = side < 0 ? 110 : 84; let y = 96;
  if (head){ x.font = '600 34px "Noto Serif CJK SC", "Songti SC", serif'; x.textAlign = 'center'; x.fillText(head, w / 2, 120); y = 230; x.textAlign = 'left'; }
  x.font = '400 24px "Noto Serif CJK SC", "Songti SC", serif';
  const cols = Math.floor((w - mL - mR) / 26);
  if (text){   // 真的书页：后端给的那一页正文，按字排；空行分段，段首空两格
    for (const para of String(text).split(/\n+/)){
      let line = '　　'; for (const ch of para.trim()){ if (line.length >= cols){ if (y > h - 110) break; x.fillText(line, mL, y); y += 40; line = ''; } line += ch; }
      if (y > h - 110) break; x.fillText(line, mL, y); y += 40;
    }
  } else {     // 还没接数据：随便挑字，只是看起来像一页书
    let para = 0;
    while (y < h - 110){
      const ind = para === 0 ? 2 : 0, end = rnd() < .16;
      const n = end ? Math.max(4, Math.floor(cols * (.3 + rnd() * .5))) : cols - ind;
      let s = ''; for (let i = 0; i < n; i++) s += POOL[(rnd() * POOL.length) | 0];
      if (end) s += '。';
      x.fillText(s, mL + ind * 26, y); y += 40; para = end ? 0 : para + 1;
    }
  }
  x.font = '400 18px system-ui, sans-serif'; x.fillStyle = 'rgba(52,46,40,.55)'; x.textAlign = 'center'; x.fillText(no, w / 2, h - 66); x.textAlign = 'left';
};
const pageTex = (side, head) => {
  const t = tex(720, 1024, (x, w, h) => drawPage(x, w, h, side, head, null, side < 0 ? '214' : '215'));
  t.userData.set = (text, hd, no) => { drawPage(t.image.getContext('2d'), 720, 1024, side, hd, text, no); t.needsUpdate = true; };
  return t;
};
const BOOK_PAGES = [];
// 釉面：米白底，细细的铁斑点
const speckTex = tex(512, 256, (x, w, h) => { x.fillStyle = '#4b4641'; x.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++){ const r = 10 + rnd() * 40, g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, `rgba(${rnd() < .5 ? '120,108,94' : '225,218,206'},.12)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.translate(rnd() * w, rnd() * h); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); x.restore(); } noiseDots(x, w, h, 1600, .45, ['rgba(20,16,12,A)', 'rgba(170,156,136,A)']); }, {rep: [2, 1]});
// 封面布纹
const clothTex = (base) => tex(256, 256, (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2){ x.fillStyle = `rgba(0,0,0,${.03 + rnd() * .05})`; x.fillRect(0, y, w, 1); } for (let X = 0; X < w; X += 2){ x.fillStyle = `rgba(255,255,255,${.02 + rnd() * .04})`; x.fillRect(X, 0, 1, h); } }, {rep: [3, 3]});

