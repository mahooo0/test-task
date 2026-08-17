'use client';

import { type HTMLMotionProps, motion } from 'motion/react';
import logo from '@/assets/logo.webp';
import { cn } from '@/lib/utils';

const BRAND_LAYOUT_ID = 'brand-mark';

type BrandMarkProps = Omit<HTMLMotionProps<'div'>, 'ref'>;

/**
 * The app logo. The shared `layoutId` lets `motion` cross-transform it
 * between mount points (e.g. auth screen → app header).
 */
export function BrandMark({ className, transition, ...rest }: BrandMarkProps) {
  return (
    <motion.div
      layoutId={BRAND_LAYOUT_ID}
      transition={
        transition ?? {
          layout: { type: 'spring', stiffness: 180, damping: 24, mass: 1.05 },
          default: { duration: 0.35, ease: 'easeOut' },
        }
      }
      className={cn('flex items-center justify-center', className)}
      {...rest}
    >
      <img src={logo.src} alt="Data Room" className="h-full w-full object-contain" />
    </motion.div>
  );
}
