# TalaArawan

TalaArawan is a private on-the-job-training journal built with **React + Vite + TypeScript**, **Tailwind CSS v4**, and **Supabase** (Auth + Postgres with row-level security).

Students can create an account, set their required hours and a flexible weekly schedule, log **one editable entry per day**, and see an estimated OJT last day that already accounts for Philippine national holidays. Reports can be printed or downloaded as a PDF.

## Features

- Email/password sign up and sign in (Supabase Auth) with email confirmation via Brevo SMTP and a Brevo-delivered password-reset link, plus a glass split-screen auth page
- Private journal entries — row-level security means only the owner can read or change them
- One entry per day (unique constraint on `user_id + entry_date`), editable any time — only from your OJT start date through today, never in the future
- **First-login walkthrough** — a skip-able spotlight tour runs before setup and visits the dashboard, journal, reports, and settings, highlighting the main actions on each page
- **One-screen setup** — after the tour, a single modal asks for your required hours and start date, with a ready-to-use Monday–Friday schedule (8–5 with lunch) you can adjust in place
- **Frosted-glass interface** with warm paper textures, ambient color blobs, translucent panels, and a **collapsible desktop sidebar** (state saved in `localStorage`)
- Dynamic weekly schedule: different time in/out per day, on/off toggle per day
- Fully dynamic breaks: label, start/end time **or** fixed minutes, and a per-break "exclude from rendered hours" toggle
- Automatic rendered-hours calculation with optional manual-hour override, exact times (e.g. 8:33 AM), and a toggle to reuse your saved daily time in/out
- **Custom calendar, time, and select pickers** in entry, schedule, filter, report, and settings forms — the entry date picker greys out weekends and unavailable dates and marks your first day, holidays, and past workdays you never logged
- **Full journal calendar page** with large day tiles showing your first day, estimated last day, logged days, unlogged workdays, and holidays
- **Holiday overrides** — disable any API holiday your office doesn't observe from the calendar or Settings so it counts as a normal work day in the estimate
- **Estimated OJT last day** that skips non-working days, logged days, and national or your own holidays from your start date onward
- **Final-day hours** are always shown, including partial last days (for example, 3 hours left on an 8-hour day)
- **Missing-workday review** — past scheduled days without a log are treated as days off, but surfaced on the dashboard and journal so you can add a forgotten entry in one click
- Dashboard: hours rendered, remaining, progress, logging streak, weekly summary, upcoming holidays, completion estimate, and a today-entry prompt that switches between **Add new entry** and **Edit your log today**
- Journal search, filters (status, date range, favorites), tags, reflection prompts, and month-grouped entries
- Reports: date range presets, on-screen table, **Download PDF** (jsPDF), and a dedicated **Print** layout with signature lines and the completion estimate
- Settings for profile, schedule, password reset, and sign out
- Local draft autosave while filling out an entry
- Responsive layout: collapsible sidebar on desktop, compact top bar and bottom navigation on mobile
- Installable on phones: web app manifest and branded icons give an "Add to Home Screen" standalone app experience on iOS and Android
- Toast notifications and a custom confirmation dialog instead of browser alerts

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the tables, RLS policies, triggers, and indexes.
3. In **Authentication → Providers**, make sure **Email** is enabled. If email confirmation is enabled, new users must confirm before signing in.
4. Copy your **Project URL** and **anon public key** from **Project Settings → API**.

### 3. Environment

Copy `.env.example` to `.env.local` and fill in the values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Then start the app:

```bash
npm run dev
```

The app shows a banner until the environment variables are set.

### Email delivery

Email confirmation is sent by Supabase through **Brevo SMTP** using a custom, responsive HTML template in [`supabase/templates/confirm-signup.html`](supabase/templates/confirm-signup.html) (branded header, one-click verify button, fallback link, and a "what happens next" section). Password-reset and test emails go through Brevo via a Supabase Edge Function, so the API key stays server-side. See [`supabase/EMAIL_SETUP.md`](supabase/EMAIL_SETUP.md) for SMTP setup, secrets, deployment, and redirect-URL instructions.

