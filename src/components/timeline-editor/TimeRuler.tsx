'use client';

import { useRef, useCallback } from 'react';
import { formatTime } from '@/lib/time-utils';
import { generateTicks, timeToPixels } from '@/lib/timeline-utils';

interface TimeRulerProps {
  duration: number;
  trackWidth: number;
  onSeek: (time: number) => void;
}

export default function TimeRuler({ duration, trackWidth, onSeek }: TimeRulerProps) {
  const ticks = generateTicks(duration);
  const rulerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const getTimeFromEvent = useCallback((clientX: number) => {
    if (!rulerRef.current) return 0;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(duration, (x / trackWidth) * duration));
  }, [trackWidth, duration]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    const time = getTimeFromEvent(e.clientX);
    onSeek(time);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const time = getTimeFromEvent(moveEvent.clientX);
      onSeek(time);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [getTimeFromEvent, onSeek]);

  return (
    <div
      ref={rulerRef}
      className="relative h-6 bg-zinc-800/50 cursor-pointer select-none"
      onMouseDown={handleMouseDown}
    >
      {ticks.map((tick) => {
        const left = timeToPixels(tick, trackWidth, duration);
        return (
          <div
            key={tick}
            className="absolute top-0 flex flex-col items-center"
            style={{ left }}
          >
            <div className="w-px h-2 bg-zinc-600" />
            <span className="text-[10px] text-zinc-500 mt-0.5">
              {formatTime(tick, false)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
