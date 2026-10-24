// A Boxity chat bubble over one player (docs.bloxity.io CHAT): Boxity draws the chat itself, the game
// only shows each player's latest message over their head for bubbleSeconds; a newer message
// replaces it. Over a name tag it sits just above the tag. A white rounded sign, like a speech bubble.
import { CHAT_BUBBLE } from './config.js'
import { label } from './propkit.js'

export function createBubble(parent, y) {
  let sprite = null
  let until = 0

  function clear() {
    if (!sprite) return
    parent.remove(sprite)
    sprite.material.map?.dispose()
    sprite.material.dispose()
    sprite = null
  }

  return {
    // text: up to two lines (the SDK's bubbleText).
    show(text, seconds) {
      clear()
      const lines = String(text).split('\n').length
      sprite = label(text, CHAT_BUBBLE.height * (0.6 + 0.4 * lines), { color: '#1a0a14', outline: null, bg: 'rgba(255,255,255,0.92)', font: '600 56px Fredoka, sans-serif', pad: 20 })
      sprite.position.y = y
      sprite.renderOrder = 10
      parent.add(sprite)
      until = performance.now() + seconds * 1000
    },
    update(now = performance.now()) {
      if (sprite && now >= until) clear()
    },
    dispose: clear,
  }
}
