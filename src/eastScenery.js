import { BoxGeometry, ConeGeometry, ExtrudeGeometry, Group, InstancedMesh, Matrix4, Quaternion, Shape, Vector3, Color } from 'three'
import { EAST, LOBBY } from './config.js'
import { mulberry32 } from './textures.js'
import { buildOak, put, std } from './propkit.js'
import { buildCandyCane, buildPine } from './decor.js'
import { bake } from './bake.js'

// The backdrop behind the egg platform, after the reference's east view (EAST in config): a
// grey-green farmhouse with an X door and a weathervane, a field of tall corn behind the stone
// wall, a round oak, candy canes (LOBBY.festive) and pines, and big grey low-poly mountains on
// the horizon. Built with the shops, so a race slides it away with the rest of the start island.

// The farmhouse, front (gable end, door) toward local +Z, turned by `yaw`.
function buildBarn(root, B) {
  const g = new Group()
  g.position.set(B.x, 0, B.z)
  g.rotation.y = B.yaw
  root.add(g)
  const wall = std(B.wall, { roughness: 0.85 })
  const roof = std(B.roof, { roughness: 0.7 })
  const trim = std(B.trim, { roughness: 0.6 })
  const W = B.width
  const D = B.depth
  const H = B.height
  const R = B.roofRise
  put(g, new BoxGeometry(W, H, D), wall, 0, H / 2, 0)
  // Gable ends: a triangle over each end wall.
  const tri = new Shape()
  tri.moveTo(-W / 2, 0)
  tri.lineTo(W / 2, 0)
  tri.lineTo(0, R)
  tri.closePath()
  const gable = new ExtrudeGeometry(tri, { depth: D, bevelEnabled: false })
  gable.translate(0, 0, -D / 2)
  put(g, gable, wall, 0, H, 0)
  // Roof: two slabs from the eaves to the ridge, overhanging a little.
  const slope = Math.hypot(W / 2, R) + 0.8
  const pitch = Math.atan2(R, W / 2)
  for (const s of [-1, 1]) {
    const slab = put(g, new BoxGeometry(slope, 0.35, D + 1.2), roof, (s * W) / 4, H + R / 2 + 0.15, 0)
    slab.rotation.z = -s * pitch
  }
  // White trim: corner boards, eaves line, the gable's edges.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, new BoxGeometry(0.4, H, 0.4), trim, sx * (W / 2 - 0.1), H / 2, sz * (D / 2 - 0.1))
  for (const sz of [-1, 1]) {
    put(g, new BoxGeometry(W + 0.2, 0.35, 0.3), trim, 0, H, sz * (D / 2 + 0.05))
    for (const s of [-1, 1]) {
      const edge = put(g, new BoxGeometry(slope - 0.6, 0.3, 0.3), trim, (s * W) / 4, H + R / 2, sz * (D / 2 + 0.08))
      edge.rotation.z = -s * pitch
    }
  }
  // Big barn door with an X brace, and the loft window in the gable.
  const fz = D / 2 + 0.06
  const dw = W * 0.42
  const dh = H * 0.62
  put(g, new BoxGeometry(dw, dh, 0.12), std(B.wall, { roughness: 0.8 }), 0, dh / 2, fz)
  for (const [x, y, w, h] of [[0, dh, dw + 0.3, 0.3], [-dw / 2, dh / 2, 0.3, dh], [dw / 2, dh / 2, 0.3, dh], [0, dh / 2, 0.25, dh]]) put(g, new BoxGeometry(w, h, 0.18), trim, x, y, fz + 0.04)
  const diag = Math.hypot(dw / 2, dh)
  for (const s of [-1, 1])
    for (const ox of [-dw / 4, dw / 4]) {
      const brace = put(g, new BoxGeometry(0.22, diag, 0.16), trim, ox, dh / 2, fz + 0.08)
      brace.rotation.z = s * Math.atan2(dw / 2, dh)
    }
  put(g, new BoxGeometry(W * 0.16, H * 0.3, 0.12), std('#1b2440', { roughness: 0.3 }), 0, H + R * 0.25, fz)
  put(g, new BoxGeometry(W * 0.16 + 0.5, H * 0.3 + 0.5, 0.08), trim, 0, H + R * 0.25, fz - 0.03)
  // Weathervane on the ridge: a pole, an arrow, the N-S / E-W cross.
  const iron = std('#3a3f48', { metalness: 0.5, roughness: 0.4 })
  const vy = H + R + 0.3
  put(g, new BoxGeometry(0.1, 2.2, 0.1), iron, 0, vy + 1.1, D / 2 - 1.5)
  put(g, new BoxGeometry(1.8, 0.08, 0.08), iron, 0, vy + 1.6, D / 2 - 1.5)
  put(g, new BoxGeometry(0.08, 0.08, 1.4), iron, 0, vy + 1.6, D / 2 - 1.5)
  put(g, new BoxGeometry(0.12, 0.3, 1.8), iron, 0, vy + 2.1, D / 2 - 1.5)
}

