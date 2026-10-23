import { ConeGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { GROUND, LOBBY, PLAZA, WORLDS } from './config.js'
import { buildRanchLand, landColliders, makeHill } from './world.js'
import { buildTown } from './town.js'
import { bake } from './bake.js'
import { buildCliff, buildOak, buildWindPump, cliffCollider, solidPole, treeCollider } from './propkit.js'
import { buildPine } from './decor.js'

// The start island's scenery, one look per world (WORLDS): the land, the far horizon,
// the cliffs ringing the plaza, the trees, the wind pump and the hill. Every look stands
// on the same footprints, so the colliders are added once here and the looks themselves
// are visual only. A world's look is built the first time it is shown (the Frontier Town
// is never built for a player who stays on the ranch); show() swaps which one is visible.
// Each look is one Group under the scene, so a race slides it away with the rest of the
// start island (main.js puts it in `home`).

// The cliffs behind the training plaza (|x| < PLAZA.hillsWithin) are drawn on the ranch as green
// grassy hills: a dome over each footprint, a little bigger than it, turned by its yaw.
const hillOf = ([x, z, w, d, h, yaw]) => ({ x, z, rx: w * 0.75, ry: h * 0.85, rz: d * 0.95, yaw })
const backHills = () => PLAZA.cliffs.filter(([x]) => Math.abs(x) < PLAZA.hillsWithin).map(hillOf)
// Height of the hills' surface at (x, z) (the highest one there), 0 off them.
function hillsTop(hills, x, z) {
  let top = 0
  for (const H of hills) {
    const c = Math.cos(H.yaw)
    const s = Math.sin(H.yaw)
    const lx = (x - H.x) * c - (z - H.z) * s
    const lz = (x - H.x) * s + (z - H.z) * c
    const k = 1 - (lx / H.rx) ** 2 - (lz / H.rz) ** 2
    if (k > 0) top = Math.max(top, GROUND.sunk + H.ry * Math.sqrt(k))
  }
  return top
}

// The ranch: the sand plaza, green hills, grey grass-capped cliffs on the wings and green hills
// behind the training plaza, pines, far grey mountains, the oaks on the plaza and the wind
// pump. Returns its per-frame update (the pump's wheel).
function buildRanch(root) {
  buildRanchLand(root)
  // Cliffs, hills and trees merged to a few meshes per material (dozens of trees: mobile draw calls).
  const props = new Group()
  PLAZA.cliffs.forEach((c, i) => Math.abs(c[0]) >= PLAZA.hillsWithin && buildCliff(props, c, 20 + i * 7, 0, false))
  const hills = backHills()
  hills.forEach((H, i) => {
    const [m] = makeHill(H.x, H.z, H.rx, H.ry, H.rz, i % 2 ? '#52c444' : '#46b83b', 40 + i)
    m.rotation.y = H.yaw
    props.add(m)
  })
  // Pines: on the ground, or on a hill's surface where their cliff top was.
  PLAZA.trees.forEach(([x, z, y, h]) => buildPine(props, x, z, h * 1.35, '#2e9a3a', y && Math.abs(x) < PLAZA.hillsWithin ? hillsTop(hills, x, z) : y))
  // Far low-poly mountains past the cliffs, sunk into the meadow.
  const rock = new MeshStandardMaterial({ color: '#a9adb6', roughness: 1, flatShading: true })
  for (const [x, z, r, h] of PLAZA.mountains) {
    const m = new Mesh(new ConeGeometry(r, h, 7, 2), rock)
    m.position.set(x, GROUND.sunk + h / 2, z)
    m.rotation.y = x * 0.1
    props.add(m)
  }
  LOBBY.trees.forEach(([x, z, h], i) => buildOak(props, x, z, h, 100 + i, 0, false))
  root.add(bake(props, true))
  const wheel = buildWindPump(root, LOBBY.pump)
  return (t) => (wheel.rotation.z = t * 2.2)
}

const BUILDERS = { beach: buildRanch, city: buildTown }

function addColliders() {
  landColliders()
  PLAZA.cliffs.forEach((c) => cliffCollider(c))
  for (const [x, z, y, h] of PLAZA.trees) if (y === 0) treeCollider(x, z, h)
  for (const [x, z, h] of LOBBY.trees) treeCollider(x, z, h)
  const P = LOBBY.pump
  solidPole(0.6 * P.scale, 3, P.x, P.z)
}

export function createEnvironment(scene) {
  addColliders()
  const looks = {}
  for (const id of Object.keys(WORLDS.list)) {
    const root = new Group()
    root.name = `scenery-${id}`
    root.visible = false
    scene.add(root)
    looks[id] = { root, built: false, update: null }
  }
  let shown = null
  return {
    // One Group per world (built or not yet), for the race's `home`.
    home: Object.values(looks).map((l) => l.root),
    shown: () => shown,
    show(id) {
      const look = looks[id] ?? looks[WORLDS.start]
      if (!look.built) {
        look.built = true
        look.update = BUILDERS[id]?.(look.root) ?? null
      }
      for (const l of Object.values(looks)) l.root.visible = l === look
      shown = id
    },
    // The shown look's animation (wind pump, lamps...), if it has any.
    update(elapsed) {
      const look = looks[shown]
      if (look?.root.visible) look.update?.(elapsed)
    },
  }
}
