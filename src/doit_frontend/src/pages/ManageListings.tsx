import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import ServiceListingCard from '../components/ServiceListingCard';
import { useAuth } from '../contexts/AppContext';
import { ServiceCategoryEnum, type AccountProfile, type PriceUnit, type ServiceListing, type ServiceListingInput } from '../types';
import { catalogKey, priceUnits, providerListings, saveListing, setListingPublication } from '../utils/serviceListings';
import { categoryLabel } from '../utils/serviceUtils';
import { parseRandCents } from '../utils/money';

const inputClass = 'mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 p-3 text-white';

interface ListingFormProps {
  listing?: ServiceListing;
  profile: AccountProfile;
  busy: boolean;
  error?: string;
  onSave: (input: ServiceListingInput) => void;
  onCancel: () => void;
}

function ListingForm({ listing, profile, busy, error, onSave, onCancel }: ListingFormProps) {
  const [validationError, setValidationError] = useState('');
  const [keepPhotoIds, setKeepPhotoIds] = useState(() => listing?.photos.map(photo => photo.id) ?? []);
  const [photos, setPhotos] = useState<File[]>([]);
  const [reading, setReading] = useState(false);

  function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    // Clear the picker so choosing the same file again still fires a change event.
    event.target.value = '';
    if (!selected.length) return;
    if (selected.some(file => !file.size || file.size > 1048576 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setValidationError('Choose JPEG, PNG or WebP photos no larger than 1 MB each.');
      return;
    }
    const key = (file: File) => `${file.name}\0${file.size}\0${file.lastModified}`;
    const seen = new Set(photos.map(key));
    const additions = selected.filter(file => { const id = key(file); if (seen.has(id)) return false; seen.add(id); return true; });
    if (keepPhotoIds.length + photos.length + additions.length > 20) {
      setValidationError('A listing can have up to 20 photos in total. Remove some photos or select fewer files.');
      return;
    }
    setValidationError('');
    setPhotos(previous => [...previous, ...additions]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const text = (name: string) => String(fields.get(name) ?? '').trim();
    const priceCents = parseRandCents(text('price'));
    const maxPriceCents = text('maxPrice') ? parseRandCents(text('maxPrice')) : null;
    if (!Number.isSafeInteger(priceCents) || (maxPriceCents !== null && !Number.isSafeInteger(maxPriceCents))) {
      setValidationError('Enter prices in rand with up to two decimal places.');
      return;
    }
    if (maxPriceCents !== null && maxPriceCents < priceCents) {
      setValidationError('Maximum price must be at least the starting price.');
      return;
    }
    if (keepPhotoIds.length + photos.length > 20 || photos.some(file => !file.size || file.size > 1048576 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setValidationError('Choose up to 20 JPEG, PNG or WebP photos, each no larger than 1 MB.');
      return;
    }
    setValidationError('');
    setReading(true);
    let newPhotos: string[];
    try { newPhotos = await Promise.all(photos.map(file => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read a photo.')); reader.readAsDataURL(file); }))); }
    catch { setValidationError('Could not read a photo. Please try again.'); setReading(false); return; }
    setReading(false);
    onSave({
      keepPhotoIds, newPhotos,
      title: text('title'),
      category: text('category') as ServiceCategoryEnum,
      location: text('location'),
      priceCents,
      maxPriceCents,
      priceUnit: text('priceUnit') as PriceUnit,
    });
  }

  return (
    <form onSubmit={submit} className="mb-8 rounded-xl border border-gray-700 bg-gray-800 p-5 sm:p-6">
      <h2 className="mb-4 text-xl font-semibold">{listing ? 'Edit listing' : 'New listing'}</h2>
      <fieldset disabled={busy || reading} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Title
          <input name="title" className={inputClass} required maxLength={120} defaultValue={listing?.title} autoFocus />
        </label>
        <label className="text-sm font-medium">
          Category
          <select name="category" className={inputClass} required defaultValue={listing?.category ?? profile.serviceCategories[0] ?? ''}>
            <option value="">Choose a category</option>
            {Object.values(ServiceCategoryEnum).map(category => (
              <option key={category} value={category}>{categoryLabel(category)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Service area
          <input name="location" className={inputClass} required maxLength={150} defaultValue={listing?.location ?? profile.location} />
        </label>
        <label className="text-sm font-medium">
          Price unit
          <select name="priceUnit" className={inputClass} defaultValue={listing?.priceUnit ?? 'PerProject'}>
            {Object.entries(priceUnits).map(([unit, label]) => <option key={unit} value={unit}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Starting price (R)
          <input name="price" inputMode="decimal" className={inputClass} required maxLength={16}
            defaultValue={listing ? (listing.priceCents / 100).toFixed(2) : ''} />
        </label>
        <label className="text-sm font-medium">
          Maximum price (R, optional)
          <input name="maxPrice" inputMode="decimal" className={inputClass} maxLength={16}
            defaultValue={listing?.maxPriceCents != null ? (listing.maxPriceCents / 100).toFixed(2) : ''} />
        </label>
        <div className="sm:col-span-2">
          <p className="text-sm font-medium">Listing photos (optional)</p>
          <p id="listing-photo-help" className="mt-1 text-sm text-gray-300">Select up to 20 JPEG, PNG or WebP images at once, 1 MB each. Hold Ctrl (or Command on Mac) to select multiple files. You can also add files in several selections before saving.</p>
          <p className="mt-1 text-sm text-emerald-300" aria-live="polite">{keepPhotoIds.length + photos.length} of 20 photos selected</p>
          {keepPhotoIds.length > 0 && <div className="mt-3 flex flex-wrap gap-3">{keepPhotoIds.map(id => <div key={id} className="w-28"><img src={`/api/services/photos/${encodeURIComponent(id)}`} alt="Current listing photo" className="h-20 w-28 rounded-lg object-cover" /><button type="button" className="mt-1 text-sm text-emerald-300 underline" onClick={() => setKeepPhotoIds(ids => ids.filter(item => item !== id))}>Remove</button></div>)}</div>}
          <input aria-label="Add listing photos" aria-describedby="listing-photo-help" className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addPhotos} />
          {photos.length > 0 && <ul className="mt-3 space-y-2" aria-label="New photos to upload">{photos.map((photo, index) => <li key={`${photo.name}-${photo.size}-${photo.lastModified}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-900 px-3 py-2 text-sm"><span className="min-w-0 break-all">{photo.name}</span><button type="button" className="shrink-0 text-emerald-300 underline" aria-label={`Remove ${photo.name}`} onClick={() => setPhotos(previous => previous.filter((_, i) => i !== index))}>Remove</button></li>)}</ul>}
          {photos.length > 0 && <p className="mt-2 text-sm text-gray-300">These photos will upload together when you save the listing.</p>}
        </div>
        {(validationError || error) && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{validationError || error}</p>}
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" className="btn-primary disabled:opacity-50">
            {busy ? 'Saving…' : listing ? 'Save changes' : 'Save draft'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </fieldset>
    </form>
  );
}

export default function ManageListings() {
  const { currentUser } = useAuth();
  const provider = providerListings(currentUser?.id ?? '');
  const query = useQuery(provider);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<'new' | ServiceListing | null>(null);
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  async function refreshListings() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: provider.queryKey }),
      queryClient.invalidateQueries({ queryKey: catalogKey }),
    ]);
  }

  const save = useMutation({
    mutationFn: ({ input, id }: { input: ServiceListingInput; id?: string }) => saveListing(input, id),
    onSuccess: async (_, { id }) => {
      await refreshListings();
      setEditing(null);
      setNotice(id ? 'Listing updated.' : 'Draft saved. Select Publish below to make it visible to clients.');
    },
  });
  const publish = useMutation({
    mutationFn: (listing: ServiceListing) => setListingPublication(listing.id, !listing.isPublished),
    onSuccess: async listing => {
      await refreshListings();
      setNotice(listing.isPublished ? 'Listing published. Clients can now find it under Services.' : 'Listing unpublished. Clients can no longer see it.');
    },
  });
  const busy = save.isPending || publish.isPending;

  function openForm(listing: 'new' | ServiceListing) {
    save.reset();
    publish.reset();
    setNotice('');
    setEditing(listing);
  }

  return (
    <main className="polished-page listings-manage-page min-h-screen bg-gray-900 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/provider-dashboard" className="text-sm text-orange-300 hover:underline">← Provider dashboard</Link>
            <p className="workspace-eyebrow">YOUR BUSINESS / SERVICES</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Your listings</h1>
            <p className="mt-2 text-sm text-gray-300">Create a listing, then publish it to appear in the service catalog.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/services" className="btn-secondary">View catalog</Link>
            <button type="button" onClick={() => openForm('new')} disabled={busy || editing !== null}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <Plus aria-hidden="true" className="h-4 w-4" /> New listing
            </button>
          </div>
        </div>
        {editing && currentUser?.profile && (
          <ListingForm
            key={editing === 'new' ? 'new' : editing.id}
            listing={editing === 'new' ? undefined : editing}
            profile={currentUser.profile}
            busy={save.isPending}
            error={save.error?.message}
            onSave={input => save.mutate({ input, id: editing === 'new' ? undefined : editing.id })}
            onCancel={() => setEditing(null)}
          />
        )}
        {notice && <p role="status" className="mb-4 text-green-300">{notice}</p>}
        {publish.isError && <p role="alert" className="mb-4 text-red-300">{publish.error.message}</p>}
        {query.isPending && <p role="status" className="text-gray-300">Loading your listings…</p>}
        {query.isError && (
          <div role="alert" className="rounded-lg border border-red-800 p-4 text-red-300">
            <p>{query.error.message}</p>
            <button type="button" onClick={() => query.refetch()} className="mt-2 underline">Try again</button>
          </div>
        )}
        {query.data?.length === 0 && !editing && (
          <p className="rounded-xl border border-gray-700 bg-gray-800 p-6 text-gray-300">You have no listings yet. Select New listing, save your service details, then select Publish so clients can find you.</p>
        )}
        {query.data && query.data.length > 0 && <div className="listing-filters" role="group" aria-label="Filter listings">{([['all', 'All', query.data.length], ['published', 'Published', query.data.filter(item => item.isPublished).length], ['draft', 'Drafts', query.data.filter(item => !item.isPublished).length]] as const).map(([value, label, count]) => <button type="button" key={value} className={filter === value ? 'is-active' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} <span>{count}</span></button>)}</div>}
        {query.data && query.data.length > 0 && !query.data.some(listing => filter === 'all' || listing.isPublished === (filter === 'published')) && <p className="polished-empty">No {filter} listings yet.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {query.data?.filter(listing => filter === 'all' || listing.isPublished === (filter === 'published')).map(listing => (
            <ServiceListingCard key={listing.id} listing={listing}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 pt-3">
                <span className={listing.isPublished ? 'text-sm text-green-300' : 'text-sm text-gray-300'}>
                  {listing.isPublished ? 'Published · visible to clients' : 'Draft · not visible to clients'}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary disabled:opacity-50" disabled={busy || editing !== null}
                    onClick={() => openForm(listing)}>Edit</button>
                  <button type="button" className="btn-primary disabled:opacity-50" disabled={busy || editing !== null}
                    onClick={() => { setNotice(''); publish.mutate(listing); }}>
                    {listing.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              </div>
            </ServiceListingCard>
          ))}
        </div>
      </div>
    </main>
  );
}
