import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import '../claims/new_claim_flow.dart';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const _categories = {
  'meals': 'Meals',
  'travel': 'Travel',
  'accommodation': 'Hotel',
  'transport': 'Transport',
  'office_supplies': 'Supplies',
  'supplies': 'Supplies',
  'training': 'Training',
  'mileage': 'Mileage',
  'other': 'Other',
};

enum VatClassification {
  fullyReclaimable,
  partiallyReclaimable,
  notReclaimable,
  zeroRated,
}

const _classLabels = {
  VatClassification.fullyReclaimable: 'Fully Reclaimable',
  VatClassification.partiallyReclaimable: 'Partially Reclaimable',
  VatClassification.notReclaimable: 'Not Reclaimable',
  VatClassification.zeroRated: 'Zero-Rated',
};

const _classColors = {
  VatClassification.fullyReclaimable: Color(0xFF15803D),
  VatClassification.partiallyReclaimable: Color(0xFF1D4ED8),
  VatClassification.notReclaimable: Color(0xFFDC2626),
  VatClassification.zeroRated: Color(0xFF6B7280),
};

String _classToApi(VatClassification c) {
  switch (c) {
    case VatClassification.fullyReclaimable:
      return 'fully_reclaimable';
    case VatClassification.partiallyReclaimable:
      return 'partially_reclaimable';
    case VatClassification.notReclaimable:
      return 'not_reclaimable';
    case VatClassification.zeroRated:
      return 'zero_rated';
  }
}

VatClassification? _classFromApi(String? s) {
  switch (s) {
    case 'fully_reclaimable':
      return VatClassification.fullyReclaimable;
    case 'partially_reclaimable':
      return VatClassification.partiallyReclaimable;
    case 'not_reclaimable':
      return VatClassification.notReclaimable;
    case 'zero_rated':
      return VatClassification.zeroRated;
    default:
      return null;
  }
}

final _currFmt = NumberFormat.currency(locale: 'en_GB', symbol: '£');

String _fmtDate(String? d) {
  if (d == null || d.isEmpty) return '—';
  try {
    return DateFormat('d MMM yyyy').format(DateTime.parse(d));
  } catch (_) {
    return d;
  }
}

double _vatFromGross(double amount) =>
    (amount / 6 * 100).round() / 100;

double _reclaimableVat(
    double amount, VatClassification cls, int businessPortion) {
  if (cls == VatClassification.zeroRated ||
      cls == VatClassification.notReclaimable) {
    return 0;
  }
  final vat = _vatFromGross(amount);
  if (cls == VatClassification.partiallyReclaimable) {
    return (vat * businessPortion / 100 * 100).round() / 100;
  }
  return vat;
}

String _currentPeriod() {
  final now = DateTime.now();
  final q = ((now.month - 1) ~/ 3) + 1;
  return '${now.year}-Q$q';
}

List<String> _periodOptions() {
  final year = DateTime.now().year;
  final options = <String>[];
  for (var y = year; y >= year - 1; y--) {
    for (var q = 4; q >= 1; q--) {
      options.add('$y-Q$q');
    }
  }
  return options;
}

// ---------------------------------------------------------------------------
// VAT Screen
// ---------------------------------------------------------------------------

class VatScreen extends StatefulWidget {
  const VatScreen({super.key});

  @override
  State<VatScreen> createState() => _VatScreenState();
}

class _VatScreenState extends State<VatScreen> {
  String _period = _currentPeriod();
  String _tab = 'queue';
  List<Map<String, dynamic>> _queue = [];
  List<Map<String, dynamic>> _summary = [];
  Map<String, dynamic>? _stats;
  bool _loading = true;
  int _classifiedCount = 0;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = context.read<AuthProvider>().apiClient;
      final results = await Future.wait([
        api.get('/vat/queue', queryParams: {'period': _period}),
        api.get('/vat/summary', queryParams: {'period': _period}),
        api.get('/vat/stats', queryParams: {'period': _period}),
      ]);