// A block of tall corn: green stalks with leaves and yellow tassels, one InstancedMesh each.
function buildCorn(root, C) {
  const rand = mulberry32(4411)
  const spots = []
  for (let x = C.x0; x <= C.x1; x += C.spacing) for (let z = C.z0; z <= C.z1; z += C.spacing) spots.push([x + (rand() - 0.5) * 0.4, z + (rand() - 0.5) * 0.4, C.height * (0.85 + rand() * 0.3)])
  const stalks = new InstancedMesh(new BoxGeometry(0.16, 1, 0.16), std('#3c9a2e', { roughness: 0.8 }), spots.length)
  const leaves = new InstancedMesh(new BoxGeometry(0.9, 0.12, 0.08), std('#58b83a', { roughness: 0.8 }), spots.length * 2)
  const tassels = new InstancedMesh(new BoxGeometry(0.34, 0.9, 0.34), std('#e8c53a', { roughness: 0.7 }), spots.length)
  const m = new Matrix4()
  const q = new Quaternion()
  const up = new Vector3(0, 1, 0)
  const pos = new Vector3()
  const scale = new Vector3()
  spots.forEach(([x, z, h], i) => {
    stalks.setMatrixAt(i, m.compose(pos.set(x, h / 2, z), q.identity(), scale.set(1, h, 1)))
    tassels.setMatrixAt(i, m.compose(pos.set(x, h + 0.2, z), q.setFromAxisAngle(up, rand() * 3), scale.set(1, 1, 1)))
    for (let k = 0; k < 2; k++) leaves.setMatrixAt(i * 2 + k, m.compose(pos.set(x, h * (0.45 + k * 0.25), z), q.setFromAxisAngle(up, rand() * Math.PI), scale.set(1, 1, 1)))
  })
  for (const mesh of [stalks, leaves, tassels]) {
    mesh.castShadow = true
    root.add(mesh)
  }
}

// A grey low-poly mountain: a jagged cone with lighter facets toward the top.
function buildMountain(root, [x, z, radius, height, seed]) {
  const geo = new ConeGeometry(radius, height, 8, 4)
  const rand = mulberry32(seed)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    if (y > height / 2 - 0.01) continue // keep the peak a point
    const k = 0.85 + rand() * 0.3
    pos.setXYZ(i, pos.getX(i) * k, y + (rand() - 0.5) * height * 0.06, pos.getZ(i) * k)
  }
  geo.computeVertexNormals()
  const nonIndexed = geo.toNonIndexed()
  const colors = []
  const c = new Color()
  const p = nonIndexed.attributes.position
  for (let i = 0; i < p.count; i += 3) {
    const t = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 / height + 0.5 // 0 foot .. 1 peak
    c.set(EAST.mountainColors[Math.min(EAST.mountainColors.length - 1, Math.floor(t * EAST.mountainColors.length + rand() * 0.6))])
    for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b)
  }
  nonIndexed.setAttribute('color', new (p.constructor)(new Float32Array(colors), 3))
  nonIndexed.computeVertexNormals()
  const m = put(root, nonIndexed, std('#ffffff', { vertexColors: true, roughness: 1, flatShading: true }), x, height / 2 - 2, z, false)
  m.receiveShadow = false
}

export function buildEastScenery(scene) {
  const root = new Group()
  root.name = 'east-scenery'
  scene.add(root)
  const props = new Group()
  buildBarn(props, EAST.barn)
  if (EAST.oak) buildOak(props, EAST.oak[0], EAST.oak[1], EAST.oak[2], 909, 0, false)
  for (const [x, z, h] of EAST.pines) buildPine(props, x, z, h)
  if (LOBBY.festive) for (const c of EAST.canes) buildCandyCane(props, c)
  root.add(bake(props, true))
  buildCorn(root, EAST.corn)
  const far = new Group()
  for (const mtn of EAST.mountains) buildMountain(far, mtn)
  root.add(bake(far, false))
  return root
}
