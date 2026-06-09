import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const PORT = process.env.PORT || 4000;
const CACHE_TTL = 60 * 1000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

let cache = {
  timestamp: 0,
  payload: null,
};
let nhlCache = { timestamp: 0, payload: null };
let nbaCache = { timestamp: 0, payload: null };

// Map NHL abbreviations to full team display names (location + nickname)
const NHL_FULL_NAMES = {
  ANA: 'Anaheim Ducks',
  ARI: 'Arizona Coyotes',
  BOS: 'Boston Bruins',
  BUF: 'Buffalo Sabres',
  CAR: 'Carolina Hurricanes',
  CBJ: 'Columbus Blue Jackets',
  CGY: 'Calgary Flames',
  CHI: 'Chicago Blackhawks',
  COL: 'Colorado Avalanche',
  DAL: 'Dallas Stars',
  DET: 'Detroit Red Wings',
  EDM: 'Edmonton Oilers',
  FLA: 'Florida Panthers',
  LAK: 'Los Angeles Kings',
  MIN: 'Minnesota Wild',
  MTL: 'Montreal Canadiens',
  NJD: 'New Jersey Devils',
  NSH: 'Nashville Predators',
  NYI: 'New York Islanders',
  NYR: 'New York Rangers',
  OTT: 'Ottawa Senators',
  PHI: 'Philadelphia Flyers',
  PIT: 'Pittsburgh Penguins',
  SJS: 'San Jose Sharks',
  SJ: 'San Jose Sharks',
  STL: 'St. Louis Blues',
  TBL: 'Tampa Bay Lightning',
  TB: 'Tampa Bay Lightning',
  TOR: 'Toronto Maple Leafs',
  VAN: 'Vancouver Canucks',
  VGK: 'Vegas Golden Knights',
  WPG: 'Winnipeg Jets',
  WSH: 'Washington Capitals',
  SEA: 'Seattle Kraken',
};

// Fetch NHL scores (prefers api-web.nhle.com). Accepts optional date (YYYY-MM-DD).
async function fetchNhlScores(dateParam) {
  const now = Date.now();
  const today = new Date();
  const dateString = (dateParam && String(dateParam)) || today.toISOString().slice(0, 10);

  if (nhlCache.payload && now - nhlCache.timestamp < CACHE_TTL && nhlCache.payload.date === dateString) {
    return nhlCache.payload;
  }

  // prefer realtime 'now' for today
  const endpoints = [];
  if (!dateParam || dateString === today.toISOString().slice(0, 10)) {
    endpoints.push(`https://api-web.nhle.com/v1/score/now`);
    endpoints.push(`https://api-web.nhle.com/v1/score/${dateString}`);
  } else {
    endpoints.push(`https://api-web.nhle.com/v1/score/${dateString}`);
  }
  // fallback to older NHL statsapi
  endpoints.push(`https://statsapi.web.nhl.com/api/v1/schedule?date=${dateString}`);

  let response = null;
  for (const ep of endpoints) {
    try {
      response = await fetch(ep);
    } catch (e) {
      response = null;
    }
    if (response && response.ok) break;
  }

  if (!response || !response.ok) {
    nhlCache = { timestamp: now, payload: { date: dateString, lastUpdated: new Date().toISOString(), games: [] } };
    return nhlCache.payload;
  }

  const json = await response.json().catch(() => ({}));

  // normalize different API shapes
  const rawGames = Array.isArray(json.games)
    ? json.games
    : Array.isArray(json.dates?.[0]?.games)
    ? json.dates[0].games
    : [];

  const games = rawGames.map((g) => {
    // api-web uses `id`, `gameState`, `startTimeUTC`, `awayTeam`, `homeTeam`
    const id = g.id ?? g.gamePk ?? g.gameId;
    const status = g.gameState ?? g.gameScheduleState ?? g.status ?? 'Unknown';
    const venue = (g.venue && (g.venue.default || g.venue.name)) || (g.venue?.name ?? '');
    const startTime = g.startTimeUTC ?? g.gameDate ?? g.gameDateLocal ?? null;

    const awayAbbrRaw = (g.awayTeam?.abbrev ?? g.teams?.away?.team?.abbreviation ?? g.awayTeam?.abbrev ?? '').toString().toUpperCase();
    const homeAbbrRaw = (g.homeTeam?.abbrev ?? g.teams?.home?.team?.abbreviation ?? g.homeTeam?.abbrev ?? '').toString().toUpperCase();
    const awayNameFallback = g.awayTeam?.name?.default ?? g.awayTeam?.name ?? g.teams?.away?.team?.name ?? '';
    const homeNameFallback = g.homeTeam?.name?.default ?? g.homeTeam?.name ?? g.teams?.home?.team?.name ?? '';
    const awayName = NHL_FULL_NAMES[awayAbbrRaw] ?? awayNameFallback;
    const homeName = NHL_FULL_NAMES[homeAbbrRaw] ?? homeNameFallback;
    const awayAbbr = awayAbbrRaw;
    const homeAbbr = homeAbbrRaw;

    const isPrematch = /scheduled|pre-game|preview|pre|FUT/i.test(status);
    const awayScoreRaw = g.awayScore ?? g.teams?.away?.score;
    const homeScoreRaw = g.homeScore ?? g.teams?.home?.score;
    const awayScore = isPrematch ? 0 : (awayScoreRaw ?? 0);
    const homeScore = isPrematch ? 0 : (homeScoreRaw ?? 0);

    return {
      id,
      status,
      venue,
      startTime,
      teams: {
        away: { name: awayName, abbreviation: awayAbbr, score: awayScore },
        home: { name: homeName, abbreviation: homeAbbr, score: homeScore },
      },
      linescore: g.linescore ?? null,
    };
  });

  nhlCache = { timestamp: now, payload: { date: dateString, lastUpdated: new Date().toISOString(), games } };
  return nhlCache.payload;
}

