'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface UseDragResizeOptions {
  onDrag: (deltaSeconds: number) => void;
  onDragEnd?: () => void;
  pixelsPerSecond: number;
  minValue?: number;
  maxValue?: number;
}

export function useDragResize({
  onDrag,
  onDragEnd,
  pixelsPerSecond,
}: UseDragResizeOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number>(0);
  const lastDeltaRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      startXRef.current = e.clientX;
      lastDeltaRef.current = 0;
    },
    []
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaPixels = e.clientX - startXRef.current;
      const deltaSeconds = deltaPixels / pixelsPerSecond;

      // 변화량만 전달 (누적 아님)
      const actualDelta = deltaSeconds - lastDeltaRef.current;
      lastDeltaRef.current = deltaSeconds;

      onDrag(actualDelta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      onDragEnd?.();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, pixelsPerSecond, onDrag, onDragEnd]);

  return {
    isDragging,
    handleMouseDown,
  };
}
