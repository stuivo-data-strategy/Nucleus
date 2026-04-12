// ─── Types ────────────────────────────────────────────────────────────────────

export type Intent =
  | 'claims_list'
  | 'largest_claims'
  | 'spend_by_category'
  | 'claims_by_status'
  | 'spend_over_time'
  | 'average_claim'
  | 'policy_changes'
  | 'top_spenders'
  | 'policy_violations'
  | 'duplicates'
  | 'unknown';

export type ResponseType =
  | 'table'
  | 'bar_chart'
  | 'donut_chart'
  | 'line_chart'
  | 'summary_card'
  | 'timeline'
  | 'unknown';

export interface QueryParams {
  category?: string;
  status?: string | string[];
  dateFrom?: string;
  dateTo?: string;
  personName?: string;
}

export interface ReportResult {
  responseType: ResponseType;
  data: any[];
  meta: Record<string, any>;
  intent: Intent;
  params: QueryParams;
  label: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'meals', 'travel', 'accommodation', 'transport',
  'office_supplies', 'training', 'mileage', 'other',
];

const MONTH_NAMES: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8,
  oct: 9, nov: 10, dec: 11,
};

// ─── Date extraction ──────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

function extractDateRange(input: string): { dateFrom?: string; dateTo?: string } {
  const lower = input.toLowerCase();
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (lower.includes('this month') || lower.includes('this week')) {
    return { dateFrom: fmt(new Date(y, m, 1)), dateTo: fmt(new Date(y, m + 1, 0)) };
  }
  if (lower.includes('last month')) {
    return { dateFrom: fmt(new Date(y, m - 1, 1)), dateTo: fmt(new Date(y, m, 0)) };
  }
  if (lower.includes('this year') || lower.includes('ytd') || lower.includes('year to date')) {
    return { dateFrom: `${y}-01-01`, dateTo: fmt(new Date(y, 11, 31)) };
  }
  if (lower.includes('last year')) {
    return { dateFrom: `${y - 1}-01-01`, dateTo: `${y - 1}-12-31` };
  }
  if (lower.includes('this quarter') || lower.includes('this q')) {
    const q = Math.floor(m / 3);
    return { dateFrom: fmt(new Date(y, q * 3, 1)), dateTo: fmt(new Date(y, q * 3 + 3, 0)) };
  }
  if (lower.includes('last quarter') || lower.includes('last q')) {
    const q = Math.floor(m / 3) - 1;
    const qAdj = q < 0 ? 3 : q;
    const yAdj = q < 0 ? y - 1 : y;
    return { dateFrom: fmt(new Date(yAdj, qAdj * 3, 1)), dateTo: fmt(new Date(yAdj, qAdj * 3 + 3, 0)) };
  }
  for (const [name, idx] of Object.entries(MONTH_NAMES)) {
    if (lower.includes(name)) {
      const targetYear = idx > m ? y - 1 : y;
      return { dateFrom: fmt(new Date(targetYear, idx, 1)), dateTo: fmt(new Date(targetYear, idx + 1, 0)) };
    }
  }
  return {};
}

// ─── Field extraction ─────────────────────────────────────────────────────────

function extractCategory(input: string): string | undefined {
  const lower = input.toLowerCase();
  for (const cat of CATEGORIES) if (lower.includes(cat)) return cat;
  if (lower.includes('hotel')) return 'accommodation';
  if (lower.includes('taxi') || lower.includes('uber') || lower.includes('cab')) return 'transport';
  if (lower.includes('food') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('restaurant')) return 'meals';
  if (lower.includes('train') || lower.includes('flight') || lower.includes('rail')) return 'travel';
  if (lower.includes('supplies') || lower.includes('stationery')) return 'office_supplies';
  if (lower.includes('mile') || lower.includes('petrol') || lower.includes('fuel')) return 'mileage';
  return undefined;
}

function extractStatus(input: string): string | string[] | undefined {
  const lower = input.toLowerCase();
  if (lower.includes('pending') || lower.includes('awaiting') || lower.includes('waiting')) return ['pending', 'queried'];
  if (lower.includes('approved')) return 'approved';
  if (lower.includes('rejected') || lower.includes('declined')) return 'rejected';
  if (lower.includes('queried') || lower.includes('query')) return 'queried';
  if (lower.includes('submitted')) return 'submitted';
  return undefined;
}

