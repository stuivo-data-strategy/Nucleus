// Client-side intent detection and query engine for the Reports Chat.
// Ported from apps/web/src/lib/reports-engine.ts.

class QueryParams {
  final String? category;
  final dynamic status; // String or List<String>
  final String? dateFrom;
  final String? dateTo;
  final String? personName;

  const QueryParams({
    this.category,
    this.status,
    this.dateFrom,
    this.dateTo,
    this.personName,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{};
    if (category != null) map['category'] = category;
    if (status != null) map['status'] = status;
    if (dateFrom != null) map['dateFrom'] = dateFrom;
    if (dateTo != null) map['dateTo'] = dateTo;
    if (personName != null) map['personName'] = personName;
    return map;
  }
}

enum ReportIntent {
  claimsList,
  largestClaims,
  spendByCategory,
  claimsByStatus,
  spendOverTime,
  averageClaim,
  policyChanges,
  topSpenders,
  policyViolations,
  duplicates,
  unknown,
}

enum ResponseType {
  table,
  barChart,
  donutChart,
  lineChart,
  summaryCard,
  timeline,
  unknown,
}

ResponseType responseTypeForIntent(ReportIntent intent) {
  switch (intent) {
    case ReportIntent.spendByCategory:
    case ReportIntent.topSpenders:
      return ResponseType.barChart;
    case ReportIntent.claimsByStatus:
      return ResponseType.donutChart;
    case ReportIntent.spendOverTime:
      return ResponseType.lineChart;
    case ReportIntent.averageClaim:
      return ResponseType.summaryCard;
    case ReportIntent.policyChanges:
    case ReportIntent.duplicates:
      return ResponseType.timeline;
    case ReportIntent.claimsList:
    case ReportIntent.largestClaims:
    case ReportIntent.policyViolations:
      return ResponseType.table;
    case ReportIntent.unknown:
      return ResponseType.unknown;
  }
}

String intentToApiString(ReportIntent intent) {
  switch (intent) {
    case ReportIntent.claimsList:
      return 'claims_list';
    case ReportIntent.largestClaims:
      return 'largest_claims';
    case ReportIntent.spendByCategory:
      return 'spend_by_category';
    case ReportIntent.claimsByStatus:
      return 'claims_by_status';
    case ReportIntent.spendOverTime:
      return 'spend_over_time';
    case ReportIntent.averageClaim:
      return 'average_claim';
    case ReportIntent.policyChanges:
      return 'policy_changes';
    case ReportIntent.topSpenders:
      return 'top_spenders';
    case ReportIntent.policyViolations:
      return 'policy_violations';
    case ReportIntent.duplicates:
      return 'duplicates';
    case ReportIntent.unknown:
      return 'unknown';
  }
}

class DetectionResult {
  final ReportIntent intent;
  final QueryParams params;

