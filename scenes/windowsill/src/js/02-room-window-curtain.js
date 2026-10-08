/* ── 房间：一面长墙。左边一段是实墙（台灯、花瓶、书和蜡烛、墙上的挂历），右边一大扇窗；一张长桌贴着墙通过去 ── */
const room = new THREE.Group(); scene.add(room);
const box = (w, h, d, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; room.add(m); return m; };
{
  const zc = WALL_Z - WALL_T / 2, Y0 = -12, Y1 = 36, XL = -28, XR = 30, cx = (WIN.x0 + WIN.x1) / 2;
  box(WIN.x0 - XL, Y1 - Y0, WALL_T, M.wall, (XL + WIN.x0) / 2, (Y0 + Y1) / 2, zc);
  box(XR - WIN.x1, Y1 - Y0, WALL_T, M.wall, (XR + WIN.x1) / 2, (Y0 + Y1) / 2, zc);
  box(WIN.x1 - WIN.x0, WIN.y0 - Y0, WALL_T, M.wall, cx, (Y0 + WIN.y0) / 2, zc);
  box(WIN.x1 - WIN.x0, Y1 - WIN.y1, WALL_T, M.wall, cx, (Y1 + WIN.y1) / 2, zc);
  // 窗台：往屋里多伸出 4.5 厘米
  const sz0 = GLASS_Z, sz1 = WALL_Z + .45;
  box(WIN.x1 - WIN.x0 + .8, SILL_Y - WIN.y0, sz1 - sz0, M.sill, cx, (SILL_Y + WIN.y0) / 2, (sz0 + sz1) / 2);
  // 长桌：暖木色，贴墙
  const d = new THREE.Mesh(new RoundedBoxGeometry(17.8, .45, 7.7, 3, .1), M.desk); d.position.set(3.35, -.225, (WALL_Z + 4.4) / 2); d.castShadow = d.receiveShadow = true; room.add(d);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), std('#211c18', .8)); fl.rotation.x = -Math.PI / 2; fl.position.set(0, -7.5, 12); fl.receiveShadow = true; room.add(fl);
}

/* ── 大窗：木框，一整扇推拉玻璃（现在推开着），中间不加任何竖框横杆 ── */
const winG = new THREE.Group(); scene.add(winG);
const bar = (parent, w, h, x, y, z = 0, d = .26) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.steel); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
const pane = (parent, w, h, x, y, z = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass); m.position.set(x, y, z); m.layers.set(1); parent.add(m); return m; };
{
  const F = .24, H = WIN.y1 - WIN.y0, yc = (WIN.y0 + WIN.y1) / 2, z = GLASS_Z, cx = (WIN.x0 + WIN.x1) / 2, W = WIN.x1 - WIN.x0;
  bar(winG, W, F, cx, WIN.y0 + F / 2, z); bar(winG, W, F, cx, WIN.y1 - F / 2, z);
  bar(winG, F, H, WIN.x0 + F / 2, yc, z); bar(winG, F, H, WIN.x1 - F / 2, yc, z);
  // 窗是开着的：玻璃整扇推进墙里去了，风、雨、雪、叶子都能从这儿进来
}
/* 纱帘：亚麻纱，挂在窗的右头，风从开着的窗扇吹进来，下摆一直在飘。
   经纬线粗细不匀（亚麻的竹节），疏的地方透光；褶子宽窄不一；底边折了一道贴边，比别处厚、更不透；上面一排铜环挂在杆上 */
