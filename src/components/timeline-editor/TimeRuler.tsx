'use client';

import { formatTime } from '@/lib/time-utils';
import { generateTicks, timeToPixels } from '@/lib/timeline-utils';

interface TimeRulerProps {
  duration: number;
  trackWidth: number;
  onSeek: (time: number) => void;
}

export default function TimeRuler({ duration, trackWidth, onSeek }: TimeRulerProps) {
  const ticks = generateTicks(duration);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / trackWidth) * duration;
    onSeek(Math.max(0, Math.min(duration, time)));
  };

  return (
    <div
      className="relative h-6 bg-zinc-800/50 cursor-pointer select-none"
      onClick={handleClick}
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
