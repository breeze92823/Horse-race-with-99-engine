import { BoxGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry, DoubleSide, Euler, Float32BufferAttribute, Group, IcosahedronGeometry, Matrix4, Mesh, PlaneGeometry, Quaternion, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GROUND, LOBBY, PLAZA, RACE } from './config.js'
import { buildOak, fontReady, std } from './propkit.js'
import { mulberry32, paintText } from './textures.js'
import { bake } from './bake.js'

// What the player races past. The meadow is only GROUND.size wide and a race
// scrolls the world past a horse held at RACE.cruiseZ (race.js), so the
// scenery lives in "track" z (where it would be with no scroll) and is drawn at
// track z + scroll. Countryside set pieces (farms with barns and silos,
// windmills, oak groves, hay bales, grandstands full of cheering spectators,
// grazing sheep and cows, hot-air balloons) are built once, merged down to a
// few draw calls each (bake) and recycled: one is placed every
// RACE.scenery.gap m, mostly alternating sides, appears inside the fog ahead
// and goes back to its pool once well behind the horse. A rock, rainbow or
// ranch-gate arch spans the track every archEvery m. The start island (`home`:
// the ranch, lobby, plaza, shops) slides away with the same scroll and is
// hidden once it has gone into the fog, so it never trails the horse.
const S = RACE.scenery
const HALF = LOBBY.gate.halfWidth

// Colours each triangle of a non-indexed geometry by its centroid: crisp stripes.
function paintFaces(geo, colorAt) {
  const pos = geo.attributes.position
  const col = new Float32Array(pos.count * 3)
  const c = new Color()
  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3
    colorAt(x, y, z, c)
    for (let k = 0; k < 3; k++) c.toArray(col, (i + k) * 3)
  }
  geo.setAttribute('color', new Float32BufferAttribute(col, 3))
  return geo
}

const vc = (extra) => std('#ffffff', { vertexColors: true, ...extra })
const part = (geo, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), new Vector3(sx, sy, sz))
  const g = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m)
  for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n)
  return g
}
const UP = new Vector3(0, 1, 0)
// A thin rod between two points (balloon ropes).
function rod(a, b, r) {
  const d = b.clone().sub(a)
  const g = new CylinderGeometry(r, r, d.length(), 5).toNonIndexed()
  g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, d.normalize()))
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  g.deleteAttribute('uv')
  return g
}

// --- Set pieces ------------------------------------------------------------------------------
// Each returns { root, update?(t) }; roots are built at the origin, standing on the meadow
// (GROUND.level), facing -Z (a grandstand faces +Z: it is turned toward the track).
const FOOT = GROUND.level // where everything stands
const ROCK_FOOT = GROUND.sunk // rock arch feet, sunk below the meadow

// A box / sphere / cylinder in one flat colour, as a non-indexed geometry with a vertex colour (for
// pieces merged into one vertex-coloured mesh: the crowd, the herds).
function tinted(geo, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = part(geo, x, y, z, rx, ry, rz, sx, sy, sz)
  const c = new Color(color)
  return paintFaces(g, (px, py, pz, out) => out.copy(c))
}
const put = (g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.rotation.set(rx, ry, rz)
  g.add(m)
  return m
}

// An oak (propkit.js), seeded from the piece's own random stream; no collider out here.
const oak = (g, x, z, h, rand, y = FOOT) => buildOak(g, x, z, h, Math.floor(rand() * 1e6), y, false)

