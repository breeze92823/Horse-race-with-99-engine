import {
  BoxGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Color,
  ExtrudeGeometry,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { paintStripes, toTexture } from './textures.js'
import { neon, put, solidPole, std } from './propkit.js'

// Props for the lobby's north view (lobby.js), after the reference: the Christmas dressing
// (big tree, candy canes, snowman, presents, string lights, wreath) and the plain pieces
// around it (pines, market tents, lantern posts). Each builder adds to `root` at (x, z) on
// the ground; anything with a collider says so.

const stripeTex = (a, b, n, repeatX, repeatY, slant = 1) => {
  const t = toTexture(paintStripes(a, b, n, 128, slant), { srgb: true })
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeatX, repeatY)
  return t
}

// A five-pointed star in the XY plane, `r` m to its tips.
function starGeometry(r, depth) {
  const s = new Shape()
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const k = i % 2 ? 0.45 : 1
    const x = Math.cos(a) * r * k
    const y = Math.sin(a) * r * k
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  const geo = new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: r * 0.08, bevelSegments: 2 })
  geo.translate(0, 0, -depth / 2)
  return geo
}

// The big Christmas tree: stacked green cones, garlands spiralling round, a gold star on top.
export function buildChristmasTree(root, { x, z, height }) {
  const g = new Group()
  g.position.set(x, 0, z)
  root.add(g)
  const trunkH = height * 0.12
  put(g, new CylinderGeometry(height * 0.035, height * 0.045, trunkH, 10), std('#6b3f22', { roughness: 0.9 }), 0, trunkH / 2, 0)
  const greens = ['#1f8f2e', '#27a336', '#2fb53d', '#36c445', '#3ed14d']
  const tiers = 5
  const base = height * 0.27 // widest radius
  const garlands = ['#e8262b', '#ffd21a', '#9a5cff', '#3dff6a', '#e8262b']
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers
    const r = base * (1 - t * 0.78)
    const h = height * 0.3 * (1 - t * 0.35)
    const y = trunkH + height * 0.16 * i * 1.02
    put(g, new ConeGeometry(r, h, 9), std(greens[i], { roughness: 0.8, flatShading: true }), 0, y + h / 2, 0)
    // A garland round the cone's lower rim.
    const ring = put(g, new TorusGeometry(r * 0.86, height * 0.008 + 0.12, 6, 28), std(garlands[i], { roughness: 0.5 }), 0, y + h * 0.16, 0, false)
    ring.rotation.x = Math.PI / 2
  }
  const star = put(g, starGeometry(height * 0.07, height * 0.025), neon('#ffd21a', 1.6), 0, height * 0.97, 0, false)
  star.rotation.y = Math.atan2(-x, -z) // face the spawn side
  solidPole(height * 0.06, trunkH, x, z)
  return g
}

// A candy cane: a striped tube up and over into a hook, a green bow on the shaft.
export function buildCandyCane(root, { x, z, height, turn = 0 }) {
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = turn
  root.add(g)
  const r = height * 0.06
  const hook = height * 0.16
  const top = height - hook
  const pts = [new Vector3(0, 0, 0), new Vector3(0, top * 0.5, 0), new Vector3(0, top, 0)]
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * Math.PI
    pts.push(new Vector3(hook - Math.cos(a) * hook, top + Math.sin(a) * hook, 0))
  }
  pts.push(new Vector3(hook * 2, top - hook * 0.5, 0))
  const curve = new CatmullRomCurve3(pts)
  const len = curve.getLength()
  const tube = new TubeGeometry(curve, 48, r, 12, false)
  // u runs along the tube, v round it: diagonal stripes wind round the cane.
  const map = stripeTex('#e8262b', '#ffffff', 1, len / (r * 5), 1, 1)
  put(g, tube, std('#ffffff', { map, roughness: 0.35 }))
  // Bow: two loops and two tails.
  const bow = std('#25b84a', { roughness: 0.5 })
  const by = top * 0.62
  for (const s of [-1, 1]) {
    const loop = put(g, new SphereGeometry(r * 1.6, 10, 8), bow, s * r * 1.9, by + r * 0.4, r * 0.8)
    loop.scale.set(1.3, 0.75, 0.45)
    loop.rotation.z = s * 0.35
    const tail = put(g, new BoxGeometry(r * 0.7, r * 3, r * 0.3), bow, s * r * 1.1, by - r * 1.8, r * 0.9)
    tail.rotation.z = s * 0.4
  }
  put(g, new SphereGeometry(r * 0.75, 8, 6), bow, 0, by + r * 0.3, r * 1.05)
  return g
}

