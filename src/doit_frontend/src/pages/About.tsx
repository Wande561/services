import { CheckCircle, FileText, HeartHandshake, ShieldCheck } from 'lucide-react';

const features = [
  { icon: ShieldCheck, title: 'Account verification', description: 'Clients and providers can submit their details for administrator review.' },
  { icon: FileText, title: 'Clear quotations', description: 'Discuss the work, costs and appointment before a booking is made.' },
  { icon: CheckCircle, title: 'Reviews after service', description: 'Clients and providers can share feedback after both confirm completion.' },
  { icon: HeartHandshake, title: 'Local connections', description: 'Find services and connect with providers in your area.' },
];
export default function About() {
  return <main className="about-page min-h-screen px-5 py-14"><div className="mx-auto max-w-6xl"><header className="mx-auto max-w-3xl text-center"><p className="text-sm uppercase tracking-widest text-emerald-300">About ServiceConnect</p><h1 className="mt-4 text-5xl">Connecting people with local services</h1><p className="mt-5 text-lg text-home-text">ServiceConnect helps clients find providers, request quotations and arrange services with greater clarity.</p></header>
    <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{features.map(({ icon: Icon, title, description }) => <section key={title} className="rounded-2xl border border-home-line bg-home-surface p-6"><Icon className="h-7 w-7 text-emerald-300" aria-hidden="true" /><h2 className="mt-4 text-2xl">{title}</h2><p className="mt-2 text-sm text-emerald-300">{description}</p></section>)}</div>
    <section className="mt-12 rounded-2xl border border-home-line bg-home-surface p-8"><h2 className="text-3xl">Our mission</h2><p className="mt-3 max-w-3xl text-home-text">We want to make it easier for clients to find the help they need and for local providers to share their services and grow their businesses.</p></section>
    <section className="mt-12 text-center"><h2 className="text-3xl">Meet the founder</h2><p className="mt-4 text-xl text-home-text">Mawande Hlangu</p><p className="mt-1 text-emerald-300">CEO &amp; Founder</p></section>
  </div></main>;
}
