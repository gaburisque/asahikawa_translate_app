import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAIClient } from '@/lib/openai';

const outputSchema = z.object({
  text: z.string(),
  lang: z.enum(['ja', 'en']),
});

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Server misconfigured: OPENAI_API_KEY not set' }, { status: 500 });
    }
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio is required' }, { status: 400 });
    }

    const openai = getOpenAIClient();

    // Whisper transcription with slight domain prompt (Asahikawa)
    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      temperature: 0.1,
      // Domain hints: Asahikawa, Asahiyama Zoo, Hokkaido, ramen, sightseeing
      prompt: '旭川, 旭山動物園, 北海道, ラーメン, 観光',
    } as any);

    const text = (transcription as any)?.text || '';
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


