# iPhone 17 Pro Max（深蓝）—— 用 Blender 建：机身四角大圆角 + 侧边圆润、横贯的相机台、三颗镜头、闪光灯/雷达/麦克风、侧键、屏幕
# 单位跟网页里一致：宽 1.68、长 3.5、厚 0.17。Blender 里 X=宽、Y=长（+Y 是相机那头）、Z=厚（+Z 是背面）
# 用法：blender -b -P blender/phone.py -- models/phone.glb
import bpy, bmesh, math, sys
OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
W, L, T = 1.68, 3.5, .17

def mat(name, col, metal=0., rough=.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    return m
MAT = {k: mat(k, *v) for k, v in {
  'alu': ((.043, .058, .10), .6, .42), 'glassBack': ((.058, .075, .12), 0, .62), 'ring': ((.035, .045, .07), .85, .3),
  'bezel': ((.42, .46, .53), 1, .25), 'lens': ((.006, .008, .014), 0, .03), 'flash': ((.86, .83, .76), 0, .3),
  'dark': ((.01, .01, .012), 0, .4), 'screen': ((.02, .02, .025), 0, .2), 'band': ((.02, .025, .035), 0, .6)}.items()}

def finish(o, name, m, smooth=True):
    o.name = name; o.data.name = name; o.data.materials.append(MAT[m])
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o

def apply_mods(o):
    bpy.context.view_layer.objects.active = o
    for md in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)

def rounded_slab(name, w, l, t, r_corner, r_edge, m, z0=0., y0=0., seg=12, eseg=4):
    """圆角矩形板：先在平面上倒四个大角，再给上下边倒小圆"""
    bpy.ops.mesh.primitive_cube_add(size=1); o = bpy.context.active_object
    o.scale = (w, l, t); bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new(); bm.from_mesh(o.data)
    vert_edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) > 1e-6]
    bmesh.ops.bevel(bm, geom=vert_edges, offset=r_corner, segments=seg, affect='EDGES', profile=.5)
    if r_edge > 0:
        bm.edges.ensure_lookup_table()
        horiz = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6 and abs(abs(e.verts[0].co.z) - t / 2) < 1e-6]
        bmesh.ops.bevel(bm, geom=horiz, offset=r_edge, segments=eseg, affect='EDGES', profile=.5)
    bm.to_mesh(o.data); bm.free()
    o.location = (0, y0, z0)
    return finish(o, name, m)

def cyl(name, r, h, loc, m, seg=48, bevel=0.):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg, location=loc); o = bpy.context.active_object
    if bevel:
        bm = bmesh.new(); bm.from_mesh(o.data)
        rim = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
        bmesh.ops.bevel(bm, geom=rim, offset=bevel, segments=3, affect='EDGES', profile=.5); bm.to_mesh(o.data); bm.free()
    return finish(o, name, m)

# 机身：四角 R≈.24，侧边倒 .06，像 17 Pro 那种圆润的一体铝
rounded_slab('body', W, L, T, .24, .06, 'alu')
# 相机台：横贯整宽、占顶上三成，四边柔和地收下去
PLT = 1.03
rounded_slab('plateau', W - .05, PLT, .07, .22, .028, 'alu', z0=T / 2 + .012, y0=L / 2 - PLT / 2 - .025)
# 相机台下的磨砂玻璃
GL = L - PLT - .16
rounded_slab('glass', W - .15, GL, .012, .16, .004, 'glassBack', z0=T / 2 + .002, y0=L / 2 - PLT - .07 - GL / 2, eseg=2)
# 屏幕面（UV 0-1 铺满，网页里贴碎碎念那张图）
bpy.ops.mesh.primitive_plane_add(size=1); sc = bpy.context.active_object; sc.scale = (W - .04, L - .04, 1); bpy.ops.object.transform_apply(scale=True)
bm = bmesh.new(); bm.from_mesh(sc.data); bmesh.ops.bevel(bm, geom=list(bm.verts), offset=.22, segments=12, affect='VERTICES', profile=.5); bm.to_mesh(sc.data); bm.free()   # 屏幕四角也是圆的，不从机身圆角外面露出尖角
sc.location = (0, 0, -T / 2 - .004); sc.rotation_euler = (math.pi, 0, 0); finish(sc, 'screen', 'screen', False)
# 三颗镜头：外圈底座（倒角）、亮边、玻璃、微凸的镜片
zt = T / 2 + .012 + .035
for i, (x, y) in enumerate([(-.51, 1.41), (-.09, 1.20), (-.51, .98)]):
    cyl(f'lensHousing{i}', .195, .07, (x, y, zt + .03), 'ring', 64, .02)
    bpy.ops.mesh.primitive_torus_add(major_radius=.178, minor_radius=.012, major_segments=64, minor_segments=10, location=(x, y, zt + .066)); finish(bpy.context.active_object, f'bezel{i}', 'bezel')
    cyl(f'lensGlass{i}', .165, .01, (x, y, zt + .066), 'lens', 64)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=.11, segments=40, ring_count=16, location=(x, y, zt + .058)); d = bpy.context.active_object
    d.scale = (1, 1, .32); bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new(); bm.from_mesh(d.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -.001], context='VERTS'); bm.to_mesh(d.data); bm.free()
    finish(d, f'lensDome{i}', 'lens')
cyl('flash', .07, .016, (.53, 1.45, zt), 'flash', 40, .004)
bpy.ops.mesh.primitive_torus_add(major_radius=.072, minor_radius=.008, major_segments=40, minor_segments=8, location=(.53, 1.45, zt + .008)); finish(bpy.context.active_object, 'flashRing', 'bezel')
cyl('lidar', .075, .016, (.52, .97, zt), 'dark', 40, .004)
cyl('mic', .015, .016, (.52, 1.21, zt), 'dark', 16)
# 侧键：左边操作按钮 + 两个音量键；右边电源键；右下平平的相机控制键
for i, (sx, y, l, m) in enumerate([(-1, 1.02, .2, 'alu'), (-1, .62, .36, 'alu'), (-1, .18, .36, 'alu'), (1, .72, .5, 'alu'), (1, -.55, .32, 'lens')]):
    rounded_slab(f'key{i}', .05, l, .06, .02, .012, m)
    o = bpy.context.active_object; o.location = (sx * (W / 2 + .005), y, 0)
# 天线断点
for i, (sx, y) in enumerate([(-1, 1.42), (1, 1.42), (-1, -1.42), (1, -1.42)]):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(sx * (W / 2 + .0015), y, 0)); b = bpy.context.active_object; b.scale = (.004, .025, T * .8); bpy.ops.object.transform_apply(scale=True); finish(b, f'band{i}', 'band', False)

bpy.ops.wm.save_as_mainfile(filepath=OUT.replace('.glb', '.blend'))
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_materials='EXPORT')
tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
print('faces', tris)
