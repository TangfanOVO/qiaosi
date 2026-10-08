/* ── 窗外：两边垂下来的柳条 ──
   海景房最要紧的是看海：窗口正中留给海和天；左右两边是从高处垂下来的柳条，像一挂拉开的珠帘——不画树干，只看得见一根根细长的柳条和叶子。
   靠中间的短、靠外的长，下沿是一道弧；风一吹整片柳条一起晃，离挂的地方越远晃得越多。
   四季：春天嫩黄绿、挂着毛茸茸的柳絮穗子，柳絮往下飘；夏天深绿；秋天转黄、掉一半；冬天只剩金黄的光柳条和雪。
   （垂柳本来就爱长在水边，也耐一些盐碱，滨海的公园和河口常种） */
const WL = (() => {
  const wr = mkRng(9001), R = (a, b) => a + wr() * (b - a);
  const STR = [];   // 每根柳条：一条往下垂的曲线（不是直的：中间带一点点弯）
  for (const s of [-1, 1]) for (let i = 0; i < 60; i++){
    const z = R(-30, -10.5), inner = 5 + s * (.12 * (1.8 - z) + .5);
    const out = Math.pow(wr(), 1.25), x = inner + s * out * 13;
    const top = R(20, 27), end = (1 - out) * R(1.5, 6) + out * R(-14, -4);   // 靠中间的收得高、靠外的垂得低：下沿是一道弧
    const sw = s * R(.2, 1.1), dz = R(-.8, .8), pts = [];
    for (let k = 0; k <= 5; k++){ const f = k / 5, j = k && k < 5 ? 1 : 0; pts.push(V3(x + sw * Math.pow(f, .85) + j * R(-.16, .16), top - (top - end) * f, z + dz * f + j * R(-.14, .14))); }
    STR.push({pts, ph: R(0, 6.3), top, end});
  }
  /* 几何：柳条是很细的管子，主条上再分出几根短的小枝，也一样垂着；
     叶子是窄长的柳叶（长是宽的六七倍，中间一道折，尖往下弯、微微侧弯），按 2/5 叶序一圈圈错开长，叶尖顺着枝往下斜 */
  const twigG = [], leafM4 = [], leafW = [], leafU = [], catM4 = [], catW = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), tw = new THREE.Quaternion(), sc = new THREE.Vector3();
  const b1 = new THREE.Vector3(), b2 = new THREE.Vector3(), side = new THREE.Vector3();
  const addTube = (cv, r0, r1, ph, top) => {
    const L = cv.getLength(), TS = Math.max(4, Math.round(L / .7)), RS = 3, g = new THREE.TubeGeometry(cv, TS, 1, RS, false), p = g.attributes.position, n = g.attributes.normal, w = [];
    for (let i = 0; i < p.count; i++){ const u = Math.floor(i / (RS + 1)) / TS, c = cv.getPoint(u), r = r0 + (r1 - r0) * u; p.setXYZ(i, c.x + n.getX(i) * r, c.y + n.getY(i) * r, c.z + n.getZ(i) * r); w.push(Math.max(0, top - c.y), ph); }
    g.deleteAttribute('uv'); g.setAttribute('aW', new THREE.Float32BufferAttribute(w, 2)); g.computeVertexNormals(); twigG.push(g);
  };
  const addLeaves = (cv, st, gap, sMul, catP) => {
    const L = cv.getLength(), N = Math.floor(L / gap), a0 = wr() * 6.3, span = st.top - st.end;
    for (let k = 1; k <= N; k++){
      const u = k / (N + 1) + R(-.004, .004), p = cv.getPoint(u), t = cv.getTangent(u);
      if (wr() < .06) continue;                                                        // 偶尔空一节
      b1.crossVectors(t, Math.abs(t.x) < .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)).normalize(); b2.crossVectors(t, b1);
      const an = a0 + k * 2.513 + R(-.25, .25); side.copy(b1).multiplyScalar(Math.cos(an)).addScaledVector(b2, Math.sin(an));   // 2/5 叶序
      const dir = t.clone().multiplyScalar(.78).addScaledVector(side, R(.42, .82)).normalize();
      q.setFromUnitVectors(UP, dir).multiply(tw.setFromAxisAngle(UP, R(-.7, .7)));
      const hu = Math.min(1, Math.max(0, (st.top - p.y) / span));                     // 在整根柳条上的位置：0 顶上 1 梢头
      const s0 = R(.78, 1.16) * (1 - .38 * Math.pow(hu, 2.4)) * sMul;                 // 梢头的叶子嫩、小
      m4.compose(p.clone().addScaledVector(side, .015), q, sc.set(s0, s0, s0)); leafM4.push(m4.clone()); leafW.push(Math.max(0, st.top - p.y), st.ph); leafU.push(hu);
      if (wr() < catP){ q.setFromUnitVectors(UP, t.clone().negate().addScaledVector(side, .5).normalize()); m4.compose(p, q, sc.setScalar(R(.8, 1.1))); catM4.push(m4.clone()); catW.push(Math.max(0, st.top - p.y), st.ph); }
    }
  };
  for (const st of STR){
    const cv = new THREE.CatmullRomCurve3(st.pts, false, 'centripetal'), top = st.top;
    addTube(cv, .034, .013, st.ph, top);
    addLeaves(cv, st, .17, 1, .08);
    // 小枝：从主条上分出来，先往外斜一点点，很快又顺着重力垂下去
    const nb = 2 + Math.floor(wr() * 4);
    for (let b = 0; b < nb; b++){
      const u0 = R(.18, .82), p0 = cv.getPoint(u0), t0 = cv.getTangent(u0), len = R(1.4, 4.6) * (1 - .45 * u0);
      const sa = wr() * 6.3, sx = Math.cos(sa), sz = Math.sin(sa), o = R(.22, .5);
      const bp = [p0, V3(p0.x + sx * o * .55 + t0.x * .25, p0.y - len * .22, p0.z + sz * o * .55 + t0.z * .25), V3(p0.x + sx * o * .9, p0.y - len * .6, p0.z + sz * o * .9), V3(p0.x + sx * o + R(-.08, .08), p0.y - len, p0.z + sz * o + R(-.08, .08))];
      const bc = new THREE.CatmullRomCurve3(bp, false, 'centripetal');
      addTube(bc, .016, .008, st.ph, top);
      addLeaves(bc, st, .16, .88, .05);
      tips.push({p: bp[3].clone(), d: new THREE.Vector3(0, -1, 0)});
    }
  }
  /* 风：每个点离挂着的地方往下多远（aW.x）决定它晃多少；整片柳条的晃动带着一点相位差，像一阵风从一边吹过去。
     每片叶子自己还会抖（绕着叶柄小幅地翻），风越大抖得越快越厉害 */
  const wind = (m, key, leaf) => {
    m.onBeforeCompile = sh => {
      sh.uniforms.uT = WIND.uT; sh.uniforms.uAmp = WIND.uAmp; sh.uniforms.uLean = WIND.uLean;
      if (leaf){ sh.uniforms.uSunD = SEA.uSun; sh.uniforms.uSunC = SEA.uSunCol; sh.uniforms.uLightK = SEA.uLight; }
      sh.vertexShader = 'uniform float uT, uAmp, uLean;\nattribute vec2 aW;\n' + (leaf === 2 ? 'varying vec2 vLu;\n' : '') + sh.vertexShader.replace('#include <project_vertex>', `
        vec3 tr = transformed;
        ${leaf ? `float fl = sin(uT * 4.3 + float(gl_InstanceID) * 1.37) * .6 + sin(uT * 7.9 + float(gl_InstanceID) * .71) * .4;
        fl *= .1 + uAmp * .9;
        tr.z += fl * tr.y * .45; tr.x += fl * tr.y * .18;` : ''}
        ${leaf === 2 ? 'vLu = uv;' : ''}
        vec4 wp = vec4(tr, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
        #endif
        wp = modelMatrix * wp;
        float hgt = aW.x, ph = aW.y, k = pow(hgt / 18., 1.5) * uAmp / .16;
        /* 风是一整阵吹过来的：所有柳条朝同一个方向摆、快慢差不多（从右往左扫过去，有一点点先后）；
           越往下的柳梢越慢半拍，像甩鞭子；每根自己只多一点点小抖动 */
        float tt = uT - wp.x * .035 - hgt * .045;
        float gust = sin(tt * .9) * .62 + sin(tt * 1.53 + 1.1) * .28 + sin(tt * 2.9 + .4) * .1;
        float own = sin(uT * 2.2 + ph + hgt * .3) * .14 + sin(uT * 3.7 + ph * 1.7) * .05;
        float push = k * (.3 + .85 * gust);
        wp.x += -.8 * push * 1.5 + k * own;
        wp.z += .6 * push * 1.5 + k * own * .3;
        wp.y += k * .1 * gust * gust - k * .05;
        float lean = pow(hgt / 18., 1.4) * uLean * (.8 + .2 * sin(uT * .5 + ph));
        wp.x -= lean * 2.2; wp.z += lean * 3.2; wp.y += lean * lean * .25;   // 被风压向屋里那一侧，柳梢翘起来一点
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`);
      if (leaf === 2) sh.fragmentShader = 'varying vec2 vLu;\nuniform vec3 uSunD, uSunC; uniform float uLightK;\n' + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          float lumL = dot(diffuseColor.rgb, vec3(.3, .59, .11));
          diffuseColor.rgb *= 1. + .28 * (1. - smoothstep(.0, .07, abs(vLu.x - .5))) * smoothstep(.97, .55, vLu.y);   /* 中间一道浅色的叶脉 */
          diffuseColor.rgb *= .88 + .12 * (1. - abs(vLu.x - .5) * 2.);
          if (!gl_FrontFacing) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lumL) * vec3(.98, 1.1, 1.02) + .07, .55);   /* 叶背：灰白绿，带一层粉 */`)
        .replace('#include <opaque_fragment>', `
          vec3 Lv = normalize((viewMatrix * vec4(uSunD, 0.)).xyz);
          float thru = pow(max(dot(normalize(-vViewPosition), Lv), 0.), 4.) * .85 + .1;   /* 逆着光看：叶子透亮，发黄绿 */
          outgoingLight += diffuseColor.rgb * vec3(1., 1.06, .62) * uSunC * thru * .55 * uLightK;
          #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'willow3' + key; return m;
  };
  const twigM = wind(new THREE.MeshStandardMaterial({color: '#7c7a44', roughness: .75}), 'tw');
  const twigs = new THREE.Mesh(mergeGeometries(twigG), twigM); twigs.castShadow = true; twigs.customDepthMaterial = wind(new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking}), 'twd'); twigs.frustumCulled = false; scene.add(twigs);
  // 柳叶：窄长披针形，最宽处在下三分之一；中间一道折，尖往下弯，整片微微往一边弯
  const lg = new THREE.PlaneGeometry(1, 1, 2, 7), lp = lg.attributes.position;
  for (let i = 0; i < lp.count; i++){ const u = lp.getX(i) * 2, v = lp.getY(i) + .5, w = .062 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(v, .68))), .85); lp.setXYZ(i, u * w + .035 * v * v, v * .8, Math.abs(u) * w * .4 - v * v * .1); }
  lg.computeVertexNormals();
  // 打乱顺序：秋天掉一半叶子时是随机掉，不是整根整根地掉
  const ord = leafM4.map((_, i) => i).sort(() => wr() - .5);
  const leaves = new THREE.InstancedMesh(lg, wind(new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .5, side: THREE.DoubleSide}), 'lf', 2), ord.length);
  const lw = new Float32Array(ord.length * 2), uPos = new Float32Array(ord.length);
  ord.forEach((j, i) => { leaves.setMatrixAt(i, leafM4[j]); lw[i * 2] = leafW[j * 2]; lw[i * 2 + 1] = leafW[j * 2 + 1]; uPos[i] = leafU[j]; leaves.setColorAt(i, new THREE.Color()); });
  lg.setAttribute('aW', new THREE.InstancedBufferAttribute(lw, 2));
  leaves.castShadow = true; leaves.receiveShadow = true; leaves.frustumCulled = false; leaves.customDepthMaterial = wind(new THREE.MeshDepthMaterial({depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide}), 'lfd', 1); scene.add(leaves);
  // 春天的柳絮穗子：短短一截毛茸茸的嫩黄
  const cg = new THREE.CapsuleGeometry(.035, .22, 3, 6); cg.translate(0, .14, 0);
  const cats = new THREE.InstancedMesh(cg, wind(new THREE.MeshStandardMaterial({color: '#d8d49a', roughness: 1, emissive: new THREE.Color('#3a3a20'), emissiveIntensity: .3}), 'ct'), catM4.length);
  catM4.forEach((m, i) => cats.setMatrixAt(i, m)); cg.setAttribute('aW', new THREE.InstancedBufferAttribute(new Float32Array(catW), 2)); cats.frustumCulled = false; scene.add(cats);
  // 掉东西从哪儿开始：柳条下半截上的点
  for (const st of STR){ const cv = new THREE.CatmullRomCurve3(st.pts); for (const u of [.5, .7, .9]){ const p = cv.getPoint(u); tips.push({p, d: cv.getTangent(u)}); } }
  const seed = Array.from({length: ord.length}, () => wr());
  return {leaves, cats, twigM, seed, uPos, n: ord.length};
})();

