/* ══════════ 天气：风、雨、雪、雷 ══════════
   拉杆调出来的是“目标”，画面慢慢跟过去（雨一点点下大、地一点点湿、雪一点点积）。
   窗是开着的：雨和雪在窗外落；风一大，斜着从窗口灌进来，先打湿/积在窗台上，再往里落到桌上。
   淋湿：东西慢慢变深、变得有点反光，纸上桌上先是一粒粒雨点印，然后连成片；雨停了一点点干。
   积雪：只积在朝上、头顶没东西挡着的地方，边缘斑驳，挨着高东西的根部少一点；雪停了慢慢化 */
const WXS = {wind: .25, rain: 0, snow: 0, thunder: 0, autoSnow: false};          // 拉杆
const WXU = {wet: {value: 0}, snow: {value: 0}, time: {value: 0}, reach: {value: 2}, ld: {value: new THREE.Vector2(.5, .5)}};
/* 从正上方拍窗台和桌子的“高度图”：谁头顶有东西挡着，雪就落不到它 */
const TOPB = {cx: 5, cz: -1.5, w: 15, h: 8.4};
const topRT = new THREE.WebGLRenderTarget(512, 288, {generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter});
const topCam = new THREE.OrthographicCamera(-TOPB.w / 2, TOPB.w / 2, TOPB.h / 2, -TOPB.h / 2, .1, 40);
topCam.position.set(TOPB.cx, 30, TOPB.cz); topCam.up.set(0, 0, -1); topCam.lookAt(TOPB.cx, 0, TOPB.cz); topCam.updateMatrixWorld();
WXU.top = {value: topRT.texture}; WXU.topBox = {value: new THREE.Vector4(TOPB.cx, TOPB.cz, TOPB.w, TOPB.h)};
const topMat = new THREE.ShaderMaterial({side: THREE.DoubleSide,
  vertexShader: `#include <common>
    varying float vY;
    void main(){
      #include <begin_vertex>
      vec4 wp = vec4(transformed, 1.);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
      #endif
      wp = modelMatrix * wp; vY = wp.y; gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: `varying float vY; void main(){ gl_FragColor = vec4(clamp((vY + 1.5) / 10., 0., 1.), 0., 0., 1.); }`});
let tallCache = null;
const renderTop = () => {
  if (!tallCache){ tallCache = new Set(); const b = new THREE.Box3(); room.traverse(o => { if (o.isMesh){ b.setFromObject(o); if (b.max.y > 6) tallCache.add(o); } });
    winG.traverse(o => o.isMesh && tallCache.add(o)); scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !tallCache.has(o)){ b.setFromObject(o); if (b.min.y > 12) tallCache.add(o); } }); }   // 墙、窗框、高高的窗帘杆：从上往下拍时不算（雪是斜着飘进来的，挡不住）
  const hid = [];
  scene.traverse(o => { if (!o.visible) return; const mm = o.material;
    if (tallCache.has(o) || o === sky || o.isSprite || o.isPoints || o.isLine || (o.isMesh && (Array.isArray(mm) ? false : (mm && (mm.transparent || mm.colorWrite === false || mm.isShaderMaterial))))){ o.visible = false; hid.push(o); } });
  const au = renderer.shadowMap.autoUpdate, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha(), fog = scene.fog;
  scene.overrideMaterial = topMat; scene.fog = null; renderer.shadowMap.autoUpdate = false; renderer.setClearColor(0x000000, 1);
  renderer.setRenderTarget(topRT); renderer.clear(); renderer.render(scene, topCam); renderer.setRenderTarget(null);
  scene.overrideMaterial = null; scene.fog = fog; renderer.shadowMap.autoUpdate = au; renderer.setClearColor(cc, ca);
  hid.forEach(o => o.visible = true);
};
const WX_GLSL = `
  float wxH(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float wxN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(mix(wxH(i), wxH(i + vec3(1,0,0)), f.x), mix(wxH(i + vec3(0,1,0)), wxH(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(wxH(i + vec3(0,0,1)), wxH(i + vec3(1,0,1)), f.x), mix(wxH(i + vec3(0,1,1)), wxH(i + vec3(1,1,1)), f.x), f.y), f.z); }
  vec4 wxH4(vec2 p){ vec4 q = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099)); q += dot(q, q.wzxy + 33.33); return fract((q.xxyz + q.yzzw) * q.zywx); }
  float wxN2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(wxH4(i).x, wxH4(i + vec2(1, 0)).x, f.x), mix(wxH4(i + vec2(0, 1)).x, wxH4(i + vec2(1, 1)).x, f.x), f.y); }
  vec3 wxBump(vec3 sp, vec3 n, vec2 dH, float fd){ vec3 sx = normalize(dFdx(sp)), sy = normalize(dFdy(sp)), r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1) * fd; return normalize(abs(det) * n - sign(det) * (dH.x * r1 + dH.y * r2)); }
  /* 雨点：每一格里随机落一滴，形状不圆（拉长、歪着、边缘洇开），有大有小；落下 → 慢慢收小变干 → 消失，同一格过一会儿又落一滴；干掉的留一圈水痕 */
  vec2 wxDrops(vec2 q, float wet, float t){
    vec2 c = floor(q); float sp = 0., rim = 0.;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
      vec2 g = c + vec2(i, j); vec4 h = wxH4(g);
      float P = 3. + h.w * 5., ph = t / P + h.z, cyc = floor(ph), age = fract(ph);
      vec4 k = wxH4(g + cyc * 17.13 + 3.7);
      if (k.z > .08 + .42 * wet) continue;
      vec2 dv = q - (g + .2 + k.xy * .6); float an = k.w * 6.2832; vec2 e = vec2(cos(an), sin(an));
      dv = vec2(dot(dv, e), dot(dv, vec2(-e.y, e.x))); dv.y *= 1. + k.x * 1.1;
      float dry = smoothstep(.4, 1., age), r = mix(.1, .4, k.y * k.y) * (.8 + .35 * wet) * (1. - .4 * dry);
      float d = length(dv) + (wxN2(q * 3.3 + k.xy * 23.) - .5) * r * 1.1 + (wxN2(q * 9.7 + k.zw * 31.) - .5) * r * .45;
      float born = smoothstep(0., .03, age);
      sp = max(sp, (1. - smoothstep(r * .55, r, d)) * born * (1. - dry));
      rim = max(rim, smoothstep(r * .5, r * .88, d) * (1. - smoothstep(r * .88, r * 1.05, d)) * born * (1. - smoothstep(.75, 1., age)));
    }
    return vec2(sp, rim);
  }
  float wxDots(vec2 q, float T){ vec2 c = floor(q), f = fract(q); vec4 h = wxH4(c + 7.1);
    float r = .38 * smoothstep(-.4, .05, T + (h.w - .5) * .35) * step(h.z, .5) * smoothstep(0., .3, uSnow); return 1. - smoothstep(r * .5, r, length(f - .3 - h.xy * .4)); }
  float wxSnowT(vec3 rp, vec3 wp, float A){ vec3 wq = rp * 3. + wp; float L = wxN(wq) * .62 + wxN(wq * 2.2 + 7.) * .38; return (A - .5) * 1.7 + (L - .5) * 1.15; }
  /* 雨雪淋得到这里吗：窗外全都淋得到；屋里只有窗口正对着、离窗不远的地方（风越大，飘进来越远） */
  float wxExpo(vec3 w){
    if (w.z < ${(GLASS_Z - .05).toFixed(2)}) return 1.;
    float inX = smoothstep(${(WIN.x0 - .7).toFixed(2)}, ${(WIN.x0 + .5).toFixed(2)}, w.x) * smoothstep(${(WIN.x1 + .7).toFixed(2)}, ${(WIN.x1 - .5).toFixed(2)}, w.x);
    float d = w.z - ${GLASS_Z.toFixed(2)};
    return inX * (1. - smoothstep(uReach * .45, uReach, d)) * step(w.y, ${(WIN.y1).toFixed(2)});
  }`;
const weatherify = m => {
  if (!m || m.userData.wx || m.userData.noWx || m.transparent || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return;
  m.userData.wx = true;
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey && m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : null;
  m.onBeforeCompile = (sh, r) => {
    if (prev && prev !== THREE.Material.prototype.onBeforeCompile) prev.call(m, sh, r);
    Object.assign(sh.uniforms, {uWet: WXU.wet, uSnow: WXU.snow, uWxT: WXU.time, uTop: WXU.top, uTopBox: WXU.topBox, uWxLd: WXU.ld, uReach: WXU.reach});
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWxN, vWxW, vWxL;')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvWxN = normalize((vec4(transformedNormal, 0.) * viewMatrix).xyz);')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        { vec4 lp = vec4(position, 1.);
        #ifdef USE_INSTANCING
          vWxW = (modelMatrix * instanceMatrix * vec4(transformed, 1.)).xyz; lp = instanceMatrix * lp;
        #else
          vWxW = (modelMatrix * vec4(transformed, 1.)).xyz;
        #endif
          vWxL = lp.xyz * length(modelMatrix[0].xyz); }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWxN, vWxW, vWxL; uniform float uWet, uSnow, uWxT, uReach; uniform vec2 uWxLd; uniform vec4 uTopBox; uniform sampler2D uTop; float wxMask = 0., wxDropH = 0., wxSnowC = 0., wxSnowH = 0., wxLip = 0.;' + WX_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wxE = (uWet + uSnow > .002) ? wxExpo(vWxW) : 0.;
        if (uWet * wxE > .002){
          vec3 an = abs(vWxN);
          vec2 dq = (an.y > max(an.x, an.z) ? vWxW.xz : an.x > an.z ? vWxW.zy : vWxW.xy) * 3.;
          float wE = uWet * wxE;                                                       /* 屋里离窗越远，雨点越稀 */
          vec2 dr = wxDrops(dq, wE, uWxT);
          float small = wxDrops(dq * 2.3 + 11., wE * .45, uWxT * 1.3).x * .6;
          float sheet = smoothstep(.6, .9, wxN(vWxW * 1.4) * .5 + wE * .42) * .6;
          float far = smoothstep(30., 120., length(vWxW - cameraPosition));           /* 远处（沙滩）看不清一粒粒，直接整片湿 */
          wxMask = mix(clamp(max(max(dr.x, small), sheet) + dr.y * .4, 0., 1.), .9, far) * smoothstep(0., .04, wE) * (.55 + .45 * smoothstep(-.2, .6, vWxN.y));
          wxDropH = max(dr.x, small) * (1. - far) * smoothstep(0., .04, wE);
          float lum = dot(diffuseColor.rgb, vec3(.3, .59, .11));
          diffuseColor.rgb *= 1. - wxMask * (.16 + .3 * lum) * vec3(1., 1.04, 1.14);
        }
        if (uSnow * wxE > .002){
          vec2 tuv = vec2(.5 + (vWxW.x - uTopBox.x) / uTopBox.z, .5 - (vWxW.z - uTopBox.y) / uTopBox.w);
          float inBox = step(0., tuv.x) * step(tuv.x, 1.) * step(0., tuv.y) * step(tuv.y, 1.);
          vec2 tx = vec2(1.5 / 512., 1.5 / 288.);
          float t0 = texture2D(uTop, tuv).r;
          float tMax = max(t0, max(max(texture2D(uTop, tuv + vec2(tx.x, 0.)).r, texture2D(uTop, tuv - vec2(tx.x, 0.)).r), max(texture2D(uTop, tuv + vec2(0., tx.y)).r, texture2D(uTop, tuv - vec2(0., tx.y)).r)));
          float topY = t0 * 10. - 1.5, topMax = tMax * 10. - 1.5, around = textureLod(uTop, tuv, 3.).r * 10. - 1.5;
          float open = 1. - inBox * smoothstep(.07, .18, topY - vWxW.y);
          float shelter = inBox * smoothstep(.0, .7, around - vWxW.y);
          float ny = vWxN.y * (gl_FrontFacing ? 1. : -1.);
          float up = smoothstep(.35, .85, ny);
          float stick = (.78 + .22 * roughness) * (1. - .15 * metalness);
          vec3 rp = vec3(dot(vWxL.xz, vec2(.8, .6)), vWxL.y * .5, dot(vWxL.xz, vec2(-.6, .8)));
          float drift = wxN(rp * .36 + 3.1) * .62 + wxN(rp * .95 + 8.3) * .38;
          float A = uSnow * stick * (1. - .65 * shelter) * (.55 + .6 * smoothstep(.25, .8, drift)) * wxE;   /* 屋里离窗越远积得越薄 */
          float far = smoothstep(30., 120., length(vWxW - cameraPosition));
          A = mix(A, uSnow * 1.1, far);                                                       /* 远处的沙滩：整片白 */
          vec3 wp = vec3(wxN(rp * 1.3), wxN(rp * 1.3 + 5.), wxN(rp * 1.3 + 9.)) * 1.2;
          float T = wxSnowT(rp, wp, A);
          float g = wxN(rp * 19.) * .55 + wxN(rp * 47. + 3.) * .45;
          float cov = max(smoothstep(0., .07, T + (g - .5) * .16), max(wxDots(rp.xz * 14., T), wxDots(rp.xz * 23. + 5.3, T - .2) * .85));
          cov = mix(cov, smoothstep(.1, .5, A), far);
          float ok = smoothstep(0., .06, wxE) * open * up;
          wxSnowC = ok * cov;
          wxSnowH = ok * max(T, 0.) * (1. - far);
          float side = 1. - smoothstep(.3, .65, abs(ny)), dTop = topMax - vWxW.y;
          wxLip = wxE * inBox * side * step(-.004, dTop) * (1. - smoothstep(.012, .03 + .025 * clamp(T, 0., 1.), dTop)) * smoothstep(.15, .45, T) * cov;
          vec3 rp2 = rp + vec3(dot(uWxLd, vec2(.8, .6)), 0., dot(uWxLd, vec2(-.6, .8))) * .075;
          float sh = ok * smoothstep(.03, .35, wxSnowT(rp2, wp, A) - max(T, 0.)) * (1. - far);
          vec3 snowCol = mix(vec3(.76, .81, .89), vec3(.9, .92, .95), smoothstep(.0, .7, T));
          float C = max(wxSnowC, wxLip);
          diffuseColor.rgb = mix(diffuseColor.rgb, snowCol, C);
          diffuseColor.rgb *= 1. - sh * (.3 - .16 * C);
        }`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix(metalnessFactor, 0., max(wxSnowC, wxLip));')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 1. - max(wxSnowC, wxLip);\n  totalEmissiveRadiance += vec3(1.) * wxSnowC * step(.993, wxH(floor(vWxL * 110.))) * .35;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (wxDropH > .001){ float Hd = wxDropH * .012; vec3 sp = -vViewPosition;   /* 雨点鼓起来一点：边上有一圈高光 */
    vec2 dHd = vec2(dFdx(Hd) / max(length(dFdx(sp)), 1e-5), dFdy(Hd) / max(length(dFdy(sp)), 1e-5));
    normal = wxBump(sp, normal, dHd, faceDirection); }
  if (wxSnowC + wxLip > .001){ float Hw = wxSnowH * .14; vec3 sp = -vViewPosition;
    vec2 dHw = vec2(dFdx(Hw) / max(length(dFdx(sp)), 1e-5), dFdy(Hw) / max(length(dFdy(sp)), 1e-5));
    vec3 upV = normalize((viewMatrix * vec4(0., 1., 0., 0.)).xyz);
    normal = wxBump(sp, normalize(mix(normal, upV, wxSnowC * .85 + wxLip * .45)), dHw * wxSnowC, faceDirection); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, .07, wxMask * .9);\n  roughnessFactor = mix(roughnessFactor, .75, max(wxSnowC, wxLip));');
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|wx';
  m.needsUpdate = true;
};
const wxSweep = () => scene.traverse(o => { if (o.isMesh && !o.isSprite && o.layers.mask & 1){ if (Array.isArray(o.material)) o.material.forEach(weatherify); else weatherify(o.material); } });
WL.twigM.userData.noWx = true; WL.leaves.material.userData.noWx = true; WL.cats.material.userData.noWx = true;   // 柳条在风里甩，不积不淋
setTimeout(wxSweep, 300); setInterval(wxSweep, 3000);   // 后来才加载进来的模型（电脑、书柜……）过一会儿也会被加上

