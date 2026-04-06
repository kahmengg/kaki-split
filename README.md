# FairSplit

FairSplit is a mobile-first group expense sharing app for trips, events, and day-to-day shared spending.

Built with React + Vite and Supabase Auth.

## Features

- Google sign-in
- Group creation and invite links
- Add expenses and split across members
- Record settlements/payments
- Group activity timeline
- Clear all group activity (with `CLEAR` safety confirmation)
- Delete specific activity items (expense/payment/event)
- Insights and trip summary screens
- Profile management (including PayNow number)
- Dark mode toggle

## Tech Stack

- **Frontend:** React, React Router, Tailwind CSS
- **Backend/API:** Vercel-style API routes in `/api`
- **Auth + Data:** Supabase
- **Charts:** Recharts

## Project Structure

```text
src/
  components/      UI components
  hooks/           Auth + theme hooks
  lib/             Client API wrappers and utilities
  pages/           Route screens
api/               Server endpoints
```

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create `.env` in the project root:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3) Run development server

```bash
npm run dev
```

### 4) Build for production

```bash
npm run build
```

## Available Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — production build
- `npm run preview` — preview production build locally

## Security Notes

- Do **not** commit `.env` to Git.
- If secrets were exposed, rotate them immediately in Supabase.
- Keep `.env.example` for safe onboarding and never store real keys in docs.

## Recommended `.gitignore` Entries

```gitignore
.env
.env.local
.env.*.local
```

## Roadmap Ideas

- Real PayNow/PayLah deep integration
- Better activity filters/search
- Multi-currency analytics breakdown
- Receipts and attachments

## License

No license specified yet.
