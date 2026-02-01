'use client';

import { Rally } from '@/lib/api';
import { timeToPixels } from '@/lib/timeline-utils';
import { useDragResize } from '@/hooks/useDragResize';

interface RallyBlockProps {
  rally: Rally;
  index: number;
  isSelected: boolean;
  hasOverlap: boolean;
  duration: number;
  trackWidth: number;
  onUpdate: (updates: Partial<Pick<Rally, 'startTime' | 'endTime'>>) => void;
  onSelect: () => void;
  onSeek: (time: number) => void;
}

export default function RallyBlock({
  rally,
  index,
  isSelected,
  hasOverlap,
  duration,
  trackWidth,
  onUpdate,
  onSelect,
  onSeek,
}: RallyBlockProps) {
  const pixelsPerSecond = trackWidth / duration;

  // 시작점 드래그
  const startDrag = useDragResize({
    pixelsPerSecond,
    onDrag: (delta) => {
      const newStart = Math.max(0, Math.min(rally.endTime - 0.1, rally.startTime + delta));
      onUpdate({ startTime: newStart });
      onSeek(newStart);
    },
  });

  // 끝점 드래그
  const endDrag = useDragResize({
    pixelsPerSecond,
    onDrag: (delta) => {
      const newEnd = Math.max(rally.startTime + 0.1, Math.min(duration, rally.endTime + delta));
      onUpdate({ endTime: newEnd });
      onSeek(newEnd);
    },
  });

  // 전체 이동 드래그
  const moveDrag = useDragResize({
    pixelsPerSecond,
    onDrag: (delta) => {
      const blockDuration = rally.endTime - rally.startTime;
      let newStart = rally.startTime + delta;
      let newEnd = rally.endTime + delta;

      // 범위 제한
      if (newStart < 0) {
        newStart = 0;
        newEnd = blockDuration;
      }
      if (newEnd > duration) {
        newEnd = duration;
        newStart = duration - blockDuration;
      }

      onUpdate({ startTime: newStart, endTime: newEnd });
      onSeek(newStart);
    },
  });

  const left = timeToPixels(rally.startTime, trackWidth, duration);
  const width = timeToPixels(rally.endTime - rally.startTime, trackWidth, duration);

  const isDragging = startDrag.isDragging || endDrag.isDragging || moveDrag.isDragging;

  return (
    <div
      className={`
        absolute top-1 bottom-1 rounded-md transition-shadow
        ${isSelected ? 'ring-2 ring-white z-10' : 'z-0'}
        ${hasOverlap ? 'bg-amber-500/60' : 'bg-lime-500/60'}
        ${isDragging ? 'opacity-80' : ''}
      `}
      style={{ left, width: Math.max(width, 20) }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* 시작점 핸들 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-l-md"
        onMouseDown={startDrag.handleMouseDown}
      />

      {/* 중앙 영역 (이동 + 표시) */}
      <div
        className={`
          absolute left-2 right-2 top-0 bottom-0 flex items-center justify-center
          cursor-grab active:cursor-grabbing overflow-hidden
        `}
        onMouseDown={moveDrag.handleMouseDown}
      >
        <span className="text-[10px] font-medium text-black/80 whitespace-nowrap">
          #{rally.rallyIndex}
        </span>
      </div>

      {/* 끝점 핸들 */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 rounded-r-md"
        onMouseDown={endDrag.handleMouseDown}
      />
    </div>
  );
}
