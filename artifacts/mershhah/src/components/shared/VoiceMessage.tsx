'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';

interface VoiceMessageProps {
  url: string;
  isOwner?: boolean;
}

export function VoiceMessage({ url, isOwner }: VoiceMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isOwner ? 'rgba(255,255,255,0.4)' : '#d1d5db',
      progressColor: isOwner ? '#ffffff' : '#111827',
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 32,
      normalize: true,
      backend: 'WebAudio',
    });

    ws.load(url);

    ws.on('ready', () => {
      setDuration(ws.getDuration());
      setIsReady(true);
    });

    ws.on('audioprocess', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    wsRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [url, isOwner]);

  const togglePlay = () => {
    if (wsRef.current) wsRef.current.playPause();
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[180px]">
      <button onClick={togglePlay} disabled={!isReady}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isOwner ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        } disabled:opacity-50`}>
        {isPlaying ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5" fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <div ref={containerRef} className="w-full" />
      </div>
      <span className={`text-[9px] font-mono shrink-0 ${isOwner ? 'text-white/60' : 'text-gray-400'}`}>
        {isPlaying ? formatTime(currentTime) : formatTime(duration)}
      </span>
    </div>
  );
}
