import React, { useMemo, useState } from 'react';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  className?: string;
  alt?: string;
}

function initialsFromName(name?: string | null) {
  if (!name?.trim()) return 'CP';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'CP';
}

export default function UserAvatar({ src, name, className = 'w-8 h-8', alt }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = useMemo(() => initialsFromName(name), [name]);
  const usableSrc = src && src.trim() && !failed ? src : null;

  if (usableSrc) {
    return (
      <img
        src={usableSrc}
        alt={alt || name || 'User avatar'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className} rounded-full object-cover bg-civic-primary/20 border border-civic-accent/50 shadow-sm`}
      />
    );
  }

  return (
    <div
      title={name || 'User'}
      className={`${className} rounded-full bg-civic-primary text-white border border-civic-accent/50 shadow-sm flex items-center justify-center font-bold font-mono text-[10px]`}
    >
      {initials}
    </div>
  );
}
