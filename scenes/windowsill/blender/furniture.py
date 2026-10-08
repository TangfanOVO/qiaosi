# 赴约桌上的两件木家具（窗下的矮书柜、写字角的小格架）—— Blender 脚本建模
# 用法：blender -b -P blender/furniture.py -- bookcase models/bookcase.glb   （或 organizer）
# 单位和网页一致（1 = 10 厘米）。Blender 里 X = 宽，-Y = 朝前，Z = 上。木板四边倒小圆角，背板是一条条竖拼的木板
# 书（book_up / row）的函数还留着备用：布面封皮把书芯包住、书脊一侧是圆的。现在柜子里的书是网页里程序画的（书脊上有书名）
import bpy, bmesh, math, sys, random
args = sys.argv[sys.argv.index('--') + 1:]; WHICH, OUT = args[0], args[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
rnd = random.Random(7 if WHICH == 'bookcase' else 11)
MATS = {}
def mat(name, col=(.5, .5, .5), metal=0., rough=.6):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    MATS[name] = m; return m
def slab(name, w, d, h, m, loc, re=.018, eseg=2, rspine=0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co.x *= w; v.co.y *= d; v.co.z *= h
    if rspine:   # 书脊：朝前（-Y）那两条竖边倒大圆角
        bmesh.ops.bevel(bm, geom=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-6 and e.verts[0].co.y < 0], offset=rspine, segments=6, affect='EDGES', profile=.5)
    if re:
        bm.edges.ensure_lookup_table()
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=re, segments=eseg, affect='EDGES', profile=.5, clamp_overlap=True)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.location = loc
    me.materials.append(mat(m))
    for p in me.polygons: n = p.normal; p.use_smooth = max(abs(n.x), abs(n.y), abs(n.z)) < .999
    return o
def uv_box(o, s=.5):
    """简单的盒式 UV：按面朝向投影，木纹顺着长边走"""
    me = o.data; uvl = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        n = p.normal
        for li in p.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co + o.location
            if abs(n.z) > max(abs(n.x), abs(n.y)): uv = (v.x, v.y)
            elif abs(n.x) > abs(n.y): uv = (v.z, v.y)
            else: uv = (v.x, v.z)
            uvl.data[li].uv = (uv[0] * s, uv[1] * s)
ROOT = bpy.data.objects.new(WHICH, None); bpy.context.collection.objects.link(ROOT)
def P(o, uv=True):
    o.parent = ROOT
    if uv: uv_box(o)
    return o
COVERS = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']
for c in COVERS: mat(c)
mat('pages', (.8, .76, .68), 0, .9); mat('band', (.3, .1, .08), 0, .7); mat('gilt', (.6, .5, .3), .9, .35)
def book_up(x, z0, h, t, d, c, lean=0, y=0):
    """竖着放的一本书：x 是书在架子上的中心，z0 是底，lean 往右倒的角度"""
    piv = bpy.data.objects.new('bk', None); bpy.context.collection.objects.link(piv); piv.parent = ROOT
    piv.location = (x + (t / 2 if lean else 0), y, z0); piv.rotation_euler = (0, lean, 0)
    ox = -t / 2 if lean else 0
    cov = slab('cover', t, d, h, c, (ox, 0, h / 2), re=.006, eseg=1, rspine=t * .42); cov.parent = piv; uv_box(cov, 1.2)
    pg = slab('pages', t - .035, d - .05, h - .05, 'pages', (ox, .03, h / 2), re=.004, eseg=1); pg.parent = piv; uv_box(pg, 2)
    hb = slab('band', t * .7, .03, .025, 'band', (ox, -d / 2 + .02, h - .03), re=0); hb.parent = piv
    for zz in (h * .82, h * .18):
        g = slab('gilt', t * .62, .004, .018, 'gilt', (ox, -d / 2 - .003, zz), re=0); g.parent = piv
    return piv
