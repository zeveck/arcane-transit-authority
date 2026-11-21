#!/usr/bin/env python3
"""Shrink a meshgen GLB for the web and add its emissive mask.

Usage:
  python3 tools/shrink_glb.py IN.glb OUT.glb --size 256 --accent '#ff5a1f' [--rotate-y 90]
  python3 tools/shrink_glb.py IN.glb OUT.glb --size 512 --mask neutral        (shared Surface/Bore station)
  python3 tools/shrink_glb.py IN.glb OUT.glb --size 512 --mask saturated      (Monument: keeps its colours)

What it does (GAME_DESIGN.md, "Model post-processing"):
  * reads the GLB's JSON and binary chunks;
  * decodes every image, resizes it to at most --size px, re-encodes it as JPEG
    (quality 82; normal maps 85);
  * writes an emissive mask from the base-colour texture, same size as the base map,
    and hooks it up as the material's emissiveTexture:
      accent    pixels whose hue is within --hue-tol (20) degrees of --accent and whose
                saturation > --sat-min (0.4) (and value > --min-value) -> white, else black;
                emissiveFactor = the accent colour (linear).
      neutral   pixels with value > 0.85 and saturation < 0.15 -> white (the painted
                white-chrome trim); emissiveFactor = 1,1,1 (code sets yellow or green).
      saturated pixels with saturation > 0.4 (and value > --min-value) keep their own
                colour, everything else black; emissiveFactor = 1,1,1.
    In the game, code sets emissive to the accent colour at intensity 0.8.
  * optionally turns the whole model about Y (--rotate-y degrees) so it faces +Z
    (meshgen's train lead cars come out nose along -X: use --rotate-y 90);
  * repacks the buffer views (4-byte aligned) and writes the new GLB.
Check the result with `node <meshgen>/meshgen.cjs inspect OUT.glb`.
Needs Python 3 and Pillow.
"""
import argparse
import colorsys
import io
import json
import math
import struct
import sys

from PIL import Image, ImageChops, ImageFilter

GLB_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942


def read_glb(path):
    data = open(path, 'rb').read()
    magic, version, _length = struct.unpack_from('<III', data, 0)
    if magic != GLB_MAGIC or version != 2:
        sys.exit(f'{path}: not a glTF 2.0 binary')
    off, gltf, binary = 12, None, b''
    while off < len(data):
        clen, ctype = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == CHUNK_JSON:
            gltf = json.loads(chunk.decode('utf-8'))
        elif ctype == CHUNK_BIN:
            binary = chunk
        off += 8 + clen
    return gltf, binary


def write_glb(path, gltf, binary):
    js = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    js += b' ' * ((4 - len(js) % 4) % 4)
    binary += b'\0' * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(binary)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', GLB_MAGIC, 2, total))
        f.write(struct.pack('<II', len(js), CHUNK_JSON) + js)
        f.write(struct.pack('<II', len(binary), CHUNK_BIN) + binary)


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def jpeg_bytes(img, quality):
    buf = io.BytesIO()
    img.convert('RGB').save(buf, 'JPEG', quality=quality, optimize=True)
    return buf.getvalue()


