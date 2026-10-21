import { useState } from 'react';
import { BarChart3, Bike, ChevronDown, Coins, Mail, MapPin, Megaphone, MessageCircle, PlayCircle, Settings, Shield, TrendingUp, UserCheck, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const adminNavigationGroups = [
  { id: 'reports', label: 'Dashboard', icon: BarChart3, tabs: [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'analytics', label: 'Stats', icon: BarChart3 },
  ] },
  { id: 'accounts', label: 'Accounts', icon: Users, tabs: [
    { id: 'users', label: 'Users', icon: UserCheck },
    { id: 'affiliates', label: 'Affiliates', icon: Users },
    { id: 'beta_testers', label: 'Beta Testers', icon: Mail },
  ] },
  { id: 'billing', label: 'Billing & Credits', icon: Wallet, tabs: [
    { id: 'fees', label: 'Seller Fees', icon: Wallet },
    { id: 'rider_fees', label: 'Rider Fees', icon: Bike },
    { id: 'video_credits', label: 'Video Credits', icon: Coins },
  ] },
  { id: 'communication', label: 'Communications', icon: MessageCircle, tabs: [
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'campaigns', label: 'Campaigns', icon: Mail },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
  ] },
  { id: 'content', label: 'Marketing & Guides', icon: Megaphone, tabs: [
    { id: 'marketing', label: 'Marketing', icon: Megaphone },
    { id: 'tutorials', label: 'Tutorials', icon: PlayCircle },
  ] },
  { id: 'management', label: 'Management', icon: Settings, tabs: [
    { id: 'geographic', label: 'Areas', icon: MapPin },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] },
] as const;

export type AdminTab = typeof adminNavigationGroups[number]['tabs'][number]['id'];

interface Props {
  tab: AdminTab;
  onSelect: (tab: AdminTab) => void;
  counts: Partial<Record<AdminTab, number>>;
  mobileOpen: boolean;
  onClose: () => void;
}

function UpdateBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return <span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground" aria-label={`${count} bagong update sa ${label}`}>{count > 99 ? '99+' : count}</span>;
}

export function AdminNavigation({ tab, onSelect, counts, mobileOpen, onClose }: Props) {
  const [collapsed, setCollapsed] = useState<string[]>([]);

  function selectTab(next: AdminTab) {
    onSelect(next);
    onClose();
  }

  return <>
    {mobileOpen && <Button variant="ghost" aria-label="Isara ang admin menu" onClick={onClose} className="fixed inset-0 z-30 h-full w-full rounded-none bg-backdrop/60 hover:bg-backdrop/60 md:hidden" />}
    <aside aria-label="Admin sidebar" className={cn('fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex-col border-r border-border bg-card text-card-foreground md:sticky md:top-0 md:z-10 md:flex md:h-dvh md:w-60', mobileOpen ? 'flex' : 'hidden')}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-xs font-bold uppercase tracking-normal text-muted-foreground">Admin Panel</span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Isara ang menu" className="md:hidden"><X /></Button>
      </div>
      <nav aria-label="Admin navigation" className="min-h-0 flex-1 overflow-y-auto p-3">
        {adminNavigationGroups.map(group => {
          const activeGroup = group.tabs.some(item => item.id === tab);
          const expanded = !collapsed.includes(group.id);
          const groupCount = group.tabs.reduce((total, item) => total + (counts[item.id] ?? 0), 0);
          const Icon: LucideIcon = group.icon;
          return <div key={group.id} className="mb-2">
            <Button variant="ghost" aria-expanded={expanded} aria-controls={`admin-group-${group.id}`} onClick={() => setCollapsed(previous => previous.includes(group.id) ? previous.filter(id => id !== group.id) : [...previous, group.id])} className={cn('h-10 w-full justify-start gap-2 px-2 text-xs font-semibold hover:bg-muted', activeGroup ? 'text-primary' : 'text-muted-foreground')}>
              <Icon /><span className="min-w-0 flex-1 text-left">{group.label}</span>
              {!expanded && <UpdateBadge count={groupCount} label={group.label} />}
              <ChevronDown className={cn('transition-transform motion-reduce:transition-none', !expanded && '-rotate-90')} />
            </Button>
            <div id={`admin-group-${group.id}`} hidden={!expanded} className="ml-4 space-y-1 border-l border-border pl-2">
              {group.tabs.map(item => {
                const ItemIcon: LucideIcon = item.icon;
                return <Button key={item.id} variant="ghost" aria-current={tab === item.id ? 'page' : undefined} onClick={() => selectTab(item.id)} className={cn('h-10 w-full justify-start gap-2 px-2 text-xs hover:bg-muted hover:text-foreground', tab === item.id ? 'bg-secondary font-semibold text-primary' : 'text-muted-foreground')}>
                  <ItemIcon /><span className="min-w-0 flex-1 text-left">{item.label}</span><UpdateBadge count={counts[item.id] ?? 0} label={item.label} />
                </Button>;
              })}
            </div>
          </div>;
        })}
      </nav>
    </aside>
  </>;
}