const STOP_WORDS = new Set([
  'show', 'me', 'find', 'get', 'list', 'all', 'the', 'for', 'by', 'from', 'in',
  'expenses', 'claims', 'expense', 'claim', 'this', 'last', 'month', 'year',
  'week', 'quarter', 'with', 'any', 'what', 'how', 'much', 'spend', 'total',
  'who', 'are', 'top', 'spenders', 'policy', 'changes', 'recent', 'pending',
  'approved', 'rejected', 'violations', 'over', 'limit', 'duplicates', 'trend',
  'category', 'meals', 'travel', 'accommodation', 'transport', 'training',
  'mileage', 'other', 'april', 'march', 'january', 'february', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december', 'status',
  'breakdown', 'split', 'average', 'largest', 'biggest', 'time', 'monthly',
]);

function extractPersonName(input: string): string | undefined {
  const words = input.replace(/[^a-zA-Z\s]/g, '').split(/\s+/);
  const nameWords = words.filter(w =>
    w.length > 2 && /^[A-Z]/.test(w) && !STOP_WORDS.has(w.toLowerCase())
  );
  return nameWords.length > 0 ? nameWords[0] : undefined;
}

// ─── Intent detection ─────────────────────────────────────────────────────────

function detectIntent(input: string): Intent {
  const lower = input.toLowerCase();

  // Policy changes — check early before generic "policy" matches
  if (lower.includes('policy change') || lower.includes('rule change') ||
      lower.includes('limit change') || lower.includes('policy update') ||
      lower.includes('admin change')) {
    return 'policy_changes';
  }

  // Violations
  if (lower.includes('over limit') || lower.includes('exceeded') ||
      lower.includes('violation') || lower.includes('policy fail') ||
      lower.includes('breach') || lower.includes('non-compliant')) {
    return 'policy_violations';
  }

  // Duplicates
  if (lower.includes('duplicate') || lower.includes('double') || lower.includes('same claim')) {
    return 'duplicates';
  }

  // Average claim
  if (lower.includes('average') || lower.includes('avg') || lower.includes('mean')) {
    return 'average_claim';
  }

  // Spend over time / trend
  if (lower.includes('over time') || lower.includes('monthly') || lower.includes('by month') ||
      lower.includes('trend') || lower.includes('month by month') || lower.includes('per month')) {
    return 'spend_over_time';
  }

  // Claims by status (donut)
  if (lower.includes('by status') || lower.includes('status breakdown') ||
      lower.includes('status split') || lower.includes('claims by status') ||
      lower.includes('status distribution')) {
    return 'claims_by_status';
  }

  // Largest claims
  if (lower.includes('largest') || lower.includes('biggest expense') ||
      lower.includes('biggest claim') || lower.includes('top 10') ||
      lower.includes('most expensive')) {
    return 'largest_claims';
  }

  // Top spenders (by person)
  if (lower.includes('top spend') || lower.includes('who spent') ||
      lower.includes('biggest spend') || lower.includes('most spend') ||
      lower.includes('highest spend') || lower.includes('who spend') ||
      lower.includes('by person') || lower.includes('per person')) {
    return 'top_spenders';
  }

  // Spend by category (bar chart)
  if ((lower.includes('total') || lower.includes('how much') || lower.includes('sum') ||
       lower.includes('breakdown') || lower.includes('by category') ||
       lower.includes('per category') || lower.includes('spend')) &&
      !lower.includes('top spend') && !lower.includes('who spent')) {
    return 'spend_by_category';
  }

  // Claims list — broad fallback
  if (lower.includes('claims') || lower.includes('expenses') || lower.includes('show') ||
      lower.includes('list') || lower.includes('find') || lower.includes('pending') ||
      lower.includes('approved') || lower.includes('rejected') ||
      extractCategory(lower) || extractPersonName(input)) {
    return 'claims_list';
  }

  return 'unknown';
}

// ─── Label builder ────────────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  meals: 'Meals', travel: 'Travel', accommodation: 'Accommodation',
  transport: 'Transport', office_supplies: 'Office Supplies',
  training: 'Training', mileage: 'Mileage', other: 'Other',
};

