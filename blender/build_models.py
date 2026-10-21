# Una formación por proyecto: un modelo 3D por cada tarjeta del portfolio,
# exportado a .glb para la fuente { type: 'model' } del sitio.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
#     --python blender/build_models.py -- public/models/projects [--preview DIR] [--only ID]
#
# Todo es procedural: primitivas, polígonos extruidos y curvas con grosor. Nada
# descargado, así que el script es la fuente y los .glb se regeneran iguales.
#
# Criterio de diseño: el sitio no muestra la malla, muestra ~4000 puntos
# muestreados sobre su superficie y vistos casi siempre de frente. Lo que se lee
# es la SILUETA. Por eso casi todo es un contorno 2D extruido con poco fondo
# (la cara frontal llena es lo que dibuja la forma) y nada es más fino que ~0.08
# del tamaño total: un detalle más fino recibe tres puntos y desaparece.
#
# Orientación: Blender es Z-arriba; el exportador glTF convierte a Y-arriba
# (x, y, z) → (x, z, -y). Para que el modelo mire a +Z en three.js tiene que
# mirar a -Y en Blender: todo se dibuja en el plano XZ, que es la vista "Front"
# de Blender.

import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'public/models/projects'
PREVIEW = argv[argv.index('--preview') + 1] if '--preview' in argv else None
ONLY = argv[argv.index('--only') + 1] if '--only' in argv else None

DEPTH = 0.3          # fondo por defecto de los contornos extruidos


# ── Utilidades ─────────────────────────────────────────────────────────────

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.curves, bpy.data.cameras):
        for item in list(block):
            block.remove(item)


def link(obj):
    bpy.context.collection.objects.link(obj)
    return obj


def prism(pts, depth=DEPTH, y=0.0, name='prism'):
    """Contorno 2D (lista de (x, z)) extruido hacia +Y. La cara frontal (-Y)
    es la que se ve desde three.js."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    front = [bm.verts.new((x, y - depth / 2, z)) for x, z in pts]
    face = bm.faces.new(front)
    bmesh.ops.recalc_face_normals(bm, faces=[face])
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(0, depth, 0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def annulus(outer, inner, depth=DEPTH, y=0.0, name='annulus'):
    """Anillo entre dos contornos con el mismo número de puntos. Un polígono
    con agujero no existe en bmesh; un anillo de quads sí."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    n = len(outer)
    layers = []
    for dy in (-depth / 2, depth / 2):
        o = [bm.verts.new((x, y + dy, z)) for x, z in outer]
        i = [bm.verts.new((x, y + dy, z)) for x, z in inner]
        layers.append((o, i))
    (o0, i0), (o1, i1) = layers
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((o0[k], o0[j], i0[j], i0[k]))      # cara frontal
        bm.faces.new((o1[k], i1[k], i1[j], o1[j]))      # cara trasera
        bm.faces.new((o0[k], o1[k], o1[j], o0[j]))      # canto exterior
        bm.faces.new((i0[k], i0[j], i1[j], i1[k]))      # canto interior
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def circle(r, n=48, cx=0.0, cz=0.0, start=0.0, end=2 * math.pi, closed=True):
    count = n if closed else n + 1
    span = end - start
    return [(cx + r * math.cos(start + span * k / n), cz + r * math.sin(start + span * k / n))
            for k in range(count)]


def disc(r, depth=DEPTH, cx=0.0, cz=0.0, y=0.0, n=48):
    return prism(circle(r, n, cx, cz), depth, y, 'disc')


def ring(r_out, r_in, depth=DEPTH, cx=0.0, cz=0.0, y=0.0, n=64):
    return annulus(circle(r_out, n, cx, cz), circle(r_in, n, cx, cz), depth, y, 'ring')


def box(cx, cz, w, h, depth=DEPTH, y=0.0, angle=0.0):
    c, s = math.cos(angle), math.sin(angle)
    corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    return prism([(cx + x * c - z * s, cz + x * s + z * c) for x, z in corners], depth, y, 'box')


