import { BoxGeometry, CanvasTexture, CapsuleGeometry, ConeGeometry, CylinderGeometry, Group, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import { BEACH, ISLET, LOBBY, PLAZA, TOWN, WATER } from './config.js'
import { bake } from './bake.js'
import { buildCliff, fontReady, neon, put, std } from './propkit.js'
import { mulberry32, paintDirt, paintPlanks, paintText, toTexture } from './textures.js'
import { buildSlab, hillTop, makeHill } from './world.js'

// The Frontier Town world's scenery (environment.js shows it instead of the ranch's; world id
// `city`). Everything stands where the ranch's scenery stands, so the shared colliders fit:
//  - a dusty main street: the slab in sun-baked dirt
//  - red sandstone buttes on the tall plaza cliffs' footprints (the waterfall still pours off one)
//  - wooden false-front storefronts on the low ones, fronts turned toward the plaza: a plank
//    body, a taller square facade with the shop's sign, a porch roof on posts over a boardwalk,
//    windows and a door
//  - red mesas round the far horizon instead of the green hills (kept off the race track)
//  - a dry hill with a wooden water tower on it
//  - saguaro cacti and oil-lamp posts where the ranch's oaks stand, a welcome sign at the pump
// Buildings and mesas are baked to a few meshes per material (bake.js).
const lerp = ([lo, hi], t) => lo + (hi - lo) * t

function materials() {
  const planks = toTexture(paintPlanks(512, 8, 31, TOWN.planks).color, { srgb: true }) // tiled by plankBox's UVs
  return {
    planks,
    walls: TOWN.walls.map((c) => std(c, { map: planks, roughness: 0.85 })),
    trim: std(TOWN.trim, { roughness: 0.6 }),
    roof: std(TOWN.roof, { roughness: 0.85 }),
    glass: std('#2a3a4a', { roughness: 0.2, metalness: 0.3 }),
    door: std('#5a3418', { roughness: 0.8 }),
    board: std('#a87042', { map: planks, roughness: 0.9 }),
  }
}

// A box whose side faces tile `tile` m per texture repeat (planks keep their size on any wall).
function plankBox(w, h, d, tile = 4) {
  const geo = new BoxGeometry(w, h, d)
  const uv = geo.attributes.uv
  const across = [d, d, w, w, w, w] // +x, -x, +y, -y, +z, -z
  const up = [h, h, d, d, h, h]
  for (let f = 0; f < 6; f++)
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k
      uv.setXY(i, (uv.getX(i) * across[f]) / tile, (uv.getY(i) * up[f]) / tile)
    }
  return geo
}

// A sign board with the shop's name, painted once Fredoka has loaded.
function sign(text, width) {
  const t = paintText(text, { color: '#3a210e', outline: '#f6e7c8', bg: '#f6e7c8', pad: 28, outlineWidth: 2 })
  const tex = new CanvasTexture(t.canvas)
  tex.colorSpace = SRGBColorSpace
  fontReady.then(() => {
    t.draw()
    tex.needsUpdate = true
  })
  const h = Math.min(1.6, (width * t.canvas.height) / t.canvas.width)
  return { geo: new PlaneGeometry(width, h), mat: std('#ffffff', { map: tex, roughness: 0.9 }), h }
}

// One storefront `w` wide and `D` deep in a row frame (front +Z at z = D / 2), centred on x.
function storefront(g, m, rand, x, w, D, name, tall) {
  const wall = m.walls[Math.floor(rand() * m.walls.length)]
  const H = tall ? 8 + rand() * 2 : 5 + rand() * 1.5
  put(g, plankBox(w - 0.3, H, D - 0.4), wall, x, H / 2, 0)
  put(g, new BoxGeometry(w - 0.1, 0.4, D), m.roof, x, H + 0.2, 0)
  // The false front: a taller square board face with a cornice and the sign.
  const F = H + 2.4 + rand() * 1.4
  put(g, plankBox(w - 0.2, F, 0.35), wall, x, F / 2, D / 2 - 0.1)
  put(g, new BoxGeometry(w + 0.2, 0.35, 0.6), m.trim, x, F + 0.15, D / 2 - 0.1)
  const s = sign(name, Math.min(w - 1.4, 7.5))
  put(g, s.geo, s.mat, x, F - s.h / 2 - 0.5, D / 2 + 0.09)
  // Porch: boardwalk, posts and a roof over the door.
  const P = 2.4
  put(g, new BoxGeometry(w - 0.2, 0.3, P), m.board, x, 0.15, D / 2 + P / 2)
  for (const sx of [-1, 1]) put(g, new BoxGeometry(0.2, 3.6, 0.2), m.trim, x + sx * (w / 2 - 0.4), 1.8, D / 2 + P - 0.2)
  put(g, new BoxGeometry(w - 0.1, 0.2, P + 0.3), m.roof, x, 3.7, D / 2 + P / 2, 0.12)
  // Door (swing doors on the saloon), windows either side, upstairs windows on tall ones.
  put(g, new BoxGeometry(1.6, 2.6, 0.1), m.door, x, 1.6, D / 2 + 0.1)
  for (const sx of [-1, 1]) {
    if (w > 5) {
      put(g, new BoxGeometry(1.5, 1.6, 0.1), m.glass, x + sx * (w / 4 + 0.4), 1.9, D / 2 + 0.1)
      put(g, new BoxGeometry(1.8, 0.15, 0.2), m.trim, x + sx * (w / 4 + 0.4), 1.05, D / 2 + 0.15)
    }
    if (tall) put(g, new BoxGeometry(1.2, 1.5, 0.1), m.glass, x + sx * (w / 4), H - 2.2, D / 2 + 0.1)
  }
}

