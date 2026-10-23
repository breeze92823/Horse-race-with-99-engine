// Procedural texture painters. Everything is drawn into canvases once at load,
// so the game ships no image files. Each painter returns tileable canvases:
// a colour map plus whatever data maps it needs (height -> bump or a derived
// tangent-space normal map, roughness). Same seed = same look every load.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// Deterministic PRNG.
export function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(size) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return c
}

// --- Tileable noise -------------------------------------------------------------
// Value noise on a periodic lattice: the last cell wraps to the first, so the
// result tiles seamlessly. fbm stacks octaves at doubling frequency.
function periodicNoise(size, cells, rand) {
  const lattice = new Float32Array(cells * cells)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand()
  const out = new Float32Array(size * size)
  const s = (t) => t * t * (3 - 2 * t)
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells
    const y0 = Math.floor(fy)
    const ty = s(fy - y0)
    const y1 = (y0 + 1) % cells
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells
      const x0 = Math.floor(fx)
      const tx = s(fx - x0)
      const x1 = (x0 + 1) % cells
      const a = lattice[y0 * cells + x0]
      const b = lattice[y0 * cells + x1]
      const c = lattice[y1 * cells + x0]
      const d = lattice[y1 * cells + x1]
      out[y * size + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
    }
  }
  return out
}

export function fbm(size, baseCells, octaves, seed) {
  const rand = mulberry32(seed)
  const out = new Float32Array(size * size)
  let amp = 0.5
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const layer = periodicNoise(size, baseCells << o, rand)
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * amp
    total += amp
    amp *= 0.5
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

// --- Height -> normal ----------------------------------------------------------
// Sobel over a wrapped height field into an OpenGL-convention tangent-space
// normal map (what three.js expects). `strength` scales the slopes.
export function heightToNormal(heights, size, strength = 2) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const h = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x - 1, y) - h(x - 1, y + 1)) * strength
      const dy = (h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x, y - 1) - h(x + 1, y - 1)) * strength
      // Canvas y runs down while texture v runs up, hence +dy for the green channel.
      let nx = -dx
      let ny = dy
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      const i = (y * size + x) * 4
      img.data[i] = (nx * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Wraps a canvas as a repeating texture. Colour maps are sRGB; data maps stay linear.
export function toTexture(c, { repeat = 1, srgb = false, anisotropy = 8 } = {}) {
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = anisotropy
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

// --- Painters ----------------------------------------------------------------

// Grass: mottled base, soft blotches, then blade strokes mirrored into a height
// canvas used as a bump map.
export function paintGrass(size = 512) {
  const rand = mulberry32(1337)
  const color = canvas(size)
  const height = canvas(size)
  const c = color.getContext('2d')
  const h = height.getContext('2d')
  c.fillStyle = '#4fb33c'
  c.fillRect(0, 0, size, size)
  h.fillStyle = '#808080'
  h.fillRect(0, 0, size, size)

  // Draws at (x, y) and again at the wrapped offsets so the tile repeats seamlessly.
  const wrapped = (x, y, r, draw) => {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        if (x + ox + r < 0 || x + ox - r > size || y + oy + r < 0 || y + oy - r > size) continue
        draw(x + ox, y + oy)
      }
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 30 + rand() * 70
    const dark = rand() < 0.5
    wrapped(x, y, r, (px, py) => {
      const g = c.createRadialGradient(px, py, 0, px, py, r)
      g.addColorStop(0, dark ? 'rgba(40,90,30,0.28)' : 'rgba(160,210,90,0.2)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      c.fillStyle = g
      c.fillRect(px - r, py - r, r * 2, r * 2)
    })
  }
  const greens = ['#3a9a2e', '#4fb33c', '#74b552', '#3f7a2e', '#8cc760']
  for (let i = 0; i < 9000; i++) {
    const x = rand() * size
    const y = rand() * size
    const len = 4 + rand() * 9
    const lean = (rand() - 0.5) * 5
    const shade = greens[Math.floor(rand() * greens.length)]
    const lift = 100 + Math.floor(rand() * 140)
    wrapped(x, y, len + 6, (px, py) => {
      c.strokeStyle = shade
      c.lineWidth = 1.3
      c.beginPath()
      c.moveTo(px, py)
      c.lineTo(px + lean, py - len)
      c.stroke()
      h.strokeStyle = `rgb(${lift},${lift},${lift})`
      h.lineWidth = 1.3
      h.beginPath()
      h.moveTo(px, py)
      h.lineTo(px + lean, py - len)
      h.stroke()
    })
  }
  return { color, height }
}

// Wood planks running along U: per-plank tint, wavy grain, dark seams. `base` = the wood colour.
export function paintPlanks(size = 512, planks = 6, seed = 9, base = '#a87042') {
  const [br, bg, bb] = hexRgb(base)
  const rand = mulberry32(seed)
  const warp = fbm(size, 4, 3, seed + 1)
  const plankH = size / planks
  const offsets = Array.from({ length: planks }, () => rand() * 40)
  const tints = Array.from({ length: planks }, () => 0.8 + rand() * 0.25)
  const heights = new Float32Array(size * size)
  const color = canvas(size)
  const ctx = color.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / plankH)
    const ly = y - row * plankH
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      const seam = ly < 2 || ly > plankH - 2
      const grain = 0.5 + 0.5 * Math.sin((y + warp[i] * 30) * 0.9 + offsets[row] + Math.sin(x * 0.02 + row) * 2)
      const shade = seam ? 0.35 : tints[row] * (0.78 + grain * 0.22)
      heights[i] = seam ? 0 : 0.7 + grain * 0.08
      img.data[i * 4] = br * shade
      img.data[i * 4 + 1] = bg * shade
      img.data[i * 4 + 2] = bb * shade
      img.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return { color, normal: heightToNormal(heights, size, 1.5) }
}

// Vertical 0..1 alpha ramp (glow curtains, light beams): opaque at the bottom.
export function paintFade(color = '#ffffff', h = 128) {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = h
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, h, 0, 0)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, h)
  return c
}

