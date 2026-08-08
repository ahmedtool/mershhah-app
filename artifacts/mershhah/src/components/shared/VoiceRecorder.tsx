'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Send, Loader2, X } from 'lucide-react';

interface VoiceRecorderProps {
  onSend: (blob: Blob) => void | Promise<void>;
  disabled?: boolean;
}

export function VoiceRecorder({ onSend, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const drawWaveform = (analyser: AnalyserNode, canvas: HTMLCanvasElement, color: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      analyser.getByteTimeDomainData(dataArray);
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.beginPath();
      const sliceWidth = W / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * H) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setIsPreview(true);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start(1000);
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

      if (canvasRef.current) {
        drawWaveform(analyser, canvasRef.current, '#ef4444');
      }
    } catch (e) {
      console.error('Microphone error:', e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsPreview(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    setDuration(0);
  };

  const sendVoice = async () => {
    if (!blobRef.current || blobRef.current.size === 0) return;
    setIsSending(true);
    try {
      await onSend(blobRef.current);
      setIsPreview(false);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      blobRef.current = null;
      chunksRef.current = [];
      setDuration(0);
    } finally {
      setIsSending(false);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (isPreview && audioUrl) {
    return (
      <div className="flex items-center gap-2 w-full">
        <button onClick={cancelRecording} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0 transition-colors">
          <X className="h-4 w-4" />
        </button>
        <audio src={audioUrl} controls className="h-9 flex-1 min-w-0" />
        <button onClick={sendVoice} disabled={isSending}
          className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors shrink-0 disabled:opacity-50">
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 w-full">
        <button onClick={cancelRecording} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 shrink-0 transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <canvas ref={canvasRef} width={160} height={32} className="flex-1 h-8" />
          <span className="text-[11px] font-bold text-red-500 font-mono shrink-0">{formatDuration(duration)}</span>
        </div>
        <button onClick={stopRecording}
          className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shrink-0">
          <Square className="h-4 w-4" fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <button onClick={startRecording} disabled={disabled}
      className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors shrink-0 disabled:opacity-30"
      title="تسجيل صوتي">
      <Mic className="h-4 w-4" />
    </button>
  );
}
