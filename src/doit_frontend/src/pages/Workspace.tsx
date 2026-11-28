import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight, Building2, CalendarDays, CheckCircle2, ChevronDown, Clock3, ClipboardList,
  Mail, Plus, ShieldCheck, Sparkles, UserPlus, Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AppContext';
import type { WorkspaceBooking, WorkspaceMember, WorkspaceRole, WorkspaceSummary } from '../types';
import { bookingHistoryPath } from '../utils/inbox';
import {
  acceptWorkspaceInvitation, assignWorkspaceBooking, createWorkspace, deactivateWorkspaceMember,
  inviteWorkspaceMember, myWorkspaces, updateWorkspaceMember, workspaceBookings, workspaceKey, workspaceSummary,
} from '../utils/workspaces';

const roles: WorkspaceRole[] = ['Manager', 'Staff', 'Receptionist', 'Finance'];
const roleHelp: Record<WorkspaceRole, string> = {
  Owner: 'Full workspace access',
  Manager: 'Bookings, team and operations',
  Staff: 'Assigned bookings only',
  Receptionist: 'Bookings and client communication',
  Finance: 'Payments, invoices and reports',
};
const permissionOptions: { key: string; label: string }[] = [
  { key: 'team.view', label: 'View team' },
  { key: 'team.manage', label: 'Manage team' },
  { key: 'bookings.view.all', label: 'View all bookings' },
  { key: 'bookings.manage', label: 'Manage bookings' },
  { key: 'bookings.assign', label: 'Assign bookings' },
  { key: 'services.manage', label: 'Manage services' },
  { key: 'finance.view', label: 'View finances' },
  { key: 'analytics.view', label: 'View analytics' },
  { key: 'workspace.manage', label: 'Manage workspace' },
];

function when(value: string) {
  return `${new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(value))} SAST`;
}

function initials(member: { name: string | null; email: string }) {
  return (member.name || member.email).trim().charAt(0).toUpperCase();
}

function ActivationForm({ defaultName, defaultLocation, attachDefault, onCreated, compact = false }: {
  defaultName: string; defaultLocation: string; attachDefault: boolean;
  onCreated: (summary: WorkspaceSummary) => void; compact?: boolean;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(defaultLocation);
  const [attachExisting, setAttachExisting] = useState(attachDefault);
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: () => createWorkspace({ name, description: description || undefined, location: location || undefined, attachExisting }),
    onSuccess: summary => { setError(''); onCreated(summary); },
    onError: (err: Error) => setError(err.message),
  });
  return <form className={`workspace-activation ${compact ? 'workspace-activation--compact' : ''}`} onSubmit={(event: FormEvent) => { event.preventDefault(); mutation.mutate(); }}>
    {!compact && <div className="workspace-activation__intro"><span className="workspace-activation__icon"><Building2 aria-hidden="true" /></span><div><p className="workspace-kicker">OPTIONAL BUSINESS WORKSPACE</p><h2>Run your business, not just your bookings.</h2><p>Add a team, assign work and keep the whole operation in one place. You can keep using ServiceConnect as a solo provider at any time.</p></div></div>}
    <div className="workspace-form-grid">
      <label>Workspace name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Wande Cleaning Services" /></label>
      <label>Location<input maxLength={150} value={location} onChange={event => setLocation(event.target.value)} placeholder="City or town" /></label>
    </div>
    <label>Description<textarea maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="What does this business do?" /></label>
    {attachDefault && <label className="workspace-check"><input type="checkbox" checked={attachExisting} onChange={event => setAttachExisting(event.target.checked)} /><span><strong>Bring my existing services and bookings into this workspace</strong><small>You can add another workspace later.</small></span></label>}
    {error && <p className="workspace-error" role="alert">{error}</p>}
    <button className="workspace-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Creating…' : compact ? 'Create workspace' : 'Activate workspace'} <ArrowUpRight size={16} aria-hidden="true" /></button>
  </form>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CalendarDays }) {
  return <article className="workspace-metric"><span>{label}</span><Icon size={17} aria-hidden="true" /><strong>{value}</strong></article>;
}

