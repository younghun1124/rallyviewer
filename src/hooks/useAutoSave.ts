'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Rally } from '@/lib/api';

interface SavedData {
  rallies: Rally[];
  savedAt: number;
}

interface UseAutoSaveOptions {
  videoId: string;
  rallies: Rally[];
  debounceMs?: number;
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  savedRallies: Rally[] | null;
  lastSavedAt: Date | null;
  isSaving: boolean;
  clearSaved: () => void;
  hasSavedData: boolean;
}

const STORAGE_KEY_PREFIX = 'rallyviewer_draft_';

export function useAutoSave({
  videoId,
  rallies,
  debounceMs = 500,
  enabled = true,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // 초기 로드된 데이터 (복원용) - 한번 로드 후 변경하지 않음
  const [initialSavedRallies, setInitialSavedRallies] = useState<Rally[] | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);
  const hasEdited = useRef(false);

  const storageKey = `${STORAGE_KEY_PREFIX}${videoId}`;

  // 저장된 데이터 불러오기 (초기 1회)
  useEffect(() => {
    if (!videoId || initialLoadDone.current) return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data: SavedData = JSON.parse(saved);
        setInitialSavedRallies(data.rallies);
        setLastSavedAt(new Date(data.savedAt));
      }
    } catch (err) {
      console.error('Failed to load saved data:', err);
    }
    initialLoadDone.current = true;
  }, [videoId, storageKey]);

  // debounce로 자동 저장
  useEffect(() => {
    if (!enabled || !videoId || rallies.length === 0) return;

    // 초기 로드 직후에는 저장하지 않음
    if (!initialLoadDone.current) return;

    // 첫 편집이 발생하면 표시
    if (!hasEdited.current) {
      hasEdited.current = true;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsSaving(true);

    timeoutRef.current = setTimeout(() => {
      try {
        const data: SavedData = {
          rallies,
          savedAt: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(data));
        setLastSavedAt(new Date(data.savedAt));
      } catch (err) {
        console.error('Failed to save data:', err);
      }
      setIsSaving(false);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [rallies, videoId, debounceMs, enabled, storageKey]);

  // 저장된 데이터 삭제
  const clearSaved = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setInitialSavedRallies(null);
      setLastSavedAt(null);
    } catch (err) {
      console.error('Failed to clear saved data:', err);
    }
  }, [storageKey]);

  return {
    savedRallies: initialSavedRallies,
    lastSavedAt,
    isSaving,
    clearSaved,
    hasSavedData: initialSavedRallies !== null && initialSavedRallies.length > 0,
  };
}
