// IncomingGroupCallModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

export type IncomingCallPayload = {
  callId: string;
  groupId: string;
  groupName?: string;
  fromName?: string; // ex: "Alexi Turner" / "Pasteur ..."
  startedAt?: string; // ISO
};

type Props = {
  open: boolean;
  call?: IncomingCallPayload | null;

  // Action: l'utilisateur accepte l'appel (tu navigues vers la room WebRTC)
  onJoin: (call: IncomingCallPayload) => Promise<void> | void;

  // Action: l'utilisateur refuse / ignore
  onDismiss: (call: IncomingCallPayload) => Promise<void> | void;

  // Optionnel: auto-fermeture si personne ne répond
  timeoutMs?: number; // default 30000 (30s)

  // Optionnel: activer une sonnerie (fichier local /public/ringtone.mp3)
  ringtoneUrl?: string; // ex: "/sounds/ringtone.mp3"
  enableVibrate?: boolean; // default true
};

function formatElapsed(startedAt?: string) {
  if (!startedAt) return "";
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return "";
  const now = Date.now();
  const s = Math.max(0, Math.floor((now - start) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export default function IncomingGroupCallModal({
  open,
  call,
  onJoin,
  onDismiss,
  timeoutMs = 30_000,
  ringtoneUrl,
  enableVibrate = true,
}: Props) {
  const [busy, setBusy] = useState<"join" | "dismiss" | null>(null);
  const [elapsed, setElapsed] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const vibratedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const safeCall = useMemo(() => call ?? null, [call]);

  // Timer "elapsed"
  useEffect(() => {
    if (!open || !safeCall?.startedAt) {
      setElapsed("");
      return;
    }
    const tick = () => setElapsed(formatElapsed(safeCall.startedAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open, safeCall?.startedAt]);

  // Sonnerie + vibration + auto-timeout
  useEffect(() => {
    if (!open || !safeCall) return;

    // Auto-timeout
    if (timeoutMs > 0) {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        // Auto-dismiss si l'appel "sonne" trop longtemps
        void handleDismiss("timeout");
      }, timeoutMs);
    }

    // Vibrate (une fois)
    if (enableVibrate && !vibratedRef.current) {
      try {
        if (navigator.vibrate) {
          navigator.vibrate([200, 120, 200, 120, 300]);
        }
      } catch {
        // ignore
      }
      vibratedRef.current = true;
    }

    // Sonnerie (optionnelle)
    if (ringtoneUrl) {
      const a = new Audio(ringtoneUrl);
      a.loop = true;
      audioRef.current = a;

      // Sur le web, autoplay peut être bloqué.
      // On essaie quand même; si bloqué, l'utilisateur entendra après interaction.
      a.play().catch(() => {
        // ignore
      });
    }

    return () => {
      // cleanup
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      vibratedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, safeCall?.callId]);

  // Stop sonnerie quand on ferme
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  }, [open]);

  async function handleJoin() {
    if (!safeCall || busy) return;
    setBusy("join");
    try {
      // stop ringtone before joining
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      await onJoin(safeCall);
    } finally {
      setBusy(null);
    }
  }

  async function handleDismiss(reason: "user" | "timeout" = "user") {
    if (!safeCall || busy) return;
    setBusy("dismiss");
    try {
      // stop ringtone
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
      await onDismiss(safeCall);

      // (optionnel) tu peux log reason si tu veux
      void reason;
    } finally {
      setBusy(null);
    }
  }

  // Ne rien rendre si fermé
  if (!open || !safeCall) return null;

  const groupTitle = safeCall.groupName ? safeCall.groupName : "Groupe";
  const from = safeCall.fromName ? safeCall.fromName : "Un membre";
  const sub = elapsed ? `Appel entrant • depuis ${elapsed}` : "Appel entrant";

  return (
    <div style={styles.backdrop} role="dialog" aria-modal="true" aria-label="Appel entrant">
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.badge}>📞</div>
          <div style={{ flex: 1 }}>
            <div style={styles.title}>{groupTitle}</div>
            <div style={styles.subtitle}>
              {sub} • de <span style={styles.from}>{from}</span>
            </div>
          </div>
        </div>

        <div style={styles.body}>
          <div style={styles.hint}>
            Rejoindre l’appel maintenant ?
          </div>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => void handleDismiss("user")}
              disabled={busy !== null}
              style={{
                ...styles.btn,
                ...styles.btnSecondary,
                opacity: busy ? 0.7 : 1,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy === "dismiss" ? "..." : "Ignorer"}
            </button>

            <button
              type="button"
              onClick={() => void handleJoin()}
              disabled={busy !== null}
              style={{
                ...styles.btn,
                ...styles.btnPrimary,
                opacity: busy ? 0.7 : 1,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {busy === "join" ? "..." : "Rejoindre"}
            </button>
          </div>

          <div style={styles.footerNote}>
            Astuce : si tu veux une vraie "sonnerie système" même écran éteint,
            il faudra ajouter les notifications push plus tard (optionnel).
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    background: "rgba(18,18,20,0.82)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    overflow: "hidden",
    color: "white",
  },
  header: {
    padding: 16,
    display: "flex",
    gap: 12,
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.85,
    lineHeight: 1.3,
  },
  from: {
    fontWeight: 700,
    opacity: 1,
  },
  body: {
    padding: 16,
  },
  hint: {
    fontSize: 14,
    opacity: 0.95,
    marginBottom: 14,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 10,
  },
  btn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    fontSize: 14,
    fontWeight: 700,
  },
  btnSecondary: {
    background: "rgba(255,255,255,0.10)",
    color: "white",
  },
  btnPrimary: {
    background: "rgba(92, 255, 172, 0.18)", // vert doux
    border: "1px solid rgba(92, 255, 172, 0.35)",
    color: "white",
  },
  footerNote: {
    marginTop: 14,
    fontSize: 12,
    opacity: 0.65,
    lineHeight: 1.35,
  },
};