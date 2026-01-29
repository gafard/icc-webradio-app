export type Mode = 'day' | 'night';

export function getAutoMode(): Mode {
  const h = new Date().getHours();
  return h >= 18 || h < 6 ? 'night' : 'day';
}