// A snowman: three snowballs, coal eyes and buttons, a carrot nose, stick arms, a top hat, a scarf.
export function buildSnowman(root, { x, z }, faceX, faceZ) {
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = Math.atan2(faceX - x, faceZ - z)
  root.add(g)
  const snow = std('#f6faff', { roughness: 0.9 })
  const coal = std('#1b1b20')
  const balls = [[1.25, 1.1], [0.95, 2.95], [0.7, 4.35]]
  const ball = new IcosahedronGeometry(1, 3)
  for (const [r, y] of balls) put(g, ball, snow, 0, y, 0).scale.setScalar(r)
  for (const s of [-1, 1]) put(g, new SphereGeometry(0.09, 8, 6), coal, s * 0.24, 4.5, 0.62)
  for (const y of [2.6, 3.0, 3.4]) put(g, new SphereGeometry(0.1, 8, 6), coal, 0, y, 0.9)
  const nose = put(g, new ConeGeometry(0.11, 0.6, 10), std('#ff8a1a'), 0, 4.3, 0.95)
  nose.rotation.x = Math.PI / 2
  put(g, new CylinderGeometry(0.5, 0.5, 0.08, 18), coal, 0, 4.98, 0)
  put(g, new CylinderGeometry(0.36, 0.38, 0.75, 18), coal, 0, 5.38, 0)
  put(g, new CylinderGeometry(0.385, 0.385, 0.14, 18), std('#e8262b'), 0, 5.1, 0)
  const scarf = put(g, new TorusGeometry(0.62, 0.14, 8, 20), std('#e8262b'), 0, 3.72, 0)
  scarf.rotation.x = Math.PI / 2
  const stick = std('#5a3a1c', { roughness: 0.9 })
  for (const s of [-1, 1]) {
    const arm = put(g, new CylinderGeometry(0.05, 0.07, 1.8, 6), stick, s * 1.5, 3.25, 0)
    arm.rotation.z = s * -1.05
  }
  solidPole(1.2, 2.4, x, z)
  return g
}

// A wrapped present: a box, a ribbon cross over it, a bow on top. size m along an edge.
export function buildGift(root, [x, z, size, box, ribbon, yaw = 0]) {
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = yaw
  root.add(g)
  const h = size * 0.85
  put(g, new BoxGeometry(size, h, size), std(box, { roughness: 0.5 }), 0, h / 2, 0)
  const rib = std(ribbon, { roughness: 0.4 })
  const w = size * 0.16
  put(g, new BoxGeometry(size + 0.04, h + 0.04, w), rib, 0, h / 2, 0)
  put(g, new BoxGeometry(w, h + 0.04, size + 0.04), rib, 0, h / 2, 0)
  // Lid band and bow loops.
  put(g, new BoxGeometry(size + 0.1, h * 0.12, size + 0.1), std(box, { roughness: 0.5 }), 0, h - h * 0.06, 0)
  for (const s of [-1, 1]) {
    const loop = put(g, new TorusGeometry(size * 0.16, w * 0.35, 6, 14), rib, s * size * 0.16, h + size * 0.12, 0)
    loop.rotation.z = s * 0.5
  }
  return g
}

// A low-poly pine: a trunk and three stacked cones (`color`: an autumn one is orange). y: its foot.
export function buildPine(root, x, z, height, color = '#2e9a3a', y = 0) {
  const g = new Group()
  g.position.set(x, y, z)
  root.add(g)
  put(g, new CylinderGeometry(height * 0.03, height * 0.04, height * 0.2, 8), std('#6b3f22', { roughness: 0.9 }), 0, height * 0.1, 0)
  const green = std(color, { roughness: 0.85, flatShading: true })
  for (let i = 0; i < 3; i++) {
    const r = height * (0.24 - i * 0.055)
    const h = height * (0.42 - i * 0.07)
    put(g, new ConeGeometry(r, h, 8), green, 0, height * (0.18 + i * 0.22) + h / 2, 0)
  }
  return g
}