// Outlined game-sign text on a transparent canvas, sized to fit. `draw` can be
// called again once the web font has loaded (the canvas is repainted in place).
// '\n' splits lines; `colors` gives each line its own colour (else `color`).
export function paintText(text, { color = '#ffffff', colors = null, outline = '#0b1a3a', font = '700 96px Fredoka, "Arial Black", sans-serif', pad = 24, bg = null, outlineWidth = 14 } = {}) {
  const c = document.createElement('canvas')
  const lines = String(text).split('\n')
  const draw = () => {
    const ctx = c.getContext('2d')
    ctx.font = font
    const width = Math.max(...lines.map((l) => ctx.measureText(l).width))
    const px = parseInt(font.match(/(\d+)px/)[1], 10)
    const lineH = px * 1.2
    c.width = Math.ceil(width + pad * 2)
    c.height = Math.ceil(lineH * lines.length + px * 0.1 + pad * 2)
    ctx.font = font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (bg) {
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, c.width, c.height)
    }
    ctx.lineJoin = 'round'
    lines.forEach((line, i) => {
      const y = pad + lineH * (i + 0.5) + px * 0.05
      if (outline) {
        ctx.lineWidth = outlineWidth
        ctx.strokeStyle = outline
        ctx.strokeText(line, c.width / 2, y)
      }
      ctx.fillStyle = colors?.[i] ?? color
      ctx.fillText(line, c.width / 2, y)
    })
  }
  draw()
  return { canvas: c, draw }
}

// Feather flag: red with one white diagonal band (UVs span the flag 0..1).
export function paintFlag(red = '#e3262e', white = '#ffffff', w = 64, h = 256) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.fillStyle = red
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = white
  ctx.beginPath()
  ctx.moveTo(0, h * 0.62)
  ctx.lineTo(w, h * 0.36)
  ctx.lineTo(w, h * 0.5)
  ctx.lineTo(0, h * 0.78)
  ctx.closePath()
  ctx.fill()
  return c
}

