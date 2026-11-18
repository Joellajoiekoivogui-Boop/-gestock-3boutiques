import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { AutoSubmitForm } from '@/components/app/auto-submit-form';
import { Button } from '@/components/ui/button';
import { addDays, isDay } from '@/lib/dates';
import { cn } from '@/lib/utils';

/**
 * Choix de la journée affichée : veille, lendemain, aujourd'hui ou une date
 * précise. Le jour voyage dans l'adresse (?jour=AAAA-MM-JJ).
 */
export function DayPicker({
  basePath,
  day,
  today,
  keep = {},
}: {
  basePath: string;
  day: string;
  today: string;
  /** Autres paramètres de l'adresse à conserver. */
  keep?: Record<string, string | undefined>;
}) {
  const href = (target: string) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(keep)) if (value) params.set(key, value);
    if (target !== today) params.set('jour', target);
    return `${basePath}${params.size ? `?${params}` : ''}`;
  };
  const isToday = day === today;
  const navClass = 'h-11 rounded-full';
  return (
    <div role="group" aria-label="Journée affichée" className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="icon" className={cn(navClass, 'w-11')}>
        <Link href={href(addDays(day, -1))} aria-label="Jour précédent">
          <ChevronLeft aria-hidden />
        </Link>
      </Button>
      <AutoSubmitForm method="get" action={basePath} delay={0} className="flex items-center">
        {Object.entries(keep).map(([key, value]) =>
          value ? <input key={key} type="hidden" name={key} value={value} /> : null,
        )}
        <label className="relative flex items-center">
          <span className="sr-only">Choisir une date</span>
          <CalendarDays className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" aria-hidden />
          <input
            type="date"
            name="jour"
            defaultValue={day}
            max={today}
            className="h-11 rounded-full border bg-card pr-3 pl-10 text-[15px] font-semibold tabular-nums shadow-card"
          />
        </label>
      </AutoSubmitForm>
      <Button
        asChild={!isToday}
        variant="outline"
        size="icon"
        className={cn(navClass, 'w-11')}
        disabled={isToday}
        aria-label="Jour suivant"
      >
        {isToday ? (
          <ChevronRight aria-hidden />
        ) : (
          <Link href={href(addDays(day, 1))}>
            <ChevronRight aria-hidden />
          </Link>
        )}
      </Button>
      {!isToday && (
        <Button asChild variant="ghost" className={navClass}>
          <Link href={href(today)}>Revenir à aujourd’hui</Link>
        </Button>
      )}
    </div>
  );
}

/** Jour demandé dans l'adresse, borné à aujourd'hui (jamais dans le futur). */
export function parseDay(value: unknown, today: string): string {
  return isDay(value) && value <= today && value >= '2000-01-01' ? value : today;
}
