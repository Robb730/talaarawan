import type { HolidayKind, PhHoliday } from './phHolidays'

/**
 * Philippine public holidays from Nager.Date's open API.
 * Free, no key, no signup — https://date.nager.at/api
 *
 * Every holiday returned for a country is used as-is: Nager already lists the
 * country's public holidays, so there is no per-office or locality filter here.
 */

const BASE_URL = 'https://date.nager.at/api/v3/PublicHolidays'
const CACHE_PREFIX = 'talaarawan:holidays:nager:v1:'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface NagerHoliday {
  date?: string
  name?: string
  localName?: string
  countryCode?: string
  global?: boolean
  counties?: string[] | null
  types?: string[]
}

interface CachedYear {
  fetchedAt: number
  holidays: PhHoliday[]
}

const memoryCache = new Map<number, CachedYear>()

const ISLAMIC_HINTS = ['eid', 'fitr', 'adha']
const SPECIAL_HINTS = [
  'eve',
  'saturday',
  'chinese new year',
  'all souls',
  'immaculate',
  'ninoy',
  'special',
  'last day',
]

function kindFrom(name: string, localName: string): HolidayKind {
  const text = `${name} ${localName}`.toLowerCase()
  if (ISLAMIC_HINTS.some((hint) => text.includes(hint))) return 'islamic'
  if (SPECIAL_HINTS.some((hint) => text.includes(hint))) return 'special'
  return 'regular'
}

function readCache(year: number): CachedYear | null {
  const inMemory = memoryCache.get(year)
  if (inMemory && Date.now() - inMemory.fetchedAt < CACHE_TTL_MS) return inMemory
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${year}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedYear
    if (!Array.isArray(parsed.holidays) || typeof parsed.fetchedAt !== 'number') return null
    if (Date.now() - parsed.fetchedAt >= CACHE_TTL_MS) return null
    memoryCache.set(year, parsed)
    return parsed
  } catch {
    return null
  }
}

function writeCache(year: number, holidays: PhHoliday[]) {
  const entry = { fetchedAt: Date.now(), holidays }
  memoryCache.set(year, entry)
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${year}`, JSON.stringify(entry))
  } catch {
    // Storage can be disabled; the in-memory cache still works for this session.
  }
}

function normalize(payload: unknown): PhHoliday[] {
  if (!Array.isArray(payload)) throw new Error('Unexpected holiday data.')
  const rows = payload as NagerHoliday[]
  return rows
    .filter((row) => row && typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .filter((row) => !row.types || row.types.length === 0 || row.types.includes('Public'))
    .map((row) => {
      const name = (row.name || row.localName || 'Holiday').trim()
      return {
        date: row.date as string,
        name,
        kind: kindFrom(name, row.localName ?? ''),
        source: 'live' as const,
      }
    })
}

/** Fetch one year of Philippine public holidays, using a 7-day cache. Never throws. */
export async function fetchHolidaysForYear(year: number, force = false): Promise<PhHoliday[]> {
  if (!force) {
    const cached = readCache(year)
    if (cached) return cached.holidays
  }

  try {
    const response = await fetch(`${BASE_URL}/${year}/PH`, { cache: 'force-cache' })
    if (!response.ok) throw new Error(`Holiday API returned ${response.status}.`)
    const holidays = normalize(await response.json())
    if (holidays.length === 0) throw new Error('Holiday API returned no holidays.')
    writeCache(year, holidays)
    return holidays
  } catch {
    return readCache(year)?.holidays ?? []
  }
}

/** Fetch several years, returning only successful results. */
export async function fetchHolidaysForYears(years: number[], force = false): Promise<PhHoliday[]> {
  const results = await Promise.all(years.map((year) => fetchHolidaysForYear(year, force)))
  return results.flat()
}