/* ── 雨丝、雪花、溅起的水花 ── */
const RAIN_N = 1500, SNOW_N = 1600, SPL_N = 60;
const rainTex = tex(8, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const rainG = new THREE.PlaneGeometry(1, 1); rainG.translate(0, .5, 0);   // 头在下、尾巴往上
const rainM = new THREE.InstancedMesh(rainG, new THREE.MeshBasicMaterial({map: rainTex, color: '#d4dde2', transparent: true, opacity: 0, depthWrite: false, fog: false}), RAIN_N);
const flakeTex = tex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.45, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const snowM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map: flakeTex, transparent: true, opacity: 0, depthWrite: false}), SNOW_N);
const splTex = tex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.stroke(); });
const splM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: splTex, color: '#b9c6cc', transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending}), SPL_N);
for (let i = 0; i < SPL_N; i++) splM.setColorAt(i, new THREE.Color(0, 0, 0));   // 每个水圈自己的亮度：慢慢淡掉
for (const o of [rainM, snowM, splM]){ o.frustumCulled = false; o.layers.set(1); o.renderOrder = 6; o.count = 0; scene.add(o); }
const RD = Array.from({length: RAIN_N}, () => ({x: 0, y: -99, z: 0, sp: 1})), SD = Array.from({length: SNOW_N}, () => ({x: 0, y: -99, z: 0, sp: 1, ph: 0, sz: 1})), SPL = Array.from({length: SPL_N}, () => ({x: 0, y: 0, z: 0, age: 9}));
let splNext = 0;
const reachP = w => .45 + 2.6 * Math.pow(w, 1.3);   // 雨雪最远能飘进屋里多深（离窗的距离）：没风只湿到窗台外沿，风最大也就到流麻那儿
const wxSpawnZ = () => -5.2 - 31 * Math.pow(rnd(), 1.5);   // 离窗近的多一点：风一吹就能飘进来
const splash = (x, y, z) => { const p = SPL[splNext]; splNext = (splNext + 1) % SPL_N; p.x = x; p.y = y + .01; p.z = z; p.age = 0; };
/* 落到哪儿：窗外落到沙滩上；碰到墙就没了；从窗口进来的，落在窗台或者桌上 */
const wxLand = (x, y, z, pz) => {
  if (z < GLASS_Z) return y < GROUND_Y ? 1 : 0;
  if (pz < GLASS_Z && !(x > WIN.x0 && x < WIN.x1 && y > WIN.y0 && y < WIN.y1)) return 1;   // 撞墙
  if (z < WALL_Z + .45 && y < SILL_Y) return 2;
  if (z > WALL_Z + .45 && z < 4.4 && y < 0 && x > -5.4 && x < 12.2) return 3;
  if (y < -6 || z > 9) return 1;
  return 0;
};
const _c = new THREE.Color(), _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
/* ── 打雷：先亮一下（有时候连闪两下），远处海面上空劈下一道闪电，过一两秒才听到雷声 ── */
const boltM = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({color: '#eaf0ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide}));
boltM.layers.set(1); boltM.frustumCulled = false; boltM.renderOrder = -4; scene.add(boltM);
const makeBolt = () => {
  const P = [], x0 = -160 + rnd() * 360, z = -560 - rnd() * 120; let x = x0, y = 150;
  const seg = (ax, ay, bx, by, w) => { P.push(ax - w, ay, z, ax + w, ay, z, bx + w, by, z, ax - w, ay, z, bx + w, by, z, bx - w, by, z); };
  while (y > SEA_Y + 2){ const ny = y - 8 - rnd() * 14, nx = x + (rnd() - .5) * 18; seg(x, y, nx, ny, 1.1); if (rnd() < .22){ let bx = nx, by = ny; for (let k = 0; k < 3; k++){ const cx = bx + (rnd() - .4) * 14, cy = by - 6 - rnd() * 10; seg(bx, by, cx, cy, .6); bx = cx; by = cy; } } x = nx; y = ny; }
  boltM.geometry.dispose(); boltM.geometry = new THREE.BufferGeometry(); boltM.geometry.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
};
let AC = null;
addEventListener('pointerdown', () => { try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e){} }, {passive: true});   // 点过一下之后才会有声音
const rumble = k => {
  if (!AC) return; try {
    const t0 = AC.currentTime, len = 4, buf = AC.createBuffer(1, AC.sampleRate * len, AC.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < d.length; i++){ b = b * .985 + (Math.random() * 2 - 1) * .015; d[i] = b * 6; }
    const src = AC.createBufferSource(), lp = AC.createBiquadFilter(), g = AC.createGain(); src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 160;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.35 * k, t0 + .25); g.gain.exponentialRampToValueAtTime(.001, t0 + len);
    src.connect(lp); lp.connect(g); g.connect(AC.destination); src.start(t0);
  } catch (e){}
};
let boltT = 99, nextBolt = 6, flashEnv = 0, rumbleAt = -1;
const wxJump = () => {   // 截图自查用：直接跳到拉杆的样子（不慢慢跟）
  WX.windS = WXS.wind; WX.rainS = WXS.rain; WX.snowS = WXS.snow; WX.thunS = WXS.thunder;
  WXU.wet.value = WXS.rain > .02 ? .35 + .65 * WXS.rain : 0; WXU.snow.value = WXS.snow > .02 ? .3 + 1.05 * WXS.snow : 0;
  if (WXU.snow.value > .002){ renderTop(); topT = 5; }
  for (const d of RD) d.y = -99; for (const d of SD) d.y = -99;
};
let topT = 0;
const stepWeather = (dt, t) => {
  const a = 1 - Math.exp(-dt * .8);
  WX.windS += (WXS.wind - WX.windS) * a; WX.rainS += (WXS.rain - WX.rainS) * a; WX.snowS += (WXS.snow - WX.snowS) * a; WX.thunS += (WXS.thunder - WX.thunS) * a;
  WIND.uAmp.value = .04 + .5 * WX.windS; WIND.uLean.value = Math.pow(Math.max(0, WX.windS - .3) / .7, 1.3);
  WXU.reach.value = reachP(WX.windS) * 1.15 + .15;   // 淋湿、积雪的范围和飘进来的雨雪一致
  WXU.wet.value += ((WXS.rain > .02 ? .35 + .65 * WXS.rain : 0) - WXU.wet.value) * Math.min(1, dt * (WXS.rain > .02 ? .06 : WXS.snow > .02 ? .4 : .05));   // 半分钟淋透；雨停后慢慢干
  WXU.snow.value += ((WXS.snow > .02 ? .3 + 1.05 * WXS.snow : 0) - WXU.snow.value) * Math.min(1, dt * (WXS.snow > .02 ? .035 : WXS.rain > .02 ? .5 : .12));   // 积得慢；下雨冲得快
  WXU.time.value += dt; WXU.ld.value.set(cur.sunDir.x, cur.sunDir.z).normalize();
  if (WXU.snow.value > .002){ topT -= dt; if (topT <= 0){ topT = 5; renderTop(); } } else topT = 0;
  /* 天色：阴天压暗、发灰；下雪白一点；打雷那一下全亮 */
  const oc = Math.min(1, Math.max(Math.min(1, WX.rainS * 3) * .6 + WX.rainS * .4, Math.min(1, WX.snowS * 2.5) * .55 + WX.snowS * .35, WX.thunS * .8)), night = cur.dark;   // 一下雨下雪天就阴了
  const grey = new THREE.Color('#8d959b').lerp(new THREE.Color('#1a2030'), night), greyL = new THREE.Color('#b4b9bb').lerp(new THREE.Color('#262d3c'), night);
  const u = sky.material.uniforms; u.top.value.lerp(grey, oc * .75); u.mid.value.lerp(greyL, oc * .7); u.bot.value.lerp(greyL, oc * .6);
  sun.intensity *= 1 - .85 * oc; hemi.intensity *= 1 + .15 * WX.snowS; fill.intensity *= 1 - .3 * oc;
  scene.fog.color.lerp(greyL, oc * .7); scene.fog.near *= 1 - .55 * oc; scene.fog.far *= 1 - .5 * oc;
  SEA.uFog.value.copy(scene.fog.color); SEA.uFogN.value *= 1 - .5 * oc; SEA.uFogF.value *= 1 - .45 * oc; SEA.uLight.value *= 1 - .45 * oc; SEA.uSkyT.value.lerp(grey, oc * .7); SEA.uSkyM.value.lerp(greyL, oc * .7);
  CLOUDU.lit.value.lerp(new THREE.Color('#b9bec2').lerp(new THREE.Color('#2a2f3a'), night), oc * .8); CLOUDU.shd.value.lerp(new THREE.Color('#7d848b').lerp(new THREE.Color('#161a22'), night), oc * .8);
  CLOUDU.alpha.value = Math.min(1, CLOUDU.alpha.value + oc * .3); CLOUDU.cover.value = oc; SKYU.cover.value = oc; SEA.uMoonK.value *= 1 - .9 * oc;
  renderer.toneMappingExposure *= 1 - .08 * WX.rainS;
  SEA.uWind.value = WX.windS; SEA.uRain.value = WX.rainS;
  SEA.uSunCol.value.multiplyScalar(1 - .85 * oc); u.sunCol.value.multiplyScalar(1 - .9 * oc);   // 阴天没有太阳的碎光
  // 闪电
  if (WX.thunS > .05){ nextBolt -= dt * (.4 + WX.thunS * 1.2); if (nextBolt <= 0){ nextBolt = 4 + rnd() * 10; boltT = 0; makeBolt(); rumbleAt = t + .7 + rnd() * 1.8; } }
  boltT += dt;
  flashEnv = boltT < 1 ? Math.max(0, Math.exp(-boltT * 9) - .05) + (boltT > .16 ? Math.exp(-(boltT - .16) * 11) * .7 : 0) : 0;
  WX.flash = flashEnv * Math.min(1, WX.thunS * 1.5);
  if (WX.flash > .002){ const f = WX.flash; u.top.value.lerp(new THREE.Color('#dfe6ff'), f * .7); u.mid.value.lerp(new THREE.Color('#eef2ff'), f * .7); hemi.intensity += f * 1.6; winLight.intensity += f * 9; renderer.toneMappingExposure += f * .35; SEA.uSkyM.value.lerp(new THREE.Color('#e8eeff'), f * .6); }
  boltM.material.opacity = boltT < .32 ? Math.min(1, WX.thunS * 1.5) * (boltT < .1 || (boltT > .16 && boltT < .26) ? 1 : .35) : 0;
  if (rumbleAt > 0 && t > rumbleAt){ rumbleAt = -1; rumble(Math.min(1, WX.thunS * 1.3)); }
  // 雨丝
  const camP = camera.position, wdx = -.35, wind = WX.windS;
  const nR = Math.round(RAIN_N * Math.min(1, WX.rainS * 1.1));
  rainM.count = nR; rainM.material.opacity = (.32 + .2 * WX.rainS) * (1 - .5 * night);
  if (nR){
    const vx = wdx * 18 * wind, vz = 14 * wind, vy = -42; _y.set(vx, vy, vz).normalize();
    for (let i = 0; i < nR; i++){
      const d = RD[i];
      if (d.y < -50){ d.x = -16 + rnd() * 42; d.z = wxSpawnZ(); d.y = GROUND_Y + rnd() * 63; d.sp = .85 + rnd() * .3; }
      const pz = d.z; let hk = 1;
      if (d.z > GLASS_Z){ hk = Math.max(0, 1 - (d.z - GLASS_Z) / (reachP(wind) * (.45 + .55 * ((d.sp * 97.3) % 1)))); hk *= hk; }   // 进了屋，风就小了：越往里越飘不动，最后直直落下
      d.x += vx * d.sp * dt * hk; d.y += vy * d.sp * dt; d.z += vz * d.sp * dt * hk;
      const L = wxLand(d.x, d.y, d.z, pz);
      if (L){ if (L >= 2) splash(d.x, L === 2 ? SILL_Y : 0, d.z); d.x = -16 + rnd() * 42; d.z = wxSpawnZ(); d.y = 26 + rnd() * 6; }
      _p.set(d.x, d.y, d.z); _z.subVectors(camP, _p); const dist = _z.length(); _x.crossVectors(_y, _z).normalize(); _z.crossVectors(_x, _y);
      const w = Math.max(.012, dist * .0022), len = Math.min(2.4, .6 + dist * .02) * d.sp;
      _m.makeBasis(_x.multiplyScalar(w), _s.copy(_y).multiplyScalar(len), _z); _m.setPosition(_p); rainM.setMatrixAt(i, _m);
    }
    rainM.instanceMatrix.needsUpdate = true;
  }
  // 雪花
  const nS = Math.round(SNOW_N * Math.min(1, WX.snowS * 1.1));
  snowM.count = nS; snowM.material.opacity = .95 * (1 - .45 * night);
  if (nS){
    _q.copy(camera.quaternion);
    for (let i = 0; i < nS; i++){
      const d = SD[i];
      if (d.y < -50){ d.x = -16 + rnd() * 42; d.z = wxSpawnZ(); d.y = GROUND_Y + rnd() * 63; d.sp = .7 + rnd() * .6; d.ph = rnd() * 6.3; d.sz = .7 + rnd() * .6; }
      d.ph += dt; const pz = d.z;
      let hk = 1;
      if (d.z > GLASS_Z){ hk = Math.max(0, 1 - (d.z - GLASS_Z) / (reachP(wind) * (.45 + .55 * ((d.sp * 97.3) % 1)))); hk *= hk; }
      d.x += (wdx * 6 * wind * hk + Math.sin(d.ph * .9) * (.15 + .35 * hk)) * dt; d.y += -(2.6 + wind * 1.5) * d.sp * dt; d.z += (5 * wind + Math.cos(d.ph * .7) * .3) * hk * dt;
      if (wxLand(d.x, d.y, d.z, pz)){ d.x = -16 + rnd() * 42; d.z = wxSpawnZ(); d.y = 26 + rnd() * 6; }
      _p.set(d.x, d.y, d.z); const dist = _p.distanceTo(camP); _m.compose(_p, _q, _s.setScalar(Math.max(.06, dist * .0065) * d.sz)); snowM.setMatrixAt(i, _m);
    }
    snowM.instanceMatrix.needsUpdate = true;
  }
  // 溅起的小水圈
  let ns = 0;
  for (let i = 0; i < SPL_N; i++){ const p = SPL[i]; p.age += dt; const u = p.age / .6, on = u < 1;   // 一圈水纹：一下子张开、越张越慢，同时慢慢淡掉
    _m.compose(_p.set(p.x, p.y, p.z), _q.identity(), _s.setScalar(on ? .05 + .3 * Math.sqrt(u) : 0)); splM.setMatrixAt(i, _m); splM.setColorAt(i, _c.setScalar(on ? Math.pow(1 - u, 1.6) : 0)); if (on) ns = i + 1; }
  splM.count = ns; splM.instanceMatrix.needsUpdate = true; if (splM.instanceColor) splM.instanceColor.needsUpdate = true; splM.material.opacity = .5 * (1 - .5 * night);
};

