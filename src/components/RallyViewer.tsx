'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { fetchAnalysis, AnalysisResponse, Rally } from '@/lib/api';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import RallyList from './RallyList';
import TimelineEditor from './timeline-editor/TimelineEditor';
import { Search, Loader2, AlertCircle, CheckCircle2, Clock, Pencil, Eye } from 'lucide-react';

export default function RallyViewer() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [videoId, setVideoId] = useState(searchParams.get('id') || '');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<AnalysisResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeRallyIndex, setActiveRallyIndex] = useState<number | null>(null);
    const [seekTime, setSeekTime] = useState<number | null>(null);
    const [autoPauseTime, setAutoPauseTime] = useState<number | null>(null);

    const [isEditMode, setIsEditMode] = useState(false);
    const [editedRallies, setEditedRallies] = useState<Rally[]>([]);
    const [hasEdited, setHasEdited] = useState(false); // 편집한 적 있는지
    const [showEditedVersion, setShowEditedVersion] = useState(true); // 보기 모드에서 편집본 표시 여부
    const [currentVideoTime, setCurrentVideoTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);

    const pollInterval = useRef<NodeJS.Timeout | null>(null);
    const videoPlayerRef = useRef<VideoPlayerRef>(null);

    // 편집한 적 있고 편집본 보기 선택 시 editedRallies 사용, 아니면 원본 사용
    const currentRallies = (hasEdited && showEditedVersion) ? editedRallies : (data?.rallies || []);

    const performFetch = useCallback(async (id: string) => {
        if (!id.trim()) return;

        setLoading(true);
        setError(null);
        setData(null);
        setActiveRallyIndex(null);
        setAutoPauseTime(null);
        setIsEditMode(false);
        setEditedRallies([]);
        setHasEdited(false);
        setVideoDuration(0);

        try {
            const result = await fetchAnalysis(id);
            setData(result);

            if (result.status === 'processing' || result.status === 'pending') {
                startPolling(id);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const idFromUrl = searchParams.get('id');
        if (idFromUrl && idFromUrl !== data?.videoId) {
            setVideoId(idFromUrl);
            performFetch(idFromUrl);
        }
    }, [searchParams, performFetch]);

    const handleManualFetch = () => {
        if (!videoId.trim()) return;

        const params = new URLSearchParams(searchParams);
        params.set('id', videoId);
        router.replace(`${pathname}?${params.toString()}`);

        performFetch(videoId);
    };

    const startPolling = (id: string) => {
        if (pollInterval.current) clearInterval(pollInterval.current);

        pollInterval.current = setInterval(async () => {
            try {
                const result = await fetchAnalysis(id);
                setData(result);

                if (result.status === 'completed' || result.status === 'failed') {
                    if (pollInterval.current) clearInterval(pollInterval.current);
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 3000);
    };

    useEffect(() => {
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, []);

    const handleEditModeToggle = () => {
        if (!isEditMode) {
            // 편집 모드 진입: 편집한 적 없으면 원본으로 초기화
            if (!hasEdited && data?.rallies) {
                setEditedRallies([...data.rallies]);
            }
        }
        setIsEditMode(!isEditMode);
    };

    const handleRallyClick = (index: number) => {
        const rallies = currentRallies;
        if (!rallies || !rallies[index]) return;
        const rally = rallies[index];
        setSeekTime(rally.startTime);
        setAutoPauseTime(rally.endTime);
        setActiveRallyIndex(index);
    };

    const handleTimeUpdate = (time: number) => {
        setCurrentVideoTime(time);

        // 편집 모드가 아닐 때만 활성 랠리 자동 업데이트
        if (!isEditMode) {
            const rallies = currentRallies;
            if (!rallies) return;

            const current = rallies.findIndex(
                r => time >= r.startTime && time <= r.endTime
            );

            if (current !== -1 && current !== activeRallyIndex) {
                setActiveRallyIndex(current);
            } else if (current === -1 && activeRallyIndex !== null) {
                setActiveRallyIndex(null);
            }
        }
    };

    const handleDurationChange = (duration: number) => {
        setVideoDuration(duration);
    };

    const handleRalliesChange = useCallback((rallies: Rally[]) => {
        setEditedRallies(rallies);
        setHasEdited(true);
    }, []);

    // 편집 모드에서 현재 시간이 랠리 구간 안에 있는지 확인
    const isInRally = isEditMode && editedRallies.some(
        (r) => currentVideoTime >= r.startTime && currentVideoTime <= r.endTime
    );

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8">
            <div className="flex flex-col items-center space-y-4 text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-white">
                    PerfectSwing <span className="text-lime-400">Rally Viewer</span>
                </h1>
                <p className="text-zinc-400 max-w-lg">
                    Enter a Video ID to analyze and view rally extraction results.
                </p>
            </div>

            <div className="flex gap-2 max-w-xl mx-auto w-full">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={videoId}
                        onChange={(e) => setVideoId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleManualFetch()}
                        placeholder="Enter Video ID (e.g., abc123-def456)"
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 transition-all"
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                </div>
                <button
                    onClick={handleManualFetch}
                    disabled={loading || !videoId}
                    className="px-6 py-3 bg-lime-400 hover:bg-lime-300 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold rounded-xl transition-colors flex items-center gap-2"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze'}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {error}
                </div>
            )}

            {data && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-zinc-400">Status</div>
                            <div className={`
                flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
                ${data.status === 'completed' ? 'bg-lime-400/10 text-lime-400' : ''}
                ${data.status === 'processing' ? 'bg-yellow-400/10 text-yellow-400' : ''}
                ${data.status === 'failed' ? 'bg-red-400/10 text-red-400' : ''}
                ${data.status === 'pending' ? 'bg-zinc-400/10 text-zinc-400' : ''}
              `}>
                                {data.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                                {data.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin" />}
                                {data.status === 'failed' && <AlertCircle className="w-4 h-4" />}
                                {data.status === 'pending' && <Clock className="w-4 h-4" />}
                                <span className="capitalize">{data.status}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-zinc-500 font-mono">
                                ID: {data.videoId}
                            </div>
                            {data.status === 'completed' && (
                                <button
                                    onClick={handleEditModeToggle}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                        ${isEditMode
                                            ? 'bg-lime-500/20 text-lime-400 hover:bg-lime-500/30'
                                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                        }
                                    `}
                                >
                                    {isEditMode ? (
                                        <>
                                            <Eye className="w-4 h-4" />
                                            보기 모드
                                        </>
                                    ) : (
                                        <>
                                            <Pencil className="w-4 h-4" />
                                            편집 모드
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {data.status === 'completed' && data.videoUrl && (
                        <>
                            {/* 편집 모드: 세로 레이아웃 */}
                            {isEditMode ? (
                                <div className="space-y-4">
                                    <VideoPlayer
                                        ref={videoPlayerRef}
                                        url={data.videoUrl}
                                        seekTime={seekTime}
                                        autoPauseTime={null}
                                        onTimeUpdate={handleTimeUpdate}
                                        onDurationChange={handleDurationChange}
                                        onPauseRequest={() => setAutoPauseTime(null)}
                                        showSpeedControl={true}
                                        preloadFull={true}
                                        isInRally={isInRally}
                                        showRotateControl={true}
                                    />
                                    {videoDuration > 0 && (
                                        <TimelineEditor
                                            videoId={data.videoId}
                                            initialRallies={hasEdited ? editedRallies : (data.rallies || [])}
                                            videoDuration={videoDuration}
                                            currentTime={currentVideoTime}
                                            videoPlayerRef={videoPlayerRef}
                                            onRalliesChange={handleRalliesChange}
                                        />
                                    )}
                                </div>
                            ) : (
                                /* 보기 모드: 비디오 왼쪽, 랠리 리스트 오른쪽 */
                                <div className="flex gap-4">
                                    <div className="flex-1 min-w-0">
                                        <VideoPlayer
                                            ref={videoPlayerRef}
                                            url={data.videoUrl}
                                            seekTime={seekTime}
                                            autoPauseTime={autoPauseTime}
                                            onTimeUpdate={handleTimeUpdate}
                                            onDurationChange={handleDurationChange}
                                            onPauseRequest={() => setAutoPauseTime(null)}
                                            showSpeedControl={false}
                                        />
                                    </div>
                                    <div className="w-80 flex-shrink-0 bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 flex flex-col max-h-[calc(100vh-200px)]">
                                        <div className="flex items-center justify-between mb-4 flex-shrink-0">
                                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                Rallies <span className="text-zinc-500 text-sm font-normal">({currentRallies.length})</span>
                                            </h3>
                                            {hasEdited && (
                                                <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
                                                    <button
                                                        onClick={() => setShowEditedVersion(false)}
                                                        className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                                                            !showEditedVersion
                                                                ? 'bg-zinc-700 text-white'
                                                                : 'text-zinc-400 hover:text-white'
                                                        }`}
                                                    >
                                                        원본
                                                    </button>
                                                    <button
                                                        onClick={() => setShowEditedVersion(true)}
                                                        className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                                                            showEditedVersion
                                                                ? 'bg-lime-500 text-black'
                                                                : 'text-zinc-400 hover:text-white'
                                                        }`}
                                                    >
                                                        편집본
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="overflow-y-auto flex-1">
                                            <RallyList
                                                rallies={currentRallies}
                                                activeRallyIndex={activeRallyIndex}
                                                onRallyClick={handleRallyClick}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {data.status === 'failed' && (
                        <div className="text-center py-12 text-zinc-500">
                            Analysis failed. Please try another video.
                            {data.error && <div className="mt-2 text-red-400 text-sm">{data.error}</div>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
