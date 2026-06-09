# Scoreboard Demo (MLB, NHL, NBA)

A small React + Express app that aggregates live scores for MLB, NHL, and NBA and displays them in a compact scoreboard UI.

Key behaviors:

- Frontend: Vite + React UI with collapsible sections for each sport (collapse buttons on the right edge of section headers).
- Backend: Express API aggregator that normalizes external APIs and caches responses (default cache TTL: 60s).
- Polling: Frontend polls the backend every 60 seconds to reduce external API traffic.

## Getting started (development)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the backend server (in one terminal):
   ```bash
   # optional: enable verbose NHL fetch logs
   DEBUG_NHL_FETCH=1 node server.js
   ```

3. Start the frontend dev server (in another terminal):
   ```bash
   npm run dev
   ```

4. Open the frontend at `http://localhost:5173`. The frontend calls the backend at `http://localhost:4000` by default.

## Backend endpoints

- `GET /api/scores` — MLB games for today (normalized from `https://statsapi.mlb.com`).
- `GET /api/nhl-scores[?date=YYYY-MM-DD]` — NHL games (prefers `https://api-web.nhle.com`, falls back to `https://statsapi.web.nhl.com`).
- `GET /api/nba-scores[?date=YYYY-MM-DD]` — NBA games (uses ESPN scoreboard: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`).

Notes:

- The server listens on `PORT` (default `4000`). CORS is enabled for local dev.
- The backend caches responses for `CACHE_TTL` (default 60s) to reduce external API calls.
- Frontend polling interval is set to 60 seconds in `src/App.jsx`.

## Production

Build and start the production server:

```bash
npm run build
npm start
```

## Configuration & tips

- `PORT` — backend port (default `4000`).
- `DEBUG_NHL_FETCH` — set to `1` to enable debug logs for NHL fetch attempts.
- Avoid storing secrets in `localStorage`; only UI preferences (collapse state) belong there.
- External API availability depends on providers; if a provider is down the corresponding section will show no games.

If you'd like the collapse state persisted across reloads, I can add `localStorage` persistence to the UI.
