// Horses window ("Horses!", laid out like the reference's Boats popup) on the
// shared window shell (uiWindow.js): the selected horse's card on the left
// (name, picture, booster count, Wins / Luck / Acc boosts, Equip / blue
// Wins-price button; preview and name in the rarity colour) and the catalog grid
// on the right, 4 per row, coloured by rarity, locked ones padlocked with their
// Wins price. Every horse but the free Brown Pony is bought with Wins (the HUD's
// trophy counter). Owned + equipped horses are saved by the server (snapshot /
// hydrate, net.js); equipping dresses the player's horse (main.js ->
// horse.setLook). The HUD's Horses tile opens it. Catalog: HORSES in config.js,
// looks: horseModels.js, pictures: horseThumbs.js.
import './horses.css'
import { HORSES } from './config.js'
import { horseById } from './horseModels.js'
import { horseThumb } from './horseThumbs.js'
import { ICONS } from './hudIcons.js'
import { createWindow, replay, uiButton } from './uiWindow.js'

const CHECK = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="28" fill="#2fd44a" stroke="#fff" stroke-width="5"/>
  <path d="M19 33l9 9 18-19" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

export const horseState = { owned: new Set(HORSES.start.owned), equipped: HORSES.start.equipped }

// 1000 -> "1K", 2.6e6 -> "2.6M", 1.4e9 -> "1.4B" (the reference's short style).
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi']
function short(n) {
  let i = 0
  while (n >= 1000 && i < SUFFIXES.length - 1) {
    n /= 1000
    i++
  }
  return `${n >= 100 || i === 0 ? Math.floor(n) : Math.floor(n * 10) / 10}${SUFFIXES[i]}`
}

// The saved part (net.js; backend sanitize.ts): { horses: owned ids, horse: the equipped one }.
export const snapshot = () => ({ horses: [...horseState.owned], horse: horseState.equipped })

// A loaded save over a fresh start (unknown ids dropped, an unowned horse not equipped).
function applySave(s) {
  horseState.owned = new Set(HORSES.start.owned)
  horseState.equipped = HORSES.start.equipped
  if (Array.isArray(s.horses)) for (const id of s.horses) if (horseById(id)) horseState.owned.add(id)
  if (horseState.owned.has(s.horse)) horseState.equipped = s.horse
}

const BODY = `
  <aside class="hs-info">
    <div class="hs-name uiw-text"></div>
    <div class="hs-preview"><img class="hs-preview-pic" alt="" draggable="false"></div>
    <div class="hs-engines"><span class="hs-rocket">${ICONS.engine}</span><span class="uiw-text" data-hs="engines"></span></div>
    <div class="hs-stats">
      <div class="uiw-text wins" data-hs="wins"></div>
      <div class="uiw-text luck" data-hs="luck"></div>
      <div class="uiw-text acc" data-hs="acc"></div>
    </div>
    <div class="hs-action"><div class="hs-equipped uiw-text">Equipped</div></div>
    <div class="hs-hint uiw-text"></div>
  </aside>
  <div class="hs-grid"></div>`

