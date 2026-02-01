'use client';

import { useRef, useState, useEffect, useCallback, RefObject } from 'react';
import { Rally } from '@/lib/api';
import { VideoPlayerRef } from '@/components/VideoPlayer';
import { useRallyEditor } from '@/hooks/useRallyEditor';
import { useKeyboardEdit } from '@/hooks/useKeyboardEdit';
import { useAutoSave } from '@/hooks/useAutoSave';
import TimeRuler from './TimeRuler';
import TimelineTrack from './TimelineTrack';
import KeyboardHint from './KeyboardHint';
import TimelineControls from './TimelineControls';
import { Plus, Undo2, RotateCcw, Save, Cloud, Copy, Check } from 'lucide-react';

interface TimelineEditorProps {
  videoId: string;
  initialRallies: Rally[];
  videoDuration: number;
  currentTime: number;
  videoPlayerRef: RefObject<VideoPlayerRef | null>;
  onRalliesChange: (rallies: Rally[]) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

export default function TimelineEditor({
  videoId,
  initialRallies,
  videoDuration,
  currentTime,
  videoPlayerRef,
  onRalliesChange,
}: TimelineEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isAddingRally, setIsAddingRally] = useState(false);
  const [newRallyStart, setNewRallyStart] = useState<number | null>(null);
  const [csvCopied, setCsvCopied] = useState(false);

  const {
    rallies,
    hasChanges,
    addRally,
    deleteRally,
    updateRally,
    undo,
    canUndo,
    revertAll,
    setRallies,
  } = useRallyEditor(initialRallies);

  // 자동 저장
  const { lastSavedAt, isSaving, hasSavedData, savedRallies, clearSaved } = useAutoSave({
    videoId,
    rallies,
    debounceMs: 500,
    enabled: true,
  });

  // 저장된 데이터 복원 여부 확인
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const restoreChecked = useRef(false);

  useEffect(() => {
    if (hasSavedData && savedRallies && !restoreChecked.current) {
      // 저장된 데이터가 현재 데이터와 다른지 확인
      const isDifferent = JSON.stringify(savedRallies) !== JSON.stringify(initialRallies);
      console.log('[Restore] hasSavedData:', hasSavedData, 'isDifferent:', isDifferent);
      console.log('[Restore] savedRallies:', savedRallies?.length, 'initialRallies:', initialRallies.length);
      if (isDifferent) {
        setShowRestorePrompt(true);
      }
      restoreChecked.current = true;
    }
  }, [hasSavedData, savedRallies, initialRallies]);

  const handleRestore = () => {
    if (savedRallies) {
      setRallies(savedRallies);
    }
    setShowRestorePrompt(false);
  };

  const handleDiscardSaved = () => {
    clearSaved();
    setShowRestorePrompt(false);
  };

  // CSV 복사
  const handleCopyCSV = useCallback(() => {
    const videoName = `${videoId}.mp4`;
    const csv = rallies
      .map((r) => `${videoName},${r.startTime.toFixed(2)},${r.endTime.toFixed(2)},rally`)
      .join('\n');

    navigator.clipboard.writeText(csv).then(() => {
      setCsvCopied(true);
      setTimeout(() => setCsvCopied(false), 2000);
    });
  }, [videoId, rallies]);

  // 실제 트랙 너비 = 컨테이너 너비 * 줌
  const trackWidth = (containerWidth - 32) * zoom;

  // 랠리 변경 시 부모에 알림
  useEffect(() => {
    onRalliesChange(rallies);
  }, [rallies, onRalliesChange]);

