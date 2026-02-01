import { Rally } from './api';

/**
 * 랠리를 시작 시간 순으로 정렬
 */
export function sortRallies(rallies: Rally[]): Rally[] {
  return [...rallies].sort((a, b) => a.startTime - b.startTime);
}

/**
 * 랠리 인덱스 재정렬 (1부터 시작)
 */
export function reindexRallies(rallies: Rally[]): Rally[] {
  return rallies.map((rally, idx) => ({
    ...rally,
    rallyIndex: idx + 1,
  }));
}

/**
 * duration 재계산
 */
export function recalculateDuration(rally: Rally): Rally {
  return {
    ...rally,
    duration: rally.endTime - rally.startTime,
  };
}

/**
 * 중복 구간 탐지 - 각 랠리에 대해 겹치는 랠리 인덱스 반환
 * @returns Map<index, 겹치는 다른 인덱스 배열>
 */
export function findOverlaps(rallies: Rally[]): Map<number, number[]> {
  const overlaps = new Map<number, number[]>();

  for (let i = 0; i < rallies.length; i++) {
    const current = rallies[i];
    const overlapping: number[] = [];

    for (let j = 0; j < rallies.length; j++) {
      if (i === j) continue;
      const other = rallies[j];

      // 두 구간이 겹치는지 확인
      if (!(other.endTime <= current.startTime || other.startTime >= current.endTime)) {
        overlapping.push(j);
      }
    }

    if (overlapping.length > 0) {
      overlaps.set(i, overlapping);
    }
  }

  return overlaps;
}

/**
 * 단일 랠리 유효성 검사
 */
export function validateRally(rally: Rally): string[] {
  const errors: string[] = [];

  if (rally.startTime < 0) {
    errors.push('시작 시간은 0 이상이어야 합니다.');
  }
  if (rally.endTime <= rally.startTime) {
    errors.push('종료 시간은 시작 시간보다 커야 합니다.');
  }
  if (rally.duration <= 0) {
    errors.push('지속 시간은 0보다 커야 합니다.');
  }

  return errors;
}

/**
 * 전체 랠리 목록 유효성 검사
 */
export function validateAllRallies(rallies: Rally[]): {
  isValid: boolean;
  errors: { index: number; messages: string[] }[];
  overlaps: Map<number, number[]>;
} {
  const errors: { index: number; messages: string[] }[] = [];

  rallies.forEach((rally, index) => {
    const messages = validateRally(rally);
    if (messages.length > 0) {
      errors.push({ index, messages });
    }
  });

  const overlaps = findOverlaps(rallies);

  return {
    isValid: errors.length === 0 && overlaps.size === 0,
    errors,
    overlaps,
  };
}

/**
 * 새 랠리 생성 헬퍼
 */
export function createRally(startTime: number, endTime: number): Omit<Rally, 'rallyIndex'> {
  return {
    startTime,
    endTime,
    duration: endTime - startTime,
  };
}
