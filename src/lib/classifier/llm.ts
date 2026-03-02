import OpenAI from 'openai';
import type { ParsedEmail } from '@/types';
import type { ClassificationResult } from './types';
import { llmClassificationSchema } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function classifyWithLlm(
  email: ParsedEmail
): Promise<ClassificationResult | null> {
  if (process.env.ENABLE_LLM_CLASSIFICATION !== 'true') {
    return null;
  }

  const bodyPreview = stripHtml(email.bodyHtml || email.bodyText).slice(
    0,
    500
  );
  const attachmentInfo = email.attachments
    .map((a) => `${a.filename || 'unnamed'} (${a.mimeType})`)
    .join(', ');

  const systemPrompt = `You classify emails as invoice-related or not. Respond only with valid JSON matching the schema.`;

  const userPrompt = `Classify this email:
From: ${email.fromName || email.from} <${email.from}>
Subject: ${email.subject}
Attachments: ${attachmentInfo || 'none'}
Body preview: ${bodyPreview}

Respond with JSON: { "isInvoice": boolean, "confidence": number 0-1, "reasoning": string max 200 chars, "documentType": "invoice"|"receipt"|"statement"|"offer"|"newsletter"|"spam"|"other" }`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(content);
      const validated = llmClassificationSchema.safeParse(parsed);

      if (!validated.success) continue;

      const v = validated.data;

      const matchedAttachments =
        v.isInvoice && email.attachments.length > 0
          ? email.attachments.map((a) => ({
              filename: a.filename || '',
              mimeType: a.mimeType,
              attachmentId: a.attachmentId,
              size: a.size,
            }))
          : [];

      return {
        isInvoice: v.isInvoice,
        confidence: v.confidence,
        type:
          matchedAttachments.length > 0
            ? 'attachment'
            : 'none',
        method: 'llm',
        documentType: v.documentType,
        matchedAttachments,
        portalUrls: [],
      };
    } catch {
      if (attempt === 2) return null;
    }
  }

  return null;
}
