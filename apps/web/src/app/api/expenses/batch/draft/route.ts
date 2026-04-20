import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { header, lineItems } = body;

    // Generate a stable draft ID
    const draftId = `draft-${Date.now()}`;

    return NextResponse.json({
      data: {
        id: draftId,
        title: header?.contextLabel || 'Untitled Batch Claim',
        lineCount: lineItems?.length ?? 0,
        totalAmount: (lineItems ?? []).reduce(
          (s: number, l: any) => s + (l.amount ?? 0),
          0
        ),
        savedAt: new Date().toISOString(),
        status: 'draft',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
