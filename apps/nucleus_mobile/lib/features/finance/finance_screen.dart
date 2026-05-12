import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const _categoryLabels = {
  'meals': 'Meals',
  'travel': 'Travel',
  'accommodation': 'Accommodation',
  'transport': 'Transport',
  'office_supplies': 'Office Supplies',
  'equipment': 'Equipment',
  'training': 'Training',
  'mileage': 'Mileage',
  'other': 'Other',
};

final _currFmt = NumberFormat.currency(locale: 'en_GB', symbol: '£');

String _fmtDate(String? d) {
  if (d == null || d.isEmpty) return '—';
  try {
    return DateFormat('d MMM yyyy').format(DateTime.parse(d));
  } catch (_) {
    return d;
  }
}

// ---------------------------------------------------------------------------
// Finance Screen
// ---------------------------------------------------------------------------

class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key});

  @override
  State<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends State<FinanceScreen> {
  List<Map<String, dynamic>> _approved = [];
  List<Map<String, dynamic>> _posted = [];
  double _totalPending = 0;
  bool _loading = true;
  String? _error;
  bool _exporting = false;
  bool _marking = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = context.read<AuthProvider>().apiClient;
      final response = await api.get('/expenses/approved');
      final data = response['data'] as Map<String, dynamic>? ?? {};

      setState(() {
        _approved = _toList(data['approved']);
        _posted = _toList(data['posted']);
        _totalPending = ((data['total_pending'] as num?) ?? 0).toDouble();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to load finance data';
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> _toList(dynamic data) {
    if (data is! List) return [];
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> _export() async {
    if (_approved.isEmpty) return;
    setState(() => _exporting = true);
    try {
      final api = context.read<AuthProvider>().apiClient;
      final response = await api.post('/expenses/export');
      final count = response['data']?['claims_count'] ?? _approved.length;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Exported $count claims to CSV'),
            backgroundColor: NucleusColors.primaryNavy,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Export failed — please retry'),
            backgroundColor: NucleusColors.error,
          ),
        );
      }
    }
    setState(() => _exporting = false);
  }

  Future<void> _markPosted() async {
    if (_approved.isEmpty) return;
    setState(() => _marking = true);
    try {
      final api = context.read<AuthProvider>().apiClient;
      final ids = _approved.map((c) => c['id'] as String).toList();
      final response = await api.post('/expenses/mark-posted', body: {
        'claim_ids': ids,
      });
      final updated = response['data']?['updated'] ?? ids.length;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$updated claims marked as posted'),
            backgroundColor: NucleusColors.success,
          ),
        );
      }
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to mark as posted — please retry'),
            backgroundColor: NucleusColors.error,
          ),
        );
      }
    }
    setState(() => _marking = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;
    final isFinance = user?.isFinanceApprover ?? false;

    if (!isFinance) {
      return const _AccessDenied();
    }

    final isDesktop = MediaQuery.of(context).size.width > kMobileBreakpoint;

    return Scaffold(
      backgroundColor: NucleusColors.background,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : ListView(
                  padding: EdgeInsets.symmetric(
                    horizontal: isDesktop ? 32 : 16,
                    vertical: isDesktop ? 24 : 16,
                  ),
                  children: [
                    _buildHeader(isDesktop),
                    const SizedBox(height: 20),
                    _buildStats(isDesktop),
                    const SizedBox(height: 24),
                    _buildApprovedSection(isDesktop),
                    if (_posted.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      _buildPostedSection(isDesktop),
                    ],
                    const SizedBox(height: 32),
                  ],
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.warning_amber, size: 48, color: NucleusColors.warning),
          const SizedBox(height: 12),
          Text(_error!,
              style: const TextStyle(
                  fontWeight: FontWeight.bold, color: NucleusColors.primaryNavy)),
          const SizedBox(height: 12),
          TextButton(onPressed: _load, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildHeader(bool isDesktop) {
    return isDesktop
        ? Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _headerText(isDesktop)),
              _headerButtons(),
            ],
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _headerText(isDesktop),
              const SizedBox(height: 12),
              _headerButtons(),
            ],
          );
  }

  Widget _headerText(bool isDesktop) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Finance Export',
          style: TextStyle(
            fontSize: isDesktop ? 28 : 22,
            fontWeight: FontWeight.bold,
            color: NucleusColors.primaryNavy,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Review approved claims, export to CSV, and mark as posted.',
          style: TextStyle(color: Colors.black54, fontSize: 13),
        ),
      ],
    );
  }

  Widget _headerButtons() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        OutlinedButton.icon(
          onPressed: _exporting || _approved.isEmpty ? null : _export,
          icon: _exporting
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.download, size: 16),
          label: const Text('Export to CSV'),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            textStyle:
                const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 8),
        FilledButton.icon(
          onPressed: _marking || _approved.isEmpty ? null : _markPosted,
          icon: _marking
              ? const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.check, size: 16),
          label: const Text('Mark All as Posted'),
          style: FilledButton.styleFrom(
            backgroundColor: NucleusColors.success,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            textStyle:
                const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
          ),
        ),
      ],
    );
  }

  Widget _buildStats(bool isDesktop) {
    return GridView.count(
      crossAxisCount: isDesktop ? 3 : 1,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: isDesktop ? 2.8 : 3.5,
      children: [
        _StatCard(
          label: 'Ready to Export',
          value: '${_approved.length}',
          sub: _currFmt.format(_totalPending),
          highlighted: true,
          highlightColor: NucleusColors.success,
        ),
        _StatCard(
          label: 'Total Gross',
          value: _currFmt.format(_totalPending),
          sub: '${_approved.length} claims',
          highlighted: true,
          highlightColor: NucleusColors.accentTeal,
        ),
        _StatCard(
          label: 'Previously Posted',
          value: '${_posted.length}',
          sub: 'this period',
        ),
      ],
    );
  }

  Widget _buildApprovedSection(bool isDesktop) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              'Ready to Export',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: NucleusColors.primaryNavy,
              ),
            ),
            if (_approved.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: NucleusColors.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${_approved.length}',
                  style: const TextStyle(
                    color: NucleusColors.success,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
        if (_approved.isEmpty)
          _buildEmptyState(
            icon: Icons.check_circle,
            title: 'No claims ready for export',
            subtitle:
                'Approved claims will appear here once the workflow completes',
          )
        else
          isDesktop
              ? _buildDesktopTable(_approved, false)
              : _buildMobileList(_approved, false),
      ],
    );
  }

  Widget _buildPostedSection(bool isDesktop) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Text(
              'Posted',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: Colors.black38,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '${_posted.length}',
                style: const TextStyle(
                  color: Colors.black45,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        isDesktop
            ? _buildDesktopTable(_posted, true)
            : _buildMobileList(_posted, true),
      ],
    );
  }

  Widget _buildDesktopTable(List<Map<String, dynamic>> claims, bool isPosted) {
    return Card(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columnSpacing: 16,
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
            DataColumn(label: Text('CLAIM ID')),
            DataColumn(label: Text('EMPLOYEE')),
            DataColumn(label: Text('DESCRIPTION')),
            DataColumn(label: Text('CATEGORY')),
            DataColumn(label: Text('NET'), numeric: true),
            DataColumn(label: Text('VAT'), numeric: true),
            DataColumn(label: Text('GROSS'), numeric: true),
            DataColumn(label: Text('GL CODE')),
            DataColumn(label: Text('COST CENTRE')),
            DataColumn(label: Text('APPROVED')),
          ],
          rows: claims.map((claim) {
            final cat = _categoryLabels[claim['category']] ??
                (claim['category'] ?? '').toString();
            final amountNet =
                ((claim['amount_net'] as num?) ?? 0).toDouble();
            final vatAmount =
                ((claim['vat_amount'] as num?) ?? 0).toDouble();
            final amountGross =
                ((claim['amount_gross'] as num?) ?? 0).toDouble();
            final vatRate = claim['vat_rate'] ?? 20;
            final costCentre = (claim['cost_centre'] ?? '')
                .toString()
                .replaceFirst('cost_centre:', '');

            return DataRow(
              cells: [
                DataCell(Text(
                  (claim['reference'] ?? '').toString(),
                  style: NucleusTheme.monoAmount(
                      fontSize: 11, color: Colors.black45),
                )),
                DataCell(Text(
                  (claim['employee_name'] ?? '').toString(),
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    color: isPosted ? Colors.black38 : NucleusColors.primaryNavy,
                  ),
                )),
                DataCell(
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 180),
                    child: Text(
                      (claim['description'] ?? '—').toString(),
                      style: TextStyle(
                        fontSize: 13,
                        color: isPosted ? Colors.black38 : Colors.black54,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                DataCell(Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    cat,
                    style: const TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w600),
                  ),
                )),
                DataCell(Text(
                  _currFmt.format(amountNet),
                  style: NucleusTheme.monoAmount(
                      fontSize: 12,
                      color: isPosted ? Colors.black38 : Colors.black54),
                )),
                DataCell(Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _currFmt.format(vatAmount),
                      style: NucleusTheme.monoAmount(
                          fontSize: 12, color: Colors.black38),
                    ),
                    Text(
                      ' ($vatRate%)',
                      style: const TextStyle(
                          fontSize: 10, color: Colors.black26),
                    ),
                  ],
                )),
                DataCell(Text(
                  _currFmt.format(amountGross),
                  style: NucleusTheme.monoAmount(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isPosted ? Colors.black38 : NucleusColors.primaryNavy,
                  ),
                )),
                DataCell(Text(
                  (claim['gl_code'] ?? '—').toString(),
                  style: NucleusTheme.monoAmount(
                      fontSize: 11, color: NucleusColors.accentTeal),
                )),
                DataCell(Text(
                  costCentre.isEmpty ? '—' : costCentre,
                  style: NucleusTheme.monoAmount(
                      fontSize: 11, color: Colors.black45),
                )),
                DataCell(Text(
                  _fmtDate(claim['approved_date']?.toString()),
                  style: const TextStyle(fontSize: 12, color: Colors.black45),
                )),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildMobileList(List<Map<String, dynamic>> claims, bool isPosted) {
    return Card(
      child: Column(
        children: claims.map((claim) {
          final amountGross =
              ((claim['amount_gross'] as num?) ?? 0).toDouble();
          final cat = _categoryLabels[claim['category']] ??
              (claim['category'] ?? '').toString();

          return Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Colors.black12)),
            ),
            child: Opacity(
              opacity: isPosted ? 0.5 : 1.0,
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              (claim['employee_name'] ?? '').toString(),
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: NucleusColors.primaryNavy,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              (claim['reference'] ?? '').toString(),
                              style: NucleusTheme.monoAmount(
                                  fontSize: 10, color: Colors.black26),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${claim['description'] ?? '—'} · $cat',
                          style: const TextStyle(
                              fontSize: 12, color: Colors.black54),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'GL: ${claim['gl_code'] ?? '—'} · ${_fmtDate(claim['approved_date']?.toString())}',
                          style: const TextStyle(
                              fontSize: 11, color: Colors.black38),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    _currFmt.format(amountGross),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: NucleusColors.primaryNavy,
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildEmptyState({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Container(
      padding: const EdgeInsets.all(48),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.black12),
      ),
      child: Column(
        children: [
          Icon(icon, size: 40, color: NucleusColors.approved),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 16,
              color: NucleusColors.primaryNavy,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 13, color: Colors.black54),
            textAlign: TextAlign.center,
          ),
        ],
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
            'Finance access required',
            style: TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 18,
              color: NucleusColors.primaryNavy,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Switch to Amara Okafor (CFO)\nto access finance export.',
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
      padding: const EdgeInsets.all(16),
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
              fontSize: 22,
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