// A market tent: four poles and a striped pyramid roof over a counter.
export function buildTent(root, [x, z, size, a, b]) {
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = Math.PI / 4 // the pyramid's edges square to the road
  root.add(g)
  const half = size / 2
  const poleH = size * 0.55
  const pole = std('#f4f4f4', { roughness: 0.5 })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, new CylinderGeometry(0.1, 0.1, poleH, 6), pole, (sx * half) / Math.SQRT2, poleH / 2, (sz * half) / Math.SQRT2)
  const roofH = size * 0.36
  const map = stripeTex(a, b, 4, 1, 1, 0)
  const roof = put(g, new ConeGeometry(half * 1.08, roofH, 4, 1), std('#ffffff', { map, roughness: 0.6 }), 0, poleH + roofH / 2, 0)
  roof.rotation.y = 0
  put(g, new BoxGeometry(half * 1.1, 0.9, half * 0.5), std('#f4f4f4', { roughness: 0.6 }), 0, 0.45, half * 0.2).rotation.y = -Math.PI / 4
  return g
}

// An L-shaped lantern post: a square post, an arm reaching `side` (-1 left, +1 right in the
// post's frame) with a brace under it, and a lantern hanging off the arm on a short chain.
// Returns the glass material (lamps brighten at night).
export function buildLampPost(root, { x, z, side }, height, wood, faceYaw) {
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = faceYaw
  root.add(g)
  const post = 0.8
  put(g, new BoxGeometry(post, height, post), wood, 0, height / 2, 0)
  put(g, new BoxGeometry(post + 0.25, 0.3, post + 0.25), wood, 0, height + 0.15, 0)
  const arm = 3
  put(g, new BoxGeometry(arm + post / 2, 0.6, 0.6), wood, (side * (arm + post / 2)) / 2, height - 0.6, 0)
  const brace = put(g, new BoxGeometry(0.4, 2.4, 0.4), wood, side * 1.1, height - 1.65, 0)
  brace.rotation.z = side * 0.8
  const lx = side * (arm - 0.2)
  const iron = std('#2a2a30', { metalness: 0.5, roughness: 0.4 })
  put(g, new BoxGeometry(0.1, 0.9, 0.1), iron, lx, height - 1.35, 0) // chain
  const ly = height - 2.7
  const glass = std('#ffd84a', { emissive: '#ffc21a', emissiveIntensity: 1.6, roughness: 0.3 })
  put(g, new BoxGeometry(0.8, 1.2, 0.8), glass, lx, ly, 0, false)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, new BoxGeometry(0.12, 1.3, 0.12), iron, lx + sx * 0.42, ly, sz * 0.42)
  put(g, new BoxGeometry(1.05, 0.18, 1.05), iron, lx, ly + 0.7, 0)
  put(g, new ConeGeometry(0.6, 0.45, 4), iron, lx, ly + 1.0, 0).rotation.y = Math.PI / 4
  put(g, new BoxGeometry(0.95, 0.14, 0.95), iron, lx, ly - 0.66, 0)
  solidPole(post * 0.7, height / 2, x, z)
  return glass
}

// String lights sagging between points (each [x, y, z] in `parent`'s frame), one InstancedMesh of
// bulbs cycling `colors`, plus the dark wire. sag: m the middle hangs down per span; bulb: radius m
// (big ones are spaced wider).
export function buildStringLights(parent, points, sag, colors = ['#ff3b3b', '#3dff6a', '#ffd21a', '#3fa8ff'], bulb = 0.17) {
  const bulbsPerM = 0.19 / bulb
  const spans = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = new Vector3(...points[i])
    const b = new Vector3(...points[i + 1])
    const n = Math.max(2, Math.round(a.distanceTo(b) * bulbsPerM))
    spans.push({ a, b, n })
    total += n
  }
  // Big bulbs are C9 pendants: stretched down from the wire.
  const bulbGeo = new SphereGeometry(bulb, 8, 6)
  if (bulb > 0.25) bulbGeo.scale(1, 1.7, 1)
  const bulbs = new InstancedMesh(bulbGeo, neon('#ffffff', 2.2), total)
  const wireMat = std('#1f2a1c', { roughness: 0.8 })
  const m = new Matrix4()
  const p = new Vector3()
  const c = new Color()
  let k = 0
  for (const { a, b, n } of spans) {
    const wire = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      wire.push(p.lerpVectors(a, b, t).clone().setY(p.y - Math.sin(t * Math.PI) * sag))
    }
    put(parent, new TubeGeometry(new CatmullRomCurve3(wire), 24, 0.04, 4, false), wireMat, 0, 0, 0, false)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      p.lerpVectors(a, b, t)
      p.y -= Math.sin(t * Math.PI) * sag + bulb * (bulb > 0.25 ? 1.7 : 0.7)
      bulbs.setMatrixAt(k, m.makeTranslation(p.x, p.y, p.z))
      bulbs.setColorAt(k, c.set(colors[k % colors.length]))
      k++
    }
  }
  parent.add(bulbs)
  return bulbs
}