  const DetectionResult({required this.intent, required this.params});
}

DetectionResult detectIntent(String query) {
  final q = query.toLowerCase().trim();

  // Determine intent by keyword matching (order matters)
  ReportIntent intent = ReportIntent.unknown;

  if (_matches(q, ['policy change', 'rule change', 'limit change', 'policy update'])) {
    intent = ReportIntent.policyChanges;
  } else if (_matches(q, ['over limit', 'exceeded', 'violation', 'breach', 'non-compliant'])) {
    intent = ReportIntent.policyViolations;
  } else if (_matches(q, ['duplicate', 'double', 'same claim'])) {
    intent = ReportIntent.duplicates;
  } else if (_matches(q, ['average', 'avg', 'mean'])) {
    intent = ReportIntent.averageClaim;
  } else if (_matches(q, ['over time', 'monthly', 'by month', 'trend', 'month by month', 'per month'])) {
    intent = ReportIntent.spendOverTime;
  } else if (_matches(q, ['by status', 'status breakdown', 'status split', 'status distribution'])) {
    intent = ReportIntent.claimsByStatus;
  } else if (_matches(q, ['largest', 'biggest expense', 'top 10', 'most expensive'])) {
    intent = ReportIntent.largestClaims;
  } else if (_matches(q, ['top spend', 'who spent', 'biggest spend', 'highest spend', 'by person', 'per person'])) {
    intent = ReportIntent.topSpenders;
  } else if (_matches(q, ['total', 'how much', 'sum', 'breakdown', 'by category', 'per category', 'spend'])) {
    intent = ReportIntent.spendByCategory;
  } else if (_matchesAny(q, ['claim', 'expense', 'receipt', ...categoryKeywords])) {
    intent = ReportIntent.claimsList;
  }

  // Extract params
  final params = QueryParams(
    category: _extractCategory(q),
    status: _extractStatus(q),
    dateFrom: _extractDateRange(q)?.$1,
    dateTo: _extractDateRange(q)?.$2,
    personName: _extractPersonName(query), // use original case
  );

  return DetectionResult(intent: intent, params: params);
}

bool _matches(String q, List<String> keywords) =>
    keywords.any((k) => q.contains(k));

bool _matchesAny(String q, List<String> words) =>
    words.any((w) => q.contains(w));

const categoryKeywords = [
  'meals', 'travel', 'accommodation', 'transport', 'office',
  'training', 'mileage', 'hotel', 'taxi', 'uber', 'food',
  'lunch', 'dinner', 'flight', 'train', 'petrol', 'fuel',
];

String? _extractCategory(String q) {
  final synonyms = {
    'hotel': 'accommodation',
    'taxi': 'transport',
    'uber': 'transport',
    'cab': 'transport',
    'food': 'meals',
    'lunch': 'meals',
    'dinner': 'meals',
    'restaurant': 'meals',
    'train': 'travel',
    'flight': 'travel',
    'rail': 'travel',
    'supplies': 'office_supplies',
    'stationery': 'office_supplies',
    'mile': 'mileage',
    'petrol': 'mileage',
    'fuel': 'mileage',
  };

  for (final entry in synonyms.entries) {
    if (q.contains(entry.key)) return entry.value;
  }

  const direct = [
    'meals', 'travel', 'accommodation', 'transport',
    'office_supplies', 'training', 'mileage', 'other',
  ];
  for (final c in direct) {
    if (q.contains(c)) return c;
  }
  return null;
}

dynamic _extractStatus(String q) {
  if (_matches(q, ['pending', 'awaiting', 'waiting'])) {
    return ['pending', 'queried'];
  }
  if (q.contains('approved')) return 'approved';
  if (_matches(q, ['rejected', 'declined'])) return 'rejected';
  if (_matches(q, ['queried', 'query'])) return 'queried';
  if (q.contains('submitted')) return 'submitted';
  return null;
}

(String, String)? _extractDateRange(String q) {
  final now = DateTime.now();

  if (_matches(q, ['this month', 'this week'])) {
    final start = DateTime(now.year, now.month, 1);
    final end = DateTime(now.year, now.month + 1, 0);
    return (_fmt(start), _fmt(end));
  }
  if (q.contains('last month')) {
    final start = DateTime(now.year, now.month - 1, 1);
    final end = DateTime(now.year, now.month, 0);
    return (_fmt(start), _fmt(end));
  }
  if (_matches(q, ['this year', 'ytd', 'year to date'])) {
    return (_fmt(DateTime(now.year, 1, 1)), _fmt(DateTime(now.year, 12, 31)));
  }
  if (q.contains('last year')) {
    return (_fmt(DateTime(now.year - 1, 1, 1)), _fmt(DateTime(now.year - 1, 12, 31)));
  }
  if (_matches(q, ['this quarter', 'this q'])) {
    final qStart = ((now.month - 1) ~/ 3) * 3 + 1;
    return (_fmt(DateTime(now.year, qStart, 1)), _fmt(DateTime(now.year, qStart + 3, 0)));
  }
  if (_matches(q, ['last quarter', 'last q'])) {
    final qStart = ((now.month - 1) ~/ 3) * 3 + 1 - 3;
    final y = qStart < 1 ? now.year - 1 : now.year;
    final qs = qStart < 1 ? qStart + 12 : qStart;
    return (_fmt(DateTime(y, qs, 1)), _fmt(DateTime(y, qs + 3, 0)));
  }

  // Month names
  const months = {
    'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3,
    'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7,
    'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'october': 10, 'oct': 10,
    'november': 11, 'nov': 11, 'december': 12, 'dec': 12,
  };
  for (final entry in months.entries) {
    if (q.contains(entry.key)) {
      final m = entry.value;
      final y = m > now.month ? now.year - 1 : now.year;
      return (_fmt(DateTime(y, m, 1)), _fmt(DateTime(y, m + 1, 0)));
    }
  }

  return null;
}

String _fmt(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String? _extractPersonName(String original) {
  const stopWords = {
    'show', 'me', 'the', 'all', 'for', 'from', 'with', 'what', 'how',
    'much', 'many', 'are', 'there', 'get', 'list', 'find', 'any', 'has',
    'have', 'been', 'was', 'were', 'will', 'would', 'could', 'should',
    'can', 'does', 'did', 'who', 'which', 'that', 'this', 'those',
    'these', 'their', 'our', 'your', 'its', 'total', 'spend', 'spent',
    'claims', 'expenses', 'expense', 'claim', 'month', 'year', 'week',
    'last', 'next', 'recent', 'latest', 'top', 'biggest', 'largest',
    'highest', 'most', 'average', 'mean', 'sum', 'count', 'number',
    'pending', 'approved', 'rejected', 'queried', 'submitted',
    'category', 'status', 'time', 'date', 'budget', 'policy',
  };

  final words = original.split(RegExp(r'\s+'));
  final names = <String>[];
  for (final w in words) {
    // Strip trailing punctuation / possessives  e.g. "What's" → "What", "John?" → "John"
    final clean = w.replaceAll(RegExp(r"[''`?,!.;:]+\w*$"), '');
    if (clean.length <= 2) continue;
    if (clean[0] != clean[0].toUpperCase()) continue;
    if (clean == clean.toUpperCase()) continue; // all-caps
    final lower = clean.toLowerCase();
    if (stopWords.contains(lower)) continue;
    names.add(clean);
  }
  return names.isNotEmpty ? names.join(' ') : null;
}

/// The single, persistent set of suggestion chips shown beneath the input.
/// These remain visible at all times — selecting one runs the query but the
/// chips stay so the user can pick another.
const persistentSuggestions = [
  'Show me meals expenses this month',
  'Spend by category',
  'Claims by status',
  'Spend trend over time',
  'Top 10 largest claims',
];

/// Suggestions shown on the welcome screen (legacy — kept for compat).
const welcomeSuggestions = [
  'Show me meals expenses this month',
  "What's our total spend by category?",
  'Any policy changes recently?',
  'Show pending claims',
  'Who are the top spenders?',
];

/// Chart-focused suggestions.
const chartSuggestions = [
  'Spend by category',
  'Claims by status',
  'Spend trend over time',
  'Top 10 largest claims',
];
