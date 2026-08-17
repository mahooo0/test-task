import { Loader2 } from 'lucide-react';

interface FullPageSpinnerProps {
  /** Localized label — required so no English string can leak in as a default. */
  label: string;
}

export function FullPageSpinner({ label }: FullPageSpinnerProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}
