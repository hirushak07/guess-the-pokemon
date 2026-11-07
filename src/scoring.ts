export const ROUND_SECONDS = 10;
export const ROUND_COUNT = 5;
export const ROUND_MAX_POINTS = 1000;
export const GAME_MAX_POINTS = ROUND_COUNT * ROUND_MAX_POINTS;

export function pointsForTime(seconds: number) {
  if (seconds <= 0) return 0;
  return Math.ceil(Math.min(seconds / ROUND_SECONDS, 1) * ROUND_MAX_POINTS);
}
