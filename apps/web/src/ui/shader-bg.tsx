'use client';

import { Dithering } from '@paper-design/shaders-react';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface ShaderBgProps {
  className?: string;
  style?: CSSProperties;
  colorBack?: string;
  colorFront?: string;
  speed?: number;
  scale?: number;
}

/**
 * Ambient warp pattern with 8x8 Bayer dithering — a pixelated, gradient-like
 * feel. Absolutely fills its parent; place inside a `relative` container.
 * WebGL-based, so it is loaded client-only (see AuthLayout's dynamic import).
 */
export function ShaderBg({
  className,
  style,
  colorBack = '#08090a',
  colorFront = '#e6edf3',
  speed = 0.6,
  scale = 1.2,
}: ShaderBgProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={style}
    >
      <Dithering
        colorBack={colorBack}
        colorFront={colorFront}
        shape="warp"
        type="8x8"
        size={3}
        speed={speed}
        scale={scale}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
