rnd = mkRng(4711);   // 桌上的摆件也用自己的一串随机数：窗外和树怎么改，桌上都不跟着变
/* ── 桌上的东西 ──
   一张 1.65 米的长桌，分三块，挨着摆：
   左边“写字角”：墙上丝带留言板（挂历、便签、明信片），桌上一个小格架、电脑、本子和手机、笔筒；
   中间“读书喝茶”：台灯照下来，一块亚麻桌布，书压着书、摊开的书、眼镜、茶、托盘上的蜡烛、一封信；
   右边“窗边一角”：插着玉兰枝的瓶子、一摞书和小木盒、一盆绿植、便签和铅笔。
   窗台照参考图放两摞书、一把黄铜小壶、小枫、刚飞进来的纸飞机。有功能的东西混在里面，不单独摆 */
/* Blender 里细修过的模型（电脑、书柜、小格架）：加载好就换上，程序画的那一版先顶着、留作后备 */
/* 模型文件：先把 json 取回来，在内存里拼成 .glb 再解析（不再另外去取 data: 地址），失败了隔一会儿再试几次 */
const glbFromJson = js => {
  const uri = js.buffers[0].uri, bin0 = Uint8Array.from(atob(uri.slice(uri.indexOf(',') + 1)), c => c.charCodeAt(0)); delete js.buffers[0].uri;
  let jb = new TextEncoder().encode(JSON.stringify(js)); const jl = Math.ceil(jb.length / 4) * 4, bl = Math.ceil(bin0.length / 4) * 4;
  const out = new Uint8Array(12 + 8 + jl + 8 + bl), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true); out.fill(0x20, 20, 20 + jl); out.set(jb, 20);
  dv.setUint32(20 + jl, bl, true); dv.setUint32(24 + jl, 0x004E4942, true); out.set(bin0, 28 + jl);
  return out.buffer;
};
const loadGL = (url, onLoad, tries = 6) => fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(js => new Promise((res, rej) => new GLTFLoader().parse(glbFromJson(js), '', res, rej))).then(onLoad)
  .catch(() => { if (tries > 1) setTimeout(() => loadGL(url, onLoad, tries - 1), 900 * (7 - tries)); });
const swapIn = (url, group, mats, key) => loadGL(url, gl => {
  gl.scene.traverse(o => { if (o.isMesh){ const m = mats[o.material.name]; if (m) o.material = m; o.castShadow = o.receiveShadow = true; if (key) o.userData.key = key; } });
  group.add(gl.scene); (group.userData.old || []).forEach(o => o.visible = false);
});
const things = new THREE.Group(); scene.add(things);
const add = (obj, key) => { obj.traverse(o => { if (o.isMesh){ o.castShadow = !o.userData.noCast; o.receiveShadow = true; if (key) o.userData.key = key; } }); things.add(obj); return obj; };
const G = () => new THREE.Group();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const R_ = (m, x, y, z) => (m.rotation.set(x, y, z), m);
const at = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; return o; };
