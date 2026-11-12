/**
 * The Kamiji look: the face a bot profile wears, editable axis by axis.
 *
 * blobatar draws a face from a seed plus `traits` — each trait is a 0–1
 * position the hash would otherwise have chosen — so a stored look is
 *
 *     kamiji:v1:<seed>:<expression>:<hue>:<tone>:<axis>=<pos>;<axis>=<pos>
 *
 * where an empty seed means "follow the bot's name", empty hue/tone mean "the
 * name's colour", and only the axes the user actually moved are pinned. That
 * last part is the whole point of the format: an untouched look still derives
 * from the name, while a pinned axis is the user's, and neither disturbs the
 * other.
 *
 * Positions travel as per-mille integers so the string is stable, diffable
 * (`editedLook` compares strings) and short enough to ride `ui_meta`, which is
 * capped and synced on every `profiles.list`.
 */

import {
  happy,
  idle,
  love,
  mad,
  sad,
  scared,
  shy,
  sick,
  sleepy,
  smug,
  surprised,
  thinking,
  unsure,
  wink
} from 'blobatar/expression'
import type { Expression } from 'blobatar/expression'

export const KAMIJI_PREFIX = 'kamiji:'
const VERSION = 'v1'

/** The axes the studio edits, in the order they are serialized. `kind` is the
 *  named band centre each one snaps to, for the quick picks. */
export const KAMIJI_AXES = [
  { hint: 'Silhouette', key: 'shape' },
  { hint: 'Body roundness', key: 'body.n' },
  { hint: 'Body height', key: 'body.ratio' },
  { hint: 'Eye size', key: 'eye.rx' },
  { hint: 'Eye height', key: 'eye.ratio' },
  { hint: 'Eye spacing', key: 'eye.gap' },
  { hint: 'Eye tilt', key: 'eye.lean' },
  { hint: 'Right eye size', key: 'eye.scale' },
  { hint: 'Eye roundness', key: 'eye.n' }
] as const

export type KamijiAxis = (typeof KAMIJI_AXES)[number]['key']

/** The fourteen poses `blobatar/expression` ships, name → value. Importing the
 *  values is how that package keeps unimported poses out of the bundle, so the
 *  table is explicit rather than resolved by name. */
export const KAMIJI_EXPRESSIONS = {
  idle,
  happy,
  sad,
  mad,
  surprised,
  wink,
  sleepy,
  smug,
  unsure,
  scared,
  love,
  shy,
  sick,
  thinking
} as const satisfies Record<string, Expression>

export type KamijiExpressionName = keyof typeof KAMIJI_EXPRESSIONS

export const KAMIJI_EXPRESSION_NAMES = Object.keys(KAMIJI_EXPRESSIONS) as KamijiExpressionName[]

export interface KamijiLook {
  /** Expression pose held by the face. `idle` is blobatar's default. */
  expression: KamijiExpressionName
  /** Whole degrees, or null to keep the name's hue. */
  hue: null | number
  /** Pinned axes only, each a 0–1 position. */
  traits: Partial<Record<KamijiAxis, number>>
  /** A locked seed, or '' to follow the bot's name. */
  seed: string
  /** 0–0.999, or null to keep the name's tone. */
  tone: null | number
}

export function emptyKamijiLook(): KamijiLook {
  return { seed: '', expression: 'idle', hue: null, tone: null, traits: {} }
}

export function isKamijiShape(shape: null | string | undefined): boolean {
  return typeof shape === 'string' && shape.startsWith(KAMIJI_PREFIX)
}

/** 0–1 → the string's per-mille integer (tempered at 1, so the top edge keeps
 *  the position it names instead of rolling over to the bottom of the band). */
const position = (value: number) => Math.round(Math.max(0, Math.min(0.999, value)) * 1000)

const axisKeys = new Set<string>(KAMIJI_AXES.map(axis => axis.key))

/** Whatever this build does not know is dropped on read, not on write: an
 *  unknown expression or axis comes from a newer build and is not ours. */
export function parseKamijiShape(
  shape: null | string | undefined,
  name: string | undefined
): { look: KamijiLook; seed: string } {
  const empty = emptyKamijiLook()

  if (!isKamijiShape(shape)) {
    return { look: empty, seed: name || 'agent' }
  }

  const [, version, rawSeed = '', rawExpression = '', rawHue = '', rawTone = '', rawTraits = ''] =
    String(shape).split(':')

  if (version && version !== VERSION) {
    return { look: empty, seed: name || 'agent' }
  }

  const look: KamijiLook = { ...empty, seed: rawSeed }
  const expression = rawExpression as KamijiExpressionName

  if (rawExpression && KAMIJI_EXPRESSIONS[expression]) {
    look.expression = expression
  }

  const hue = Number.parseInt(rawHue, 10)

  if (Number.isFinite(hue)) {
    look.hue = ((hue % 360) + 360) % 360
  }

  const tone = Number.parseInt(rawTone, 10)

  if (Number.isFinite(tone)) {
    look.tone = Math.max(0, Math.min(999, tone)) / 1000
  }

  for (const pair of rawTraits.split(';')) {
    const [key, raw] = pair.split('=')

    if (!key || raw === undefined || !axisKeys.has(key)) {
      continue
    }

    const value = Number.parseInt(raw, 10)

    if (Number.isFinite(value)) {
      look.traits[key as KamijiAxis] = Math.max(0, Math.min(999, value)) / 1000
    }
  }

  return { look, seed: look.seed || name || 'agent' }
}

export function kamijiShapeString(look: KamijiLook): string {
  const traits = KAMIJI_AXES.filter(axis => look.traits[axis.key] !== undefined)
    .map(axis => `${axis.key}=${position(look.traits[axis.key] as number)}`)
    .join(';')

  const hue = look.hue === null ? '' : String(((Math.round(look.hue) % 360) + 360) % 360)
  const tone = look.tone === null ? '' : String(position(look.tone))

  return [
    'kamiji',
    VERSION,
    look.seed.replace(/:/g, ''),
    look.expression === 'idle' ? '' : look.expression,
    hue,
    tone,
    traits
  ].join(':')
}

/** A look seeded from the bot's own name — what the studio opens with when the
 *  bot has no Kamiji yet, and what "start over" goes back to. */
export function kamijiLookFor(shape: null | string | undefined, name: string): KamijiLook {
  const parsed = parseKamijiShape(shape, name)

  return isKamijiShape(shape) ? parsed.look : { ...emptyKamijiLook(), seed: name || 'agent' }
}

/** The renderer options this look describes. Untouched axes are absent, so the
 *  seed keeps driving them — blobatar's own "lock the two things that carry
 *  your brand" middle ground. */
export function kamijiOptions(look: KamijiLook, size: number) {
  return {
    size,
    expression: KAMIJI_EXPRESSIONS[look.expression] ?? idle,
    ...(look.hue === null ? null : { hue: look.hue }),
    ...(look.tone === null ? null : { tone: look.tone }),
    ...(Object.keys(look.traits).length ? { traits: { ...look.traits } } : null)
  }
}
