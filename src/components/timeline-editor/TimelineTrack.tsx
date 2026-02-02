'use client';

import { Rally } from '@/lib/api';
import { findOverlaps } from '@/lib/rally-utils';
import { pixelsToTime } from '@/lib/timeline-utils';
import RallyBlock from './RallyBlock';
import PlayheadIndicator from './PlayheadIndicator';
import { useMemo, useRef, useCallback } from 'react';

interface TimelineTrackProps {
  rallies: Rally[];
  duration: number;
  trackWidth: number;
  currentTime: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onUpdate: (index: number, updates: Partial<Pick<Rally, 'startTime' | 'endTime'>>) => void;
  onSeek: (time: number) => void;
}

export default function TimelineTrack({
  rallies,
  duration,
  trackWidth,
  currentTime,
  selectedIndex,
  onSelect,
  onUpdate,
  onSeek,
}: TimelineTrackProps) {
  const overlaps = useMemo(() => findOverlaps(rallies), [rallies]);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const getTimeFromEvent = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(duration, pixelsToTime(x, trackWidth, duration)));
  }, [trackWidth, duration]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // RallyBlock 클릭 시 무시 (이벤트 버블링)
    if ((e.target as HTMLElement).closest('[data-rally-block]')) return;

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
      ref={trackRef}
      className="relative h-12 bg-zinc-900 rounded-lg cursor-pointer"
      onMouseDown={handleMouseDown}
    >
      {/* 랠리 블록들 */}
      {rallies.map((rally, index) => (
        <RallyBlock
          key={`${rally.rallyIndex}-${index}`}
          rally={rally}
          index={index}
          isSelected={selectedIndex === index}
          hasOverlap={overlaps.has(index)}
          duration={duration}
          trackWidth={trackWidth}
          onUpdate={(updates) => onUpdate(index, updates)}
          onSelect={() => onSelect(index)}
          onSeek={onSeek}
        />
      ))}

      {/* 재생 위치 표시 */}
      <PlayheadIndicator
        currentTime={currentTime}
        duration={duration}
        trackWidth={trackWidth}
      />
    </div>
  );
}