def make_mask(base, mode, accent_hex, hue_tol, min_value, size=None, sat_min=0.4, neutral_value=0.85):
    """Return an RGB emissive map, computed on the full-size base map, then resized to `size`."""
    rgb = base.convert('RGB')
    hh, ss, vv = rgb.convert('HSV').split()  # Pillow HSV: all channels 0..255
    v_ok = vv.point(lambda x: 255 if x > min_value * 255 else 0)
    if mode == 'accent':
        ah = colorsys.rgb_to_hsv(*hex_rgb(accent_hex))[0] * 360

        def hue_ok(x):
            d = abs(x * 360 / 255 - ah) % 360
            return 255 if min(d, 360 - d) <= hue_tol else 0
        m = ImageChops.multiply(ImageChops.multiply(hh.point(hue_ok), ss.point(lambda x: 255 if x > sat_min * 255 else 0)), v_ok)
    elif mode == 'neutral':
        m = ImageChops.multiply(vv.point(lambda x: 255 if x > neutral_value * 255 else 0),
                                ss.point(lambda x: 255 if x < 0.15 * 255 else 0))
    else:  # saturated
        m = ImageChops.multiply(ss.point(lambda x: 255 if x > sat_min * 255 else 0), v_ok)
    # drop single-pixel speckles at full resolution, keep trim lines
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    if mode == 'saturated':
        out = Image.composite(rgb, Image.new('RGB', rgb.size), m)
    else:
        out = Image.merge('RGB', (m, m, m))
    if size and out.size != tuple(size):
        out = out.resize(tuple(size), Image.LANCZOS)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('src')
    ap.add_argument('dst')
    ap.add_argument('--size', type=int, default=512, help='max texture edge in px (256 trains, 512 stations)')
    ap.add_argument('--mask', choices=['accent', 'neutral', 'saturated', 'none'], default='accent')
    ap.add_argument('--accent', default=None, help='accent hex for --mask accent, e.g. #ff5a1f')
    ap.add_argument('--hue-tol', type=float, default=20.0)
    ap.add_argument('--min-value', type=float, default=0.25, help='HSV value floor for accent/saturated masks')
    ap.add_argument('--sat-min', type=float, default=0.4, help='saturation floor for accent/saturated masks (warm white #ffd9a0: 0.15)')
    ap.add_argument('--neutral-value', type=float, default=0.85, help='value floor for --mask neutral')
    ap.add_argument('--rotate-y', type=float, default=0.0, help='turn the model about +Y, degrees')
    ap.add_argument('--quality', type=int, default=82)
    ap.add_argument('--normal-quality', type=int, default=85)
    ap.add_argument('--save-mask', default=None, help='also write the mask to this JPEG path (for checking)')
    a = ap.parse_args()
    if a.mask == 'accent' and not a.accent:
        ap.error('--mask accent needs --accent')

    gltf, binary = read_glb(a.src)
    views = gltf['bufferViews']
    images = gltf.get('images', [])
    textures = gltf.get('textures', [])

    def view_bytes(i):
        bv = views[i]
        o = bv.get('byteOffset', 0)
        return binary[o:o + bv['byteLength']]

    # Which images are normal maps / base colour
    normal_imgs, base_imgs = set(), []
    for mat in gltf.get('materials', []):
        if 'normalTexture' in mat:
            normal_imgs.add(textures[mat['normalTexture']['index']]['source'])
        bct = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
        if bct is not None:
            base_imgs.append((mat, textures[bct['index']]['source']))

    new_view_data = {i: view_bytes(i) for i in range(len(views))}
    decoded, full = {}, {}
    for idx, im in enumerate(images):
        if 'bufferView' not in im:
            continue
        img = Image.open(io.BytesIO(new_view_data[im['bufferView']]))
        img.load()
        full[idx] = img
        if max(img.size) > a.size:
            k = a.size / max(img.size)
            img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
        decoded[idx] = img
        q = a.normal_quality if idx in normal_imgs else a.quality
        new_view_data[im['bufferView']] = jpeg_bytes(img, q)
        im['mimeType'] = 'image/jpeg'

    # Emissive masks
    if a.mask != 'none':
        sampler = textures[0].get('sampler', 0) if textures else None
        for mat, src in base_imgs:
            if src not in full:
                continue
            mask = make_mask(full[src], a.mask, a.accent, a.hue_tol, a.min_value, decoded[src].size, a.sat_min, a.neutral_value)
            if a.save_mask:
                mask.save(a.save_mask, 'JPEG', quality=a.quality)
            views.append({'buffer': 0, 'byteLength': 0})
            vi = len(views) - 1
            new_view_data[vi] = jpeg_bytes(mask, a.quality)
            images.append({'bufferView': vi, 'mimeType': 'image/jpeg', 'name': 'emissive'})
            tex = {'source': len(images) - 1}
            if sampler is not None:
                tex['sampler'] = sampler
            textures.append(tex)
            mat['emissiveTexture'] = {'index': len(textures) - 1}
            if a.mask == 'accent':
                mat['emissiveFactor'] = [round(srgb_to_linear(c), 4) for c in hex_rgb(a.accent)]
            else:
                mat['emissiveFactor'] = [1.0, 1.0, 1.0]
        gltf['images'], gltf['textures'] = images, textures

    # Turn about Y: wrap the scene's root nodes in a new parent
    if a.rotate_y:
        r = math.radians(a.rotate_y) / 2
        nodes = gltf['nodes']
        for sc in gltf.get('scenes', []):
            nodes.append({'name': 'shrink_glb_turn', 'rotation': [0, round(math.sin(r), 7), 0, round(math.cos(r), 7)],
                          'children': sc['nodes']})
            sc['nodes'] = [len(nodes) - 1]

    # Repack the binary chunk (4-byte aligned views)
    out = bytearray()
    for i, bv in enumerate(views):
        out += b'\0' * ((4 - len(out) % 4) % 4)
        d = new_view_data[i]
        bv['buffer'] = 0
        bv['byteOffset'] = len(out)
        bv['byteLength'] = len(d)
        out += d
    gltf['buffers'] = [{'byteLength': len(out) + ((4 - len(out) % 4) % 4)}]
    write_glb(a.dst, gltf, bytes(out))
    import os
    print(json.dumps({'in': a.src, 'out': a.dst, 'bytesIn': os.path.getsize(a.src), 'bytesOut': os.path.getsize(a.dst),
                      'textures': [list(decoded[k].size) for k in sorted(decoded)], 'mask': a.mask,
                      'rotateY': a.rotate_y}))


if __name__ == '__main__':
    main()
