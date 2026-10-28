import React, { useState, useEffect } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'card' | 'xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '' }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const getInitials = (fullName: string) => {
    if (!fullName) return 'প';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    card: 'w-20 h-20 sm:w-[84px] sm:h-[84px] text-xl',
    xl: 'w-24 h-24 text-2xl',
  };

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`rounded-full object-cover shrink-0 border-2 border-white/90 shadow-md ${sizeClasses[size]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-br from-[#0B63E5] to-[#1D4ED8] text-white font-bold flex items-center justify-center shrink-0 border-2 border-white/90 shadow-md uppercase tracking-wider ${sizeClasses[size]} ${className}`}
    >
      {getInitials(name)}
    </div>
  );
};