// A row of storefronts on a low cliff's footprint [x, z, w, d, h, yaw], fronts toward TOWN.plaza.
function buildShops(root, m, [x, z, w, d, h, yaw], names, seed) {
  const rand = mulberry32(seed)
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = yaw
  root.add(g)
  // The plaza in the footprint's frame picks which side is the front.
  const [px, pz] = TOWN.plaza
  const vx = px - x
  const vz = pz - z
  const lx = vx * Math.cos(yaw) - vz * Math.sin(yaw)
  const lz = vx * Math.sin(yaw) + vz * Math.cos(yaw)
  const alongX = w >= d
  const row = new Group()
  row.rotation.y = alongX ? (lz > 0 ? 0 : Math.PI) : lx > 0 ? Math.PI / 2 : -Math.PI / 2
  g.add(row)
  const L = (alongX ? w : d) + 1.2 // the collider's 0.6 m margin (cliffCollider)
  const D = (alongX ? d : w) - 1.6 // leave room for the porch inside the footprint
  const n = Math.max(1, Math.min(3, Math.round(L / 10)))
  for (let i = 0; i < n; i++) storefront(row, m, rand, -L / 2 + (L / n) * (i + 0.5), L / n, D, names.shift() ?? 'GENERAL STORE', h > 14 && i !== 1)
}

// The far horizon: red mesas on rings round the island, none in the race track's way (-Z).
function buildMesas(root) {
  const S = TOWN.mesas
  const rand = mulberry32(S.seed)
  const g = new Group()
  let placed = 0
  for (let tries = 0; placed < S.count && tries < S.count * 6; tries++) {
    const a = rand() * Math.PI * 2
    const dist = lerp(S.distance, rand())
    const x = Math.cos(a) * dist
    const z = Math.sin(a) * dist
    if (z < 0 && Math.abs(x) < 130) continue // the race track
    buildCliff(g, [x, z, lerp(S.width, rand()), lerp(S.width, rand()) * 0.6, lerp(S.height, rand() * rand()), rand() * Math.PI], 900 + placed, WATER.level - 1, false, TOWN.rock)
    placed++
  }
  root.add(bake(g))
}

// A wooden water tower: four splayed legs with braces, a banded tank and a cone roof.
function waterTower(root, x, y, z) {
  const T = TOWN.tower
  const g = new Group()
  g.position.set(x, y, z)
  root.add(g)
  const wood = std(T.wood, { roughness: 0.9 })
  const H = 9
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = put(g, new BoxGeometry(0.4, H + 0.4, 0.4), wood, sx * 2.1, H / 2, sz * 2.1)
    leg.rotation.set(-sz * 0.06, 0, sx * 0.06)
  }
  for (const yy of [3, 6]) {
    put(g, new BoxGeometry(4.6, 0.25, 0.25), wood, 0, yy, 2.2)
    put(g, new BoxGeometry(4.6, 0.25, 0.25), wood, 0, yy, -2.2)
    put(g, new BoxGeometry(0.25, 0.25, 4.6), wood, 2.2, yy, 0)
    put(g, new BoxGeometry(0.25, 0.25, 4.6), wood, -2.2, yy, 0)
  }
  put(g, new BoxGeometry(5.2, 0.4, 5.2), wood, 0, H, 0)
  put(g, new CylinderGeometry(2.8, 2.8, 5, 18), std(T.tank, { roughness: 0.85 }), 0, H + 2.7, 0)
  for (const yy of [1, 2.7, 4.4]) put(g, new CylinderGeometry(2.86, 2.86, 0.18, 18), std('#3a3d44', { metalness: 0.5 }), 0, H + yy, 0)
  put(g, new ConeGeometry(3.2, 2.2, 18), std(T.roof, { roughness: 0.85 }), 0, H + 6.3, 0)
}