      setState(() {
        _queue = _toList(results[0]['data']?['claims']);
        _summary = _toList(results[1]['data']?['rows']);
        _stats = results[2]['data'] as Map<String, dynamic>?;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _toList(dynamic data) {
    if (data is! List) return [];
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  void _handleClassified(String id) {
    setState(() {
      _queue.removeWhere((c) => c['id'] == id);
      _classifiedCount++;
      if (_stats != null) {
        _stats!['pending_classification'] =
            ((_stats!['pending_classification'] as num?) ?? 1).toInt() - 1;
        _stats!['classified'] =
            ((_stats!['classified'] as num?) ?? 0).toInt() + 1;
      }
    });
  }

  Future<void> _handleExport() async {
    setState(() => _exporting = true);
    try {
      final api = context.read<AuthProvider>().apiClient;
      await api.post('/vat/export', body: {'period': _period});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('VAT export for $_period generated'),
            backgroundColor: NucleusColors.success,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Export failed'),
            backgroundColor: NucleusColors.error,
          ),
        );
      }
    }
    setState(() => _exporting = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;
    final isVatOfficer = user?.isVatOfficer ?? false;

    if (!isVatOfficer) {
      return const _AccessDenied();
    }

    final isDesktop = MediaQuery.of(context).size.width > kMobileBreakpoint;

    return Scaffold(
      backgroundColor: NucleusColors.background,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: EdgeInsets.symmetric(
                horizontal: isDesktop ? 32 : 16,
                vertical: isDesktop ? 24 : 16,
              ),
              children: [
                _buildHeader(isDesktop),
                const SizedBox(height: 20),
                _buildStats(isDesktop),
                const SizedBox(height: 20),
                _buildTabs(),
                const SizedBox(height: 16),
                if (_tab == 'queue') _buildQueue(isDesktop) else _buildSummary(isDesktop),
                const SizedBox(height: 32),
              ],
            ),
    );
  }

