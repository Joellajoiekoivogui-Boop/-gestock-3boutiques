'use client';

import { ChevronDown, LogOut, Menu, ShoppingBag } from 'lucide-react';
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
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { ProfileRow } from '@/lib/database.types';
import { ROLE_LABELS } from '@/lib/permissions';
import { cn } from '@/lib/utils';

type ShellProps = {
  profile: Pick<ProfileRow, 'full_name' | 'email' | 'role' | 'permissions' | 'is_active'>;
  brand: { name: string; logoUrl: string | null };
  children: React.ReactNode;
};

// La caisse et la barre du bas communiquent par ces deux événements : la
// caisse annonce le nombre d'articles, le bouton rond central ouvre le ticket.
export const CART_COUNT_EVENT = 'mg:cart-count';
export const CART_OPEN_EVENT = 'mg:cart-open';

function isActive(pathname: string, href: string) {
  if (href === '/pos') return pathname === '/pos';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ brand }: { brand: ShellProps['brand'] }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Logo logoUrl={brand.logoUrl} name={brand.name} size={42} className="rounded-xl" />
      <span className="block min-w-0 leading-tight md:hidden lg:block">
        <span className="block truncate font-serif text-xl font-bold">{brand.name.replace(/\s+SARL\.?U?$/i, '')}</span>
        <span className="block text-[11px] font-semibold tracking-[0.2em] text-gold-strong uppercase">
          • Hôtellerie — Restaurant •
        </span>
      </span>
    </span>
  );
}

function SignOut({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <form action={signOutAction} className={className}>
      <Button type="submit" variant="ghost" className={cn('w-full justify-start', compact && 'px-3')} aria-label={compact ? 'Se déconnecter' : undefined}>
        <LogOut aria-hidden />
        <span className={compact ? 'sr-only xl:not-sr-only' : undefined}>Se déconnecter</span>
      </Button>
    </form>
  );
}

function BottomTab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold',
        active ? 'text-forest' : 'text-muted-foreground',
      )}
    >
      <Icon className={cn('size-6', active && 'fill-forest/10')} aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function AppShell({ profile, brand, children }: ShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const { primary, manage } = navLayout(profile);
  const name = profile.full_name || profile.email;
  const role = ROLE_LABELS[profile.role];
  const manageActive = manage.find((item) => isActive(pathname, item.href));
  const onPos = pathname === '/pos';

  useEffect(() => {
    const onCount = (event: Event) => setCartCount((event as CustomEvent<number>).detail ?? 0);
    window.addEventListener(CART_COUNT_EVENT, onCount);
    return () => window.removeEventListener(CART_COUNT_EVENT, onCount);
  }, []);

  // Menu mobile : fermé automatiquement si l'écran s'élargit.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)');
    const onChange = () => wide.matches && setMenuOpen(false);
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  // Barre du bas (téléphone) : autant d'emplacements de chaque côté du
  // bouton rond, « Plus » compris, pour qu'il reste au centre.
  const bottomItems = primary.slice(0, 3);
  const slots = bottomItems.length + 1; // + « Plus »
  const half = Math.ceil(slots / 2);
  const left = bottomItems.slice(0, half);
  const right = bottomItems.slice(half);
  const spacers = Math.max(0, left.length - (right.length + 1));

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="no-print sticky top-0 z-30 border-b bg-card/95 backdrop-blur-sm">
        <div className="flex h-[4.5rem] items-center gap-3 px-4 sm:px-6">
          <Link href={primary[0]?.href ?? '/pos'} className="shrink-0">
            <Brand brand={brand} />
          </Link>

          <nav
            aria-label="Navigation principale"
            className="mx-auto hidden items-center gap-1 rounded-full bg-muted p-1 md:flex"
          >
            {primary.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors lg:px-4',
                    active ? 'bg-forest text-forest-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
            {manage.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    'inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40',
                    manageActive ? 'bg-forest text-forest-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {manageActive ? manageActive.label : 'Gestion'}
                  <ChevronDown className="size-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="min-w-60 rounded-xl p-1.5">
                  {manage.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.href} asChild className="h-11 gap-3 rounded-lg text-[15px]">
                        <Link href={item.href} aria-current={isActive(pathname, item.href) ? 'page' : undefined}>
                          <Icon className="size-5 text-forest" aria-hidden />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            <div className="hidden text-right leading-tight xl:block">
              <p className="max-w-48 truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">{role}</p>
            </div>
            <SignOut compact />
          </div>

        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 print:max-w-none print:p-0">{children}</main>

      {/* Téléphone : barre d'onglets en bas, bouton rond central. */}
      <nav
        aria-label="Navigation rapide"
        className="no-print fixed inset-x-0 bottom-0 z-30 flex h-20 items-stretch border-t bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {left.map((item) => (
          <BottomTab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <div className="flex flex-1 justify-center">
          {onPos ? (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(CART_OPEN_EVENT))}
              aria-label={`Panier (${cartCount})`}
              className="relative -mt-7 flex size-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-full bg-forest text-[11px] font-semibold text-forest-foreground shadow-lg ring-4 ring-card"
            >
              <ShoppingBag className="size-6" aria-hidden />
              Panier
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </button>
          ) : (
            <Link
              href="/pos"
              aria-label="Ouvrir la caisse"
              className="-mt-7 flex size-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-full bg-forest text-[11px] font-semibold text-forest-foreground shadow-lg ring-4 ring-card"
            >
              <ShoppingBag className="size-6" aria-hidden />
              Caisse
            </Link>
          )}
        </div>
        {right.map((item) => (
          <BottomTab key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        {Array.from({ length: spacers }, (_, i) => (
          <span key={`spacer-${i}`} aria-hidden className="flex-1" />
        ))}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold text-muted-foreground"
        >
          <Menu className="size-6" aria-hidden />
          Plus
        </button>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-80 gap-0 p-0">
          <SheetTitle className="border-b px-5 py-4 text-left">
            <span className="block font-serif text-xl font-bold">{name}</span>
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
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold',
                        active ? 'bg-forest text-forest-foreground' : 'hover:bg-muted',
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
  );
}
