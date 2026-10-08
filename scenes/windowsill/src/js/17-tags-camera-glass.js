/* ── 每样东西：对应什么功能、标注挂在哪、点它时镜头怎么拍 ──
   shot：相对这样东西的位置，d = 机位偏移，t = 看的点（偏移），fov；窗外的东西从窗边拉长焦 */
const TAGS = [
  {key: 'music', obj: laptop, at: V(0, 2.4, -1.4), fn: '一起听', name: '电脑上在放歌', lab: 'NOW PLAYING', note: '屏幕上是正在一起听的那首，进度条走到哪就是听到哪。', go: '一起听', shot: {d: V(.9, 3.6, 6.4), t: V(0, 1.0, -.6), fov: 34}},
  {key: 'phone', obj: phone, at: V(0, .4, 0), fn: '对话', name: '扣在本子上的手机', lab: 'CHAT', note: '扣着的时候是安静的；点开它翻过来，屏幕上是最近的聊天。有新消息时它会亮一下、轻轻震一下。', go: '去聊天', shot: {d: V(.62, 5.6, 2.45), t: V(.13, 0, .5), fov: 44, raw: true}},
  {key: 'notes', obj: notes, at: V(-2.6, 10.75, WALL_Z + .3), fn: '碎碎念', name: '夹在挂板上的便签', lab: 'NOTES', note: '最近的三条碎碎念，一条一张便签，新的钉在最上面。', go: '都看看', shot: {d: V(-2.45, 9.35, 8.4), t: V(-2.55, 9.08, 0), fov: 40, abs: true}},
  {key: 'cal', obj: cal, at: V(0, 1.0, 0), fn: '在一起', name: '挂历', lab: 'TOGETHER', note: '在一起的天数，下面几行写今天的日程。', go: '看日历', shot: {d: V(.5, -.4, 5.6), t: V(0, 0, 0), fov: 30}},
  {key: 'jar', obj: jar, at: V(0, 1.5, 0), fn: '梗库', name: '纸星星罐', lab: 'INSIDE JOKES', note: '每存一个梗就多折一颗星星，罐子越来越满。', go: '翻梗库', shot: {d: V(2.0, 1.8, 5.0), t: V(0, .55, 0), fov: 30}},
  {key: 'candle', obj: candle, at: V(0, 1.5, 0), fn: '晚安', name: '书上的蜡烛', lab: 'GOODNIGHT', note: '睡前点一下吹灭它，就是说了晚安；再点一下重新点上。白天它也一直点着，夜里屋里就只剩这一点火。', go: '吹灭 / 点上', shot: {d: V(2.4, 2.0, 5.4), t: V(0, .7, 0), fov: 30}},
  {key: 'book', obj: book, at: V(0, .5, -.4), fn: '共读', name: '摊开的书', lab: 'READING', note: '他读到哪一页，书就摊在哪一页；铅笔划过的句子，是他留的批注。', go: '接着读', shot: {d: V(.45, 4.25, 3.1), t: V(0, 0, .15), fov: 34}},
  {key: 'mug', obj: mug, at: V(0, 1.1, 0), fn: '健康', name: '一杯茶', lab: 'HEALTH', note: '睡眠、步数、心率接在这里。茶还冒着热气，就是今天过得不错。', go: '看身体', shot: {d: V(3.0, 2.7, 4.8), t: V(0, .4, 0), fov: 30}},
  {key: 'letter', obj: letter, at: V(0, .4, 0), fn: '信', name: '玉兰火漆的信', lab: 'LETTERS', note: '读过的信收在桌布角上；有新信时，窗台上会落下一只纸飞机。', go: '拆开', shot: {d: V(-.8, 4.4, 4.0), t: V(0, .05, 0), fov: 32}},
  {key: 'toys', obj: toys, at: V(0, .9, 0), fn: '玩具厅', name: '一摞书上的小木盒', lab: 'PLAY', note: '骰子、铜钱、塔罗……想玩什么就打开盒子。', go: '去玩', shot: {d: V(-1.05, 2.3, 3.1), t: V(0, .3, 0), fov: 30}},
  {key: 'maple', obj: maple, at: V(0, 2.0, 0), fn: '彩蛋', name: '枫树盆景', lab: 'GITHUB', note: '做这张书桌的人种的一小盆枫。她别的小东西都在 GitHub 上，点下面去逛逛。', go: '去她的 GitHub', shot: {d: V(-1.8, 2.0, 5.8), t: V(0, .8, 0), fov: 30}},
  {key: 'pet', obj: tcard, at: V(0, 2.5, 0), fn: '桌宠 · 心情', name: '窗台上的透卡', lab: 'DESK PET', note: '他这会儿在做什么，卡上的颜文字就是什么样子；再点一下换个表情。阳光好的时候，它的彩色影子会投在窗台上。', go: '换个表情', shot: {d: V(-1.2, 1.6, 7.2), t: V(-.4, .5, 1.1), fov: 34}},
  {key: 'quick', obj: qs, at: V(0, 2.45, 0), fn: '桌宠 · 心情', name: '流麻牌', lab: 'DESK PET', note: '点一下它就跳起来翻个面，沉在底下的闪粉翻到上面，再慢慢往下流、落回底下；泡在油里的小挂件慢慢沉下去、转回正，换一个表情。和窗台上的透卡是同一个小家伙：一个在窗台晒太阳，一个陪你在桌上看书。', go: '再翻一次', shot: {d: V(4.4, 4.4, 8.35), t: V(.1, .95, .05), fov: 30, raw: true}},
  {key: 'trips', obj: journal, at: V(0, .45, 0), fn: '出门走走', name: '摊开的旅行手帐', lab: 'TRIPS', note: '他出门走了一趟，手帐上就多一页：照片、车票，还有路上捡回来的一片花瓣。', go: '翻手帐', shot: {d: V(-.5, 4.3, 3.6), t: V(0, .05, .05), fov: 32}},
  {key: 'where', obj: crane, at: V(0, 1.0, 0), fn: '我在哪', name: '书上的千纸鹤', lab: 'WHERE', note: '他出门在外的时候，千纸鹤就飞出去了；回到家，它又停回这摞书上。', go: '看看他在哪', shot: {d: V(1.2, 1.4, 4.4), t: V(0, .3, 0), fov: 28}},
  {key: 'space', obj: furin, at: V(-.3, 2.25, 0), fn: '空间', name: '窗台上的风铃架', lab: 'SPACE', note: '他发了新动态，纸笺上就换成那条动态里的一句话，风铃自己荡一下、叮一声。点一下它也会荡。', go: '去空间', shot: {d: V(-.68, 2.45, 7.3), t: V(-.36, .78, 0), fov: 31, raw: true}},
  {key: 'tree', anchor: V(-1.5, 14, -20), fn: '季节 · 天气', name: '柳', out: true, noFocus: true}
];
for (const t of TAGS) t.view = t.out ? 1 : 0;
const LABS = document.getElementById('labs');
for (const t of TAGS){
  const el = document.createElement('div'); el.className = 'tag hide';
  el.innerHTML = `<div class="p"><b>${t.fn}</b></div><i></i>`;
  LABS.appendChild(el); t.el = el;
}
const BYKEY = Object.fromEntries(TAGS.map(t => [t.key, t]));
/* 每样能点的东西外面套一个看不见的盒子（比它本身大一圈），只在没点到实物的时候才用；不画出来，只拿来判断点没点到 */
const HITBOX = new THREE.Group();
const pickable = o => {
  if (!o.isMesh || o.isSprite || o.userData.noPick || o === sea) return false;
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (m === M.glass) return false;                                     // 窗玻璃不挡
  if (o.layers.mask === 2 && !o.userData.cd) return false;             // 第 1 层上只有玻璃、亚克力这些能点，热气、雪不算
  if (m && m.transparent && m.opacity < .05 && !o.userData.cd) return false;
  return true;
};
const buildHitboxes = () => {
  HITBOX.clear(); scene.updateMatrixWorld(true);
  for (const t of TAGS){
    if (!t.obj || t.noFocus) continue;
    const b = new THREE.Box3(); t.obj.traverse(o => { if (pickable(o)) b.expandByObject(o, true); }); if (b.isEmpty()) continue;   // 只量实物，不量光晕、热气
    const sz = b.getSize(new THREE.Vector3()), pad = t.out ? .35 : .12;
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sz.x, .3) + pad * 2, Math.max(sz.y, .3) + pad * 2, Math.max(sz.z, .3) + pad * 2), new THREE.MeshBasicMaterial());
    b.getCenter(m.position); m.userData.key = t.key; m.updateMatrixWorld(); HITBOX.add(m);
  }
};
setTimeout(buildHitboxes, 1500); setTimeout(buildHitboxes, 6000);   // 模型换上以后再量一次

