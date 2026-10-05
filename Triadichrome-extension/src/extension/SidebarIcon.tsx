import type { ReactNode } from "react";

type SidebarIconName = "home" | "previous" | "entry" | "list" | "cost" | "expansion" | "details" | "master" | "file" | "close-file";

// Each silhouette expresses the destination, even when the labels are collapsed.
const shapes: Record<SidebarIconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7M5 9v12h14V9" /><path d="M9 21v-8h6v8" /></>,
  previous: <><path d="M6 8a8 8 0 1 1-1 9M6 3v5H1" /><path d="M12 7v6l4 2" /></>,
  entry: <><path d="M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5M7 16h4" /><path d="m15 4 3-3 5 5-3 3-8 8-5 1 1-5 9-9Zm0 0 5 5" /></>,
  list: <><rect x="3" y="4" width="4" height="4" rx="1" /><rect x="3" y="10" width="4" height="4" rx="1" /><rect x="3" y="16" width="4" height="4" rx="1" /><path d="M11 6h10M11 12h10M11 18h10" /></>,
  cost: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h2M14 11h2M8 15h2M14 15h2M8 18h2M14 18h2" /></>,
  expansion: <><rect x="3" y="3" width="7" height="5" rx="1" /><path d="M6.5 8v10H14M6.5 12H14" /><rect x="14" y="9.5" width="7" height="5" rx="1" /><rect x="14" y="15.5" width="7" height="5" rx="1" /></>,
  details: <><path d="M14 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9l-6-6Zm0 0v6h6M8 13h8M8 17h8" /></>,
  master: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  file: <><path d="M3 8V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Z" /><path d="M3 10h18" /></>,
  "close-file": <><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" /></>,
};

export function SidebarIcon({ name }: { name: SidebarIconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {shapes[name]}
  </svg>;
}
