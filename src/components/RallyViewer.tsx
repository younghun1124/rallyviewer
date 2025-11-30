'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { fetchAnalysis, AnalysisResponse, Rally } from '@/lib/api';
import VideoPlayer from './VideoPlayer';
import RallyList from './RallyList';
import { Search, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

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

    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    // Extract fetch logic to a reusable function
    const performFetch = useCallback(async (id: string) => {
        if (!id.trim()) return;

        setLoading(true);
        setError(null);
        setData(null);
        setActiveRallyIndex(null);
        setAutoPauseTime(null);

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

    // Handle initial load and URL changes
    useEffect(() => {
        const idFromUrl = searchParams.get('id');
        if (idFromUrl && idFromUrl !== data?.videoId) {
            setVideoId(idFromUrl);
            performFetch(idFromUrl);
        }
    }, [searchParams, performFetch]); // Removed data?.videoId dependency to avoid loops, logic handled inside

    const handleManualFetch = () => {
        if (!videoId.trim()) return;

        // Update URL
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
                // Keep polling on error? Maybe not.
                console.error('Polling error:', err);
            }
        }, 3000); // Poll every 3 seconds
    };

    useEffect(() => {
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, []);

    const handleRallyClick = (index: number) => {
        if (!data?.rallies) return;
        const rally = data.rallies[index];
        setSeekTime(rally.startTime);
        setAutoPauseTime(rally.endTime);
        setActiveRallyIndex(index);
    };

    const handleTimeUpdate = (currentTime: number) => {
        if (!data?.rallies) return;

        // Find current rally
        const current = data.rallies.findIndex(
            r => currentTime >= r.startTime && currentTime <= r.endTime
        );

        if (current !== -1 && current !== activeRallyIndex) {
            setActiveRallyIndex(current);
        } else if (current === -1 && activeRallyIndex !== null) {
            setActiveRallyIndex(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
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
                        <div className="text-sm text-zinc-500 font-mono">
                            ID: {data.videoId}
                        </div>
                    </div>

                    {data.status === 'completed' && data.videoUrl && (
                        <div className="grid lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 space-y-4">
                                <VideoPlayer
                                    url={data.videoUrl}
                                    seekTime={seekTime}
                                    autoPauseTime={autoPauseTime}
                                    onTimeUpdate={handleTimeUpdate}
                                    onPauseRequest={() => setAutoPauseTime(null)}
                                />
                            </div>
                            <div className="lg:col-span-1">
                                <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-4 h-full max-h-[600px] overflow-y-auto">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        Rallies <span className="text-zinc-500 text-sm font-normal">({data.rallies?.length || 0})</span>
                                    </h3>
                                    <RallyList
                                        rallies={data.rallies || []}
                                        activeRallyIndex={activeRallyIndex}
                                        onRallyClick={handleRallyClick}
                                    />
                                </div>
                            </div>
                        </div>
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
