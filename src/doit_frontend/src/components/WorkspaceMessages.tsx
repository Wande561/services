import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, MessageSquare, Send, Trash2, Users } from 'lucide-react';
import type { WorkspaceSummary } from '../types';
import {
  createWorkspaceAnnouncement, deleteWorkspaceAnnouncement, sendWorkspaceMessage,
  workspaceAnnouncements, workspaceKey, workspaceMessages,
} from '../utils/workspaces';

function time(value: string) {
  return new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(value));
}

export default function WorkspaceMessages({ workspaceId, summary, canPost, canManageAnnouncements, memberId }: {
  workspaceId: string; summary: WorkspaceSummary; canPost: boolean; canManageAnnouncements: boolean; memberId: string;
}) {
  const [channel, setChannel] = useState<'team' | 'direct' | 'announcements'>('team');
  const [directId, setDirectId] = useState('');
  const active = summary.team.filter(member => member.status === 'Active' && member.id !== memberId);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState({ title: '', body: '' });
  const queryClient = useQueryClient();
  const messages = useQuery({ ...workspaceMessages(workspaceId, channel === 'direct' ? directId : undefined), enabled: channel !== 'announcements' && (channel === 'team' || Boolean(directId)) });
  const announcements = useQuery({ ...workspaceAnnouncements(workspaceId), enabled: channel === 'announcements' });
  const send = useMutation({
    mutationFn: () => sendWorkspaceMessage(workspaceId, { body, ...(channel === 'direct' && directId ? { toMemberId: directId } : {}) }),
    onSuccess: () => { setBody(''); setError(''); queryClient.invalidateQueries({ queryKey: [...workspaceKey, workspaceId] }); },
    onError: (err: Error) => setError(err.message),
  });
  const announce = useMutation({
    mutationFn: () => createWorkspaceAnnouncement(workspaceId, announcement),
    onSuccess: () => { setAnnouncement({ title: '', body: '' }); setError(''); queryClient.invalidateQueries({ queryKey: workspaceAnnouncements(workspaceId).queryKey }); },
    onError: (err: Error) => setError(err.message),
  });
  const removeAnnouncement = useMutation({
    mutationFn: (id: string) => deleteWorkspaceAnnouncement(workspaceId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceAnnouncements(workspaceId).queryKey }),
    onError: (err: Error) => setError(err.message),
  });

  return <section className="workspace-card workspace-comms">
    <div className="workspace-card__head"><div><p className="workspace-kicker">TEAM COMMUNICATION</p><h2>Workspace inbox</h2><p>Team discussion, direct messages and announcements.</p></div></div>
    <div className="workspace-comms__tabs">
      <button type="button" className={channel === 'team' ? 'is-active' : ''} onClick={() => { setChannel('team'); setError(''); }}><Users size={14} /> Team discussion</button>
      <button type="button" className={channel === 'direct' ? 'is-active' : ''} onClick={() => { setChannel('direct'); setError(''); }}><MessageSquare size={14} /> Direct messages</button>
      <button type="button" className={channel === 'announcements' ? 'is-active' : ''} onClick={() => { setChannel('announcements'); setError(''); }}><Megaphone size={14} /> Announcements</button>
    </div>
    {channel !== 'announcements' && <>
      {channel === 'direct' && <label className="workspace-comms__select">Message a team member<select value={directId} onChange={event => setDirectId(event.target.value)}><option value="">Choose someone</option>{active.map(member => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select></label>}
      {channel === 'direct' && !directId && <p className="workspace-empty">Choose a team member to start a private conversation.</p>}
      {(channel === 'team' || directId) && <>
        {messages.isPending && <p className="workspace-empty">Loading messages…</p>}
        {messages.isError && <p className="workspace-error" role="alert">{messages.error.message}</p>}
        <div className="workspace-chat">{messages.data && !messages.data.length && <p className="workspace-empty">No messages yet. Start the conversation.</p>}{messages.data?.map(message => <article key={message.id} className={`workspace-chat__message ${message.author.id === summary.access.userId ? 'is-mine' : ''}`}><div><strong>{message.author.name || message.author.email}</strong><small>{time(message.createdAt)}</small></div><p>{message.body}</p></article>)}</div>
        {canPost && <form className="workspace-chat__form" onSubmit={(event: FormEvent) => { event.preventDefault(); if (body.trim()) send.mutate(); }}><textarea maxLength={2000} value={body} onChange={event => setBody(event.target.value)} placeholder={channel === 'direct' ? 'Write a private message…' : 'Write to the team…'} /><button className="workspace-primary" disabled={send.isPending || !body.trim()}>{send.isPending ? 'Sending…' : 'Send'} <Send size={15} /></button></form>}
      </>}
    </>}
    {channel === 'announcements' && <>
      {canManageAnnouncements && <form className="workspace-announcement-form" onSubmit={(event: FormEvent) => { event.preventDefault(); announce.mutate(); }}><label>Title<input required maxLength={160} value={announcement.title} onChange={event => setAnnouncement({ ...announcement, title: event.target.value })} placeholder="e.g. New equipment procedure" /></label><label>Announcement<textarea required maxLength={4000} value={announcement.body} onChange={event => setAnnouncement({ ...announcement, body: event.target.value })} /></label><button className="workspace-primary" disabled={announce.isPending}>{announce.isPending ? 'Posting…' : 'Post announcement'} <Megaphone size={15} /></button></form>}
      {announcements.isPending && <p className="workspace-empty">Loading announcements…</p>}
      {announcements.isError && <p className="workspace-error" role="alert">{announcements.error.message}</p>}
      {announcements.data && !announcements.data.length && <p className="workspace-empty">No announcements yet.</p>}
      <div className="workspace-announcements">{announcements.data?.map(item => <article key={item.id}><div><strong>{item.title}</strong><small>{item.author.name || item.author.email} · {time(item.createdAt)}</small></div><p>{item.body}</p>{canManageAnnouncements && <button type="button" onClick={() => removeAnnouncement.mutate(item.id)} aria-label={`Delete ${item.title}`}><Trash2 size={13} /></button>}</article>)}</div>
    </>}
    {error && <p className="workspace-error" role="alert">{error}</p>}
  </section>;
}
