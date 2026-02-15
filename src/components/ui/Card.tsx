import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <motion.div
      whileHover={{ y: -2, borderColor: 'var(--color-border-hover)' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClick}
      className={`bg-bg-secondary border border-border rounded-2xl p-6 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}
