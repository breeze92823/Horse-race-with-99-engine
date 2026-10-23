import { BoxGeometry, ConeGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape } from 'three'
import { GROUND, LOBBY, WEST } from './config.js'
import { bake } from './bake.js'
import { label, put, solidBox, std } from './propkit.js'
import { buildCandyCane, buildPine, buildStringLights, buildWreath } from './decor.js'

// The backdrop behind the Partner stage, after the reference's west view: the big red barn (its
// gable end toward the spawn: white trim, X-braced doors with a wreath, a loft door up in the gable,
// a lean-to porch along its south side hung with string lights), the "Partner" sign in front of its
// gable, pines and an orange autumn pine, candy canes (LOBBY.festive) and grey low-poly mountains on
// the horizon. Built into `root` (the lobby, so a race slides it away with the start island); the
// static meshes are baked.

// The barn in its own frame: front (+Z) = a gable end `width` wide, `depth` long, the ridge along z.
function buildBarn(g, B) {
  const wall = std(B.wall, { roughness: 0.8 })
  const trim = std(B.trim, { roughness: 0.6 })
  const roof = std(B.roof, { roughness: 0.7, flatShading: true })
  const dark = std('#2a2226', { roughness: 0.9 })
  const hw = B.width / 2
  const hd = B.depth / 2
  const H = B.height
  put(g, new BoxGeometry(B.width, H, B.depth), wall, 0, H / 2, 0)
  // Gable ends: the wall continues up to the ridge, front and back.
  const gable = new Shape()
  gable.moveTo(-hw, 0)
  gable.lineTo(hw, 0)
  gable.lineTo(0, B.roofRise)
  gable.closePath()
  const gableGeo = new ExtrudeGeometry(gable, { depth: 0.4, bevelEnabled: false })
  for (const s of [-1, 1]) put(g, gableGeo, wall, 0, H, s > 0 ? hd - 0.4 : -hd)
  // Roof: two slabs meeting at the ridge, overhanging the walls and the gables, a white ridge cap
  // and white bargeboards up the front gable's edges.
  const run = hw + 0.9
  const slope = Math.hypot(run, B.roofRise)
  const pitch = Math.atan2(B.roofRise, run)
  for (const s of [-1, 1]) {
    const slab = put(g, new BoxGeometry(slope + 0.3, 0.45, B.depth + 1.4), roof, (s * run) / 2, H + B.roofRise / 2 + 0.1, 0)
    slab.rotation.z = -s * pitch
    const barge = put(g, new BoxGeometry(slope + 0.2, 0.35, 0.3), trim, (s * run) / 2, H + B.roofRise / 2 + 0.05, hd + 0.62)
    barge.rotation.z = -s * pitch
  }
  put(g, new BoxGeometry(0.5, 0.3, B.depth + 1.6), trim, 0, H + B.roofRise + 0.25, 0)
  // Corner posts and a band under the eaves.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, new BoxGeometry(0.45, H, 0.45), trim, sx * (hw - 0.1), H / 2, sz * (hd - 0.1))
  for (const sx of [-1, 1]) put(g, new BoxGeometry(0.2, 0.35, B.depth), trim, sx * (hw + 0.05), H - 0.1, 0)
  put(g, new BoxGeometry(B.width + 0.2, 0.35, 0.2), trim, 0, H - 0.1, hd + 0.05)
  // Big doors on the front: a white frame with an X brace over each leaf, the wreath over them.
  const dw = B.width * 0.5
  const dh = H * 0.78
  const fz = hd + 0.12
  for (const sx of [-1, 1]) put(g, new BoxGeometry(0.32, dh, 0.16), trim, (sx * dw) / 2, dh / 2, fz)
  put(g, new BoxGeometry(dw + 0.32, 0.32, 0.16), trim, 0, dh, fz)
  put(g, new BoxGeometry(0.22, dh, 0.16), trim, 0, dh / 2, fz)
  const leaf = dw / 2
  const diag = Math.hypot(leaf, dh)
  for (const sx of [-1, 1])
    for (const k of [-1, 1]) {
      const b = put(g, new BoxGeometry(0.22, diag, 0.12), trim, (sx * leaf) / 2, dh / 2, fz + 0.03)
      b.rotation.z = k * Math.atan2(leaf, dh)
    }
  buildWreath(g, 0, dh * 0.6, fz + 0.2, 0.9)
  // Loft door up in the gable.
  const ly = H + B.roofRise * 0.32
  put(g, new BoxGeometry(2.2, 2.6, 0.1), dark, 0, ly, hd + 0.06)
  for (const sx of [-1, 1]) put(g, new BoxGeometry(0.25, 2.9, 0.14), trim, sx * 1.2, ly, hd + 0.1)
  for (const sy of [-1, 1]) put(g, new BoxGeometry(2.65, 0.25, 0.14), trim, 0, ly + sy * 1.42, hd + 0.1)
  // Windows along the side that faces south (-x), white-framed.
  for (const z of [-hd * 0.5, hd * 0.25]) {
    put(g, new BoxGeometry(0.1, 2.2, 2), dark, -hw - 0.06, H * 0.5, z)
    for (const sy of [-1, 1]) put(g, new BoxGeometry(0.14, 0.22, 2.3), trim, -hw - 0.1, H * 0.5 + sy * 1.15, z)
    put(g, new BoxGeometry(0.14, 2.2, 0.14), trim, -hw - 0.1, H * 0.5, z)
  }
}

