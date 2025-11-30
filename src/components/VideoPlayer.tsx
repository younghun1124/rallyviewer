'use client';

import { useEffect, useRef } from 'react';

interface VideoPlayerProps {
    url: string;
    seekTime?: number | null;
    autoPauseTime?: number | null;
    onTimeUpdate?: (currentTime: number) => void;
    onPauseRequest?: () => void;
}

export default function VideoPlayer({ url, seekTime, autoPauseTime, onTimeUpdate, onPauseRequest }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

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

    return (
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
            <video
                ref={videoRef}
                src={url}
                className="w-full h-full object-contain"
                controls
                onTimeUpdate={handleTimeUpdate}
            />
        </div>
    );
}
