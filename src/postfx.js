import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { BLOOM } from './config.js'

// One NaN / Infinity pixel in the HDR buffer (a degenerate normal, a zero-size particle) is
// smeared by the bloom blur into a hard-edged black block that comes and goes with the camera.
// This pass runs before the bloom and zeroes such pixels (NaN fails every comparison, so the
// range test catches it) and caps the rest at `limit`, far above the bloom threshold.
const ScrubShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      bool ok = c.r >= 0.0 && c.r < 1.0e4 && c.g >= 0.0 && c.g < 1.0e4 && c.b >= 0.0 && c.b < 1.0e4;
      gl_FragColor = ok ? vec4(min(c.rgb, vec3(64.0)), c.a) : vec4(0.0, 0.0, 0.0, 1.0);
    }`,
}

// Optional bloom, so the neon lane rails, the waterfall, the VIP gate and the
// particles glow like the reference. The scene renders into a half-float
// target (HDR, before tone mapping); the bloom pass only picks up what is
// brighter than BLOOM.threshold, which ordinary sunlit surfaces stay under,
// so materials opt in by going HDR (emissive or a colour scaled above 1).
// OutputPass then applies the renderer's tone mapping + sRGB. Off on the
// lighter graphics presets: there the plain renderer.render path is used.
export function createPostFx(renderer, scene, camera) {
  let composer = null
  let bloom = null
  let enabled = false
  const size = new Vector2()

  function build(samples) {
    composer?.dispose()
    renderer.getSize(size)
    const target = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType, samples })
    composer = new EffectComposer(renderer, target)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new ShaderPass(ScrubShader))
    bloom = new UnrealBloomPass(new Vector2(size.x, size.y), BLOOM.strength, BLOOM.radius, BLOOM.threshold)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(size.x, size.y)
  }

  return {
    get bloom() {
      return bloom // for tuning from the dev console
    },
    // preset: a graphicsPreset() result (bloom + antialias decide the setup).
    configure(preset) {
      enabled = !!preset.bloom
      if (!enabled) {
        composer?.dispose()
        composer = null
        bloom = null
        return
      }
      build(preset.antialias ? 4 : 0)
    },
    setSize(w, h) {
      if (!composer) return
      composer.setPixelRatio(renderer.getPixelRatio())
      composer.setSize(w, h)
    },
    render() {
      if (enabled && composer) composer.render()
      else renderer.render(scene, camera)
    },
  }
}
