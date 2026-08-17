import logoMark from '@/assets/logo-mark.png';
import { cn } from '@/lib/utils';

interface WordmarkProps {
  className?: string;
}

/**
 * The "Data Room" logo lockup: the chevron mark + the wordmark set in Sora
 * (semibold) in the theme `foreground` colour. Rendered only on the
 * (always-light) auth screens, so the chevron artwork's white background melts
 * away with `mix-blend-multiply`.
 */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img
        src={logoMark.src}
        alt=""
        aria-hidden
        className="h-16 w-16 object-contain mix-blend-multiply"
      />
      <span
        className="text-[26px] font-semibold leading-none tracking-tight text-foreground"
        style={{ fontFamily: 'var(--font-sora), system-ui, sans-serif' }}
      >
        Data Room
      </span>
    </div>
  );
}
