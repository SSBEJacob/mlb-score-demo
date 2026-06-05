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
  return /scheduled|pre-game|preview|pre/i.test(status);
}

function GameCard({ game }) {
  return (
    <article className="game-card">
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

  useEffect(() => {
    loadScores();
    const interval = setInterval(loadScores, 20000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">MLB Live Scoreboard</p>
          <h1>Today&apos;s games</h1>
        </div>
      </header>

      <main>
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
      </main>
    </div>
  );
}