// A wreath (hanging in `parent`'s XY plane, facing +Z) with a red bow and berries.
export function buildWreath(parent, x, y, z, r) {
  const g = new Group()
  g.position.set(x, y, z)
  parent.add(g)
  put(g, new TorusGeometry(r, r * 0.32, 8, 20), std('#1f8f2e', { roughness: 0.8, flatShading: true }))
  const berry = std('#e8262b', { roughness: 0.4 })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3
    put(g, new SphereGeometry(r * 0.1, 8, 6), berry, Math.cos(a) * r, Math.sin(a) * r, r * 0.28)
  }
  const bow = std('#d81f26', { roughness: 0.45 })
  for (const s of [-1, 1]) {
    const loop = put(g, new SphereGeometry(r * 0.32, 10, 8), bow, s * r * 0.35, -r * 0.9, r * 0.3)
    loop.scale.set(1.2, 0.75, 0.45)
    const tail = put(g, new BoxGeometry(r * 0.16, r * 0.7, r * 0.06), bow, s * r * 0.2, -r * 1.35, r * 0.3)
    tail.rotation.z = s * 0.35
  }
  put(g, new SphereGeometry(r * 0.16, 8, 6), bow, 0, -r * 0.9, r * 0.38)
  return g
}

// The snowy Christmas tree behind the plaza portal: stacked green tiers each wearing a white band
// of snow round its lower half, coloured baubles, a spiral of string lights and a gold star.
// Returns the bulbs' InstancedMesh.
export function buildSnowyTree(root, { x, z, height }) {
  const g = new Group()
  g.position.set(x, 0, z)
  root.add(g)
  const trunkH = height * 0.1
  put(g, new CylinderGeometry(height * 0.03, height * 0.04, trunkH, 10), std('#6b3f22', { roughness: 0.9 }), 0, trunkH / 2, 0)
  const green = std('#2a9a3a', { roughness: 0.8, flatShading: true })
  const snow = std('#f6faff', { roughness: 0.85, flatShading: true })
  const baubleColors = ['#e8262b', '#ffd21a', '#2f8cff', '#ff5fd8', '#e8262b']
  const tiers = 5
  const base = height * 0.28
  const ring = []
  let rand = 7
  const rnd = () => ((rand = (rand * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers
    const r = base * (1 - t * 0.75)
    const h = height * 0.28 * (1 - t * 0.3)
    const y = trunkH + height * 0.155 * i
    put(g, new ConeGeometry(r, h, 10), green, 0, y + h / 2, 0)
    // The snow: a thick band over the cone's lower part, a hair proud of its slope, with a
    // rounded lip of snow hanging over the tier's rim.
    put(g, new CylinderGeometry(r * 0.5, r * 1.05, h * 0.52, 10, 1, true), snow, 0, y + h * 0.26, 0)
    const lip = put(g, new TorusGeometry(r * 0.98, h * 0.07, 6, 10), snow, 0, y + h * 0.04, 0)
    lip.rotation.x = Math.PI / 2
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + i
      const rr = r * 0.62
      put(g, new SphereGeometry(height * 0.018 + 0.12, 8, 6), std(baubleColors[(i + k) % 5], { roughness: 0.25, metalness: 0.3 }), Math.cos(a) * rr, y + h * 0.42, Math.sin(a) * rr)
    }
    ring.push([r, y])
  }
  const star = put(g, starGeometry(height * 0.06, height * 0.022), neon('#ffd21a', 1.6), 0, height * 0.94, 0, false)
  star.rotation.y = Math.atan2(-x, -z)
  // String lights spiralling down round the tiers.
  const pts = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    const y = height * 0.82 - t * height * 0.64
    const r = base * (0.2 + t * 0.85)
    const a = t * Math.PI * 7
    pts.push([Math.cos(a) * r, y, Math.sin(a) * r])
  }
  const bulbs = buildStringLights(g, pts, 0.15)
  solidPole(height * 0.05, trunkH, x, z)
  return bulbs
}

