import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOpenAIClient } from '@/lib/openai';

const inputSchema = z.object({ text: z.string(), lang: z.enum(['ja', 'en']) });
const outputSchema = z.object({ text: z.string(), lang: z.enum(['ja', 'en']) });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = inputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.format() }, { status: 400 });
    }
    const { text, lang } = parsed.data;
    const target = lang === 'ja' ? 'en' : 'ja';

    // Demo mode: return mock translation
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'demo') {
      const mockTranslations: Record<string, string> = {
        'こんにちは、旭川へようこそ': 'Hello, welcome to Asahikawa',
        'Hello, how are you?': 'こんにちは、お元気ですか？',
        'Where is the zoo?': '動物園はどこですか？',
        '旭山動物園はどこですか？': 'Where is Asahiyama Zoo?',
      };
      const translated = mockTranslations[text] || (target === 'ja' ? 'こんにちは' : 'Hello');
      const data = { text: translated, lang: target } as const;
      const out = outputSchema.safeParse(data);
      if (!out.success) {
        return NextResponse.json({ error: 'Validation error', details: out.error.format() }, { status: 400 });
      }
      return NextResponse.json(out.data, { headers: { 'Cache-Control': 'no-store' } });
    }

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


