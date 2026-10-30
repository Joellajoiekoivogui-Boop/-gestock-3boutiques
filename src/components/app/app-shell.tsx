'use client';

import { LogOut, Menu } from 'lucide-react';
import { LayoutGroup, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOutAction } from '@/app/actions/auth';
import { Logo } from '@/components/app/logo';
import { navFor } from '@/components/app/nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { ProfileRow } from '@/lib/database.types';
import { ROLE_LABELS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

type ShellProps = {
  profile: Pick<ProfileRow, 'full_name' | 'email' | 'role' | 'permissions' | 'is_active'>;
  brand: { name: string; logoUrl: string | null };
  children: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  if (href === '/pos') return pathname === '/pos';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  profile,
  brand,
  onNavigate,
  group,
}: Omit<ShellProps, 'children'> & { onNavigate?: () => void; group: string }) {
  const pathname = usePathname();
  const sections = navFor(profile);
  return (
    <LayoutGroup id={group}>
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-4 py-5">
          <Logo logoUrl={brand.logoUrl} name={brand.name} size={40} className="rounded-lg bg-white" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{brand.name}</p>
            <p className="text-xs text-sidebar-muted">Gestion restaurant</p>
          </div>
        </div>
        <nav aria-label="Navigation principale" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider text-sidebar-muted uppercase">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group relative flex items-center gap-3 rounded-md px-2.5 py-2.5 text-sm transition-colors pointer-coarse:py-3',
                          active
                            ? 'font-semibold text-primary-foreground'
                            : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                        )}
                      >
                        {active && (
                          // Pastille verte qui glisse d'un lien à l'autre.
                          <motion.span
                            layoutId="nav-active"
                            className="absolute inset-0 rounded-md bg-primary"
                            transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                          />
                        )}
                        <Icon
                          className="relative size-4 transition-transform duration-200 group-hover:scale-110"
                          aria-hidden
                        />
                        <span className="relative">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium">{profile.full_name || profile.email}</p>
            <p className="text-xs text-sidebar-muted">{ROLE_LABELS[profile.role]}</p>
          </div>
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut aria-hidden /> Se déconnecter
            </Button>
          </form>
        </div>
      </div>
    </LayoutGroup>
  );
}

export function AppShell({ profile, brand, children }: ShellProps) {
  const [open, setOpen] = useState(false);

  // Menu mobile : fermé automatiquement si l'écran passe en format ordinateur.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onChange = () => desktop.matches && setOpen(false);
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);
  return (
    <div className="min-h-dvh lg:pl-64 print:pl-0">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent profile={profile} brand={brand} group="desktop" />
      </aside>

      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Ouvrir le menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-none p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SidebarContent profile={profile} brand={brand} onNavigate={() => setOpen(false)} group="mobile" />
          </SheetContent>
        </Sheet>
        <Logo logoUrl={brand.logoUrl} name={brand.name} size={30} />
        <span className="truncate text-sm font-semibold">{brand.name}</span>
      </header>

      <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