// A gable roof over a w x d box whose walls end at `top`, ridge along its depth (turned by `yaw`):
// two slate slabs over a gable prism (a 3-sided cylinder lying down) in the wall colour.
function gable(g, w, d, top, wall, roof, x = 0, z = 0, yaw = 0) {
  const h = new Group()
  h.position.set(x, 0, z)
  h.rotation.y = yaw
  g.add(h)
  const rise = w * 0.32
  const r = w / Math.sqrt(3) // the prism's triangle spans the wall's width
  const sy = (2 * rise) / (3 * r) // squashed to `rise` tall
  const prism = new CylinderGeometry(r, r, d, 3)
  prism.rotateX(Math.PI / 2)
  prism.rotateZ(Math.PI) // a corner up
  put(h, prism, wall, 0, top + (r / 2) * sy, 0).scale.y = sy
  const slope = Math.hypot(w / 2, rise)
  const a = Math.atan2(rise, w / 2)
  for (const s of [-1, 1]) put(h, new BoxGeometry(slope + 0.6, 0.35, d + 1), roof, s * (w / 4), top + rise / 2 + 0.2, 0, 0, 0, -s * a)
}

// A white post-and-rail fence along a line (farm paddocks).
function fenceLine(g, ax, az, bx, bz, white) {
  const len = Math.hypot(bx - ax, bz - az)
  const yaw = Math.atan2(bx - ax, bz - az)
  const n = Math.max(1, Math.round(len / 3))
  for (let i = 0; i <= n; i++) put(g, new BoxGeometry(0.2, 1.3, 0.2), white, ax + ((bx - ax) * i) / n, FOOT + 0.65, az + ((bz - az) * i) / n)
  for (const y of [0.6, 1.1]) put(g, new BoxGeometry(0.1, 0.14, len), white, (ax + bx) / 2, FOOT + y, (az + bz) / 2, 0, yaw, 0)
}

// Farm: a red barn with white trim and a big X door, a silo, a paddock; variant 1 adds a farmhouse.
function farm(variant, seed) {
  const rand = mulberry32(seed)
  const g = new Group()
  const red = std(S.barns[variant % S.barns.length], { roughness: 0.85 })
  const white = std('#f6f3ea', { roughness: 0.6 })
  const slate = std('#4f5560', { roughness: 0.7 })
  put(g, new BoxGeometry(12, 7, 16), red, 0, FOOT + 3.5, 0)
  gable(g, 12, 16, FOOT + 7, red, slate)
  // Front: white corner trim, a big door with an X brace, a loft door.
  for (const sx of [-1, 1]) put(g, new BoxGeometry(0.4, 7, 0.4), white, sx * 6, FOOT + 3.5, -8)
  put(g, new BoxGeometry(5, 5.4, 0.2), std('#8e2a22', { roughness: 0.9 }), 0, FOOT + 2.7, -8.05)
  for (const s of [-1, 1]) put(g, new BoxGeometry(0.35, 7, 0.25), white, 0, FOOT + 2.7, -8.2, 0, 0, s * 0.75)
  put(g, new BoxGeometry(5.3, 0.35, 0.25), white, 0, FOOT + 5.45, -8.2)
  put(g, new BoxGeometry(2.4, 2, 0.2), white, 0, FOOT + 8.6, -8.05)
  // Silo: banded tower with a dome.
  const steel = std('#c9ccd2', { roughness: 0.45, metalness: 0.3 })
  put(g, new CylinderGeometry(2.6, 2.6, 14, 16), steel, 9.2, FOOT + 7, 2)
  for (let i = 1; i < 5; i++) put(g, new CylinderGeometry(2.68, 2.68, 0.25, 16), slate, 9.2, FOOT + i * 2.8, 2)
  put(g, new SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), slate, 9.2, FOOT + 14, 2)
  // Paddock in front.
  fenceLine(g, -9, -11, 9, -11, white)
  fenceLine(g, -9, -11, -9, -24, white)
  fenceLine(g, 9, -11, 9, -24, white)
  fenceLine(g, -9, -24, 9, -24, white)
  if (variant === 1) {
    put(g, new BoxGeometry(9, 5, 7), white, -16, FOOT + 2.5, 3)
    gable(g, 7, 9, FOOT + 5, white, std('#b8342a', { roughness: 0.8 }), -16, 3, Math.PI / 2)
    put(g, new BoxGeometry(1.4, 2.4, 0.2), std('#3a6ad8'), -16, FOOT + 1.2, -0.55)
  }
  for (let i = 0; i < 3; i++) oak(g, -14 + rand() * 4 + i * 11, 12 + rand() * 6, 8 + rand() * 4, rand)
  return { root: bake(g) }
}

