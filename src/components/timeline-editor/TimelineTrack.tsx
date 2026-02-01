'use client';

import { Rally } from '@/lib/api';
import { findOverlaps } from '@/lib/rally-utils';
import { pixelsToTime } from '@/lib/timeline-utils';
import RallyBlock from './RallyBlock';
import PlayheadIndicator from './PlayheadIndicator';
import { useMemo } from 'react';

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

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelsToTime(x, trackWidth, duration);
    onSeek(Math.max(0, Math.min(duration, time)));
  };

  return (
    <div
      className="relative h-12 bg-zinc-900 rounded-lg cursor-pointer"
      onClick={handleTrackClick}
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
