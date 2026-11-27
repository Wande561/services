import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export default function HistoryCard({ collapsed, title, subtitle, status, initiallyOpen, children }: { collapsed: boolean; title: string; subtitle: string; status: string; initiallyOpen?: boolean; children: ReactNode }) {
  if (!collapsed) return <>{children}</>;
  return <details className="history-card" open={initiallyOpen || undefined}>
    <summary className="history-card__summary">
      <span className="history-card__identity"><strong>{title}</strong><small>{subtitle}</small></span>
      <span className="history-card__status">{status}</span>
      <span className="history-card__toggle"><span className="history-card__open">View details</span><span className="history-card__close">Hide details</span><ChevronDown size={17} aria-hidden="true" /></span>
    </summary>
    <div className="history-card__content">{children}</div>
  </details>;
}
