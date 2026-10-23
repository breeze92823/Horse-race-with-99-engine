import './interact.css'
import { Vector3 } from 'three'
import { HUB, INTERACT } from './config.js'
import { ICONS } from './hudIcons.js'
import { anyWindowOpen, replay } from './uiWindow.js'

// Interact prompts on the shop objects, like a Roblox proximity prompt: near
// one, a dark pill over it shows the key, the object and what pressing does
// ("E  Sunny Egg / Hatch 🏆30"). E (or tapping the pill, the touch path) runs it:
//  - eggs (Eggs stall): open that egg's window (eggs.js: odds, Open 1 / N, Auto,
//    the hatch overlay)
//  - display horses (Horses stall), the partners on the Partner stage: buy if not
//    owned, then equip, straight from the world
//  - hub pads (hub.js): open the pad's window again without driving off it
// In portrait the HUD's side columns cover the middle of the screen, so the
// pill docks centred just above the distance bars instead of over the object.
// Not enough Wins = the pill shakes + "Need N more Wins!". Prompts are off
// while racing / in the Trails scene (pos null) and while a window is open.
// deps: { hud (getStat/setStat), lobby, shops (their `spots`), eggs (the egg window), horses,
// partner (the windows' item/acquire APIs), windows (hub pad openers) }.
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']
export function short(n) {
  n = Math.floor(n)
  let i = 0
  while (n >= 1000 && i < SUFFIXES.length - 1) {
    n /= 1000
    i++
  }
  if (i === 0) return String(n)
  return `${n >= 100 ? Math.floor(n + 1e-6) : Math.floor(n * 10 + 1e-6) / 10}${SUFFIXES[i]}`
}

export function createInteract({ hud, lobby, shops, eggs, horses, partner, windows, extra = [] }) {
  const wins = () => hud.getStat('trophies')
  const hotbar = hud.root.querySelector('.hud-bars')

  // --- DOM ------------------------------------------------------------------------------
  const prompt = document.createElement('button')
  prompt.type = 'button'
  prompt.className = 'ix-prompt'
  prompt.hidden = true
  prompt.innerHTML = '<span class="ix-key">E</span><span class="ix-text"><span class="ix-title"></span><span class="ix-verb"></span></span>'
  const titleEl = prompt.querySelector('.ix-title')
  const verbEl = prompt.querySelector('.ix-verb')
  // pointerdown: no click delay on touch, and it never reaches the look zone under it.
  prompt.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    trigger()
  })

  const toast = document.createElement('div')
  toast.className = 'ix-toast'
  toast.style.animationDuration = `${INTERACT.toastSeconds}s`
  document.body.append(prompt, toast)

  function say(text, good) {
    toast.textContent = text
    toast.classList.toggle('good', good)
    replay(toast, 'show')
  }

  // Shared result of a window's acquire(id).
  function report(r, name) {
    if (r.need) {
      replay(prompt, 'shake')
      say(`Need ${short(r.need)} more Wins!`, false)
    } else if (r.done === 'bought') say(`Bought ${name}!`, true)
    else if (r.done === 'equipped') say(`Equipped ${name}!`, true)
  }

  // --- Targets ------------------------------------------------------------------------
  // { x, y, z, r, info() -> { title, verb, price?, off? }, run() }
  const targets = []
  // An item a window sells: Buy (with price) -> Equip -> Equipped (off).
  const shopTarget = (spot, r, api, id) => ({
    ...spot,
    r,
    info() {
      const it = api.item(id)
      if (it.equipped) return { title: it.name, verb: 'Equipped', off: true }
      return it.owned ? { title: it.name, verb: 'Equip' } : { title: it.name, verb: 'Buy', price: it.price }
    },
    run: () => report(api.acquire(id), api.item(id).name),
  })

  for (const pad of HUB.pads) {
    const name = pad.name[0] + pad.name.slice(1).toLowerCase()
    targets.push({ x: pad.x, y: 2.2, z: pad.z, r: HUB.radius, info: () => ({ title: name, verb: 'Open' }), run: () => windows[pad.open]?.() })
  }
  targets.push(...extra) // e.g. the world portals (worlds.js)
  for (const spot of shops.spots.eggs) {
    const egg = spot.egg
    targets.push({
      ...spot,
      r: INTERACT.radius.egg,
      info: () => ({ title: egg.name, verb: 'Open', price: egg.price }),
      run: () => eggs.open(spot),
    })
  }
  for (const spot of shops.spots.horses) if (spot.horse) targets.push(shopTarget(spot, INTERACT.radius.horse, horses, spot.horse))
  for (const spot of lobby.spots.statues) if (spot.partner) targets.push(shopTarget(spot, INTERACT.radius.statue, partner, spot.partner))

  // --- Per frame ----------------------------------------------------------------------
  let active = null
  let shownKey = ''
  const v = new Vector3()

  function trigger() {
    if (!active || anyWindowOpen()) return false
    if (!active.info().off) active.run()
    shownKey = '' // the offer may have changed (Buy -> Equipped)
    return true
  }

  return {
    trigger,
    // pos: the player's feet, or null while prompts are off (racing, the Trails scene).
    update(camera, pos) {
      active = null
      if (pos && !anyWindowOpen()) {
        let best = Infinity
        for (const t of targets) {
          const d = Math.hypot(pos.x - t.x, pos.z - t.z)
          if (d < t.r && d < best) {
            best = d
            active = t
          }
        }
      }
      if (active) {
        v.set(active.x, active.y, active.z).project(camera)
        if (v.z > 1) active = null // behind the camera
      }
      prompt.hidden = !active
      if (!active) return
      const info = active.info()
      const afford = info.price == null || wins() >= info.price
      const key = `${info.title}|${info.verb}|${info.price}|${afford}`
      if (key !== shownKey) {
        shownKey = key
        titleEl.textContent = info.title
        verbEl.innerHTML = info.price == null ? '' : `<span class="ix-cost${afford ? '' : ' short'}"><span class="ix-cost-icon">${ICONS.trophy}</span>${short(info.price)}</span>`
        verbEl.prepend(info.verb)
        prompt.classList.toggle('off', !!info.off)
      }
      const w = window.innerWidth
      const h = window.innerHeight
      let x = Math.min(w - 90, Math.max(90, ((v.x + 1) / 2) * w))
      let y = Math.min(h - 120, Math.max(80, ((1 - v.y) / 2) * h))
      if (h > w && hotbar) {
        x = w / 2
        y = hotbar.getBoundingClientRect().top - 10
      }
      prompt.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`
    },
  }
}