// Fetch NBA scores from ESPN scoreboard. Accepts optional date (YYYY-MM-DD).
async function fetchNbaScores(dateParam) {
  const now = Date.now();
  const today = new Date();
  const dateString = (dateParam && String(dateParam)) || today.toISOString().slice(0, 10);

  if (nbaCache.payload && now - nbaCache.timestamp < CACHE_TTL && nbaCache.payload.date === dateString) {
    return nbaCache.payload;
  }

  // ESPN expects dates in YYYYMMDD format if provided
  const ymd = dateString.replace(/-/g, '');
  const endpoint = dateParam ? `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd}` : `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`;

  let response = null;
  try {
    response = await fetch(endpoint);
  } catch (e) {
    response = null;
  }

  if (!response || !response.ok) {
    nbaCache = { timestamp: now, payload: { date: dateString, lastUpdated: new Date().toISOString(), games: [] } };
    return nbaCache.payload;
  }

  const json = await response.json().catch(() => ({}));

  const rawEvents = Array.isArray(json.events) ? json.events : [];

  const games = rawEvents.map((ev) => {
    const id = ev.id ?? ev.uid ?? null;
    const competition = ev.competitions?.[0] ?? {};
    const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];

    // Robustly determine home/away competitor. ESPN uses `homeAway: 'home'|'away'` or boolean `home`.
    let homeComp = null;
    let awayComp = null;

    if (competitors.length > 0) {
      homeComp = competitors.find((c) => {
        if (!c) return false;
        if (typeof c.homeAway === 'string') return c.homeAway.toLowerCase() === 'home';
        if (typeof c.home === 'boolean') return c.home === true;
        if (typeof c.isHome === 'boolean') return c.isHome === true;
        return false;
      });

      awayComp = competitors.find((c) => {
        if (!c) return false;
        if (typeof c.homeAway === 'string') return c.homeAway.toLowerCase() === 'away';
        if (typeof c.home === 'boolean') return c.home === false;
        if (typeof c.isHome === 'boolean') return c.isHome === false;
        return false;
      });

      // Fallbacks: if still missing, prefer ordered interpretation (ESPN usually lists away then home)
      if ((!homeComp || !awayComp) && competitors.length === 2) {
        awayComp = awayComp || competitors[0];
        homeComp = homeComp || competitors[1];
      }

      // Final fallback to first/second or empty object
      awayComp = awayComp || competitors[0] || {};
      homeComp = homeComp || competitors[1] || competitors[0] || {};
    } else {
      awayComp = {};
      homeComp = {};
    }

    const statusObj = ev.status ?? ev.status?.type ?? {};
    const statusTypeName = statusObj?.type?.name ?? statusObj?.type ?? ev.status?.type?.name ?? ev.status?.type ?? ev.status?.type?.state ?? ev.status?.type?.shortDetail ?? ev.status?.type ?? 'Unknown';
    const statusState = ev.status?.type?.state ?? (ev.status?.type?.name ?? '').toLowerCase();
    const status = ev.status?.type?.shortDetail ?? ev.status?.type?.detail ?? ev.status?.type?.description ?? ev.status?.type?.state ?? ev.status?.type?.name ?? ev.status?.type ?? 'Unknown';

    const isPrematch = (typeof statusState === 'string' && /pre|pregame|pre-game|scheduled/.test(statusState)) || /scheduled|pre-game|preview|pre/i.test(status);

    const awayScoreRaw = Number(awayComp?.score ?? 0);
    const homeScoreRaw = Number(homeComp?.score ?? 0);
    const awayScore = isPrematch ? 0 : (Number.isFinite(awayScoreRaw) ? awayScoreRaw : 0);
    const homeScore = isPrematch ? 0 : (Number.isFinite(homeScoreRaw) ? homeScoreRaw : 0);

    const awayName = awayComp?.team?.displayName ?? awayComp?.team?.name ?? awayComp?.team?.shortDisplayName ?? '';
    const homeName = homeComp?.team?.displayName ?? homeComp?.team?.name ?? homeComp?.team?.shortDisplayName ?? '';
    const awayAbbr = awayComp?.team?.abbreviation ?? awayComp?.team?.shortName ?? '';
    const homeAbbr = homeComp?.team?.abbreviation ?? homeComp?.team?.shortName ?? '';

    const startTime = competition?.date ?? ev?.date ?? null;
    const venue = competition?.venue?.fullName ?? competition?.venue?.displayName ?? '';

    return {
      id,
      status,
      venue,
      startTime,
      teams: {
        away: { name: awayName, abbreviation: awayAbbr, score: awayScore },
        home: { name: homeName, abbreviation: homeAbbr, score: homeScore },
      },
      linescore: competition?.boxScore ?? null,
    };
  });

  nbaCache = { timestamp: now, payload: { date: dateString, lastUpdated: new Date().toISOString(), games } };
  return nbaCache.payload;
}

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
  const games = (json.dates?.[0]?.games ?? []).map((game) => {
    const status = game.status?.detailedState ?? game.status?.abstractGameState ?? 'Unknown';
    const isPrematch = /scheduled|pre-game|preview|pre/i.test(status);
    const awayScoreRaw = game.teams?.away?.score;
    const homeScoreRaw = game.teams?.home?.score;
    const awayScore = isPrematch ? 0 : (awayScoreRaw ?? 0);
    const homeScore = isPrematch ? 0 : (homeScoreRaw ?? 0);

    return {
      id: game.gamePk,
      status,
      venue: game.venue?.name ?? 'Unknown venue',
      startTime: game.gameDate,
      teams: {
        away: {
          name: game.teams.away.team.name,
          abbreviation: game.teams.away.team.abbreviation,
          score: awayScore,
        },
        home: {
          name: game.teams.home.team.name,
          abbreviation: game.teams.home.team.abbreviation,
          score: homeScore,
        },
      },
      linescore: game.linescore ?? null,
    };
  });

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

app.get('/api/nhl-scores', async (req, res) => {
  try {
    const { date } = req.query;
    const payload = await fetchNhlScores(date);
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: error.message });
  }
});

app.get('/api/nba-scores', async (req, res) => {
  try {
    const { date } = req.query;
    const payload = await fetchNbaScores(date);
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
