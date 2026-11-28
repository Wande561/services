import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { readAllWorkspaceNotifications, readWorkspaceNotification, workspaceKey, workspaceNotifications } from '../utils/workspaces';

export default function WorkspaceNotifications({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery(workspaceNotifications(workspaceId));
  const read = useMutation({
    mutationFn: (id: string) => readWorkspaceNotification(workspaceId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceNotifications(workspaceId).queryKey }),
  });
  const readAll = useMutation({
    mutationFn: () => readAllWorkspaceNotifications(workspaceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceNotifications(workspaceId).queryKey }),
  });
  const unread = query.data?.unread ?? 0;
  return <div className="workspace-notifications">
    <button type="button" className="workspace-notification-button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={`Workspace notifications${unread ? `, ${unread} unread` : ''}`}>
      <Bell size={18} />{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
    </button>
    {open && <div className="workspace-notification-panel">
      <div className="workspace-notification-panel__head"><strong>Workspace updates</strong>{unread > 0 && <button type="button" onClick={() => readAll.mutate()}><CheckCheck size={13} /> Mark all read</button>}</div>
      {query.isPending && <p className="workspace-empty">Loading…</p>}
      {query.data && !query.data.items.length && <p className="workspace-empty">No workspace notifications.</p>}
      <div className="workspace-notification-list">{query.data?.items.map(item => <Link key={item.id} to={item.href || `/workspace?workspace=${workspaceId}`} className={item.readAt ? '' : 'is-unread'} onClick={() => { if (!item.readAt) read.mutate(item.id); setOpen(false); }}><span>{item.message}</span><small>{new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(item.createdAt))}</small></Link>)}</div>
    </div>}
  </div>;
}
