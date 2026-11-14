'use client';

import { ChevronDown, LogOut, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOutAction } from '@/app/actions/auth';
import { Logo } from '@/components/app/logo';
import { navLayout, type NavItem } from '@/components/app/nav';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

const TONES = [1, 2, 3, 4, 5, 6];

/**
 * Lisière : bandeau noir en tête de l'écran, comme la lisière imprimée d'un
 * pagne. Elle porte l'établissement, la date et la personne connectée, et se
 * termine par les points de couleur des catégories.
 */
function Selvedge({ brand, who }: { brand: string; who: string }) {
  const [today, setToday] = useState('');
  useEffect(() => {
    const format = () =>
      setToday(
        new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Conakry' }).format(
          new Date(),
        ),
      );
    format();
    const timer = window.setInterval(format, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <>
    <div className="flex h-8 items-center gap-4 bg-foreground px-4 font-display text-[13px] font-semibold tracking-[0.14em] text-background uppercase sm:px-6">
      <span className="truncate">{brand}</span>
      <span aria-hidden className="hidden text-background/40 sm:inline">
        ·
      </span>
      <span className="hidden truncate text-background/80 sm:inline">Hôtellerie — Restaurant</span>
      <span className="ml-auto hidden truncate text-background/80 md:inline">{today}</span>
      <span className="hidden truncate lg:inline">{who}</span>
    </div>
    <div aria-hidden className="flex h-1">
      {TONES.map((t) => (
        <span key={t} className="flex-1" style={{ backgroundColor: `var(--cat-${t})` }} />
      ))}
    </div>
    </>
  );
}

function TabLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative inline-flex h-16 shrink-0 items-center gap-2 px-4 text-base font-semibold transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-5" aria-hidden />
      {item.label}
      {active && <span aria-hidden className="absolute inset-x-3 bottom-0 h-1 rounded-t-sm bg-primary" />}
    </Link>
  );
}

function SignOut({ className }: { className?: string }) {
  return (
    <form action={signOutAction} className={className}>
      <Button type="submit" variant="ghost" className="w-full justify-start">
        <LogOut aria-hidden /> Se déconnecter
      </Button>
    </form>
  );
}

export function AppShell({ profile, brand, children }: ShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { primary, manage } = navLayout(profile);
  const name = profile.full_name || profile.email;
  const role = ROLE_LABELS[profile.role];
  const manageActive = manage.find((item) => isActive(pathname, item.href));

  // Menu mobile : fermé automatiquement si l'écran s'élargit.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)');
    const onChange = () => wide.matches && setOpen(false);
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-30">
        <Selvedge brand={brand.name} who={`${name} · ${role}`} />
        <div className="flex h-16 items-center gap-2 border-b bg-card px-2 sm:px-4">
          <Link href={primary[0]?.href ?? '/pos'} className="flex shrink-0 items-center gap-3 px-2">
            <Logo logoUrl={brand.logoUrl} name={brand.name} size={40} />
            <span className="hidden font-display text-xl font-bold xl:inline">MassaGui</span>
          </Link>

          <nav aria-label="Navigation principale" className="hidden min-w-0 flex-1 items-center md:flex">
            {primary.map((item) => (
              <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
            {manage.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    'relative inline-flex h-16 shrink-0 items-center gap-2 px-4 text-base font-semibold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    manageActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {manageActive ? manageActive.label : 'Gestion'}
                  <ChevronDown className="size-4" aria-hidden />
                  {manageActive && <span aria-hidden className="absolute inset-x-3 bottom-0 h-1 rounded-t-sm bg-primary" />}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-60 p-1.5">
                  {manage.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.href} asChild className="h-11 gap-3 text-base">
                        <Link href={item.href} aria-current={isActive(pathname, item.href) ? 'page' : undefined}>
                          <Icon className="size-5" aria-hidden />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          <span className="min-w-0 flex-1 truncate font-display text-xl font-bold md:hidden">MassaGui</span>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            <div className="hidden text-right leading-tight lg:block">
              <p className="max-w-48 truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">{role}</p>
            </div>
            <SignOut />
          </div>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-lg" className="md:hidden" aria-label="Ouvrir le menu">
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 gap-0 p-0">
              <SheetTitle className="border-b px-5 py-4 text-left">
                <span className="block font-display text-xl font-bold">{name}</span>
                <span className="block text-sm font-normal text-muted-foreground">{role}</span>
              </SheetTitle>
              <nav aria-label="Menu" className="flex flex-col overflow-y-auto p-2">
                {[primary, manage].map((group, groupIndex) => (
                  <div key={groupIndex} className={cn('flex flex-col gap-0.5', groupIndex > 0 && 'mt-2 border-t pt-2')}>
                    {group.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex h-12 items-center gap-3 rounded-md px-3 text-base font-semibold',
                            active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                          )}
                        >
                          <Icon className="size-5" aria-hidden />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>
              <SignOut className="mt-auto border-t p-2" />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
