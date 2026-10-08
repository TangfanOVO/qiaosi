/* ── 窗外的海鸥：隔一阵飞过来两三只。不走直线：每只沿着一条弯弯的路飞——进来、往下一沉又拉起来、有时候绕一个圈、再从另一边出去；
   转弯时身子往弯里侧倾，往上爬的时候扇翅膀，平飞和往下滑的时候张着翅膀滑翔，翅尖跟着气流轻轻抖。夜里、雨雪大的时候不飞 ── */
const LIFE = (() => {
  const lr = mkRng(6262), R = (a, b) => a + lr() * (b - a);
  const gullM = new THREE.MeshStandardMaterial({color: '#ffffff', vertexColors: true, roughness: .7, side: THREE.DoubleSide});
  const wingG = (s) => { const g = new THREE.BufferGeometry(), P = [0, 0, -.9, s * 3.2, .25, -.6, 0, 0, .9, s * 3.2, .25, -.6, s * 3.2, .25, .5, 0, 0, .9], C = []; for (let i = 0; i < 6; i++) C.push(.95, .95, .96); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); return g; };
  const tipG = (s) => { const g = new THREE.BufferGeometry(), P = [0, 0, -.6, s * 3, -.2, -1.1, 0, 0, .5], C = [.7, .72, .74, .12, .12, .13, .7, .72, .74]; g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); return g; };
  const gulls = [];
  for (let i = 0; i < 3; i++){
    const b = G(), bgeo = new THREE.CapsuleGeometry(.42, 2.2, 3, 8); bgeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(bgeo.attributes.position.count * 3).fill(.94), 3)); const body = mesh(bgeo, gullM); body.rotation.x = Math.PI / 2; b.add(body);
    const tail = new THREE.Mesh(tipG(1), gullM); tail.scale.set(.25, 1, .9); tail.rotation.y = Math.PI / 2; tail.position.z = -1.4; b.add(tail);
    const wings = [];
    for (const s of [-1, 1]){ const w = G(), inner = new THREE.Mesh(wingG(s), gullM), tp = G(); tp.position.set(s * 3.2, .25, 0); tp.add(new THREE.Mesh(tipG(s), gullM)); w.add(inner, tp); b.add(w); wings.push([w, tp, s]); }
    b.visible = false; scene.add(b); gulls.push({b, wings, ph: R(0, 6), curve: null, u: 1, sp: 10, roll: 0, flap: 0, tan: new THREE.Vector3(0, 0, 1)});
  }
  const flock = {t: -R(5, 12), dur: 0, wait: 0};
  const start = () => {
    const dir = lr() < .5 ? 1 : -1, y0 = GROUND_Y + R(16, 30), z0 = R(-270, -170), loop = lr() < .45, lx = R(-30, 40), n = 2 + (lr() < .7 ? 1 : 0);
    gulls.forEach((g, i) => {
      if (i >= n){ g.u = 1; return; }
      const o = [R(-10, 10), R(-4, 4), R(-18, 18)], P = [V3(-150 * dir, y0 + R(4, 12), z0 + o[2] - 40)];
      P.push(V3(-70 * dir + o[0], y0 + o[1] + R(-2, 6), z0 + o[2] + R(-20, 20)));
      if (loop){ const cx = lx + o[0] * .5, cz = z0 + o[2], r = R(22, 34); for (let a = 0; a < 5; a++){ const an = -Math.PI / 2 * dir + a * Math.PI * .5 * dir; P.push(V3(cx + Math.sin(an) * r * dir, y0 + o[1] - 5 * Math.sin(a * 1.3), cz + Math.cos(an) * r)); } }   // 绕一个圈，圈里低一点
      else P.push(V3(lx + o[0], y0 + o[1] - R(6, 11), z0 + o[2] + R(-25, 25)));   // 往下一沉
      P.push(V3(70 * dir + o[0], y0 + o[1] + R(2, 10), z0 + o[2] + R(-30, 30)), V3(150 * dir, y0 + R(8, 18), z0 + o[2] + R(-40, 10)));
      g.curve = new THREE.CatmullRomCurve3(P, false, 'centripetal'); g.len = g.curve.getLength(); g.u = -i * R(.02, .05); g.sp = R(10, 13); g.curve.getTangentAt(0, g.tan);
    });
    flock.dur = 1; flock.t = 0; flock.wait = R(10, 30);
  };
  const p = new THREE.Vector3(), tg = new THREE.Vector3(), up = new THREE.Vector3();
  return {
    step(dt, t){
      const away = cur.dark > .6 || WX.rainS > .35 || WX.snowS > .35 || WX.thunS > .3;
      flock.t += dt;
      let flying = false;
      for (const g of gulls){
        if (!g.curve || g.u >= 1){ g.b.visible = false; continue; }
        flying = true;
        g.u += dt * g.sp / g.len; if (g.u < 0){ g.b.visible = false; continue; }
        const u = Math.min(1, g.u); g.curve.getPointAt(u, p); g.curve.getTangentAt(u, tg);
        const turn = (g.tan.x * tg.z - g.tan.z * tg.x) / Math.max(dt, 1e-3);   // 往哪边拐、拐得多急
        g.tan.copy(tg); g.roll += (Math.max(-.7, Math.min(.7, -turn * 2.2)) - g.roll) * Math.min(1, dt * 3);
        g.sp += ((tg.y > .05 ? 9 : tg.y < -.05 ? 14 : 11.5) - g.sp) * Math.min(1, dt * .8);   // 往下滑快、往上爬慢
        const b = g.b; b.visible = !away; b.position.copy(p); b.lookAt(up.copy(p).add(tg)); b.rotateZ(g.roll);
        const climb = tg.y > .03 || Math.sin(t * .4 + g.ph * 3) > .55;   // 往上爬、或者隔一阵扇几下
        g.flap += ((climb ? 1 : 0) - g.flap) * Math.min(1, dt * 2.5);
        const a = g.flap * .6 * Math.sin(t * 7.2 + g.ph) + (1 - g.flap) * (.16 + .03 * Math.sin(t * 2.3 + g.ph)) + .05;
        for (const [w, tp, s] of g.wings){ w.rotation.z = s * a; tp.rotation.z = -s * (g.flap * .35 * Math.sin(t * 7.2 + g.ph - .9) + (1 - g.flap) * (.1 + .04 * Math.sin(t * 3.1 + g.ph))); }
      }
      if (flying) flock.t = 0; else if (flock.t > flock.wait) start();   // 这一群飞走以后隔一阵，再来下一群
    }
  };
})();