// Waterfall sheet: vertical white streaks of varying width over blue (scroll offset.y).
export function paintWaterfall(size = 256) {
  const rand = mulberry32(808)
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, size, 0)
  g.addColorStop(0, '#1690ff')
  g.addColorStop(0.5, '#4cc8ff')
  g.addColorStop(1, '#1690ff')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 70; i++) {
    const x = rand() * size
    const w = 1 + rand() * 5
    const y = rand() * size
    const len = size * (0.2 + rand() * 0.6)
    ctx.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.5})`
    ctx.fillRect(x, y, w, len)
    ctx.fillRect(x, y - size, w, len) // wrap vertically so it tiles
  }
  return c
}

// Particle sprites (white, tinted in the shader). Soft dot: a radial falloff.
export function paintSoftDot(size = 64) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

// Sparkle: a four-point star with a bright core.
export function paintSparkle(size = 64) {
  const c = paintSoftDot(size)
  const ctx = c.getContext('2d')
  const m = size / 2
  ctx.globalCompositeOperation = 'lighter'
  for (const [w, h] of [[size * 0.07, size * 0.5], [size * 0.5, size * 0.07]]) {
    const g = ctx.createRadialGradient(m, m, 0, m, m, Math.max(w, h))
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(m, m, w, h, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  return c
}

// Treadmill belt for the training lanes: dark ribbed rubber with two bold chevrons in the lane's
// colour pointing at canvas top (the belt's near end; it is also the emissive map, so they glow).
// Tiles along v (the belt).
export function paintTreadmill(glow = '#4fd8ff', size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#161a24'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#20263a' // rubber ribs across the belt
  for (let y = 0; y < size; y += 8) ctx.fillRect(0, y, size, 3)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const y0 of [0.12, 0.62]) {
    for (const [w, col] of [[0.16, glow], [0.07, '#ffffff']]) {
      ctx.strokeStyle = col
      ctx.globalAlpha = col === glow ? 1 : 0.55
      ctx.lineWidth = size * w
      ctx.beginPath()
      ctx.moveTo(size * 0.2, size * (y0 + 0.24))
      ctx.lineTo(size * 0.5, size * y0)
      ctx.lineTo(size * 0.8, size * (y0 + 0.24))
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
  return c
}

// Swirling portal fill: spiral arms of `color` round a bright core, fading out at the rim.
export function paintSwirl(color = '#3dff6a', size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const r = size / 2
  const bg = ctx.createRadialGradient(r, r, 0, r, r, r)
  bg.addColorStop(0, '#ffffff')
  bg.addColorStop(0.25, color)
  bg.addColorStop(1, '#03140a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  ctx.translate(r, r)
  ctx.lineCap = 'round'
  for (let arm = 0; arm < 4; arm++) {
    ctx.strokeStyle = arm % 2 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)'
    ctx.lineWidth = size * 0.035
    ctx.beginPath()
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const a = arm * (Math.PI / 2) + t * Math.PI * 2.2
      const rr = t * r * 0.95
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
    }
    ctx.stroke()
  }
  return c
}

// Quilted shop floor: a pink base with a softly shaded diamond grid (one
// diamond per tile; repeat it per ~2 m).
export function paintQuilt(base = '#ff5fa8', size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.55)
  g.addColorStop(0, 'rgba(255,255,255,0.16)')
  g.addColorStop(1, 'rgba(120,0,40,0.12)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(150,10,60,0.35)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(size / 2, 0)
  ctx.lineTo(size, size / 2)
  ctx.lineTo(size / 2, size)
  ctx.lineTo(0, size / 2)
  ctx.closePath()
  ctx.stroke()
  return c
}

// Sunny plaza sand: pale yellow fbm cut into big flat tiles by thin darker cracks (a tileable
// Voronoi on a jittered `cells` x `cells` grid). Tileable both ways.
export function paintSand(size = 512, seed = 515, cells = 4, lo = '#ffcc3c', hi = '#ffdc5c', crack = '#f2b636') {
  const rand = mulberry32(seed)
  const field = fbm(size, 5, 4, seed)
  const pts = []
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.15 + rand() * 0.7) / cells, (j + 0.15 + rand() * 0.7) / cells])
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const [loC, hiC, crC] = [hexRgb(lo), hexRgb(hi), hexRgb(crack)]
  const tone = pts.map(() => rand() * 0.25) // each tile a shade lighter or darker
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      const ci = Math.floor(u * cells)
      const cj = Math.floor(v * cells)
      let d1 = 9
      let d2 = 9
      let near = 0
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = (ci + di + cells) % cells
          const jj = (cj + dj + cells) % cells
          const [px, py] = pts[jj * cells + ii]
          const dx = px + Math.floor((ci + di) / cells) - u
          const dy = py + Math.floor((cj + dj) / cells) - v
          const d = dx * dx + dy * dy
          if (d < d1) {
            d2 = d1
            d1 = d
            near = jj * cells + ii
          } else if (d < d2) d2 = d
        }
      const i = y * size + x
      const edge = (Math.sqrt(d2) - Math.sqrt(d1)) * cells // 0 on a crack
      const t = Math.min(1, Math.max(0, field[i] * 0.6 + 0.35 - tone[near] * 0.6))
      const k = edge < 0.03 ? 0.7 : edge < 0.055 ? 0.25 : 0
      for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] = (loC[ch] + (hiC[ch] - loC[ch]) * t) * (1 - k) + crC[ch] * k
      img.data[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// Road asphalt: dark grey fbm with light grit specks. Tileable both ways.
export function paintAsphalt(size = 256, seed = 404, lo = '#4f525a', hi = '#6a6d75') {
  const rand = mulberry32(seed)
  const field = fbm(size, 8, 4, seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const [loC, hiC] = [hexRgb(lo), hexRgb(hi)]
  for (let i = 0; i < size * size; i++) {
    const t = Math.min(1, Math.max(0, field[i] * 1.1 - 0.05 + (rand() - 0.5) * 0.18))
    for (let k = 0; k < 3; k++) img.data[i * 4 + k] = loC[k] + (hiC[k] - loC[k]) * t
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// Diagonal two-colour stripes (barriers, candy canes, tent roofs): `n` stripe pairs across the
// width, tileable.
export function paintStripes(a = '#e8262b', b = '#ffffff', n = 2, size = 128, slant = 1) {
  const c = canvas(size)
  const ctx = c.getContext('2d')
  ctx.fillStyle = b
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = a
  const w = size / n
  for (let i = -n * 2; i < n * 2; i++) {
    const x = i * w
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + w / 2, 0)
    ctx.lineTo(x + w / 2 + size * slant, size)
    ctx.lineTo(x + size * slant, size)
    ctx.closePath()
    ctx.fill()
  }
  return c
}

// Dirt track: warm brown fbm (from `lo` to `hi`), raked furrows running down the track (canvas
// y = along the track), pebbles and scattered hoof prints. Tileable both ways.
export function paintDirt(size = 256, seed = 808, lo = '#9a6a3e', hi = '#c99662') {
  const rand = mulberry32(seed)
  const field = fbm(size, 6, 4, seed)
  const c = canvas(size)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(size, size)
  const [loC, hiC] = [hexRgb(lo), hexRgb(hi)]
  for (let i = 0; i < size * size; i++) {
    const x = i % size
    // Furrows: a soft ridge every size/16 px across the track.
    const furrow = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 2 * 16)
    const t = Math.min(1, Math.max(0, field[i] * 1.2 - 0.1 + furrow * 0.12))
    for (let k = 0; k < 3; k++) img.data[i * 4 + k] = loC[k] + (hiC[k] - loC[k]) * t
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const wrapped = (x, y, r, draw) => {
    for (const ox of [-size, 0, size])
      for (const oy of [-size, 0, size]) if (!(x + ox + r < 0 || x + ox - r > size || y + oy + r < 0 || y + oy - r > size)) draw(x + ox, y + oy)
  }
  // Hoof prints: small dark crescents.
  for (let i = 0; i < 26; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = size * (0.012 + rand() * 0.008)
    wrapped(x, y, r * 2, (px, py) => {
      ctx.strokeStyle = 'rgba(70,42,20,0.28)'
      ctx.lineWidth = r * 0.7
      ctx.beginPath()
      ctx.arc(px, py, r, Math.PI * 0.15, Math.PI * 0.85, true)
      ctx.stroke()
    })
  }
  // Pebbles: light and dark specks.
  for (let i = 0; i < 160; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 0.6 + rand() * 1.6
    const light = rand() < 0.5
    wrapped(x, y, r, (px, py) => {
      ctx.fillStyle = light ? 'rgba(232,206,160,0.8)' : 'rgba(84,54,30,0.6)'
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    })
  }
  return c
}
