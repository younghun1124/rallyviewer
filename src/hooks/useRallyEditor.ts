'use client';

import { useState, useCallback, useMemo } from 'react';
import { Rally } from '@/lib/api';
import {
  sortRallies,
  reindexRallies,
  recalculateDuration,
  findOverlaps,
  createRally,
} from '@/lib/rally-utils';
import { roundToDecimal } from '@/lib/time-utils';

const MAX_UNDO_STEPS = 20;

export interface UseRallyEditorReturn {
  rallies: Rally[];
  hasChanges: boolean;
  overlaps: Map<number, number[]>;

  addRally: (startTime: number, endTime: number) => void;
  deleteRally: (index: number) => void;
  updateRally: (index: number, updates: Partial<Pick<Rally, 'startTime' | 'endTime'>>) => void;
  // 연속 편집용: 시작 시 한 번만 undo 스택에 저장
  beginEdit: () => void;
  updateRallyLive: (index: number, updates: Partial<Pick<Rally, 'startTime' | 'endTime'>>) => void;
  setRallies: (rallies: Rally[]) => void;

  undo: () => void;
  canUndo: boolean;

  revertAll: () => void;
  applyChanges: () => Rally[];
}

export function useRallyEditor(initialRallies: Rally[]): UseRallyEditorReturn {
  const [originalRallies] = useState<Rally[]>(() => [...initialRallies]);
  const [rallies, setRallies] = useState<Rally[]>(() => [...initialRallies]);
  const [undoStack, setUndoStack] = useState<Rally[][]>([]);

  const pushToUndoStack = useCallback(() => {
    setUndoStack((prev) => {
      const newStack = [...prev, rallies];
      if (newStack.length > MAX_UNDO_STEPS) {
        return newStack.slice(-MAX_UNDO_STEPS);
      }
      return newStack;
    });
  }, [rallies]);

  const addRally = useCallback(
    (startTime: number, endTime: number) => {
      pushToUndoStack();
      const newRally = createRally(
        roundToDecimal(startTime),
        roundToDecimal(endTime)
      );
      setRallies((prev) => {
        const updated = [...prev, { ...newRally, rallyIndex: 0 }];
        return reindexRallies(sortRallies(updated));
      });
    },
    [pushToUndoStack]
  );

  const deleteRally = useCallback(
    (index: number) => {
      pushToUndoStack();
      setRallies((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        return reindexRallies(updated);
      });
    },
    [pushToUndoStack]
  );

  const updateRally = useCallback(
    (index: number, updates: Partial<Pick<Rally, 'startTime' | 'endTime'>>) => {
      pushToUndoStack();
      setRallies((prev) => {
        const updated = prev.map((rally, i) => {
          if (i !== index) return rally;

          const newRally = {
            ...rally,
            startTime: updates.startTime !== undefined
              ? roundToDecimal(updates.startTime)
              : rally.startTime,
            endTime: updates.endTime !== undefined
              ? roundToDecimal(updates.endTime)
              : rally.endTime,
          };
          return recalculateDuration(newRally);
        });
        return reindexRallies(sortRallies(updated));
      });
    },
    [pushToUndoStack]
  );

  // 연속 편집 시작 - undo 스택에 현재 상태 저장
  const beginEdit = useCallback(() => {
    pushToUndoStack();
  }, [pushToUndoStack]);

  // 연속 편집 중 업데이트 - undo 스택에 저장하지 않음
  const updateRallyLive = useCallback(
    (index: number, updates: Partial<Pick<Rally, 'startTime' | 'endTime'>>) => {
      setRallies((prev) => {
        const updated = prev.map((rally, i) => {
          if (i !== index) return rally;

          const newRally = {
            ...rally,
            startTime: updates.startTime !== undefined
              ? roundToDecimal(updates.startTime)
              : rally.startTime,
            endTime: updates.endTime !== undefined
              ? roundToDecimal(updates.endTime)
              : rally.endTime,
          };
          return recalculateDuration(newRally);
        });
        return reindexRallies(sortRallies(updated));
      });
    },
    []
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRallies(previousState);
  }, [undoStack]);

  const revertAll = useCallback(() => {
    setRallies([...originalRallies]);
    setUndoStack([]);
  }, [originalRallies]);

  const applyChanges = useCallback(() => {
    return [...rallies];
  }, [rallies]);

  const hasChanges = useMemo(() => {
    if (rallies.length !== originalRallies.length) return true;
    return rallies.some((rally, index) => {
      const original = originalRallies[index];
      return (
        rally.startTime !== original.startTime ||
        rally.endTime !== original.endTime
      );
    });
  }, [rallies, originalRallies]);

  const overlaps = useMemo(() => findOverlaps(rallies), [rallies]);

  const canUndo = undoStack.length > 0;

  // 외부에서 rallies를 직접 설정 (복원 용도)
  const setRalliesExternal = useCallback((newRallies: Rally[]) => {
    pushToUndoStack();
    setRallies(reindexRallies(sortRallies([...newRallies])));
  }, [pushToUndoStack]);

  return {
    rallies,
    hasChanges,
    overlaps,
    addRally,
    deleteRally,
    updateRally,
    beginEdit,
    updateRallyLive,
    setRallies: setRalliesExternal,
    undo,
    canUndo,
    revertAll,
    applyChanges,
  };
}
