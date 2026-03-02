import { z } from 'zod';

export interface ClassificationResult {
  isInvoice: boolean;
  confidence: number; // 0.0 - 1.0
  type: 'attachment' | 'portal_link' | 'none';
  method: 'heuristic' | 'llm';
  documentType: string; // 'invoice', 'receipt', 'statement', 'offer', 'newsletter', 'spam', 'other'
  matchedAttachments: Array<{
    filename: string;
    mimeType: string;
    attachmentId: string;
    size: number;
  }>;
  portalUrls: string[];
}

export const llmClassificationSchema = z.object({
  isInvoice: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
  documentType: z.enum([
    'invoice',
    'receipt',
    'statement',
    'offer',
    'newsletter',
    'spam',
    'other',
  ]),
});

export type LlmClassification = z.infer<typeof llmClassificationSchema>;
