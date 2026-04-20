import { NextRequest, NextResponse } from 'next/server';

// ─── Fixed demo dataset ───────────────────────────────────────────────────────
// Cycles by index % 8. Same filename always maps to same slot → repeatable demo.

const DEMO_DATASET = [
  {
    merchant: 'Costa Coffee',
    amount: 4.80,
    category: 'meals' as const,
    inferredType: 'single' as const,
    description: 'Coffee and snack',
    policyStatus: 'ok' as const,
    confidence: 0.97,
  },
  {
    merchant: 'Travelodge Manchester',
    amount: 89.00,
    category: 'hotel' as const,
    inferredType: 'single' as const,
    description: 'Hotel accommodation — 1 night',
    policyStatus: 'ok' as const,
    confidence: 0.94,
  },
  {
    merchant: 'BP Forecourt',
    amount: 67.40,
    category: 'fuel' as const,
    inferredType: 'single' as const,
    description: 'Fuel',
    policyStatus: 'ok' as const,
    confidence: 0.91,
  },
  {
    merchant: 'Yo! Sushi (team, 4 people)',
    amount: 112.00,
    category: 'meals' as const,
    inferredType: 'group' as const,
    description: 'Team lunch — 4 attendees',
    policyStatus: 'warning' as const,
    policyMessage: 'Group expense detected — £28.00/head. Within limit but should be filed as a Group Claim.',
    confidence: 0.88,
  },
  {
    merchant: 'National Rail',
    amount: 156.00,
    category: 'travel' as const,
    inferredType: 'single' as const,
    description: 'Rail travel — Manchester return',
    policyStatus: 'ok' as const,
    confidence: 0.96,
  },
  {
    merchant: 'Marriott London',
    amount: 310.00,
    category: 'hotel' as const,
    inferredType: 'single' as const,
    description: 'Hotel — London, 1 night',
    policyStatus: 'fail' as const,
    policyMessage: 'Exceeds hotel nightly rate limit of £250.00 by £60.00. Override or adjustment required.',
    confidence: 0.93,
  },
  {
    merchant: 'Pret A Manger',
    amount: 8.20,
    category: 'meals' as const,
    inferredType: 'single' as const,
    description: 'Lunch',
    policyStatus: 'ok' as const,
    confidence: 0.99,
  },
  {
    merchant: 'Uber',
    amount: 34.50,
    category: 'travel' as const,
    inferredType: 'single' as const,
    description: 'Uber ride to client site',
    policyStatus: 'ok' as const,
    confidence: 0.95,
  },
] as const;

// Deterministic hash — no Math.random(), same name → same result
function nameHash(name: string): number {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

// Spread dates across current month deterministically
function deterministicDate(index: number): string {
  const now = new Date();
  const day = 1 + ((index * 4 + 3) % 27); // days 1–28
  return new Date(now.getFullYear(), now.getMonth(), day)
    .toISOString()
    .split('T')[0];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const files: Array<{ name: string; size: number; index: number }> =
      body.files ?? [];

    const results = files.map((file) => {
      const datasetIdx = file.index % DEMO_DATASET.length;
      const template = DEMO_DATASET[datasetIdx];
      const hash = nameHash(file.name);
      // processingMs: 1200–2400, seeded from filename
      const processingMs = 1200 + (hash % 1201);

      return {
        index: file.index,
        status: template.policyStatus === 'ok' ? 'extracted' : 'flagged',
        merchant: template.merchant,
        date: deterministicDate(file.index),
        amount: template.amount,
        currency: 'GBP',
        category: template.category,
        inferredType: template.inferredType,
        description: template.description,
        policyStatus: template.policyStatus,
        policyMessage: (template as any).policyMessage ?? null,
        confidence: template.confidence,
        processingMs,
      };
    });

    return NextResponse.json({ data: results });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
