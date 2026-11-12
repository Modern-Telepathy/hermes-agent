/**
 * Kamiji studio: the full face editor for a bot profile.
 *
 * blobatar derives a face from the name and lets any axis be pinned as a 0–1
 * position, so the studio is one slider per axis plus a silhouette quick-pick,
 * a pose grid, a seed and the two colour axes. Only the axes the user moves are
 * pinned (see `kamiji-look.ts`), so a half-edited face still keeps the parts of
 * the name's creature the user never touched.
 *
 * Copy is inline rather than in `i18n-messages.ts`: every string here names a
 * geometry axis, and the per-locale bundles would have to translate labels like
 * "Right eye size" without a picture to point at.
 */

import { Button, cn, Codicon, Input, RowButton, Tip } from '@hermes/plugin-sdk'

import { BLOB_KIND_TRAIT, BLOB_KINDS, blobatarSvg } from './avatar'
import {
  emptyKamijiLook,
  KAMIJI_AXES,
  KAMIJI_EXPRESSION_NAMES,
  type KamijiAxis,
  type KamijiLook,
  kamijiOptions
} from './kamiji-look'

interface KamijiStudioProps {
  look: KamijiLook
  /** The bot's name: the seed the face falls back to and the live example. */
  name: string
  onChange: (look: KamijiLook) => void
  /** Preview edge in px; the studio's own preview is bigger than a roster row. */
  size?: number
}

const AXIS_LABEL: Record<KamijiAxis, string> = Object.fromEntries(
  KAMIJI_AXES.map(axis => [axis.key, axis.hint])
) as Record<KamijiAxis, string>

/** One pinned 0–1 axis: the slider writes a position, the ↺ hands the axis back
 *  to the seed. Unpinned axes sit at the middle as a starting point rather than
 *  pretending to show the hash. */
function AxisRow({
  axis,
  look,
  onChange
}: {
  axis: KamijiAxis
  look: KamijiLook
  onChange: (look: KamijiLook) => void
}) {
  const pinned = look.traits[axis] !== undefined
  const value = look.traits[axis] ?? 0.5

  const set = (next: number) =>
    onChange({
      ...look,
      traits: { ...look.traits, [axis]: next }
    })

  return (
    <div className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2">
      <span
        className={cn('truncate text-[0.7rem]', pinned ? 'text-(--ui-text-secondary)' : 'text-(--ui-text-quaternary)')}
      >
        {AXIS_LABEL[axis]}
      </span>
      <input
        aria-label={AXIS_LABEL[axis]}
        className={cn(
          'h-1 w-full cursor-pointer appearance-none rounded-full bg-(--ui-stroke-secondary) accent-(--ui-accent)',
          !pinned && 'opacity-60'
        )}
        max={999}
        min={0}
        onChange={event => set(Number(event.target.value) / 1000)}
        type="range"
        value={Math.round(value * 1000)}
      />
      <button
        aria-label={`Reset ${AXIS_LABEL[axis]}`}
        className={cn(
          'flex size-5 items-center justify-center rounded text-[0.7rem]',
          pinned ? 'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover)' : 'invisible'
        )}
        onClick={() => onChange({ ...look, traits: { ...look.traits, [axis]: undefined } })}
        type="button"
      >
        <Codicon name="discard" />
      </button>
    </div>
  )
}

function ColorRow({
  label,
  max,
  onChange,
  onReset,
  value
}: {
  label: string
  max: number
  onChange: (value: number) => void
  onReset: () => void
  value: null | number
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2">
      <span
        className={cn('text-[0.7rem]', value === null ? 'text-(--ui-text-quaternary)' : 'text-(--ui-text-secondary)')}
      >
        {label}
      </span>
      <input
        aria-label={label}
        className={cn(
          'h-1 w-full cursor-pointer appearance-none rounded-full bg-(--ui-stroke-secondary) accent-(--ui-accent)',
          value === null && 'opacity-60'
        )}
        max={max}
        min={0}
        onChange={event => onChange(Number(event.target.value))}
        type="range"
        value={value ?? Math.round(max / 2)}
      />
      <button
        aria-label={`Reset ${label}`}
        className={cn(
          'flex size-5 items-center justify-center rounded text-[0.7rem]',
          value !== null ? 'text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover)' : 'invisible'
        )}
        onClick={onReset}
        type="button"
      >
        <Codicon name="discard" />
      </button>
    </div>
  )
}

