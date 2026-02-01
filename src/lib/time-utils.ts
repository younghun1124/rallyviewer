/**
 * 초를 MM:SS.s 형식으로 변환
 * @param seconds 초 단위 시간
 * @param showDecimal 소수점 표시 여부 (기본: true)
 */
export function formatTime(seconds: number, showDecimal: boolean = true): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (showDecimal) {
    return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
  }
  return `${mins}:${Math.floor(secs).toString().padStart(2, '0')}`;
}

/**
 * MM:SS 또는 MM:SS.s 형식을 초로 변환
 * @param timeString 시간 문자열
 * @returns 초 단위 시간 또는 NaN
 */
export function parseTime(timeString: string): number {
  const parts = timeString.split(':');
  if (parts.length !== 2) return NaN;

  const mins = parseInt(parts[0], 10);
  const secs = parseFloat(parts[1]);

  if (isNaN(mins) || isNaN(secs)) return NaN;

  return mins * 60 + secs;
}

/**
 * 초를 소수점 첫째 자리로 반올림
 */
export function roundToDecimal(seconds: number, decimals: number = 1): number {
  const factor = Math.pow(10, decimals);
  return Math.round(seconds * factor) / factor;
}

/**
 * 시간 범위 제한
 */
export function clampTime(time: number, min: number = 0, max?: number): number {
  if (time < min) return min;
  if (max !== undefined && time > max) return max;
  return time;
}
