// Worlds: the portals (the VIP arch on the plaza, the snow arch left of the RACE arch)
// take the player between the ranch and the Frontier Town (WORLDS in config; ids `beach` and `city`, as saved). Both are the
// same start island with the same shops, tracks, races and progress; only the
// scenery, meadow tint and sky change (environment.js, town.js, lighting.setMoods). Standing in the portal's circle (in front of its
// dais) shows an "Enter" prompt; E (or tapping the prompt, interact.js) goes to the other world when it is open:
// a world with `req` opens once the player has that many rebirths and that much
// Power (lightning) at once, and from then on stays open (saved: `worldsUnlocked`);
// the way back is always open. Locked = a toast with what is missing and a deny
// knock; one try per visit (drive out of the circle to try again). Each portal's sign
// shows the destination and each requirement in green (met) or red.
// The current world is saved (`world`) and sent with the loadout, so remote
// players in another world are not drawn (remotePlayers.js, net.js).
// VITE_DEV_WORLDS=true (dev server only) skips the requirement and doesn't save the unlock.
import './worlds.css'
import { DEV_WORLDS, PLAZA, WORLDS } from './config.js'
import { sfx } from './audio/index.js'
import { burst, flash } from './juice.js'

export const worldState = { current: WORLDS.start, unlocked: [] }

const IDS = Object.keys(WORLDS.list)
const OK = '#7dff6a'
const MISSING = '#ff6b6b'

// deps: { hud (root), plaza (setPortal), portals ([{ x, z, setSign }] more portals: lobby.js),
//   env (show), world (setGround), lighting (setMoods), stats() -> { rebirths, power },
//   leave() (end a race / the Trails scene first), respawn() }
export function createWorlds(deps) {
  const { hud, plaza, env, world, lighting } = deps
  const P = WORLDS.portal
  // Each portal: where driving in uses it, its sign, and whether it has been left since its last try.
  const portals = [{ x: PLAZA.vip.x, z: PLAZA.vip.z + P.dz, setSign: plaza.setPortal }, ...(deps.portals ?? [])].map((p) => ({ ...p, armed: true }))
  let busy = false // between the flash and the swap
  let signIn = 0

  const toast = document.createElement('div')
  toast.className = 'world-toast'
  const banner = document.createElement('div')
  banner.className = 'world-banner'
  banner.innerHTML = '<div class="world-banner-sub ol">Welcome to</div><div class="world-banner-name grad"></div>'
  const bannerName = banner.lastChild
  hud.root.append(toast, banner)
  function say(html) {
    toast.innerHTML = html
    toast.classList.remove('show')
    void toast.offsetWidth
    toast.classList.add('show')
  }

  // The portal leads from the start world to the other one, and from any other back to the start.
  const destination = () => (worldState.current === WORLDS.start ? IDS.find((id) => id !== WORLDS.start) : WORLDS.start)
  const meets = (req, st) => st.rebirths >= req.rebirths && st.power >= req.power
  const isOpen = (id, st = deps.stats()) => {
    const req = WORLDS.list[id].req
    return !req || DEV_WORLDS || worldState.unlocked.includes(id) || meets(req, st)
  }

  function refreshSign() {
    const id = destination()
    const def = WORLDS.list[id]
    const st = deps.stats()
    const lines = [[def.name, '#ffffff']]
    if (!def.req) lines.push(['▶ Enter', '#7fd8ff'])
    else if (DEV_WORLDS || worldState.unlocked.includes(id)) lines.push(['🔓 Unlocked', OK])
    else {
      const row = (icon, name, have, need) => (have >= need ? [`${icon} ${name}: ${need} ✔`, OK] : [`${icon} ${name}: ${Math.floor(have)}/${need}`, MISSING])
      lines.push(row('●', 'Rebirth', st.rebirths, def.req.rebirths), row('⚡', 'Power', st.power, def.req.power))
    }
    for (const p of portals) p.setSign(lines, isOpen(id, st))
  }

  // Shows world `id` at once: its scenery, ground and sky; the portal now leads back.
  function apply(id) {
    worldState.current = id
    const def = WORLDS.list[id]
    env.show(id)
    world.setGround(def.ground)
    lighting.setMoods(def.sky)
    refreshSign()
  }

  function travel(id) {
    busy = true
    deps.leave()
    flash('white')
    sfx.sceneIn()
    setTimeout(() => {
      apply(id)
      deps.respawn()
      busy = false
      bannerName.textContent = bannerName.dataset.t = WORLDS.list[id].name
      banner.classList.remove('show')
      void banner.offsetWidth
      banner.classList.add('show')
    }, P.swapDelay * 1000)
  }

  function use() {
    const id = destination()
    const req = WORLDS.list[id].req
    if (!isOpen(id)) {
      sfx.deny()
      say(`🔒 ${WORLDS.list[id].name} needs <b>● ${req.rebirths} Rebirths</b> and <b>⚡ ${req.power} Power</b>`)
      return
    }
    if (req && !DEV_WORLDS && !worldState.unlocked.includes(id)) {
      worldState.unlocked.push(id) // open for good from now on
      sfx.unlock()
      burst(window.innerWidth / 2, window.innerHeight / 2, 'big')
    }
    travel(id)
  }

  apply(WORLDS.start)

  return {
    // pos: the player's feet, or null while racing / in the Trails scene (the portal is off).
    update(dt) {
      if ((signIn -= dt) <= 0) {
        signIn = 0.5
        refreshSign()
      }
    },
    // Interact prompts (interact.js): travelling needs E (or a tap on the prompt), never just driving in.
    spots: portals.map((p) => ({
      x: p.x,
      y: 3,
      z: p.z,
      r: P.radius,
      info: () => ({ title: WORLDS.list[destination()].name, verb: 'Enter' }),
      run: () => busy || use(),
    })),
    // net.js: the current world and the worlds opened so far.
    snapshot: () => ({ world: worldState.current, worldsUnlocked: [...worldState.unlocked] }),
    hydrate(doc) {
      worldState.unlocked = Array.isArray(doc.worldsUnlocked) ? doc.worldsUnlocked.filter((id) => WORLDS.list[id]?.req) : []
      const id = doc.world
      const next = WORLDS.list[id] && (!WORLDS.list[id].req || worldState.unlocked.includes(id)) ? id : WORLDS.start
      if (next === worldState.current) return refreshSign()
      deps.leave()
      apply(next)
      deps.respawn()
    },
    // Dev: __game.worlds.go('city') skips the requirement.
    go: (id) => WORLDS.list[id] && travel(id),
  }
}
