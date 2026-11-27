import { useEffect, useState } from 'react';
import { usePresence } from '../contexts/PresenceContext';

const timeZone = 'Africa/Johannesburg';
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
const clock = new Intl.DateTimeFormat('en-ZA', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dateLabel = new Intl.DateTimeFormat('en-ZA', { timeZone, day: 'numeric', month: 'short', year: 'numeric' });

function lastSeenLabel(value: string | null, now: number) {
  if (!value) return 'Last seen unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last seen unavailable';
  const day = dayKey.format(date);
  const time = clock.format(date);
  if (day === dayKey.format(now)) return `Last seen today at ${time}`;
  if (day === dayKey.format(now - 24 * 60 * 60 * 1000)) return `Last seen yesterday at ${time}`;
  return `Last seen ${dateLabel.format(date)} at ${time}`;
}

export default function PresenceStatus({ userId }: { userId?: string }) {
  const presence = usePresence(userId);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  if (!presence) return null;
  const minutes = presence.lastSeenAt ? Math.max(0, Math.floor((now - new Date(presence.lastSeenAt).getTime()) / 60_000)) : null;
  const online = presence.online && minutes !== null && minutes < 2;
  return <span className={`inline-flex items-center gap-1.5 text-xs ${online ? 'text-emerald-300' : 'text-gray-400'}`}><span aria-hidden="true" className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-gray-500'}`} />{online ? 'Online' : lastSeenLabel(presence.lastSeenAt, now)}</span>;
}
