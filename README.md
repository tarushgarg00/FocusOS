# FocusOS

FocusOS is a goal execution and focus accountability app.

It combines a web app and a browser extension so users can:
- plan goals with deadlines and weekly pace targets,
- run focused sessions with distraction blocking,
- reflect after each session,
- track patterns and weekly progress,
- see risk trajectory (Stable / Fragile / At Risk) and actionable recommendations.

## Core Features

- Goal planning with estimated hours, weekly targets, deadlines, and allowed sites
- Session timer with setup, focus phase, reflection, and Emergency Kill tracking
- Browser blocking extension (MV3) integrated with Focus Mode
- Daily guidance on the Today page (suggested sessions and recovery prompts)
- Patterns page with heatmap, trend chart, and 30-day insights
- Weekly Review with structured stats, recommendations, and expandable previous weeks

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (Auth + Postgres)
- Chrome/Edge/Brave extension (Manifest V3)

## Local Setup

1. Install dependencies:

```sh
npm install
```

2. Create environment file (or copy from `.env.example`):

```sh
cp .env.example .env.local
```

3. Set required values in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- extension install/id variables if using blocking integration

4. Run the app:

```sh
npm run dev
```

5. Optional checks:

```sh
npm run test
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

## Vercel Deployment

Set these Environment Variables in Vercel (Project -> Settings -> Environment Variables):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional extension variables for install flow:

- `VITE_FOCUSOS_CHROME_EXTENSION_ID`
- `VITE_FOCUSOS_EDGE_EXTENSION_ID`
- `VITE_FOCUSOS_BRAVE_EXTENSION_ID`
- `VITE_FOCUSOS_CHROME_INSTALL_URL`
- `VITE_FOCUSOS_EDGE_INSTALL_URL`
- `VITE_FOCUSOS_BRAVE_INSTALL_URL`
- `VITE_FOCUSOS_EXTENSION_ZIP_URL`

After adding/updating env vars, redeploy the latest commit.

Supabase Auth settings required for email confirmation links:

- Authentication -> URL Configuration -> Site URL: set to your production URL (for example `https://focusos-sable.vercel.app`)
- Add Redirect URLs for:
  - `https://focusos-sable.vercel.app/auth`
  - `http://localhost:8080/auth` (or your local dev port)

## Extension Setup

FocusOS supports Chrome, Edge, and Brave.

- Use in-app setup prompt or Settings -> Focus Extension.
- Choose install target (store or ZIP).
- If ZIP/manual install is used:
  - open browser extensions page,
  - enable Developer Mode,
  - load unpacked extension folder,
  - return to FocusOS and check connection.

## Repository Structure

- `src/` - web app source code
- `focusos-extension/` - browser extension source
- `public/` - static assets (includes extension ZIP fallback)
- `supabase/` - SQL scripts and seed data
