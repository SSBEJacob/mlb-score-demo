import { useEffect, useState } from 'react';

function formatTimeZone(isoString, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  }).format(new Date(isoString));
}

function formatStartTimes(isoString) {
  return `${formatTimeZone(isoString, 'America/New_York')} ET / ${formatTimeZone(isoString, 'America/Los_Angeles')} PT`;
}

function shouldShowStartTime(status) {
  if (!status) return false;
  return /scheduled|pre-game|preview|pre|FUT/i.test(status);
}

function GameCard({ game }) {
  return (
    <article className="game-card">
      <div className="card-body">
        <div className="score-row">
          <div className="team-label">Away</div>
          <div>{game.teams.away.name}</div>
          <div className="score-value">{game.teams.away.score}</div>
        </div>
        <div className="score-row">
          <div className="team-label">Home</div>
          <div>{game.teams.home.name}</div>
          <div className="score-value">{game.teams.home.score}</div>
        </div>
      </div>
      <footer className="game-footer">
        {shouldShowStartTime(game.status) ? (
          <span className="start-time">Start: {formatStartTimes(game.startTime)}</span>
        ) : (
          <span className="status">{game.status}</span>
        )}
      </footer>
    </article>
  );
}

export default function App() {
  const [scores, setScores] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [nhlScores, setNhlScores] = useState(null);
  const [nhlError, setNhlError] = useState(null);
  const [nhlLoading, setNhlLoading] = useState(true);
  const [mlbCollapsed, setMlbCollapsed] = useState(false);
  const [nhlCollapsed, setNhlCollapsed] = useState(false);
  const [nbaScores, setNbaScores] = useState(null);
  const [nbaError, setNbaError] = useState(null);
  const [nbaLoading, setNbaLoading] = useState(true);
  const [nbaCollapsed, setNbaCollapsed] = useState(false);

  async function loadScores() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/scores');
      if (!response.ok) {
        throw new Error('Failed to fetch scores');
      }
      const data = await response.json();
      setScores(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadNhlScores() {
    try {
      setNhlLoading(true);
      setNhlError(null);
      const res = await fetch('/api/nhl-scores');
      if (!res.ok) throw new Error('Failed to fetch NHL scores');
      const data = await res.json();
      setNhlScores(data);
    } catch (err) {
      setNhlError(err.message);
    } finally {
      setNhlLoading(false);
    }
  }

  async function loadNbaScores() {
    try {
      setNbaLoading(true);
      setNbaError(null);
      const res = await fetch('/api/nba-scores');
      if (!res.ok) throw new Error('Failed to fetch NBA scores');
      const data = await res.json();
      setNbaScores(data);
    } catch (err) {
      setNbaError(err.message);
    } finally {
      setNbaLoading(false);
    }
  }

  useEffect(() => {
    loadScores();
    loadNhlScores();
    loadNbaScores();
    const interval = setInterval(loadScores, 60000);
    const interval2 = setInterval(loadNhlScores, 60000);
    const interval3 = setInterval(loadNbaScores, 60000);
    return () => {
      clearInterval(interval);
      clearInterval(interval2);
      clearInterval(interval3);
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">MLB Live Scoreboard</p>
        </div>
        <button
          className="collapse-toggle"
          aria-expanded={!mlbCollapsed}
          aria-label={mlbCollapsed ? 'Expand MLB scores' : 'Collapse MLB scores'}
          onClick={() => setMlbCollapsed((s) => !s)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      <main>
        {!mlbCollapsed && (
          <>
            {loading && <div className="message">Loading scores…</div>}
            {error && <div className="message message-error">{error}</div>}
            {!loading && !error && scores && scores.games.length === 0 && (
              <div className="message">No MLB games scheduled for today.</div>
            )}

            <div className="games-grid">
              {scores?.games.map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </>
        )}

        <section className="nhl-section" style={{ marginTop: '2rem' }}>
          <header className="hero">
            <div>
              <p className="eyebrow">NHL Live Scoreboard</p>
            </div>
            <button
              className="collapse-toggle"
              aria-expanded={!nhlCollapsed}
              aria-label={nhlCollapsed ? 'Expand NHL scores' : 'Collapse NHL scores'}
              onClick={() => setNhlCollapsed((s) => !s)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </header>

          {!nhlCollapsed && (
            <>
              {nhlLoading && <div className="message">Loading NHL scores…</div>}
              {nhlError && <div className="message message-error">{nhlError}</div>}
              {!nhlLoading && !nhlError && nhlScores && nhlScores.games.length === 0 && (
                <div className="message">No NHL games scheduled for today.</div>
              )}

              <div className="games-grid">
                {nhlScores?.games.map((game) => (
                  <GameCard key={`nhl-${game.id}`} game={game} />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="nba-section" style={{ marginTop: '2rem' }}>
          <header className="hero">
            <div>
              <p className="eyebrow">NBA Live Scoreboard</p>
            </div>
            <button
              className="collapse-toggle"
              aria-expanded={!nbaCollapsed}
              aria-label={nbaCollapsed ? 'Expand NBA scores' : 'Collapse NBA scores'}
              onClick={() => setNbaCollapsed((s) => !s)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </header>

          {!nbaCollapsed && (
            <>
              {nbaLoading && <div className="message">Loading NBA scores…</div>}
              {nbaError && <div className="message message-error">{nbaError}</div>}
              {!nbaLoading && !nbaError && nbaScores && nbaScores.games.length === 0 && (
                <div className="message">No NBA games scheduled for today.</div>
              )}

              <div className="games-grid">
                {nbaScores?.games.map((game) => (
                  <GameCard key={`nba-${game.id}`} game={game} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