/* ── 镜头 ──
   坐在转椅上：左右拖就是转椅子（pan：0 看左边台灯那段，1 看窗下的主景）；
   上滑是凑到开着的窗扇前看外面（view：0 桌上，1 窗外）；
   点一样东西，镜头按它自己的“机位”推过去（focus），景深对准它，底下出一张卡片 */
const POSE = {
  L: {pos: V(-.75, 14.6, 13.2), tgt: V(-1.55, 5.2, -1.6), focus: V(-2.2, .6, .4)},   // 转到最左，画面左边正好是桌子尽头
  C: {pos: V(3.4, 14.6, 13.4), tgt: V(3.5, 4.2, -1.8), focus: V(3.4, .4, .9)},
  R: {pos: V(8.3, 14.6, 13.4), tgt: V(8.7, 4.3, -1.6), focus: V(8.6, .6, .2)},
  U: {pos: V(5.0, 10.4, 1.8), tgt: V(5.0, 4.2, -25), focus: V(5.0, 0, -60)}   // 抬头看出去：正中是海平线，下面看得到浪推上沙滩
};
const FOV = {desk: 50, win: 52};
const AP = {desk: .0016, deskMax: .018, win: .0004, winMax: .006, foc: .0045, focMax: .022};
let view = 0, viewT = 0, pan = 0, panTo = 0, panV = 0;   // pan：-1 左（写字角） 0 中间 1 右（窗边一角）
let focusKey = null, focusT = 0;
const FP = new THREE.Vector3(), FT = new THREE.Vector3(), FF = new THREE.Vector3(); let FFOV = 30;
/* 聚焦时直接点另一样东西：镜头从当前这个机位滑过去（中间稍微抬一下），不直接跳 */
const cFP = new THREE.Vector3(), cFT = new THREE.Vector3(), cFF = new THREE.Vector3(); let cFOV = 30; const SW = {t0: 0, fp: new THREE.Vector3(), ft: new THREE.Vector3(), ff: new THREE.Vector3(), fov: 30, lift: 0};
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
/* 环境遮蔽：东西贴着桌面、互相挨着的地方自然暗下去（玻璃、云、雪、透明的东西不参与） */
const gtao = new GTAOPass(scene, camera, VW(), VH());
gtao.updateGtaoMaterial({radius: .8, distanceExponent: 1.4, thickness: 1.2, scale: 1.2, samples: 12});
gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12});
gtao.blendIntensity = .8;
gtao.overrideVisibility = function(){ const cache = this._visibilityCache; this.scene.traverse(o => { cache.set(o, o.visible); if (o.isPoints || o.isSprite || o.userData.noAO || o.layers.mask === 2 || (o.material && o.material.transparent)) o.visible = false; }); };
composer.addPass(gtao);
const bokeh = new BokehPass(scene, depthCam, {focus: 20, aperture: .0006, maxblur: .011});
/* 景深按离镜头的远近来算（不是按画面高低）。只是给对焦的地方留一段“都清楚”的距离：
   坐在桌前时，从桌子前沿一直到窗台（千纸鹤、透卡）都是清楚的，窗外才开始虚；凑近看某样东西时，这段就收得很窄 */
