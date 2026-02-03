'use client';

import { useState } from 'react';

export default function ShareButton({
  title,
  text,
  url,
  className,
}: {
  title: string;
  text?: string;
  url?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const link = url || (typeof window !== 'undefined' ? window.location.href : '');
    if (!link) return;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: link });
        return;
      }
    } catch {
      // fallback to copy
    }

    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      className={className || 'btn-base btn-secondary text-xs px-3 py-2'}
    >
      {copied ? 'Lien copié' : 'Partager'}
    </button>
  );
}
