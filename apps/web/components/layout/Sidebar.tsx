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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-primary-800 md:flex">
      <div className="flex h-16 items-center gap-sm px-lg">
        <ShieldCheck className="h-6 w-6 text-gold-500" aria-hidden />
        <span className="font-display text-lg font-bold text-white">
          {SoteriaStrings.common.appName}
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-sm py-md">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-sm rounded-md px-md py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-600 text-white'
                  : 'text-primary-100 hover:bg-primary-700 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-lg py-md text-xs text-primary-200">ISO 45001:2018</div>
    </aside>
  );
}
