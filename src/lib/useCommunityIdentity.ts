'use client';

import { useEffect, useMemo, useState } from 'react';

const KEY = 'icc_community_identity_v1';

export type CommunityIdentity = {
  deviceId: string;     // identifiant local (pour limiter spam + signature soft)
  displayName: string;  // pseudo/nom
};

function makeDeviceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function useCommunityIdentity() {
  const [identity, setIdentity] = useState<CommunityIdentity | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        setIdentity(JSON.parse(raw));
        return;
      }
      const init: CommunityIdentity = { deviceId: makeDeviceId(), displayName: '' };
      localStorage.setItem(KEY, JSON.stringify(init));
      setIdentity(init);
    } catch {
      setIdentity({ deviceId: makeDeviceId(), displayName: '' });
    }
  }, []);

  const updateName = (displayName: string) => {
    setIdentity((prev) => {
      const next = { ...(prev ?? { deviceId: makeDeviceId(), displayName: '' }), displayName };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return useMemo(() => ({ identity, updateName }), [identity]);
}