// wallet: { wins() -> number, spend(n) } (the HUD's trophy counter = Wins).
// onEquip(id) is called after the equipped horse changes (and once at start).
// Returns { open, close, toggle, isOpen, item, acquire, snapshot, hydrate }.
export function createHorses({ wallet, onEquip }) {
  const win = createWindow({ title: 'Horses!', icon: ICONS.horses, className: 'hs-window', onOpen })
  win.body.innerHTML = BODY
  const q = (sel) => win.body.querySelector(sel)
  const field = {}
  for (const el of win.body.querySelectorAll('[data-hs]')) field[el.dataset.hs] = el
  const info = q('.hs-info')
  const name = q('.hs-name')
  const preview = q('.hs-preview-pic')
  const equippedText = q('.hs-equipped')
  const hint = q('.hs-hint')
  const action = uiButton('', 'green', act, 'hs-btn')
  q('.hs-action').append(action)

  let selected = horseState.equipped
  const tiles = new Map()
  const grid = q('.hs-grid')
  for (const b of HORSES.list) {
    const t = document.createElement('button')
    t.type = 'button'
    t.className = 'hs-tile'
    t.style.setProperty('--c', HORSES.rarity[b.rarity])
    t.setAttribute('aria-label', b.name)
    t.innerHTML =
      `<img class="hs-pic" alt="" draggable="false"><span class="hs-lock">${ICONS.relics}</span>` +
      `<span class="hs-price uiw-text">${b.price ? short(b.price) : ''}</span>` +
      `<span class="hs-cur">${ICONS.trophy}</span><span class="hs-check">${CHECK}</span>`
    t.addEventListener('click', () => select(b.id))
    grid.append(t)
    tiles.set(b.id, t)
  }

  let hintTimer = 0
  function say(text) {
    hint.textContent = text
    hint.classList.add('show')
    clearTimeout(hintTimer)
    hintTimer = setTimeout(() => hint.classList.remove('show'), 1800)
  }

  function setPicture(img, id, first = false) {
    img.classList.remove('ready')
    img.dataset.id = id
    horseThumb(
      id,
      (url) => {
        if (img.dataset.id !== id || !url) return
        img.src = url
        img.classList.add('ready')
      },
      first,
    )
  }

  function render() {
    const b = horseById(selected)
    const owned = horseState.owned.has(b.id)
    const equipped = horseState.equipped === b.id
    name.textContent = b.name
    info.style.setProperty('--rc', HORSES.rarity[b.rarity])
    info.style.setProperty('--nc', HORSES.nameColor[b.rarity])
    if (preview.dataset.id !== b.id) setPicture(preview, b.id, true)
    field.engines.textContent = `x${b.engines}`
    field.wins.textContent = `+${short(b.wins)}% Wins`
    field.luck.textContent = `+${short(b.luck)}% Luck`
    field.acc.textContent = `+${short(b.acc)}% Acc`
    equippedText.hidden = !equipped
    action.hidden = equipped
    if (!owned) action.innerHTML = `<span class="hs-cost"><span class="hs-cost-icon">${ICONS.trophy}</span><span>${short(b.price)}</span></span>`
    else action.textContent = 'Equip'
    action.classList.toggle('green', owned)
    action.classList.toggle('blue', !owned)
    for (const [id, t] of tiles) {
      t.classList.toggle('owned', horseState.owned.has(id))
      t.classList.toggle('equipped', horseState.equipped === id)
      t.classList.toggle('sel', id === selected)
    }
  }

  function select(id) {
    if (selected === id) return
    selected = id
    hint.classList.remove('show')
    render()
  }

  function equip(id) {
    horseState.equipped = id
    onEquip(id)
    render()
    replay(tiles.get(id).querySelector('.hs-check'), 'bump')
  }

  function act() {
    const r = acquire(selected)
    if (r.need) {
      replay(action, 'shake')
      say(`Need ${short(r.need)} more Wins!`)
    }
  }

  // Buys `id` if needed and equips it, without the window (the Horses stall's
  // display horses). Returns { done: 'bought' | 'equipped' | 'already' } or { need: Wins short }.
  function acquire(id) {
    const b = horseById(id)
    if (horseState.equipped === id) return { done: 'already' }
    if (horseState.owned.has(id)) {
      equip(id)
      return { done: 'equipped' }
    }
    const have = wallet.wins()
    if (have < b.price) return { need: b.price - have }
    wallet.spend(b.price)
    horseState.owned.add(id)
    equip(id)
    return { done: 'bought' }
  }

  const item = (id) => {
    const b = horseById(id)
    return { name: b.name, price: b.price ?? 0, owned: horseState.owned.has(id), equipped: horseState.equipped === id }
  }

  function onOpen() {
    selected = horseState.equipped
    hint.classList.remove('show')
    render()
    for (const [id, t] of tiles) {
      const img = t.querySelector('.hs-pic')
      if (img.dataset.id !== id) setPicture(img, id)
    }
    requestAnimationFrame(() => tiles.get(selected).scrollIntoView({ block: 'nearest' }))
  }

  onEquip(horseState.equipped)
  render()
  // Draw the tile pictures in the background soon after start, so the grid is ready on first open.
  setTimeout(() => {
    for (const b of HORSES.list) horseThumb(b.id, () => {})
  }, HORSES.preloadDelayMs)
  // A save loaded from the server (net.js): swap in its horses and ride the equipped one.
  function hydrate(doc) {
    applySave(doc)
    selected = horseState.equipped
    onEquip(horseState.equipped)
    render()
  }
  return { open: win.open, close: win.close, toggle: win.toggle, isOpen: win.isOpen, item, acquire, snapshot, hydrate }
}
