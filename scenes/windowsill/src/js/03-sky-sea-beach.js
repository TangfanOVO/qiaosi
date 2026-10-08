/* ── 窗外：天、云、海和沙滩（没有楼） ── */
/* 天：上下的渐变；太阳低的时候，海平线上朝着太阳那一边一大片暖光；夜里有星星（一闪一闪）和月亮——月亮的圆缺跟着真的日子走，月面上有深浅的“海” */
const SKYU = {top: {value: new THREE.Color()}, mid: {value: new THREE.Color()}, bot: {value: new THREE.Color()}, sunDir: {value: new THREE.Vector3(0, 1, 0)}, sunCol: {value: new THREE.Color()},
  glow: {value: new THREE.Color()}, moonDir: {value: new THREE.Vector3(-.04, .122, -.99).normalize()}, moonK: {value: 0}, starK: {value: 0}, phase: {value: Math.PI}, uT: {value: 0}, cover: {value: 0}};
const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: SKYU,
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform vec3 top, mid, bot, sunCol, sunDir, glow, moonDir; uniform float moonK, starK, phase, uT, cover; varying vec3 vD;
    float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hs(i), hs(i + vec2(1, 0)), f.x), mix(hs(i + vec2(0, 1)), hs(i + vec2(1, 1)), f.x), f.y); }
    void main(){ vec3 d = normalize(vD); float h = d.y;
      vec3 c = h > 0. ? mix(mid, top, pow(clamp(h * 1.6, 0., 1.), .7)) : mix(mid, bot, clamp(-h * 5., 0., 1.));
      vec3 sd = normalize(sunDir); float s = max(dot(d, sd), 0.);
      float az = max(dot(normalize(d.xz + 1e-5), normalize(sd.xz + 1e-5)), 0.);
      c += glow * (pow(az, 4.) * exp(-abs(h) * 6.) * .9 + pow(s, 6.) * .5);                       /* 太阳那一边的海平线暖起来 */
      c += sunCol * (pow(s, 1400.) * 7. + pow(s, 60.) * .5 + pow(s, 12.) * .12) * (1. - cover);   /* 日轮和它周围一圈光 */
      if (starK > .01 && h > .0){
        vec2 sp = vec2(atan(d.z, d.x) * 130., h * 130.), ci = floor(sp), cf = fract(sp) - .5; float r = hs(ci);
        if (r > .982){ vec2 o = vec2(hs(ci + 3.1), hs(ci + 7.7)) - .5; float b = .35 + .65 * pow(hs(ci + 1.3), 3.);
          float tw = .7 + .3 * sin(uT * (1.3 + 3. * hs(ci + 9.2)) + r * 60.);
          c += mix(vec3(1., .92, .8), vec3(.8, .88, 1.), hs(ci + 4.4)) * smoothstep(.16, .02, length(cf - o * .6)) * b * tw * starK * smoothstep(.0, .2, h) * (1. - cover); }
      }
      if (moonK > .01){
        vec3 md = normalize(moonDir); float mc = dot(d, md);
        c += vec3(.72, .78, .9) * (pow(max(mc, 0.), 900.) * .55 + pow(max(mc, 0.), 60.) * .14 + pow(max(mc, 0.), 8.) * .04) * moonK * (1. - .6 * cover);   /* 月晕 */
        float R = .02; vec3 rt = normalize(cross(md, vec3(0., 1., 0.))), up = cross(rt, md); vec2 uv = vec2(dot(d, rt), dot(d, up)) / R; float rr = length(uv);
        if (mc > 0. && rr < 1.){
          vec3 nm = vec3(uv, sqrt(1. - rr * rr)), ld = vec3(sin(phase), 0., -cos(phase));
          float lit = smoothstep(-.05, .08, dot(nm, ld));
          float mare = 1. - .22 * smoothstep(.45, .75, vn(uv * 2.1 + 3.)) - .1 * smoothstep(.5, .8, vn(uv * 5.3 + 7.));
          vec3 mcol = vec3(.97, .95, .87) * mare * (lit * 1.15 + .035);
          c = mix(c, mcol, smoothstep(1., .93, rr) * moonK * (1. - .85 * cover));
        }
      }
      gl_FragColor = vec4(c, 1.); }`
}));
sky.renderOrder = -10; scene.add(sky);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
scene.fog = new THREE.Fog('#dde6e6', 70, 430);
/* ── 窗外往下看：楼下一小块草坡，往外是起伏的沙丘、一片沙滩，再往外是海。
   海不建模，只用一个面在显卡里算：越深越蓝、浅的地方发青；浪一道一道往岸上推，到边上碎成白沫；太阳在海面上拉出一条碎光；
   远处一道岬角、一个小岛，都糊在海雾里。桌上看出去本来就在焦外，看得清看不清都像海 */
const SEA_Y = GROUND_Y - 1.2;
/* 沙滩的剖面（从楼下往海里）：低低起伏的沙丘、长着草 → 一道微微隆起的滩肩 → 缓缓的前滩（浪冲上来的地方）→ 到水里再陡下去。
   岸线只是很缓地弯一点，不再鼓包。JS 和显卡里用的是同一条剖面 */
const BERM = 72;
const shoreOff = x => 3 * Math.sin(x * .009 + .5) + 1.5 * Math.sin(x * .027 + 1.7);
const foreDrop = e => { if (e < 0) return 0; if (e < 4){ const q = e / 4; return .25 * q * q * (3 - 2 * q); } return e < 46 ? .25 + (e - 4) * .025 : 1.3 + (e - 46) * .065; };
const sandH = (x, z) => { const d = -z, e = d - BERM - shoreOff(x), dn = Math.min(1, Math.max(0, -e / 14));
  return GROUND_Y + dn * dn * (.32 + .26 * Math.sin(x * .05 + d * .11) * Math.sin(x * .023 - .7 + d * .05)) + .07 * Math.exp(-(e + 1) * (e + 1) / 3) - foreDrop(e); };
const WAVE_T = 7, WAVE_G = 6.38;   // 浪的周期（秒）；g × 水下坡度（浅水波速 = √(这个 × 离水边多远)）
const SANDU = {steps: {value: 1}};   // 脚印显不显（以后可以接“他出门了”）
const SAND_GLSL = `
    float shoreOff(float x){ return 3. * sin(x * .009 + .5) + 1.5 * sin(x * .027 + 1.7); }
    float foreDrop(float e){ return e < 0. ? 0. : e < 4. ? .25 * smoothstep(0., 4., e) : e < 46. ? .25 + (e - 4.) * .025 : 1.3 + (e - 46.) * .065; }
    float sandH(vec2 xz){ float d = -xz.y, x = xz.x, e = d - ${BERM.toFixed(1)} - shoreOff(x), dn = clamp(-e / 14., 0., 1.);
      return ${GROUND_Y.toFixed(2)} + dn * dn * (.32 + .26 * sin(x * .05 + d * .11) * sin(x * .023 - .7 + d * .05)) + .07 * exp(-(e + 1.) * (e + 1.) / 3.) - foreDrop(e); }`;
{
  const sr = mkRng(1717);
  const g = new THREE.PlaneGeometry(1400, 420, 200, 140); g.rotateX(-Math.PI / 2); g.translate(0, 0, -220);
  const p = g.attributes.position, col = [], c = new THREE.Color(), dry = new THREE.Color('#e0d4ba'), damp = new THREE.Color('#cbbc9d'), wet = new THREE.Color('#a39377'), grass = new THREE.Color('#a9a47a');
  for (let i = 0; i < p.count; i++){
    const x = p.getX(i), z = Math.min(-10, p.getZ(i)), y = sandH(x, z); p.setY(i, y); p.setZ(i, z);
    const above = y - SEA_Y, d = -z, e = d - BERM - shoreOff(x);
    c.copy(dry).multiplyScalar(.95 + sr() * .07 + Math.sin(x * .3 + z * .2) * .02);
    c.lerp(grass, Math.min(1, Math.max(0, (-e - 16) / 14)) * .7);                                        // 靠楼那边的沙丘上长着草
    c.lerp(damp, Math.min(1, Math.max(0, (e - 2) / 10)) * .8);                                            // 滩肩往下：潮气上来，颜色深一点
    c.lerp(wet, Math.min(1, Math.max(0, (.75 - above) / .6)));                                            // 浪冲得到的地方：湿沙
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  /* 沙子：细细的颗粒（亮的石英、深的碎屑），被风吹出的一道道浅沙纹，偶尔一点碎贝壳；沙纹再算成凹凸，太阳斜照时看得出起伏 */
  const S = 512, hc = document.createElement('canvas'); hc.width = hc.height = S; const hx = hc.getContext('2d');
  hx.fillStyle = 'rgb(128,128,128)'; hx.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 4){ const v = 128 + 26 * Math.sin((y + 9 * Math.sin(x * .021) + 5 * Math.sin(x * .053 + 1)) / S * Math.PI * 2 * 7); hx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`; hx.fillRect(x, y, 4, 2); }   // 风吹的沙纹（首尾接得上）
  for (let i = 0; i < 9000; i++){ const v = 100 + sr() * 70; hx.fillStyle = `rgba(${v | 0},${v | 0},${v | 0},.5)`; hx.fillRect(sr() * S, sr() * S, 1, 1); }
  const hd = hx.getImageData(0, 0, S, S).data, nc = document.createElement('canvas'); nc.width = nc.height = S; const nx = nc.getContext('2d'), out = nx.createImageData(S, S), H = (i, j) => hd[(((j + S) % S) * S + ((i + S) % S)) * 4] / 255;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++){ const dx = (H(i + 1, j) - H(i - 1, j)) * 2.2, dy = (H(i, j + 1) - H(i, j - 1)) * 2.2, l = Math.hypot(dx, dy, 1), q = (j * S + i) * 4; out.data[q] = (-dx / l * .5 + .5) * 255; out.data[q + 1] = (dy / l * .5 + .5) * 255; out.data[q + 2] = (1 / l * .5 + .5) * 255; out.data[q + 3] = 255; }
  nx.putImageData(out, 0, 0); const sandN = new THREE.CanvasTexture(nc); sandN.wrapS = sandN.wrapT = THREE.RepeatWrapping; sandN.repeat.set(140, 42); sandN.anisotropy = ANISO;
  const sandT = tex(512, 512, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++){ const r = sr(); x.fillStyle = r < .55 ? `rgba(150,128,96,${.12 + sr() * .2})` : r < .85 ? `rgba(255,252,240,${.3 + sr() * .4})` : r < .97 ? `rgba(90,74,58,${.25 + sr() * .3})` : `rgba(240,226,214,${.6 + sr() * .3})`; x.fillRect(sr() * w, sr() * h, 1 + sr() * 1.4, 1 + sr() * 1.4); }
    for (let i = 0; i < 7; i++){ x.save(); x.translate(sr() * w, sr() * h); x.rotate(sr() * 6.3); x.fillStyle = 'rgba(246,238,228,.85)'; x.beginPath(); x.ellipse(0, 0, 3 + sr() * 3, 2 + sr() * 2, 0, 0, 7); x.fill(); x.restore(); }   // 碎贝壳
  }, {rep: [140, 42]});
  const sm = new THREE.MeshStandardMaterial({vertexColors: true, map: sandT, normalMap: sandN, normalScale: new THREE.Vector2(.55, .55), roughness: .96, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2});
  /* 沙滩上画的东西：
     · 最高潮线上一道被浪推上来的东西——一簇簇深褐、橄榄色的海草，夹着几点白的碎贝壳，断断续续；
     · 一串从楼下走向海边的脚印（一左一右，脚跟深、脚尖浅，边上被踩起的沙亮一点），走到浪冲得到的地方就被抹平了 */
  sm.onBeforeCompile = sh => {
    sh.uniforms.uSteps = SANDU.steps;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vSW; uniform float uSteps; float sdH = 0.;
      float sh1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float sn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(sh1(i), sh1(i + vec2(1, 0)), f.x), mix(sh1(i + vec2(0, 1)), sh1(i + vec2(1, 1)), f.x), f.y); }
      ${SAND_GLSL}
      float footX(float d){ return 3. + 5. * sin(d * .045 + .4); }
      float foot(vec2 q){ vec2 a = (q - vec2(0., -.72)) / vec2(.4, .52), b = (q - vec2(.05, .42)) / vec2(.48, .74);
        return max(smoothstep(1., .55, length(a)), smoothstep(1., .5, length(b)) * .75); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { float x = vSW.x, d = -vSW.z, e = d - ${BERM.toFixed(1)} - shoreOff(x);
        // 潮线
        float ew = 8. + 3.4 * (sn(vec2(x * .06, 1.7)) - .5) + 1.4 * (sn(vec2(x * .3, 4.1)) - .5);
        float band = smoothstep(1.1, .2, abs(e - ew)) * smoothstep(.45, .7, sn(vec2(x * .42, e * .9))) * smoothstep(.3, .55, sn(vec2(x * .045, 9.3)));   // 一簇一簇的，中间有大段的空
        vec3 weed = mix(vec3(.27, .21, .14), vec3(.25, .28, .17), sn(vec2(x * .8, e * 1.3)));
        diffuseColor.rgb = mix(diffuseColor.rgb, weed, band * .85);
        float shell = step(.9, sh1(floor(vec2(x, d) * 3.))) * smoothstep(2., .3, abs(e - ew));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93, .9, .84), shell * .8);
        // 脚印
        if (uSteps > .01 && d > 55. && e < 16.){
          float k = floor((d - 55.) / 3.4), m = 0.;
          { float dk = 55. + (k + .5) * 3.4, sd = mod(k, 2.) * 2. - 1.; m = foot(vec2(x - footX(dk) - sd * .85, d - dk)); }   // 一步一格：左右脚交替
          float keep = smoothstep(15., 9., e) * uSteps;
          sdH = -m * keep;
          diffuseColor.rgb *= 1. - m * keep * (e > 4. ? .2 : .1);
        }
      }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      if (sdH < -.001){ float Hs = sdH * .25; vec3 sp = -vViewPosition;
        vec2 dHs = vec2(dFdx(Hs) / max(length(dFdx(sp)), 1e-5), dFdy(Hs) / max(length(dFdy(sp)), 1e-5));
        vec3 sx = normalize(dFdx(sp)), sy = normalize(dFdy(sp)), r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1) * faceDirection;
        normal = normalize(abs(det) * normal - sign(det) * (dHs.x * r1 + dHs.y * r2)); }`);
  };
  sm.customProgramCacheKey = () => 'sand2';
  const m = new THREE.Mesh(g, sm);
  m.receiveShadow = true; scene.add(m);
}
const SEA = {uT: {value: 0}, uSun: {value: new THREE.Vector3(0, 1, 0)}, uSunCol: {value: new THREE.Color()}, uSkyT: {value: new THREE.Color()}, uSkyM: {value: new THREE.Color()},
  uFog: {value: new THREE.Color()}, uFogN: {value: 100}, uFogF: {value: 500}, uLight: {value: 1},
  uShal: {value: new THREE.Color('#9cc2b4')}, uMid: {value: new THREE.Color('#4f8890')}, uDeep: {value: new THREE.Color('#2d5870')}, uFoam: {value: new THREE.Color('#f3f4ef')}, uWind: {value: .25}, uRain: {value: 0}, uMoon: SKYU.moonDir, uMoonCol: {value: new THREE.Color('#d6dcea')}, uMoonK: {value: 0}};
const sea = new THREE.Mesh(new THREE.PlaneGeometry(24000, 16000, 1, 1).rotateX(-Math.PI / 2).translate(0, SEA_Y + .74, -8060), new THREE.ShaderMaterial({uniforms: SEA, fog: false, transparent: true, depthWrite: false,   // 水面比平均海面高一点：浪冲上沙滩的那段才画得出来
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uT, uFogN, uFogF, uLight, uWind, uRain, uMoonK; uniform vec3 uSun, uSunCol, uSkyT, uSkyM, uFog, uShal, uMid, uDeep, uFoam, uMoon, uMoonCol; varying vec3 vW;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    ${SAND_GLSL}
    float hh(float k){ return fract(sin(k * 91.7 + 3.1) * 43758.5453); }
    float tauX(float x){ return 2. * sqrt(max(x, 0.) / ${WAVE_G.toFixed(2)}); }   /* 从离水边 x 远的地方走到水边要几秒（浅水波） */
    float tauS(float x){ float sx = 3. * log(1. + exp(clamp(x, -60., 60.) / 3.)); return tauX(sx + 1.) - tauX(1.); }   /* 同上，但在水边附近是圆滑过渡的（不会在岸线上折出一道硬边） */
    float waveH(float k, float x){ return clamp((.68 + .32 * sin(k * .9)) * (.55 + .45 * hh(k * 1.7)) * (.35 + .6 * n(vec2(x * .028 + k * 3.7, k * .37)) + .3 * n(vec2(x * .09 + k, 2.1))), 0., 1.2); }   /* 第 k 道浪在这一段有多高：一组一组的，沿岸一段高一段低 */
    float breakD(float k, float x){ return 10. + 26. * waveH(k, x); }   /* 浪越高，碎得离岸越远 */
    void over(inout vec4 acc, vec3 c, float a){ acc.rgb = mix(acc.rgb, c, a); acc.a = acc.a + a * (1. - acc.a); }
    void main(){
      vec2 xz = vW.xz; float t = uT;
      float sh = sandH(xz), y0 = ${SEA_Y.toFixed(2)}, d0 = (y0 - sh) / .065;   // d0：离“平均水边”的水平距离（海里为正、岸上为负）
      vec3 V = normalize(cameraPosition - vW);
      float camD = length(vW - cameraPosition), L = .1 + .9 * uLight;
      float nA = n(xz * .9 + vec2(0., t * .3)), nB = n(xz * 2.6 - vec2(t * .2, 0.)), nC = n(xz * .25 + vec2(3.7, 1.1));
      vec4 acc = vec4(0.);
      vec3 sky = mix(uSkyM, uSkyT, .35), foamC = uFoam * (.2 + .8 * uLight);
      /* ── 海：平均水边以外的水。近岸发青、往外越来越深越蓝；越往海平线越反天光、发白。
         浪：七秒一道，从外海一道道来。浅水里浪走得慢（波速 = √(g·水深)），所以越近岸越慢、一道道挤得越近；
         每道浪高低不一（一组一组来，沿着岸也是一段高一段低）。浪面朝岸的一面陡、发暗，快碎的时候浪尖透出一点青绿；
         浪高到水深的八成就碎——先从最高的那一段碎起，往两边撕开；碎了以后是一道翻滚的白浪往岸上推，后面拖着散开的白沫，越往前越弱，
         推到水边正好接上冲上沙滩的那一层水。太阳、月亮在海面上只拉出朝着它们的那一条碎光 ── */
      if (d0 > 0.){
        float dist = d0, depth = dist * .065, far = smoothstep(80., 700., camD);
        float n1 = n(xz * .12 + vec2(0., t * .05)), n2 = n(xz * .55 + vec2(0., t * .16)), n3 = n(xz * 1.7 + vec2(0., t * .35));
        vec3 wc = mix(uShal, uMid, smoothstep(.05, 2.4, depth)); wc = mix(wc, uDeep, smoothstep(2.4, 14., depth));
        wc *= .92 + .16 * n1;
        float arc = 7. * sin(xz.x * .023 + .3) + 3.5 * sin(xz.x * .061 + 1.2);                     /* 浪线不是直的：中间鼓、两边落后，一道一道还各不一样 */
        float s0 = (t + tauS(dist + arc)) / ${WAVE_T.toFixed(1)}, c0 = floor(s0 + .5);
        float arcK = 5. * sin(xz.x * .041 + c0 * 2.3) + 2.5 * sin(xz.x * .11 + c0 * 1.1);
        float s = (t + tauS(dist + arc + arcK)) / ${WAVE_T.toFixed(1)}, cw = floor(s + .5), pw = s - cw;   // 离最近那道浪差几分之一个周期：负的在浪前面（靠岸），正的在浪后面
        float Lw = ${WAVE_T.toFixed(1)} * sqrt(${WAVE_G.toFixed(2)} * max(dist, 1.)), ps = pw * Lw;   // 这里的波长；离浪峰多远
        float H = waveH(cw, xz.x), db = breakD(cw, xz.x);
        float broken = smoothstep(db + 1.5, db - 1.5, dist);
        float steep = smoothstep(db * 2.8, db, dist) * (1. - broken);
        float faceW = Lw * mix(.1, .045, steep) * (.6 + .4 * H);
        float face = smoothstep(-faceW, -faceW * .2, ps) * smoothstep(.5, -.3, ps) * (1. - broken) * (.25 + .75 * H) * (1. - .85 * far);
        float back = smoothstep(.0, faceW * .5, ps) * smoothstep(Lw * .42, faceW, ps) * (1. - broken * .6) * H * (1. - .7 * far);
        vec2 q = xz * vec2(1., 1.6);
        vec2 gr = vec2(n(q * .32 + vec2(0., t * .22)) - n(q * .32 + vec2(1.7, -t * .1)), n(q * .29 + vec2(5.2, t * .19)) - n(q * .27 + vec2(3.1, t * .25)));
        gr += .5 * vec2(n(q * 1.1 + vec2(t * .4, 2.)) - .5, n(q * 1.05 - vec2(1., t * .37)) - .5);
        gr *= (.16 + 1.05 * uWind) * (1. - .65 * far);
        if (uRain > .01) gr += (vec2(n(xz * 7.3 + t * 3.1), n(xz * 6.9 - t * 2.7)) - .5) * uRain * smoothstep(260., 40., camD) * .9;
        vec3 N = normalize(vec3(gr.x * .3, 1., gr.y * .3 + (face * (.35 + .5 * steep) - back * .12) * (1. - far)));
        float fres = .02 + .98 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N); R.y = abs(R.y);
        vec3 skyR = mix(uSkyM, uSkyT, pow(clamp(R.y * 1.6, 0., 1.), .7));
        vec3 col = mix(wc * L * (1. - .22 * face), skyR, clamp(fres + .1 * back, .05, .95));
        float lip = smoothstep(-faceW * .45, -faceW * .05, ps) * smoothstep(.3, -.2, ps) * steep * steep;
        col += vec3(.18, .42, .36) * lip * (.25 + .75 * uLight) * .55;                                   /* 快碎的浪尖：薄薄一层水透着光 */
        float shin = mix(1100., 110., far), gk = mix(10., 2.4, far);
        col += uSunCol * (pow(max(dot(R, normalize(uSun)), 0.), shin) * gk * smoothstep(.3, .65, n3 + .2 * far) + pow(max(dot(R, normalize(uSun)), 0.), 10.) * .07) * smoothstep(-.03, .04, uSun.y);
        col += uMoonCol * pow(max(dot(R, normalize(uMoon)), 0.), shin * .7) * gk * .6 * smoothstep(.3, .65, n3 + .15 * far) * uMoonK;
        /* 碎浪 */
        float age = clamp((db - dist) / max(db, 1.), 0., 1.), bore = broken * (1. - .6 * age);
        float edge = (n(vec2(xz.x * .12, cw * 7.1)) - .5) * 5. + (n(vec2(xz.x * .5, t * .9 + cw)) - .5) * 1.8;   /* 白浪的前沿参差不齐 */
        float pe = ps + edge;
        float front = smoothstep(-1.4, -.1, pe) * smoothstep(1.6 + 3.5 * bore, .2, pe);
        vec2 fq = vec2(xz.x, ps);
        float lace = smoothstep(.4, .78, n(fq * vec2(.45, .3) + vec2(cw * 3.3, 0.)) * .6 + n(fq * vec2(1.5, 1.) + vec2(t * .12, cw)) * .4);
        float trail = smoothstep(.8, 4., ps) * smoothstep(Lw * .45 * (.35 + .65 * bore), 3., ps) * lace;
        float spray = smoothstep(db + .5, db - 3., dist) * smoothstep(db - 9., db - 3., dist) * smoothstep(-2.5, 0., pe) * smoothstep(5., .5, pe);   /* 刚碎那一下：白得最厚 */
        float white = clamp(max(front * (.7 + .3 * bore), spray) + trail * .75 * (.45 + .55 * bore), 0., 1.) * broken;
        white += smoothstep(.62, .82, n(xz * vec2(.22, .45) + vec2(0., t * .05))) * .28 * smoothstep(db + 6., db * .4, dist);   /* 碎浪区里漂着的一片片旧沫 */
        float whitecap = smoothstep(.0, .025, fract(s * 3.)) * smoothstep(.09 + .12 * uWind, .025, fract(s * 3.)) * smoothstep(.78 - .42 * uWind, .96 - .3 * uWind, n2 * .6 + n3 * .4) * (.35 + .9 * uWind) * smoothstep(40., 140., dist) * smoothstep(.3, .75, uWind);
        whitecap += smoothstep(.55, 1., uWind) * smoothstep(.7, .85, n(xz * .09 + vec2(t * .4, 0.)) * .5 + n2 * .5) * smoothstep(60., 160., dist) * .5;
        float shore = smoothstep(3., 0., dist) * .35;
        col = mix(col, foamC * (.9 + .1 * lace), clamp(white + whitecap + shore * nB, 0., 1.));
        over(acc, col, smoothstep(0., 1.2, dist) * .55 + .45);
      }
      /* ── 一层一层冲上沙滩的浪：每七秒来一道，一道没退完下一道已经盖上来；
         每道冲上来的形状是一道往岸上鼓的弧（中间冲得远、两边近），冲到最高处停一下，再顺着来路慢慢退回去。
         退过的地方：沙子湿成深色、亮亮地反着天光，最高处留下一道细细的白沫线（水痕），慢慢干掉 ── */
      float T = ${WAVE_T.toFixed(1)};
      float kNow = floor(t / T);
      for (int j = 2; j >= 0; j--){
        float k = kNow - float(j), age = t - k * T - tauS(7. * sin(xz.x * .023 + .3) + 3.5 * sin(xz.x * .061 + 1.2) + 5. * sin(xz.x * .041 + k * 2.3) + 2.5 * sin(xz.x * .11 + k * 1.1));   /* 白浪推到这一段水边的那一刻，才开始往沙滩上冲 */
        float peak = .12 + .55 * waveH(k, xz.x), tUp = 2.1, tDown = 2.2 * T - tUp;   /* 哪一段浪高，哪一段就冲得远 */
        float lvl = age < tUp ? peak * (1. - pow(1. - age / tUp, 2.2)) : peak * pow(max(0., 1. - (age - tUp) / tDown), 1.35);
        float th = y0 + lvl - sh, de = th / .025;           // 薄水的厚度、离前沿多远（前滩坡度 .025）
        float reach = y0 + peak - sh;                        // 这道浪冲到的最高处
        float dry = clamp((age - tUp) / (2.6 * T), 0., 1.);
        if (age > tUp && reach > 0. && th < 0.){             // 已经退下去的湿沙
          float wetA = (1. - dry) * .62 * smoothstep(0., .015, reach);
          over(acc, mix(vec3(.3, .25, .18) * L, sky, .2), wetA);   // 湿沙：深一截，带一点天光
        }
        float mark = smoothstep(.012, .0, abs(reach - .003)) * step(tUp, age) * (1. - dry) * smoothstep(.3, .62, n(vec2(xz.x * .12, k * 3.7)) * .7 + nB * .3);   // 水痕：最高处一道细细的白沫线，一长段一长段的
        over(acc, foamC * .9, mark * .55);
        float onBeach = smoothstep(y0 - .2, y0 + .02, sh);   // 薄水只铺在沙滩上；海里本来就是水
        /* 沫：涌上来时是厚厚一道翻滚的白边，到最高处慢慢变成一条细线、跟着水往海里拖回去；
           水退过的地方，沫留在沙上一会儿，一个个泡破掉、慢慢淡没——不是被水边一刀切掉；一道浪的沫十来秒里就淡完，等不到下一道把它换掉 */
        float rec = smoothstep(tUp - .3, tUp + 1.1, age), life = 1. - smoothstep(.15, .72, age / (2.2 * T));
        if (onBeach > 0. && life > 0. && (th > 0. || (rec > .3 && reach > 0. && th > -.08))){
          vec2 fl = xz - vec2(0., (lvl / .065) * 1.);      // 沫跟着水前后走：涌上来时往岸上推，退的时候顺着原路往海里拖
          float lace = smoothstep(.45, .8, n(fl * 1.3) * .6 + n(fl * 3.7 + vec2(0., age)) * .4);
          float streak = smoothstep(.55, .85, n(vec2(fl.x * 2.2, fl.y * .5)));   // 退水时被拉长的一条条沫
          float shoreK = smoothstep(y0 - .5, y0, sh);
          if (th > 0.){
            float front = smoothstep(0., .3, de) * smoothstep(mix(3.2, 1.1, rec), .3, de) * (.7 + .3 * n(vec2(xz.x * .6, age))) * (1. - .5 * rec);
            float body = mix(lace * smoothstep(10., 1., de) * .7, (lace * .4 + streak * .15) * smoothstep(8., 0., de), rec);
            float sheetA = smoothstep(0., .04, th) * mix(.78, .6, rec) * (1. - smoothstep(.65, 1., age / (2.2 * T)));
            vec3 water = mix(mix(uShal, uMid, .25) * L * .85, sky, .3 + .3 * pow(1. - max(V.y, 0.), 3.));   // 薄薄一层水：底下透出沙子的颜色被冲淡，反着天光
            over(acc, water, sheetA * onBeach);
            over(acc, foamC, clamp(front + body, 0., 1.) * life * mix(.95, .75, rec) * shoreK);
          } else {
            float left = smoothstep(.08, 0., -th);           // 水刚退走：沫还在，水退得越远（越久）越淡
            float pop = smoothstep(.5, .8, n(xz * 4.1 + vec2(age * .7, 0.)));   // 一个个泡破掉：斑斑点点地没
            over(acc, foamC, lace * left * (.35 + .65 * pop * left) * .6 * life * shoreK);
          }
        }
      }
      if (acc.a < .004) discard;
      vec3 rgb = acc.rgb / acc.a;   // 上面一层层叠的是“乘过透明度”的颜色，这里换回来
      rgb = mix(rgb, uFog, smoothstep(uFogN, uFogF, camD));
      gl_FragColor = vec4(rgb, acc.a);
    }`}));
