# Kaki Split

Kaki Split is a mobile-first group expense app for trips, hangouts, and shared spending.

It helps groups:
- track expenses
- split fairly (equal, exact, percentage, and shared-item add-ons)
- settle up quickly
- view spending insights
- send automated Telegram reminders

## Tech Stack

- **Frontend:** React 19, Vite, React Router, Tailwind CSS
- **Backend/API:** Vercel serverless routes (`/api/*`)
- **Database/Auth:** Supabase
- **Charts:** Recharts
- **AI Receipt Parsing:** Google Gemini API

## Features

### Core expense flow
- Google sign-in and authenticated app routes
- Create/join groups via invite links
- Add expenses with flexible split types:
  - Equal
  - Exact amounts
  - Percentage
- **Shared-item add-on UX** in exact split mode
  - Add optional shared items (e.g. fries)
  - Select who shared each item
  - Auto-allocates item cost to selected members
- Record payments/settlements
- Activity timeline with delete/clear actions

### Insights and summary
- Group insights dashboard
- Spend-by-person reflects **actual split shares** (not just payer totals)
- Trip summary screens

### Payments
- Pay screen with PayNow/PayLah helper flow
- Supports QR/deep-link flows with amount + recipient prefill support where app/bank allows

### Automation and integrations
- Telegram reminder jobs via cron endpoint
- Receipt scanning from image using Gemini
- FX quote endpoint with DB cache and provider fallback

## Project Structure

```text
src/
  components/      UI components
  hooks/           auth/theme/feature hooks
  lib/             API client + utilities
  pages/           route screens
api/               serverless API routes
supabase-schema.sql
vercel.json
```

## Routes (Frontend)

- `/login`
- `/dashboard`
- `/groups/:id`
- `/groups/:id/pay`
- `/groups/:id/insights`
- `/groups/:id/summary`
- `/activity`
- `/profile`
- `/join/:inviteCode`

## API Endpoints (Key)

- `POST /api/scan-receipt` — parse receipt image with Gemini
- `GET /api/fx/quote?from=USD&to=SGD&date=YYYY-MM-DD` — FX rate
- `POST /api/fx/prewarm` — refresh cached FX rates (cron/auth protected)
- `GET|POST /api/telegram/jobs?action=daily|reminders|dispatch` — telegram job runner
- `GET /api/telegram/daily` — rewrite to telegram daily action (cron target)

## Environment Variables

Create a `.env` file for local development.

### Client-side (Vite)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AUTH_REDIRECT_BASE_URL`

### App/runtime
- `APP_URL`
- `GEMINI_API_KEY`

### Server-side (Vercel / API routes)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `CRON_SECRET`

> Do not commit real secrets. Use placeholders in docs and rotate keys if leaked.

## Local Development

1. Install dependencies

```bash
npm install
```

2. Start development server

```bash
npm run dev
```

3. Build production bundle

```bash
npm run build
```

4. Preview production build locally

```bash
npm run preview
```

## Deployment (Vercel)

- SPA rewrites and API rewrites are configured in `vercel.json`.
- Telegram cron is configured in `vercel.json` and currently scheduled at:
  - `0 9 */2 * *` (09:00 UTC, every 2nd day of month)
- Ensure all required server env vars are set in Vercel project settings.

## Notes on Cron and Telegram

- `/api/telegram/daily` is protected by `CRON_SECRET` bearer auth when configured.
- Manual check example:

```bash
curl -s -X GET "https://<your-domain>/api/telegram/daily" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Expected response shape:

```json
{
  "ok": true,
  "action": "daily",
  "queued": { "scanned": 0, "queued": 0 },
  "dispatched": { "processed": 0, "sent": 0, "failed": 0 }
}
```

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run preview` — preview built app

## License

No license specified yet.