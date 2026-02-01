'use client';

import { timeToPixels } from '@/lib/timeline-utils';

interface PlayheadIndicatorProps {
  currentTime: number;
  duration: number;
  trackWidth: number;
}

export default function PlayheadIndicator({
  currentTime,
  duration,
  trackWidth,
}: PlayheadIndicatorProps) {
  const left = timeToPixels(currentTime, trackWidth, duration);

  return (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
      style={{ left }}
    >
      {/* 상단 삼각형 핸들 */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-red-500" />
    </div>
  );
}
