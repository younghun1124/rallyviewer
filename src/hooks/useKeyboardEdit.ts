'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Rally } from '@/lib/api';

interface UseKeyboardEditOptions {
  selectedIndex: number | null;
  rallies: Rally[];
  videoDuration: number;
  currentTime: number;
  onUpdate: (index: number, updates: Partial<Pick<Rally, 'startTime' | 'endTime'>>) => void;
  onSeek: (time: number) => void;
  onDelete: (index: number) => void;
  onSelectPrev: () => void;
  onSelectNext: () => void;
  onTogglePlay: () => void;
  onAddNew: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  step?: number;
  fastMultiplier?: number;
  enabled?: boolean;
}

const REPEAT_DELAY = 300;    // 첫 반복까지 대기 시간
const REPEAT_INTERVAL = 50;  // 반복 간격 (초당 20회)

// keyCode로 한/영 상관없이 물리적 키 위치 감지
// A키: 65, D키: 68 (시작점 조정)
// Q키: 81, E키: 69 (현재 위치로 시작점/끝점 설정)
// Z키: 90, V키: 86 (재생 위치 1초 이동)
// X키: 88, C키: 67 (재생 위치 0.2초 이동)
const KEY_CODE_MAP: Record<number, string> = {
  65: 'a',   // A키 (ㅁ) - 시작점 감소
  68: 'd',   // D키 (ㅇ) - 시작점 증가
  81: 'q',   // Q키 (ㅂ) - 현재 위치를 시작점으로
  69: 'e',   // E키 (ㄷ) - 현재 위치를 끝점으로
  90: 'z',   // Z키 (ㅋ) - 재생 위치 1초 뒤로
  86: 'v',   // V키 (ㅍ) - 재생 위치 1초 앞으로
  88: 'x',   // X키 (ㅌ) - 재생 위치 0.2초 뒤로
  67: 'c',   // C키 (ㅊ) - 재생 위치 0.2초 앞으로
};

