'use client';

import { Rally } from '@/lib/api';
import { formatTime } from '@/lib/time-utils';

interface KeyboardHintProps {
  selectedRally: Rally | null;
  selectedIndex: number | null;
}

export default function KeyboardHint({ selectedRally, selectedIndex }: KeyboardHintProps) {
  if (!selectedRally) {
    return (
      <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg text-sm">
        <span className="text-zinc-500">랠리를 선택하세요</span>
        <div className="flex gap-4 text-zinc-500">
          <span><kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs">↑↓</kbd> 선택</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs">N</kbd> 새 랠리</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs">+</kbd><kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs ml-0.5">-</kbd> 줌</span>
          <span><kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs">Space</kbd> 재생</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg text-sm">
      <div className="flex items-center gap-4">
        <span className="text-lime-400 font-medium">
          Rally #{selectedRally.rallyIndex}
        </span>
        <span className="text-zinc-400 font-mono">
          {formatTime(selectedRally.startTime, true)} - {formatTime(selectedRally.endTime, true)}
        </span>
        <span className="text-zinc-500">
          ({selectedRally.duration.toFixed(1)}s)
        </span>
      </div>

      <div className="flex gap-4 text-zinc-400">
        <span>
          <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs">A</kbd>
          <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs ml-0.5">D</kbd>
          <span className="ml-1 text-zinc-500">시작점</span>
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs">←</kbd>
          <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs ml-0.5">→</kbd>
          <span className="ml-1 text-zinc-500">끝점</span>
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs">Shift</kbd>
          <span className="ml-1 text-zinc-500">10배</span>
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs">+</kbd>
          <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs ml-0.5">-</kbd>
          <span className="ml-1 text-zinc-500">줌</span>
        </span>
      </div>
    </div>
  );
}
