/* ── 往下掉的东西：柳叶（春夏零星几片，秋天一阵一阵），春天还有柳絮。
   窗是开着的：风一大，叶子和柳絮就从窗口飘进来，落在窗台和桌上，躺一会儿再不见 ── */
const fluffTex = tex(64, 64, (x, w, h) => {   // 柳絮：一粒小小的种子，四面散开一圈极细的白毛，很轻、几乎透明
  x.clearRect(0, 0, w, h); const g = x.createRadialGradient(32, 32, 0, 32, 32, 9); g.addColorStop(0, 'rgba(255,253,246,.75)'); g.addColorStop(1, 'rgba(255,252,244,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.lineCap = 'round'; for (let i = 0; i < 40; i++){ const a = i / 40 * 6.3 + Math.sin(i * 7.1) * .4, L = 14 + (i * 37 % 15); x.strokeStyle = `rgba(255,253,248,${.25 + (i * 13 % 7) / 20})`; x.lineWidth = .6; x.beginPath(); x.moveTo(32, 32); x.quadraticCurveTo(32 + Math.cos(a + .35) * L * .55, 32 + Math.sin(a + .35) * L * .55, 32 + Math.cos(a) * L, 32 + Math.sin(a) * L); x.stroke(); }
  x.fillStyle = 'rgba(214,200,160,.9)'; x.beginPath(); x.ellipse(32, 32, 1.6, 2.6, .5, 0, 7); x.fill(); });
const fallFluff = new THREE.InstancedMesh(new THREE.PlaneGeometry(.19, .19), new THREE.MeshBasicMaterial({map: fluffTex, color: '#ffffff', transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false}), 140);
const fallLeafGeo = WL.leaves.geometry.clone(); fallLeafGeo.deleteAttribute('aW');
const fallLeaf = new THREE.InstancedMesh(fallLeafGeo, new THREE.MeshStandardMaterial({color: '#ffffff', roughness: .6, side: THREE.DoubleSide}), 200);
fallFluff.layers.set(1);
for (const f of [fallFluff, fallLeaf]){ f.castShadow = f === fallLeaf; f.receiveShadow = true; f.frustumCulled = false; f.count = 0; scene.add(f); }
const FALL = (() => {
  const mk = (mesh, N, fluff) => ({mesh, N, fluff, P: new Float32Array(N * 3), A: new Float32Array(N * 3), S: new Float32Array(N * 3), rest: new Float32Array(N), on: new Uint8Array(N), ph: new Float32Array(N), rate: 0, acc: 0});
  const K = [mk(fallLeaf, 200, false), mk(fallFluff, 140, true)];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const inWin = (x, y) => x > WIN.x0 + .1 && x < WIN.x1 - .1 && y > WIN.y0 && y < WIN.y1;
  const leafColor = i => { const r = (i * 0.6180339) % 1;
    if (season === 'autumn') c.setHSL(.1 + r * .05, .62, .45 + r * .1); else if (season === 'summer') c.setHSL(.24 + r * .05, .4, .3 + r * .06); else c.setHSL(.19 + r * .05, .55, .48 + r * .08);
    if (r < .3 && season !== 'winter') c.lerp(new THREE.Color('#a88a3e'), .5);   // 掉下来的多半是有点黄了的
    return c; };
  const spawn = (k, i) => {
    const t = tips[(rnd() * tips.length) | 0];
    k.P[i * 3] = t.p.x + (rnd() - .5); k.P[i * 3 + 1] = t.p.y + rnd() * .5; k.P[i * 3 + 2] = t.p.z + (rnd() - .5);
    for (let j = 0; j < 3; j++){ k.A[i * 3 + j] = rnd() * 6.3; k.S[i * 3 + j] = (rnd() - .5) * (k.fluff ? 1.2 : 3.4); }
    k.rest[i] = 0; k.on[i] = 1; k.ph[i] = rnd() * 6.3;
    if (!k.fluff) k.mesh.setColorAt(i, leafColor(i));
  };
  return {
    reset(){
      for (const k of K){ k.on.fill(0); k.mesh.count = 0; k.acc = 0; }
      K[0].rate = {spring: .8, summer: .9, autumn: 3.2, winter: 0}[season];   // 柳叶
      K[1].rate = season === 'spring' ? 3.2 : 0;                                  // 柳絮
    },
    step(dt, t){
      const wind = WX.windS, drift = (.25 + 1.9 * wind) * (.75 + .35 * gustAt(5));
      for (const k of K){
        if (!k.rate && !k.on.some(x => x)) { k.mesh.count = 0; continue; }
        k.acc = Math.min(k.acc + dt * k.rate * (.5 + wind * 1.6) * (1 - .6 * WX.rainS), 2);   // 风大掉得多；下大雨时柳絮飞不起来
        for (let i = 0; i < k.N && k.acc >= 1; i++) if (!k.on[i]){ spawn(k, i); k.acc -= 1; }
        let cnt = 0;
        for (let i = 0; i < k.N; i++){
          if (!k.on[i]) continue;
          let x = k.P[i * 3], y = k.P[i * 3 + 1], z = k.P[i * 3 + 2];
          if (k.rest[i] > 0){ k.rest[i] -= dt; if (k.rest[i] <= 0) k.on[i] = 0; }
          else {
            const inside = z > GLASS_Z, w = inside ? .45 : 1, ph = k.ph[i];
            const vx = (-(.25 + .2 * Math.sin(t * .31 + ph)) * drift + (k.fluff ? .25 : .45) * Math.sin(t * 1.7 + ph * 3)) * w;
            const vz = (.65 + .35 * Math.sin(t * .23 + ph)) * drift * w;
            const vy = k.fluff ? -.28 + .3 * Math.sin(t * 1.3 + ph * 5) : -1.5 + .55 * Math.sin(t * 2.1 + ph * 5) - .3 * wind;
            let nx = x + vx * dt, ny = y + vy * dt, nz = z + vz * dt;
            if (!inside && nz >= GLASS_Z && !inWin(nx, ny)){ nz = GLASS_Z - .05; }   // 撞在墙上：贴着墙往下滑
            for (let j = 0; j < 3; j++) k.A[i * 3 + j] += k.S[i * 3 + j] * dt;
            const land = h => { ny = h; k.rest[i] = 16 + rnd() * 12; k.A[i * 3] = -Math.PI / 2 + (rnd() - .5) * .3; k.A[i * 3 + 2] = (rnd() - .5) * .3; k.S[i * 3] = k.S[i * 3 + 1] = k.S[i * 3 + 2] = 0; };
            if (nz > GLASS_Z){
              if (nz < WALL_Z + .45 && ny < SILL_Y + .03) land(SILL_Y + .03);                                   // 窗台
              else if (nz > WALL_Z + .45 && nz < 4.3 && ny < .03 && nx > -5.4 && nx < 12.2) land(.03);           // 桌上
              else if (ny < -6 || nz > 12) k.on[i] = 0;
              if (nz > WALL_Z + .45 && ny < SILL_Y && ny > 0 && z <= WALL_Z + .45) nz = WALL_Z + .46;
            } else if (ny < GROUND_Y + .05){ land(GROUND_Y + .05); k.rest[i] = 5 + rnd() * 4; }   // 落在沙滩上的很快就看不清了
            x = nx; y = ny; z = nz; k.P[i * 3] = x; k.P[i * 3 + 1] = y; k.P[i * 3 + 2] = z;
          }
          const fade = k.rest[i] > 0 ? Math.min(1, k.rest[i] / 3) : 1;
          e.set(k.A[i * 3], k.A[i * 3 + 1], k.A[i * 3 + 2]); q.setFromEuler(e);
          m.compose(v.set(x, y, z), q, s.setScalar((k.fluff ? .8 + .5 * ((i * .618) % 1) : 1.2) * fade)); k.mesh.setMatrixAt(i, m); cnt = i + 1;
        }
        k.mesh.count = cnt; k.mesh.instanceMatrix.needsUpdate = true; if (!k.fluff && k.mesh.instanceColor) k.mesh.instanceColor.needsUpdate = true;
      }
    }
  };
})();

