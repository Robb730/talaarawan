import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, LoaderCircle, MapPin } from 'lucide-react'
import { filterLocalities, loadLocalities } from '../lib/localityApi'
import type { Locality } from '../lib/localityApi'

interface Props {
  id?: string
  value: string
  code?: string | null
  onChange: (value: string, code: string | null) => void
  placeholder?: string
}

/** Searchable Philippine city/municipality picker with a free-text fallback. */
export function LocalityPicker({
  id,
  value,
  code,
  onChange,
  placeholder = 'Search city or municipality',
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [places, setPlaces] = useState<Locality[] | null>(null)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // The PSGC city list is loaded once, then filtered entirely in the browser.
  useEffect(() => {
    let active = true
    void loadLocalities().then((list) => {
      if (active) setPlaces(list)
    })
    return () => {
      active = false
    }
  }, [])

  const results = useMemo(() => (places ? filterLocalities(places, query) : []), [places, query])

  useEffect(() => {
    if (!open) return
    const update = () => {
      const rect = inputRef.current?.getBoundingClientRect()
      if (rect) setPosition({ left: rect.left, top: rect.bottom + 6, width: rect.width })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || inputRef.current?.contains(target)) return
      const typed = query.trim()
      if (typed && typed !== value) onChange(typed, typed === value && code ? code : null)
      setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, query, value, code, onChange])

  const choose = (name: string, nextCode: string | null) => {
    onChange(name, nextCode)
    setQuery(name)
    setOpen(false)
  }

  const showTyped = query.trim().length >= 2 && query.trim() !== value

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setQuery(value)
            setOpen(true)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          className="h-11 w-full rounded-lg border border-white/75 bg-white/65 px-3.5 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-forest-400 focus:bg-white/90 focus:ring-2 focus:ring-forest-200/60"
        />
      </div>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="thin-scroll fixed z-[90] max-h-72 overflow-y-auto rounded-2xl border border-white/75 bg-white/90 p-2 shadow-[0_32px_90px_-30px_rgba(22,21,16,0.45)] backdrop-blur-2xl"
            style={{ left: position.left, top: position.top, width: Math.max(position.width, 260) }}
          >
            {showTyped && (
              <button
                type="button"
                onClick={() => choose(query.trim(), null)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-paper-100/80"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                Use &ldquo;{query.trim()}&rdquo; as typed
              </button>
            )}

            {places === null && query.trim().length >= 2 && (
              <p className="flex items-center gap-2 px-3 py-2 text-xs text-ink-400">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Loading places…
              </p>
            )}

            {places && query.trim().length >= 2 && results.length === 0 && (
              <p className="px-3 py-2 text-xs text-ink-400">
                No matches in the PSGC list. You can still type your own.
              </p>
            )}

            {results.map((place) => {
              const selected = place.code && place.code === code && place.name === value
              return (
                <button
                  key={place.code}
                  type="button"
                  onClick={() => choose(place.name, place.code)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selected ? 'bg-forest-50/90 text-forest-800' : 'text-ink-700 hover:bg-paper-100/80'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{place.name}</span>
                    {place.province && (
                      <span className="mt-0.5 block truncate text-[11px] text-ink-400">
                        {place.province}
                      </span>
                    )}
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-forest-600" />}
                </button>
              )
            })}

            {query.trim().length < 2 && (
              <p className="px-3 py-2 text-xs text-ink-400">Type at least 2 letters to search.</p>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
