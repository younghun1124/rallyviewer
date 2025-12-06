'use client';

import { Rally } from '@/lib/api';
import { Play } from 'lucide-react';

interface RallyListProps {
    rallies: Rally[];
    activeRallyIndex: number | null;
    onRallyClick: (index: number) => void;
}

export default function RallyList({ rallies, activeRallyIndex, onRallyClick }: RallyListProps) {
    if (rallies.length === 0) {
        return (
            <div className="text-center text-gray-500 py-8">
                No rallies detected yet.
            </div>
        );
    }

    function formatTime(seconds: number) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 mt-4">
            {rallies.map((rally, idx) => (
                <button
                    key={idx}
                    onClick={() => onRallyClick(idx)}
                    className={`
            flex items-center justify-between p-4 rounded-xl border transition-all text-left group
            ${activeRallyIndex === idx
                            ? 'bg-lime-900/20 border-lime-500/50 ring-1 ring-lime-500/50'
                            : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                        }
          `}
                >
                    <div>
                        <div className={`text-lg font-bold mb-1 ${activeRallyIndex === idx ? 'text-lime-400' : 'text-white'}`}>
                            Rally #{rally.rallyIndex}
                        </div>
                        <div className="text-sm text-zinc-400 font-mono">
                            {formatTime(rally.startTime)} - {formatTime(rally.endTime)}
                        </div>
                    </div>

                    <div className="text-right">
                        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Duration</div>
                        <div className="text-sm font-medium text-zinc-300">
                            {rally.duration.toFixed(1)}s
                        </div>
                    </div>

                    <div className={`
            absolute right-4 opacity-0 transform translate-x-2 transition-all
            ${activeRallyIndex === idx ? 'opacity-100 translate-x-0' : 'group-hover:opacity-100 group-hover:translate-x-0'}
          `}>
                        <Play className={`w-5 h-5 ${activeRallyIndex === idx ? 'text-lime-400' : 'text-white'}`} fill="currentColor" />
                    </div>
                </button>
            ))}
        </div>
    );
}
