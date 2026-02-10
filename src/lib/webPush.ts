// src/lib/webPush.ts
import webPush, { type PushSubscription } from 'web-push';

let configured = false;

function ensureConfigured() {
  if (configured) return true;

  const subject = (process.env.VAPID_SUBJECT || '').trim();
  const publicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();

  if (!subject || !publicKey || !privateKey) return false;

  webPush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function hasWebPushConfig() {
  return ensureConfigured();
}

export function getVapidPublicKey() {
  return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
}

export async function sendWebPush(
  subscription: PushSubscription,
  payload: Record<string, unknown>
) {
  if (!ensureConfigured()) {
    throw new Error('VAPID config missing');
  }
  return webPush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 60,
  });
}