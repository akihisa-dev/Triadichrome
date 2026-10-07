import { useState } from "react";
/** Screen visits have their own lifetime, independent of saved data and input drafts. */
export function useScreenHistory<T>(initial: T, same: (left: T, right: T) => boolean) {
  const [history, setHistory] = useState({ entries: [initial], index: 0 });
  const current = history.entries[history.index]!;
  const navigate = (next: T) => setHistory(previous => {
    if (same(previous.entries[previous.index]!, next)) return previous;
    const entries = [...previous.entries.slice(0, previous.index + 1), next];
    return { entries, index: entries.length - 1 };
  });
  const travel = (direction: -1 | 1) => setHistory(previous => ({ ...previous,
    index: Math.max(0, Math.min(previous.entries.length - 1, previous.index + direction)),
  }));
  const prune = (valid: (entry: T) => boolean, fallback: T) => setHistory(previous => {
    const kept = previous.entries.map((entry, index) => ({ entry, index })).filter(item => valid(item.entry));
    if (kept.length === previous.entries.length) return previous;
    if (!kept.length) return { entries: [fallback], index: 0 };
    // Keep valid visits on both sides; select the closest surviving prior visit.
    const before = kept.filter(item => item.index <= previous.index).length;
    return { entries: kept.map(item => item.entry), index: Math.max(0, before - 1) };
  });
  const reset = (next: T) => setHistory({ entries: [next], index: 0 });
  const destination = (direction: -1 | 1) => history.entries[Math.max(0, Math.min(history.entries.length - 1, history.index + direction))]!;
  return { current, navigate, travel, reset, prune, destination, canBack: history.index > 0, canForward: history.index < history.entries.length - 1 };
}
