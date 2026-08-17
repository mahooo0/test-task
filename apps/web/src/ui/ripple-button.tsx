'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { type HTMLMotionProps, motion } from 'motion/react';
import { type ComponentPropsWithoutRef, forwardRef, useCallback, useRef, useState } from 'react';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const rippleButtonVariants = cva(
  "relative inline-flex cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-lg text-sm font-medium outline-none transition-[box-shadow,color,background-color,border-color] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        outline: 'border border-border bg-background text-foreground shadow-sm',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-muted hover:text-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 gap-1.5',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type Ripple = { id: number; x: number; y: number };

export interface RippleButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'>,
    VariantProps<typeof rippleButtonVariants> {
  children?: ComponentPropsWithoutRef<'button'>['children'];
  hoverScale?: number;
  tapScale?: number;
  rippleColor?: string;
  rippleOpacity?: number;
}

export const RippleButton = forwardRef<HTMLButtonElement, RippleButtonProps>(function RippleButton(
  {
    className,
    variant,
    size,
    children,
    onClick,
    hoverScale = 1.02,
    tapScale = 0.97,
    rippleColor = 'currentColor',
    rippleOpacity = 0.2,
    disabled,
    ...rest
  },
  ref,
) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const setRefs = useCallback(
    (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as { current: HTMLButtonElement | null }).current = node;
    },
    [ref],
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const btn = buttonRef.current;
      if (btn && !disabled) {
        const rect = btn.getBoundingClientRect();
        const id = Date.now() + Math.random();
        const ripple = { id, x: event.clientX - rect.left, y: event.clientY - rect.top };
        setRipples((prev) => [...prev, ripple]);
        window.setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 650);
      }
      onClick?.(event);
    },
    [disabled, onClick],
  );

  return (
    <motion.button
      ref={setRefs}
      type="button"
      onClick={handleClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: hoverScale }}
      whileTap={disabled ? undefined : { scale: tapScale }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(rippleButtonVariants({ variant, size }), className)}
      {...rest}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      {ripples.map((r) => (
        <motion.span
          key={r.id}
          initial={{ scale: 0, opacity: rippleOpacity }}
          animate={{ scale: 12, opacity: 0 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="pointer-events-none absolute size-5 rounded-full"
          style={{ top: r.y - 10, left: r.x - 10, backgroundColor: rippleColor }}
        />
      ))}
    </motion.button>
  );
});