sea.renderOrder = -5; scene.add(sea);
const headM = new THREE.MeshBasicMaterial({color: '#8b9aa0', fog: false});   // 原来远处岬角和小岛用的颜色（岛已经去掉了，颜色还跟着雾在算，留着不碍事）
/* 云：积云是一团团鼓起来的——顶上被太阳照亮、底下平平的、背光发灰（贴图里一格存“厚不厚”，一格存“照没照到”）；
   离海平线近的几朵小、糊在雾里，高处一两朵大的；最高处一层很淡的卷云丝。颜色跟着天色（白天白、傍晚粉金、夜里被月亮照着一点边），飘的快慢跟风 */
const clouds = [];
const CLOUDU = {lit: {value: new THREE.Color('#ffffff')}, shd: {value: new THREE.Color('#a7b2c0')}, alpha: {value: .95}, cover: {value: 0}, fog: {value: new THREE.Color('#c9d1cf')}};
{
  const cr = mkRng(4040), R = (a, b) => a + cr() * (b - a);
  const cumulus = (W, H, n, seed) => {
    const r = mkRng(seed), P = [];
    const base = H * .72;
    for (let i = 0; i < n; i++){ const u = (i + .5) / n, cx = W * (.12 + .76 * u) + (r() - .5) * W * .08, hump = Math.sin(Math.PI * u), rad = H * (.12 + .2 * hump * (.6 + .4 * r())); P.push([cx, base - rad * (.45 + .5 * r()) - hump * H * .12 * r(), rad]); }
    for (let i = 0; i < n * .6; i++){ const cx = W * (.2 + .6 * r()), rad = H * (.06 + .08 * r()); P.push([cx, base - H * (.1 + .35 * r() * Math.sin(Math.PI * cx / W)), rad]); }   // 顶上再鼓出来的小包
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), im = x.createImageData(W, H), o = im.data;
    const D = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let i = 0; i < W; i++){ let d = 0; for (const [cx, cy, rr] of P){ const dx = i - cx, dy = y - cy; d += Math.exp(-(dx * dx + dy * dy) / (2 * rr * rr * .45)); }
      D[y * W + i] = d * Math.min(1, Math.max(0, (base + 4 - y) / 10)); }   // 底是平的
    for (let i = 0; i < W; i++){ let acc = 0; for (let y = 0; y < H; y++){ const d = D[y * W + i], q = (y * W + i) * 4; acc += d * .015; const lit = .2 + .8 * Math.exp(-acc * 1.1);
      o[q] = o[q + 1] = o[q + 2] = lit * 255; o[q + 3] = Math.min(1, Math.max(0, (d - .18) / .5)) * 255; } }
    x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
  };
  const cirrus = (() => { const c = document.createElement('canvas'), W = 512, H = 128; c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,0)'; x.fillRect(0, 0, W, H); x.lineCap = 'round';
    for (let i = 0; i < 70; i++){ const y = H * (.3 + .4 * cr()), x0 = cr() * W * .8, L = 60 + cr() * 220; x.strokeStyle = `rgba(255,255,255,${.06 + cr() * .12})`; x.lineWidth = 1 + cr() * 4; x.beginPath(); x.moveTo(x0, y); x.quadraticCurveTo(x0 + L * .5, y - 6 - cr() * 10, x0 + L, y + (cr() - .5) * 8); x.stroke(); }
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.15, 'rgba(0,0,0,0)'); g.addColorStop(.85, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(0, 0, W, H);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; })();
  const texs = [cumulus(384, 192, 7, 11), cumulus(384, 160, 9, 23), cumulus(320, 160, 5, 37)];
  const cloudMat = (map, haze, flat) => new THREE.ShaderMaterial({transparent: true, depthWrite: false, fog: false,
    uniforms: {map: {value: map}, lit: CLOUDU.lit, shd: CLOUDU.shd, alpha: CLOUDU.alpha, cover: CLOUDU.cover, fogC: CLOUDU.fog, haze: {value: haze}, uFlat: {value: flat}},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: `uniform sampler2D map; uniform vec3 lit, shd, fogC; uniform float alpha, cover, haze, uFlat; varying vec2 vUv;
      void main(){ vec4 t = texture2D(map, vUv); float l = mix(t.r, 1., uFlat);
        vec3 c = mix(shd, lit, l); c = mix(c, mix(shd, lit, .5), cover * .6); c = mix(c, fogC, haze);
        gl_FragColor = vec4(c, clamp(t.a * alpha * (1. + cover * .6), 0., 1.)); }`});
  // [宽, x, 高度, z, 第几张, 糊进雾里多少]
  const C = [[190, 74, 127, -700, 0, .12], [120, -111, 65, -700, 1, .22], [60, -41, 40, -780, 2, .42], [75, 134, 50, -760, 2, .38],   // 抬头看出去那一块天里的四朵（中间留给月亮）
             [240, -330, 120, -680, 1, .2], [230, 380, 110, -700, 0, .22], [200, -560, 90, -640, 2, .25]];
  for (const [w, x, y, z, k, hz] of C){
    const t = texs[k], m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * t.image.height / t.image.width), cloudMat(t, hz, 0));
    m.position.set(x, y, z); m.lookAt(0, y * .6, 0); m.renderOrder = -9; m.layers.set(1); scene.add(m); clouds.push(m);
  }
  for (const [w, x, y, z] of [[900, -100, 150, -720], [700, 380, 160, -700]]){ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), cloudMat(cirrus, .15, 1)); m.material.uniforms.alpha = {value: .7}; m.position.set(x, y, z); m.lookAt(0, y * .5, 0); m.renderOrder = -9.5; m.layers.set(1); scene.add(m); clouds.push(m); }
}

