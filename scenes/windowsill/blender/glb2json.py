"""把 Blender 导出的 .glb 转成网页读的 .gltf.json（同一个 glTF，只是二进制那块用 base64 塞进 JSON 里）。
为什么这样：有的托管环境只认文本文件，.json 哪里都能放。网页读到以后在内存里拼回 .glb 再解析。
用法：python3 blender/glb2json.py models/bookcase.glb models/bookcase.gltf.json"""
import struct, json, base64, sys
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
assert b[:4] == b'glTF', '这不是 .glb 文件'
off, js, binc = 12, None, None
while off < len(b):
    ln, typ = struct.unpack_from('<II', b, off); chunk = b[off + 8: off + 8 + ln]
    if typ == 0x4E4F534A: js = json.loads(chunk)
    elif typ == 0x004E4942: binc = chunk
    off += 8 + ln
js['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(binc).decode()
open(dst, 'w').write(json.dumps(js, separators=(',', ':')))
print('写好了', dst)