export function useKeyboardEdit({
  selectedIndex,
  rallies,
  videoDuration,
  currentTime,
  onUpdate,
  onSeek,
  onDelete,
  onSelectPrev,
  onSelectNext,
  onTogglePlay,
  onAddNew,
  onZoomIn,
  onZoomOut,
  step = 0.1,
  fastMultiplier = 5,
  enabled = true,
}: UseKeyboardEditOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeKeyRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    activeKeyRef.current = null;
  }, []);

  // currentTime을 ref로 추적 (클로저 문제 방지)
  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const executeAction = useCallback(
    (action: string, isShift: boolean) => {
      // 랠리 편집 액션
      if (action.startsWith('start-') || action.startsWith('end-')) {
        if (selectedIndex === null || !rallies[selectedIndex]) return;

        const rally = rallies[selectedIndex];
        // 기본이 빠름, Shift 누르면 느림 (정밀 조정)
        const currentStep = isShift ? step : step * fastMultiplier;

        switch (action) {
          case 'start-decrease': {
            // 시작점 감소 (A키)
            const newStart = Math.max(0, rally.startTime - currentStep);
            if (newStart < rally.endTime - 0.1) {
              onUpdate(selectedIndex, { startTime: newStart });
              onSeek(newStart);
            }
            break;
          }
          case 'start-increase': {
            // 시작점 증가 (D키)
            const newStart = Math.min(rally.endTime - 0.1, rally.startTime + currentStep);
            onUpdate(selectedIndex, { startTime: newStart });
            onSeek(newStart);
            break;
          }
          case 'end-decrease': {
            // 끝점 감소 (← 화살표)
            const newEnd = Math.max(rally.startTime + 0.1, rally.endTime - currentStep);
            onUpdate(selectedIndex, { endTime: newEnd });
            onSeek(newEnd);
            break;
          }
          case 'end-increase': {
            // 끝점 증가 (→ 화살표)
            const newEnd = Math.min(videoDuration, rally.endTime + currentStep);
            onUpdate(selectedIndex, { endTime: newEnd });
            onSeek(newEnd);
            break;
          }
        }
        return;
      }

      // 재생 위치 이동 액션 (Z/V/X/C)
      const time = currentTimeRef.current;
      switch (action) {
        case 'seek-back-1s': {
          const newTime = Math.max(0, time - 1);
          onSeek(newTime);
          break;
        }
        case 'seek-forward-1s': {
          const newTime = Math.min(videoDuration, time + 1);
          onSeek(newTime);
          break;
        }
        case 'seek-back-02s': {
          const newTime = Math.max(0, time - 0.2);
          onSeek(newTime);
          break;
        }
        case 'seek-forward-02s': {
          const newTime = Math.min(videoDuration, time + 0.2);
          onSeek(newTime);
          break;
        }
      }
    },
    [selectedIndex, rallies, videoDuration, step, fastMultiplier, onUpdate, onSeek]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에서는 무시
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // keyCode로 물리적 키 위치 감지 (한/영 상관없이)
      const physicalKey = KEY_CODE_MAP[e.keyCode];
      const key = e.key.toLowerCase();

      // 반복 가능한 액션 매핑 (A/D, 화살표)
      let action: string | null = null;

      // 반복 가능한 액션 매핑 (A/D, 화살표, Z/V/X/C)
      if (physicalKey === 'a') {
        action = 'start-decrease';
      } else if (physicalKey === 'd') {
        action = 'start-increase';
      } else if (key === 'arrowleft') {
        action = 'end-decrease';
      } else if (key === 'arrowright') {
        action = 'end-increase';
      } else if (physicalKey === 'z') {
        action = 'seek-back-1s';
      } else if (physicalKey === 'v') {
        action = 'seek-forward-1s';
      } else if (physicalKey === 'x') {
        action = 'seek-back-02s';
      } else if (physicalKey === 'c') {
        action = 'seek-forward-02s';
      }

      if (action) {
        e.preventDefault();

        // 이미 같은 액션이 실행 중이면 무시
        if (activeKeyRef.current === action) return;

        clearTimers();
        activeKeyRef.current = action;

        // 즉시 한 번 실행
        executeAction(action, e.shiftKey);

        // 일정 시간 후 반복 시작
        const shiftPressed = e.shiftKey;
        timeoutRef.current = setTimeout(() => {
          intervalRef.current = setInterval(() => {
            executeAction(action!, shiftPressed);
          }, REPEAT_INTERVAL);
        }, REPEAT_DELAY);
        return;
      }

      // Q/E: 현재 위치를 시작점/끝점으로 설정 (단발성)
      if (physicalKey === 'q') {
        e.preventDefault();
        if (selectedIndex !== null && rallies[selectedIndex]) {
          const rally = rallies[selectedIndex];
          // 현재 위치가 끝점보다 앞이어야 함
          if (currentTime < rally.endTime - 0.1) {
            onUpdate(selectedIndex, { startTime: currentTime });
          }
        }
        return;
      }
      if (physicalKey === 'e') {
        e.preventDefault();
        if (selectedIndex !== null && rallies[selectedIndex]) {
          const rally = rallies[selectedIndex];
          // 현재 위치가 시작점보다 뒤이어야 함
          if (currentTime > rally.startTime + 0.1) {
            onUpdate(selectedIndex, { endTime: currentTime });
          }
        }
        return;
      }

      // 단발성 키
      switch (key) {
        case ' ':
          e.preventDefault();
          e.stopPropagation();
          // video 요소에서 포커스 제거 (video controls 간섭 방지)
          if (document.activeElement instanceof HTMLVideoElement) {
            document.activeElement.blur();
          }
          onTogglePlay();
          break;
        case 'delete':
        case 'backspace':
          e.preventDefault();
          if (selectedIndex !== null) {
            onDelete(selectedIndex);
          }
          break;
        case 'arrowup':
          e.preventDefault();
          onSelectPrev();
          break;
        case 'arrowdown':
          e.preventDefault();
          onSelectNext();
          break;
        case 'n':
        case 'ㅜ': // 한글 ㅜ (N키 위치)
          e.preventDefault();
          onAddNew();
          break;
        case '=':
        case '+':
          e.preventDefault();
          onZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          onZoomOut();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const physicalKey = KEY_CODE_MAP[e.keyCode];
      const key = e.key.toLowerCase();

      let action: string | null = null;

      if (physicalKey === 'a') {
        action = 'start-decrease';
      } else if (physicalKey === 'd') {
        action = 'start-increase';
      } else if (key === 'arrowleft') {
        action = 'end-decrease';
      } else if (key === 'arrowright') {
        action = 'end-increase';
      } else if (physicalKey === 'z') {
        action = 'seek-back-1s';
      } else if (physicalKey === 'v') {
        action = 'seek-forward-1s';
      } else if (physicalKey === 'x') {
        action = 'seek-back-02s';
      } else if (physicalKey === 'c') {
        action = 'seek-forward-02s';
      }

      if (activeKeyRef.current === action) {
        clearTimers();
      }
    };

    // 포커스 잃으면 타이머 정리
    const handleBlur = () => {
      clearTimers();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      clearTimers();
    };
  }, [
    enabled,
    selectedIndex,
    executeAction,
    clearTimers,
    onTogglePlay,
    onDelete,
    onSelectPrev,
    onSelectNext,
    onAddNew,
    onZoomIn,
    onZoomOut,
  ]);

  return {
    clearTimers,
  };
}
