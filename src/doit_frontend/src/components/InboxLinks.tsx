import { useQuery } from '@tanstack/react-query';
import { Bell, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import { inboxUnread } from '../utils/inbox';

export default function InboxLinks() {
  const { currentUser } = useAuth();
  const { data } = useQuery(inboxUnread(currentUser?.id ?? ''));
  const links = [
    { name: 'Messages', to: '/messages', icon: MessageSquare, count: data?.messages ?? 0 },
    { name: 'Notifications', to: '/notifications', icon: Bell, count: data?.notifications ?? 0 },
  ];
  return (
    <nav aria-label="Inbox" className="flex flex-wrap gap-3">
      {links.map(({ name, to, icon: Icon, count }) => (
        <Link key={to} to={to} className="btn-secondary inline-flex items-center gap-2">
          <Icon aria-hidden="true" className="h-4 w-4" />
          {name}
          {count > 0 && <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-200">{count} unread</span>}
        </Link>
      ))}
    </nav>
  );
}