// Windmill: a white tower with a red cap and four lattice sails, turning.
function windmill(seed) {
  const g = new Group()
  put(g, new CylinderGeometry(2.4, 3.8, 14, 8), std('#efe6d6', { roughness: 0.9 }), 0, FOOT + 7, 0)
  put(g, new ConeGeometry(3.3, 4, 8), std('#b8342a', { roughness: 0.8 }), 0, FOOT + 16, 0)
  put(g, new BoxGeometry(1.8, 3, 0.3), std('#6b4428'), 0, FOOT + 1.5, -3.5, -0.12)
  for (const y of [6, 10]) put(g, new BoxGeometry(1.2, 1.2, 0.3), std('#3a6ad8'), 0, FOOT + y, -3.0 + (y - 6) * 0.15, -0.12)
  const root = new Group()
  root.add(bake(g, true))
  const sails = new Group()
  sails.position.set(0, FOOT + 14.5, -3.3)
  const frame = std('#6b4428', { roughness: 0.9 })
  const cloth = std('#fbf6ea', { roughness: 0.9, side: DoubleSide })
  const blades = new Group()
  put(blades, new CylinderGeometry(0.6, 0.6, 1, 10), frame, 0, 0, 0, Math.PI / 2)
  for (let i = 0; i < 4; i++) {
    const arm = new Group()
    arm.rotation.z = (i / 4) * Math.PI * 2
    put(arm, new BoxGeometry(0.4, 10, 0.3), frame, 0, 5, 0)
    put(arm, new BoxGeometry(2.2, 8, 0.1), cloth, 1.2, 5.6, 0.1)
    blades.add(arm)
  }
  sails.add(bake(blades, true))
  root.add(sails)
  const phase = seed
  return { root, update: (t) => (sails.rotation.z = t * 0.9 + phase) }
}

// A grove of round oaks and bushes (variants: a few big trees, a wide copse).
function grove(variant, seed) {
  const rand = mulberry32(seed)
  const g = new Group()
  const n = variant === 0 ? 3 : 7
  const spread = variant === 0 ? 8 : 18
  for (let i = 0; i < n; i++) oak(g, (rand() - 0.5) * spread * 2, (rand() - 0.5) * spread, 9 + rand() * 6, rand)
  const bush = std('#3f9e32', { roughness: 1, flatShading: true })
  for (let i = 0; i < n + 2; i++) put(g, new IcosahedronGeometry(1.4 + rand() * 1.2, 1), bush, (rand() - 0.5) * spread * 2.2, FOOT + 0.6, (rand() - 0.5) * spread * 1.2).scale.y = 0.7
  return { root: bake(g, true) }
}

// Hay: round bales lying in the grass and a stack of square ones.
function hay(seed) {
  const rand = mulberry32(seed)
  const g = new Group()
  const straw = std('#e8c25a', { roughness: 1 })
  const end = std('#d6a83e', { roughness: 1 })
  for (let i = 0; i < 4; i++) {
    const x = -8 + i * 4.2 + rand()
    const z = (rand() - 0.5) * 6
    const yaw = rand() * Math.PI
    const bale = new Group()
    put(bale, new CylinderGeometry(1.3, 1.3, 1.6, 16), straw, 0, 0, 0, 0, 0, Math.PI / 2)
    for (const s of [-1, 1]) put(bale, new CylinderGeometry(1.0, 1.0, 0.04, 16), end, s * 0.82, 0, 0, 0, 0, Math.PI / 2)
    bale.position.set(x, FOOT + 1.3, z)
    bale.rotation.y = yaw
    g.add(bale)
  }
  // Square bales: three, two, one.
  const block = new BoxGeometry(2.2, 1, 1.2)
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 3 - row; i++) put(g, block, straw, 10 + (i - (2 - row) / 2) * 2.3, FOOT + 0.5 + row, 2)
  return { root: bake(g, true) }
}