const curtain = (() => {
  const cr = (a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(77);   // 自己的随机数，不去动树用的那串
  const W = 3.6, H = WIN.y1 + .3 - .4, g = new THREE.PlaneGeometry(W, H, 64, 48);
  const weave = tex(256, 256, (x, w, h) => {
    x.fillStyle = 'rgb(140,140,140)'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2.6){ const a = .28 + cr() * .3; x.fillStyle = `rgba(255,255,255,${a})`; x.fillRect(0, y, w, cr() < .1 ? 1.9 : 1.1);
      for (let k = 0; k < 2; k++) if (cr() < .35){ x.fillStyle = `rgba(255,255,255,${.22 + cr() * .22})`; x.fillRect(cr() * w, y - .3, 6 + cr() * 18, 1.8); } }   // 纬线 + 竹节
    for (let xx = 0; xx < w; xx += 2.8){ x.fillStyle = `rgba(255,255,255,${.16 + cr() * .22})`; x.fillRect(xx, 0, cr() < .1 ? 1.8 : 1, h);
      if (cr() < .25){ x.fillStyle = `rgba(255,255,255,${.3 + cr() * .3})`; x.fillRect(xx - .3, cr() * h, 1.8, 10 + cr() * 50); } }
  }, {rep: [9, 30], color: false});
  const pleat = u => Math.sin(u * 21) * .7 + Math.sin(u * 34 + 1.7) * .3 + Math.sin(u * 8 + .6) * .35;   // 褶子不等宽：三股叠在一起
  const mat = new THREE.MeshStandardMaterial({color: '#f2eadb', map: weave, alphaMap: weave, roughness: .92, transparent: true, opacity: .62, side: THREE.DoubleSide, emissive: new THREE.Color('#fff4e6'), emissiveIntensity: .08, depthWrite: false});
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = WIND.uT; sh.uniforms.uAmp = WIND.uAmp;
    sh.vertexShader = 'uniform float uT, uAmp;\nvarying vec2 vCu;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      float v = 1.0 - uv.y, u = uv.x; vCu = uv;
      transformed.x *= 1.0 - .25 * (1.0 - v);                                   // 上面收着，下面散开
      transformed.z += (sin(u * 21.0) * .7 + sin(u * 34.0 + 1.7) * .3 + sin(u * 8.0 + .6) * .35) * .2 * (1.0 - .3 * v);
      float tg = uT - 13.2 * .035 - v * .5, gst = sin(tg * .9) * .62 + sin(tg * 1.53 + 1.1) * .28 + sin(tg * 2.9 + .4) * .1;   // 和窗外柳条同一阵风
      float sw = v * v, ka = (.35 + .65 * min(uAmp / .165, 2.8)) * (.55 + .45 * gst);   // 风大了下摆鼓得更高，往屋里扬；一阵风过来时一起鼓
      transformed.z += sw * ka * (.8 + .5 * sin(uT * .9 + u * 2.0)) * (.55 + .45 * sin(uT * 1.6 + v * 3.0 + u * 4.0));
      transformed.x -= sw * ka * (.5 + .4 * sin(uT * 1.2 + v * 2.5));
      transformed.y += sw * max(0., ka - 1.2) * .35 * (.6 + .4 * sin(uT * 2.1 + u * 5.));`);
    sh.fragmentShader = 'varying vec2 vCu;\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', `
      #include <alphamap_fragment>
      float hem = step(vCu.y, .022) + step(1. - .012, vCu.y) * .6 + (step(vCu.x, .014) + step(1. - .014, vCu.x)) * .7;   // 底边、顶边、两侧折边：两层纱
      float seam = smoothstep(.0, .004, abs(vCu.y - .022)) ;                                                             // 贴边的那道缝线
      diffuseColor.a = min(1., diffuseColor.a * (1. + .9 * min(hem, 1.)));
      diffuseColor.rgb *= mix(.82, 1., seam);`);
  };
  mat.customProgramCacheKey = () => 'curtain4';
  const m = new THREE.Mesh(g, mat); m.position.set(WIN.x1 + 2.8, .4 + H / 2, WALL_Z + .45); m.renderOrder = 2; scene.add(m);
  // 杆：拉丝铜，两头一颗小圆头；纱帘顶上一排铜环套在杆上，环下面一只小夹子夹住布边
  const brass = std('#a8885a', .38, {metalness: .85});
  const rodY = WIN.y1 + .7, rodZ = WALL_Z + .45, rodL = WIN.x1 - WIN.x0 + 5.6, rodX = (WIN.x0 + WIN.x1) / 2 + 1.8;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, rodL, 16), brass); rod.rotation.z = Math.PI / 2; rod.position.set(rodX, rodY, rodZ); scene.add(rod);
  for (const s of [-1, 1]){
    const f = new THREE.Mesh(new THREE.SphereGeometry(.13, 18, 12), brass); f.position.set(rodX + s * (rodL / 2 + .1), rodY, rodZ); scene.add(f);
    const k = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .5, 10), brass); k.rotation.x = Math.PI / 2; k.position.set(rodX + s * (rodL / 2 - .4), rodY, rodZ - .25); scene.add(k);   // 托架
  }
  const ringG = new THREE.TorusGeometry(.13, .016, 8, 24), clipG = new THREE.BoxGeometry(.07, .12, .035), wireG = new THREE.CylinderGeometry(.008, .008, .22, 5);
  const topY = .4 + H;
  for (let i = 0; i < 9; i++){
    const u = i / 8, x = m.position.x + (u - .5) * W * .75, z = rodZ + pleat(u) * .2;
    const r = new THREE.Mesh(ringG, brass); r.rotation.y = Math.PI / 2; r.position.set(x, rodY - .02, rodZ); scene.add(r);
    const wi = new THREE.Mesh(wireG, brass); wi.position.set(x, rodY - .26, (rodZ + z) / 2); scene.add(wi);
    const c = new THREE.Mesh(clipG, brass); c.position.set(x, topY - .02, z); scene.add(c);
  }
  return m;
})();

