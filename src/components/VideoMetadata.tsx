'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Film, Info, BarChart3, HardDrive } from 'lucide-react';
import { AnalysisResponse, Rally } from '@/lib/api';
import { VideoMeta } from './VideoPlayer';
import { formatTime } from '@/lib/time-utils';

interface VideoMetadataProps {
    data: AnalysisResponse;
    rallies: Rally[];
    videoDuration: number;
    videoMeta: VideoMeta | null;
    fileSize: number | null; // bytes
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/50 last:border-0">
            <span className="text-zinc-500 text-sm">{label}</span>
            <span className="text-zinc-200 text-sm font-mono">{value}</span>
        </div>
    );
}

export default function VideoMetadata({ data, rallies, videoDuration, videoMeta, fileSize }: VideoMetadataProps) {
    const [isOpen, setIsOpen] = useState(false);

    const totalRallyTime = rallies.reduce((sum, r) => sum + r.duration, 0);
    const avgRallyDuration = rallies.length > 0 ? totalRallyTime / rallies.length : 0;
    const longestRally = rallies.length > 0 ? Math.max(...rallies.map(r => r.duration)) : 0;
    const shortestRally = rallies.length > 0 ? Math.min(...rallies.map(r => r.duration)) : 0;
    const rallyRatio = videoDuration > 0 ? (totalRallyTime / videoDuration) * 100 : 0;

    return (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
            >
                <div className="flex items-center gap-2 text-zinc-300 font-medium text-sm">
                    <Info className="w-4 h-4 text-lime-400" />
                    영상 메타데이터
                </div>
                {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                )}
            </button>

            {isOpen && (
                <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* 기본 정보 */}
                    <div>
                        <div className="flex items-center gap-1.5 mb-2">
                            <Film className="w-3.5 h-3.5 text-lime-400" />
                            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">기본 정보</span>
                        </div>
                        <div className="bg-zinc-900 rounded-lg px-3 py-1">
                            <MetaRow label="Video ID" value={data.videoId} />
                            <MetaRow label="상태" value={
                                <span className={
                                    data.status === 'completed' ? 'text-lime-400' :
                                    data.status === 'processing' ? 'text-yellow-400' :
                                    data.status === 'failed' ? 'text-red-400' : 'text-zinc-400'
                                }>
                                    {data.status}
                                </span>
                            } />
                            {data.createdAt && (
                                <MetaRow label="생성일" value={formatDate(data.createdAt)} />
                            )}
                            {data.updatedAt && (
                                <MetaRow label="수정일" value={formatDate(data.updatedAt)} />
                            )}
                        </div>
                    </div>

                    {/* 비디오 기술 정보 */}
                    {videoDuration > 0 && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <HardDrive className="w-3.5 h-3.5 text-lime-400" />
                                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">비디오 상세</span>
                            </div>
                            <div className="bg-zinc-900 rounded-lg px-3 py-1">
                                <MetaRow label="길이" value={formatTime(videoDuration, false)} />
                                {videoMeta && (
                                    <MetaRow label="해상도" value={`${videoMeta.videoWidth} × ${videoMeta.videoHeight}`} />
                                )}
                                {fileSize !== null && (
                                    <MetaRow label="용량" value={formatBytes(fileSize)} />
                                )}
                                {fileSize !== null && videoDuration > 0 && (
                                    <MetaRow label="비트레이트" value={`${((fileSize * 8) / videoDuration / 1000).toFixed(0)} kbps`} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* 랠리 통계 */}
                    {rallies.length > 0 && (
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <BarChart3 className="w-3.5 h-3.5 text-lime-400" />
                                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">랠리 통계</span>
                            </div>
                            <div className="bg-zinc-900 rounded-lg px-3 py-1">
                                <MetaRow label="총 랠리 수" value={`${rallies.length}개`} />
                                <MetaRow label="총 랠리 시간" value={formatTime(totalRallyTime, false)} />
                                <MetaRow label="평균 랠리 길이" value={`${avgRallyDuration.toFixed(1)}초`} />
                                <MetaRow label="최장 랠리" value={`${longestRally.toFixed(1)}초`} />
                                <MetaRow label="최단 랠리" value={`${shortestRally.toFixed(1)}초`} />
                                <MetaRow label="랠리 비율" value={`${rallyRatio.toFixed(1)}%`} />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
