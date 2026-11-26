import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Clock3, Globe2, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AppContext';
import { apiRequest } from '../utils/apiRequest';
import { days, defaultHours, myHours, type WorkingDay } from '../utils/providers';

function HoursEditor({ initial, initiallySet }: { initial: WorkingDay[]; initiallySet: boolean }) {
  const [hours, setHours] = useState(initial);
  const [savedHours, setSavedHours] = useState(initial);
  const [hasSaved, setHasSaved] = useState(initiallySet);
  const [error, setError] = useState('');
  const cache = useQueryClient();
  const changed = JSON.stringify(hours) !== JSON.stringify(savedHours) || !hasSaved;
  const openDays = hours.filter(row => !row.closed);
  const save = useMutation({
    mutationFn: (schedule: WorkingDay[]) => apiRequest('/providers/me/hours', { method: 'PUT', data: { workingHours: schedule } }),
    onSuccess: async (_, schedule) => { setSavedHours(schedule); setHasSaved(true); await cache.invalidateQueries({ queryKey: ['providers'] }); },
  });
  function update(day: number, changes: Partial<WorkingDay>) { save.reset(); setError(''); setHours(rows => rows.map(row => row.day === day ? { ...row, ...changes } : row)); }
  function weekdays() { save.reset(); setError(''); setHours(rows => rows.map(row => row.day < 5 ? { ...row, closed: false, open: '09:00', close: '17:00' } : row)); }
  function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    const invalid = hours.find(row => !row.closed && (!row.open || !row.close || row.open >= row.close));
    if (invalid) { setError(`${days[invalid.day]}: closing time must be later than opening time.`); return; }
    save.mutate(hours);
  }
  return <form onSubmit={submit} className="hours-layout">
    <div className="hours-main"><div className="hours-section-head"><div><p className="account-section-label">YOUR WEEK AT A GLANCE</p><h2>Set your hours</h2><p>Choose the days you work and set your usual hours.</p></div><button type="button" className="hours-preset" disabled={save.isPending} onClick={weekdays}><Sparkles aria-hidden="true" /> Weekdays, 9–5</button></div>
      <fieldset disabled={save.isPending} className="hours-list"><legend className="sr-only">Weekly working hours</legend>{hours.map((row, index) => <div className={`hours-day ${row.closed ? 'is-closed' : 'is-open'}`} key={row.day}><div className="hours-day__identity"><span className="hours-day__number">{String(index + 1).padStart(2, '0')}</span><div><strong>{days[row.day]}</strong><small>{row.closed ? 'Unavailable' : 'Available for enquiries'}</small></div></div><label className="hours-switch"><input type="checkbox" checked={!row.closed} onChange={e => update(row.day, e.target.checked ? { closed: false, open: '09:00', close: '17:00' } : { closed: true, open: null, close: null })} /><span className="hours-switch__track" /><span className="hours-switch__text">{row.closed ? 'Closed' : 'Open'}</span></label><div className="hours-day__times">{row.closed ? <span className="hours-day__closed">Not working</span> : <><label><span>OPENS</span><input type="time" aria-label={`${days[row.day]} opening time`} required value={row.open ?? ''} onChange={e => update(row.day, { open: e.target.value })} /></label><span className="hours-day__dash">—</span><label><span>CLOSES</span><input type="time" aria-label={`${days[row.day]} closing time`} required value={row.close ?? ''} onChange={e => update(row.day, { close: e.target.value })} /></label></>}</div></div>)}</fieldset>
      <div className="hours-savebar"><div aria-live="polite">{(error || save.isError) ? <p className="account-error" role="alert">{error || save.error?.message}</p> : save.isSuccess && !changed ? <p className="account-success"><Check aria-hidden="true" /> Your hours are saved.</p> : <p className="hours-savebar__hint">{changed ? 'Changes are not saved yet.' : 'Your schedule is up to date.'}</p>}</div><button className="account-save" disabled={save.isPending || !changed}>{save.isPending ? 'Saving…' : 'Save working hours'} <ArrowRight aria-hidden="true" /></button></div>
    </div>
    <aside className="hours-summary"><div className="hours-summary__icon"><Clock3 aria-hidden="true" /></div><p className="account-section-label">YOUR AVAILABILITY</p><h2>A little more clarity for your clients.</h2><p>These are your usual hours, so clients know when you are generally available.</p><div className="hours-summary__count"><strong>{openDays.length}</strong><span>days open<br />each week</span></div><div className="hours-summary__divider" /><div className="hours-summary__timezone"><Globe2 aria-hidden="true" /><span><strong>South African time</strong><small>All times are displayed in SAST</small></span></div><p className="hours-summary__footnote">Appointments are arranged through quotations. Working hours don’t reserve a time.</p></aside>
  </form>;
}
export default function WorkingHours() {
  const { currentUser } = useAuth(); const hours = useQuery(myHours(currentUser?.id ?? ''));
  return <main className="account-page"><div className="account-shell"><Link to="/provider-dashboard" className="account-back"><ArrowLeft aria-hidden="true" /> Back to dashboard</Link><header className="hours-heading"><div><p className="account-kicker">YOUR BUSINESS / AVAILABILITY</p><h1>Time that works<br /><em>for you.</em></h1><p>Set your weekly hours and let clients know when you're available.</p></div><div className="hours-heading__stamp"><Clock3 aria-hidden="true" /><span>YOUR WEEK<br />YOUR WAY</span></div></header>
    {hours.isPending && <p className="account-loading">Loading your schedule…</p>}{hours.isError && <p role="alert" className="account-error">{hours.error.message}</p>}{hours.isSuccess && <HoursEditor initial={hours.data.workingHours ?? defaultHours()} initiallySet={!!hours.data.workingHours} />}
  </div></main>;
}
