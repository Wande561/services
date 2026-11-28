import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Eye, Globe2 } from 'lucide-react';
import type { WorkspaceSummary } from '../types';
import { updateWorkspace, workspaceKey } from '../utils/workspaces';

export default function WorkspacePublicSettings({ summary, canManage }: { summary: WorkspaceSummary; canManage: boolean }) {
  const [publicDescription, setPublicDescription] = useState(summary.workspace.publicDescription ?? '');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (data: { publicDescription?: string; isPublished?: boolean }) => updateWorkspace(summary.workspace.id, data),
    onSuccess: () => { setError(''); queryClient.invalidateQueries({ queryKey: [...workspaceKey, summary.workspace.id] }); },
    onError: (err: Error) => setError(err.message),
  });
  if (!canManage) return null;
  return <section className="workspace-card workspace-public-settings">
    <div className="workspace-card__head"><div><p className="workspace-kicker">PUBLIC PROFILE</p><h2>How clients see this business</h2><p>Publish a public page with your services, team and reviews.</p></div><Globe2 size={20} /></div>
    <div className="workspace-public-settings__state"><span className={summary.workspace.isPublished ? 'is-live' : ''}>{summary.workspace.isPublished ? 'Published' : 'Draft'}</span><Link to={`/workspaces/${summary.workspace.id}`} className="workspace-link">{summary.workspace.isPublished ? 'View public page' : 'Preview page'} <Eye size={14} /></Link></div>
    <label className="workspace-public-settings__description">Public description<textarea maxLength={3000} value={publicDescription} onChange={event => setPublicDescription(event.target.value)} placeholder="Tell clients what this business does and what makes it different." /></label>
    <div className="workspace-public-settings__actions">
      <button type="button" className="workspace-secondary" onClick={() => update.mutate({ publicDescription })} disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save description'}</button>
      <button type="button" className={summary.workspace.isPublished ? 'workspace-secondary' : 'workspace-primary'} onClick={() => update.mutate({ isPublished: !summary.workspace.isPublished })} disabled={update.isPending}>{summary.workspace.isPublished ? 'Unpublish' : 'Publish workspace'} <ArrowUpRight size={15} /></button>
    </div>
    {error && <p className="workspace-error" role="alert">{error}</p>}
  </section>;
}
