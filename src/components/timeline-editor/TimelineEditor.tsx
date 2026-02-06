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
import { Plus, Save, Cloud, Copy, Check, Trash2, ClipboardPaste } from 'lucide-react';
import { sortRallies, reindexRallies } from '@/lib/rally-utils';

interface TimelineEditorProps {
  videoId: string;
  initialRallies: Rally[];
  videoDuration: number;
  currentTime: number;
  videoPlayerRef: RefObject<VideoPlayerRef | null>;
  onRalliesChange: (rallies: Rally[]) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 40;

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
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const {
    rallies,
    addRally,
    deleteRally,
    updateRallyLive,
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

  // JSON 붙여넣기 핸들러
  const handleJsonApply = useCallback(() => {
    try {
      let parsed = JSON.parse(jsonText);

      // API 응답 형식이면 rallies 추출
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (parsed.rallies && Array.isArray(parsed.rallies)) {
          parsed = parsed.rallies;
        } else {
          throw new Error('객체에 rallies 배열이 없습니다');
        }
      }

      if (!Array.isArray(parsed)) {
        throw new Error('배열 형식이어야 합니다');
      }

      if (parsed.length === 0) {
        throw new Error('빈 배열입니다');
      }

      // 검증 및 정규화
      const normalized = parsed.map((item: Record<string, unknown>, idx: number) => {
        if (typeof item.startTime !== 'number' || typeof item.endTime !== 'number') {
          throw new Error(`항목 ${idx + 1}: startTime과 endTime은 숫자여야 합니다`);
        }
        if (item.startTime < 0 || item.endTime < 0) {
          throw new Error(`항목 ${idx + 1}: 시간은 0 이상이어야 합니다`);
        }
        if (item.startTime >= item.endTime) {
          throw new Error(`항목 ${idx + 1}: startTime(${item.startTime})은 endTime(${item.endTime})보다 작아야 합니다`);
        }

        return {
          rallyIndex: typeof item.rallyIndex === 'number' ? item.rallyIndex : idx + 1,
          startTime: item.startTime,
          endTime: item.endTime,
          duration: typeof item.duration === 'number' ? item.duration : (item.endTime - item.startTime),
        };
      });

      // 정렬 후 재인덱싱
      const sorted = sortRallies(normalized);
      const reindexed = reindexRallies(sorted);

      // 비디오 길이 초과 경고
      const maxEndTime = Math.max(...reindexed.map(r => r.endTime));
      if (maxEndTime > videoDuration) {
        if (!confirm(`일부 랠리가 비디오 길이(${videoDuration.toFixed(1)}초)를 초과합니다.\n그래도 적용하시겠습니까?`)) {
          return;
        }
      }

      setRallies(reindexed);
      setSelectedIndex(null);
      setIsJsonModalOpen(false);
      setJsonText('');
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : 'JSON 파싱 오류');
    }
  }, [jsonText, videoDuration, setRallies]);

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
    // 재생 중이면 일시정지 후 seek
    if (videoPlayerRef.current && !videoPlayerRef.current.isPaused()) {
      videoPlayerRef.current.pause();
    }
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
    currentTime,
    onUpdate: updateRallyLive,
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

          <div className="w-px h-6 bg-zinc-700" />

          <button
            onClick={() => {
              if (rallies.length === 0) return;
              if (confirm(`정말로 모든 랠리 ${rallies.length}개를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
                setRallies([]);
                setSelectedIndex(null);
              }
            }}
            disabled={rallies.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-300 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>전체 삭제</span>
          </button>

          <div className="w-px h-6 bg-zinc-700" />

          <button
            onClick={() => {
              setJsonText('');
              setJsonError(null);
              setIsJsonModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>JSON 붙여넣기</span>
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

          {/* 자동 저장 상태 */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 w-24">
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
            onUpdate={updateRallyLive}
            onSeek={handleSeek}
          />
        </div>
      </div>

      {/* 키보드 힌트 */}
      <KeyboardHint
        selectedRally={selectedRally}
        selectedIndex={selectedIndex}
      />

      {/* JSON 붙여넣기 모달 */}
      {isJsonModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4 w-full max-w-lg mx-4 shadow-xl">
            <h3 className="text-lg font-medium text-white mb-3">JSON 데이터 붙여넣기</h3>

            <div className="mb-3">
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonError(null);
                }}
                placeholder={`[
  {"startTime": 0.5, "endTime": 5.2},
  {"startTime": 10.0, "endTime": 15.5}
]`}
                className="w-full h-48 bg-zinc-800 text-white text-sm font-mono rounded-lg p-3 border border-zinc-700 focus:outline-none focus:border-lime-500 resize-none"
                autoFocus
              />
            </div>

            {jsonError && (
              <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
                {jsonError}
              </div>
            )}

            <div className="text-xs text-zinc-500 mb-4">
              지원 형식: Rally 배열, startTime/endTime만 있는 간략 형식, {`{ rallies: [...] }`} API 응답 형식
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsJsonModalOpen(false);
                  setJsonText('');
                  setJsonError(null);
                }}
                className="px-4 py-2 text-sm bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleJsonApply}
                disabled={!jsonText.trim()}
                className="px-4 py-2 text-sm bg-lime-500 text-black font-medium rounded-lg hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                적용하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
