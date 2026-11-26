/**
 * Philippine city/municipality lookup backed by the PSGC (Philippine Standard
 * Geographic Code) dataset published by the Philippine Statistics Authority.
 * This wrapper is not affiliated with PSA. https://psgc.gitlab.io/api
 *
 * The full city list (~1,600 entries) is fetched once and cached for 30 days.
 * Typing filters that in-memory list, so there are no per-keystroke API calls
 * and no usage limits. The selection is only saved with the profile — it is
 * not used to filter holidays.
 */

const BASE_URL = 'https://psgc.gitlab.io/api'
const CACHE_KEY = 'talaarawan:psgc:localities:v2'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface Locality {
  code: string
  name: string
  province: string | null
  region: string | null
  label: string
  /** Former official name, used only for matching. */
  aliases?: string
}

interface PsgcRow {
  code?: string
  name?: string
  oldName?: string | null
  provinceCode?: string | false | null
  regionCode?: string | null
}

/** Compact cache row: code, name, province, region, aliases. */
type CachedCity = [string, string, string, string, string]

interface Cache {
  fetchedAt: number
  cities: CachedCity[]
}

let cached: Locality[] | null = null
let pending: Promise<Locality[]> | null = null

function isFresh(fetchedAt: number): boolean {
  return Boolean(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS
}

function fromCache(cities: CachedCity[]): Locality[] {
  return cities.map(([code, name, province, region, aliases]) => ({
    code,
    name,
    province: province || null,
    region: region || null,
    label: [name, province || region].filter(Boolean).join(', '),
    aliases: aliases || undefined,
  }))
}

function readCache(): Locality[] | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Cache
    if (!isFresh(parsed.fetchedAt) || !Array.isArray(parsed.cities)) return null
    return fromCache(parsed.cities)
  } catch {
    return null
  }
}

function writeCache(fetchedAt: number, cities: CachedCity[]) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt, cities }))
  } catch {
    // Storage may be unavailable — the in-memory list still works this session.
  }
}

function nameMap(rows: PsgcRow[]): Map<string, string> {
  return new Map(
    rows
      .filter((row) => typeof row.code === 'string' && typeof row.name === 'string')
      .map((row) => [row.code as string, row.name as string]),
  )
}

/** Load the PSGC city/municipality list once; safe to call from several components. */
export function loadLocalities(): Promise<Locality[]> {
  if (cached) return Promise.resolve(cached)
  if (pending) return pending

  pending = (async () => {
    const stored = readCache()
    if (stored) {
      cached = stored
      return cached
    }

    try {
      const [cityRes, provinceRes, regionRes] = await Promise.all([
        fetch(`${BASE_URL}/cities-municipalities/`, { cache: 'force-cache' }),
        fetch(`${BASE_URL}/provinces/`, { cache: 'force-cache' }),
        fetch(`${BASE_URL}/regions/`, { cache: 'force-cache' }),
      ])
      if (!cityRes.ok || !provinceRes.ok || !regionRes.ok) {
        throw new Error('Could not load PSGC reference data.')
      }
      const cities = (await cityRes.json()) as PsgcRow[]
      const provinces = nameMap((await provinceRes.json()) as PsgcRow[])
      const regions = nameMap((await regionRes.json()) as PsgcRow[])

      const rows: CachedCity[] = cities
        .filter((row) => typeof row.code === 'string' && typeof row.name === 'string')
        .map((row) => [
          row.code as string,
          (row.name as string).trim(),
          typeof row.provinceCode === 'string' ? provinces.get(row.provinceCode) ?? '' : '',
          typeof row.regionCode === 'string' ? regions.get(row.regionCode) ?? '' : '',
          typeof row.oldName === 'string' ? row.oldName : '',
        ])

      cached = fromCache(rows)
      writeCache(Date.now(), rows)
      return cached
    } catch {
      return []
    } finally {
      pending = null
    }
  })()

  return pending
}

/** Filter the already-loaded city list as the user types. */
export function filterLocalities(all: Locality[], query: string, limit = 15): Locality[] {
  const term = normalizeLocality(query)
  if (term.length < 2) return []

  const scored = all
    .map((place) => {
      const name = normalizeLocality(place.name)
      const aliases = normalizeLocality(place.aliases ?? '')
      const label = normalizeLocality(place.label)
      let score = -1
      if (name === term || aliases === term) score = 0
      else if (name.startsWith(term) || aliases.startsWith(term)) score = 1
      else if (name.includes(term) || label.includes(term) || aliases.includes(term)) score = 2
      return { place, score }
    })
    .filter((item) => item.score >= 0)

  scored.sort((a, b) => a.score - b.score || a.place.name.localeCompare(b.place.name))
  return scored.slice(0, limit).map((item) => item.place)
}

export function normalizeLocality(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
