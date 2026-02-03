export type CommunityProfile = {
  displayName: string; // pseudo
  avatarSeed?: string; // pour générer une couleur/initiales
};

const KEY = "icc_community_profile_v1";

export function loadCommunityProfile(): CommunityProfile {
  if (typeof window === "undefined") return { displayName: "Invité" };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { displayName: "Invité" };
}

export function saveCommunityProfile(p: CommunityProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
}