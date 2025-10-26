import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAIClient } from '@/lib/openai';

const outputSchema = z.object({
  text: z.string(),
  lang: z.enum(['ja', 'en']),
});

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio is required' }, { status: 400 });
    }

    // Validate audio file size (min 1KB to avoid empty/silent recordings)
    if (audio.size < 1024) {
      return NextResponse.json({ error: '録音データが小さすぎます。もう一度お試しください。' }, { status: 400 });
    }

    // Demo mode: return mock response
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo') {
      const mockText = 'こんにちは、旭川へようこそ';
      const result = { text: mockText, lang: 'ja' as const };
      const parsed = outputSchema.safeParse(result);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
      }
      return NextResponse.json(parsed.data, { headers: { 'Cache-Control': 'no-store' } });
    }

    const openai = getOpenAIClient();

    // Whisper transcription without prompt to avoid hallucination on short audio
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      temperature: 0.1,
      // Note: prompt removed to prevent hallucination of prompt text on silent/short recordings
    } as any);

    const text = (transcription as any)?.text?.trim() || '';
    
    // Validate transcription result
    if (!text || text.length < 2) {
      return NextResponse.json({ error: '音声を認識できませんでした。もう一度はっきり話してください。' }, { status: 400 });
    }

    // Filter out known hallucination phrases from Whisper API
    const blockedPhrases = [
      'MBCニュースのキム・ジェギョンです。',
      'MBCニュース',
      'キム・ジェギョン',
      'ご視聴ありがとうございました',
      'Thank you for watching',
      'Subscribe to our channel',
      'ご視聴ありがとう',
      'チャンネル登録',
      '字幕',
      'Subtitle',
    ];

    const textLower = text.toLowerCase();
    const isBlockedPhrase = blockedPhrases.some(phrase => {
      const phraseLower = phrase.toLowerCase();
      // Exact match or very high similarity
      return text === phrase || 
             textLower === phraseLower ||
             (text.includes(phrase) && text.length < phrase.length + 5);
    });

    if (isBlockedPhrase) {
      console.warn('[ASR] Blocked hallucination phrase:', text);
      return NextResponse.json({ error: '音声を認識できませんでした。もう一度はっきり話してください。' }, { status: 400 });
    }
    
    // Heuristic language detect (ja vs en)
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
    const lang = (hasJapanese ? 'ja' : 'en') as 'ja' | 'en';

    const data = { text, lang };
    const parsed = outputSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
    }

    return NextResponse.json(parsed.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('ASR error', e);
    return NextResponse.json({ error: 'ASR processing failed' }, { status: 500 });
  }
}