function Overview({ summary, canTeamView }: { summary: WorkspaceSummary; canTeamView: boolean }) {
  return <div className="workspace-overview">
    <div className="workspace-metrics">
      <Metric label="Today's bookings" value={summary.metrics.todayBookings} icon={CalendarDays} />
      <Metric label="Pending requests" value={summary.metrics.pendingRequests} icon={Clock3} />
      <Metric label="Upcoming bookings" value={summary.metrics.upcomingBookings} icon={ClipboardList} />
      <Metric label="Active team" value={summary.metrics.activeMembers} icon={Users} />
      <Metric label="Completed this month" value={summary.metrics.completedThisMonth} icon={CheckCircle2} />
    </div>
    <div className="workspace-columns">
      <section className="workspace-card">
        <div className="workspace-card__head"><div><p className="workspace-kicker">NEXT UP</p><h2>Upcoming appointments</h2></div><Link to={`/workspace?workspace=${summary.workspace.id}&tab=bookings`}>All bookings <ArrowUpRight size={15} /></Link></div>
        {!summary.upcoming.length && <p className="workspace-empty">No upcoming appointments yet.</p>}
        <div className="workspace-list">{summary.upcoming.map(booking => <Link key={booking.id} to={bookingHistoryPath(booking.id)} className="workspace-list__row">
          <span className="workspace-date"><strong>{new Date(booking.slot.startsAt).getDate()}</strong><small>{new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short' }).format(new Date(booking.slot.startsAt))}</small></span>
          <span className="workspace-list__copy"><strong>{booking.serviceTitle}</strong><small>{booking.client.user.name || 'Client'} · {when(booking.slot.startsAt)}</small><small className="workspace-assignment-line">{booking.workspaceAssignments.length ? booking.workspaceAssignments.map(item => item.member.name || item.member.email).join(', ') : 'Unassigned'}</small></span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>)}</div>
      </section>
      <section className="workspace-card">
        <div className="workspace-card__head"><div><p className="workspace-kicker">YOUR TEAM</p><h2>Who is working</h2></div><Link to={`/workspace?workspace=${summary.workspace.id}&tab=team`}>Manage team <ArrowUpRight size={15} /></Link></div>
        {!summary.team.length && <p className="workspace-empty">{canTeamView ? 'Invite your first team member.' : 'Team details are private for your role.'}</p>}
        <div className="workspace-team-preview">{summary.team.slice(0, 6).map(member => <div key={member.id} className="workspace-person"><span className="workspace-avatar">{initials(member)}</span><span><strong>{member.name || member.email}</strong><small>{member.role} · {member.status}</small></span></div>)}</div>
      </section>
    </div>
    <section className="workspace-card">
      <div className="workspace-card__head"><div><p className="workspace-kicker">RECENT ACTIVITY</p><h2>Workspace activity</h2></div></div>
      {!summary.activity.length && <p className="workspace-empty">Team and booking activity will appear here.</p>}
      <ul className="workspace-activity">{summary.activity.map(item => <li key={item.id}><span className="workspace-activity__dot" /><span><strong>{item.message}</strong><small>{item.actor?.name || 'Workspace'} · {when(item.createdAt)}</small></span></li>)}</ul>
    </section>
  </div>;
}

function PermissionsEditor({ member, onSave }: { member: WorkspaceMember; onSave: (permissions: Record<string, boolean>) => void }) {
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const option of permissionOptions) initial[option.key] = member.effectivePermissions.includes(option.key);
    return initial;
  });
  return <div className="workspace-permissions">{permissionOptions.map(option => <label key={option.key} className="workspace-check workspace-check--compact"><input type="checkbox" checked={values[option.key]} onChange={event => setValues({ ...values, [option.key]: event.target.checked })} /><span>{option.label}</span></label>)}<button type="button" className="workspace-secondary" onClick={() => onSave(values)}>Save permissions</button></div>;
}

