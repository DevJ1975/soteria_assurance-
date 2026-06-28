'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  Users,
  Wrench,
  FileText,
  BookOpen,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { SoteriaStrings } from '@soteria/core';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Primary navigation. Labels come from SoteriaStrings where available (RULE 4);
 * section names not yet in the catalogue use their canonical product nouns.
 */
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/audits', label: SoteriaStrings.audit.listTitle, icon: ClipboardCheck },
  { href: '/audits/clauses', label: SoteriaStrings.clauses.navigatorTitle, icon: ListChecks },
  { href: '/audits/findings', label: SoteriaStrings.findings.listTitle, icon: ShieldCheck },
  { href: '/clients', label: 'Clients', icon: Users },
  {
    href: '/corrective-actions',
    label: SoteriaStrings.correctiveActions.listTitle,
    icon: Wrench,
  },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/wiki', label: 'ISO 45001 Wiki', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/**
 * Deep-navy app navigation rail (FRAME 03). The active item is highlighted with
 * a translucent white panel, a gold-light icon and a gold left indicator;
 * inactive items sit in a muted steel and lift to white on hover.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar md:flex">
      {/* Brand lockup: shield mark + Montserrat wordmark. */}
      <div className="flex items-center gap-sm px-lg py-lg">
        <Logo size={29} aria-hidden />
        <div className="leading-tight">
          <span className="block font-display text-base font-bold text-white">
            {SoteriaStrings.common.appName}
          </span>
          <span className="block text-[9px] font-medium uppercase tracking-[0.04em] text-[#7D90AE]">
            Trainovate Technologies
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-sm py-md">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-sm rounded-md px-md py-2.5 text-sm transition-colors',
                active
                  ? 'bg-white/10 font-semibold text-white'
                  : 'font-medium text-[#A9B8CE] hover:bg-white/5 hover:text-white',
              )}
            >
              {/* Gold left indicator on the active item. */}
              {active ? (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gold-500"
                />
              ) : null}
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0',
                  active ? 'text-gold-light' : 'text-current',
                )}
                aria-hidden
              />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-sm mt-sm flex items-center gap-sm border-t border-white/10 px-md py-md">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full bg-conforming shadow-[0_0_0_3px_rgba(46,204,113,0.2)]"
        />
        <span className="text-xs font-medium text-[#9DB2CE]">ISO 45001:2018</span>
      </div>
    </aside>
  );
}
