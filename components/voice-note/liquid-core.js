/* 液态玻璃 · WebGL2 参考实现
   分层：Background → Glass → Content，一块 WebGL2 画布同时负责背景和玻璃。

   背景由这块画布自己绘制。如果背景是另一个 DOM 层，着色器就得反推它的
   cover 缩放和 background-position 才能采样，容易出现框内放大、错位、
   角落发黑这类坐标系错误。只有一个背景层，也就不存在对齐问题。

   用法：
     <liquid-stage wallpaper="assets/wall.png">
       <div data-glass data-radius="22">内容</div>
     </liquid-stage>
   每个 [data-glass] 子元素本身保持透明（Content 层），它的矩形交给着色器绘制玻璃。
*/
(function () {
  'use strict';
  var MAX = 14;
  /* reduced-motion 统一降级：所有弹簧直接到达目标值。
     只在这里读取一次，所有弹簧共用同一个开关。 */
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var onMQ = function (e) { REDUCE = e.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMQ);
    else if (mq.addListener) mq.addListener(onMQ);
  }

  /* ═══ 弹簧：采用苹果的 response / damping ratio 两参数形式（替代 mass-stiffness-damping）═══
     · 始终从当前的 presentation value 出发，因此随时可以被抓住、被改目标
     · to() 不清零速度：反向时速度自然过渡，不会突然顿住 */
  function Spring(v, response, damping) {
    this.x = v; this.v = 0; this.t = v;
    this.r = response == null ? 0.4 : response;
    this.z = damping == null ? 1.0 : damping;
  }
  Spring.prototype.to = function (t) { this.t = t; return this; };
  Spring.prototype.set = function (x) { this.x = x; this.t = x; this.v = 0; return this; };
  Spring.prototype.step = function (dt) {
    if (REDUCE) { this.x = this.t; this.v = 0; return this.x; }   // reduced-motion：直接到位，不播放动画
    dt = Math.min(dt, 1 / 30);
    var w = 2 * Math.PI / this.r;
    var a = -2 * this.z * w * this.v - w * w * (this.x - this.t);
    this.v += a * dt; this.x += this.v * dt;
    if (Math.abs(this.v) < 0.02 && Math.abs(this.x - this.t) < 0.02) { this.x = this.t; this.v = 0; }
    return this.x;
  };
  /* 松手落点投影，按 WWDC《Designing Fluid Interfaces》的减速率公式计算 */
  function project(v, d) { d = d || 0.998; return (v / 1000) * d / (1 - d); }
  function rubber(over, dim, c) { c = c || 0.55; return (over * dim * c) / (dim + c * Math.abs(over)); }

  var VS = '#version 300 es\n' +
    'in vec2 aPos; out vec2 vUV; void main(){ vUV = aPos; gl_Position = vec4(aPos*2.0-1.0,0.,1.); }';

  var FS = '#version 300 es\n' + [
    'precision highp float;',
    'in vec2 vUV; out vec4 outColor;',
    'uniform sampler2D uBg;',
    'uniform vec2 uRes;          // 画布像素',
    'uniform vec2 uBgOrigin;     // 壁纸在画布内画出来的原点',
    'uniform vec2 uBgSize;       // 壁纸画出来的尺寸',
    'uniform vec4 uShape[14];    // xy 中心, zw 半宽半高',
    'uniform vec4 uMeta[14];     // x 圆角, y 厚度(斜面带宽), z 附加料, w 压下量',
    'uniform vec4 uOpt[14];      // x SDF 指数（2=真圆，4=squircle）, y 1=磨砂层, z 淡色量, w 贴边散射倍率',
    'uniform int  uCount;',
    'uniform float uMerge;       // 融合半径，控制相邻玻璃互相融合的程度',
    'uniform vec2 uLight;',
    'uniform float uFrostLevel, uFrostTint;',
    'uniform float uIor, uDisp, uFrostRim, uFrostBody, uTint, uSpec, uMaxLod, uRefract, uBgBlur;',
    'uniform float uRimIn, uRimOut;   // 三路采样：Inner / Outer 两路的光学长度',
    /* uBgBlur 同时作用于框外的背景和玻璃内三路采样的底层 lod：
       背景模糊到哪一档，玻璃就基于那一档折射。框外清晰时框内也清晰，
       框外模糊时框内跟着模糊，框内不会比框外更模糊。
       不要再为框内单独加一个模糊参数，两个参数管同一件事会互相冲突。 */
    'uniform float uTexPx;            // 一个纹理像素在屏幕上有多少 px（cover 缩放后）',
    'uniform vec3 uAccent;',
    'uniform vec3 uTintCol;',
    /* 新配方（默认值都等于旧样子）：两瓣边光、饱和度、暗处提亮、按像素的色散、跟着底色换的边线、修正过的出射面、手指的光 */
    'uniform float uLobes, uSat, uLift, uDispPx, uEdge, uPhys, uDpr, uSoft;',
    'uniform vec4 uTouch[14];    // xy 手指位置（设备 px）, z 亮度 0..1',
    /* data-ink 的字：一张跟画布一样大的透明图（预乘），一张「这个字属于哪块玻璃」的编号图（R×255，0 = 贴在底上） */
    'uniform sampler2D uInk, uInkOwner;',
    'uniform float uInkOn;',
    'uniform float uInkId[14];',
    '',
    '// 折射，全反射时不突然掉成 0：k 夹在一个小正数上，位移平滑地饱和',
    'vec3 refr(vec3 I, vec3 N, float eta){',
    '  float c = dot(N, I), k = 1.0 - eta * eta * (1.0 - c * c);',
    '  return eta * I - (eta * c + sqrt(max(k, 0.04))) * N;',
    '}',
    '',
    'vec3 bgAt(vec2 p, float lod){ return textureLod(uBg, (p - uBgOrigin) / uBgSize, lod).rgb; }',
    'vec4 inkAt(vec2 q){ return texture(uInk, q / uRes); }',
    'float inkOwner(vec2 q){ return floor(texture(uInkOwner, q / uRes).r * 255.0 + 0.5); }',
    '// 玻璃折射时看到的：底图，加上别的玻璃（和底上）的字。自己那块的字不在这里弯，最后原样盖上去',
    'vec3 gAt(vec2 q, float lod, float self){',
    '  vec3 c = bgAt(q, lod);',
    '  if (uInkOn < 0.5) return c;',
    '  vec4 k = inkAt(q);',
    '  if (k.a > 0.002 && abs(inkOwner(q) - self) > 0.5) c = c * (1.0 - k.a) + k.rgb;',
    '  return c;',
    '}',
    '',
    '// 超椭圆。n=2 是真圆 / 真胶囊，n≈4 才是 squircle。',
    '// 圆形水珠必须用 n=2，用 4 画出来会偏方。',
    'float sdOne(vec2 p, vec4 s, float r, float n){',
    '  vec2 q = abs(p - s.xy) - s.zw + r;',
    '  float m = max(q.x, q.y);',
    '  if (m <= 0.0) return m - r;',
    '  vec2 v = max(q, 0.0);',
    '  if (n < 2.5) return length(v) - r;',
    '  return pow(pow(v.x, 4.0) + pow(v.y, 4.0), 0.25) - r;',
    '}',
    'float smin(float a, float b, float k){',
    '  if (k <= 0.001) return min(a,b);',
    '  float h = clamp(0.5 + 0.5*(b-a)/k, 0.0, 1.0);',
    '  return mix(b, a, h) - k*h*(1.0-h);',
    '}',
    '/* 两个独立的距离场。',
    '   df：磨砂层（如底栏），只散射、不折射，不与任何形状融合',
    '   dg：液态玻璃层（可以互相融合的部分）',
    '   这里只算距离。权重混合（厚度/附加料/颜色）只在玻璃内部用得上，单独放在 mixAt 里；',
    '   若合在同一个函数里，每个像素都要算用不到的那一半，加上法线的两次 glassOnly，每像素要算四遍。 */',
    'void dists(vec2 p, out float dg, out float df, out int near){',
    '  dg = 1e9; df = 1e9; near = 0; float nd = 1e9;',
    '  for (int i = 0; i < 14; i++){',
    '    if (i >= uCount) break;',
    '    float dd = sdOne(p, uShape[i], uMeta[i].x, uOpt[i].x);',
    '    if (uOpt[i].y > 0.5) { df = min(df, dd); }',
    '    else { dg = min(dg, dd); if (dd < nd) { nd = dd; near = i; } }',
    '  }',
    '}',
    'float glassOnly(vec2 p){ float a, b; int nn; dists(p, a, b, nn); return a; }',
    '/* soft-corner：算高度和法线用的距离场，圆角放大到跟斜面一样宽。',
    '   圆角比斜面小时，离边越深等高线越接近直角，在对角线上折一下，弯出来就是一道直的折痕。',
    '   放大以后斜面里的等高线一路都是圆的；外形（d）不变，只换算高度的那一份。 */',
    'float glassSoft(vec2 p){',
    '  float m = 1e9;',
    '  for (int i = 0; i < 14; i++){',
    '    if (i >= uCount) break;',
    '    if (uOpt[i].y > 0.5) continue;',
    '    vec4 sh = uShape[i];',
    '    float rr = min(max(uMeta[i].x, uMeta[i].y * uSoft), min(sh.z, sh.w));',
    '    m = min(m, sdOne(p, sh, rr, uOpt[i].x));',
    '  }',
    '  return m;',
    '}',
    '// 权重混合：只在 d < 1.5（确实位于玻璃内）时调用一次',
    'void mixAt(vec2 p, out float thick, out float extra, out float bodyF){',
    '  thick = 12.0; extra = 0.0; bodyF = 0.0; float wsum = 0.0;',
    '  for (int i = 0; i < 14; i++){',
    '    if (i >= uCount) break;',
    '    if (uOpt[i].y > 0.5) continue;',
    '    float dd = sdOne(p, uShape[i], uMeta[i].x, uOpt[i].x);',
    '    float w = exp(-max(dd, 0.0) / max(uMerge, 8.0)) * exp(-max(-dd,0.0)/60.0);',
    '    thick = mix(thick, uMeta[i].y, w / (wsum + w + 0.0001));',
    '    extra += uMeta[i].z * w; bodyF += uOpt[i].z * w; wsum += w;',
    '  }',
    '}',
    '',
    'float ggx(vec3 n, vec3 v, vec3 l, float rough){',
    '  vec3 h = normalize(v + l);',
    '  float a = max(rough*rough, 1e-3);',
    '  float ndh = max(dot(n,h),0.0), ndl = max(dot(n,l),0.0), ndv = max(dot(n,v),0.0);',
    '  if (ndl <= 0.0 || ndv <= 0.0) return 0.0;',
    '  float dd = ndh*ndh*(a*a-1.0)+1.0;',
    '  float D = (a*a)/(3.14159265*dd*dd);',
    '  float k = a*0.5;',
    '  float G = (ndl/(ndl*(1.0-k)+k))*(ndv/(ndv*(1.0-k)+k));',
    '  return (D*G)/(4.0*ndl*ndv);',
    '}',
    '',
    'void main(){',
    '  vec2 p = vec2(vUV.x, 1.0 - vUV.y) * uRes;',
    '  float d, df; int near;',
    '  dists(p, d, df, near);',
    '',
    '  // ── BACKGROUND（画布自己的背景，后面各层都从这里采样）',
    '  /* 背景层自身的模糊。它作用于 Background 层，与玻璃的磨砂是两回事，别混用。 */',
    '  vec3 base = bgAt(p, uBgBlur);',
    '  vec4 ink0 = vec4(0.0); float own0 = 0.0;',
    '  if (uInkOn > 0.5){ ink0 = inkAt(p); own0 = inkOwner(p); base = base * (1.0 - ink0.a) + ink0.rgb; }',
    '  if (d > 44.0 && df > 2.0){ outColor = vec4(base, 1.0); return; }',
    '  // ── FROST（如底栏）：整块均匀模糊、不折射，即磨砂效果。',
    '  if (df < 1.5){',
    '    float aaF = 1.0 - smoothstep(-1.0, 1.0, df);',
    '    /* 磨砂量必须按屏幕像素计算，不能直接用 mipmap 层级。',
    '       lod 属于纹理空间，壁纸经 cover 缩放到手机宽度后，一个纹理像素约 0.2 屏幕 px，',
    '       若直接用 uFrostLevel * uMaxLod，0.42 这一档落到屏幕上只有三四个像素，几乎看不出模糊。',
    '       因此：frostLevel × 48 = 期望的屏幕模糊半径（px），再换算成 lod。 */',
    '    float flod = clamp(log2(max(uFrostLevel * 48.0 / max(uTexPx, 1e-4), 1.0)), 0.0, uMaxLod);',
    '    vec3 fb = mix(bgAt(p, flod), uTintCol, uFrostTint);',
    '    float cF = exp(-pow(abs(df + 1.2)/1.4, 2.0));',
    '    fb += vec3(1.0) * cF * 0.26;',
    '    base = mix(base, fb, aaF);',
    '  }',
    '',
    '  /* 接地影从 d=0 就开始衰减，玻璃和背景用同一个 mix 衔接，中间不留缝。',
    '     如果玻璃只画到 d≤1、影子从 d>6 才开始，中间约 5px 既无玻璃也无影子，',
    '     会露出一圈原样的背景，看起来像阴影和水珠之间多了一层。 */',
    '  float sh = exp(-pow(max(d, 0.0)/15.0, 1.6)) * 0.20 * uMeta[near].w;',
    '  vec3 ground = base * (1.0 - sh);',
    '  if (d > 1.5){ outColor = vec4(ground, 1.0); return; }',
    '  float aa = 1.0 - smoothstep(-1.0, 1.2, d);',
    '  // 到这里才确定位于玻璃内，权重混合只跑这一次',
    '  float thick, extra, bodyF;',
    '  mixAt(p, thick, extra, bodyF);',
    '  float rimMul = uOpt[near].w;',
    '',
    '  // ── 高度场：贴边隆起（meniscus），中心严格是平的',
    '  float dh = uSoft > 0.001 ? glassSoft(p) : d;   // 算高度用的距离（soft-corner 时圆角放大）',
    '  float e = clamp(-dh / thick, 0.0, 1.0);',
    '  float h = sqrt(max(0.0, 1.0 - (1.0-e)*(1.0-e)));',
    '  float slope = (1.0 - e) / max(h, 0.08);',
    '  vec2 g = uSoft > 0.001 ? normalize(vec2(glassSoft(p + vec2(1.0,0.0)) - dh, glassSoft(p + vec2(0.0,1.0)) - dh) + 1e-6)',
    '                         : normalize(vec2(glassOnly(p + vec2(1.0,0.0)) - d, glassOnly(p + vec2(0.0,1.0)) - d) + 1e-6);',
    '  vec3 n = normalize(vec3(-g * slope * 0.95, 1.0));',
    '  vec3 v = vec3(0.0, 0.0, 1.0);',
    '',
    '  // ── 变量模糊：中心几乎不糊，只有斜面在散射。',
    '  //    清玻璃珠（rimMul 很小）基本不做贴边散射，避免出现一圈磨砂描边；',
    '  //    贴边散射留给大面积的磨砂面。',
    '  //    逐块的整块微散射（data-blur）：例如聊天气泡带一点模糊（约 5%），',
    '  //      文字压在壁纸上才看得清。量同样按屏幕像素给。',
    '  float lod = (uFrostBody + uFrostRim * rimMul * pow(1.0 - h, 2.2)) * uMaxLod;',
    '  if (bodyF > 0.001){',
    '    lod = max(lod, clamp(log2(max(bodyF * 48.0 / max(uTexPx, 1e-4), 1.0)), 0.0, uMaxLod));',
    '  }',
    '  lod = max(lod, uBgBlur);   // 背景模糊到哪一档，玻璃就从那一档开始算',
    '',
    '  // ── 双界面折射 + 色散 + 三路采样（Face / Inner Rim / Outer Rim）',
    '  /* 三路采样让边缘像透镜一样把背后的内容卷进来。',
    '     Face ：双界面折射，负责平的中心和斜面主体，单独使用时只产生位移。',
    '     Inner：贴边把内侧的图像往边缘拉，边缘一圈被放大、聚拢。',
    '     Outer：贴边把外侧的图像卷进来，框外的内容出现在边缘唇上，形成透镜边。',
    '     三路权重都挂在 rim = 1-h 上。平的中心 rim=0，wFace 在中心严格为 1，',
    '     所以中心区域跟框外一样清楚、一样大。 */',
    '  float rim = 1.0 - h;',
    '  float wOut  = pow(rim, 7.0);',
    '  float wIn   = pow(rim, 2.6) * (1.0 - wOut);',
    '  float wFace = max(1.0 - wIn - wOut, 0.0);',
    '  /* Face：只走一条物理光路（不分 RGB），不带色散。',
    '     色差只加在 Inner/Outer 上，中心保持稳定；中心只有一次采样，不会出现分色。',
    '     这里刻意不做微放大（例如 0.975），否则框内会比框外大。 */',
    '  vec3 r1 = refract(-v, n, 1.0/uIor);',
    '  vec2 o1 = r1.xy / max(-r1.z, 0.25) * thick * 0.85 * uRefract;',
    '  /* 出射面：光在玻璃里往 -z 走，背面法线应当朝 +z。旧配方保留原来的写法（现有的弯度是照它调的），',
    '     新配方（phys）用正确的法线，全反射处平滑饱和。 */',
    '  vec3 r2 = uPhys > 0.5 ? refr(normalize(r1), vec3(0.0,0.0,1.0), uIor) : refract(normalize(r1), vec3(0.0,0.0,-1.0), uIor);',
    '  vec2 o2 = r2.xy / max(-r2.z, 0.25) * thick * 0.45 * uRefract;',
    '  float selfId = uInkId[near];',
    '  vec3 col = gAt(p + o1 + o2, lod, selfId) * wFace;',
    '  // Inner 更清（低 LOD，负责主要的压缩与拉伸），Outer 更柔（高 LOD + 位移×1.28，负责翻卷与渗色）',
    '  float reachIn  = thick * 0.95 * uRimIn  * uRefract;',
    '  float reachOut = thick * 0.55 * 1.28 * uRimOut * uRefract;',
    '  for (int i = 0; i < 3; i++){',
    '    float k = 1.0 + (float(i) - 1.0) * uDisp * 7.0;',
    '    float ri = reachIn * k, ro = reachOut * k;',
    '    if (uDispPx > 0.0){   // 按像素：R/G/B 只差几个像素，越贴边差得越多',
    '      float sp = (float(i) - 1.0) * uDispPx * uDpr * (0.3 + rim);',
    '      ri = reachIn + sp; ro = reachOut + sp;',
    '    }',
    '    col[i] += gAt(p - g * ri, max(uBgBlur, lod * 0.25), selfId)[i] * wIn;',
    '    col[i] += gAt(p + g * ro, min(lod * 1.35 + uMaxLod * 0.08, uMaxLod), selfId)[i] * wOut;',
    '  }',
    '',
    '  // ── 底色：随下方亮度自适应。暗处几乎不加（否则会变成灰板），亮处加厚以保证可读。',
    '  vec3 around = bgAt(p, uMaxLod * 0.8);',
    '  float lum = dot(around, vec3(0.2126, 0.7152, 0.0722));',
    '  float adapt = smoothstep(0.45, 0.95, lum) * 0.16;',
    '  col = mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSat);   // 饱和度：1 = 原样',
    '  col = mix(col, uTintCol, clamp(uTint + adapt + extra, 0.0, 0.92));',
    '  col += (1.0 - col) * uLift * (1.0 - smoothstep(0.15, 0.55, lum));   // 暗处提亮一点，黑玻璃在暗底上才不像一个洞',
    '',
    '  // ── GGX 高光，只挂在有曲率的斜面上（rim=1-h）',
    '  // ── F0 由 IOR 推出；四盏掠射柔光，只落在倒角的外半段。',
    '  //    一圈等强的光看起来像描边；四盏强弱不同、冷暖略有差别，边缘才会有流动的光泽。',
    '  float f0 = pow((uIor - 1.0)/(uIor + 1.0), 2.0);',
    '  float support = smoothstep(0.42, 1.0, rim);   // outerBevelSupport：不让中心隆起',
    '  float lAng = atan(uLight.y, uLight.x);',
    '  vec3 spec = vec3(0.0);',
    '  vec3 l = normalize(vec3(uLight, 0.82));',
    '  for (int i = 0; i < 4; i++){',
    '    float a = lAng + float(i) * 1.5708 + 0.34;',
    '    vec3 li = normalize(vec3(cos(a) * 0.94, sin(a) * 0.94, 0.30 + float(i) * 0.035));',
    '    float w = 1.0 - float(i) * 0.19;',
    '    vec3 warm = mix(vec3(1.0,0.985,0.96), vec3(0.955,0.975,1.0), float(i) / 3.0);',
    '    vec3 hv = normalize(v + li);',
    '    float fr = f0 + (1.0 - f0) * pow(1.0 - max(dot(hv, v), 0.0), 5.0);',
    '    spec += warm * ggx(n, v, li, 0.32) * fr * w;',
    '  }',
    '  col += min(spec * uSpec * 0.014, vec3(0.85)) * support * (1.0 - uLobes);',
    '',
    '  // ── 镜边发丝线：朝光一侧亮、背光一侧暗，边缘的晶莹感主要来自这里。',
    '  //    它沿周长强弱变化，所以看起来不像一圈均匀的白边。',
    '  float contour = exp(-pow(abs(d + 1.2) / 1.5, 2.0));',
    '  float facing = dot(normalize(vec3(-g, 0.35)), l);',
    '  col += vec3(1.0) * contour * max(facing, 0.0) * 0.55 * (1.0 - uLobes);',
    '  col -= vec3(0.35, 0.36, 0.40) * contour * max(-facing, 0.0) * 0.30 * (1.0 - uLobes);',
    '',
    '  // ── 新配方的边光：整圈一道约 1px 的唇，朝光那瓣和对角那瓣更亮，斜面上再铺一层宽的柔光。',
    '  //    边线颜色跟着背后深浅走（edge-adapt）：背后亮的地方，不在亮瓣上的那段换成深色细线，白玻璃在亮底上才有边。',
    '  if (uLobes > 0.001){',
    '    vec2 L2 = normalize(uLight);',
    '    float f = dot(-g, L2);',
    '    float lobe = pow(abs(f), 3.0) * (f > 0.0 ? 1.0 : 0.6);',
    '    float lip = exp(-pow((d + 0.6 * uDpr) / (0.6 * uDpr), 2.0));   // 约 1 个 CSS 像素宽',
    '    float glow = support * rim * lobe;',
    '    float behind = dot(bgAt(p + g * 3.0 * uDpr, uMaxLod * 0.5), vec3(0.2126, 0.7152, 0.0722));',
    '    float darkLine = uEdge * smoothstep(0.55, 0.85, behind) * (1.0 - smoothstep(0.15, 0.5, lobe));',
    '    vec3 lineCol = mix(vec3(0.93, 0.95, 1.0), vec3(0.16, 0.17, 0.20), darkLine);',
    '    // 整圈只留一点点底（0.08），亮度主要在两瓣上，沿着一圈连续地变 —— 一样亮一样白就成描边了',
    '    float lineA = lip * mix(0.08 + 0.42 * lobe, 0.40, darkLine);',
    '    col = mix(col, lineCol, clamp(lineA * uLobes * uSpec, 0.0, 1.0));',
    '    col += vec3(1.0, 0.99, 0.97) * glow * 0.06 * uLobes * uSpec;',
    '  }',
    '',
    '  // ── 手指的光（press="bloom"）：按下时从手指那里往外亮一片',
    '  vec4 tc = uTouch[near];',
    '  if (tc.z > 0.001){',
    '    float R = 1.5 * min(uShape[near].z, uShape[near].w);',
    '    col += vec3(1.0) * tc.z * (0.06 + 0.12 * smoothstep(R, R * 0.5, distance(p, tc.xy)));',
    '  }',
    '',
    '  // ── 菲涅尔唇',
    '  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);',
    '  col += vec3(0.92, 0.95, 1.0) * fres * mix(0.10, 0.30, rimMul) * support * (1.0 - 0.5 * uLobes);   // 新配方里减半，不然整圈一样亮',
    '',
    '  // 自己这块玻璃上的字：不折射、不上料，原样盖在最上面（跟网页上的内容层一样）',
    '  if (ink0.a > 0.002 && abs(own0 - selfId) < 0.5) col = col * (1.0 - ink0.a) + ink0.rgb;',
    '  outColor = vec4(mix(ground, col, aa), 1.0);',
    '}'
  ].join('\n');

  /* ══ 真高斯模糊（离屏预处理）════════════════════════════
     直接用 textureLod 走 mipmap 链来做模糊，lod 一大就会出现锯齿和马赛克感：
     mipmap 是盒式降采样（每级减半、四合一），lod 拉大后就是一格一格的块再做双线性插值，
     看起来像降低了分辨率。真正的高斯模糊需要自己算，并且两点都要做对：
       ① 可分离：横一趟、竖一趟（二维 N² 降为 2N）
       ② 大半径靠多趟叠加，不靠加大步距：K 趟 sigma 的高斯 ≈ 一趟 sigma·√K；
          步距一大就会出现采样带，结果依然是块状。
     这一步是一次性预处理，只在 bg-blur 改变时重算一张，平时每帧不跑。
     算完之后背景和玻璃采样的是同一张已模糊的图，框内自然跟着框外变化，不需要额外参数。
     流程：背景先渲染到离屏纹理，再生成可供 textureLod 采样的 mipmap。 */
  var BLUR_FS = '#version 300 es\n' + [
    'precision highp float;',
    'in vec2 vUV; out vec4 outColor;',
    'uniform sampler2D uSrc;',
    'uniform vec2 uStep;      // 一格走多远（已含方向和 1/尺寸）',
    'uniform float uSigma;    // 以「格」为单位，不要超过 8/3，否则 17 个抽头装不下高斯的尾部',
    'void main(){',
    '  vec3 acc = vec3(0.0); float sum = 0.0;',
    '  for (int i = -8; i <= 8; i++){',
    '    float x = float(i);',
    '    float w = exp(-0.5 * x * x / (uSigma * uSigma));',
    '    acc += texture(uSrc, vUV + uStep * x).rgb * w;',
    '    sum += w;',
    '  }',
    '  outColor = vec4(acc / sum, 1.0);',
    '}'
  ].join('\n');

  function compile(gl, t, src) {
    var s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[liquid]', gl.getShaderInfoLog(s)); return null; }
    return s;
  }

  var UNI = ['uBg','uRes','uBgOrigin','uBgSize','uShape','uMeta','uOpt','uCount','uMerge','uLight',
             'uIor','uDisp','uFrostRim','uFrostBody','uTint','uSpec','uMaxLod','uTintCol',
             'uFrostLevel','uFrostTint','uAccent','uRefract','uBgBlur','uRimIn','uRimOut','uTexPx',
             'uLobes','uSat','uLift','uDispPx','uEdge','uPhys','uDpr','uSoft','uTouch','uInk','uInkOwner','uInkOn','uInkId'];

  function LiquidStage() { return Reflect.construct(HTMLElement, [], LiquidStage); }
  LiquidStage.prototype = Object.create(HTMLElement.prototype);
  LiquidStage.prototype.constructor = LiquidStage;
  Object.setPrototypeOf(LiquidStage, HTMLElement);

  LiquidStage.prototype.connectedCallback = function () {
    if (this._up) return; this._up = true;
    var self = this;
    this.style.position = 'relative';
    this.style.display = 'block';
    this.style.overflow = 'hidden';
    this.style.isolation = 'isolate';
    this.style.width = '100%';
    this.style.height = this.getAttribute('height') || this.getAttribute('stageheight') || '100%';
    this.style.minHeight = '80px';

    var cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block';
    this.insertBefore(cv, this.firstChild);
    this._cv = cv;

    /* WebGL 上下文是数量有限的资源。一页同时开着太多画布时，浏览器会回收最旧的
       上下文（webglcontextlost）；如果只 preventDefault 而没有 restored 路径，
       被回收的画布就会永久空白。
       因此三件事一起做：懒建（进入视口才创建）、停放（离开视口主动交还）、重建（restored 后重新初始化）。 */
    cv.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();          // 不调用 preventDefault 就永远收不到 restored
      self._pr = null; self._tex = null; self._painted = false;
      self._inkTex = self._inkOwnTex = null; self._inkKey = null;   // 字那两张图跟着上下文没了，回来重画
      /* 主动停放（滚出视口）不算降级，被浏览器回收才算。
         这时把 data-liqgl 设为 0，交给 CSS 兜底样式接手。 */
      if (!self._parked) document.documentElement.setAttribute('data-liqgl', '0');
    });
    cv.addEventListener('webglcontextrestored', function () {
      self._parked = false;
      self._initGL();
    });

    this._gen = 0;              // 圆角缓存的世代号
    this._hosts = []; this._state = new WeakMap();
    this._scan();
    this._mo = new MutationObserver(function (ms) {
      self._scanSoon();
      /* data-ink 里的字变了（或者新长出来一块 data-ink），字那一层要重画 */
      for (var i = 0; i < ms.length; i++) {
        var t = ms[i].target;
        if (t.nodeType !== 1) t = t.parentElement;
        if (t && t.closest && (t.closest('[data-ink]') || (t.querySelector && t.querySelector('[data-ink]:not([data-inked])')))) { self.refreshInk(); break; }
      }
    });
    this._mo.observe(this.getAttribute('hosts') ? document.body : this,
                     { childList: true, subtree: true });

    this._bindDrag();
    this._gate();
    /* 切到后台再回来，屏上那一帧不一定还在：回来先强制画一帧 */
    var forget = function () { self._fp = null; };
    document.addEventListener('visibilitychange', forget);
    window.addEventListener('pageshow', forget);
    this._last = performance.now();
    this._tick = function (now) {
      if (!self.isConnected) return;
      var dt = Math.min(0.05, (now - self._last) / 1000); self._last = now;
      if (self._vis !== false) self._revive();   // 应当可见但上下文已丢失时，每 500ms 尝试恢复一次
      self._frame(dt);
      self._raf = requestAnimationFrame(self._tick);
    };
    this._raf = requestAnimationFrame(this._tick);
  };

  /* 所有 GL 资源都在这里创建：首次进入视口跑一次，上下文恢复后再跑一次。
     初始化和重建共用同一套代码。 */
  LiquidStage.prototype._initGL = function () {
    var self = this, cv = this._cv;
    var gl = this._gl || cv.getContext('webgl2', { antialias: false, alpha: false });
    this._gl = gl;
    this._fp = null;                            // 新的上下文，上一帧的记号作废
    if (!gl) {
      /* 不支持 WebGL2：不接管背景，保留页面原有的壁纸。 */
      this.setAttribute('data-fallback', '1');
      document.documentElement.setAttribute('data-liqgl', '0');
      return false;
    }
    if (gl.isContextLost()) return false;
    /* WEBGL_lose_context 只能在上下文存活时拿到：上下文丢失后
       getExtension('WEBGL_lose_context') 会返回 null，停放时能释放，恢复时却无法 restore。
       所以只取一次并缓存，停放和恢复都用它。 */
    this._ext = this._ext || gl.getExtension('WEBGL_lose_context');
    var vs = compile(gl, gl.VERTEX_SHADER, VS), fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn('[liquid]', gl.getProgramInfoLog(pr)); return false; }
    gl.useProgram(pr); this._pr = pr;
    this._loc = {}; UNI.forEach(function (k) { self._loc[k] = gl.getUniformLocation(pr, k); });

    var buf = gl.createBuffer();
    this._vbo = buf;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 0,1, 1,0, 1,1]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(pr, 'aPos');
    gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

    this._tex = null; this._texSize = [1, 1];
    /* 模糊管线：独立的着色器程序 + 两张离屏纹理，与主程序共用同一个 VBO。 */
    this._blurPr = null; this._rt = null; this._blurKey = null;
    var bvs = compile(gl, gl.VERTEX_SHADER, VS), bfs = compile(gl, gl.FRAGMENT_SHADER, BLUR_FS);
    if (bvs && bfs) {
      var bp = gl.createProgram();
      gl.attachShader(bp, bvs); gl.attachShader(bp, bfs); gl.linkProgram(bp);
      if (gl.getProgramParameter(bp, gl.LINK_STATUS)) {
        this._blurPr = bp;
        this._blurLoc = {
          src: gl.getUniformLocation(bp, 'uSrc'),
          step: gl.getUniformLocation(bp, 'uStep'),
          sigma: gl.getUniformLocation(bp, 'uSigma'),
          pos: gl.getAttribLocation(bp, 'aPos')
        };
      } else console.warn('[liquid] blur', gl.getProgramInfoLog(bp));
    }
    this._painted = false;
    this._tries = 0;
    this._gen = (this._gen || 0) + 1;       // 重建了，圆角缓存一律失效
    this._loadWall(this._wallSrc || this.getAttribute('wallpaper'));
    return true;
  };

  /* 视口门控：只有接近视口的舞台才申请 WebGL 上下文。
     同一页面上有多个舞台时，这样能避免上下文数量超出浏览器上限。 */
  LiquidStage.prototype._gate = function () {
    var self = this;
    if (!('IntersectionObserver' in window)) { this._initGL(); return; }
    this._io = new IntersectionObserver(function (es) {
      self._vis = es[es.length - 1].isIntersecting;
      if (self._vis) {
        if (!self._gl) { self._initGL(); return; }
        self._revive();
      } else if (self._gl && self._pr && self._ext && !self._gl.isContextLost()) {
        /* 没拿到 WEBGL_lose_context 扩展就不停放，否则停放后无法恢复。 */
        self._parked = true;
        self._ext.loseContext();
      }
    }, { rootMargin: '250px' });
    this._io.observe(this);
  };

  /* 幂等：舞台应当可见却丢了上下文时，请求恢复一次。
     _parked 不在这里清除，要等 webglcontextrestored 真正触发才算恢复。 */
  LiquidStage.prototype._revive = function () {
    if (!this._gl || !this._gl.isContextLost() || !this._ext) return;
    /* 恢复不了就不要无限重试，那本身也会卡住页面。超过八次就把 data-liqgl 设为 0，交给 CSS 兜底。 */
    if ((this._tries || 0) > 8) { document.documentElement.setAttribute('data-liqgl', '0'); return; }
    var now = performance.now();
    if (this._tryAt && now - this._tryAt < 500) return;
    this._tryAt = now; this._tries = (this._tries || 0) + 1;
    this._ext.restoreContext();
  };

  LiquidStage.prototype.disconnectedCallback = function () {
    cancelAnimationFrame(this._raf);
    if (this._mo) this._mo.disconnect();
    if (this._io) this._io.disconnect();
    this._up = false;
  };

  LiquidStage.prototype._loadWall = function (src) {
    if (!src) return;
    this._wallSrc = src;                    // 上下文被重建时要重新上传这张图
    var self = this, gl = this._gl, im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = function () {
      if (!gl || gl.isContextLost() || gl !== self._gl) return;
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      self._srcTex = t; self._srcSize = [im.naturalWidth, im.naturalHeight];
      self._blurKey = null;                 // 换了图，之前模糊好的纹理作废
      self._tex = t; self._texSize = self._srcSize.slice();
      self._texGen = (self._texGen || 0) + 1;   // 换了图：下一帧必须重画
      self._buildBlur();
    };
    im.src = src;
  };

  /* ══ 把壁纸模糊成一张纹理（一次性）。bg-blur 没变就不重算。
     工作尺寸的长边封顶 512：预处理不需要原尺寸，缩小本身就去掉了高频，
     后面的高斯只负责把它平滑地抹开，得到的是模糊效果，而非像素化。
     uTexPx / uBgSize 读的是当前绑定纹理的尺寸（_texSize），
     所以换了尺寸之后，frost-level / data-blur 这些按屏幕像素给的量仍然正确。 */
  LiquidStage.prototype._buildBlur = function () {
    var gl = this._gl;
    if (!gl || gl.isContextLost() || !this._srcTex) return;
    var amt = Math.max(0, Math.min(1, num(this, 'bg-blur', 0)));
    var key = amt.toFixed(3) + '|' + this._srcSize.join('x');
    if (this._blurKey === key) return;
    this._blurKey = key;
    this._texGen = (this._texGen || 0) + 1;     // 重糊了：下一帧必须重画
    if (amt <= 0.004 || !this._blurPr) {          // 不模糊（或模糊程序没建成）：直接用原图
      this._tex = this._srcTex; this._texSize = this._srcSize.slice();
      return;
    }
    var sw = this._srcSize[0], sh = this._srcSize[1];
    /* 背景模糊 0.1 以下单独一段，才能调得比「微糊」更清：
         ① 工作尺寸从接近原图慢慢收到长边 512（缩小本身就是一层糊，这一层也得能退掉）
         ② sigma 从 0.35 慢慢涨到 2.6
       到 0.1 正好接上上面那一档，0.1 以上不变。 */
    var low = amt < 0.1 ? amt / 0.1 : 1;                           // 0..1：低段走到哪了；≥0.1 恒为 1
    var cap = low < 1 ? Math.round(512 / Math.max(low, 0.25)) : 512;   // 0.1→512，0.05→1024，0.025 以下→2048
    var k = Math.min(1, cap / Math.max(sw, sh));
    var W = Math.max(4, Math.round(sw * k)), H = Math.max(4, Math.round(sh * k));
    var rt = this._ensureRT(W, H);
    if (!rt) { this._tex = this._srcTex; this._texSize = this._srcSize.slice(); return; }
    var L = this._blurLoc;
    gl.useProgram(this._blurPr);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    gl.enableVertexAttribArray(L.pos);
    gl.vertexAttribPointer(L.pos, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, W, H);
    gl.uniform1f(L.sigma, low < 1 ? Math.max(0.35, 2.6 * low) : 2.6);   // 2.6 = 17 抽能干净装下的上限；低段按比例收小
    gl.uniform1i(L.src, 0);
    gl.activeTexture(gl.TEXTURE0);
    /* 趟数随 bg-blur 变化：K 趟横竖高斯 ≈ sigma·√(2K)。一到十趟，覆盖从轻微模糊到看不出形状。
       不能做乒乓交替：第二趟会变成同时写入和采样 rt[1]，同一张纹理既是目标又是源，
       WebGL 会报 INVALID_OPERATION（1282），那一帧就画不出来。
       因此固定为：横向一律写 rt[0]，竖向一律写 rt[1]，下一趟的源就是 rt[1]，读写永不重叠。 */
    var passes = Math.max(1, Math.round(amt * 10));
    var srcTex = this._srcTex;
    for (var p = 0; p < passes; p++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt[0].fb);      // 横
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.uniform2f(L.step, 1 / W, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt[1].fb);      // 竖
      gl.bindTexture(gl.TEXTURE_2D, rt[0].tex);
      gl.uniform2f(L.step, 0, 1 / H);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      srcTex = rt[1].tex;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    /* 给模糊后的纹理生成 mipmap，贴边散射和磨砂条还要按 lod 采样。
       中间那张（rt[0]）只做中转，从不被 textureLod 读取，所以不需要 mipmap。 */
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    this._tex = srcTex; this._texSize = [W, H];
    /* 恢复主程序的状态：它的 aPos 位置可能与模糊程序不同。 */
    gl.useProgram(this._pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
    var a = gl.getAttribLocation(this._pr, 'aPos');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  };

  LiquidStage.prototype._ensureRT = function (W, H) {
    var gl = this._gl;
    if (this._rt && this._rt.w === W && this._rt.h === H) return this._rt;
    if (this._rt) this._rt.forEach(function (o) {
      gl.deleteFramebuffer(o.fb); gl.deleteTexture(o.tex);
    });
    var out = [];
    for (var i = 0; i < 2; i++) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      /* 中转图只用 LINEAR：带 mipmap 过滤却没有层级的图是不完整的，采出来是黑的。
         只有最后那张在 _buildBlur 末尾换成 LINEAR_MIPMAP_LINEAR 并生成层级。 */
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        console.warn('[liquid] 离屏图建不起来，模糊退回 mipmap');
        return null;
      }
      out.push({ tex: t, fb: fb });
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    out.w = W; out.h = H;
    this._rt = out;
    return out;
  };

  /* 宿主页面可能频繁重建 DOM，一次渲染就会触发几十条 mutation。
     每条都跑一遍全量 querySelectorAll + getComputedStyle 会造成布局抖动，
     所以合并到下一帧只跑一次。 */
  LiquidStage.prototype._scanSoon = function () {
    var self = this;
    if (this._pend) return;
    /* 只靠 rAF 合并还不够：DOM 可能每一帧都在变，而 _scan 是全量 querySelectorAll
       加一次 IntersectionObserver 重挂，所以再加一个 200ms 的最小间隔。 */
    var now = performance.now();
    var wait = Math.max(0, 200 - (now - (this._scanAt || 0)));
    this._pend = 1;
    setTimeout(function () {
      self._pend = requestAnimationFrame(function () {
        self._pend = 0; self._scanAt = performance.now(); self._scan();
      });
    }, wait);
  };

  LiquidStage.prototype._scan = function () {
    /* hosts="selector"：玻璃宿主不必是舞台的子元素。
       适用于一块画布铺满整个界面、玻璃元素散落在页面各处的情况。 */
    var sel = this.getAttribute('hosts');
    var self = this;
    if (!this._vio && 'IntersectionObserver' in window) {
      this._vio = new IntersectionObserver(function (es) {
        for (var q = 0; q < es.length; q++) {
          var s2 = self._state.get(es[q].target);
          if (s2) s2.vis = es[q].isIntersecting;
        }
      }, { rootMargin: '80px' });
    }
    var list = Array.prototype.slice.call(
      sel ? document.querySelectorAll(sel) : this.querySelectorAll('[data-glass]'));
    /* 这里不按 MAX 截断，因为 DOM 中靠前的元素往往在屏外。
       每帧画哪几块由 _frame 按离视口中心的远近现场挑选。 */
    /* 宿主总数要有上限：每个宿主每帧都要调用 getBoundingClientRect，
       数量过大（例如几百个）会拖垮主线程，页面甚至无法完成加载。 */
    /* 上限不能单纯按 DOM 顺序截断，可拖动的元素必须优先留位。
       比如底栏位于文档末尾，前面若有几十条列表项，按顺序截断会把底栏的拖动珠子切掉，
       珠子没有弹簧，拖动就完全失效。
       所以先把所有 [data-drag]（拖动珠子、取值点等）收进来，剩下的名额再分给静止的玻璃面。 */
    var must = [], rest = [];
    for (var q2 = 0; q2 < list.length; q2++) {
      (list[q2].hasAttribute('data-drag') ? must : rest).push(list[q2]);
    }
    this._hosts = must.concat(rest.slice(0, Math.max(0, 72 - must.length)));
    this._hosts.forEach(function (el) {
      if (self._state.has(el)) return;
      self._state.set(el, {
        press: new Spring(0, 0.28, 1.0),
        sx: new Spring(0, 0.34, 0.72),   // 拖动时的形变（拉伸）
        sy: new Spring(0, 0.34, 0.72),
        sw: new Spring(0, 0.42, 1.0)     // 膨胀（可选），用连续量表达，不额外增加形状
      });
      /* 只给真正需要定位上下文的宿主读一次 computed style。
         无条件地「读 computed、写 inline、再读下一个」会让每个宿主触发一次强制样式重算；
         列表用 innerHTML 重建时，每批 mutation 都是一批新宿主，重算多到足以拖垮主线程。
         普通玻璃面不需要 position: relative（着色器读的是它的 rect），
         只有要写入 transform 的可拖动元素才需要。 */
      if (el.hasAttribute('data-drag') && getComputedStyle(el).position === 'static') {
        el.style.position = 'relative';
      }
      /* 屏外宿主不消耗布局预算，见 _scan 末尾的 observe。 */
      if (el.hasAttribute('data-drag')) {
        var s = self._state.get(el);
        s.x = new Spring(num(el, 'data-x', 0), 0.34, 1.0);
        s.y = new Spring(num(el, 'data-y', 0), 0.34, 1.0);
      }
      if (el.hasAttribute('data-press')) self._pressable(el);
    });
    /* 每次重扫都把观察名单换成当前这批宿主（最多 72 个）。
       不能只 observe 不 disconnect：IntersectionObserver 持有强引用，
       列表被 innerHTML 重建后若不清理，就会一直持有大量已脱离 DOM 的节点。 */
    if (this._vio) {
      this._vio.disconnect();
      for (var v = 0; v < this._hosts.length; v++) this._vio.observe(this._hosts[v]);
    }
  };

  /* ══ data-ink：网页上的字也让玻璃弯得到 ══
     网页上的字在画布上面，着色器碰不到。标了 data-ink 的元素，它的字按浏览器排好的版（每个字的位置都量）
     画进一张跟画布一样大的透明图，网页上那份变透明（还在 DOM 里，读屏照样读得到）。
     旁边再画一张编号图：这个字长在哪块玻璃上（0 = 贴在底上）。玻璃折射时跳过自己身上的字，
     最后把自己的字原样盖上去 —— 自己的字永远清楚，别的玻璃（比如拖过来的水珠）压上来才会把它弯过去。
     适合不滚动的字：每次重画都要重传整张图，会滚动的长列表别用；会被拖着走的玻璃上也别用（字不跟着走）。
     什么时候重画：画布尺寸变了、字的内容变了、外面调 refreshInk()（比如换了明暗、字的颜色跟着变）。 */
  LiquidStage.prototype._inkList = function () {
    var a = Array.prototype.slice.call(this.querySelectorAll('[data-ink]'));
    if (this.getAttribute('hosts')) Array.prototype.forEach.call(document.querySelectorAll('[data-ink]'), function (el) { if (a.indexOf(el) < 0) a.push(el); });
    return a;
  };
  LiquidStage.prototype.refreshInk = function () { this._inkDirty = true; this._fp = null; };
  LiquidStage.prototype._ink = function (W, H, dpr, sr) {
    var gl = this._gl, self = this, list = this._inkList();
    this._inkDirty = false; this._inkKey = W + 'x' + H;
    if (!list.length) {
      if (this._inkTex) { gl.deleteTexture(this._inkTex); gl.deleteTexture(this._inkOwnTex); }
      this._inkTex = this._inkOwnTex = null; return;
    }
    var c = document.createElement('canvas'), o = document.createElement('canvas');
    c.width = o.width = W; c.height = o.height = H;
    var x = c.getContext('2d'), y = o.getContext('2d');
    var rg = document.createRange();
    var SH = /(rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})\s+(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?/;
    this._inkSeq = this._inkSeq || 0;
    list.forEach(function (el) {
      var host = el.closest('[data-glass]');
      var id = 0;
      if (host) { if (!host.__inkId) host.__inkId = Math.min(254, ++self._inkSeq); id = host.__inkId; }
      /* 读它本来的颜色和影子：先把我们写上去的透明撤掉再读 */
      el.style.color = ''; el.style.textShadow = '';
      var cs = getComputedStyle(el), shm = (cs.textShadow || '').match(SH);
      var font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + (parseFloat(cs.fontSize) * dpr).toFixed(2) + 'px ' + cs.fontFamily;
      x.save(); x.font = y.font = font; x.textAlign = y.textAlign = 'center'; x.textBaseline = y.textBaseline = 'middle';
      x.fillStyle = cs.color;
      if (shm) { x.shadowColor = shm[1]; x.shadowOffsetX = +shm[2] * dpr; x.shadowOffsetY = +shm[3] * dpr; x.shadowBlur = (+shm[4] || 0) * dpr; }
      y.fillStyle = y.strokeStyle = 'rgb(' + id + ',0,0)'; y.lineWidth = 2 * dpr;   // 编号图描粗一点，字的毛边也认得出是谁的
      var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), node;
      while ((node = tw.nextNode())) {
        var str = node.nodeValue, i = 0;
        while (i < str.length) {
          var n = str.codePointAt(i) > 0xffff ? 2 : 1;
          if (!/\s/.test(str[i])) {
            rg.setStart(node, i); rg.setEnd(node, i + n);
            var b = rg.getBoundingClientRect();
            if (b.width) {
              var ch = str.substr(i, n), px = (b.left + b.width / 2 - sr.left) * dpr, py = (b.top + b.height / 2 - sr.top) * dpr;
              x.fillText(ch, px, py); y.fillText(ch, px, py); y.strokeText(ch, px, py);
            }
          }
          i += n;
        }
      }
      x.restore();
      el.style.color = 'transparent'; el.style.textShadow = 'none'; el.setAttribute('data-inked', '');
    });
    var up = function (cv, premul, nearest, old) {
      var t = old || gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premul);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      var f = nearest ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this._inkTex = up(c, true, false, this._inkTex);
    this._inkOwnTex = up(o, false, true, this._inkOwnTex);
    this._inkGen = (this._inkGen || 0) + 1; this._fp = null;
  };

  /* 按下反馈在 pointerdown 时立即发生，不等 click（交互要即时响应） */
  LiquidStage.prototype._pressable = function (el) {
    var self = this;
    var at = function (e) { var st = self._state.get(el); if (st) { st.tx = e.clientX; st.ty = e.clientY; } };   // 手指在哪（给 bloom 的光用）
    var down = function (e) { at(e); self._state.get(el).press.to(1); };
    var up = function () { self._state.get(el).press.to(0); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', function (e) { if (self._state.get(el).press.t > 0) at(e); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { el.addEventListener(t, up); });
  };

  /* ── 可拖的玻璃：1:1 跟手、越界阻尼、松手按投影落点吸附、速度交接 ── */
  LiquidStage.prototype._bindDrag = function () {
    var self = this;
    var drag = null;
    this.addEventListener('pointerdown', function (e) {
      var el = e.target.closest ? e.target.closest('[data-drag]') : null;
      if (!el || !self._state.has(el)) return;
      el.setPointerCapture(e.pointerId);
      var st = self._state.get(el);
      drag = { el: el, st: st, px: e.clientX, py: e.clientY,
               ox: st.x.x, oy: st.y.x, hist: [], axis: el.getAttribute('data-drag') };
      st.press.to(1);
      el.setAttribute('data-dragging', '1');
      e.preventDefault();
    });
    this.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var st = drag.st, dx = e.clientX - drag.px, dy = e.clientY - drag.py;
      var nx = drag.ox + (drag.axis === 'y' ? 0 : dx);
      var ny = drag.oy + (drag.axis === 'x' ? 0 : dy);
      var lim = self._limits(drag.el);
      if (nx < lim.x0) nx = lim.x0 + rubber(nx - lim.x0, 120);
      if (nx > lim.x1) nx = lim.x1 + rubber(nx - lim.x1, 120);
      if (ny < lim.y0) ny = lim.y0 + rubber(ny - lim.y0, 120);
      if (ny > lim.y1) ny = lim.y1 + rubber(ny - lim.y1, 120);
      if (drag.axis !== 'y') st.x.set(nx);
      if (drag.axis !== 'x') st.y.set(ny);
      drag.hist.push({ t: performance.now(), x: st.x.x, y: st.y.x });
      if (drag.hist.length > 6) drag.hist.shift();
      if (drag.el.__onDrag) {
        /* 回调可以返回被约束那根轴的值（比如折线上的 y）。
           这里用 .to() 而非 .set()，珠子像被线牵着走，不会焊死在线上：
           拖快了会稍稍落到线外，再被拉回来，形成阻尼感。 */
        var lock = drag.el.__onDrag(st.x.x, st.y.x);
        if (typeof lock === 'number') st.y.to(lock);
      }
      e.preventDefault();
    });
    var end = function (e) {
      if (!drag) return;
      var st = drag.st, h = drag.hist;
      var vx = 0, vy = 0;
      if (h.length > 1) {
        var A = h[0], B = h[h.length - 1], dt = Math.max(1, B.t - A.t);
        vx = (B.x - A.x) / dt * 1000; vy = (B.y - A.y) / dt * 1000;
      }
      var el = drag.el;
      var tx = st.x.x + project(vx), ty = st.y.x + project(vy);
      var home = el.hasAttribute('data-home');
      var snap = el.__snap ? el.__snap(tx, ty, vx, vy)
               : home ? { x: 0, y: 0 } : { x: st.x.t, y: st.y.t };
      // 有动量才允许过冲：飞出去的东西该弹一下，淡入的东西不该
      var bouncy = Math.abs(vx) + Math.abs(vy) > 260;
      st.x.z = st.y.z = bouncy ? 0.78 : 1.0;
      st.x.v = vx; st.y.v = vy;
      st.x.to(snap.x); st.y.to(snap.y);
      st.press.to(0);
      el.removeAttribute('data-dragging');
      drag = null;
    };
    this.addEventListener('pointerup', end);
    this.addEventListener('pointercancel', end);
  };

  LiquidStage.prototype._limits = function (el) {
    var a = (el.getAttribute('data-bounds') || '').split(',').map(Number);
    if (a.length === 4) return { x0: a[0], x1: a[1], y0: a[2], y1: a[3] };
    return { x0: -1e5, x1: 1e5, y0: -1e5, y1: 1e5 };
  };

  LiquidStage.prototype._frame = function (dt) {
    var gl = this._gl, cv = this._cv;
    if (!gl || !this._pr || !this._tex || gl.isContextLost()) return;
    var r = this.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = this._dprCap || (this._dprCap = Math.min(2, window.devicePixelRatio || 1));
    /* 自动降级：帧时间偏高时把画布分辨率降一档，宁可画面略软，也要保证滑动流畅。
       只降不升，来回振荡比略软更难看。 */
    this._ema = this._ema == null ? dt : this._ema * 0.9 + dt * 0.1;
    if (this._ema > 0.026 && this._dprCap > 1.0) {
      this._dprCap = Math.max(1.0, this._dprCap - 0.25);
      this._ema = 0.016;
      console.warn('[liquid] 帧时间偏高，画布分辨率降到', this._dprCap);
    }
    var W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    if (this._inkDirty !== false || this._inkKey !== W + 'x' + H) this._ink(W, H, dpr, r);
    /* 先准备好模糊后的背景（一次性，bg-blur 没变就直接返回）。
       必须在读取 _texSize 之前调用：它会替换绑定的纹理及其尺寸，
       而 uBgOrigin / uBgSize / uTexPx 都由这个尺寸计算，顺序反了会有一帧坐标系错误。
       它内部会改动 viewport / program / attrib，所以放在下面两行之前。 */
    this._buildBlur();
    gl.viewport(0, 0, W, H);
    gl.useProgram(this._pr);

    var shapes = new Float32Array(MAX * 4), metas = new Float32Array(MAX * 4);
    var opts = new Float32Array(MAX * 4), n = 0;
    var touches = new Float32Array(MAX * 4);
    var inkIds = new Float32Array(MAX);
    var bloomAll = this.getAttribute('press') === 'bloom';
    var bevel = Math.max(0.5, Math.min(2, num(this, 'bevel', 1)));   // 斜面宽度倍率：1 = 原样（短边的 40%）
    var self = this;
    function push(cx, cy, hw, hh, rad, thick, tint, shadow, sdN, isFrost, bodyF, rimMul) {
      if (n >= MAX) return;
      shapes[n * 4] = cx; shapes[n * 4 + 1] = cy; shapes[n * 4 + 2] = hw; shapes[n * 4 + 3] = hh;
      metas[n * 4] = rad; metas[n * 4 + 1] = thick; metas[n * 4 + 2] = tint;
      metas[n * 4 + 3] = shadow == null ? 1 : shadow;      // 接地影强度（气泡给 0）
      opts[n * 4] = sdN; opts[n * 4 + 1] = isFrost;
      opts[n * 4 + 2] = bodyF || 0;                        // 整块微散射 data-blur
      opts[n * 4 + 3] = rimMul == null ? 1 : rimMul;
      n++;
    }
    var cands = [], midY = r.height / 2;
    /* 厚度倍率（thick-mul）：统一缩放所有玻璃的厚度 */
    var tmul = Math.max(0.2, Math.min(1.5, num(this, 'thick-mul', 1)));
    /* 接地影的总量（shadow），浅色玻璃应该调得更薄：同样的变暗幅度，
       在亮背景上看起来比在暗背景上重得多。一个参数统一控制所有玻璃。 */
    var shMul = Math.max(0, Math.min(2, num(this, 'shadow', 1)));
    this._hosts.forEach(function (el) {
      var st = self._state.get(el); if (!st) return;
      st.press.step(dt);
      if (st.x) { st.x.step(dt); st.y.step(dt);
        el.style.transform = 'translate(' + st.x.x.toFixed(2) + 'px,' + st.y.x.toFixed(2) + 'px)';
        /* 形变必须是同一个形状的连续参数。
           如果用额外的尾球表示拉长、再用硬阈值把它去掉，形状会突然缩小。
           这里只有一个形状，拉长量和膨胀量各由一根弹簧连续驱动，平滑地回到 0。 */
        st.sx.to(Math.min(0.34, Math.abs(st.x.v) / 2200));
        st.sy.to(Math.min(0.34, Math.abs(st.y.v) / 2200));
        var swell = parseFloat(el.getAttribute('data-swell'));
        if (isFinite(swell) && swell > 0) {
          var sp = Math.hypot(st.x.v, st.y.v);
          st.sw.to(swell * Math.min(1, sp / 700));
        }
      }
      st.sw.step(dt);
      st.sx.step(dt); st.sy.step(dt);
    });
    /* 分两阶段：上一轮只写（弹簧步进 + transform），这一轮只读（rect）。
       读写交替的循环每一圈都会强制一次布局，72 个宿主就是每帧 72 次，
       足以让页面失去响应，瓶颈并不在着色器。
       每帧只有一份预算：屏外、不在当前页、未渲染的宿主一律跳过。 */
    this._hosts.forEach(function (el) {
      var st = self._state.get(el); if (!st) return;
      /* 不在屏上的宿主连布局都不读：IntersectionObserver 异步给出结果，不会强制布局。
         closest 只遍历 DOM 和匹配选择器，不触发布局，可以放心用；
         offsetParent 每次读取都会强制布局，所以这里不用它。 */
      if (st.vis === false) return;
      /* data-nogl：仍然注册弹簧，但不由着色器绘制（它在 DOM 侧有自己的样式）。
         不绘制和不管理是两回事。 */
      if (el.hasAttribute('data-nogl')) return;
      var pg = el.closest ? el.closest('.page') : null;
      if (pg && !pg.classList.contains('on')) return;
      var sb = el.closest ? el.closest('.sub, .drawer, .sheet') : null;
      if (sb && !sb.classList.contains('on')) return;
      var b = el.getBoundingClientRect();
      if (b.width < 8 || b.height < 8) return;
      if (b.bottom < r.top - 40 || b.top > r.bottom + 40) return;
      cands.push({ el: el, st: st, b: b,
                   d: Math.abs(b.top - r.top + b.height / 2 - midY),
                   frost: el.hasAttribute('data-frost') });
    });
    /* 磨砂面优先（它们是底层结构，掉一块一眼就看得出），其余按离视口中心远近。 */
    cands.sort(function (a, b) { return (b.frost - a.frost) || (a.d - b.d); });
    cands.length = Math.min(cands.length, MAX);
    cands.forEach(function (c) {
      var el = c.el, st = c.st, b = c.b;
      var cx = (b.left - r.left + b.width / 2) * dpr;
      var cy = (b.top - r.top + b.height / 2) * dpr;
      var press = st.press.x;
      var sw = st.sw.x;
      /* 按下：旧的是缩一点；press="bloom"（或宿主 data-press="bloom"）是胀开一点，手指那里亮起来 */
      var bloom = bloomAll || el.getAttribute('data-press') === 'bloom';
      var pk = bloom ? -Math.min(0.06, 6 / Math.max(8, Math.min(b.width, b.height))) : 0.035;
      var hw = b.width / 2 * dpr * (1 + sw + st.sx.x - st.sy.x * 0.25 - press * pk);
      var hh = b.height / 2 * dpr * (1 + sw + st.sy.x - st.sx.x * 0.25 - press * pk);
      if (bloom && press > 0.001 && st.tx != null) {
        touches[n * 4] = (st.tx - r.left) * dpr; touches[n * 4 + 1] = (st.ty - r.top) * dpr; touches[n * 4 + 2] = press;
      }
      var rad = parseFloat(el.getAttribute('data-radius'));
      /* getComputedStyle 每帧每块跑一次 = 每帧强制样式重算。缓存它，只在换圆角/改尺寸时失效。 */
      if (!isFinite(rad)) {
        if (st.rad == null || st.radGen !== self._gen) {
          st.rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 18;
          st.radGen = self._gen;
        }
        rad = st.rad;
      }
      rad = Math.min(rad * dpr, Math.min(hw, hh));
      // 斜面带宽封顶在短边 30%（小控件上光学长度必须跟着缩，否则小按钮变鱼眼）
      /* 轮廓的圆（n=2）和高度场的厚度是两件事，别混在一起。
         如果把圆形的厚度铺满短边，整颗都是斜面、没有平的中心，就会变成鱼眼，
         中心也就无法和框外一样清楚、一样大。
         所以斜面带宽一律只占短边的一小段：平的部分不偏移，只有贴边在弯。 */
      var round = rad >= Math.min(hw, hh) * 0.96;
      var sdN = round ? 2 : 4;
      var thick = Math.min(Math.min(hw, hh) * Math.max(0.62, 0.40 * bevel + 0.02),
                           Math.max(7 * dpr, Math.min(hw, hh) * 0.40 * bevel)) * tmul;
      /* data-bevel="0.9"：这一块的斜面占短边多少（0.1–0.95）。铺满就没有平的中心，整块像一颗透镜，
         拿来做水珠正好；一般的卡片、按钮别用，中间会跟框外不一样大。 */
      /* bevel-max：斜面最宽多少 CSS 像素。按短边比例算，大卡片的斜面会宽到几十上百像素，扭曲一路伸进卡片里；
         苹果的玻璃不管多大，边上那圈差不多是固定宽度。0 = 不封顶（旧的样子） */
      var bmax = num(self, 'bevel-max', 0);
      if (bmax > 0) thick = Math.min(thick, bmax * dpr * tmul);
      var hb = parseFloat(el.getAttribute('data-bevel'));
      if (isFinite(hb) && hb > 0) thick = Math.min(hw, hh) * Math.max(0.1, Math.min(0.95, hb)) * tmul;
      var tint = (parseFloat(el.getAttribute('data-tint')) || 0) + press * 0.05;
      var frost = c.frost ? 1 : 0;
      /* 逐块参数：整块微散射（data-blur，如气泡带一点模糊），以及是否需要接地影（data-noshadow）。 */
      var bodyF = parseFloat(el.getAttribute('data-blur')) || 0;
      var shadow = el.hasAttribute('data-noshadow') ? 0 : shMul;
      /* data-clear：清玻璃珠，贴边散射降到很低。
         否则放大能看到一圈磨砂描边，一颗珠子应当只有一道边。 */
      var rimMul = el.hasAttribute('data-clear') ? 0.10 : 1;
      /* 每块玻璃都要有自己的编号（0 只留给贴在底上的字），不然底上的字会被当成「它自己的」原样盖上去、不弯 */
      if (!el.__inkId) el.__inkId = Math.min(254, (self._inkSeq = (self._inkSeq || 0) + 1));
      inkIds[n] = el.__inkId;
      push(cx, cy, hw, hh, rad, thick, tint, shadow, sdN, frost, bodyF, rimMul);
    });

    /* 没变化就不画。着色器里没有跟时间走的量（光的方向读的是 light 属性），
       送进去的东西跟上一帧一模一样时，画出来也一模一样：上一帧留在屏上，不再叫显卡整屏算一遍折射。
       上面那些照旧每帧跑（量位置、推弹簧），滚动、按下、换页那一帧位置一变就画。
       认「一样」的：画布尺寸、这一帧画几块、每块的形状和料、底图那一代、糊的那一档、贴图位置、画布上全部属性。
       保底：每 2 秒照画一次；切后台回来、上下文重建、换图都清掉记号。 */
    var fp = W + ',' + H + ',' + n + ',' + (this._texGen || 0) + ',' + this._blurKey + ',' + bgY(this) + ',' +
      Array.prototype.map.call(this.attributes, function (a) { return a.name + '=' + a.value; }).join(';') + ',' +
      Array.prototype.join.call(shapes.subarray(0, n * 4)) + ',' +
      Array.prototype.join.call(metas.subarray(0, n * 4)) + ',' +
      Array.prototype.join.call(opts.subarray(0, n * 4)) + ',' +
      Array.prototype.join.call(touches.subarray(0, n * 4)) + ',' +
      Array.prototype.join.call(inkIds.subarray(0, n)) + ',' + (this._inkGen || 0);
    var fpNow = performance.now();
    if (this._painted && fp === this._fp && fpNow - (this._fpAt || 0) < 2000) { this._idleN = (this._idleN || 0) + 1; return; }
    this._fp = fp; this._fpAt = fpNow; this._drawN = (this._drawN || 0) + 1;
    var L = this._loc;
    gl.uniform2f(L.uRes, W, H);
    var ts = this._texSize;
    var s = Math.max(W / ts[0], H / ts[1]);
    var dw = ts[0] * s, dh = ts[1] * s;
    gl.uniform2f(L.uBgOrigin, (W - dw) / 2, (H - dh) * bgY(this));
    gl.uniform2f(L.uBgSize, dw, dh);
    gl.uniform1f(L.uTexPx, dw / Math.max(1, ts[0]));   // 一个纹理像素 = 多少屏幕 px
    gl.uniform4fv(L.uShape, shapes);
    gl.uniform4fv(L.uMeta, metas);
    gl.uniform4fv(L.uOpt, opts);
    gl.uniform4fv(L.uTouch, touches);
    gl.uniform1f(L.uLobes, Math.max(0, Math.min(1, num(this, 'lobes', 0))));
    gl.uniform1f(L.uSat, num(this, 'saturate', 1));
    gl.uniform1f(L.uLift, num(this, 'lift', 0));
    gl.uniform1f(L.uDispPx, num(this, 'disp-px', 0));
    gl.uniform1f(L.uEdge, num(this, 'edge-adapt', 0));
    gl.uniform1f(L.uPhys, num(this, 'phys', 0));
    gl.uniform1f(L.uDpr, dpr);
    gl.uniform1f(L.uSoft, Math.max(0, Math.min(1, num(this, 'soft-corner', 0))));
    gl.uniform1f(L.uFrostLevel, num(this, 'frost-level', 0.42));
    gl.uniform1f(L.uFrostTint, num(this, 'frost-tint', 0.20));
    var ac = hex(this.getAttribute('accent') || '#b5533a');
    gl.uniform3f(L.uAccent, ac[0], ac[1], ac[2]);
    gl.uniform1i(L.uCount, n);
    gl.uniform1f(L.uMerge, (parseFloat(this.getAttribute('merge')) || 0) * dpr);
    var la = (parseFloat(this.getAttribute('light')) || 128) * Math.PI / 180;
    gl.uniform2f(L.uLight, Math.cos(la), Math.sin(la));
    gl.uniform1f(L.uIor, parseFloat(this.getAttribute('ior')) || 1.44);
    gl.uniform1f(L.uDisp, num(this, 'dispersion', 0.030));
    gl.uniform1f(L.uRefract, num(this, 'refract', 1.75));
    /* 三路采样中 Inner / Outer 两路的长度。设为 0 即退回只有 Face 一路，便于对照效果。 */
    gl.uniform1f(L.uRimIn, num(this, 'rim-in', 1.0));
    gl.uniform1f(L.uRimOut, num(this, 'rim-out', 0.65));
    /* 背景模糊是烘焙进纹理的真高斯模糊（见 _buildBlur，在本函数开头执行）。
       不再依赖 lod，因为 lod 走的是 mipmap 盒式降采样，会产生锯齿。
       背景和玻璃采样的是同一张模糊后的纹理，框内自然跟着框外变化，
       所以 uBgBlur 在这里设为 0（贴边散射和磨砂条仍然各自使用自己的 lod）。 */
    var maxLod = Math.log2(Math.max(ts[0], ts[1])) - 2.0;
    gl.uniform1f(L.uBgBlur, 0);
    gl.uniform1f(L.uFrostRim, num(this, 'frost-rim', 0.55));
    gl.uniform1f(L.uFrostBody, num(this, 'frost-body', 0.04));
    gl.uniform1f(L.uTint, num(this, 'tint', 0.05));
    gl.uniform1f(L.uSpec, num(this, 'specular', 1));
    gl.uniform1f(L.uMaxLod, maxLod);
    var dark = this.getAttribute('tone') === 'dark';
    gl.uniform3f(L.uTintCol, dark ? 0.10 : 1.0, dark ? 0.11 : 1.0, dark ? 0.14 : 1.0);
    /* 字那一层：没有 data-ink 时两个采样器都指 0 号（着色器里 uInkOn=0 根本不读） */
    var inkOn = !!(this._inkTex && this._inkOwnTex);
    gl.uniform1f(L.uInkOn, inkOn ? 1 : 0);
    gl.uniform1fv(L.uInkId, inkIds);
    if (inkOn) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this._inkTex);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this._inkOwnTex);
    }
    gl.uniform1i(L.uInk, inkOn ? 1 : 0); gl.uniform1i(L.uInkOwner, inkOn ? 2 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this._tex);
    gl.uniform1i(L.uBg, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    /* 成功绘制之后才把 data-liqgl 设为 1，通知外部。
       外部样式可能在玻璃模式下隐藏原有的壁纸层，WebGL 起不来时若没有这个标记，页面就会一片白。 */
    if (!this._painted) {
      this._painted = true;
      document.documentElement.setAttribute('data-liqgl', '1');
    }
  };

  /* 统一的数值属性读取。带连字符的属性（rim-in / frost-level / thick-mul / bg-blur）
     经过某些模板工具的 kebab→camelCase 转换后，落在 DOM 上会变成 rimin / frostlevel，
     于是 getAttribute('rim-in') 读不到，带连字符的参数都会退回默认值。
     这里在唯一的读取入口同时认三种写法：原名、去掉连字符、加 data- 前缀，调用处不必改名。 */
  function num(el, a, d) {
    var keys = [a, a.replace(/-/g, ''), 'data-' + a];
    for (var i = 0; i < keys.length; i++) {
      var v = parseFloat(el.getAttribute(keys[i]));
      if (isFinite(v)) return v;
    }
    return d;
  }
  function hex(s) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim());
    if (!m) return [0.71, 0.33, 0.23];
    var v = parseInt(m[1], 16);
    return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
  }
  function bgY(el) {
    var v = parseFloat(el.getAttribute('data-bg-y'));
    if (!isFinite(v)) v = parseFloat(el.getAttribute('bg-y'));
    return isFinite(v) ? v : 0.32;
  }
  /* 让圆角缓存失效（例如改了 --liq-r 或窗口尺寸变化后调用）*/
  LiquidStage.prototype.invalidate = function () { this._gen = (this._gen || 0) + 1; };
  LiquidStage.prototype.spring = function (el) { return this._state.get(el); };
  LiquidStage.prototype.setWallpaper = function (src) { this._loadWall(src); };

  if (!customElements.get('liquid-stage')) customElements.define('liquid-stage', LiquidStage);
  window.LiquidSpring = Spring;
  window.liquidProject = project;
})();
