'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Film, Info, BarChart3, HardDrive, Music, Video, Globe } from 'lucide-react';
import { AnalysisResponse, Rally } from '@/lib/api';
import { VideoMeta } from './VideoPlayer';
import { formatTime } from '@/lib/time-utils';
import { parseMp4Metadata, Mp4Metadata, Mp4TrackInfo, getBrandName } from '@/lib/mp4-parser';

interface VideoMetadataProps {
    data: AnalysisResponse;
    rallies: Rally[];
    videoDuration: number;
    videoMeta: VideoMeta | null;
    fileSize: number | null;
    videoUrl: string | null;
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

function formatDateObj(d: Date): string {
    return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

const LANG_NAMES: Record<string, string> = {
    'und': '미지정', 'eng': '영어', 'kor': '한국어', 'jpn': '일본어',
    'zho': '중국어', 'spa': '스페인어', 'fra': '프랑스어', 'deu': '독일어',
};

function MetaRow({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/50 last:border-0">
            <span className="text-zinc-500 text-sm">{label}</span>
            <span className={`text-zinc-200 text-sm ${mono ? 'font-mono' : ''}`}>{value}</span>
        </div>
    );
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="flex items-center gap-1.5 mb-2">
            <Icon className="w-3.5 h-3.5 text-lime-400" />
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
        </div>
    );
}

function TrackSection({ track, index }: { track: Mp4TrackInfo; index: number }) {
    const isVideo = track.type === 'video';
    const isAudio = track.type === 'audio';
    const Icon = isVideo ? Video : isAudio ? Music : Film;
    const typeLabel = isVideo ? '비디오' : isAudio ? '오디오' : track.type;
    const langName = LANG_NAMES[track.language || ''] || track.language;

    return (
        <div>
            <SectionHeader icon={Icon} label={`트랙 ${index + 1} — ${typeLabel}`} />
            <div className="bg-zinc-900 rounded-lg px-3 py-1">
                <MetaRow label="코덱" value={track.codecLong} />
                <MetaRow label="코덱 ID" value={track.codec} />
                {track.profile && <MetaRow label="프로필" value={track.profile} />}
                {track.level && <MetaRow label="레벨" value={track.level} />}
                {isVideo && track.width && track.height && (
                    <MetaRow label="해상도" value={`${track.width} × ${track.height}`} />
                )}
                {isVideo && track.frameRate && (
                    <MetaRow label="프레임레이트" value={`${track.frameRate} fps`} />
                )}
                {isVideo && track.bitDepth !== undefined && track.bitDepth > 0 && (
                    <MetaRow label="비트 심도" value={`${track.bitDepth} bit`} />
                )}
                {isAudio && track.sampleRate && (
                    <MetaRow label="샘플레이트" value={`${track.sampleRate.toLocaleString()} Hz`} />
                )}
                {isAudio && track.channelCount && (
                    <MetaRow label="채널" value={`${track.channelCount}ch${track.channelCount === 1 ? ' (모노)' : track.channelCount === 2 ? ' (스테레오)' : ''}`} />
                )}
                {isAudio && track.audioBitDepth !== undefined && track.audioBitDepth > 0 && (
                    <MetaRow label="오디오 비트 심도" value={`${track.audioBitDepth} bit`} />
                )}
                {langName && langName !== '미지정' && (
                    <MetaRow label="언어" value={langName} />
                )}
                {track.durationMs !== undefined && track.durationMs > 0 && (
                    <MetaRow label="트랙 길이" value={formatTime(track.durationMs / 1000, false)} />
                )}
                {track.timescale !== undefined && track.timescale > 0 && (
                    <MetaRow label="타임스케일" value={track.timescale.toLocaleString()} />
                )}
            </div>
        </div>
    );
}

export default function VideoMetadata({ data, rallies, videoDuration, videoMeta, fileSize, videoUrl }: VideoMetadataProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mp4Meta, setMp4Meta] = useState<Mp4Metadata | null>(null);
    const [mp4Loading, setMp4Loading] = useState(false);

    // 패널이 열릴 때만 MP4 파싱 실행
    useEffect(() => {
        if (!isOpen || !videoUrl || mp4Meta || mp4Loading) return;
        setMp4Loading(true);
        parseMp4Metadata(videoUrl)
            .then(result => setMp4Meta(result))
            .finally(() => setMp4Loading(false));
    }, [isOpen, videoUrl, mp4Meta, mp4Loading]);

    // videoUrl 변경 시 리셋
    useEffect(() => {
        setMp4Meta(null);
    }, [videoUrl]);