def row(x0, x1, z0, hmin, hmax, d, y=0, lean_last=True):
    x = x0
    while True:
        t = rnd.uniform(.13, .24); h = rnd.uniform(hmin, hmax)
        if x + t > x1 - (.35 if lean_last else 0): break
        book_up(x + t / 2, z0, h, t, d, rnd.choice(COVERS), 0, y); x += t + .012
    if lean_last and x < x1 - .25:
        t = .2; h = hmax * .95; book_up(x + .02, z0, h, t, d, rnd.choice(COVERS), -.32, y)

mat('wood'); mat('back')
if WHICH == 'bookcase':
    # 矮书柜：顶板厚一点、四边往外探出一指、前沿倒大圆角；两侧板夹着两层隔板；右下是两只抽屉（铜圆钮）；底下退进去一截踢脚；背板是竖拼的木条
    # 书不在这里做了：网页里程序画（书脊上有书名），这样每本都不一样
    W, H, D, T = 3.0, 2.3, 1.0, .1
    P(slab('top', W + .12, D + .07, .13, 'wood', (0, -.035, H - .065), re=.035, eseg=3))
    for xx in (-W / 2 + T / 2, W / 2 - T / 2): P(slab('side', T, D, H - .13, 'wood', (xx, 0, (H - .13) / 2), re=.022, eseg=2))
    for zz in (.12, 1.12): P(slab('shelf', W - 2 * T + .004, D - .05, T, 'wood', (0, .025, zz), re=.018))
    P(slab('plinth', W - .34, D - .3, .08, 'back', (0, .08, .04), re=.01))
    n = 7; bw = (W - 2 * T) / n
    for i in range(n): P(slab('back', bw - .014, .04, H - .2, 'back', (-W / 2 + T + bw * (i + .5), D / 2 - .03, (H - .13) / 2 + .03), re=.006, eseg=1))
    # 右下：竖隔板 + 两只抽屉
    dx = .55; P(slab('div', .08, D - .08, .9, 'wood', (dx, .04, .62), re=.012))
    x0, x1 = dx + .04, W / 2 - T; fw = x1 - x0 - .03; fx = (x0 + x1) / 2
    for zc in (.395, .845):
        P(slab('drawer', fw, .06, .42, 'wood', (fx, -D / 2 + .05, zc), re=.016, eseg=2))
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=.05, radius2=.042, depth=.05)
        bmesh.ops.bevel(bm, geom=[e for e in bm.edges if e.verts[0].co.z > 0 and e.verts[1].co.z > 0], offset=.012, segments=3, affect='EDGES', profile=.5)
        me = bpy.data.meshes.new('knob'); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new('knob', me); bpy.context.collection.objects.link(o)
        o.location = (fx, -D / 2 + .02 - .025, zc); o.rotation_euler = (math.pi / 2, 0, 0); me.materials.append(mat('gilt'))
        for p in me.polygons: p.use_smooth = True
        o.parent = ROOT
        # 抽屉面上一圈细细的缝：比面板深一点的凹线（用一圈薄框表示）
else:
    W, H, D, T = 3.5, 2.8, .95, .1
    for zz in (T / 2, 1.42, H - T / 2): P(slab('shelf', W, D, T, 'wood', (0, 0, zz)))
    for xx in (-W / 2 + T / 2, W / 2 - T / 2): P(slab('side', T, D, H, 'wood', (xx, 0, H / 2)))
    P(slab('div', T, D, 1.32, 'wood', (-.35, 0, .76))); P(slab('div', T, D, 1.28, 'wood', (.75, 0, 2.06)))
    n = 8; bw = (W - 2 * T) / n
    for i in range(n): P(slab('back', bw - .012, .04, H - .1, 'back', (-W / 2 + T + bw * (i + .5), D / 2 - .03, H / 2), re=.006, eseg=1))
    # 书不在这里做了：网页里程序画（书脊上有书名）
bpy.ops.wm.save_as_mainfile(filepath=OUT.replace('.glb', '.blend'))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True)
print('faces', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
