'use client';

import { useEffect, useRef } from 'react';

interface VideoPlayerProps {
    url: string;
    seekTime?: number | null;
    onTimeUpdate?: (currentTime: number) => void;
}

export default function VideoPlayer({ url, seekTime, onTimeUpdate }: VideoPlayerProps) {
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
        if (videoRef.current && onTimeUpdate) {
            onTimeUpdate(videoRef.current.currentTime);
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
