export function isNightNow() {
  const h = new Date().getHours();
  // Nuit: 18h -> 6h
  return h >= 18 || h < 6;
}