def tube(points, radius=0.06, name='tube'):
    """Trazo con grosor real a lo largo de puntos (x, z): para contornos
    abiertos, que como relleno se leerían como una mancha."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = 3
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for p, (x, z) in zip(sp.points, points):
        p.co = (x, 0.0, z, 1.0)
    obj = link(bpy.data.objects.new(name, cu))
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return bpy.context.view_layer.objects.active


def text(body, cx, cz, size, y=-0.2, depth=0.08, bold=0.0):
    """Texto en el plano XZ mirando a -Y, convertido a malla. `bold` engrosa
    el contorno: la tipografía por defecto tiene un trazo demasiado fino para
    que le toquen puntos suficientes."""
    cu = bpy.data.curves.new('text', 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = depth
    cu.offset = bold
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    obj = link(bpy.data.objects.new('text', cu))
    obj.rotation_euler = (math.pi / 2, 0, 0)
    obj.location = (cx, y, cz)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj.select_set(False)
    return obj


def gear_outline(r, teeth, tooth=0.18, n_per=6):
    """Contorno de engranaje: dientes trapezoidales sobre un círculo."""
    pts = []
    total = teeth * n_per
    for k in range(total):
        a = 2 * math.pi * k / total
        phase = (k % n_per) / n_per
        # mitad del período arriba (diente), mitad abajo (valle)
        rr = r + tooth if 0.15 <= phase < 0.6 else r
        pts.append((rr * math.cos(a), rr * math.sin(a)))
    return pts


# ── Modelos ────────────────────────────────────────────────────────────────
# Cada uno dibuja centrado cerca del origen, ~2.5–3 unidades de ancho. El
# cargador del sitio normaliza el radio, así que la escala absoluta no importa;
# importa que la proporción alto/ancho sea razonable.

def gaboauditmyweb():
    # Velocímetro: arco grueso, marcas y aguja. El arco es un tubo (contorno
    # abierto), la aguja un triángulo lleno: los dos se leen como partículas.
    a0, a1 = math.radians(210), math.radians(-30)
    tube(circle(1.2, 40, start=a0, end=a1, closed=False), 0.09)
    for k in range(9):
        a = a0 + (a1 - a0) * k / 8
        box(1.0 * math.cos(a), 1.0 * math.sin(a), 0.07, 0.22 if k % 2 == 0 else 0.13, angle=a + math.pi / 2)
    a = math.radians(40)
    tip = (0.95 * math.cos(a), 0.95 * math.sin(a))
    side = (0.1 * math.cos(a + math.pi / 2), 0.1 * math.sin(a + math.pi / 2))
    prism([(side[0], side[1]), tip, (-side[0], -side[1]), (-0.25 * math.cos(a), -0.25 * math.sin(a))], 0.2, -0.05)
    disc(0.17, 0.35)


def shopfloor():
    # Fábrica: techo en diente de sierra (lo que la distingue de una casa) y
    # dos chimeneas. Un solo contorno lleno con la silueta completa.
    pts = [(-1.5, 0), (1.5, 0), (1.5, 0.75)]
    # dientes de derecha a izquierda: sube vertical, baja en pendiente
    xs = [1.5, 0.75, 0.0, -0.75]
    for x in xs:
        pts += [(x, 1.25), (x - 0.75, 0.75)]
    pts += [(-1.5, 0.75)]
    prism(pts[:-1] if pts[-1] == pts[-2] else pts)
    box(1.05, 1.15, 0.22, 1.5)       # chimenea alta
    box(0.65, 1.0, 0.2, 1.1)         # chimenea baja
    # Humo: discos crecientes sobre la chimenea alta, para que se lea "planta".
    for i, (dx, dz, r) in enumerate([(0.05, 2.05, 0.13), (0.22, 2.35, 0.17), (0.48, 2.6, 0.21)]):
        disc(r, 0.2, 1.05 + dx, dz)
    # Puerta y ventanas como relieve delante de la fachada.
    box(-1.0, 0.3, 0.35, 0.6, 0.12, -0.2)
    for x in (-0.3, 0.3, 0.9):
        box(x, 0.4, 0.3, 0.25, 0.12, -0.2)


def groundcheck():
    # Lupa sobre un check: el check dentro de la lente, el mango en diagonal.
    cx, cz, r = -0.2, 0.25, 0.95
    ring(r, r - 0.18, 0.3, cx, cz)
    tube([(cx + (r - 0.05) * 0.707, cz - (r - 0.05) * 0.707), (cx + 1.85 * 0.707, cz - 1.85 * 0.707)], 0.16)
    # Check: un trazo grueso en V, lleno.
    prism([(-0.75, 0.3), (-0.55, 0.5), (-0.3, 0.25), (0.25, 0.8), (0.45, 0.6), (-0.3, -0.15)], 0.22)


def feedstock():
    # Gráfico de velas en alza: cuerpos llenos y mechas. Las mechas a 0.07 de
    # ancho: más finas no reciben puntos suficientes.
    candles = [(-1.25, 0.2, 0.5), (-0.75, 0.45, 0.4), (-0.25, 0.3, 0.55), (0.25, 0.75, 0.5),
               (0.75, 0.95, 0.6), (1.25, 1.3, 0.55)]
    for x, mid, h in candles:
        box(x, mid, 0.32, h)
        box(x, mid, 0.07, h + 0.5, 0.15)
    tube([(-1.5, -0.35), (1.55, -0.35)], 0.05)          # eje
    tube([(-1.5, -0.35), (-1.5, 1.85)], 0.05)


def crew():
    # Tres engranajes que engranan: trabajo repartido entre varios. Anillos
    # dentados (huecos) para que se lea "engranaje" y no "flor".
    def gear(r, teeth, cx, cz, rot=0.0):
        outer = [(cx + x * math.cos(rot) - z * math.sin(rot), cz + x * math.sin(rot) + z * math.cos(rot))
                 for x, z in gear_outline(r, teeth)]
        inner = circle(r * 0.45, len(outer), cx, cz)
        annulus(outer, inner)
        ring(r * 0.25, r * 0.12, 0.35, cx, cz, n=32)
    gear(0.85, 12, -0.55, -0.2)
    gear(0.55, 8, 0.75, 0.45, 0.2)
    gear(0.45, 7, 0.55, -0.85, 0.1)


def brandvoice():
    # Globo de diálogo (contorno) con una plumilla adentro: voz editorial.
    w, h, rad = 1.5, 1.0, 0.35
    path = []
    for cx, cz, a in [(w - rad, h - rad, 0), (-w + rad, h - rad, 90), (-w + rad, -h + rad, 180), (w - rad, -h + rad, 270)]:
        path += circle(rad, 8, cx, cz, math.radians(a), math.radians(a + 90), closed=False)
    # cola del globo en la esquina inferior izquierda
    tail_at = next(i for i, (x, z) in enumerate(path) if z <= -h + 0.01 and x > -0.9)
    path = path[:tail_at] + [(-0.6, -h), (-1.05, -1.6), (-0.25, -h)] + path[tail_at:]
    tube(path + [path[0]], 0.09)
    # Plumilla: punta abajo, ojo arriba.
    prism([(0, -0.62), (0.42, 0.05), (0.3, 0.55), (-0.3, 0.55), (-0.42, 0.05)], 0.22)
    disc(0.1, 0.3, 0, 0.12, -0.05)
    box(0, -0.25, 0.05, 0.6, 0.3, -0.05)            # ranura
    box(0, 0.68, 0.7, 0.16, 0.25)                    # virola


def trailplugin():
    # Cordillera con un pin de mapa sobre la cima principal.
    prism([(-1.7, -0.9), (-1.0, 0.0), (-0.65, -0.35), (0.05, 0.85), (0.6, 0.05), (0.95, 0.4),
           (1.7, -0.9)])
    # nieve: la cumbre más clara no existe en partículas monocromas; en su
    # lugar, un relieve delante que marca la cima.
    prism([(-0.22, 0.55), (0.05, 0.85), (0.32, 0.55), (0.15, 0.6), (0.05, 0.5), (-0.07, 0.6)], 0.1, -0.2)
    # Pin: círculo arriba que se afina hacia la punta, con un agujero.
    cx, cz, r = 0.05, 1.75, 0.42
    outer = []
    for k in range(48):
        a = math.radians(-60 + 300 * k / 47)          # arco abierto abajo
        outer.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    tip = (cx, cz - 0.95)
    pts = outer + [tip]
    inner = circle(0.16, len(pts), cx, cz + 0.02)
    annulus(pts, inner, 0.3, -0.1)


def quicktask():
    # Engranaje con un "play" adentro: automatización. El play va adelante
    # para que no se confunda con el anillo.
    outer = gear_outline(1.15, 10, 0.25)
    annulus(outer, circle(0.8, len(outer)))
    prism([(-0.28, -0.42), (0.48, 0.0), (-0.28, 0.42)], 0.3, -0.1)


def squish():
    # Una esfera aplastada por una prensa: compresión. Placas arriba y abajo,
    # vástago de la prensa, y la esfera achatada entre ambas.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.0, location=(0, 0, 0))
    s = bpy.context.active_object
    s.scale = (1.45, 0.6, 0.55)
    bpy.ops.object.transform_apply(scale=True)
    box(0, 0.72, 2.4, 0.2, 0.8)          # placa superior
    box(0, -0.72, 2.6, 0.2, 0.8)         # base
    box(0, 1.25, 0.28, 0.9, 0.4)         # vástago
    # flechas que empujan
    for x in (-0.9, 0.9):
        prism([(x - 0.22, 1.35), (x + 0.22, 1.35), (x, 1.0)], 0.2)


def rrect(w, h, r, n=8):
    """Rectángulo redondeado como contorno (x, z), con el mismo número de
    puntos para cualquier tamaño: así dos de ellos forman un anillo."""
    pts = []
    for cx, cz, a in [(w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90),
                      (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)]:
        pts += circle(r, n, cx, cz, math.radians(a), math.radians(a + 90), closed=False)
    return pts


def typeit():
    # Tres teclas: marcos huecos con la letra llena adentro. Una tecla maciza
    # con la letra en relieve se ve bien renderizada pero no como partículas:
    # el relieve casi no cambia la densidad de puntos y la letra desaparece.
    # Marco + letra es contraste real: puntos donde hay forma, vacío alrededor.
    for x, ch in ((-1.15, 'T'), (0.0, 'Y'), (1.15, 'P')):
        outer = [(x + px, pz) for px, pz in rrect(1.0, 1.0, 0.2)]
        inner = [(x + px, pz) for px, pz in rrect(0.78, 0.78, 0.1)]
        annulus(outer, inner, 0.35)
        text(ch, x, 0.0, 0.62, y=0.0, depth=0.12, bold=0.035)
    box(0, -0.75, 3.4, 0.14, 0.4)        # bastidor debajo


def daniel_arias():
    # Un cello: caja con cintura en C, mástil, voluta y pica. La silueta de la
    # caja se arma con un ancho por altura, que es como se dibuja un violín.
    def half_width(t):  # t de 0 (abajo) a 1 (arriba de la caja)
        lower = 0.78 * math.sqrt(max(0.0, 1 - ((t - 0.27) / 0.3) ** 2)) if t < 0.57 else 0
        upper = 0.62 * math.sqrt(max(0.0, 1 - ((t - 0.78) / 0.24) ** 2)) if t > 0.52 else 0
        waist = 0.45
        w = max(lower, upper)
        if 0.47 < t < 0.62:
            w = max(waist, min(w, waist + abs(t - 0.545) * 2.0))
        return max(w, 0.02)
    n = 60
    H = 2.2
    right = [(half_width(k / n), -1.4 + H * k / n) for k in range(n + 1)]
    left = [(-x, z) for x, z in reversed(right)]
    prism(right + left, 0.4)
    box(0, 1.35, 0.16, 1.5, 0.25)                    # mástil
    prism([(-0.12, 2.0), (0.12, 2.0), (0.1, 2.35), (-0.1, 2.35)], 0.3)   # clavijero
    ring(0.15, 0.06, 0.3, 0.05, 2.45, n=32)          # voluta
    box(0, -1.6, 0.06, 0.45, 0.15)                   # pica
    # Puente y efes en relieve: lo que hace que no sea "una guitarra".
    box(0, -0.45, 0.5, 0.08, 0.1, -0.25)
    for sx in (-1, 1):
        tube([(sx * 0.32, -0.6), (sx * 0.28, -0.35), (sx * 0.32, -0.05)], 0.035)
    # cuerdas: cuatro, del puente al clavijero
    for x in (-0.06, -0.02, 0.02, 0.06):
        tube([(x * 3, -0.45), (x, 2.0)], 0.012)


MODELS = {
    'gaboauditmyweb': gaboauditmyweb,
    'shopfloor': shopfloor,
    'groundcheck': groundcheck,
    'feedstock': feedstock,
    'crew': crew,
    'brandvoice': brandvoice,
    'trailplugin': trailplugin,
    'quicktask': quicktask,
    'squish': squish,
    'typeit': typeit,
    'daniel-arias': daniel_arias,
}


# ── Exportar y previsualizar ───────────────────────────────────────────────

def join_all():
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Centro en el origen: el cargador normaliza igual, pero así el preview
    # y el .glb coinciden.
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    obj.location = (0, 0, 0)
    return obj


def export(obj, path):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True,
        export_materials='NONE', export_texcoords=False, export_normals=False,
        export_yup=True, export_cameras=False, export_lights=False,
    )


def preview(obj, path):
    dims = obj.dimensions
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(dims.x, dims.z) * 1.2
    cam = link(bpy.data.objects.new('cam', cam_data))
    # Desde -Y mirando a +Y: es lo que ve three.js desde +Z tras la conversión.
    cam.location = (0, -10, 0)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = scene.render.resolution_y = 360
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


os.makedirs(OUT, exist_ok=True)
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)

for mid, build in MODELS.items():
    if ONLY and mid != ONLY:
        continue
    clear()
    build()
    obj = join_all()
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    path = os.path.join(OUT, f'{mid}.glb')
    export(obj, path)
    print(f'[models] {mid}: {tris} tris, {os.path.getsize(path) / 1024:.0f} KB, '
          f'{obj.dimensions.x:.2f}×{obj.dimensions.z:.2f}')
    if PREVIEW:
        preview(obj, os.path.join(PREVIEW, f'{mid}.png'))