// Grandstand facing +Z: concrete tiers full of spectators (cheering: they bounce), a roof on
// posts with pennants.
function grandstand(seed) {
  const rand = mulberry32(seed)
  const g = new Group()
  const L = 26
  const tiers = 5
  const concrete = std('#d8dde6', { roughness: 0.9 })
  for (let i = 0; i < tiers; i++) put(g, new BoxGeometry(L, 0.9 * (i + 1), 1.5), concrete, 0, FOOT + 0.45 * (i + 1), -i * 1.5)
  const blue = std('#2f6bdc', { roughness: 0.6 })
  for (const sx of [-1, 1]) for (const z of [1, -7]) put(g, new CylinderGeometry(0.2, 0.2, 9.5, 8), std('#e8eef8'), sx * (L / 2 - 0.4), FOOT + 4.75, z)
  put(g, new BoxGeometry(L + 1, 0.3, 9.4), blue, 0, FOOT + 9.6, -3, 0.08)
  const pennant = new ConeGeometry(0.6, 1.6, 3)
  for (let i = 0; i < 9; i++) put(g, pennant, std(S.crowd[i % S.crowd.length]), -L / 2 + 1.5 + i * ((L - 3) / 8), FOOT + 10.6, -7.5, 0, 0, Math.PI / 2)
  const root = new Group()
  root.add(bake(g, true))
  // The crowd: one vertex-coloured mesh, a body and a head per seat (some seats empty).
  const people = []
  const skins = ['#f2c79a', '#d9a066', '#a8683c', '#7a4a26', '#ffe0bd']
  const bodyGeo = new BoxGeometry(0.6, 0.9, 0.45)
  const headGeo = new BoxGeometry(0.45, 0.45, 0.45)
  for (let i = 0; i < tiers; i++)
    for (let x = -L / 2 + 0.8; x < L / 2 - 0.6; x += 0.85) {
      if (rand() < 0.2) continue
      const y = FOOT + 0.9 * (i + 1)
      const z = -i * 1.5
      people.push(tinted(bodyGeo, S.crowd[Math.floor(rand() * S.crowd.length)], x, y + 0.45, z))
      people.push(tinted(headGeo, skins[Math.floor(rand() * skins.length)], x, y + 1.15, z))
    }
  const crowd = new Mesh(mergeGeometries(people), vc({ roughness: 0.8 }))
  for (const p of people) p.dispose()
  root.add(crowd)
  const phase = seed
  return { root, update: (t) => (crowd.position.y = Math.abs(Math.sin(t * 5 + phase)) * 0.18) }
}

