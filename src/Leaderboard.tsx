import { useEffect, useState } from 'react';
import { useSupabase } from './useSupabase';

type Mode = 'regular' | 'hard';
type Entry = { rank: number; username: string; score: number };
type Board = { mode: Mode; entries: Entry[] | null };

export function Leaderboard({ signedIn }: { signedIn: boolean }) {
  const supabase = useSupabase();
  const [mode, setMode] = useState<Mode>('regular');
  const [board, setBoard] = useState<Board | null>(null);
  const [visible, setVisible] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void supabase.rpc('get_verified_leaderboard', { p_mode: mode }).then(({ data, error }) => {
      if (active) setBoard({ mode, entries: error ? null : data as Entry[] });
    });
    return () => { active = false; };
  }, [mode, refresh, supabase]);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void supabase.rpc('leaderboard_visibility', {}).then(({ data, error }) => {
      if (!active) return;
      if (error) setVisibilityError('Couldn’t load your leaderboard setting.');
      else setVisible(data === true);
    });
    return () => { active = false; };
  }, [signedIn, supabase]);

  async function changeVisibility(publish: boolean) {
    setSaving(true);
    setVisibilityError('');
    const { data, error } = await supabase.rpc('leaderboard_visibility', { p_visible: publish });
    setSaving(false);
    if (error) {
      setVisibilityError('Couldn’t save your setting. Try again.');
      return;
    }
    setVisible(data === true);
    setBoard(null);
    setRefresh(previous => previous + 1);
  }

  const current = board?.mode === mode ? board : null;

  return <section className="leaderboard" aria-label="Leaderboard">
    <h2>Leaderboard</h2>
    <p>Top 20 verified scores per mode. Scores are public only for players who opt in.</p>
    <div className="leaderboard-modes" role="group" aria-label="Leaderboard mode">
      <button type="button" aria-pressed={mode === 'regular'} onClick={() => setMode('regular')}>Regular</button>
      <button type="button" aria-pressed={mode === 'hard'} onClick={() => setMode('hard')}>Hard</button>
    </div>
    {!current ? <p role="status">Loading scores…</p> : current.entries === null ?
      <p role="status">Scores are unavailable. <button type="button" onClick={() => {
        setBoard(null);
        setRefresh(previous => previous + 1);
      }}>Retry</button></p> : current.entries.length === 0 ?
        <p role="status">No public scores in this mode yet.</p> :
        <table>
          <caption className="leaderboard-caption">{mode === 'regular' ? 'Regular' : 'Hard'} rankings</caption>
          <thead><tr><th scope="col">Rank</th><th scope="col">Trainer</th><th scope="col">Score</th></tr></thead>
          <tbody>{current.entries.map(entry => <tr key={entry.username}>
            <td>{entry.rank}</td><th scope="row">{entry.username}</th><td>{entry.score.toLocaleString()}</td>
          </tr>)}</tbody>
        </table>}
    {signedIn && <div className="leaderboard-visibility">
      <p>Share your PokéPixel username and best verified score in each mode, including past games. A synced username and a positive score are needed to appear.</p>
      {visible !== null && <button type="button" disabled={saving} onClick={() => void changeVisibility(!visible)}>
        {saving ? 'Saving…' : visible ? 'Hide my scores' : 'Publish my best scores'}
      </button>}
      {visibilityError && <p role="status">{visibilityError}</p>}
    </div>}
  </section>;
}