  Widget _buildHeader(bool isDesktop) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'VAT Recovery',
                style: TextStyle(
                  fontSize: isDesktop ? 28 : 22,
                  fontWeight: FontWeight.bold,
                  color: NucleusColors.primaryNavy,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Classify expense claims and prepare VAT return data',
                style: TextStyle(color: Colors.black54, fontSize: 13),
              ),
            ],
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_classifiedCount > 0)
              Container(
                margin: const EdgeInsets.only(right: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: NucleusColors.accentTeal.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: NucleusColors.accentTeal.withValues(alpha: 0.3),
                  ),
                ),
                child: Text(
                  '$_classifiedCount classified',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: NucleusColors.accentTeal,
                  ),
                ),
              ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.black12),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _period,
                  isDense: true,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: NucleusColors.primaryNavy,
                  ),
                  items: _periodOptions()
                      .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) {
                      setState(() {
                        _period = v;
                        _classifiedCount = 0;
                      });
                      _load();
                    }
                  },
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStats(bool isDesktop) {
    return GridView.count(
      crossAxisCount: isDesktop ? 4 : 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: isDesktop ? 2.2 : 1.8,
      children: [
        _StatCard(
          label: 'Pending Classification',
          value: '${_stats?['pending_classification'] ?? _queue.length}',
          sub: 'awaiting review',
        ),
        _StatCard(
          label: 'Classified',
          value: '${_stats?['classified'] ?? 0}',
          sub: 'for $_period',
          highlighted: true,
          highlightColor: NucleusColors.accentTeal,
        ),
        _StatCard(
          label: 'Total Reclaimable',
          value: _stats?['total_reclaimable'] != null
              ? _currFmt.format(_stats!['total_reclaimable'])
              : '—',
          sub: 'Box 4 estimate',
          highlighted: true,
          highlightColor: NucleusColors.success,
        ),
        _StatCard(
          label: 'Recovery Rate',
          value: _stats?['recovery_rate'] != null
              ? '${_stats!['recovery_rate']}%'
              : '—',
          sub: 'of total VAT',
        ),
      ],
    );
  }

  Widget _buildTabs() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(4),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _TabButton(
            label: 'Classification Queue${_queue.isNotEmpty ? ' (${_queue.length})' : ''}',
            active: _tab == 'queue',
            onTap: () => setState(() => _tab = 'queue'),
          ),
          _TabButton(
            label: 'VAT Summary',
            active: _tab == 'summary',
            onTap: () => setState(() => _tab = 'summary'),
          ),
        ],
      ),
    );
  }

  Widget _buildQueue(bool isDesktop) {
    if (_queue.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(48),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.black12),
        ),
        child: Column(
          children: [
            const Icon(Icons.check_circle, size: 40, color: NucleusColors.approved),
            const SizedBox(height: 12),
            const Text(
              'Queue is clear',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: NucleusColors.primaryNavy,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'All cleared claims have been classified for $_period',
              style: const TextStyle(fontSize: 13, color: Colors.black54),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => setState(() => _tab = 'summary'),
              style: FilledButton.styleFrom(
                backgroundColor: NucleusColors.accentTeal,
              ),
              child: const Text('View VAT Summary →'),
            ),
          ],
        ),
      );
    }

    return Column(
      children: _queue
          .map((claim) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _ClassificationCard(
                  claim: claim,
                  period: _period,
                  onClassified: _handleClassified,
                ),
              ))
          .toList(),
    );
  }

  Widget _buildSummary(bool isDesktop) {
    if (_summary.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(48),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.black12),
        ),
        child: const Column(
          children: [
            Icon(Icons.bar_chart, size: 40, color: NucleusColors.accentTeal),
            SizedBox(height: 12),
            Text(
              'No classified claims for this period',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: NucleusColors.primaryNavy,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Classify claims in the queue to see the VAT summary',
              style: TextStyle(fontSize: 13, color: Colors.black54),
            ),
          ],
        ),
      );
    }

    final totalReclaimable = _summary.fold<double>(
        0, (s, r) => s + ((r['reclaimable_vat'] as num?) ?? 0).toDouble());
    final totalVat = _summary.fold<double>(
        0, (s, r) => s + ((r['vat_amount'] as num?) ?? 0).toDouble());
    final totalGross = _summary.fold<double>(
        0, (s, r) => s + ((r['total_amount'] as num?) ?? 0).toDouble());
    final totalClaims = _summary.fold<int>(
        0, (s, r) => s + ((r['claim_count'] as num?) ?? 0).toInt());

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Box 4 header + export button
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'BOX 4 SUMMARY',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                      color: Colors.black38,
                    ),
                  ),
                  Text(
                    _currFmt.format(totalReclaimable),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: NucleusColors.success,
                    ),
                  ),
                  const Text(
                    'total VAT to reclaim',
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                ],
              ),
            ),
            FilledButton.icon(
              onPressed: _exporting ? null : _handleExport,
              icon: _exporting
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.download, size: 16),
              label: const Text('Export CSV (Box 4)'),
              style: FilledButton.styleFrom(
                backgroundColor: NucleusColors.primaryNavy,
                textStyle:
                    const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),

        const SizedBox(height: 16),

        // Summary table
        Card(
          child: isDesktop
              ? _buildDesktopSummaryTable(
                  totalGross, totalVat, totalReclaimable, totalClaims)
              : _buildMobileSummaryList(
                  totalGross, totalVat, totalReclaimable, totalClaims),
        ),
      ],
    );
  }

  Widget _buildDesktopSummaryTable(
      double totalGross, double totalVat, double totalReclaimable, int totalClaims) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columnSpacing: 20,
        headingRowHeight: 44,
        dataRowMinHeight: 44,
        dataRowMaxHeight: 48,
        headingTextStyle: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: Colors.black45,
          letterSpacing: 1,
        ),
        columns: const [
          DataColumn(label: Text('CATEGORY')),
          DataColumn(label: Text('CLAIMS'), numeric: true),
          DataColumn(label: Text('GROSS'), numeric: true),
          DataColumn(label: Text('VAT (20%)'), numeric: true),
          DataColumn(label: Text('RECLAIMABLE'), numeric: true),
          DataColumn(label: Text('CLASSIFICATION')),
        ],
        rows: [
          ..._summary.map((row) {
            final catKey = (row['category'] ?? '').toString();
            final label = _categories[catKey] ?? catKey;

            final dominant = _dominantClassification(row);

            return DataRow(cells: [
              DataCell(Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(categoryIcon(catKey), size: 14, color: NucleusColors.accentTeal),
                  const SizedBox(width: 6),
                  Text(label,
                      style: const TextStyle(
                          fontWeight: FontWeight.w500,
                          color: NucleusColors.primaryNavy)),
                ],
              )),
              DataCell(Text('${row['claim_count'] ?? 0}',
                  style: const TextStyle(color: Colors.black54))),
              DataCell(Text(
                _currFmt.format((row['total_amount'] as num?)?.toDouble() ?? 0),
                style: NucleusTheme.monoAmount(fontSize: 13, color: Colors.black54),
              )),
              DataCell(Text(
                _currFmt.format((row['vat_amount'] as num?)?.toDouble() ?? 0),
                style: NucleusTheme.monoAmount(fontSize: 13, color: Colors.black45),
              )),
              DataCell(Text(
                _currFmt.format(
                    (row['reclaimable_vat'] as num?)?.toDouble() ?? 0),
                style: NucleusTheme.monoAmount(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: NucleusColors.success),
              )),
              DataCell(dominant != null ? _classBadge(dominant) : const SizedBox()),
            ]);
          }),
          // Footer row
          DataRow(
            color: WidgetStateProperty.all(Colors.grey.shade50),
            cells: [
              const DataCell(Text('Total',
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: NucleusColors.primaryNavy))),
              DataCell(Text('$totalClaims',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: NucleusColors.primaryNavy))),
              DataCell(Text(
                _currFmt.format(totalGross),
                style: NucleusTheme.monoAmount(
                    fontSize: 13, color: NucleusColors.primaryNavy),
              )),
              DataCell(Text(
                _currFmt.format(totalVat),
                style: NucleusTheme.monoAmount(
                    fontSize: 13, color: NucleusColors.primaryNavy),
              )),
              DataCell(Text(
                _currFmt.format(totalReclaimable),
                style: NucleusTheme.monoAmount(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: NucleusColors.success),
              )),
              const DataCell(SizedBox()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMobileSummaryList(
      double totalGross, double totalVat, double totalReclaimable, int totalClaims) {
    return Column(
      children: [
        ..._summary.map((row) {
          final catKey = (row['category'] ?? '').toString();
          final label = _categories[catKey] ?? catKey;

          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.black12)),
            ),
            child: Row(
              children: [
                Icon(categoryIcon(catKey), size: 18, color: NucleusColors.accentTeal),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label,
                          style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: NucleusColors.primaryNavy)),
                      Text(
                        '${row['claim_count'] ?? 0} claims · Gross: ${_currFmt.format((row['total_amount'] as num?)?.toDouble() ?? 0)}',
                        style:
                            const TextStyle(fontSize: 11, color: Colors.black45),
                      ),
                    ],
                  ),
                ),
                Text(
                  _currFmt.format(
                      (row['reclaimable_vat'] as num?)?.toDouble() ?? 0),
                  style: NucleusTheme.monoAmount(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: NucleusColors.success),
                ),
              ],
            ),
          );
        }),
        // Footer
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: Colors.grey.shade50,
          child: Row(
            children: [
              const Expanded(
                child: Text('Total',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: NucleusColors.primaryNavy)),
              ),
              Text(
                _currFmt.format(totalReclaimable),
                style: NucleusTheme.monoAmount(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: NucleusColors.success),
              ),
            ],
          ),
        ),
      ],
    );
  }

  VatClassification? _dominantClassification(Map<String, dynamic> row) {
    final breakdown =
        row['classification_breakdown'] as Map<String, dynamic>? ?? {};
    if (breakdown.isEmpty) return null;
    String? best;
    num bestCount = 0;
    for (final e in breakdown.entries) {
      if ((e.value as num) > bestCount) {
        bestCount = e.value as num;
        best = e.key;
      }
    }
    return _classFromApi(best);
  }

  Widget _classBadge(VatClassification cls) {
    final color = _classColors[cls] ?? Colors.grey;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        _classLabels[cls] ?? '',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Access denied
// ---------------------------------------------------------------------------

class _AccessDenied extends StatelessWidget {
  const _AccessDenied();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.lock, size: 48, color: Colors.grey),
          SizedBox(height: 12),
          Text(
            'VAT Officer access required',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 18,
              color: NucleusColors.primaryNavy,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Switch to Daniel Frost (Management Accountant)\nto access VAT recovery.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Colors.black54),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final bool highlighted;
  final Color highlightColor;

  const _StatCard({
    required this.label,
    required this.value,
    required this.sub,
    this.highlighted = false,
    this.highlightColor = NucleusColors.primaryNavy,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: highlighted
            ? highlightColor.withValues(alpha: 0.06)
            : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: highlighted
              ? highlightColor.withValues(alpha: 0.3)
              : Colors.black12,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
              color: highlighted
                  ? highlightColor.withValues(alpha: 0.6)
                  : Colors.black38,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: highlighted ? highlightColor : NucleusColors.primaryNavy,
            ),
          ),
          Text(
            sub,
            style: TextStyle(
              fontSize: 11,
              color: highlighted
                  ? highlightColor.withValues(alpha: 0.6)
                  : Colors.black38,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------

class _TabButton extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _TabButton({
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          boxShadow: active
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 4,
                  )
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
            color: active ? NucleusColors.primaryNavy : Colors.black45,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Classification Card
// ---------------------------------------------------------------------------

class _ClassificationCard extends StatefulWidget {
  final Map<String, dynamic> claim;
  final String period;
  final ValueChanged<String> onClassified;

  const _ClassificationCard({
    required this.claim,
    required this.period,
    required this.onClassified,
  });

  @override
  State<_ClassificationCard> createState() => _ClassificationCardState();
}

class _ClassificationCardState extends State<_ClassificationCard> {
  late VatClassification _classification;
  int _businessPortion = 50;
  final _vatNoController = TextEditingController();
  bool _saving = false;
  bool _done = false;

  Map<String, dynamic> get c => widget.claim;

  double get _amount =>
      ((c['claim_amount'] ?? c['amount'] ?? 0) as num).toDouble();

  @override
  void initState() {
    super.initState();
    _classification =
        _classFromApi(c['auto_classification']?.toString()) ??
            VatClassification.fullyReclaimable;
  }

  @override
  void dispose() {
    _vatNoController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final api = context.read<AuthProvider>().apiClient;
      final body = <String, dynamic>{
        'classification': _classToApi(_classification),
        'period': widget.period,
      };
      if (_classification == VatClassification.partiallyReclaimable) {
        body['business_portion'] = _businessPortion;
      }
      if (_vatNoController.text.isNotEmpty) {
        body['supplier_vat_number'] = _vatNoController.text;
      }

      await api.post(
        '/vat/${Uri.encodeComponent(c['id'])}/classify',
        body: body,
      );
      setState(() => _done = true);
      Future.delayed(const Duration(milliseconds: 600), () {
        widget.onClassified(c['id']);
      });
    } catch (_) {
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final catKey = (c['category'] ?? '').toString();
    final catLabel = _categories[catKey] ?? catKey;
    final vatAmt = _vatFromGross(_amount);
    final reclaimAmt =
        _reclaimableVat(_amount, _classification, _businessPortion);
    final autoClass = _classFromApi(c['auto_classification']?.toString());
    final isAutoMatch = _classification == autoClass;

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 300),
      opacity: _done ? 0.0 : 1.0,
      child: Card(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Colors.black12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header ──────────────────────────────────────
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    margin: const EdgeInsets.only(right: 10),
                    decoration: const BoxDecoration(
                      color: NucleusColors.primaryNavy,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      (c['claimant_initials'] ?? '').toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              (c['claimant_name'] ?? '').toString(),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                color: NucleusColors.primaryNavy,
                              ),
                            ),
                            Text(
                              (c['reference'] ?? '').toString(),
                              style: NucleusTheme.monoAmount(
                                  fontSize: 11, color: Colors.black26),
                            ),
                            if (c['partial_claim'] == true)
                              _badge('Partial', const Color(0xFF3b82f6)),
                            if (c['exception_requested'] == true)
                              _badge('Exception', NucleusColors.warning),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Icon(categoryIcon(catKey), size: 13, color: Colors.black54),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                '${c['description'] ?? catLabel} · ${_fmtDate(c['date']?.toString())}',
                                style: const TextStyle(fontSize: 12, color: Colors.black54),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        _currFmt.format(_amount),
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: NucleusColors.primaryNavy,
                        ),
                      ),
                      Text(
                        'VAT: ${_currFmt.format(vatAmt)}',
                        style: NucleusTheme.monoAmount(
                            fontSize: 10, color: Colors.black38),
                      ),
                    ],
                  ),
                ],
              ),

              // ── Auto-classification hint ────────────────────
              if (autoClass != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: isAutoMatch
                        ? NucleusColors.accentTeal.withValues(alpha: 0.06)
                        : NucleusColors.background,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isAutoMatch
                          ? NucleusColors.accentTeal.withValues(alpha: 0.2)
                          : Colors.black12,
                    ),
                  ),
                  child: Row(
                    children: [
                      Text(
                        isAutoMatch ? '✓ Auto-classified:' : '↻ Suggested:',
                        style: TextStyle(
                          fontSize: 12,
                          color: isAutoMatch
                              ? NucleusColors.accentTeal
                              : Colors.black45,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _classLabels[autoClass] ?? '',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isAutoMatch
                              ? NucleusColors.accentTeal
                              : Colors.black54,
                        ),
                      ),
                      if (c['auto_reason'] != null) ...[
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            '— ${c['auto_reason']}',
                            style: TextStyle(
                              fontSize: 11,
                              color: isAutoMatch
                                  ? NucleusColors.accentTeal
                                  : Colors.black38,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 12),

              // ── Classification radio grid ───────────────────
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
                childAspectRatio: 3.5,
                children: VatClassification.values.map((opt) {
                  final selected = _classification == opt;
                  return GestureDetector(
                    onTap: () => setState(() => _classification = opt),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      decoration: BoxDecoration(
                        color: selected
                            ? NucleusColors.accentTeal.withValues(alpha: 0.06)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: selected
                              ? NucleusColors.accentTeal
                              : Colors.black12,
                        ),
                      ),
                      alignment: Alignment.centerLeft,
                      child: Row(
                        children: [
                          Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: selected
                                    ? NucleusColors.accentTeal
                                    : Colors.black26,
                                width: 2,
                              ),
                            ),
                            child: selected
                                ? Center(
                                    child: Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: NucleusColors.accentTeal,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  )
                                : null,
                          ),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              _classLabels[opt] ?? '',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: selected
                                    ? FontWeight.bold
                                    : FontWeight.w500,
                                color: selected
                                    ? NucleusColors.primaryNavy
                                    : Colors.black54,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),

              // ── Business portion slider ─────────────────────
              if (_classification ==
                  VatClassification.partiallyReclaimable) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1D4ED8).withValues(alpha: 0.04),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: const Color(0xFF1D4ED8).withValues(alpha: 0.15),
                    ),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Business portion',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1D4ED8),
                            ),
                          ),
                          Text(
                            '$_businessPortion%',
                            style: GoogleFonts.jetBrainsMono(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: const Color(0xFF1E3A5F),
                            ),
                          ),
                        ],
                      ),
                      Slider(
                        value: _businessPortion.toDouble(),
                        min: 0,
                        max: 100,
                        divisions: 20,
                        activeColor: NucleusColors.accentTeal,
                        onChanged: (v) =>
                            setState(() => _businessPortion = v.round()),
                      ),
                      Text(
                        'Reclaimable VAT: ${_currFmt.format(_reclaimableVat(_amount, VatClassification.partiallyReclaimable, _businessPortion))}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF1D4ED8),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 12),

              // ── VAT number + reclaimable preview ────────────
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _vatNoController,
                      decoration: InputDecoration(
                        hintText: 'Supplier VAT No. (optional)',
                        hintStyle: const TextStyle(
                            fontSize: 12, color: Colors.black26),
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(color: Colors.black12),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(color: Colors.black12),
                        ),
                      ),
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: reclaimAmt > 0
                          ? NucleusColors.success.withValues(alpha: 0.06)
                          : NucleusColors.background,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: reclaimAmt > 0
                            ? NucleusColors.success.withValues(alpha: 0.2)
                            : Colors.black12,
                      ),
                    ),
                    child: Text(
                      '${_currFmt.format(reclaimAmt)} reclaimable',
                      style: NucleusTheme.monoAmount(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: reclaimAmt > 0
                            ? NucleusColors.success
                            : Colors.black38,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // ── Save button ─────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _saving || _done ? null : _save,
                  style: FilledButton.styleFrom(
                    backgroundColor: NucleusColors.accentTeal,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    textStyle: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.bold),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(_done
                          ? '✓ Classified'
                          : 'Confirm Classification'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.bold,
          color: color,
        ),
      ),
    );
  }
}
