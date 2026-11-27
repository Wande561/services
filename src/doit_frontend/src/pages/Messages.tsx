import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import PresenceStatus from '../components/PresenceStatus';
import { accountHome } from '../utils/accountRoutes';
import { bookingHistoryPath, conversations, formatInboxTime, inboxKey, messagePath, messageThread, readMessages, sendMessage } from '../utils/inbox';

function ConversationPanel({ accountId, bookingId }: { accountId: string; bookingId: string }) {
  const thread = useInfiniteQuery(messageThread(accountId, bookingId));
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const messageList = useRef<HTMLDivElement>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: [...inboxKey, accountId] });
  const send = useMutation({
    mutationFn: (text: string) => sendMessage(bookingId, text),
    onSuccess: async () => {
      setDraft('');
      await refresh();
    },
  });
  const { mutate: markSeen, isError: readFailed, variables: readBatches } = useMutation({
    mutationFn: (batches: string[][]) => Promise.all(batches.map(ids => readMessages(bookingId, ids))),
    onSuccess: refresh,
    retry: 1,
  });

  useEffect(() => {
    const batches = thread.data?.pages
      .map(page => page.items.filter(message => message.kind === 'message' && !message.mine && !message.read).map(message => message.id))
      .filter(ids => ids.length > 0);
    if (batches?.length) markSeen(batches);
  }, [thread.data, markSeen]);

  const openingPage = thread.data?.pages[0];
  const newestMessage = openingPage?.items[0]?.id;
  useEffect(() => {
    if (messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight;
  }, [newestMessage]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (text && !send.isPending) send.mutate(text);
  }

  return (
    <section aria-label="Conversation" className="min-w-0 rounded-xl border border-gray-700 bg-gray-800">
      {thread.isPending && <p role="status" className="p-5 text-gray-300">Loading conversation…</p>}
      {thread.isError && (
        <p role="alert" className="p-5 text-red-300">
          {thread.error.message} <button type="button" className="underline" onClick={() => thread.refetch()}>Try again</button>
        </p>
      )}
      {openingPage && !thread.isError && (
        <>
          <header className="border-b border-gray-700 p-4">
            <h2 className="break-words text-lg font-semibold">{openingPage.contactName}</h2>
            <PresenceStatus userId={openingPage.contactId} />
            <Link to={bookingHistoryPath(bookingId)}
              className="break-words text-sm text-orange-300 hover:underline">{openingPage.serviceTitle}</Link>
          </header>
          <div ref={messageList} className="max-h-[55vh] min-h-44 space-y-3 overflow-y-auto p-4">
            {thread.hasNextPage && (
              <button type="button" disabled={thread.isFetching} className="text-sm text-orange-300 hover:underline"
                onClick={() => thread.fetchNextPage()}>Load earlier messages</button>
            )}
            {openingPage.items.length === 0 && <p className="text-sm text-gray-300">No messages yet.</p>}
            {thread.data.pages.slice().reverse().flatMap(page => page.items.slice().reverse()).map(message => message.kind !== 'message' ? (
              <div key={message.id} className="text-center text-xs text-gray-300"><span className="inline-block rounded-full bg-gray-700 px-3 py-1">{message.body} · {formatInboxTime(message.createdAt)}</span></div>
            ) : (
              <div key={message.id} className={`flex ${message.mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 ${message.mine ? 'bg-orange-900/60' : 'bg-gray-700'}`}>
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p className="mt-1 text-xs text-gray-300">
                    {formatInboxTime(message.createdAt)}{message.mine && message.read ? ' · Read' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {openingPage.closed ? <p className="border-t border-gray-700 p-4 text-sm text-gray-300">This conversation is closed. You can message again when another booking is created.</p> : <form className="space-y-3 border-t border-gray-700 p-4" onSubmit={submit}>
            <label className="block text-sm font-medium" htmlFor="message-body">Message</label>
            <textarea id="message-body" rows={3} required maxLength={2000} value={draft} disabled={send.isPending}
              onChange={event => setDraft(event.target.value)} className="w-full rounded-lg border border-gray-600 bg-gray-900 p-3" />
            {send.isError && <p role="alert" className="text-sm text-red-300">{send.error.message}</p>}
            {readFailed && <p role="alert" className="text-sm text-red-300">
              Could not mark messages as read.{' '}
              <button type="button" className="underline" onClick={() => readBatches && markSeen(readBatches)}>Try again</button>
            </p>}
            <button type="submit" disabled={send.isPending || !draft.trim()} className="btn-primary disabled:opacity-50">
              {send.isPending ? 'Sending…' : 'Send message'}
            </button>
          </form>}
        </>
      )}
    </section>
  );
}

export default function Messages() {
  const { currentUser } = useAuth();
  const accountId = currentUser?.id ?? '';
  const [params] = useSearchParams();
  const bookingId = params.get('booking');
  const threads = useQuery(conversations(accountId));

  return (
    <main className="min-h-screen bg-gray-900 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="workspace-page-header mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link to={accountHome(currentUser?.profile?.role)} className="text-sm text-orange-300 hover:underline">← Dashboard</Link>
            <p className="workspace-eyebrow">YOUR WORKSPACE / CONVERSATIONS</p><h1 className="mt-2 text-3xl font-bold">Messages</h1><p className="mt-2 text-sm text-emerald-300">View your booking conversations and message history.</p>
          </div>
          <Link to="/bookings" className="btn-secondary">View bookings</Link>
        </header>
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)]">
          <section className="rounded-xl border border-gray-700 bg-gray-800 p-3">
            <h2 className="px-2 pb-2 text-sm font-semibold text-gray-300">Conversations</h2>
            {threads.isPending && <p role="status" className="px-2 text-sm text-gray-300">Loading conversations…</p>}
            {threads.isError && <p role="alert" className="px-2 text-sm text-red-300">
              {threads.error.message} <button type="button" className="underline" onClick={() => threads.refetch()}>Try again</button>
            </p>}
            {threads.data?.length === 0 && <p className="px-2 text-sm text-gray-300">Open a booking to start a conversation.</p>}
            <ul className="space-y-1">
              {threads.data?.map(thread => (
                <li key={thread.bookingId}>
                  <Link to={messagePath(thread.bookingId)} aria-current={thread.bookingId === bookingId ? 'page' : undefined}
                    className={`block rounded-lg p-3 hover:bg-gray-700 ${thread.bookingId === bookingId ? 'bg-gray-700' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words font-medium">{thread.contactName}</span>
                      {thread.unread > 0 && <span className="shrink-0 text-xs text-orange-200">{thread.unread} unread</span>}
                    </div>
                    <p className="truncate text-sm text-gray-300">{thread.serviceTitle}</p>
                    <PresenceStatus userId={thread.contactId} />
                    <p className="mt-1 truncate text-xs text-gray-400">{thread.latest.kind === 'message' && thread.latest.mine ? 'You: ' : ''}{thread.latest.body}{thread.closed ? ' · Closed' : ''}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          {bookingId ? <ConversationPanel key={bookingId} accountId={accountId} bookingId={bookingId} /> : (
            <p className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-gray-300">Select a conversation to read or send messages.</p>
          )}
        </div>
      </div>
    </main>
  );
}
