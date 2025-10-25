import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAIClient } from '@/lib/openai';

const inputSchema = z.object({ text: z.string(), lang: z.enum(['ja', 'en']) });
const outputSchema = z.object({ text: z.string(), lang: z.enum(['ja', 'en']) });

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
    const target = lang === 'ja' ? 'en' : 'ja';

    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a professional translator. Output strict JSON: {"text": "<translation>"}. No explanations. Keep tone polite and concise.',
        },
        {
          role: 'user',
          content: `Translate to ${target === 'ja' ? 'Japanese' : 'English'}: ${text}`,
        },
      ],
      max_tokens: 120,
    });

    const content = completion.choices?.[0]?.message?.content || '{}';
    let translated = '';
    try {
      const json = JSON.parse(content);
      translated = typeof json.text === 'string' ? json.text.trim() : '';
    } catch {
      translated = (content || '').trim();
    }
    const data = { text: translated, lang: target } as const;
    const out = outputSchema.safeParse(data);
    if (!out.success) {
      return NextResponse.json({ error: 'Validation error', details: out.error.format() }, { status: 400 });
    }
    return NextResponse.json(out.data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Translate error', e);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}


