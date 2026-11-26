import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { bookingListing } from '../utils/bookings';
import { formatInboxTime } from '../utils/inbox';
import { listingReviews } from '../utils/reviews';

export default function ListingReviews() {
  const { listingId = '' } = useParams();
  const listing = useQuery(bookingListing(listingId));
  const reviews = useInfiniteQuery(listingReviews(listingId));
  const summary = reviews.data?.pages[0];

  return (
    <main className="min-h-screen bg-gray-900 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/services" className="text-sm text-orange-300 hover:underline">← Browse services</Link>
        <p className="workspace-eyebrow">THE DETAILS / CLIENT REVIEWS</p><h1 className="mb-4 mt-2 text-3xl font-bold">Service reviews</h1>
        {listing.data && <p className="mb-3 break-words text-gray-300">{listing.data.title} · {listing.data.providerName}</p>}
        {(listing.isPending || reviews.isPending) && <p role="status" className="text-gray-300">Loading reviews…</p>}
        {(listing.isError || reviews.isError) && <p role="alert" className="text-red-300">{listing.error?.message ?? reviews.error?.message}</p>}
        {summary && (
          <p className="mb-5 text-gray-300">{summary.reviewCount
            ? `${summary.averageRating?.toFixed(1)} out of 5 · ${summary.reviewCount} ${summary.reviewCount === 1 ? 'review' : 'reviews'}`
            : 'No reviews yet.'}</p>
        )}
        <div className="space-y-3">
          {reviews.data?.pages.flatMap(page => page.items).map(review => (
            <article key={review.id} className="rounded-xl border border-gray-700 bg-gray-800 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-orange-200">{review.rating} out of 5</p>
                <p className="text-xs text-gray-400">{formatInboxTime(review.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm text-gray-300">Client review</p>
              {review.comment && <p className="mt-3 whitespace-pre-wrap break-words text-gray-200">{review.comment}</p>}
            </article>
          ))}
        </div>
        {reviews.hasNextPage && <button type="button" disabled={reviews.isFetching} className="btn-secondary mt-5"
          onClick={() => reviews.fetchNextPage()}>Load older reviews</button>}
      </div>
    </main>
  );
}
