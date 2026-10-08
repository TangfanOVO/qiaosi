/* 花瓣：一片微微内卷的长椭圆，底部带一点粉 */
function petalGeo(L, W, curl, tilt){
  const g = new THREE.PlaneGeometry(1, 1, 4, 7), p = g.attributes.position, col = [];
  const base = new THREE.Color('#dba6b8'), tip = new THREE.Color('#fdfbf7');
  for (let i = 0; i < p.count; i++){
    const u = p.getX(i) * 2, v = p.getY(i) + .5;
    const w = W * Math.pow(Math.max(0, Math.sin(Math.PI * (.1 + .9 * v))), .75) * (1 - .1 * v);
    p.setXYZ(i, u * w, v * L, curl * u * u * w - tilt * v * v * L);
    const c = base.clone().lerp(tip, Math.min(1, Math.pow(v * 2.6, .8))); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
/* 玉兰的花：九片花被分三轮，每片是一把“小勺”——中间宽、往上收尖、整片往里兜着，底部带一点淡紫粉；
   三种姿态：还没张开的花苞（外面裹着毛茸茸的苞片）、半开的高脚杯、全开（外轮往外翻，露出中间淡绿的雌蕊柱和一圈雄蕊） */
/* 玉兰的花被片：长圆状倒卵形——基部窄、上三分之一最宽、顶端是圆的（不是尖的）；厚，往里兜成一只勺；
   纯白，只有最底下一点点淡粉，往上透一点奶油色；开足了以后外轮的瓣尖微微往外翻 */
function tepalGeo(L, W, cup, tilt, recurve, hi){
  const g = new THREE.PlaneGeometry(1, 1, hi ? 8 : 4, hi ? 16 : 9), p = g.attributes.position, col = [];
  const base = new THREE.Color('#d9aab6'), mid = new THREE.Color('#f7f0ea'), tip = new THREE.Color('#fffdf9'), c = new THREE.Color();
  const PK = .64;   // 最宽处
  for (let i = 0; i < p.count; i++){
    const u = p.getX(i) * 2, v = p.getY(i) + .5;
    const prof = v < PK ? Math.pow(Math.sin(Math.PI / 2 * v / PK), .75) * (.22 + .78 * Math.pow(v / PK, .5)) : Math.sqrt(Math.max(0, 1 - Math.pow((v - PK) / (1 - PK), 2)));
    const w = W * Math.max(.04, prof);
    const z = cup * (1 - u * u) * w * (.45 + .55 * Math.sin(Math.PI * Math.min(1, v * 1.1))) - tilt * v * v * L - recurve * Math.pow(Math.max(0, v - .65), 2) * L * 3;
    p.setXYZ(i, u * w, v * L * (1 - .06 * u * u), z);
    if (v < .18) c.copy(base).lerp(mid, Math.pow(v / .18, .8)); else c.copy(mid).lerp(tip, Math.min(1, (v - .18) / .45));
    c.offsetHSL(0, 0, -.03 * Math.abs(u));   // 瓣边略暗一点，瓣中间鼓起来的地方亮
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
const colored = (g, hex) => { const c = new THREE.Color(hex), a = []; for (let i = 0; i < g.attributes.position.count; i++) a.push(c.r, c.g, c.b); g.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };
/* 一朵玉兰：九片花被分三轮，每片都是绕着花心弯过去的一片“瓦”——不是平的，而是贴着一只杯子的曲面；
   相邻两片在边上叠一点，看不到缝。外轮最大、在最外面，里面两轮依次小一点、错开半片。
   杯子的形状决定开到哪一步：花苞是合拢的纺锤形；高脚杯是下面收、中间鼓、口微微收；全开时外轮往外摊开、瓣尖往外翻。
   底下一个小小的绿褐色花托连着花梗；花苞外面还裹着半截毛茸茸的灰褐苞片 */
const flowerStage = (stage, hi) => {
  const SEG_U = hi ? 10 : 4, SEG_V = hi ? 16 : 7;   // 树上的花远，面数省着用；瓶里那几朵凑近看，分得细
  const shape = {
    bud:    {L: .8,  R: v => .05 + .15 * Math.pow(Math.sin(Math.PI * Math.min(1, v * .98)), .8) * (1 - .2 * v), flare: 0},
    goblet: {L: 1.05, R: v => .07 + .36 * Math.pow(Math.sin(Math.PI / 2 * Math.min(1, v / .72)), .75) - .06 * Math.max(0, v - .8) / .2, flare: 0},
    open:   {L: 1.1, R: v => .08 + .5 * Math.pow(Math.sin(Math.PI / 2 * Math.min(1, v / .8)), .8), flare: .22}
  }[stage];
  const base = new THREE.Color('#d9aab6'), mid = new THREE.Color('#f6eee8'), tip = new THREE.Color('#fffdf9'), c = new THREE.Color();
  const gs = [];
  for (let w = 0; w < 3; w++) for (let k = 0; k < 3; k++){
    const g = new THREE.PlaneGeometry(1, 1, SEG_U, SEG_V), p = g.attributes.position, col = [];
    const th0 = k * Math.PI * 2 / 3 + w * Math.PI / 3 + (w === 2 ? .25 : 0) + (k * .37 + w * .21) % .2;
    const Lw = shape.L * [1, .95, .88][w] * (1 + (((k * 7 + w * 3) % 5) - 2) * .025), rS = [1, .955, .91][w], open = stage === 'open' ? [.62, .36, .14][w] : stage === 'goblet' ? [.12, .05, 0][w] : 0;
    for (let i = 0; i < p.count; i++){
      const u = p.getX(i) * 2, v = p.getY(i) + .5;
      const prof = v < .62 ? Math.pow(Math.sin(Math.PI / 2 * v / .62), .7) * (.3 + .7 * Math.pow(v / .62, .45)) : Math.sqrt(Math.max(0, 1 - Math.pow((v - .62) / .38, 2.2)));
      let R = shape.R(v) * rS + open * .55 * v * v;                                   // 越外的一轮开得越多
      const ang = Math.min(1.25, (.64 * prof) / Math.max(.06, R) * (stage === 'open' ? .9 : 1.15)) * u;   // 这片瓣沿着杯口弯过去的角度（宽的地方弯得多，叠住隔壁）
      R += (1 - u * u) * .025 + open * shape.flare * Math.pow(Math.max(0, v - .7), 2) * 2.4;   // 瓣中间鼓一点；全开时瓣尖往外翻
      R += [.07, .025, -.03][w] * Math.pow(Math.max(0, (v - .62) / .38), 1.6) * (stage === 'bud' ? .3 : 1);   // 瓣尖：外轮微微往外、里轮往里收，一层层看得出来
      const y = v * Lw * (1 - .2 * open * v);
      p.setXYZ(i, Math.cos(th0 + ang) * R, y, Math.sin(th0 + ang) * R);
      if (v < .16) c.copy(base).lerp(mid, Math.pow(v / .16, .8)); else c.copy(mid).lerp(tip, Math.min(1, (v - .16) / .45));
      c.offsetHSL(0, 0, -.02 * Math.abs(u) - .065 * Math.pow(Math.abs(u), 6) - .02 * w);   // 瓣边一道淡淡的暗线，分得出一片一片
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.deleteAttribute('uv'); g.computeVertexNormals(); gs.push(g);
  }
  gs.push(colored(new THREE.CylinderGeometry(.03, .04, .24, 6).translate(0, -.1, 0), '#5f5844'));     // 花梗
  gs.push(colored(new THREE.SphereGeometry(.085, 10, 6).scale(1, .6, 1), '#7d7a52'));                // 花托
  if (stage === 'open'){
    gs.push(colored(new THREE.ConeGeometry(.06, .32, 8).translate(0, .2, 0), '#c6cf96'));          // 雌蕊柱
    for (let k = 0; k < 18; k++){ const a = k / 18 * Math.PI * 2; gs.push(colored(new THREE.CylinderGeometry(.01, .012, .11, 3).rotateZ(.55).rotateY(-a).translate(Math.cos(a) * .09, .05, Math.sin(a) * .09), '#c4927e')); }
  }
  if (stage === 'bud'){   // 半截毛苞片：灰褐、外面有绒毛的感觉（颜色带一点浅色斑）
    const bg = new THREE.LatheGeometry([[0, -.02], [.1, 0], [.17, .12], [.18, .26], [.12, .36], [.15, .33]].map(([x, y]) => new THREE.Vector2(x, y)), hi ? 14 : 8), bc = [], bp = bg.attributes.position, cc = new THREE.Color();
    for (let i = 0; i < bp.count; i++){ cc.set('#8a8370').offsetHSL(0, 0, ((i * 37) % 11) / 110 - .03); bc.push(cc.r, cc.g, cc.b); }
    bg.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3)); bg.deleteAttribute('uv'); gs.push(bg);
  }
  return mergeGeometries(gs);
};
const flowerGeo = flowerStage('goblet');
const leafGeo = (() => {
  const g = new THREE.PlaneGeometry(1, 1, 2, 5), p = g.attributes.position;
  for (let i = 0; i < p.count; i++){
    const u = p.getX(i) * 2, v = p.getY(i) + .5, w = .42 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, v * 1.05))), .8);
    p.setXYZ(i, u * w, .15 + v * 1.45, Math.abs(u) * w * .32 - v * v * .25);
  }
  g.computeVertexNormals(); return g;
})();
const budGeo = (() => { const g = new THREE.SphereGeometry(.15, 8, 6); g.scale(1, 2.3, 1); g.translate(0, .32, 0); return g; })();


/* ── 枝头的东西：三只风铃（碎碎念）、一只鸟（空间） ── */
const nearest = (target, maxR = .32) => { let best = null, bd = 1e9; for (const s of segs){ if (s.r1 > maxR || s.r1 < .05) continue; const d = s.b.distanceTo(target); if (d < bd){ bd = d; best = s.b; } } return best.clone(); };
for (let i = 0; i < 6; i++) rnd();   // 原来树上那三只简易风铃用过的随机数，留着位子，后面的摆件不变

