import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { ArrowRight, LifeBuoy, MessageSquareText, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AppContext';
import { apiRequest } from '../utils/apiRequest';
import { quoteTime } from '../utils/quotes';
interface Complaint { id: string; subject: string; description: string; status: string; createdAt: string }
const field = 'mt-1 w-full rounded-lg border border-home-control bg-home-canvas p-3 text-white';
export default function Complaints() {
  const { currentUser } = useAuth(); const cache = useQueryClient();
  const list = useQuery({ queryKey: ['my-complaints', currentUser?.id], queryFn: () => apiRequest<Complaint[]>('/complaints'), enabled: !!currentUser, retry: false });
  const send = useMutation({ mutationFn: (data: object) => apiRequest('/complaints', { method: 'POST', data }), onSuccess: () => cache.invalidateQueries({ queryKey: ['my-complaints'] }) });
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); try { await send.mutateAsync({ subject: data.get('subject'), description: data.get('description') }); form.reset(); } catch { /* Error is shown below. */ } }
  return <main className="polished-page support-page min-h-screen px-5 py-12"><div className="mx-auto max-w-4xl">
    <header className="polished-heading"><div><p>YOUR ACCOUNT / SUPPORT</p><h1>We're here <em>to help.</em></h1><span>Tell us what happened. Our team will review your message.</span></div><div className="polished-heading__icon"><LifeBuoy aria-hidden="true" /></div></header>
    <div className="support-layout"><form onSubmit={submit} className="support-form"><div className="polished-section-head"><div><span>GET IN TOUCH</span><h2>Send a complaint</h2></div><MessageSquareText aria-hidden="true" /></div><label className="block">Subject<input className={field} name="subject" maxLength={120} placeholder="What is this about?" required /></label><label className="block">What happened?<textarea className={field} name="description" rows={5} maxLength={3000} placeholder="Share the details with us" required /></label>{send.isError && <p role="alert" className="text-red-300">{send.error.message}</p>}{send.isSuccess && <p role="status" className="text-emerald-300">Your complaint was submitted.</p>}<button className="btn-primary disabled:opacity-50" disabled={send.isPending}>{send.isPending ? 'Sending…' : 'Send complaint'} <ArrowRight size={16} aria-hidden="true" /></button></form>
    <aside className="support-aside"><ShieldCheck aria-hidden="true" /><p>HERE FOR YOU</p><h2>Let's work through it.</h2><span>Your complaint goes to our marketplace administrators for review.</span></aside></div>
    <section className="support-history"><div className="polished-section-head"><div><span>YOUR ACTIVITY</span><h2>Your complaints</h2></div><small>{list.data?.length ?? 0} submitted</small></div>{list.isPending && <p className="mt-3">Loading…</p>}{list.isError && <p role="alert" className="mt-3 text-red-300">{list.error.message}</p>}{list.data?.length === 0 && <p className="polished-empty">No complaints yet. We're here if you need us.</p>}<div className="mt-4 space-y-3">{list.data?.map(item => <details key={item.id} className="support-case"><summary><span><strong>{item.subject}</strong><small>{quoteTime(item.createdAt)}</small></span><span className="polished-badge">{item.status === 'InReview' ? 'In review' : item.status}</span></summary><p className="whitespace-pre-wrap">{item.description}</p></details>)}</div></section>
  </div></main>;
}
