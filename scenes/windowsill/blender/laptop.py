# 赴约桌上的笔记本电脑（深空灰）—— Blender 脚本建模，单位和网页一致（1 = 10 厘米）
# Blender 里：X = 宽，-Y = 朝前（导出 glTF 后是 three 的 +Z），Z = 上
# 用法：blender -b -P blender/laptop.py -- models/laptop.glb
import bpy, bmesh, math, sys
OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}
def mat(name, col, metal=0., rough=.5):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    MATS[name] = m; return m
for k, v in {'alu': ((.07, .068, .066), .8, .35), 'key': ((.015, .015, .014), 0, .6), 'well': ((.03, .03, .03), .3, .5), 'pad': ((.075, .072, .07), .6, .22),
             'bezel': ((.005, .005, .006), 0, .08), 'screen': ((.02, .03, .03), 0, .2), 'hinge': ((.04, .04, .04), .7, .4), 'foot': ((.02, .02, .02), 0, .9)}.items(): mat(k, *v)

def slab(name, w, d, h, rc, re, m, loc=(0, 0, 0), seg=10, eseg=3):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts: v.co.x *= w; v.co.y *= d; v.co.z *= h
    if rc: bmesh.ops.bevel(bm, geom=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-6], offset=rc, segments=seg, affect='EDGES', profile=.5)
    if re:
        bm.edges.ensure_lookup_table()
        bmesh.ops.bevel(bm, geom=[e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6 and abs(abs(e.verts[0].co.z) - h / 2) < 1e-6], offset=re, segments=eseg, affect='EDGES', profile=.5)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o); o.location = loc
    me.materials.append(MATS[m])
    for p in me.polygons: n = p.normal; p.use_smooth = max(abs(n.x), abs(n.y), abs(n.z)) < .999
    return o

W, D, H = 3.0, 2.1, .095
root = bpy.data.objects.new('laptop', None); bpy.context.collection.objects.link(root)
base = slab('base', W, D, H, .14, .03, 'alu', (0, 0, H / 2)); base.parent = root
# 底面往里收一点：四颗小脚垫
for x in (-1.25, 1.25):
    for y in (-.8, .8): f = slab('foot', .22, .22, .012, .1, 0, 'foot', (x, y, -.004)); f.parent = root
# 键盘区：一块略深的凹槽底 + 一颗颗带倒角的键帽
KW = 2.66; well = slab('well', KW + .08, 1.18, .004, .04, 0, 'well', (0, .38, H + .001)); well.parent = root
u = KW / 14.5
rows = [([1] * 14 + [.5], .55), ([1] * 13 + [1.5], 1), ([1.5] + [1] * 13, 1), ([1.75] + [1] * 11 + [1.75], 1), ([2.25] + [1] * 10 + [2.25], 1), ([1, 1, 1, 1.25, 5.0, 1.25, 1, 1, 1], 1)]
y = .38 + .5; keys = []
for widths, hk in rows:
    x = -KW / 2; kh = u * hk - .028
    for wk in widths:
        kw = wk * u - .028
        if wk >= .9 or hk < 1:
            k = slab('key', kw, kh, .028, min(.022, kw * .2), .006, 'key', (x + wk * u / 2, y - kh / 2, H + .016), seg=3, eseg=1); k.parent = root
        x += wk * u
    y -= u * hk
# 触控板
pad = slab('pad', 1.18, .72, .003, .05, 0, 'pad', (0, -.6, H + .0005)); pad.parent = root
# 前沿中间一个小缺口（开盖用）
# 转轴
bpy.ops.mesh.primitive_cylinder_add(radius=.05, depth=W - .5, vertices=24, location=(0, D / 2 - .03, H + .02), rotation=(0, math.pi / 2, 0))
hg = bpy.context.active_object; hg.name = 'hinge'; hg.data.materials.append(MATS['hinge']); hg.parent = root
for p in hg.data.polygons: p.use_smooth = True
# 屏幕盖：平放时屏幕朝上、往后伸，然后绕转轴抬起来 75°（往后仰 15°）
piv = bpy.data.objects.new('lidPivot', None); bpy.context.collection.objects.link(piv); piv.location = (0, D / 2 - .03, H + .03); piv.parent = root
LD = 2.04
lid = slab('lid', W, LD, .055, .14, .02, 'alu', (0, LD / 2, .028)); lid.parent = piv
bz = slab('bezel', W - .04, LD - .04, .004, .12, 0, 'bezel', (0, LD / 2, .057)); bz.parent = piv
# 屏幕：一块带 UV 的平面（网页里贴正在播放的歌）
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, LD / 2 + .03, .0595)); sc = bpy.context.active_object
sc.scale = (W - .2, LD - .22, 1); bpy.ops.object.transform_apply(scale=True); sc.name = 'screen'; sc.data.materials.append(MATS['screen']); sc.parent = piv
piv.rotation_euler = (math.radians(75), 0, 0)
bpy.ops.wm.save_as_mainfile(filepath=OUT.replace('.glb', '.blend'))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True)
print('faces', sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'))
