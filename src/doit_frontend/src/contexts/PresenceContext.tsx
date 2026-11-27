import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AppContext';
import { apiRequest } from '../utils/apiRequest';

type Presence = { online: boolean; lastSeenAt: string | null };
type PresenceContextValue = { register: (id: string) => () => void; statuses: Record<string, Presence> };
const PresenceContext = createContext<PresenceContextValue | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const ids = useMemo(() => Object.keys(counts).sort(), [counts]);
  const query = useQuery({
    queryKey: ['presence', currentUser?.id, ids],
    queryFn: async ({ signal }) => {
      const batches: string[][] = [];
      for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));
      return Object.assign({}, ...await Promise.all(batches.map(batch => apiRequest<Record<string, Presence>>(`/presence?${new URLSearchParams({ ids: batch.join(',') })}`, { signal }))));
    },
    enabled: !!currentUser?.profile && ids.length > 0,
    refetchInterval: 30_000, staleTime: 15_000, retry: false,
  });
  useEffect(() => {
    if (!currentUser?.profile || currentUser.profile.role === 'admin') return;
    const heartbeat = () => { if (document.visibilityState === 'visible') void apiRequest('/presence/heartbeat', { method: 'POST' }).catch(() => {}); };
    heartbeat();
    const interval = window.setInterval(heartbeat, 30_000);
    document.addEventListener('visibilitychange', heartbeat);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', heartbeat); };
  }, [currentUser?.id, !!currentUser?.profile]);
  const register = useCallback((id: string) => {
      setCounts(previous => ({ ...previous, [id]: (previous[id] ?? 0) + 1 }));
      return () => setCounts(previous => { const next = { ...previous }; if (next[id] <= 1) delete next[id]; else next[id]--; return next; });
  }, []);
  const value = useMemo<PresenceContextValue>(() => ({
    register,
    statuses: query.data ?? {},
  }), [query.data, register]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence(id?: string) {
  const context = useContext(PresenceContext);
  const register = context?.register;
  useEffect(() => { if (id && register) return register(id); }, [id, register]);
  return id ? context?.statuses[id] : undefined;
}
