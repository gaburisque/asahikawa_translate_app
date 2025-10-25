import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAIClient } from '@/lib/openai';

const inputSchema = z.object({ text: z.string(), lang: z.enum(['ja', 'en']) });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = inputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
    }
    const { text, lang } = parsed.data;

    // Demo mode: return silent audio (1 sec of silence as mp3)
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo') {
      // Minimal valid MP3 (silent, ~0.3s)
      const silentMp3 = Buffer.from(
        'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAADhAC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAA4T0ESmkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7UAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
        'base64'
      );
      return new NextResponse(silentMp3, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': silentMp3.length.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-store',
        },
      });
    }

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


