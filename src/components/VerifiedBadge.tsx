import React from 'react';
import { BadgeCheck } from 'lucide-react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  labelText?: string;
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  size = 'sm',
  showLabel = false,
  labelText = 'ভেরিফাইড',
  className = '',
}) => {
  const iconDims =
    size === 'lg' ? 'w-5 h-5' : size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  if (showLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-bold text-[var(--brand-primary)] dark:text-blue-400 ${className}`}
        title="অ্যাডমিন কর্তৃক ভেরিফাইড প্রোফাইল"
      >
        <BadgeCheck className={`${iconDims} fill-[var(--brand-primary)] text-white shrink-0`} />
        <span>{labelText}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center shrink-0 align-middle ${className}`}
      title="অ্যাডমিন কর্তৃক ভেরিফাইড প্রোফাইল"
      aria-label="ভেরিফাইড প্রোফাইল"
    >
      <BadgeCheck className={`${iconDims} fill-[var(--brand-primary)] text-white`} />
    </span>
  );
};