export function KamijiStudio({ look, name, onChange, size = 144 }: KamijiStudioProps) {
  const seed = look.seed || name || 'agent'

  const markup = blobatarSvg
    ? (() => {
        try {
          return blobatarSvg(seed, kamijiOptions(look, size))
        } catch {
          return null
        }
      })()
    : null

  return (
    <div className="grid gap-3">
      <div className="flex justify-center py-1">
        {markup ? (
          <span
            aria-hidden
            dangerouslySetInnerHTML={{ __html: markup }}
            style={{ display: 'block', height: size, lineHeight: 0, width: size }}
          />
        ) : (
          <span className="text-xs text-(--ui-text-tertiary)">The face needs a newer desktop build.</span>
        )}
      </div>

      {/* Silhouette: the ten named bands, each a position on the same axis the
          slider below pins, so a quick pick and a drag write the same thing. */}
      <div className="grid grid-cols-5 gap-1.5">
        {BLOB_KINDS.map(kind => {
          const active = look.traits.shape === BLOB_KIND_TRAIT[kind]

          return (
            <Tip key={kind} label={kind}>
              <button
                aria-label={kind}
                className={cn(
                  'h-6 rounded-md border text-[0.6rem] capitalize transition-colors',
                  active
                    ? 'border-(--ui-accent) text-(--ui-text-primary)'
                    : 'border-(--ui-stroke-secondary) text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover)'
                )}
                onClick={() => onChange({ ...look, traits: { ...look.traits, shape: BLOB_KIND_TRAIT[kind] } })}
                type="button"
              >
                {kind}
              </button>
            </Tip>
          )
        })}
      </div>

      <div className="grid gap-1.5">
        {KAMIJI_AXES.map(axis => (
          <AxisRow axis={axis.key} key={axis.key} look={look} onChange={onChange} />
        ))}
        <ColorRow
          label="Hue"
          max={359}
          onChange={hue => onChange({ ...look, hue })}
          onReset={() => onChange({ ...look, hue: null })}
          value={look.hue}
        />
        <ColorRow
          label="Tone"
          max={999}
          onChange={tone => onChange({ ...look, tone: tone / 1000 })}
          onReset={() => onChange({ ...look, tone: null })}
          value={look.tone === null ? null : Math.round(look.tone * 1000)}
        />
      </div>

      <div className="grid gap-1.5">
        <span className="text-[0.7rem] text-(--ui-text-quaternary)">Pose</span>
        <div className="flex flex-wrap gap-1">
          {KAMIJI_EXPRESSION_NAMES.map(pose => (
            <button
              aria-label={pose}
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[0.6rem] capitalize transition-colors',
                look.expression === pose
                  ? 'border-(--ui-accent) text-(--ui-text-primary)'
                  : 'border-(--ui-stroke-secondary) text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover)'
              )}
              key={pose}
              onClick={() => onChange({ ...look, expression: pose })}
              type="button"
            >
              {pose}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          aria-label="Seed"
          className="h-7 text-xs"
          onChange={event => onChange({ ...look, seed: event.target.value.replace(/[:\s]/g, '').slice(0, 24) })}
          placeholder={name || 'agent'}
          value={look.seed}
        />
        <Tip label="Roll a new face">
          <RowButton
            aria-label="Roll a new face"
            className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-(--chrome-action-hover)"
            onClick={() => onChange({ ...look, seed: Math.random().toString(36).slice(2, 10) })}
          >
            <Codicon className="text-[0.8rem]" name="refresh" />
          </RowButton>
        </Tip>
      </div>

      <div className="flex items-center justify-between">
        <Button
          className="text-(--ui-text-tertiary)"
          onClick={() => onChange({ ...emptyKamijiLook(), seed: name || 'agent' })}
          size="sm"
          type="button"
          variant="ghost"
        >
          Start over
        </Button>
        <Button
          className="text-(--ui-text-tertiary)"
          onClick={() => onChange({ ...look, seed: '' })}
          size="sm"
          type="button"
          variant="ghost"
        >
          Follow the name
        </Button>
      </div>
    </div>
  )
}
