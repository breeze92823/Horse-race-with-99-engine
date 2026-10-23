import {
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
} from 'three'
import { GROUND, HILL, TOWN, YARD } from './config.js'
import { RAPIER, addFixed } from './physics.js'
import { mulberry32, paintDirt, paintGrass, toTexture } from './textures.js'
import { buildOak } from './propkit.js'
import { bake } from './bake.js'

// The lobby ground: the ranch's grass yard with packed-dirt areas, a slab just
// proud of a grass meadow that runs to the horizon (the race track crosses it),
// with green hills on the far left horizon, a wooded hill to the east, and
// puffy clouds in the sky. The meadow and clouds are shared by every world
// (createWorld); the land is built per world (buildRanchLand here, the Frontier
// Town's in town.js, both through buildSlab; environment.js shows one).
// Physically the land is one convex-hull collider plus an invisible fence on
// every edge (landColliders, the same in every world).
//
// Texture techniques used here:
//  - yard: the grass painter (colour + bump) and the dirt painter, world-space
//    UVs (ExtrudeGeometry caps and ShapeGeometry use shape coordinates = metres)
//  - meadow: the grass painter's colour + bump, its v offset scrolled by a race

// The start island's outline in world (x, z), counter-clockwise seen from above. Convex.
export function yardOutline() {
  const { front, back, halfWidth: W, wingZ, gateEdge } = YARD
  return [
    [-W, back],
    [W, back],
    [W, wingZ],
    [gateEdge, front],
    [-gateEdge, front],
    [-W, wingZ],
  ]
}

// Shape space is (x, -z): rotating the extrusion -90 deg about X maps shape y to world -z and depth to +y.
function outlineShape(points, scale = 1, cz = 0) {
  const s = new Shape()
  points.forEach(([x, z], i) => {
    const sx = x * scale
    const sz = cz + (z - cz) * scale
    if (i === 0) s.moveTo(sx, -sz)
    else s.lineTo(sx, -sz)
  })
  s.closePath()
  return s
}

export function makeHill(x, z, rx, ry, rz, color, seed) {
  const geo = new SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2)
  const rand = mulberry32(seed)
  const bumps = Array.from({ length: 4 }, () => ({ a: rand() * Math.PI * 2, f: 2 + Math.floor(rand() * 3), k: 0.04 + rand() * 0.05 }))
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i)
    const py = pos.getY(i)
    const pz = pos.getZ(i)
    const ang = Math.atan2(pz, px)
    let k = 1
    for (const b of bumps) k += Math.sin(ang * b.f + b.a) * b.k * py
    pos.setXYZ(i, px * k, py, pz * k)
  }
  geo.computeVertexNormals()
  const hill = new Mesh(geo, new MeshStandardMaterial({ color, roughness: 1 }))
  hill.scale.set(rx, ry, rz)
  hill.position.set(x, GROUND.sunk, z)
  return [hill]
}

function makeClouds() {
  const rand = mulberry32(2024)
  const geo = new IcosahedronGeometry(1, 3)
  const mat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#dcebff', emissiveIntensity: 0.62, fog: false })
  const group = new Group()
  for (let i = 0; i < 22; i++) {
    // Mostly ahead (down the race track, -Z), a few all around.
    const ang = i < 15 ? -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.25 : rand() * Math.PI * 2
    const dist = 240 + rand() * 170
    const cloud = new Group()
    const puffs = 5 + Math.floor(rand() * 4)
    const len = 22 + rand() * 26
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5
      const r = (1 - Math.abs(t) * 1.1) * (9 + rand() * 6)
      const puff = new Mesh(geo, mat)
      puff.scale.set(r, r * 0.82, r)
      puff.position.set(t * len, r * 0.25 + rand() * 3, (rand() - 0.5) * 8)
      cloud.add(puff)
    }
    const flat = new Mesh(geo, mat) // flat underside
    flat.scale.set(len * 0.62, 4, 9)
    cloud.add(flat)
    cloud.position.set(Math.cos(ang) * dist, 30 + rand() * 70, Math.sin(ang) * dist)
    cloud.lookAt(0, cloud.position.y, 0)
    group.add(cloud)
  }
  return group
}

// The slab of land the start island stands on (the ranch's grass, the Frontier Town's dirt):
// `top` is the material of its flat top (UVs in metres), `side` the colour of its rounded edge.
// Its top sits just over the meadow. Visual only (landColliders is shared by every world).
export function buildSlab(root, top, side) {
  const bevel = 0.6
  const slabGeo = new ExtrudeGeometry(outlineShape(yardOutline()), {
    depth: YARD.depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: 1.2,
    bevelSegments: 3,
    curveSegments: 1,
  })
  slabGeo.rotateX(-Math.PI / 2)
  const slab = new Mesh(slabGeo, [top, new MeshStandardMaterial({ color: side, roughness: 1 })])
  slab.position.y = -(YARD.depth + bevel)
  slab.receiveShadow = true
  root.add(slab)
}

// A rounded rectangle [x0, z0, x1, z1, r] as a Shape in outlineShape's (x, -z) space.
function roundedRect([x0, z0, x1, z1, r]) {
  const s = new Shape()
  const [a, b, c, d] = [x0, -z1, x1, -z0] // shape-space min x, min y, max x, max y
  s.moveTo(a + r, b)
  s.lineTo(c - r, b)
  s.quadraticCurveTo(c, b, c, b + r)
  s.lineTo(c, d - r)
  s.quadraticCurveTo(c, d, c - r, d)
  s.lineTo(a + r, d)
  s.quadraticCurveTo(a, d, a, d - r)
  s.lineTo(a, b + r)
  s.quadraticCurveTo(a, b, a + r, b)
  return s
}

