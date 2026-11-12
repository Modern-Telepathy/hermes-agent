import { describe, expect, it } from 'vitest'

import {
  emptyKamijiLook,
  isKamijiShape,
  kamijiLookFor,
  kamijiOptions,
  kamijiShapeString,
  parseKamijiShape
} from './kamiji-look'

/** `kamiji:v1:<seed>:<expression>:<hue>:<tone>:<traits>`, field by field so a
 *  test never has to count colons. */
const stored = (seed = '', expression = '', hue = '', tone = '', traits = '') =>
  ['kamiji', 'v1', seed, expression, hue, tone, traits].join(':')

describe('the Kamiji look format', () => {
  it('recognizes only its own prefix', () => {
    expect(isKamijiShape(stored())).toBe(true)
    expect(isKamijiShape('kamiji')).toBe(false)
    expect(isKamijiShape('blobatar:abc:round')).toBe(false)
    expect(isKamijiShape('squircle')).toBe(false)
    expect(isKamijiShape(null)).toBe(false)
  })

  it('round-trips every axis it writes', () => {
    const look = {
      seed: '7f3a',
      expression: 'smug' as const,
      hue: 212,
      tone: 0.4,
      traits: { shape: 0.965, 'eye.gap': 0.25, 'body.n': 0.5 }
    }

    expect(parseKamijiShape(kamijiShapeString(look), 'ada').look).toEqual(look)
  })

  it('keeps an untouched look following the name', () => {
    const shape = kamijiShapeString(emptyKamijiLook())

    expect(shape).toBe(stored())
    expect(parseKamijiShape(shape, 'ada')).toEqual({
      look: emptyKamijiLook(),
      seed: 'ada'
    })
  })

  it('pins only the axes that were moved', () => {
    const shape = kamijiShapeString({ ...emptyKamijiLook(), traits: { 'eye.ratio': 0.5 } })

    expect(shape).toBe(stored('', '', '', '', 'eye.ratio=500'))
    expect(parseKamijiShape(shape, 'ada').look.traits).toEqual({ 'eye.ratio': 0.5 })
  })

  it('drops axes and poses this build does not know', () => {
    const { look } = parseKamijiShape(stored('ada', 'ecstatic', '', '', 'eye.ratio=500;tail=700'), 'ada')

    expect(look.expression).toBe('idle')
    expect(look.traits).toEqual({ 'eye.ratio': 0.5 })
  })

  it('wraps out-of-range hues instead of storing them', () => {
    expect(parseKamijiShape(stored('', '', '400'), 'ada').look.hue).toBe(40)
    expect(parseKamijiShape(stored('', '', '-10'), 'ada').look.hue).toBe(350)
  })

  it('reads a look stored by another build as the name-following default', () => {
    expect(parseKamijiShape('kamiji:v2:ada:happy:200:', 'ada')).toEqual({
      look: emptyKamijiLook(),
      seed: 'ada'
    })
  })

  it('opens the studio on the name when there is no Kamiji yet', () => {
    expect(kamijiLookFor('blobatar::round', 'ada')).toEqual({ ...emptyKamijiLook(), seed: 'ada' })
    expect(kamijiLookFor(stored('7f3a', 'smug', '212'), 'ada')).toMatchObject({
      seed: '7f3a',
      expression: 'smug',
      hue: 212
    })
  })

  it('hands blobatar only the options the look states', () => {
    const idleLook = kamijiOptions(emptyKamijiLook(), 40)

    expect(idleLook).not.toHaveProperty('hue')
    expect(idleLook).not.toHaveProperty('tone')
    expect(idleLook).not.toHaveProperty('traits')

    const pinned = kamijiOptions({ ...emptyKamijiLook(), hue: 12, tone: 0.2, traits: { shape: 0.1 } }, 40)

    expect(pinned.hue).toBe(12)
    expect(pinned.tone).toBe(0.2)
    expect(pinned.traits).toEqual({ shape: 0.1 })
  })
})
