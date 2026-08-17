'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useReducedMotion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/**
 * Empty-state illustration — the animated "empty area" Lottie, served from
 * `public/lottie/upload-art.lottie` and rendered by dotLottie.
 *
 * Honours `prefers-reduced-motion`: instead of autoplaying/looping, it freezes on
 * the final (fully-revealed) frame so reduced-motion users still see the complete
 * artwork with zero movement.
 */
export function UploadArt({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const t = useTranslations('items');

  return (
    <div role="img" aria-label={t('emptyArtAlt')} className={cn('size-64', className)}>
      <DotLottieReact
        src="/lottie/upload-art.lottie"
        autoplay={!reduce}
        loop={!reduce}
        // `dot` is typed by the ref-callback prop; no extra import needed. With motion
        // disabled, park the player on its last frame once it has loaded.
        dotLottieRefCallback={(dot) => {
          if (!dot || !reduce) return;
          const settle = () => dot.setFrame(Math.max(0, dot.totalFrames - 1));
          if (dot.isLoaded) settle();
          else dot.addEventListener('load', settle);
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