// The ranch's land: a grass yard with packed-dirt areas (one mesh: overlapping patches share
// world-space UVs, so they join seamlessly), green hills on the far left horizon and the wooded
// hill to the east.
export function buildRanchLand(root) {
  const grass = paintGrass()
  const top = new MeshStandardMaterial({
    color: YARD.grass,
    map: toTexture(grass.color, { repeat: 1 / GROUND.tile, srgb: true }),
    bumpMap: toTexture(grass.height, { repeat: 1 / GROUND.tile }),
    bumpScale: 0.6,
    roughness: 1,
  })
  buildSlab(root, top, YARD.side)
  const dirtGeo = new ShapeGeometry(YARD.dirt.map(roundedRect), 6)
  dirtGeo.rotateX(-Math.PI / 2)
  const dirt = new Mesh(dirtGeo, new MeshStandardMaterial({ map: toTexture(paintDirt(), { repeat: 1 / YARD.dirtTile, srgb: true }), roughness: 1 }))
  dirt.position.y = 0.02
  dirt.receiveShadow = true
  root.add(dirt)

  // Far scenery: green hills on the left horizon, a hazy mountain behind them.
  root.add(
    ...makeHill(-250, -300, 120, 30, 60, '#4dbb3c', 11),
    ...makeHill(-130, -360, 55, 18, 35, '#45ad37', 12),
    ...makeHill(-400, -470, 150, 60, 80, '#6f9fd6', 13),
  )

  // The hill out east, with oaks on it.
  const I = HILL
  root.add(...makeHill(I.x, I.z, I.hill.rx, I.hill.ry, I.hill.rz, '#4dbb3c', 14))
  const oaks = new Group()
  I.trees.forEach(([x, z, h], i) => buildOak(oaks, I.x + x, I.z + z, h, 50 + i, hillTop(x, z) - 0.4, false))
  root.add(bake(oaks, true))
}

// Height of the hill's surface (makeHill: a squashed dome sunk to GROUND.sunk) at (x, z) from
// its centre, ignoring its bumps.
export function hillTop(x, z) {
  const { rx, ry, rz } = HILL.hill
  return GROUND.sunk + ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (z / rz) ** 2))
}

// Collision for the land (every world): the slab as a convex hull and a fence along every edge.
export function landColliders() {
  const outline = yardOutline()
  const hull = []
  for (const [x, z] of outline) hull.push(x, 0, z, x, -YARD.depth, z)
  addFixed(RAPIER.ColliderDesc.convexHull(new Float32Array(hull)), { x: 0, y: 0, z: 0 }, null, { friction: 0.9 })
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i]
    const [bx, bz] = outline[(i + 1) % outline.length]
    const len = Math.hypot(bx - ax, bz - az)
    const yaw = Math.atan2(-(bz - az), bx - ax)
    addFixed(
      RAPIER.ColliderDesc.cuboid(len / 2 + 0.5, YARD.fenceHeight / 2, 0.4),
      { x: (ax + bx) / 2, y: YARD.fenceHeight / 2, z: (az + bz) / 2 },
      { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
    )
  }
}

// What every world shares: the ground out to the horizon (per world: the meadow's grass, or the
// Frontier Town's desert sand; `setGround`) and the clouds.
export function createWorld(scene) {
  // One tile every GROUND.tile m. The grass also has a bump map; the sand is flat.
  const tiled = (c) => toTexture(c, { repeat: GROUND.size / GROUND.tile, srgb: true })
  const grass = paintGrass()
  const skins = {
    grass: { map: tiled(grass.color), bump: toTexture(grass.height, { repeat: GROUND.size / GROUND.tile }) },
    sand: null, // painted the first time a world asks for it
  }
  const ground = new Mesh(
    new PlaneGeometry(GROUND.size, GROUND.size),
    new MeshStandardMaterial({ color: GROUND.tint, map: skins.grass.map, bumpMap: skins.grass.bump, bumpScale: 0.6, roughness: 1, metalness: 0 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = GROUND.level
  ground.receiveShadow = true
  scene.add(ground, makeClouds())
  let skin = skins.grass

  return {
    // { texture: 'grass' | 'sand', tint } (WORLDS.list.*.ground).
    setGround({ texture = 'grass', tint = GROUND.tint } = {}) {
      if (texture === 'sand') skins.sand ||= { map: tiled(paintDirt(256, 909, ...TOWN.sand)), bump: null }
      skin = skins[texture] ?? skins.grass
      const m = ground.material
      m.map = skin.map
      m.bumpMap = skin.bump
      m.color.set(tint)
      m.needsUpdate = true
    },
    // m the world has slid toward +Z (a race past RACE.cruiseZ moves the world, not the horse).
    // Wrapped to one tile: a 2 h race scrolls ~875 km, too far for a float32 offset.
    setScroll(m) {
      const v = (m / GROUND.tile) % 1
      skin.map.offset.y = v
      if (skin.bump) skin.bump.offset.y = v
    },
  }
}