function TeamPanel({ summary, canManage, isOwner, onRefresh }: { summary: WorkspaceSummary; canManage: boolean; isOwner: boolean; onRefresh: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<WorkspaceRole>('Staff');
  const [invite, setInvite] = useState<{ inviteUrl: string; emailSent: boolean } | null>(null);
  const [error, setError] = useState('');
  const inviteMutation = useMutation({
    mutationFn: () => inviteWorkspaceMember(summary.workspace.id, { email, name: name || undefined, role }),
    onSuccess: result => { setInvite({ inviteUrl: result.inviteUrl, emailSent: result.emailSent }); setEmail(''); setName(''); setError(''); onRefresh(); },
    onError: (err: Error) => setError(err.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: Record<string, unknown> }) => updateWorkspaceMember(summary.workspace.id, memberId, data),
    onSuccess: () => { setError(''); onRefresh(); },
    onError: (err: Error) => setError(err.message),
  });
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => deactivateWorkspaceMember(summary.workspace.id, memberId),
    onSuccess: () => { setError(''); onRefresh(); },
    onError: (err: Error) => setError(err.message),
  });

  return <div className="workspace-team">
    {canManage && <section className="workspace-card workspace-invite">
      <div className="workspace-card__head"><div><p className="workspace-kicker">GROW THE TEAM</p><h2>Invite someone</h2></div><UserPlus size={20} aria-hidden="true" /></div>
      <form onSubmit={event => { event.preventDefault(); inviteMutation.mutate(); }} className="workspace-invite__form">
        <label>Email<input required type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></label>
        <label>Name<input maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="Optional" /></label>
        <label>Role<select value={role} onChange={event => setRole(event.target.value as WorkspaceRole)}>{roles.map(item => <option key={item} value={item}>{item} — {roleHelp[item]}</option>)}</select></label>
        <button className="workspace-primary" disabled={inviteMutation.isPending}>{inviteMutation.isPending ? 'Sending…' : 'Send invite'} <Mail size={16} aria-hidden="true" /></button>
      </form>
      {invite && <div className="workspace-invite__result" role="status"><strong>{invite.emailSent ? 'Invitation email sent.' : 'Invitation created, but email could not be sent.'}</strong><p>Share this link directly if needed:</p><code>{invite.inviteUrl}</code></div>}
    </section>}
    {error && <p className="workspace-error" role="alert">{error}</p>}
    <section className="workspace-card">
      <div className="workspace-card__head"><div><p className="workspace-kicker">TEAM DIRECTORY</p><h2>Your people</h2></div><span className="workspace-count">{summary.team.filter(member => member.status === 'Active').length} active</span></div>
      <div className="workspace-member-list">{summary.team.map(member => {
        const locked = member.role === 'Owner' || (!isOwner && member.role === 'Manager');
        return <article key={member.id} className="workspace-member">
          <span className="workspace-avatar">{initials(member)}</span>
          <div className="workspace-member__identity"><strong>{member.name || 'Team member'}</strong><small>{member.email}</small><span className={`workspace-badge workspace-badge--${member.status.toLowerCase()}`}>{member.status}</span></div>
          <div className="workspace-member__controls">
            {isOwner && !locked ? <select value={member.role} onChange={event => updateMutation.mutate({ memberId: member.id, data: { role: event.target.value } })}>{roles.map(item => <option key={item} value={item}>{item}</option>)}</select> : <span className="workspace-role">{member.role}</span>}
            {canManage && !locked && <details className="workspace-details"><summary><ShieldCheck size={14} /> Permissions <ChevronDown size={13} /></summary><PermissionsEditor member={member} onSave={permissions => updateMutation.mutate({ memberId: member.id, data: { permissions } })} /><details className="workspace-details workspace-details--nested"><summary><Sparkles size={14} /> Services <ChevronDown size={13} /></summary><div className="workspace-permissions">{summary.listings.map(listing => <label key={listing.id} className="workspace-check workspace-check--compact"><input type="checkbox" defaultChecked={member.serviceIds.includes(listing.id)} onChange={event => { const ids = new Set(member.serviceIds); if (event.target.checked) ids.add(listing.id); else ids.delete(listing.id); updateMutation.mutate({ memberId: member.id, data: { serviceIds: [...ids] } }); }} /><span>{listing.title}</span></label>)}{!summary.listings.length && <p className="workspace-empty">No services in this workspace yet.</p>}</div></details></details>}
            {canManage && !locked && member.status === 'Active' && <button type="button" className="workspace-danger" onClick={() => removeMutation.mutate(member.id)} disabled={removeMutation.isPending}>Deactivate</button>}
            {canManage && !locked && member.status === 'Inactive' && <button type="button" className="workspace-secondary" onClick={() => updateMutation.mutate({ memberId: member.id, data: { status: 'Active' } })}>Reactivate</button>}
          </div>
        </article>;
      })}</div>
    </section>
  </div>;
}

