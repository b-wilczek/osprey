'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Location = {
  location_id: string
  location: string
}

type Item = {
  item_id: string
  item_name: string
  unit: string | null
  unit_qty: number | null
  sub_unit: string | null
  unit_sub_qty: number | null
}

type Entry = { main: string; sub: string }

type Draft = {
  name: string
  locationId: string
  date: string
  entries: Record<string, Entry>
  savedAt: number
}

const DRAFT_KEY = 'osprey.logInventory.draft'
const NAME_KEY = 'osprey.logInventory.name'
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000 // drafts older than a day are dropped

// ---------- storage helpers (never throw) ----------
function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as Draft
    if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) return null
    return draft
  } catch {
    return null
  }
}

function writeDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {}
}

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {}
}

// ---------- small utils ----------
function todayLocal() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in the device's time zone
}

function toQty(value: string | undefined): number | null {
  return value ? parseInt(value, 10) : null // '' -> null, '0' -> 0
}

function hasValue(entry: Entry | undefined) {
  return !!entry && (entry.main !== '' || entry.sub !== '')
}

export function InventoryForm({ locations }: { locations: Location[] }) {
  const supabase = useMemo(() => createClient(), [])

  const [name, setName] = useState('')
  const [locationId, setLocationId] = useState('')
  const [date, setDate] = useState('')
  const [entries, setEntries] = useState<Record<string, Entry>>({})

  const [items, setItems] = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)

  const [loaded, setLoaded] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Restore draft (or defaults) once on the device
  useEffect(() => {
    const draft = readDraft()
    const validLocation =
      draft && locations.some((l) => l.location_id === draft.locationId)

    setName(draft?.name || readName())
    setLocationId(validLocation ? draft.locationId : '')
    setDate(draft?.date || todayLocal())
    setEntries(draft?.entries ?? {})
    setDraftRestored(!!draft && Object.values(draft.entries ?? {}).some(hasValue))
    setLoaded(true)
  }, [locations])

  // Save draft on every change
  useEffect(() => {
    if (!loaded) return
    writeDraft({ name, locationId, date, entries, savedAt: Date.now() })
  }, [loaded, name, locationId, date, entries])

  // Load items whenever the location changes
  useEffect(() => {
    if (!locationId) {
      setItems([])
      return
    }

    let cancelled = false
    setItemsLoading(true)
    setItemsError(null)

    supabase
      .rpc('log_get_items', { p_location_id: locationId })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setItems([])
          setItemsError('Couldn\'t load items. Check your connection and try again.')
        } else {
          setItems((data ?? []) as Item[])
        }
        setItemsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [locationId, supabase])

  function updateEntry(itemId: string, field: keyof Entry, value: string) {
    const digits = value.replace(/\D/g, '')
    setEntries((prev) => {
      const current = prev[itemId] ?? { main: '', sub: '' }
      return { ...prev, [itemId]: { ...current, [field]: digits } }
    })
    setSuccess(null)
  }

  function startOver() {
    setEntries({})
    setDate(todayLocal())
    setDraftRestored(false)
    setError(null)
    setSuccess(null)
  }

  const anyEntered = items.some((i) => hasValue(entries[i.item_id]))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!name.trim()) return setError('Enter your name.')
    if (!locationId) return setError('Choose a location.')
    if (!date) return setError('Choose a date.')
    if (!anyEntered) return setError('Enter at least one quantity.')

    setSubmitting(true)

    const p_lines = items.map((item) => {
      const entry = entries[item.item_id]
      return {
        item_id: item.item_id,
        qty_main: toQty(entry?.main),
        qty_sub: item.sub_unit ? toQty(entry?.sub) : null,
      }
    })

    const { error: rpcError } = await supabase.rpc('log_submit_count', {
      p_location_id: locationId,
      p_count_date: date,
      p_counted_by_name: name.trim(),
      p_lines,
    })

    setSubmitting(false)

    if (rpcError) {
      setError(rpcError.message || 'Something went wrong. Your entries are saved — try again.')
      return
    }

    const locationName =
      locations.find((l) => l.location_id === locationId)?.location ?? 'this location'
    writeName(name.trim())
    setEntries({})
    setDraftRestored(false)
    setSuccess(`Count saved for ${locationName} on ${date}.`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!loaded) {
    return <p className="text-sm opacity-70">Loading…</p>
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {success && (
          <p className="rounded-lg border border-green-600/40 bg-green-600/10 p-3 text-sm">
            {success}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
            {error}
          </p>
        )}
        {draftRestored && !success && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-foreground/15 p-3 text-sm">
            <span>Picked up where you left off.</span>
            <button type="button" onClick={startOver} className="shrink-0 text-sm">
              Start over
            </button>
          </div>
        )}
      </div>

      {/* Header fields */}
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Your name</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-base"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Location</span>
          <select
            value={locationId}
            onChange={(e) => {
              setLocationId(e.target.value)
              setSuccess(null)
            }}
            className="w-full text-base"
          >
            <option value="">Choose a location</option>
            {locations.map((l) => (
              <option key={l.location_id} value={l.location_id}>
                {l.location}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Count date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full text-base"
          />
        </label>
      </div>

      {/* Items */}
      {locationId && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Items</h2>

          {itemsLoading && <p className="text-sm opacity-70">Loading items…</p>}
          {itemsError && <p className="text-sm text-red-500">{itemsError}</p>}
          {!itemsLoading && !itemsError && items.length === 0 && (
            <p className="text-sm opacity-70">No items are set up for this location yet.</p>
          )}

          {!itemsLoading &&
            items.map((item) => {
              const entry = entries[item.item_id] ?? { main: '', sub: '' }
              const perUnit =
                item.sub_unit && item.unit_qty && item.unit_sub_qty
                  ? Math.round(item.unit_qty / item.unit_sub_qty)
                  : null

              return (
                <div
                  key={item.item_id}
                  className="rounded-lg border border-foreground/15 p-3"
                >
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="font-medium">{item.item_name}</span>
                    {perUnit && (
                      <span className="text-xs opacity-60">
                        1 {item.unit} = {perUnit} {item.sub_unit}
                      </span>
                    )}
                  </div>

                  <div className={`grid gap-3 ${item.sub_unit ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs opacity-70 capitalize">{item.unit ?? 'Quantity'}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="next"
                        value={entry.main}
                        onChange={(e) => updateEntry(item.item_id, 'main', e.target.value)}
                        className="w-full text-base"
                      />
                    </label>

                    {item.sub_unit && (
                      <label className="flex flex-col gap-1">
                        <span className="text-xs opacity-70 capitalize">{item.sub_unit}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          enterKeyHint="next"
                          value={entry.sub}
                          onChange={(e) => updateEntry(item.item_id, 'sub', e.target.value)}
                          className="w-full text-base"
                        />
                      </label>
                    )}
                  </div>
                </div>
              )
            })}
        </section>
      )}

      {/* Sticky submit bar */}
      <div className="sticky bottom-0 -mx-4 border-t border-foreground/10 bg-background px-4 py-3">
        <button
          type="submit"
          disabled={submitting || itemsLoading || !items.length}
          className="w-full py-3 text-base"
        >
          {submitting ? 'Saving…' : 'Submit count'}
        </button>
      </div>
    </form>
  )
}