function buildLabel(intent: Intent, params: QueryParams, input: string): string {
  const cat = params.category ? CAT_LABELS[params.category] ?? params.category : null;
  const dateLabel = params.dateFrom ? `${params.dateFrom} → ${params.dateTo ?? 'now'}` : null;

  switch (intent) {
    case 'claims_list': {
      const parts: string[] = [];
      if (cat) parts.push(cat);
      const s = params.status;
      if (s) parts.push(Array.isArray(s) ? s.join('/') : s);
      if (params.personName) parts.push(`for ${params.personName}`);
      if (dateLabel) parts.push(dateLabel);
      return `Claims${parts.length ? ': ' + parts.join(', ') : ''}`;
    }
    case 'largest_claims':
      return 'Top 10 largest claims';
    case 'spend_by_category':
      return dateLabel ? `Spend by category (${dateLabel})` : 'Spend by category';
    case 'claims_by_status':
      return dateLabel ? `Claims by status (${dateLabel})` : 'Claims by status';
    case 'spend_over_time':
      return dateLabel ? `Monthly spend trend (${dateLabel})` : 'Monthly spend trend';
    case 'average_claim':
      return cat ? `Average ${cat} claim` : 'Average claim value';
    case 'policy_changes':
      return 'Recent policy changes';
    case 'top_spenders':
      return dateLabel ? `Top spenders (${dateLabel})` : 'Top spenders';
    case 'policy_violations':
      return cat ? `Policy violations — ${cat}` : 'Policy violations';
    case 'duplicates':
      return 'Potential duplicate claims';
    default:
      return input;
  }
}

// ─── responseType mapping ─────────────────────────────────────────────────────

function intentToResponseType(intent: Intent): ResponseType {
  switch (intent) {
    case 'spend_by_category': return 'bar_chart';
    case 'top_spenders':      return 'bar_chart';
    case 'claims_by_status':  return 'donut_chart';
    case 'spend_over_time':   return 'line_chart';
    case 'average_claim':     return 'summary_card';
    case 'policy_changes':    return 'timeline';
    case 'duplicates':        return 'timeline';
    case 'claims_list':
    case 'largest_claims':
    case 'policy_violations': return 'table';
    default:                  return 'unknown';
  }
}

// ─── Main API ─────────────────────────────────────────────────────────────────

const BASE = 'http://localhost:3001/api/v1';

export async function runQuery(input: string): Promise<ReportResult> {
  const intent = detectIntent(input);
  const params: QueryParams = {
    category:   extractCategory(input),
    status:     extractStatus(input),
    personName: (intent === 'top_spenders' || intent === 'spend_by_category') ? undefined : extractPersonName(input),
    ...extractDateRange(input),
  };

  // Intents that don't use status filter
  if (['policy_violations', 'top_spenders', 'spend_by_category',
       'claims_by_status', 'spend_over_time', 'average_claim'].includes(intent)) {
    delete params.status;
  }

  const label = buildLabel(intent, params, input);

  if (intent === 'unknown') {
    return { responseType: 'unknown', data: [], meta: {}, intent, params, label: input };
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('nucleus_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/reports/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ intent, params }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json();

  // Server may return a responseType; fall back to our own mapping for robustness
  const responseType: ResponseType =
    (json.responseType && json.responseType !== 'unknown')
      ? json.responseType
      : intentToResponseType(intent);

  return {
    responseType,
    data:   json.data ?? [],
    meta:   json.meta ?? {},
    intent,
    params,
    label,
  };
}

export const SUGGESTIONS = [
  'Show me meals expenses this month',
  "What's our total spend by category?",
  'Any policy changes recently?',
  'Show pending claims',
  'Who are the top spenders?',
  '📊 Spend by category',
  '🍩 Claims by status',
  '📈 Spend trend over time',
  '💰 Top 10 largest claims',
];

// Shown at welcome — first 5 are text, last 4 are visual
export const WELCOME_SUGGESTIONS = SUGGESTIONS.slice(0, 5);
export const CHART_SUGGESTIONS   = SUGGESTIONS.slice(5);
