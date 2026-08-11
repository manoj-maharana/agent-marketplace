// The backend stores timestamps as UTC but SQLite drops timezone info on
// round-trip, so the API returns bare ISO strings like "2026-08-11T20:50:49"
// with no offset. `new Date()` treats those as local time, not UTC - append
// "Z" when there's no existing timezone designator so it parses correctly.
function toUtcIso(iso: string): string {
  return /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
}

export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(toUtcIso(iso)).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