// A herd grazing in the meadow: sheep (variant 0) or black-and-white cows (variant 1).
function herd(variant, seed) {
  const rand = mulberry32(seed)
  const pieces = []
  const box = (w, h, d) => new BoxGeometry(w, h, d)
  const n = variant === 0 ? 8 : 5
  for (let i = 0; i < n; i++) {
    const x = (rand() - 0.5) * 22
    const z = (rand() - 0.5) * 14
    const yaw = rand() * Math.PI * 2
    const k = variant === 0 ? 1 : 1.5
    const at = (lx, ly, lz) => [x + Math.cos(yaw) * lx + Math.sin(yaw) * lz, FOOT + ly, z - Math.sin(yaw) * lx + Math.cos(yaw) * lz]
    const add = (geo, color, lx, ly, lz) => pieces.push(tinted(geo, color, ...at(lx * k, ly * k, lz * k), 0, yaw, 0, k, k, k))
    const legs = variant === 0 ? '#2a2a2e' : '#f4f4f4'
    for (const [lx, lz] of [[-0.35, 0.55], [0.35, 0.55], [-0.35, -0.55], [0.35, -0.55]]) add(box(0.2, 0.6, 0.2), legs, lx, 0.3, lz)
    if (variant === 0) {
      add(box(1.1, 0.8, 1.6), '#f6f4ee', 0, 0.95, 0) // wool
      add(box(0.45, 0.5, 0.5), '#2a2a2e', 0, 0.85, 0.95) // head, grazing low
    } else {
      add(box(1.0, 0.8, 1.7), '#f4f4f4', 0, 1.0, 0)
      // Black patches: slabs a little wider than the body, so they show on both flanks.
      add(box(1.04, 0.42, 0.5), '#1d1d22', 0, 1.12, 0.25)
      add(box(1.04, 0.36, 0.42), '#1d1d22', 0, 0.94, -0.5)
      add(box(0.5, 0.5, 0.6), '#1d1d22', 0, 0.95, 1.05)
      add(box(0.46, 0.25, 0.2), '#f2a8b4', 0, 0.82, 1.4)
    }
  }
  const mesh = new Mesh(mergeGeometries(pieces), vc({ roughness: 0.9 }))
  for (const p of pieces) p.dispose()
  const root = new Group()
  root.add(mesh)
  return { root }
}

// Hot-air balloon: striped teardrop envelope, wicker basket on four ropes.
function balloon(colors, seed) {
  const env = new SphereGeometry(1, 16, 12).toNonIndexed()
  const pos = env.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const w = y < 0 ? 1 + y * 0.48 : 1 // narrow toward the mouth
    pos.setXYZ(i, pos.getX(i) * w * 6, y * 7, pos.getZ(i) * w * 6)
  }
  env.computeVertexNormals()
  const palette = colors.map((c) => new Color(c))
  paintFaces(env, (x, y, z, c) => c.copy(palette[Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 12) % palette.length]))
  const g = new Group()
  g.add(new Mesh(env, vc({ roughness: 0.5 })))
  const basket = new Mesh(new BoxGeometry(2.4, 1.7, 2.4), std('#8a5a2b', { roughness: 1 }))
  basket.position.y = -11
  g.add(basket)
  const ropes = []
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) ropes.push(rod(new Vector3(sx * 1.1, -10.2, sz * 1.1), new Vector3(sx * 1.9, -6.4, sz * 1.9), 0.06))
  g.add(new Mesh(mergeGeometries(ropes), std('#5a3a1e', { roughness: 1 })))
  const baked = bake(g)
  const root = new Group()
  root.add(baked)
  const phase = seed * 2.3
  return {
    root,
    update(t) {
      baked.position.y = Math.sin(t * 0.6 + phase) * 1.2
      baked.rotation.y = t * 0.08 + phase
    },
  }
}

