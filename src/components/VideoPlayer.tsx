'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';

interface VideoPlayerProps {
    url: string;
    seekTime?: number | null;
    autoPauseTime?: number | null;
    onTimeUpdate?: (currentTime: number) => void;
    onDurationChange?: (duration: number) => void;
    onPauseRequest?: () => void;
    showSpeedControl?: boolean;
    preloadFull?: boolean; // 편집 모드에서 전체 버퍼링
    isInRally?: boolean; // 현재 랠리 구간 안에 있는지
}

export interface VideoPlayerRef {
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (time: number) => void;
    seekToWithPreview: (time: number) => void;
    play: () => void;
    pause: () => void;
    togglePlay: () => void;
    isPaused: () => boolean;
}

const SPEED_OPTIONS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(function VideoPlayer(
    { url, seekTime, autoPauseTime, onTimeUpdate, onDurationChange, onPauseRequest, showSpeedControl = false, preloadFull = false, isInRally = false },
    ref
) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [bufferedPercent, setBufferedPercent] = useState(0);
    const [isBuffering, setIsBuffering] = useState(false);

    useImperativeHandle(ref, () => ({
        getCurrentTime: () => videoRef.current?.currentTime ?? 0,
        getDuration: () => videoRef.current?.duration ?? 0,
        seekTo: (time: number) => {
            if (videoRef.current) {
                videoRef.current.currentTime = time;
            }
        },
        seekToWithPreview: (time: number) => {
            if (videoRef.current) {
                videoRef.current.currentTime = time;
                // pause 상태 유지하며 해당 프레임 표시
            }
        },
        play: () => {
            videoRef.current?.play().catch(() => {});
        },
        pause: () => {
            videoRef.current?.pause();
        },
        togglePlay: () => {
            if (videoRef.current) {
                if (videoRef.current.paused) {
                    videoRef.current.play().catch(() => {});
                } else {
                    videoRef.current.pause();
                }
            }
        },
        isPaused: () => videoRef.current?.paused ?? true,
    }));

    useEffect(() => {
        if (seekTime !== null && seekTime !== undefined && videoRef.current) {
            videoRef.current.currentTime = seekTime;
            videoRef.current.play().catch(() => {
                // Auto-play might be blocked
            });
        }
    }, [seekTime]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const currentTime = videoRef.current.currentTime;

            if (autoPauseTime && currentTime >= autoPauseTime) {
                videoRef.current.pause();
                if (onPauseRequest) onPauseRequest();
            }

            if (onTimeUpdate) {
                onTimeUpdate(currentTime);
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current && onDurationChange) {
            onDurationChange(videoRef.current.duration);
        }
    };

    const handleProgress = () => {
        if (videoRef.current && videoRef.current.buffered.length > 0) {
            const duration = videoRef.current.duration;
            const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
            setBufferedPercent(Math.round((bufferedEnd / duration) * 100));
        }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleCanPlay = () => setIsBuffering(false);

    const handleSpeedChange = (speed: number) => {
        setPlaybackRate(speed);
        if (videoRef.current) {
            videoRef.current.playbackRate = speed;
        }
    };

    return (
        <div className={`relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg ring-4 transition-[box-shadow] duration-150 ${isInRally ? 'ring-lime-500' : 'ring-transparent'}`}>
            <video
                ref={videoRef}
                src={url}
                className="w-full h-full object-contain"
                controls
                preload={preloadFull ? 'auto' : 'metadata'}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onProgress={handleProgress}
                onWaiting={handleWaiting}
                onPlaying={handlePlaying}
                onCanPlay={handleCanPlay}
            />
            {/* 버퍼링 표시 */}
            {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                    <div className="w-12 h-12 border-4 border-lime-500 border-t-transparent rounded-full animate-spin" />
                </div>
            )}
            {/* 버퍼 진행률 (편집 모드) */}
            {preloadFull && bufferedPercent < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
                    <div
                        className="h-full bg-lime-500/50 transition-all duration-300"
                        style={{ width: `${bufferedPercent}%` }}
                    />
                </div>
            )}
            {showSpeedControl && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/70 rounded-lg px-2 py-1">
                    <span className="text-xs text-zinc-400 mr-1">속도</span>
                    {SPEED_OPTIONS.map((speed) => (
                        <button
                            key={speed}
                            onClick={() => handleSpeedChange(speed)}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                playbackRate === speed
                                    ? 'bg-lime-500 text-black font-medium'
                                    : 'text-zinc-300 hover:bg-zinc-700'
                            }`}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
});

export default VideoPlayer;
