import { Group } from 'three'
import { LOBBY, PLAZA, WORLDS } from './config.js'
import { buildRanchLand, landColliders } from './world.js'
import { buildTown } from './town.js'
import { bake } from './bake.js'
import { buildCliff, buildOak, buildWindPump, cliffCollider, solidPole, treeCollider } from './propkit.js'

// The start island's scenery, one look per world (WORLDS): the land, the far horizon,
// the cliffs ringing the plaza, the trees, the wind pump and the hill. Every look stands
// on the same footprints, so the colliders are added once here and the looks themselves
// are visual only. A world's look is built the first time it is shown (the Frontier Town
// is never built for a player who stays on the ranch); show() swaps which one is visible.
// Each look is one Group under the scene, so a race slides it away with the rest of the
// start island (main.js puts it in `home`).

// The ranch: the grass yard with dirt areas, green hills, grass-capped cliffs with oaks, the
// wind pump. Returns its per-frame update (the pump's wheel).
function buildRanch(root) {
  buildRanchLand(root)
  // Cliffs and oaks merged to a few meshes per material (dozens of trees: mobile draw calls).
  const props = new Group()
  PLAZA.cliffs.forEach((c, i) => buildCliff(props, c, 20 + i * 7, 0, false))
  PLAZA.trees.forEach(([x, z, y, h], i) => buildOak(props, x, z, h, 300 + i, y, false))
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
