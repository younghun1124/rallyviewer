/**
 * 시간(초)을 픽셀로 변환
 */
export function timeToPixels(
  seconds: number,
  trackWidth: number,
  duration: number
): number {
  if (duration <= 0) return 0;
  return (seconds / duration) * trackWidth;
}

/**
 * 픽셀을 시간(초)으로 변환
 */
export function pixelsToTime(
  pixels: number,
  trackWidth: number,
  duration: number
): number {
  if (trackWidth <= 0) return 0;
  return (pixels / trackWidth) * duration;
}

/**
 * 시간을 범위 내로 제한
 */
export function clampTime(time: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, time));
}

/**
 * 타임라인 눈금 간격 계산 (duration에 따라 적절한 간격 선택)
 */
export function getTickInterval(duration: number): number {
  if (duration <= 60) return 10;       // 1분 이하: 10초 간격
  if (duration <= 300) return 30;      // 5분 이하: 30초 간격
  if (duration <= 600) return 60;      // 10분 이하: 1분 간격
  return 120;                          // 10분 초과: 2분 간격
}

/**
 * 타임라인 눈금 위치 배열 생성
 */
export function generateTicks(duration: number): number[] {
  const interval = getTickInterval(duration);
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += interval) {
    ticks.push(t);
  }
  return ticks;
}