rnd = mkRng(9001);   // 窗外的东西用自己的一串随机数
const segs = [], tips = [];
const perp = d => { const a = Math.abs(d.y) < .9 ? UP : new THREE.Vector3(1, 0, 0); return new THREE.Vector3().crossVectors(d, a).normalize().applyAxisAngle(d, rnd() * Math.PI * 2); };
/* 风：枝头越高越远晃得越多；影子跟着一起晃（桌上的光斑会动） */
const WX = {windS: .25, rainS: 0, snowS: 0, thunS: 0, flash: 0};   // 天气跟过去的值（下面“天气”那一节在每一帧更新）
const WIND = {uT: {value: 0}, uAmp: {value: .16}, uLean: {value: 0}};   // uLean：大风时柳条被一直往一边压着
const gustAt = (x, h = 0) => { const tt = WIND.uT.value - x * .035 - h * .045; return Math.sin(tt * .9) * .62 + Math.sin(tt * 1.53 + 1.1) * .28 + Math.sin(tt * 2.9 + .4) * .1; };   // 和柳条用同一阵风：纱帘、风铃、落叶都跟着它
const windify = m => {
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = WIND.uT; sh.uniforms.uAmp = WIND.uAmp;
    sh.vertexShader = 'uniform float uT, uAmp;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vec4 wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
      #endif
      wp = modelMatrix * wp;
      float hh = clamp((wp.y + 20.0) / 55.0, 0.0, 1.0);
      float dd = min(length(wp.xz - vec2(-4.4, -30.0)), length(wp.xz - vec2(14.2, -31.5))) / 22.0;
      float amp = uAmp * hh * hh * (0.25 + dd);
      wp.x += amp * (sin(uT * 1.1 + wp.x * .13 + wp.z * .09) + .35 * sin(uT * 2.7 + wp.y * .4));
      wp.z += amp * .45 * sin(uT * .8 + wp.x * .17 + 1.3);
      wp.y += amp * .2 * sin(uT * 1.9 + wp.z * .3);
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => 'wind';
  return m;
};
const windDepth = () => windify(new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking}));
