const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

function parseUrlList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseIceServersJson(raw: string | undefined): RTCIceServer[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const servers = parsed
      .filter((item) => item && typeof item === 'object' && 'urls' in item)
      .map((item) => item as RTCIceServer);
    return servers.length ? servers : null;
  } catch {
    return null;
  }
}

export function getWebRtcIceServers(): RTCIceServer[] {
  const fromJson = parseIceServersJson(process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS_JSON);
  if (fromJson?.length) return fromJson;

  const stunUrls = parseUrlList(process.env.NEXT_PUBLIC_WEBRTC_STUN_URLS);
  const turnUrls = parseUrlList(
    process.env.NEXT_PUBLIC_WEBRTC_TURN_URLS || process.env.NEXT_PUBLIC_WEBRTC_TURN_URL
  );

  const username = (process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME || '').trim();
  const credential = (process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL || '').trim();

  const servers: RTCIceServer[] = [];
  servers.push({ urls: stunUrls.length ? stunUrls : DEFAULT_STUN_URLS });

  if (turnUrls.length) {
    const turnServer: RTCIceServer = { urls: turnUrls };
    if (username && credential) {
      turnServer.username = username;
      turnServer.credential = credential;
    }
    servers.push(turnServer);
  }

  return servers;
}