    const totalRallyTime = rallies.reduce((sum, r) => sum + r.duration, 0);
    const avgRallyDuration = rallies.length > 0 ? totalRallyTime / rallies.length : 0;
    const longestRally = rallies.length > 0 ? Math.max(...rallies.map(r => r.duration)) : 0;
    const shortestRally = rallies.length > 0 ? Math.min(...rallies.map(r => r.duration)) : 0;
    const rallyRatio = videoDuration > 0 ? (totalRallyTime / videoDuration) * 100 : 0;

    const videoTrack = mp4Meta?.tracks.find(t => t.type === 'video');
    const audioTrack = mp4Meta?.tracks.find(t => t.type === 'audio');

    return (
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
            >
                <div className="flex items-center gap-2 text-zinc-300 font-medium text-sm">
                    <Info className="w-4 h-4 text-lime-400" />
                    영상 메타데이터
                    {mp4Meta && videoTrack && (
                        <span className="text-xs text-zinc-500 font-normal">
                            — {videoTrack.codecLong}{audioTrack ? ` / ${audioTrack.codecLong}` : ''}
                        </span>
                    )}
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
                        <SectionHeader icon={Film} label="기본 정보" />
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
                                <MetaRow label="업로드일" value={formatDate(data.createdAt)} />
                            )}
                            {data.updatedAt && (
                                <MetaRow label="분석 완료일" value={formatDate(data.updatedAt)} />
                            )}
                        </div>
                    </div>

                    {/* 비디오 기술 정보 */}
                    {videoDuration > 0 && (
                        <div>
                            <SectionHeader icon={HardDrive} label="파일 정보" />
                            <div className="bg-zinc-900 rounded-lg px-3 py-1">
                                <MetaRow label="길이" value={formatTime(videoDuration, false)} />
                                {videoMeta && (
                                    <MetaRow label="표시 해상도" value={`${videoMeta.videoWidth} × ${videoMeta.videoHeight}`} />
                                )}
                                {fileSize !== null && (
                                    <MetaRow label="용량" value={formatBytes(fileSize)} />
                                )}
                                {fileSize !== null && videoDuration > 0 && (
                                    <MetaRow label="평균 비트레이트" value={`${((fileSize * 8) / videoDuration / 1000).toFixed(0)} kbps`} />
                                )}
                                {mp4Meta?.contentType && (
                                    <MetaRow label="MIME 타입" value={mp4Meta.contentType} />
                                )}
                                {mp4Meta?.majorBrand && (
                                    <MetaRow label="컨테이너" value={`${getBrandName(mp4Meta.majorBrand)} (${mp4Meta.majorBrand})`} />
                                )}
                                {mp4Meta && mp4Meta.compatibleBrands.length > 0 && (
                                    <MetaRow label="호환 브랜드" value={mp4Meta.compatibleBrands.join(', ')} />
                                )}
                                {mp4Meta?.creationTime && (
                                    <MetaRow label="파일 생성일" value={formatDateObj(mp4Meta.creationTime)} />
                                )}
                                {mp4Meta?.modificationTime && (
                                    <MetaRow label="파일 수정일" value={formatDateObj(mp4Meta.modificationTime)} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* MP4 로딩 중 */}
                    {mp4Loading && (
                        <div className="text-center py-2 text-zinc-500 text-sm">
                            코덱 정보 분석 중...
                        </div>
                    )}

                    {/* 트랙별 상세 정보 */}
                    {mp4Meta && mp4Meta.tracks.map((track, i) => (
                        <TrackSection key={i} track={track} index={i} />
                    ))}

                    {/* HTTP 메타데이터 */}
                    {mp4Meta && (mp4Meta.lastModified || mp4Meta.etag || mp4Meta.server) && (
                        <div>
                            <SectionHeader icon={Globe} label="서버 정보" />
                            <div className="bg-zinc-900 rounded-lg px-3 py-1">
                                {mp4Meta.lastModified && (
                                    <MetaRow label="Last-Modified" value={mp4Meta.lastModified} />
                                )}
                                {mp4Meta.etag && (
                                    <MetaRow label="ETag" value={
                                        <span className="max-w-[200px] truncate inline-block align-bottom" title={mp4Meta.etag}>
                                            {mp4Meta.etag}
                                        </span>
                                    } />
                                )}
                                {mp4Meta.server && (
                                    <MetaRow label="서버" value={mp4Meta.server} />
                                )}
                                {mp4Meta.acceptRanges && (
                                    <MetaRow label="Range 지원" value={mp4Meta.acceptRanges} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* 랠리 통계 */}
                    {rallies.length > 0 && (
                        <div>
                            <SectionHeader icon={BarChart3} label="랠리 통계" />
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
