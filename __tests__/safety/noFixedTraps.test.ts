/**
 * Guards the bug that cut the top off the new-event form.
 *
 * `.anim-scale-in` and `.anim-slide-in` ran with `animation-fill-mode:
 * both`, which holds the final keyframe after the animation ends. Those
 * keyframes end on `scale(1)` and `translateY(0)` — identity transforms
 * that change nothing visually, and yet leave the element with a
 * computed `transform`. Any transform makes an element the containing
 * block for `position: fixed` descendants.
 *
 * So seventeen view wrappers quietly became "the viewport" as far as
 * their modals were concerned. The new-event form was centred on the
 * page wrapper instead of the window and its header sat above the top
 * of the screen, unreachable — a fixed element cannot be scrolled to.
 *
 * `backwards` still prevents the flash of un-animated content and lets
 * the element return to having no transform.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { globSync } from 'glob'

const ROOT = join(__dirname, '..', '..')
const globals = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8')

describe('view entrance animations do not trap fixed overlays', () => {
  it.each(['anim-scale-in', 'anim-slide-in'])(
    '.%s does not hold its transform after finishing', (cls) => {
      /* The utilities live inside a nested at-rule, so match the class
         and read the single `animation:` declaration that follows it
         rather than assuming a flat, brace-free rule body. */
      const rule = globals.match(
        new RegExp(`\\.${cls}\\s*\\{[\\s\\S]{0,200}?animation:([^;]+);`))
      /* Jest's expect takes one argument — the message form is Vitest. */
      expect(rule).not.toBeNull()
      const decl = rule![1]
      /* `both` and `forwards` both hold the last keyframe, and the last
         keyframe here is a transform. */
      expect(decl).not.toMatch(/\b(both|forwards)\b/)
    })

  it('their keyframes still end on an identity transform', () => {
    // If a future keyframe ended somewhere other than identity, dropping
    // the forwards fill would change how the view looks, not just how it
    // is positioned — so this is worth knowing about.
    expect(globals).toMatch(/@keyframes scaleIn[\s\S]{0,160}?to\s*\{[^}]*transform:\s*scale\(1\)/)
    expect(globals).toMatch(/@keyframes slideIn[\s\S]{0,160}?to\s*\{[^}]*transform:\s*translateY\(0\)/)
  })
})

describe('centred panels are capped to the window', () => {
  /*
   * A centred fixed panel with no height cap does not overflow downward,
   * it overflows equally at both ends — and being fixed, neither end can
   * be scrolled to.
   */
  const files = globSync('components/**/*.module.css', { cwd: ROOT, nodir: true })

  it('finds stylesheets to check', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('no fixed, centred card is left without a height cap', () => {
    const offenders: string[] = []
    for (const rel of files) {
      const css = readFileSync(join(ROOT, rel), 'utf8')
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const body = m[2]
        if (!/position:\s*fixed/.test(body)) continue
        if (!/translate\(-50%,\s*-50%\)/.test(body)) continue
        if (/max-height/.test(body)) continue
        offenders.push(`${rel} — ${m[1].trim().slice(0, 40)}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
