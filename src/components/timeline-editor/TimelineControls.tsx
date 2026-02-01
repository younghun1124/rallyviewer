'use client';

import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface TimelineControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
  minZoom?: number;
  maxZoom?: number;
}

export default function TimelineControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFitToView,
  minZoom = 1,
  maxZoom = 20,
}: TimelineControlsProps) {
  return (
    <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
      <button
        onClick={onZoomOut}
        disabled={zoom <= minZoom}
        className="p-1.5 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300"
        title="축소"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <span className="text-xs text-zinc-400 w-12 text-center">
        {zoom.toFixed(1)}x
      </span>

      <button
        onClick={onZoomIn}
        disabled={zoom >= maxZoom}
        className="p-1.5 rounded hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300"
        title="확대"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-zinc-700 mx-1" />

      <button
        onClick={onFitToView}
        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-300"
        title="전체 보기"
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}
