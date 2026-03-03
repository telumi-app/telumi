import Link from 'next/link';
import { cn } from '@telumi/ui';

type TelumiLogoProps = {
  href?: string;
  className?: string;
};

export function TelumiLogo({ href = '/login', className }: TelumiLogoProps) {
  return (
    <Link href={href} className={cn('mx-auto inline-flex items-center gap-1.5', className)} aria-label="Telumi">
      <div className="flex gap-0.5">
        <div className="w-1.5 h-5 bg-foreground rounded-full" />
        <div className="w-1.5 h-5 bg-foreground rounded-full" />
      </div>
      <span className="text-xl font-bold tracking-tight text-foreground">Telumi</span>
    </Link>
  );
}