// A present with golden wings, bobbing over the Train stations' corners (the caller bobs `group`).
export function buildWingedGift(root, x, y, z, yaw = 0) {
  const g = new Group()
  g.position.set(x, y, z)
  g.rotation.y = yaw
  root.add(g)
  buildGift(g, [0, 0, 1.3, '#3a2a14', '#ffd21a', 0])
  const wing = new Shape()
  wing.moveTo(0, 0)
  wing.quadraticCurveTo(0.9, 1.4, 2.0, 1.6)
  wing.quadraticCurveTo(1.6, 1.0, 1.9, 0.8)
  wing.quadraticCurveTo(1.4, 0.4, 1.7, 0.1)
  wing.quadraticCurveTo(0.9, 0.1, 0, -0.2)
  const geo = new ExtrudeGeometry(wing, { depth: 0.08, bevelEnabled: false })
  const gold = std('#ffd21a', { emissive: '#ffb000', emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.4 })
  for (const s of [-1, 1]) {
    const w = put(g, geo, gold, s * 0.6, 0.55, 0)
    w.scale.set(s, 1, 1)
    w.rotation.y = s * -0.35
  }
  return g
}

// Santa: a blocky figure in a red suit with white trim, a black belt, a white beard, a floppy hat
// with a pompom, one arm up waving; faces (faceX, faceZ). Returns the waving arm's pivot.
export function buildSanta(root, { x, z }, faceX, faceZ) {
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = Math.atan2(faceX - x, faceZ - z)
  root.add(g)
  const red = std('#d81f26', { roughness: 0.6 })
  const white = std('#f6f6f2', { roughness: 0.8 })
  const black = std('#1b1b20', { roughness: 0.5 })
  const skin = std('#f2c79a')
  for (const s of [-1, 1]) {
    put(g, new BoxGeometry(0.5, 0.95, 0.55), red, s * 0.28, 0.6, 0)
    put(g, new BoxGeometry(0.55, 0.3, 0.65), black, s * 0.28, 0.15, 0.05)
  }
  put(g, new BoxGeometry(1.3, 1.25, 0.85), red, 0, 1.7, 0)
  put(g, new BoxGeometry(1.34, 0.2, 0.89), black, 0, 1.35, 0)
  put(g, new BoxGeometry(0.3, 0.24, 0.05), std('#ffd21a', { metalness: 0.5, roughness: 0.3 }), 0, 1.35, 0.46)
  put(g, new BoxGeometry(1.36, 0.16, 0.9), white, 0, 1.08, 0)
  put(g, new BoxGeometry(0.75, 0.7, 0.7), skin, 0, 2.7, 0)
  put(g, new BoxGeometry(0.8, 0.55, 0.3), white, 0, 2.45, 0.28) // beard
  put(g, new BoxGeometry(0.85, 0.18, 0.78), white, 0, 3.1, 0)
  const hat = put(g, new ConeGeometry(0.42, 0.9, 4), red, 0.12, 3.55, 0)
  hat.rotation.set(0, Math.PI / 4, -0.35)
  put(g, new SphereGeometry(0.16, 10, 8), white, 0.45, 3.85, 0)
  for (const s of [-1, 1]) put(g, new SphereGeometry(0.06, 6, 4), black, s * 0.17, 2.85, 0.36)
  put(g, new BoxGeometry(0.38, 0.95, 0.4), red, -0.86, 1.75, 0)
  const arm = new Group()
  arm.position.set(0.85, 2.2, 0)
  g.add(arm)
  put(arm, new BoxGeometry(0.38, 0.95, 0.4), red, 0, 0.4, 0)
  put(arm, new BoxGeometry(0.42, 0.25, 0.44), white, 0, 0.92, 0)
  arm.rotation.z = -0.5
  solidPole(0.8, 2, x, z)
  return arm
}