// A lean-to porch along the barn's -x side (its south side once the barn faces the spawn): posts
// and a roof sloping away from the wall, open toward the front.
function buildPorch(g, B, P) {
  const trim = std(B.trim, { roughness: 0.6 })
  const roof = std(B.roof, { roughness: 0.7, flatShading: true })
  const x0 = -B.width / 2
  const front = B.depth / 2 + 0.4
  const back = front - P.depth
  for (const z of [front, (front + back) / 2, back]) put(g, new BoxGeometry(0.35, P.height, 0.35), trim, x0 - P.width + 0.3, P.height / 2, z)
  const slab = put(g, new BoxGeometry(P.width + 0.6, 0.3, P.depth + 0.4), roof, x0 - P.width / 2, P.height + 0.55, (front + back) / 2)
  slab.rotation.z = 0.16
  put(g, new BoxGeometry(0.25, 0.25, P.depth), trim, x0 - P.width + 0.3, P.height, (front + back) / 2)
  return { x0, front, P }
}

// Grey low-poly mountains with snowy tips, sunk into the meadow.
function buildMountains(root) {
  const rock = new MeshStandardMaterial({ color: '#a7acb5', roughness: 1, flatShading: true })
  const snow = new MeshStandardMaterial({ color: '#f2f5f8', roughness: 1, flatShading: true })
  WEST.mountains.forEach(([x, z, r, h], i) => {
    const sides = 6 + (i % 3)
    const m = new Mesh(new ConeGeometry(r, h, sides, 1), rock)
    m.position.set(x, GROUND.sunk + h / 2, z)
    m.rotation.y = i * 1.3
    root.add(m)
    const cap = new Mesh(new ConeGeometry(r * 0.26, h * 0.26, sides, 1), snow)
    cap.position.set(x, GROUND.sunk + h * 0.88, z)
    cap.rotation.y = m.rotation.y
    root.add(cap)
  })
}

export function buildWestScenery(root) {
  const props = new Group()
  const B = WEST.barn
  const barn = new Group()
  barn.position.set(B.x, 0, B.z)
  barn.rotation.y = B.yaw
  props.add(barn)
  buildBarn(barn, B)
  const porch = buildPorch(barn, B, WEST.porch)
  // The barn's footprint in world space: yaw PI/2 turns its depth (local z) along world x.
  solidBox(B.depth / 2, B.height / 2, B.width / 2, B.x, B.height / 2, B.z)
  for (const [x, z, h] of WEST.pines) buildPine(props, x, z, h)
  const orange = new Group()
  for (const [x, z, h] of WEST.orangePines) buildPine(orange, x, z, h)
  const autumn = std('#f08a2a', { roughness: 0.85, flatShading: true })
  orange.traverse((o) => o.isMesh && o.geometry.type === 'ConeGeometry' && (o.material = autumn))
  props.add(orange)
  if (LOBBY.festive) for (const c of WEST.canes) buildCandyCane(props, c)
  root.add(bake(props, true))
  // String lights along the porch's outer edge (an InstancedMesh: kept out of the bake).
  if (LOBBY.festive) {
    const lights = new Group()
    lights.position.copy(barn.position)
    lights.rotation.copy(barn.rotation)
    root.add(lights)
    const { x0, front, P } = porch
    const ox = x0 - P.width + 0.3
    buildStringLights(lights, [[x0 - 0.2, P.height + 0.6, front + 0.1], [ox, P.height + 0.1, front + 0.1], [ox, P.height + 0.1, front - P.depth]], 0.6)
  }
  const sign = label('Partner', 3, { color: '#ffd21a', outline: '#3a2400', outlineWidth: 18 })
  sign.position.set(B.x + B.depth / 2 + 3, B.height + 0.5, B.z - 2)
  root.add(sign)
  buildMountains(root)
}