// An arch over the track: lumpy rock with oaks on top, an inflatable rainbow, or a log ranch gate
// with a sign.
function arch(kind, seed) {
  const R = HALF + 8 // feet clear of the fences
  const g = new Group()
  if (kind === 'rock') {
    const rand = mulberry32(seed)
    const geo = new TorusGeometry(R, 3.8, 8, 30, Math.PI).toNonIndexed()
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const n = Math.sin(x * 0.31 + seed) * Math.cos(y * 0.37) + Math.sin(z * 0.9 + y * 0.2) * 0.6
      pos.setXYZ(i, x * (1 + n * 0.03), y + n * 0.8, z * (1 + n * 0.12))
    }
    geo.computeVertexNormals()
    const dark = new Color(PLAZA.rockDark)
    const rock = new Color(PLAZA.rock)
    const grass = new Color(PLAZA.grass)
    paintFaces(geo, (x, y, z, c) => (y > R + 1.2 ? c.copy(grass) : c.copy(dark).lerp(rock, Math.min(1, y / R))))
    g.add(new Mesh(geo, vc({ flatShading: true, roughness: 0.95 })))
    const rockMat = std(PLAZA.rockDark, { flatShading: true, roughness: 0.95 })
    for (const sx of [-1, 1]) {
      const foot = new Mesh(new DodecahedronGeometry(6.5), rockMat)
      foot.position.set(sx * R, 0, 0)
      foot.rotation.set(rand() * 3, rand() * 3, 0)
      g.add(foot)
    }
    for (const a of [1.35, 1.75]) oak(g, Math.cos(a) * R, 0, 8, rand, Math.sin(a) * R + 2.6)
  } else if (kind === 'ranch') {
    // Two log posts, a log beam and a sign board, a golden horseshoe hanging under it.
    const log = std('#8a5a2e', { roughness: 0.95 })
    const H = 13
    for (const sx of [-1, 1]) {
      put(g, new CylinderGeometry(0.9, 1.1, H + 1.5, 10), log, sx * (HALF + 3), H / 2, 0)
      put(g, new SphereGeometry(1.0, 10, 6), log, sx * (HALF + 3), H + 0.8, 0)
    }
    put(g, new CylinderGeometry(0.75, 0.75, 2 * HALF + 9, 10), log, 0, H - 0.6, 0, 0, 0, Math.PI / 2)
    const sign = paintText('GIDDY UP!', { color: '#ffd21a', outline: '#3a210e', bg: '#8a5a2e', pad: 40 })
    const tex = new CanvasTexture(sign.canvas)
    tex.colorSpace = SRGBColorSpace
    fontReady.then(() => {
      sign.draw()
      tex.needsUpdate = true
    })
    const w = 16
    // The board: a plane faces +Z, the side the riders come from, so it reads as is.
    put(g, new PlaneGeometry(w, (w * sign.canvas.height) / sign.canvas.width), std('#ffffff', { map: tex, roughness: 0.9, side: DoubleSide }), 0, H + 1.9, 0)
    put(g, new TorusGeometry(1.4, 0.32, 8, 20, Math.PI * 1.4), std('#ffcf3a', { roughness: 0.3, metalness: 0.7 }), 0, H - 2.6, 0, 0, 0, Math.PI * 0.8) // a U, open at the top (for luck)
  } else {
    const palette = S.rainbow.map((c) => new Color(c))
    const T = 2.6
    const geo = paintFaces(new TorusGeometry(R, T, 14, 44, Math.PI).toNonIndexed(), (x, y, z, c) => {
      const t = (Math.hypot(x, y) - (R - T)) / (2 * T) // inner edge 0 .. outer edge 1
      c.copy(palette[Math.min(palette.length - 1, Math.max(0, Math.floor((1 - t) * palette.length)))])
    })
    g.add(new Mesh(geo, vc({ roughness: 0.35, emissive: '#222222' })))
    const white = std('#ffffff', { roughness: 0.4 })
    for (const sx of [-1, 1]) {
      const pod = new Mesh(new SphereGeometry(4, 18, 12), white)
      pod.position.set(sx * R, 0.4, 0)
      pod.scale.set(1, 0.55, 1)
      g.add(pod)
    }
  }
  g.position.y = kind === 'rock' ? ROCK_FOOT : FOOT
  const root = new Group()
  root.add(bake(g, true))
  return { root }
}

// --- Placement ------------------------------------------------------------------------------
const lerp = ([lo, hi], t) => lo + (hi - lo) * t

