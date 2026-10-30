import Image from 'next/image';
import { cn } from '@/lib/utils';

// Logo officiel : celui téléversé dans Paramètres (Supabase Storage).
// Tant qu'aucun logo n'est téléversé, un monogramme neutre « MG » est affiché
// (ce n'est pas le logo officiel).
export function Logo({
  logoUrl,
  name,
  size = 40,
  className,
}: {
  logoUrl: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={`Logo ${name}`}
        width={size}
        height={size}
        className={cn('shrink-0 object-contain', className)}
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <span
      aria-label={`Logo ${name}`}
      role="img"
      className={cn('inline-flex shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      MG
    </span>
  );
}
