import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAIClient } from '@/lib/openai';

const inputSchema = z.object({ text: z.string(), lang: z.enum(['ja', 'en']) });

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Server misconfigured: OPENAI_API_KEY not set' }, { status: 500 });
    }
    const json = await req.json().catch(() => ({}));
    const parsed = inputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
    }
    const { text, lang } = parsed.data;

    const openai = getOpenAIClient();

    const audio = await openai.audio.speech.create({
      model: 'tts-1',
      voice: lang === 'ja' ? 'alloy' : 'alloy',
      input: text,
      speed: 1.0,
      format: 'mp3',
    } as any);

    const buffer = Buffer.from(await audio.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('TTS error', e);
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 });
  }
}


