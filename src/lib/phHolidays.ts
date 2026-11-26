/**
 * Holiday types shared by the Nager.Date feed and user-added holidays.
 * There is no bundled or curated holiday data: the API is the only built-in
 * source, and anything else comes from the user's own "Your holidays" list.
 */

export type HolidayKind = 'regular' | 'special' | 'islamic' | 'local'
export type HolidaySource = 'live' | 'custom' | 'ignored'

export interface PhHoliday {
  date: string
  name: string
  kind: HolidayKind
  estimated?: boolean
  /** Database id for user-added rows. */
  id?: string
  source?: HolidaySource
  /** Locality label for a user-added holiday. */
  locality?: string
}

export const HOLIDAY_DATA_NOTE =
  'National holidays are loaded live from Nager.Date. Only holidays from your OJT start date onward are shown, including your own entries.'
export const HOLIDAY_ATTRIBUTION = 'Holiday data: Nager.Date'
export const HOLIDAY_ATTRIBUTION_URL = 'https://date.nager.at'
