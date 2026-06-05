import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 4000;
const CACHE_TTL = 20 * 1000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

let cache = {
  timestamp: 0,
  payload: null,
};

async function fetchScores() {
  const now = Date.now();

  if (cache.payload && now - cache.timestamp < CACHE_TTL) {
    return cache.payload;
  }

  const today = new Date();
  const dateString = today.toISOString().slice(0, 10);
  const endpoint = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateString}&hydrate=team,linescore,venue`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`MLB API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const games = (json.dates?.[0]?.games ?? []).map((game) => ({
    id: game.gamePk,
    status: game.status?.detailedState ?? 'Unknown',
    venue: game.venue?.name ?? 'Unknown venue',
    startTime: game.gameDate,
    teams: {
      away: {
        name: game.teams.away.team.name,
        abbreviation: game.teams.away.team.abbreviation,
        score: game.teams.away.score,
      },
      home: {
        name: game.teams.home.team.name,
        abbreviation: game.teams.home.team.abbreviation,
        score: game.teams.home.score,
      },
    },
    linescore: game.linescore ?? null,
  }));

  cache = {
    timestamp: now,
    payload: {
      date: dateString,
      lastUpdated: new Date().toISOString(),
      games,
    },
  };

  return cache.payload;
}

app.get('/api/scores', async (req, res) => {
  try {
    const payload = await fetchScores();
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: error.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