### Holidays

National holidays are fetched in the browser from [Nager.Date](https://date.nager.at) (free, no API key — attribution is shown in the app) and cached for 7 days. All Philippine public holidays returned by Nager are used; there is no filtering by office location. There is no bundled holiday list — if the API is unavailable, national holidays stay unavailable until it recovers.

Holidays are only shown from your OJT start date onward, everywhere in the app. Add any non-working dates your company observes from **Settings → Holidays** — they are stored per user in `user_holidays`, must also fall on or after the start date, and affect the completion estimate, dashboard, and reports.

If an API holiday doesn't apply to your location, disable it from **Settings → Holidays** or from that day's tile on the **Journal → Calendar** page. Disabled holidays are stored per user in `ignored_holidays`, stop appearing as holidays, and count as ordinary scheduled work days in the estimate. You can restore them at any time.

The location picker records your company's OJT location purely as saved profile data for printed reports — it does not affect which holidays are shown. It loads the full Philippine city/municipality list from the [PSGC dataset](https://psgc.gitlab.io/api) once (cached for 30 days) and filters it in the browser as you type, so you can type `pasig` and pick `City of Pasig` with no per-keystroke requests. You can also type your own value.

For an existing database, run [`supabase/migrations/20261125_holidays.sql`](supabase/migrations/20261125_holidays.sql) once (if you have not already), then [`supabase/migrations/20261126_remove_curated_holidays.sql`](supabase/migrations/20261126_remove_curated_holidays.sql) to drop the old hardcoded local holiday table, and [`supabase/migrations/20261126_ignored_holidays.sql`](supabase/migrations/20261126_ignored_holidays.sql) to add the holiday-override table. Fresh installs get everything from `supabase/schema.sql`.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run oxlint |
| `npm run preview` | Preview the production build |

## How hours are calculated

1. If **manual hours** is enabled, that value is used.
2. Otherwise: `time_out − time_in − excluded break minutes`.
3. `absent` and `leave` entries count as 0 hours.
4. Breaks with "exclude from rendered hours" off are counted as working time.

## How the completion estimate works

The estimate starts from the later of **tomorrow** and your **OJT start date**, then walks forward one day at a time:

1. Days with no scheduled hours are skipped.
2. Dates that already have a journal entry are skipped.
3. Philippine national holidays are skipped and listed in the estimate card — unless you disabled one, in which case it counts as a normal work day.
4. A scheduled working day with no entry is treated as a day off, so the estimate simply moves past it. Today is treated the same way until it is logged.
5. Each remaining working day adds that weekday's expected hours (breaks deducted).
6. The final day can be partial — for example, 4 remaining hours on an 8-hour day. The exact **hours needed on the last day** are shown in the estimate card, dashboard, and report.

Because unlogged days count as days off, the app also finds missed scheduled workdays and lists them on the dashboard and journal. If you actually worked and forgot to log, add the entry from that list and the estimate recalculates.

The result is an **estimated last day**, not a guarantee. It changes whenever you log an entry, edit your schedule, update your required hours, or disable a holiday. There is no target end date input — the estimate simply projects your finish date.

### Philippine holiday coverage

National holidays come from Nager.Date's public API (`https://date.nager.at/api/v3/PublicHolidays/{year}/PH`) for the current year plus the next four. Shared holiday types and attribution live in [`src/lib/phHolidays.ts`](src/lib/phHolidays.ts).

Only holidays on or after your OJT start date are used anywhere — estimates, dashboard, entry calendar, reports, and Settings. Dates added in Settings are also limited to that range.

**Limitations:** Nager's Philippine list may omit some proclaimed dates (for example Eid dates in certain years), and it has no city/provincial holidays. Add any missing non-working days yourself in Settings.

## Notes / possible next steps

- Add Google/GitHub OAuth in Supabase Auth.
- Add Supabase Storage for attached proof documents or screenshots.
- Add email or browser reminders for unlogged days.
- Add a supervisor-read-only share link via a separate RLS policy.
- Add overtime tracking and per-entry approval status.
- Add province-level holiday data on top of city/municipal holidays.
