import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Pagination par liens (?page=N) : fonctionne sans JavaScript et se partage.
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (p > 1) search.set('page', String(p));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-2 px-1 pt-4 text-sm sm:flex-row">
      <p className="text-muted-foreground">
        {total === 0 ? 'Aucun résultat' : `${from}–${to} sur ${total}`}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page - 1)} aria-label="Page précédente">
              <ChevronLeft /> Précédent
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft /> Précédent
          </Button>
        )}
        <span className="tabular-nums text-muted-foreground">
          {page} / {pageCount}
        </span>
        {page < pageCount ? (
          <Button asChild variant="outline" size="sm">
            <Link href={href(page + 1)} aria-label="Page suivante">
              Suivant <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Suivant <ChevronRight />
          </Button>
        )}
      </div>
    </nav>
  );
}

export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 && n < 100_000 ? n : 1;
}