  // 컨테이너 너비 측정
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // 현재 시간에 맞춰 스크롤 (재생 중)
  useEffect(() => {
    if (scrollContainerRef.current && zoom > 1) {
      const scrollContainer = scrollContainerRef.current;
      const currentPosition = (currentTime / videoDuration) * trackWidth;
      const containerCenter = scrollContainer.clientWidth / 2;

      // 현재 위치가 화면 밖으로 나가면 스크롤
      const scrollLeft = scrollContainer.scrollLeft;
      const scrollRight = scrollLeft + scrollContainer.clientWidth;

      if (currentPosition < scrollLeft + 50 || currentPosition > scrollRight - 50) {
        scrollContainer.scrollLeft = currentPosition - containerCenter;
      }
    }
  }, [currentTime, trackWidth, videoDuration, zoom]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev * 1.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev / 1.5));
  }, []);

  const handleFitToView = useCallback(() => {
    setZoom(1);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, []);

  // 마우스 휠로 줌
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    }
  }, [handleZoomIn, handleZoomOut]);

  const handleSeek = useCallback((time: number) => {
    videoPlayerRef.current?.seekToWithPreview(time);
  }, [videoPlayerRef]);

  const handleTogglePlay = useCallback(() => {
    videoPlayerRef.current?.togglePlay();
  }, [videoPlayerRef]);

  const handleSelectPrev = useCallback(() => {
    if (rallies.length === 0) return;
    if (selectedIndex === null) {
      setSelectedIndex(rallies.length - 1);
    } else {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
  }, [rallies.length, selectedIndex]);

  const handleSelectNext = useCallback(() => {
    if (rallies.length === 0) return;
    if (selectedIndex === null) {
      setSelectedIndex(0);
    } else {
      setSelectedIndex(Math.min(rallies.length - 1, selectedIndex + 1));
    }
  }, [rallies.length, selectedIndex]);

  const handleDelete = useCallback((index: number) => {
    if (confirm(`Rally #${rallies[index]?.rallyIndex}을 삭제하시겠습니까?`)) {
      deleteRally(index);
      if (selectedIndex === index) {
        setSelectedIndex(null);
      } else if (selectedIndex !== null && selectedIndex > index) {
        setSelectedIndex(selectedIndex - 1);
      }
    }
  }, [rallies, deleteRally, selectedIndex]);

  const handleAddNew = useCallback(() => {
    if (isAddingRally) {
      // 종료: 새 랠리 추가
      if (newRallyStart !== null && currentTime > newRallyStart) {
        addRally(newRallyStart, currentTime);
        setSelectedIndex(rallies.length); // 새로 추가된 랠리 선택
      }
      setIsAddingRally(false);
      setNewRallyStart(null);
    } else {
      // 시작: 현재 시간 기록
      setNewRallyStart(currentTime);
      setIsAddingRally(true);
    }
  }, [isAddingRally, newRallyStart, currentTime, addRally, rallies.length]);

  // 키보드 편집 훅
  useKeyboardEdit({
    selectedIndex,
    rallies,
    videoDuration,
    onUpdate: updateRally,
    onSeek: handleSeek,
    onDelete: handleDelete,
    onSelectPrev: handleSelectPrev,
    onSelectNext: handleSelectNext,
    onTogglePlay: handleTogglePlay,
    onAddNew: handleAddNew,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    enabled: true,
  });

  const selectedRally = selectedIndex !== null ? rallies[selectedIndex] : null;

  // 변경 개수 계산
  const changeCount = rallies.reduce((count, rally) => {
    const original = initialRallies.find((r) => r.rallyIndex === rally.rallyIndex);
    if (!original || original.startTime !== rally.startTime || original.endTime !== rally.endTime) {
      return count + 1;
    }
    return count;
  }, 0) + initialRallies.filter(
    (original) => !rallies.some((r) => r.rallyIndex === original.rallyIndex)
  ).length;

  return (
    <div
      ref={containerRef}
      className="space-y-2 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800"
    >
      {/* 도구 모음 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddNew}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${isAddingRally
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-lime-500 text-black hover:bg-lime-400'
              }
            `}
          >
            <Plus className="w-4 h-4" />
            {isAddingRally ? '종료 & 추가' : '새 랠리'}
          </button>

          {isAddingRally && newRallyStart !== null && (
            <span className="text-sm text-zinc-400">
              시작: {newRallyStart.toFixed(1)}s → 현재: {currentTime.toFixed(1)}s
            </span>
          )}

          <div className="w-px h-6 bg-zinc-700" />

          <button
            onClick={handleCopyCSV}
            disabled={rallies.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 transition-colors"
          >
            {csvCopied ? (
              <>
                <Check className="w-4 h-4 text-lime-400" />
                <span className="text-lime-400">복사됨</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>CSV 복사</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <TimelineControls
            zoom={zoom}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToView={handleFitToView}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
          />

          <div className="w-px h-6 bg-zinc-700" />

          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-zinc-300"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (confirm('모든 변경 사항을 되돌리시겠습니까?')) {
                revertAll();
              }
            }}
            disabled={!hasChanges}
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm text-zinc-300"
            title="전체 되돌리기"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {changeCount > 0 && (
            <span className="text-sm text-lime-400">
              변경: {changeCount}건
            </span>
          )}

          {/* 자동 저장 상태 */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            {isSaving ? (
              <>
                <Save className="w-3 h-3 animate-pulse" />
                <span>저장 중...</span>
              </>
            ) : lastSavedAt ? (
              <>
                <Cloud className="w-3 h-3 text-lime-500" />
                <span>자동 저장됨</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* 저장된 데이터 복원 프롬프트 */}
      {showRestorePrompt && (
        <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <span className="text-sm text-yellow-400">
            이전에 저장된 편집 내역이 있습니다. 복원하시겠습니까?
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleRestore}
              className="px-3 py-1 text-sm bg-yellow-500 text-black rounded hover:bg-yellow-400"
            >
              복원
            </button>
            <button
              onClick={handleDiscardSaved}
              className="px-3 py-1 text-sm bg-zinc-700 text-white rounded hover:bg-zinc-600"
            >
              무시
            </button>
          </div>
        </div>
      )}

      {/* 스크롤 가능한 타임라인 영역 */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto"
        onWheel={handleWheel}
      >
        <div style={{ width: trackWidth }}>
          {/* 시간 눈금 */}
          <TimeRuler
            duration={videoDuration}
            trackWidth={trackWidth}
            onSeek={handleSeek}
          />

          {/* 타임라인 트랙 */}
          <TimelineTrack
            rallies={rallies}
            duration={videoDuration}
            trackWidth={trackWidth}
            currentTime={currentTime}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onUpdate={updateRally}
            onSeek={handleSeek}
          />
        </div>
      </div>

      {/* 키보드 힌트 */}
      <KeyboardHint
        selectedRally={selectedRally}
        selectedIndex={selectedIndex}
      />
    </div>
  );
}
