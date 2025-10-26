'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, AlertCircle, Copy, Share2, Star, Volume2, Gauge, Clock, Bookmark } from 'lucide-react';
import { markStart, markEnd, logMetrics } from '@/lib/metrics';
import { addToHistory, toggleBookmark as toggleBookmarkStorage, getSettings, updateSettings, type TranslationItem } from '@/lib/storage';
import Toast from '@/components/Toast';
import HistoryPanel from '@/components/HistoryPanel';

type Status = 'idle' | 'recording' | 'processing' | 'playing' | 'error';

const MESSAGE_PAIRS = [
  { ja: '話し始めてください。', en: 'Start speaking.' },
  { ja: 'いつでもどうぞ。音声を聞き取ります。', en: "Whenever you're ready. I'm listening." },
  { ja: '準備OK。あなたの声を待っています。', en: 'All set. Waiting for your voice.' },
  { ja: '伝えたいことを話してください。', en: "Say what you'd like to convey." },
  { ja: 'ボタンを押して、声で伝えてください。', en: 'Press the button and speak.' },
  { ja: 'こちらに話しかけてください。', en: 'Please speak to me.' },
];

export default function Home() {
  const [status, setStatus] = useState<Status>('idle');
  const [subtitle, setSubtitle] = useState('');
  const [error, setError] = useState('');
  const [enText, setEnText] = useState('Hello, how are you?');
  const [jaText, setJaText] = useState('こんにちは、お元気ですか？');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [messagePair, setMessagePair] = useState({ ja: '', en: '' });
  const [hasHistory, setHasHistory] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // New UI state
  const [toast, setToast] = useState<string | null>(null);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [autoTTS, setAutoTTS] = useState(true);
  const [ttsSpeed, setTTSSpeed] = useState<0.75 | 1.0 | 1.25>(1.0);
  const [langOverride, setLangOverride] = useState<'auto' | 'ja' | 'en'>('auto');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [panelView, setPanelView] = useState<'history' | 'bookmarks'>('history');
  const [slideDistance, setSlideDistance] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const lastRecordingMsRef = useRef(0);
  const pointerActiveRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const volumeRafRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  
  const [volumeLevel, setVolumeLevel] = useState(0);

  useEffect(() => {
    setMounted(true);

    // Random message pair (client-only to avoid hydration mismatch)
    const randomIndex = Math.floor(Math.random() * MESSAGE_PAIRS.length);
    setMessagePair(MESSAGE_PAIRS[randomIndex]);

    // Load settings
    const settings = getSettings();
    setAutoTTS(settings.autoTTS);
    setTTSSpeed(settings.ttsSpeed);
    setLangOverride(settings.languageOverride);

    // Service Worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('SW registered'))
        .catch((err) => console.error('SW registration failed:', err));
    }

    // Audio unlock on first user interaction
    const unlockAudio = () => {
      if (!audioUnlockedRef.current && typeof AudioContext !== 'undefined') {
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        ctx.resume().then(() => {
          audioUnlockedRef.current = true;
          console.log('✅ AudioContext unlocked');
        });
      }
    };
    document.addEventListener('pointerdown', unlockAudio, { once: true });

    // Handle visibility change (resume suspended AudioContext)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const startRecording = async (e?: React.PointerEvent) => {
    e?.preventDefault();
    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setError('ブラウザがマイク取得に対応していません。最新のブラウザでお試しください。');
        setStatus('error');
        return;
      }
      if (pointerActiveRef.current) return;
      
      pointerActiveRef.current = true;
      setError('');
      setSubtitle('');
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      markStart('e2e');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup volume analyzer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start volume monitoring
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const normalized = Math.min((average / 128) * 100, 100);
        setVolumeLevel(normalized);
        volumeRafRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

      // Safari compatibility: choose supported mimeType
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ];
      let chosen: string | undefined;
      if (typeof MediaRecorder !== 'undefined' && 'isTypeSupported' in MediaRecorder) {
        for (const c of candidates) {
          if (MediaRecorder.isTypeSupported?.(c)) { chosen = c; break; }
        }
      }
      const options: MediaRecorderOptions = chosen ? { mimeType: chosen } : {};
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const duration = lastRecordingMsRef.current;

        // Validate recording length and size
        if (duration < 500) {
          setError('録音時間が短すぎます。もう一度お試しください（最低0.5秒）。');
          setStatus('error');
          return;
        }
        if (blob.size < 1024) {
          setError('録音データが小さすぎます。マイクに向かって話してください。');
          setStatus('error');
          return;
        }

        setSubtitle(`録音: ${(duration / 1000).toFixed(1)}秒 / ${(blob.size / 1024).toFixed(1)}KB`);
        try {
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        } catch (e) {
          console.warn('Failed to create preview URL', e);
        }
        await processAudio(blob);
      };

      // Use timeslice for smaller chunks (250ms)
      mediaRecorder.start(250);
      setStatus('recording');
      setIsRecording(true);
      setRecordingTime(0);
      recordingStartTimeRef.current = Date.now();

      let time = 0;
      recordingTimerRef.current = window.setInterval(() => {
        time += 100;
        setRecordingTime(time);
        lastRecordingMsRef.current = time;
        if (time >= 5000) stopRecording();
      }, 100);
    } catch (err) {
      setError('録音の開始に失敗しました。マイクへのアクセスを許可してください。');
      setStatus('error');
      pointerActiveRef.current = false;
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    pointerActiveRef.current = false;
    setIsRecording(false);
    
    // Stop volume monitoring
    if (volumeRafRef.current) {
      cancelAnimationFrame(volumeRafRef.current);
      volumeRafRef.current = null;
    }
    analyserRef.current = null;
    setVolumeLevel(0);
  };

  const processAudio = async (blob: Blob) => {
    setStatus('processing');
    setHasHistory(true); // Mark that we have processing history
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
        try { const j = await asrRes.json(); msg = j?.error || msg; } catch { }
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
        try { const j = await translateRes.json(); msg = j?.error || msg; } catch { }
        throw new Error(msg);
      }
      const trData: { text: string; lang: 'ja' | 'en' } = await translateRes.json();
      markEnd('translate');

      setSubtitle(`訳: ${trData.text}`);
      if (trData.lang === 'ja') { setJaText(trData.text); } else { setEnText(trData.text); }

      // Save to history
      const historyItem = addToHistory({
        originalText: asrData.text,
        translatedText: trData.text,
        originalLang: asrData.lang,
        targetLang: trData.lang,
      });
      setCurrentItemId(historyItem.id);
      setIsBookmarked(historyItem.isBookmarked);
      setHasHistory(true);

      // TTS (if auto-play is enabled)
      if (autoTTS) {
        markStart('tts');
        await playTTS(trData.text, trData.lang, ttsSpeed);
        markEnd('tts');
      }

      markEnd('e2e');
      logMetrics();
      setStatus('idle');
    } catch (err: any) {
      console.error('Processing error:', err);
      if (err?.name === 'AbortError' || err?.name === 'TimeoutError') {
        setError('タイムアウトしました。もう一度お試しください。');
      } else {
        setError(err?.message || '処理に失敗しました。ネットワークを確認してください。');
      }
      setStatus('error');
    }
  };

  const playTTS = async (text: string, lang: 'ja' | 'en', speed: number = 1.0): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'ja' ? 'ja-JP' : 'en-US';
        utterance.rate = speed;
        utterance.onend = () => resolve();
        utterance.onerror = async (err) => {
          console.warn('speechSynthesis failed, falling back to API or Web Audio:', err);
          try {
            await playTTSWithWebAudio(text, lang);
            resolve();
          } catch (e) {
            console.error('Web Audio TTS also failed:', e);
            reject(e);
          }
        };
        setStatus('playing');
        window.speechSynthesis.speak(utterance);
      } else {
        playTTSWithWebAudio(text, lang).then(resolve).catch(reject);
      }
    });
  };

  const playTTSWithWebAudio = async (text: string, lang: 'ja' | 'en'): Promise<void> => {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || 'TTS API failed');
    }
    const audioBlob = await res.blob();
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Try HTMLAudioElement first
    try {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      return new Promise((resolve, reject) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = (e) => {
          URL.revokeObjectURL(url);
          console.warn('HTMLAudioElement.play() failed, trying Web Audio API');
          reject(e);
        };
        setStatus('playing');
        audio.play().catch(reject);
      });
    } catch (htmlAudioError) {
      console.warn('HTMLAudioElement failed, using Web Audio API:', htmlAudioError);

      // Fallback to Web Audio API (decodeAudioData + bufferSource)
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      return new Promise((resolve) => {
        source.onended = () => resolve();
        setStatus('playing');
        source.start(0);
      });
    }
  };

  const handleRetry = () => { setError(''); setStatus('idle'); setIsRecording(false); };

  const isProcessing = status === 'processing' || status === 'playing';
  const isDisabled = isRecording || isProcessing;

  const showMessage = mounted && !isRecording && !hasHistory && messagePair.ja;

  // Optical centering: calculate spacer width based on trailing punctuation
  const getOpticalSpacer = (text: string): number => {
    const lastChar = text.slice(-1);
    const spacerMap: Record<string, number> = {
      '。': 0.8,
      '、': 0.6,
      '！': 0.5,
      '？': 0.5,
      '.': 0.6,
      ',': 0.4,
      '!': 0.4,
      '?': 0.4,
    };
    return spacerMap[lastChar] || 0;
  };

  // Mini operation handlers
  const handleCopy = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setToast('コピーしました');
      }).catch(() => {
        setToast('コピーに失敗しました');
      });
    }
  };

  const handleShare = (text: string) => {
    if (navigator.share) {
      navigator.share({
        title: 'AVT Translation',
        text: text,
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
          handleCopy(text);
          setToast('コピーしました');
        }
      });
    } else {
      handleCopy(text);
      setToast('コピーしました');
    }
  };

  const handleBookmark = () => {
    if (currentItemId) {
      const newState = toggleBookmarkStorage(currentItemId);
      setIsBookmarked(newState);
      setToast(newState ? 'ブックマークに追加しました' : 'ブックマークから削除しました');
    }
  };

  const handlePlayTTS = async (text: string, lang: 'ja' | 'en', speed: number) => {
    if (status === 'playing') return;
    setStatus('playing');
    setSubtitle(`再生中... (${speed}x)`);
    try {
      await playTTS(text, lang, speed);
    } catch (err) {
      console.error('TTS playback failed:', err);
      setToast('再生に失敗しました');
    } finally {
      setStatus('idle');
      setSubtitle('');
    }
  };

  const handleToggleAutoTTS = () => {
    const newValue = !autoTTS;
    setAutoTTS(newValue);
    updateSettings({ autoTTS: newValue });
    setToast(newValue ? '自動読み上げ: ON' : '自動読み上げ: OFF');
  };

  const handleTTSSpeedChange = (speed: 0.75 | 1.0 | 1.25) => {
    setTTSSpeed(speed);
    updateSettings({ ttsSpeed: speed });
    setToast(`再生速度: ${speed}x`);
  };

  const handleLangOverride = (lang: 'auto' | 'ja' | 'en') => {
    setLangOverride(lang);
    updateSettings({ languageOverride: lang });
    setToast(`言語: ${lang === 'auto' ? '自動' : lang === 'ja' ? '日本語' : '英語'}`);
  };

  const handleOpenPanel = (view: 'history' | 'bookmarks') => {
    setPanelView(view);
    setIsPanelOpen(true);
  };

  const handleSelectHistoryItem = (item: TranslationItem) => {
    // Load the selected item into the UI
    if (item.originalLang === 'ja') {
      setJaText(item.originalText);
      setEnText(item.translatedText);
    } else {
      setEnText(item.originalText);
      setJaText(item.translatedText);
    }
    setCurrentItemId(item.id);
    setIsBookmarked(item.isBookmarked);
    setHasHistory(true);
  };

  // Slide-to-cancel handlers (Long press mode only)
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isDisabled || isRecording) return;

    startPosRef.current = { x: e.clientX, y: e.clientY };
    setSlideDistance(0);
    setIsCancelling(false);
    startRecording();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isRecording || !startPosRef.current) return;
    
    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    setSlideDistance(distance);
    
    // Cancel threshold: 80px
    if (distance > 80) {
      setIsCancelling(true);
    } else {
      setIsCancelling(false);
    }
  };

  const handlePointerUp = () => {
    if (!isRecording) return;

    // Long press mode: Stop or cancel on pointer up
    if (isCancelling) {
      cancelRecording();
    } else {
      stopRecording();
    }

    startPosRef.current = null;
    setSlideDistance(0);
    setIsCancelling(false);
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Stop without processing
      const stream = mediaRecorderRef.current.stream;
      stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
    }
    if (volumeRafRef.current) {
      cancelAnimationFrame(volumeRafRef.current);
      volumeRafRef.current = null;
    }
    
    analyserRef.current = null;
    pointerActiveRef.current = false;
    chunksRef.current = [];
    setStatus('idle');
    setIsRecording(false);
    setVolumeLevel(0);
    setSubtitle('');
    setToast('録音をキャンセルしました');
  };

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F8FAFF' }}>
      {/* Floating action buttons (top right) */}
      <div className="fixed top-4 right-4 flex gap-2 z-30">
        <button
          onClick={() => handleOpenPanel('history')}
          className="p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow text-gray-700 hover:text-blue-600"
          aria-label="履歴を表示"
          title="履歴"
        >
          <Clock size={20} />
        </button>
        <button
          onClick={() => handleOpenPanel('bookmarks')}
          className="p-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-shadow text-gray-700 hover:text-yellow-600"
          aria-label="ブックマークを表示"
          title="ブックマーク"
        >
          <Bookmark size={20} />
        </button>
      </div>

      <div className="w-full max-w-4xl px-6 py-8 md:py-12">
        <div className="flex flex-col items-center justify-center gap-8 md:gap-12 min-h-[80vh]">

          {/* 3D Mic Button with progress ring - Centered */}
          <div className="relative w-[200px] sm:w-[240px] md:w-[280px] h-[200px] sm:h-[240px] md:h-[280px]">
            {/* Slide to cancel guide - shown during recording */}
            {isRecording && (
              <div
                className="absolute top-1/2 -translate-y-1/2 left-full ml-4 whitespace-nowrap pointer-events-none"
                style={{
                  opacity: isCancelling ? 0.3 : 1,
                  transition: 'opacity 0.2s',
                }}
                aria-live="polite"
              >
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCancelling ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                }`}
                style={{
                  animation: isCancelling ? 'none' : 'slideHint 1.5s ease-in-out infinite',
                }}
                >
                  <span className="text-base">▶︎</span>
                  <span>{isCancelling ? '離すと中断' : '右へスライドで中断'}</span>
                </div>
              </div>
            )}

            {/* SVG Progress Ring (below the button) - CSS animated */}
            <svg
              className="absolute inset-0 -rotate-90"
              viewBox="0 0 100 100"
              style={{ opacity: isRecording ? 1 : 0, transition: 'opacity 0.3s' }}
            >
              {/* Background ring */}
              <circle cx="50" cy="50" r="46" fill="none" stroke="#E5E7EB" strokeWidth="4" />
              {/* Progress ring (blue) - CSS animated */}
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="#60A5FA"
                strokeWidth="4"
                strokeLinecap="round"
                className={`recording-ring ${isRecording ? 'active' : ''}`}
              />
            </svg>

            {/* ↓ ボタンを一回りだけ小さく置く（リングが見える余白をつくる） */}
            <div className="absolute inset-4">
              <button
                ref={buttonRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                disabled={isDisabled}
                className={`btn-3d-mic ${isRecording ? 'recording' : ''} ${isCancelling ? 'opacity-50' : ''} ${status === 'idle' && !isRecording ? 'animate-micro-pulse' : ''} relative z-10 w-full h-full flex items-center justify-center text-white transition-all duration-200 ${isProcessing ? 'cursor-not-allowed' : ''}`}
                style={{
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'pan-y',
                  WebkitTapHighlightColor: 'transparent',
                  outline: 'none',
                }}
                aria-label={isRecording ? '録音中。指を離すと停止します' : '長押しして録音'}
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-16 w-16 md:h-20 md:w-20 border-4 border-white border-t-transparent" />
                ) : (
                  <Mic size={64} className="md:w-20 md:h-20" strokeWidth={2.5} />
                )}

                {/* Focus ring */}
                <div
                  className="absolute inset-0 rounded-full ring-4 ring-blue-400 ring-offset-4 ring-offset-transparent opacity-0 focus-visible:opacity-100 pointer-events-none"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>


          {/* Instruction message (JP→EN random, shown below button before first recording) */}
          {/* Typography = SAME as translation results */}
          {showMessage && (
            <div
              role="status"
              aria-live="polite"
              className="px-4 text-center"
              style={{ paddingLeft: '1ch', paddingRight: '1ch' }}
            >
              {/* ★縦並びを強制 */}
              <div className="flex flex-col items-center gap-3">
                {/* EN（翻訳結果のh2と同じサイズ/行間） */}
                <p
                  className="block text-[40px] sm:text-[48px] md:text-[56px] font-semibold leading-tight bg-gradient-to-r from-[#7EC8FF] to-[#A78BFA] bg-clip-text text-transparent"
                  style={{ textWrap: 'balance' as any, whiteSpace: 'nowrap' }}
                >
                  {messagePair.en}
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: `${getOpticalSpacer(messagePair.en)}ch`,
                      visibility: 'hidden',
                    }}
                  >
                    &nbsp;
                  </span>
                </p>

                {/* JP（翻訳結果のpと同じサイズ/行間） */}
                <p
                  className="block text-[22px] sm:text-[24px] md:text-[28px] font-medium leading-snug bg-gradient-to-r from-[#8ABCF8] to-[#B69CFF] bg-clip-text text-transparent"
                  style={{ textWrap: 'balance' as any, whiteSpace: 'nowrap' }}
                >
                  {messagePair.ja}
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: `${getOpticalSpacer(messagePair.ja)}ch`,
                      visibility: 'hidden',
                    }}
                  >
                    &nbsp;
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Recording Indicator (PC) with Volume Meter */}
          {isRecording && (
            <div className="w-full max-w-md space-y-3">
              {/* Progress bar */}
              <div className="bg-blue-500 h-2 rounded-full animate-pulse" />
              
              {/* Volume meter */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>音量レベル</span>
                  <span>{volumeLevel.toFixed(0)}%</span>
                </div>
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 transition-all duration-100"
                    style={{ width: `${volumeLevel}%` }}
                  />
                </div>
              </div>
              
              {/* Slide to cancel hint */}
              <p className={`text-xs text-center font-medium transition-colors ${
                isCancelling ? 'text-red-600' : 'text-blue-600'
              }`}>
                {isCancelling ? (
                  '🚫 離すとキャンセル'
                ) : (
                  <>録音中... {(recordingTime / 1000).toFixed(1)}秒 / 5.0秒<br/>
                  <span className="text-gray-400 text-[10px]">スライドしてキャンセル</span></>
                )}
              </p>
            </div>
          )}

          {/* Translation results (shown after first recording) */}
          {hasHistory && (
            <div className="relative w-full max-w-2xl px-4">
              {/* Mini operation row */}
              <div className="flex justify-center items-center gap-3 mb-4">
                <button
                  onClick={() => handleCopy(enText)}
                  className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="コピー"
                  title="コピー"
                >
                  <Copy size={20} />
                </button>
                <button
                  onClick={() => handleShare(enText)}
                  className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="共有"
                  title="共有"
                >
                  <Share2 size={20} />
                </button>
                <button
                  onClick={handleBookmark}
                  className={`p-2 rounded-full transition-colors ${
                    isBookmarked
                      ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  aria-label={isBookmarked ? 'ブックマーク済み' : 'ブックマーク'}
                  title={isBookmarked ? 'ブックマーク済み' : 'ブックマーク'}
                >
                  <Star size={20} fill={isBookmarked ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => handlePlayTTS(enText, 'en', 1.0)}
                  className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="再生"
                  title="通常速度で再生"
                  disabled={status === 'playing'}
                >
                  <Volume2 size={20} />
                </button>
                <button
                  onClick={() => handlePlayTTS(enText, 'en', 0.75)}
                  className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="ゆっくり再生"
                  title="ゆっくり再生 (0.75x)"
                  disabled={status === 'playing'}
                >
                  <Gauge size={20} />
                </button>
              </div>

              {/* Translation texts */}
              <div className="text-center space-y-3">
                <h2 className="text-[40px] sm:text-[48px] md:text-[56px] font-semibold leading-tight bg-gradient-to-r from-[#7EC8FF] to-[#A78BFA] bg-clip-text text-transparent">
                  {enText}
                </h2>
                <p className="text-[22px] sm:text-[24px] md:text-[28px] leading-snug bg-gradient-to-r from-[#8ABCF8] to-[#B69CFF] bg-clip-text text-transparent">
                  {jaText}
                </p>
              </div>

              {/* Language selection chips & TTS controls */}
              <div className="mt-6 space-y-4">
                {/* Language selection */}
                <div className="flex justify-center items-center gap-2">
                  <span className="text-xs text-gray-500 mr-2">言語:</span>
                  {(['auto', 'ja', 'en'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => handleLangOverride(lang)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        langOverride === lang
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {lang === 'auto' ? '自動' : lang === 'ja' ? '日本語' : '英語'}
                    </button>
                  ))}
                </div>

                {/* TTS controls */}
                <div className="flex justify-center items-center gap-4">
                  {/* Auto TTS toggle */}
                  <button
                    onClick={handleToggleAutoTTS}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      autoTTS
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    自動読み上げ: {autoTTS ? 'ON' : 'OFF'}
                  </button>

                  {/* TTS speed */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">速度:</span>
                    {([0.75, 1.0, 1.25] as const).map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleTTSSpeedChange(speed)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          ttsSpeed === speed
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

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

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast}
          duration={1500}
          onClose={() => setToast(null)}
        />
      )}

      {/* History/Bookmark Panel */}
      <HistoryPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onSelectItem={handleSelectHistoryItem}
        onPlayTTS={handlePlayTTS}
        currentView={panelView}
      />
    </main>
  );
}
