import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send } from 'lucide-react';
import { addWorkspaceNote, workspaceKey, workspaceNotes } from '../utils/workspaces';

export default function BookingNotes({ workspaceId, bookingId, canAdd }: { workspaceId: string; bookingId: string; canAdd: boolean }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const notes = useQuery({ ...workspaceNotes(workspaceId, bookingId), enabled: open });
  const add = useMutation({
    mutationFn: () => addWorkspaceNote(workspaceId, bookingId, body),
    onSuccess: () => { setBody(''); setError(''); queryClient.invalidateQueries({ queryKey: workspaceNotes(workspaceId, bookingId).queryKey }); },
    onError: (err: Error) => setError(err.message),
  });
  return <details className="workspace-notes" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><MessageSquare size={14} /> Internal notes</summary>
    {notes.isPending && <p className="workspace-notes__empty">Loading notes…</p>}
    {notes.isError && <p className="workspace-error" role="alert">{notes.error.message}</p>}
    {notes.data && !notes.data.length && <p className="workspace-notes__empty">No internal notes yet. Clients cannot see this section.</p>}
    <div className="workspace-notes__list">{notes.data?.map(note => <article key={note.id}><strong>{note.author.name || note.author.email}</strong><small>{new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(note.createdAt))}</small><p>{note.body}</p></article>)}</div>
    {canAdd && <form onSubmit={(event: FormEvent) => { event.preventDefault(); if (body.trim()) add.mutate(); }} className="workspace-notes__form"><textarea maxLength={2000} value={body} onChange={event => setBody(event.target.value)} placeholder="Add a note only the team can see…" /><button className="workspace-secondary" disabled={add.isPending || !body.trim()}>{add.isPending ? 'Adding…' : 'Add note'} <Send size={14} /></button></form>}
    {error && <p className="workspace-error" role="alert">{error}</p>}
  </details>;
}
