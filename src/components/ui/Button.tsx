import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';

const variantStyles = {
  primary:
    'bg-accent hover:bg-accent-hover text-bg-primary font-semibold',
  secondary:
    'border border-border hover:border-accent text-text-primary',
  ghost:
    'text-text-secondary hover:text-accent',
} as const;

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
} as const;

type Variant = keyof typeof variantStyles;
type Size = keyof typeof sizeStyles;

type ButtonAsButton = Omit<HTMLMotionProps<'button'>, 'to'> & {
  variant?: Variant;
  size?: Size;
  to?: undefined;
};

type ButtonAsLink = {
  variant?: Variant;
  size?: Size;
  to: string;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
};

type ButtonProps = ButtonAsButton | ButtonAsLink;

export default function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    className = '',
  } = props;

  const classes = `inline-flex items-center justify-center transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  if (props.to !== undefined) {
    const wrapperClass = className.includes('w-full') ? 'block w-full' : 'inline-block';
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        className={wrapperClass}
      >
        <Link
          to={props.to}
          className={classes}
          onClick={props.onClick}
        >
          {props.children}
        </Link>
      </motion.div>
    );
  }

  const { to: _to, variant: _v, size: _s, ...buttonProps } = props as ButtonAsButton;
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={classes}
      {...buttonProps}
    />
  );
}