function BookingsPanel({ summary, canAssign }: { summary: WorkspaceSummary; canAssign: boolean }) {
  const [status, setStatus] = useState('');
  const [memberId, setMemberId] = useState('');
  const query = useQuery(workspaceBookings(summary.workspace.id, { ...(status ? { status } : {}), ...(memberId ? { memberId } : {}) }));
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const assign = useMutation({
    mutationFn: ({ bookingId, memberIds }: { bookingId: string; memberIds: string[] }) => assignWorkspaceBooking(summary.workspace.id, bookingId, memberIds),
    onSuccess: () => { setError(''); queryClient.invalidateQueries({ queryKey: [...workspaceKey, summary.workspace.id] }); },
    onError: (err: Error) => setError(err.message),
  });
  const active = summary.team.filter(member => member.status === 'Active');
  return <section className="workspace-card">
    <div className="workspace-card__head"><div><p className="workspace-kicker">OPERATIONS</p><h2>Bookings</h2><p>Assign the right people and keep the whole team in sync.</p></div><div className="workspace-filter-row"><select value={status} onChange={event => setStatus(event.target.value)} aria-label="Filter bookings by status"><option value="">All statuses</option><option value="Pending">Pending</option><option value="Confirmed">Confirmed</option><option value="Completed">Completed</option><option value="Cancelled">Cancelled</option></select><select value={memberId} onChange={event => setMemberId(event.target.value)} aria-label="Filter bookings by team member"><option value="">Everyone</option>{active.map(member => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select></div></div>
    {error && <p className="workspace-error" role="alert">{error}</p>}
    {query.isPending && <p className="workspace-empty">Loading bookings…</p>}
    {query.isError && <p className="workspace-error" role="alert">{query.error.message}</p>}
    {query.data && !query.data.length && <p className="workspace-empty">No bookings match this view.</p>}
    <div className="workspace-booking-list">{query.data?.map(booking => <WorkspaceBookingRow key={booking.id} booking={booking} active={active} canAssign={canAssign} onAssign={memberIds => assign.mutate({ bookingId: booking.id, memberIds })} busy={assign.isPending} />)}</div>
  </section>;
}

function WorkspaceBookingRow({ booking, active, canAssign, onAssign, busy }: { booking: WorkspaceBooking; active: WorkspaceMember[]; canAssign: boolean; onAssign: (ids: string[]) => void; busy: boolean }) {
  const [selected, setSelected] = useState<string[]>(() => booking.workspaceAssignments.map(item => item.memberId));
  useEffect(() => { setSelected(booking.workspaceAssignments.map(item => item.memberId)); }, [booking.workspaceAssignments]);
  return <article className="workspace-booking">
    <span className="workspace-date workspace-date--wide"><strong>{new Date(booking.slot.startsAt).getDate()}</strong><small>{new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short' }).format(new Date(booking.slot.startsAt))}</small></span>
    <div className="workspace-booking__copy"><strong>{booking.serviceTitle}</strong><small>{booking.client.user.name || 'Client'} · {when(booking.slot.startsAt)}</small><small>{booking.address}</small><span className={`workspace-badge workspace-badge--${booking.status.toLowerCase()}`}>{booking.status}</span></div>
    <div className="workspace-booking__assign">
      <div className="workspace-assignment-chips">{booking.workspaceAssignments.length ? booking.workspaceAssignments.map(item => <span key={item.id}>{item.member.name || item.member.email}</span>) : <span className="workspace-unassigned">Unassigned</span>}</div>
      {canAssign && <details className="workspace-details"><summary><Users size={14} /> Assign <ChevronDown size={13} /></summary><div className="workspace-permissions">{active.map(member => <label key={member.id} className="workspace-check workspace-check--compact"><input type="checkbox" checked={selected.includes(member.id)} onChange={event => setSelected(event.target.checked ? [...selected, member.id] : selected.filter(id => id !== member.id))} /><span>{member.name || member.email}</span></label>)}<button type="button" className="workspace-secondary" disabled={busy} onClick={() => onAssign(selected)}>Save assignments</button></div></details>}
      <Link to={bookingHistoryPath(booking.id)} className="workspace-link">Open booking <ArrowUpRight size={14} /></Link>
    </div>
  </article>;
}

export default function Workspace() {
  const { currentUser } = useAuth();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'overview' | 'team' | 'bookings'>(() => (params.get('tab') as 'overview' | 'team' | 'bookings') || 'overview');
  const queryClient = useQueryClient();
  const workspaces = useQuery(myWorkspaces());
  const selectedId = params.get('workspace') || workspaces.data?.[0]?.id || '';
  const summary = useQuery({ ...workspaceSummary(selectedId), enabled: Boolean(selectedId) });
  const current = workspaces.data?.find(item => item.id === selectedId) ?? workspaces.data?.[0];
  const isProvider = Boolean(currentUser?.profile?.providerEnabled);

  useEffect(() => {
    const next = params.get('tab') as 'overview' | 'team' | 'bookings' | null;
    if (next) setTab(next);
  }, [params]);

  function choose(id: string) { setParams({ workspace: id, tab }); }
  function refresh() { void queryClient.invalidateQueries({ queryKey: workspaceKey }); }
  function created(result: WorkspaceSummary) { refresh(); setParams({ workspace: result.workspace.id }); setCreating(false); }

  if (workspaces.isPending) return <main className="workspace-page"><div className="workspace-shell"><p role="status" className="workspace-empty">Loading your workspace…</p></div></main>;
  if (workspaces.isError) return <main className="workspace-page"><div className="workspace-shell"><p className="workspace-error" role="alert">{workspaces.error.message}</p></div></main>;

  if (!workspaces.data?.length) {
    if (!isProvider) return <main className="workspace-page"><div className="workspace-shell workspace-no-access"><span className="workspace-activation__icon"><Building2 aria-hidden="true" /></span><h1>No workspace yet</h1><p>You have not been added to a business workspace. Ask the business owner to invite your account, or switch to provider mode to create one.</p><Link className="workspace-primary" to="/settings">Go to settings <ArrowUpRight size={16} /></Link></div></main>;
    return <main className="workspace-page"><div className="workspace-shell"><ActivationForm defaultName={currentUser?.profile?.businessName || currentUser?.name || ''} defaultLocation={currentUser?.profile?.location || ''} attachDefault onCreated={created} /></div></main>;
  }

  const can = (permission: string) => summary.data?.access.permissions.includes(permission) ?? false;
  const isOwner = summary.data?.access.role === 'Owner' || current?.isOwner;

  return <main className="workspace-page"><div className="workspace-shell">
    <header className="workspace-head">
      <div><p className="workspace-kicker">BUSINESS WORKSPACE</p><h1>{current?.name || 'Workspace'}</h1><p>{current?.description || 'Your team, bookings and business in one place.'}</p></div>
      <div className="workspace-head__actions">
        {workspaces.data.length > 1 && <select aria-label="Choose workspace" value={selectedId} onChange={event => choose(event.target.value)}>{workspaces.data.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select>}
        {isProvider && <button type="button" className="workspace-secondary" onClick={() => setCreating(value => !value)}><Plus size={15} /> New workspace</button>}
        <Link to="/provider-dashboard" className="workspace-secondary">Provider dashboard <ArrowUpRight size={15} /></Link>
      </div>
    </header>
    {creating && <ActivationForm compact defaultName="" defaultLocation={currentUser?.profile?.location || ''} attachDefault={false} onCreated={created} />}
    <nav className="workspace-tabs" aria-label="Workspace sections">
      {(['overview', ...(summary.data && !can('team.view') ? [] : ['team'] as const), 'bookings'] as const).map(item => <button key={item} type="button" className={tab === item ? 'is-active' : ''} onClick={() => { setTab(item); setParams({ workspace: selectedId, tab: item }); }}>{item === 'overview' ? 'Overview' : item === 'team' ? 'Team' : 'Bookings'}</button>)}
    </nav>
    {summary.isPending && <p className="workspace-empty" role="status">Loading workspace…</p>}
    {summary.isError && <p className="workspace-error" role="alert">{summary.error.message}</p>}
    {summary.data && (tab === 'overview' || (tab === 'team' && !can('team.view'))) && <Overview summary={summary.data} canTeamView={can('team.view')} />}
    {summary.data && tab === 'team' && can('team.view') && <TeamPanel summary={summary.data} canManage={can('team.manage')} isOwner={!!isOwner} onRefresh={refresh} />}
    {summary.data && tab === 'bookings' && <BookingsPanel summary={summary.data} canAssign={can('bookings.assign')} />}
  </div></main>;
}

export function WorkspaceAccept() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || new URLSearchParams(window.location.search).get('token') || '');
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: () => acceptWorkspaceInvitation(token),
    onSuccess: result => navigate(`/workspace?workspace=${encodeURIComponent(result.workspaceId)}`, { replace: true }),
  });
  useEffect(() => { if (token) mutation.mutate(); }, [token]);
  return <main className="workspace-page"><div className="workspace-shell workspace-no-access">
    <span className="workspace-activation__icon"><ShieldCheck aria-hidden="true" /></span>
    <h1>{mutation.isPending ? 'Joining workspace…' : mutation.isError ? 'Invitation could not be accepted' : 'Workspace invitation'}</h1>
    {!token && <p>This invitation link is missing its token. Ask the workspace owner to send it again.</p>}
    {mutation.isError && <p className="workspace-error" role="alert">{mutation.error.message}</p>}
    {mutation.isError && <p>Make sure you are signed in with the email address that received the invitation.</p>}
    {mutation.isError && <Link className="workspace-primary" to="/workspace">Go to workspace <ArrowUpRight size={16} /></Link>}
  </div></main>;
}
