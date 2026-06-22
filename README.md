# Kaki Split

Kaki Split is a mobile-first bill-splitting app for trips, meals, and group hangouts. It lets signed-in users create shared groups, invite friends, add expenses in multiple currencies, split bills fairly, record settlements, scan receipts, view spending insights, and send Telegram reminders for unsettled balances.

## Tech Stack

- React 19 with Vite
- React Router
- Tailwind CSS
- Supabase Auth, Postgres, Row Level Security, and Storage
- Vercel serverless API routes
- Recharts
- Google Gemini receipt parsing
- Telegram Bot API

## Main Features

- Google sign-in through Supabase Auth
- Group creation, invite links, joining by invite code, and owner-only group deletion
- Equal, exact, and percentage expense splits
- Shared-item receipt assignment flow for scanned receipts
- Multi-currency expense entry with FX conversion and cached rates
- Smart settlement balances based on expense shares and recorded payments
- Pay screen with PayNow QR payloads and manual payment recording
- Dashboard, group activity, insights, and trip summary screens
- Profile editing with avatar upload and Singapore payment details
- Telegram group linking, alert settings, daily reminders, and retrying outbox dispatch

## Project Structure

```text
api/
  _lib/                 Shared server-side Supabase and Telegram helpers
  fx/                   FX quote and prewarm endpoint
  groups/               Owner-protected group maintenance endpoints
  telegram/             Webhook, link, unlink, and job endpoints
  join-invite.js        Authenticated invite join endpoint
  scan-receipt.js       Gemini receipt parsing endpoint
src/
  components/           Shared UI components
  data/                 Local mock data
  hooks/                Auth, theme, and receipt scanner hooks
  lib/                  Client API, formatting, balances, PayNow utilities
  pages/                Route-level screens
supabase-schema.sql     Database schema, functions, triggers, indexes, and RLS policies
vercel.json             SPA rewrites, API rewrites, and cron configuration
```

## Frontend Routes

- `/login`
- `/dashboard`
- `/join/:inviteCode`
- `/groups/:id`
- `/groups/:id/pay`
- `/groups/:id/insights`
- `/groups/:id/summary`
- `/insights`
- `/activity`
- `/profile`
- `/terms`
- `/privacy`
- `/auth/verified`

## API Routes

- `POST /api/join-invite`
- `POST /api/scan-receipt`
- `GET /api/fx/quote?from=USD&to=SGD&date=YYYY-MM-DD`
- `POST /api/fx/prewarm`
- `POST /api/groups/update-name`
- `POST /api/groups/delete-activity-item`
- `POST /api/groups/clear-activity`
- `POST /api/telegram/webhook`
- `POST /api/telegram/link-token`
- `POST /api/telegram/unlink-group`
- `GET|POST /api/telegram/jobs?action=daily|reminders|dispatch`

`vercel.json` also rewrites:

- `/api/telegram/daily` to `/api/telegram/jobs?action=daily`
- `/api/telegram/reminders` to `/api/telegram/jobs?action=reminders`
- `/api/telegram/dispatch` to `/api/telegram/jobs?action=dispatch`
- `/api/fx/quote` to `/api/fx`
- `/api/fx/prewarm` to `/api/fx?action=prewarm`

## Environment Variables

Create a local `.env` file for development. Do not commit real secrets.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_AUTH_REDIRECT_BASE_URL=
VITE_APP_URL=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=
GEMINI_API_KEY=
TELEGRAM_BOT_TOKEN=
CRON_SECRET=
```

Notes:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required by the browser app.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are required by serverless routes that perform privileged Supabase operations.
- `APP_URL` is used in Telegram reminder links.
- `CRON_SECRET` protects Telegram and FX cron-style endpoints when configured.
- Client-side runtime errors are captured by the React error boundary and logged locally. Use Sentry or another hosted logger for production-scale monitoring without adding another Vercel Hobby function.

## Database Setup

Run `supabase-schema.sql` in the Supabase SQL editor for a new project. It creates the app tables, profile trigger, RLS policies, indexes, Telegram tables, FX cache table, and storage policies expected by the code.

Create a public Supabase Storage bucket named `avatars` if it does not already exist. The schema includes policies for users to manage files under their own user-id folder.

## Local Development

Install dependencies:

```bash
bun install
```

Run the web app:

```bash
bun run dev
```

## Android Development

The Android app is powered by Capacitor. The package id is:

```text
com.kahme.kakisplit
```

Build and sync the web app into Android:

```bash
bun run android:sync
```

Open the native project in Android Studio:

```bash
bun run android:open
```

Build a debug APK:

```bash
bun run android:build:debug
```

For Google OAuth in the Android app, add this URL to Supabase Auth's allowed redirect URLs:

```text
com.kahme.kakisplit://auth/callback
```

In Google Cloud Console, keep the OAuth redirect URI as the Supabase callback URL shown in Supabase Auth provider settings.

Before publishing to Google Play, create a signed Android App Bundle from Android Studio:

```text
Build > Generate Signed App Bundle / APK > Android App Bundle
```

Do not commit release keystores or passwords.

```bash
bun install
```

Start the dev server:

```bash
bun run dev
```

Build for production:

```bash
bun run build
```

Preview the production build:

```bash
bun run preview
```

The `package.json` scripts also work with npm when npm is available:

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Deployment

This project is configured for Vercel:

- Vite builds the client into `dist/`.
- Files under `api/` run as Vercel serverless functions.
- SPA fallback rewrites all non-API routes to `index.html`.
- The Telegram daily job is scheduled at `0 9 */2 * *` UTC in `vercel.json`.

Set all production environment variables in Vercel before deploying.

## Telegram Setup

1. Create a Telegram bot and set `TELEGRAM_BOT_TOKEN`.
2. Deploy the app.
3. Configure the Telegram webhook to point at `/api/telegram/webhook`.
4. In a Kaki Split group, generate a link code from the Telegram sheet.
5. Add the bot to the Telegram group and send `/link <code>`.

The dispatcher processes pending `telegram_outbox` rows for expense alerts, payment alerts, and daily reminders. Disabled notification types are marked sent without delivery so the queue does not stall.

Linked Telegram groups can manage notification settings directly in chat:

```text
/alerts status
/alerts on
/alerts off
/alerts expense on
/alerts payment off
/alerts reminders on
/alerts time 09:30
/alerts every 2 days
/notifications off
```

`/alerts time` accepts 24-hour times such as `09:30` or `2130`, and 12-hour times such as `9pm`. `/alerts every` accepts `daily` or `1` to `30` days. The reminder timezone defaults to `Asia/Singapore`; it can be changed with `/alerts timezone <IANA timezone>`.

## Receipt Scanning

`POST /api/scan-receipt` accepts `imageBase64` and `mimeType` for JPEG, PNG, or WebP images. It uses Gemini to return normalized merchant, total, currency, date, item, tax, service charge, and discount fields.

## Verification

The current production build passes with:

```bash
bun run build
```

Vite reports one bundle-size warning because the main client chunk is larger than 500 kB. This is not a build failure; route-level code splitting would reduce it later.

## License

No license file is included.