// A saguaro: a ribbed column with two arms, about 0.6 x the oak it replaces.
function cactus(root, x, z, height, seed) {
  const rand = mulberry32(seed)
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = rand() * Math.PI
  root.add(g)
  const H = height * 0.6
  const r = H * 0.07
  const mat = std(TOWN.cactus, { roughness: 0.8, flatShading: true })
  const col = (len, rr) => new CapsuleGeometry(rr, len, 3, 8)
  put(g, col(H - 2 * r, r), mat, 0, H / 2, 0)
  for (const [s, at, up] of [[1, 0.35 + rand() * 0.15, 0.3], [-1, 0.5 + rand() * 0.15, 0.22]]) {
    const out = r * 2.6
    put(g, col(out, r * 0.7), mat, s * (r + out / 2), H * at, 0).rotation.z = Math.PI / 2
    put(g, col(H * up, r * 0.7), mat, s * (r + out), H * at + (H * up) / 2, 0)
  }
}

// An oil-lamp post: a wooden post with a cross arm and a glowing lantern.
function lampPost(root, x, z, height) {
  const L = TOWN.lamp
  const H = Math.min(6, height * 0.45)
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = Math.atan2(-x, -z)
  root.add(g)
  const post = std(L.post, { roughness: 0.9 })
  put(g, new BoxGeometry(0.3, H, 0.3), post, 0, H / 2, 0)
  put(g, new BoxGeometry(1.2, 0.18, 0.18), post, 0.5, H - 0.3, 0)
  put(g, new BoxGeometry(0.42, 0.6, 0.42), neon(L.light, 2.2), 1.0, H - 0.75, 0, false)
  put(g, new ConeGeometry(0.36, 0.3, 4), std('#2a2a2e'), 1.0, H - 0.3, 0)
}

// The welcome sign at the ranch's pump spot: two posts and a board, facing the spawn.
function welcome(root, { x, z }) {
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = Math.atan2(-x, 8 - z) // toward the spawn
  root.add(g)
  const wood = std('#8a5a32', { roughness: 0.9 })
  for (const sx of [-1, 1]) put(g, new BoxGeometry(0.35, 5, 0.35), wood, sx * 2.6, 2.5, 0)
  const s = sign('WELCOME TO\nFRONTIER TOWN', 5.6)
  put(g, new BoxGeometry(6, s.h + 0.5, 0.2), wood, 0, 3.6, 0)
  put(g, s.geo, s.mat, 0, 3.6, 0.11)
}

export function buildTown(root) {
  const m = materials()

  // Desert sand on the same slab.
  const top = new MeshStandardMaterial({ map: toTexture(paintDirt(256, 909, ...TOWN.sand), { repeat: 1 / BEACH.dirtTile, srgb: true }), roughness: 1 })
  buildSlab(root, top, TOWN.side)

  // Buttes on the tall footprints, storefronts on the low ones.
  const names = [...TOWN.shops]
  const town = new Group()
  PLAZA.cliffs.forEach((c, i) => {
    if (c[4] >= TOWN.butteFrom) buildCliff(town, c, 20 + i * 7, 0, false, TOWN.rock)
    else buildShops(town, m, c, names, 20 + i * 7)
  })
  root.add(bake(town, true))

  buildMesas(root)

  // The hill, dry, with the water tower on top.
  const I = ISLET
  root.add(...makeHill(I.x, I.z, I.hill.rx, I.hill.ry, I.hill.rz, '#b5a25a', 14))
  const tower = new Group()
  waterTower(tower, I.x, hillTop(0, 0) - 0.5, I.z)
  root.add(bake(tower, true))

  // Cacti and lamp posts where the ranch's oaks stand (the ones up on the cliffs are dropped).
  const props = new Group()
  LOBBY.trees.forEach(([x, z, h], i) => (i % 2 ? lampPost(props, x, z, h) : cactus(props, x, z, h, 100 + i)))
  for (const [x, z, y, h] of PLAZA.trees) if (y === 0) cactus(props, x, z, h, 300 + x)
  welcome(props, LOBBY.pump)
  root.add(bake(props, true))
}
