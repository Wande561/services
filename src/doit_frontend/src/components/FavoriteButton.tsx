import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AppContext';
import { apiRequest } from '../utils/apiRequest';
import { clientDiscovery, discoveryKey } from '../utils/discovery';

export default function FavoriteButton({ kind, id }: { kind: 'listings' | 'providers'; id: string }) {
  const { currentUser } = useAuth(); const isClient = currentUser?.profile?.role === 'client'; const cache = useQueryClient();
  const discovery = useQuery(clientDiscovery(currentUser?.id ?? '', isClient));
  const saved = kind === 'listings' ? discovery.data?.favorites.some(item => item.id === id) : discovery.data?.favoriteProviders.some(item => item.id === id);
  const update = useMutation({ mutationFn: () => apiRequest(`/client/discovery/${kind}/${encodeURIComponent(id)}`, { method: saved ? 'DELETE' : 'PUT' }), onSuccess: () => cache.invalidateQueries({ queryKey: discoveryKey }) });
  if (!isClient) return null;
  return <div><button type="button" aria-pressed={!!saved} disabled={discovery.isPending || discovery.isError || update.isPending} onClick={() => update.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-home-line px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-home-canvas disabled:opacity-50"><Heart aria-hidden="true" className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save to favourites'}</button>{(update.isError || discovery.isError) && <p role="alert" className="mt-1 text-xs text-red-300">{update.isError ? 'Could not update your favourites.' : 'Favourites are unavailable.'}</p>}</div>;
}
