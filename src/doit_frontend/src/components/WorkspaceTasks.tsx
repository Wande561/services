import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, Circle, Clock3, Plus, Trash2, UserRound } from 'lucide-react';
import type { WorkspaceSummary, WorkspaceTask, WorkspaceTaskPriority, WorkspaceTaskStatus } from '../types';
import { createWorkspaceTask, deleteWorkspaceTask, updateWorkspaceTask, workspaceKey, workspaceTasks } from '../utils/workspaces';

const columns: { key: WorkspaceTaskStatus; label: string; icon: typeof Circle }[] = [
  { key: 'Pending', label: 'Pending', icon: Circle },
  { key: 'InProgress', label: 'In progress', icon: Clock3 },
  { key: 'Completed', label: 'Completed', icon: CheckCircle2 },
];

const priorities: WorkspaceTaskPriority[] = ['Low', 'Normal', 'High', 'Urgent'];

function taskDate(value: string | null) {
  if (!value) return 'No due date';
  return new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'short' }).format(new Date(value));
}

function TaskCard({ workspaceId, task, canSeeAll, onChanged }: { workspaceId: string; task: WorkspaceTask; canSeeAll: boolean; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const update = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateWorkspaceTask(workspaceId, task.id, data),
    onSuccess: () => { setError(''); queryClient.invalidateQueries({ queryKey: [...workspaceKey, workspaceId] }); onChanged(); },
    onError: (err: Error) => setError(err.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteWorkspaceTask(workspaceId, task.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: [...workspaceKey, workspaceId] }); onChanged(); },
    onError: (err: Error) => setError(err.message),
  });
  return <article className={`workspace-task workspace-task--${task.priority.toLowerCase()}`}>
    <div className="workspace-task__head"><span className={`workspace-priority workspace-priority--${task.priority.toLowerCase()}`}>{task.priority}</span>{canSeeAll && <button type="button" className="workspace-task__delete" onClick={() => remove.mutate()} disabled={remove.isPending} aria-label={`Delete ${task.title}`}><Trash2 size={13} /></button>}</div>
    <strong>{task.title}</strong>
    {task.description && <p>{task.description}</p>}
    <div className="workspace-task__meta"><span><UserRound size={12} />{task.assignee?.name || task.assignee?.email || 'Unassigned'}</span><span><CalendarClock size={12} />{taskDate(task.dueAt)}</span></div>
    {task.booking && <small className="workspace-task__booking">{task.booking.serviceTitle}</small>}
    <select value={task.status} onChange={event => update.mutate({ status: event.target.value })} aria-label={`Status for ${task.title}`}>
      <option value="Pending">Pending</option><option value="InProgress">In progress</option><option value="Completed">Completed</option>
    </select>
    {error && <p className="workspace-error" role="alert">{error}</p>}
  </article>;
}

export default function WorkspaceTasks({ workspaceId, summary, canSeeAll, canManage }: { workspaceId: string; summary: WorkspaceSummary; canSeeAll: boolean; canManage: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery(workspaceTasks(workspaceId));
  const active = summary.team.filter(member => member.status === 'Active');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<WorkspaceTaskPriority>('Normal');
  const [dueAt, setDueAt] = useState('');
  const [error, setError] = useState('');
  const create = useMutation({
    mutationFn: () => createWorkspaceTask(workspaceId, { title, description: description || undefined, assigneeId: assigneeId || undefined, priority, dueAt: dueAt || undefined }),
    onSuccess: () => { setTitle(''); setDescription(''); setAssigneeId(''); setPriority('Normal'); setDueAt(''); setError(''); queryClient.invalidateQueries({ queryKey: [...workspaceKey, workspaceId] }); },
    onError: (err: Error) => setError(err.message),
  });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: workspaceTasks(workspaceId).queryKey }); queryClient.invalidateQueries({ queryKey: [...workspaceKey, workspaceId, 'summary'] }); };
  const tasks = query.data ?? [];

  return <div className="workspace-tasks">
    {canSeeAll && canManage && <section className="workspace-card workspace-task-create">
      <div className="workspace-card__head"><div><p className="workspace-kicker">INTERNAL WORK</p><h2>Create a task</h2><p>Assign operational work to a team member.</p></div><Plus size={20} aria-hidden="true" /></div>
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); create.mutate(); }} className="workspace-task-form">
        <label>Task<input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Prepare equipment for tomorrow" /></label>
        <label>Assignee<select value={assigneeId} onChange={event => setAssigneeId(event.target.value)}><option value="">Unassigned</option>{active.map(member => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select></label>
        <label>Priority<select value={priority} onChange={event => setPriority(event.target.value as WorkspaceTaskPriority)}>{priorities.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Due date<input type="date" value={dueAt} onChange={event => setDueAt(event.target.value)} /></label>
        <label className="workspace-task-form__wide">Description<textarea maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Optional details" /></label>
        <button className="workspace-primary" disabled={create.isPending}>{create.isPending ? 'Adding…' : 'Add task'} <Plus size={15} /></button>
      </form>
      {error && <p className="workspace-error" role="alert">{error}</p>}
    </section>}
    {query.isPending && <p className="workspace-empty">Loading tasks…</p>}
    {query.isError && <p className="workspace-error" role="alert">{query.error.message}</p>}
    <div className="workspace-task-board">{columns.map(column => {
      const items = tasks.filter(task => task.status === column.key);
      const Icon = column.icon;
      return <section key={column.key} className="workspace-task-column">
        <div className="workspace-task-column__head"><span><Icon size={15} /> {column.label}</span><b>{items.length}</b></div>
        {!items.length && <p className="workspace-task-empty">Nothing here.</p>}
        {items.map(task => <TaskCard key={task.id} workspaceId={workspaceId} task={task} canSeeAll={canSeeAll} onChanged={refresh} />)}
      </section>;
    })}</div>
  </div>;
}
