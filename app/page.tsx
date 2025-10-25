'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, AlertCircle } from 'lucide-react';
import { markStart, markEnd, logMetrics } from '@/lib/metrics';

type Status = 'idle' | 'recording' | 'processing' | 'playing' | 'error';

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [subtitle, setSubtitle] = useState('');
  const [error, setError] = useState('');
  const [enText, setEnText] = useState('Hello, how are you?');
  const [jaText, setJaText] = useState('こんにちは、お元気ですか？');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [progress, setProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const lastRecordingMsRef = useRef(0);
  const pointerActiveRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('SW registered'))
        .catch((err) => console.error('SW registration failed:', err));
    }

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const startRecording = async () => {
    console.log('🎤 startRecording called');
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        console.error('getUserMedia not supported');
        setError('ブラウザがマイク取得に対応していません。最新のブラウザでお試しください。');
        setStatus('error');
        return;
      }
      if (pointerActiveRef.current) {
        console.warn('Already recording, ignoring');
        return;
      }
      pointerActiveRef.current = true;
      console.log('Requesting microphone access...');
      setError('');
      setSubtitle('');
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      markStart('e2e');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone access granted');

      // Safari等の互換性を考慮してサポートされるmimeTypeを選択
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ];
      let chosen: string | undefined;
      if (typeof MediaRecorder !== 'undefined' && 'isTypeSupported' in MediaRecorder) {
        for (const c of candidates) {
          // @ts-expect-error: Safari型定義差異
          if (MediaRecorder.isTypeSupported?.(c)) { chosen = c; break; }
        }
      }
      const options: MediaRecorderOptions = chosen ? { mimeType: chosen } : {};
      console.log('MediaRecorder options:', options);
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      console.log('MediaRecorder created, starting recording...');
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const kb = (blob.size / 1024).toFixed(1);
        const sec = (lastRecordingMsRef.current / 1000).toFixed(1);
        console.log('Recorded blob', { sizeBytes: blob.size, type: blob.type, durationMs: lastRecordingMsRef.current });
        
        // Validate recording length and size
        if (lastRecordingMsRef.current < 500) {
          setError('録音時間が短すぎます。もう一度お試しください（最低0.5秒）。');
          setStatus('error');
          return;
        }
        if (blob.size < 1024) {
          setError('録音データが小さすぎます。マイクに向かって話してください。');
          setStatus('error');
          return;
        }
        
        setSubtitle(`録音: ${sec}秒 / ${kb}KB`);
        try {
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        } catch (e) {
          console.warn('Failed to create preview URL', e);
        }
        await processAudio(blob);
      };

      mediaRecorder.start();
      setStatus('recording');
      setRecordingTime(0);
      setProgress(0);
      console.log('🔴 Recording started');

      let time = 0;
      recordingTimerRef.current = window.setInterval(() => {
        time += 100;
        setRecordingTime(time);
        lastRecordingMsRef.current = time;
        if (time >= 5000) stopRecording();
      }, 100);

      const startedAt = performance.now();
      const tick = () => {
        const elapsed = performance.now() - startedAt;
        const p = Math.min(1, elapsed / 5000);
        setProgress(p);
        if (pointerActiveRef.current && elapsed < 5000) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('❌ Recording error:', err);
      setError('マイクにアクセスできません。権限を確認してください。');
      setStatus('error');
      pointerActiveRef.current = false;
    }
  };

  const stopRecording = () => {
    console.log('⏹️ stopRecording called');
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('Stopping MediaRecorder...');
      mediaRecorderRef.current.stop();
    }
    pointerActiveRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const processAudio = async (blob: Blob) => {
    setStatus('processing');
    try {
      // ASR
      markStart('asr');
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const asrRes = await fetch('/api/asr', {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(10000),
      });
      if (!asrRes.ok) {
        let msg = 'ASR failed';
        try { const j = await asrRes.json(); msg = j?.error || msg; } catch {}
        throw new Error(msg);
      }
      const asrData: { text: string; lang: 'ja' | 'en' } = await asrRes.json();
      markEnd('asr');

      setSubtitle(`認識: ${asrData.text}`);
      if (asrData.lang === 'ja') { setJaText(asrData.text); } else { setEnText(asrData.text); }

      // Translate
      markStart('translate');
      const translateRes = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: asrData.text, lang: asrData.lang }),
        signal: AbortSignal.timeout(8000),
      });
      if (!translateRes.ok) {
        let msg = 'Translation failed';
        try { const j = await translateRes.json(); msg = j?.error || msg; } catch {}
        throw new Error(msg);
      }
      const trData: { text: string; lang: 'ja' | 'en' } = await translateRes.json();
      markEnd('translate');

      setSubtitle(`訳: ${trData.text}`);
      if (trData.lang === 'ja') { setJaText(trData.text); } else { setEnText(trData.text); }

      // TTS
      markStart('tts');
      await playTTS(trData.text, trData.lang);
      markEnd('tts');

      markEnd('e2e');
      logMetrics();
      setStatus('idle');
    } catch (err: any) {
      console.error('Processing error:', err);
      if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
        setError('タイムアウトしました。もう一度お試しください。');
      } else {
        setError('処理に失敗しました。ネットワークを確認してください。');
      }
      setStatus('error');
    }
  };

  const playTTS = async (text: string, lang: 'ja' | 'en'): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'ja' ? 'ja-JP' : 'en-US';
        utterance.rate = 1.0;
        utterance.onend = () => resolve();
        utterance.onerror = async () => {
          try {
            await playTTSAPI(text, lang);
            resolve();
          } catch (e) {
            reject(e);
          }
        };
        setStatus('playing');
        window.speechSynthesis.speak(utterance);
      } else {
        playTTSAPI(text, lang).then(resolve).catch(reject);
      }
    });
  };

  const playTTSAPI = async (text: string, lang: 'ja' | 'en'): Promise<void> => {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      try { const j = await res.json(); throw new Error(j?.error || 'TTS API failed'); } catch {
        throw new Error('TTS API failed');
      }
    }
    const audioBlob = await res.blob();
    const url = URL.createObjectURL(audioBlob);
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      setStatus('playing');
      audio.play();
    });
  };

  const handleRetry = () => { setError(''); setStatus('idle'); };

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing' || status === 'playing';
  const isDisabled = isRecording || isProcessing;

  const deg = Math.round(progress * 360);

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFF' }}>
      <div className="w-full max-w-3xl px-6 py-12">
        <div className="flex flex-col items-center gap-10">
          {/* Mic Button with conic ring */}
          <div className="relative w-[220px] h-[220px]">
            {/* Ring track */}
            <div className="absolute inset-0 rounded-full border border-[#E6F0FF]" />
            {/* Conic progress */}
            {isRecording && (
              <>
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ background: `conic-gradient(#60A5FA ${deg}deg, transparent 0deg)` }}
                />
                {/* carve inner to make ring thickness */}
                <div className="absolute inset-3 rounded-full" style={{ background: '#F8FAFF' }} />
              </>
            )}

            <button
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerLeave={() => { if (isRecording) stopRecording(); }}
              disabled={isDisabled}
              className={`relative z-10 w-full h-full rounded-full flex items-center justify-center text-white transition-transform duration-200 ${
                isProcessing ? 'cursor-not-allowed' : 'active:scale-95'
              } ${status === 'idle' ? 'animate-micro-pulse' : ''}`}
              style={{
                background: 'linear-gradient(135deg, #7EC8FF 0%, #8AA9FF 45%, #A78BFA 100%)',
                boxShadow: status === 'recording'
                  ? '0 20px 60px rgba(99,102,241,0.45), inset 0 0 20px rgba(255,255,255,0.35)'
                  : '0 12px 40px rgba(99,102,241,0.25)',
              }}
            >
              {isProcessing ? (
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
              ) : (
                <Mic size={72} />
              )}
            </button>
          </div>

          {/* Texts */}
          <div className="text-center space-y-3">
            <h2 className="text-[48px] md:text-[56px] font-semibold leading-tight bg-gradient-to-r from-[#7EC8FF] to-[#A78BFA] bg-clip-text text-transparent">
              {enText}
            </h2>
            <p className="text-[24px] md:text-[28px] leading-snug bg-gradient-to-r from-[#8ABCF8] to-[#B69CFF] bg-clip-text text-transparent">
              {jaText}
            </p>
          </div>

          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
        </div>

        {/* Error Area */}
        {error && (
          <div role="status" aria-live="polite" className="mt-6 text-center text-sm text-red-600">
            <div className="inline-flex items-center gap-1"><AlertCircle size={16} />{error}</div>
            <div className="mt-2"><button onClick={handleRetry} className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-xs">再試行</button></div>
          </div>
        )}

        {previewUrl && (
          <div className="mt-6">
            <audio controls src={previewUrl} className="w-full" />
          </div>
        )}
      </div>
    </main>
  );
}