bokeh.uniforms.dz = {value: 0};
bokeh.materialBokeh.fragmentShader = bokeh.materialBokeh.fragmentShader.replace('uniform float focus;', 'uniform float focus;\nuniform float dz;').replace('float factor = ( focus + viewZ );', 'float factor = ( focus + viewZ ); factor = sign( factor ) * max( 0., abs( factor ) - dz );');
bokeh.materialBokeh.uniforms.dz = bokeh.uniforms.dz; bokeh.materialBokeh.needsUpdate = true;
/* 景深用的深度图里，透明的东西（透卡、流麻的亚克力、风铃和花瓶的玻璃）不能挡住背后的深度——
   不然透过透卡看出去的窗外是清楚的。它们挪到第 1 层：照样画出来，但不进深度图；上面印了东西的那一层，再按印的地方单独补进深度图 */
/* 反光：three 用场景环境光时会无视材质自己写的 envMapIntensity（全按场景统一的强度来），所以玻璃、金属看着都发闷。
   这里把写了反光强度的那些材质单独接上环境贴图，强度 = 它自己的倍数 × 当前天色的环境光 */
scene.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)){ if (m && m.isMeshStandardMaterial && !m.envMap && m.envMapIntensity !== 1 && m !== M.glass && !m.userData.envb){ m.userData.envb = m.envMapIntensity; m.envMap = scene.environment; ENVB.push(m); } } });
const depthExtra = new THREE.Scene(), DX = [];
scene.traverse(m => {
  const cd = m.userData.cd; if (!m.isMesh || !cd) return;
  m.layers.set(1);
  if (cd.map){ const d = new THREE.Mesh(m.geometry, new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, map: cd.map, alphaTest: cd.test, side: THREE.DoubleSide})); d.matrixAutoUpdate = false; d.userData.src = m; depthExtra.add(d); DX.push(d); }
});
bokeh.render = function(renderer, writeBuffer, readBuffer){
  this.scene.overrideMaterial = this.materialDepth;
  renderer.getClearColor(this._oldClearColor); const oldClearAlpha = renderer.getClearAlpha(), oldAutoClear = renderer.autoClear;
  renderer.autoClear = false; renderer.setClearColor(0xffffff); renderer.setClearAlpha(1); renderer.setRenderTarget(this.renderTargetDepth); renderer.clear();
  renderer.render(this.scene, this.camera);
  this.scene.overrideMaterial = null;
  for (const d of DX){ const src = d.userData.src; let v = true; for (let o = src; o; o = o.parent) if (!o.visible){ v = false; break; } d.visible = v; d.matrix.copy(src.matrixWorld); d.matrixWorldNeedsUpdate = true; }
  renderer.render(depthExtra, this.camera);
  this.uniforms.tColor.value = readBuffer.texture; this.uniforms.nearClip.value = this.camera.near; this.uniforms.farClip.value = this.camera.far;
  if (this.renderToScreen){ renderer.setRenderTarget(null); this.fsQuad.render(renderer); } else { renderer.setRenderTarget(writeBuffer); renderer.clear(); this.fsQuad.render(renderer); }
  renderer.setClearColor(this._oldClearColor); renderer.setClearAlpha(oldClearAlpha); renderer.autoClear = oldAutoClear;
};
composer.addPass(bokeh);
composer.addPass(new OutputPass());
/* 调色：暗部压一点、偏一点冷；高光偏暖；四角压暗；一层很细的颗粒 */
const grade = new ShaderPass({
  uniforms: {tDiffuse: {value: null}, time: {value: 0}, dark: {value: 0}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, dark; varying vec2 vUv;
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 x = texture2D(tDiffuse, vUv).rgb;
      float l = dot(x, vec3(.299, .587, .114));
      x = mix(x, x * x * (3. - 2. * x), .22);
      x += vec3(.018, .008, -.008) * smoothstep(.5, 1., l) + vec3(-.006, .0, .008) * (1. - smoothstep(0., .3, l));
      float v = smoothstep(1.0, .28, length((vUv - .5) * vec2(1., 1.2)));
      x *= mix(.72 - dark * .25, 1., v);
      x += (rnd(vUv * vec2(1733., 911.) + time) - .5) * .02;
      gl_FragColor = vec4(x, 1.);
    }`
});
composer.addPass(grade);
/* ── 卡片的液态玻璃（跟连环一样）：玻璃画在画面里，卡片本身只放字 ──
   贴边一圈隆起的斜面把背后往里弯、红绿蓝各弯一点点；中间那片平的只是轻轻糊开；朝光那侧挂一道高光，外面一圈很淡的接地影 */
const GLASS_N = 28;   // 画面上最多多少块玻璃
class GlassPass extends Pass {
  constructor(){
    super();
    this.blurRT = new THREE.WebGLRenderTarget(4, 4, {generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false});
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({uniforms: {tDiffuse: {value: null}},
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }', depthTest: false, depthWrite: false}));
    this.uniforms = {tDiffuse: {value: null}, tBlur: {value: this.blurRT.texture}, uRes: {value: new THREE.Vector2(1, 1)},
      uRects: {value: Array.from({length: GLASS_N}, () => new THREE.Vector4())}, uRads: {value: new Array(GLASS_N).fill(0)}, uAs: {value: new Array(GLASS_N).fill(0)}, uShs: {value: new Array(GLASS_N).fill(0)}, uN: {value: 0},
      uPx: {value: 2}, uNight: {value: 0}, uTextLight: {value: 0}, uL: {value: new THREE.Vector2(-.55, .83)}};
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `uniform sampler2D tDiffuse, tBlur; uniform vec2 uRes, uL; uniform vec4 uRects[${GLASS_N}]; uniform float uRads[${GLASS_N}], uAs[${GLASS_N}], uShs[${GLASS_N}]; uniform int uN; uniform float uPx, uNight, uTextLight; varying vec2 vUv;
        float sdR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return min(max(q.x, q.y), 0.) + length(max(q, 0.)) - r; }
        void main(){
          vec2 px = vUv * uRes; vec4 base = texture2D(tDiffuse, vUv);
          /* 画面上所有的玻璃（卡片、标注、按钮、拉杆面板……）：找离这个像素最近的那一块 */
          float d = 1e5, uOn = 0., uRad = 0., shK = 0.; vec2 c = vec2(0.), hb = vec2(1.);
          for (int i = 0; i < ${GLASS_N}; i++){ if (i >= uN) break; vec4 r = uRects[i]; vec2 ci = r.xy + r.zw * .5, hi = r.zw * .5; float di = sdR(px - ci, hi, uRads[i]);
            if (uAs[i] > .001 && di < d){ d = di; c = ci; hb = hi; uRad = uRads[i]; uOn = uAs[i]; shK = uShs[i]; } }
          if (uOn < .001 || d > 34. * uPx){ gl_FragColor = base; return; }
          if (d > 0.){                                                      /* 玻璃外：一圈很淡的接地影 */
            float s = (exp(-d / (7. * uPx)) * .12 + exp(-d / (22. * uPx)) * .07) * shK;
            gl_FragColor = vec4(base.rgb * (1. - s * uOn), 1.); return; }
          vec2 g = vec2(sdR(px - c + vec2(1., 0.), hb, uRad) - sdR(px - c - vec2(1., 0.), hb, uRad), sdR(px - c + vec2(0., 1.), hb, uRad) - sdR(px - c - vec2(0., 1.), hb, uRad));
          g /= max(length(g), 1e-4);                                        /* 朝外的方向 */
          float bevel = min(20. * uPx, .32 * min(hb.x, hb.y)), t = clamp(-d / bevel, 0., 1.), e = 1. - t;
          /* 贴边隆起：圆弧截面，越靠边坡越陡；把背后往里弯（中间 t=1 处完全不动） */
          float slope = e * e * (1.6 - .6 * e);
          vec2 off = -g * slope * min(18. * uPx, .9 * min(hb.x, hb.y));   /* 小块的玻璃（标注、按钮）边上弯得少一点 */
          /* 整片玻璃是一块很薄的透镜：背后往中间收一点（放大一点点），再带一点不平整的波纹；
             红绿蓝三色弯的程度不一样（色散），越靠边分得越开。不铺任何颜色、不压暗 */
          vec2 rel = px - c;
          vec2 lens = -rel * .018;
          vec2 wav = vec2(sin(px.y / uPx * .045 + px.x / uPx * .012) + .5 * sin(px.x / uPx * .09 - 1.3), cos(px.x / uPx * .04 - px.y / uPx * .016) + .5 * cos(px.y / uPx * .08 + .7)) * .9 * uPx;
          vec2 o = off + (lens + wav) * smoothstep(0., .6, t);
          float disp = .012 + .035 * e;   // 色散只在边上一点点，像真玻璃那样淡
          vec2 uR = (px + o * (1. + disp)) / uRes, uG = (px + o) / uRes, uB = (px + o * (1. - disp)) / uRes;
          vec3 sharp = vec3(texture2D(tDiffuse, uR).r, texture2D(tDiffuse, uG).g, texture2D(tDiffuse, uB).b);
          vec3 soft = vec3(textureLod(tBlur, uR, .8).r, textureLod(tBlur, uG, .8).g, textureLod(tBlur, uB, .8).b);
          float body = smoothstep(.05, .75, t);
          vec3 col = mix(sharp, soft, body * .62);   /* 只是一层很轻的磨砂，颜色都是背后自己的 */
          /* 斜面上的光：朝光那一侧亮、背光那一侧暗；沿着周长强弱在变 */
          float face = dot(g, uL), lip = smoothstep(.55, .95, e);
          col += vec3(1., .99, .97) * lip * pow(max(face, 0.), 1.5) * (.42 - .22 * uNight);
          col += vec3(1.) * smoothstep(.86, 1., e) * .14 * (1. - .5 * uNight);        /* 一根发丝那么细的亮边 */
          col *= 1. - lip * max(-face, 0.) * .14;
          float a = clamp(-d / (1.1 * uPx), 0., 1.) * uOn;                   /* 边缘抗锯齿 */
          gl_FragColor = vec4(mix(base.rgb, col, a), 1.);
        }`}));
  }
  setSize(w, h){ this.blurRT.setSize(Math.max(4, Math.round(w / 4)), Math.max(4, Math.round(h / 4))); this.uniforms.uRes.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer){
    this.copy.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.blurRT); this.copy.render(renderer);

    this.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
}
const glass = new GlassPass(); composer.addPass(glass);
/* 每帧读一次每块玻璃在哪（卡片会滑、会回弹，标注跟着东西走），玻璃跟着；淡入淡出也跟着它们自己的显隐慢慢来 */
let ctlTop = 1e4;
const glassSync = () => {
  const ar = APP.getBoundingClientRect(), k = framed ? 1 / frameS : 1, px = glass.uniforms.uRes.value.x / VW(), H = VH(), U = glass.uniforms, now = performance.now(), foc = document.body.classList.contains('focused');
  let n = 0;
  const put = (el, want, rad, sh, rect) => {
    if (n >= GLASS_N) return;
    el._ga = (el._ga || 0) + (want - (el._ga || 0)) * .2; if (el._ga < .003 && !want) return;
    const r = rect || el.getBoundingClientRect(); if (!r.width) return;
    const x = (r.left - ar.left) * k, y = (r.top - ar.top) * k, w = r.width * k, h = r.height * k;
    if (y > H || y + h < 0) return;
    U.uRects.value[n].set(x * px, (H - y - h) * px, w * px, h * px); U.uRads.value[n] = Math.min(rad, h / 2) * px; U.uAs.value[n] = el._ga; U.uShs.value[n] = sh; n++;
  };
  { const r = CARD.getBoundingClientRect(), y = (r.top - ar.top) * k; CARD._ga = 0; if (y < H - 2 && (CARD.classList.contains('on') || now - (CARD._closedAt || 0) < 320)){ CARD._ga = .99; put(CARD, 1, 24, 1, r); } }
  put(HEADEL, foc ? 0 : 1, 14, .5);
  put(BACK, BACK.classList.contains('on') ? 1 : 0, 22, .6);
  put(HINT, HINT.classList.contains('off') ? 0 : 1, 99, .4);
  ctlTop = 1e4;
  if (CTL.parentNode === APP){ put(WXP, foc || !WXP.classList.contains('on') ? 0 : 1, 22, .6); for (const b of CTLBTN) put(b, foc ? 0 : 1, 20, .5); const r = CTL.getBoundingClientRect(); ctlTop = (r.top - ar.top) * k; }
  for (const t of TAGS){ const p = t.p || (t.p = t.el.firstElementChild); put(p, labsOn && !t.el.classList.contains('hide') ? 1 : 0, 10, .35); }
  U.uN.value = n; U.uPx.value = px;
  U.uNight.value = THREE.MathUtils.smoothstep(grade.uniforms.dark.value, .35, .8);
};


function resize(){
  layoutFrame();
  const w = VW(), h = VH();
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

/* 聚焦的机位：桌上的东西按 shot 来；窗外的东西从窗边拉长焦 */
/* 聚焦卡片盖住屏幕下面四分之一：镜头整体往下挪一点，东西就落在卡片上面那块的中间 */
const liftForCard = sh => {
  const dir = sh.tgt.clone().sub(sh.pos), dist = dir.length(); dir.normalize();
  const up = UP.clone().addScaledVector(dir, -UP.dot(dir)).normalize(), k = dist * Math.tan(sh.fov * Math.PI / 360) * .24;
  sh.pos.addScaledVector(up, -k); sh.tgt.addScaledVector(up, -k); return sh;
};
function shotFor(t){ const sh = shotFor0(t); return (t.out || (t.shot && t.shot.raw)) ? sh : liftForCard(sh); }
function shotFor0(t){
  const c = t.obj.getWorldPosition(new THREE.Vector3());
  if (t.out){
    const p = POSE.U.pos.clone(), dist = c.distanceTo(p);
    return {pos: p, tgt: c.clone().add(V(0, t.ty ?? .3, 0)), focus: c, fov: Math.max(14, Math.min(34, 230 / dist)) * (t.fovK || 1)};
  }
  const s = t.shot;
  if (s.raw){ return {pos: c.clone().add(s.d), tgt: c.clone().add(s.t), focus: c.clone().add(V(0, .8, 0)), fov: s.fov}; }
  if (s.abs){ return {pos: s.d.clone().add(V(0, 0, WALL_Z)), tgt: s.t.clone().add(V(0, 0, WALL_Z)), focus: s.t.clone().add(V(0, 0, WALL_Z)), fov: s.fov}; }
  const dd = s.d.clone(); dd.y = dd.y * 1.45 + .6; dd.z *= .92; dd.multiplyScalar(1.75);   // 聚焦都抬高一点、退远一点：东西在画面中间，周围的桌子也看得见
  return {pos: c.clone().add(dd), tgt: c.clone().add(s.t), focus: c.clone().add(s.t), fov: s.fov + 6};
}

const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const P0 = new THREE.Vector3(), T0 = new THREE.Vector3(), F0 = new THREE.Vector3(), Pd = new THREE.Vector3(), Td = new THREE.Vector3(), Fd = new THREE.Vector3();
function placeCamera(t){
  const e = ease(t), eT = ease(Math.min(1, t * 1.25)), side = pan < 0 ? POSE.L : POSE.R, s = Math.abs(pan);
  Pd.lerpVectors(POSE.C.pos, side.pos, s); Td.lerpVectors(POSE.C.tgt, side.tgt, s); Fd.lerpVectors(POSE.C.focus, side.focus, s);
  P0.lerpVectors(Pd, POSE.U.pos, e); T0.lerpVectors(Td, POSE.U.tgt, eT); F0.lerpVectors(Fd, POSE.U.focus, e);
  let fov = FOV.desk + (FOV.win - FOV.desk) * e, ap = AP.desk + (AP.win - AP.desk) * e, mb = AP.deskMax + (AP.winMax - AP.deskMax) * e;
  if (focusT > 0){
    const f = ease(focusT), sp = SW.t0 ? Math.min(1, (performance.now() - SW.t0) / 1250) : 1, se = ease(sp);
    cFP.lerpVectors(SW.fp, FP, se); cFP.y += Math.sin(Math.PI * se) * SW.lift; cFT.lerpVectors(SW.ft, FT, se); cFF.lerpVectors(SW.ff, FF, se); cFOV = SW.fov + (FFOV - SW.fov) * se;
    if (sp >= 1) SW.t0 = 0;
    P0.lerp(cFP, f); T0.lerp(cFT, f); F0.lerp(cFF, f); fov += (cFOV - fov) * f;
    const out = focusKey && BYKEY[focusKey].out; ap += ((out ? AP.win * .6 : AP.foc) - ap) * f; mb += ((out ? .01 : AP.focMax) - mb) * f;
  }
  if (window.__cam){ P0.copy(window.__cam.p); T0.copy(window.__cam.t); F0.copy(window.__cam.t); fov = window.__cam.fov; }   // 自查截图用的机位
  // 平时有一点很慢的呼吸，让纵深自己露出来；聚焦时停下
  const drift = reduce ? 0 : Math.sin(clock.elapsedTime * .45) * .02 * (1 - focusT);
  const off = P0.clone().sub(T0).applyAxisAngle(UP, drift);
  camera.position.copy(T0).add(off); camera.lookAt(T0);
  camera.fov = fov; camera.updateProjectionMatrix();
  bokeh.uniforms.focus.value = F0.clone().sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()));
  bokeh.uniforms.aperture.value = ap; bokeh.uniforms.maxblur.value = mb;
  bokeh.uniforms.dz.value = (7.5 * (1 - e)) * (1 - ease(focusT)) + .7 * ease(focusT);
  depthCam.copy(camera); depthCam.layers.set(0);
}

/* ── 标注跟着东西走 ── */
const tv = new THREE.Vector3(), box3 = new THREE.Box3();
let labsOn = true;
function placeTags(){
  const w = VW(), h = VH(), want = viewT < .5 ? 0 : 1;
  for (const t of TAGS){
    if (t.anchor) tv.copy(t.anchor);
    else t.obj.localToWorld(tv.copy(t.at));
    tv.project(camera);
    const x = (tv.x + 1) / 2 * w, y = (1 - tv.y) / 2 * h;
    const vis = !focusKey && focusT < .3 && t.view === want && tv.z < 1 && x > 20 && x < w - 20 && y > 90 && y < Math.min(h - 78, ctlTop - 8) && Math.abs(viewT - want) < .35;
    t.el.classList.toggle('hide', !vis);
    t.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
}

