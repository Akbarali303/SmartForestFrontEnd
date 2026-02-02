'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export type SidebarSubItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SidebarCollapsibleMenuProps = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems: SidebarSubItem[];
  collapsed?: boolean;
  defaultOpen?: boolean;
  /** Agar menyu ochiq bo‘lsa, header bosilganda yopiladi va shu manzilga yo‘naltiriladi */
  collapseAndGoTo?: string;
};

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function SidebarCollapsibleMenu({
  label,
  icon: Icon,
  subItems,
  collapsed = false,
  defaultOpen = false,
  collapseAndGoTo,
}: SidebarCollapsibleMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  const isGroupActive = subItems.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'));

  useEffect(() => {
    if (isGroupActive && !open) setOpen(true);
  }, [isGroupActive, open]);

  const handleHeaderClick = () => {
    if (open && collapseAndGoTo) {
      setOpen(false);
      router.push(collapseAndGoTo);
    } else {
      setOpen((prev) => !prev);
    }
  };

  if (collapsed) {
    return (
      <li>
        <button
          type="button"
          className="flex items-center justify-center w-full px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition"
          aria-label={label}
          title={label}
        >
          <Icon className="w-5 h-5 shrink-0" />
        </button>
      </li>
    );
  }

  return (
    <li className="space-y-0.5">
      <button
        type="button"
        onClick={handleHeaderClick}
        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition ${
          isGroupActive
            ? 'bg-forest-600/20 text-forest-400 border border-forest-500/30'
            : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
        }`}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span className="font-medium truncate flex-1 text-left">{label}</span>
        {open ? (
          <ChevronDown className="w-5 h-5 shrink-0 text-slate-500" />
        ) : (
          <ChevronRight className="w-5 h-5 shrink-0 text-slate-500" />
        )}
      </button>
      {open && (
        <ul className="pl-4 pr-2 py-1 space-y-0.5 border-l border-slate-700/50 ml-3">
          {subItems.map((item) => {
            const SubIcon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition text-sm ${
                    isActive
                      ? 'bg-forest-600/20 text-forest-400 border border-forest-500/30'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  <SubIcon className="w-4 h-4 shrink-0" />
                  <span className="font-medium truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