export function createRaceScenery(scene, home) {
  let built = null // kind -> [{ root, update?, reset?, busy }]
  let arches = null
  const active = [] // { piece, z } (z = track z)
  let cursor = 0 // track z of the next set piece
  let nextArch = 0 // track z of the next arch
  let side = 1
  let archKind = 0
  let t = 0
  const homeZ = []
  const homeVisible = []
  const rand = Math.random

  function build() {
    if (built) return
    const add = (piece) => {
      piece.root.visible = false
      piece.busy = false
      scene.add(piece.root)
      return piece
    }
    let seed = 300
    built = {
      farm: [0, 1, 2, 1].map((v) => add(farm(v, seed++))),
      windmill: [0, 1].map(() => add(windmill(seed++))),
      grove: [0, 1, 0, 1, 0, 1].map((v) => add(grove(v, seed++))),
      hay: [0, 1, 2].map(() => add(hay(seed++))),
      grandstand: [0, 1].map(() => add(grandstand(seed++))),
      herd: [0, 1, 0, 1].map((v) => add(herd(v, seed++))),
      balloon: S.balloons.map((c) => add(balloon(c, seed++))),
    }
    arches = [add(arch('ranch', seed++)), add(arch('rock', seed++)), add(arch('rainbow', seed++))]
  }
  // Built while the lobby idles, so the first race doesn't hitch.
  setTimeout(build, 2500)

  function place(piece, x, y, z, yaw) {
    piece.busy = true
    piece.root.visible = true
    piece.root.position.set(x, y, z)
    piece.root.rotation.y = yaw
    piece.reset?.(t)
    active.push({ piece, z })
  }

  // One set piece at track z: a kind by weight among those with a free model.
  function placeNext(z) {
    let total = 0
    const free = []
    for (const [kind, spec] of Object.entries(S.kinds)) {
      const piece = built[kind].find((p) => !p.busy)
      if (!piece) continue
      free.push([spec, piece, kind])
      total += spec.weight
    }
    let pick = rand() * total
    const hit = free.find(([spec]) => (pick -= spec.weight) <= 0)
    if (!hit) return
    const [spec, piece, kind] = hit
    if (rand() < 0.8) side = -side // mostly alternating, sometimes two on one side
    const x = side * lerp(spec.x, rand())
    const y = spec.y ? lerp(spec.y, rand()) : 0
    const yaw = spec.facesLane ? (-side * Math.PI) / 2 : rand() * Math.PI * 2 // a grandstand's front (+Z) toward the track
    // The used model goes to the back of its pool, so the next of this kind is another variant.
    built[kind].push(built[kind].splice(built[kind].indexOf(piece), 1)[0])
    place(piece, x, y, z, yaw)
  }

  function setHome(offset) {
    const hide = offset > S.homeHide
    home.forEach((o, i) => {
      o.position.z = homeZ[i] + offset
      o.visible = hide ? false : homeVisible[i]
    })
  }

  return {
    start() {
      build()
      t = 0
      side = rand() < 0.5 ? -1 : 1
      cursor = LOBBY.gate.z - S.first
      nextArch = LOBBY.gate.z - S.archFirst
      home.forEach((o, i) => {
        homeZ[i] = o.position.z
        homeVisible[i] = o.visible
      })
    },
    stop() {
      for (const a of active) {
        a.piece.busy = false
        a.piece.root.visible = false
      }
      active.length = 0
      if (homeZ.length) setHome(0)
      homeZ.length = homeVisible.length = 0
    },
    // scroll: m the world has slid toward +Z; horseZ: the horse's world z.
    update(dt, scroll, horseZ) {
      if (!built) return
      t += dt
      while (cursor + scroll > horseZ - S.ahead) {
        placeNext(cursor)
        cursor -= lerp(S.gap, rand())
      }
      while (nextArch + scroll > horseZ - S.ahead) {
        const piece = arches[archKind++ % arches.length]
        if (!piece.busy) place(piece, 0, 0, nextArch, 0)
        nextArch -= S.archEvery
      }
      for (let i = active.length - 1; i >= 0; i--) {
        const a = active[i]
        const z = a.z + scroll
        if (z > horseZ + S.behind) {
          a.piece.busy = false
          a.piece.root.visible = false
          active.splice(i, 1)
          continue
        }
        a.piece.root.position.z = z
        a.piece.update?.(t)
      }
      setHome(scroll)
    },
  }
}
