import { NextRequest, NextResponse } from 'next/server';

// Simple counter — in production this would be a DB sequence
let refCounter = 42;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { header, lineItems } = body;

    // Server-side policy recheck — reject if any line is still a hard fail
    const failedLines = (lineItems ?? []).filter(
      (l: any) => l.effectivePolicyStatus === 'fail'
    );
    if (failedLines.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot submit: unresolved policy failures',
          failedLines: failedLines.map((l: any) => ({
            id: l.id,
            merchant: l.merchant,
            policyMessage: l.policyMessage,
          })),
        },
        { status: 422 }
      );
    }

    const year = new Date().getFullYear();
    const seq = String(refCounter++).padStart(4, '0');
    const reference = `BCH-${year}-${seq}`;

    const totalAmount = (lineItems ?? []).reduce(
      (s: number, l: any) => s + (l.amount ?? 0),
      0
    );

    return NextResponse.json({
      data: {
        reference,
        title: header?.contextLabel || 'Batch Claim',
        periodStart: header?.periodStart,
        periodEnd: header?.periodEnd,
        lineCount: lineItems?.length ?? 0,
        totalAmount,
        approver: 'Alex Drummond',
        submittedAt: new Date().toISOString(),
        status: 'submitted',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
