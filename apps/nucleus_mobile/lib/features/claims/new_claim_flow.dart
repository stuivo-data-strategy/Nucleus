import 'dart:async';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import 'new_claim_group.dart';
import 'new_claim_mileage.dart';
import 'new_claim_batch.dart';

// ---------------------------------------------------------------------------
// Shared categories
// ---------------------------------------------------------------------------

const categories = [
  {'key': 'meals', 'label': 'Meals'},
  {'key': 'travel', 'label': 'Travel'},
  {'key': 'accommodation', 'label': 'Hotel'},
  {'key': 'transport', 'label': 'Transport'},
  {'key': 'office_supplies', 'label': 'Supplies'},
  {'key': 'training', 'label': 'Training'},
  {'key': 'mileage', 'label': 'Mileage'},
  {'key': 'other', 'label': 'Other'},
];

IconData categoryIcon(String key) {
  return switch (key) {
    'meals' => Icons.restaurant,
    'travel' => Icons.flight,
    'accommodation' => Icons.hotel,
    'transport' => Icons.local_taxi,
    'office_supplies' => Icons.inventory_2,
    'training' => Icons.school,
    'mileage' => Icons.directions_car,
    'client_entertainment' => Icons.celebration,
    'equipment' => Icons.devices,
    _ => Icons.receipt_long,
  };
}

String fmtGBP(double amount) {
  return NumberFormat.currency(locale: 'en_GB', symbol: '£').format(amount);
}

// ---------------------------------------------------------------------------
// Entry point — dialog (desktop) or full-screen (mobile)
// ---------------------------------------------------------------------------

class NewClaimFlow {
  static Future<bool?> show(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    if (width > kMobileBreakpoint) {
      return showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (_) => Dialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: const SizedBox(
            width: 560,
            height: 680,
            child: ClipRRect(
              borderRadius: BorderRadius.all(Radius.circular(16)),
              child: _NewClaimWidget(),
            ),
          ),
        ),
      );
    }
    return Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            const Scaffold(body: SafeArea(child: _NewClaimWidget())),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Main widget — type selector + screen routing
// ---------------------------------------------------------------------------

enum _ClaimScreen { selectType, single, batch, group, mileage }

class _NewClaimWidget extends StatefulWidget {
  const _NewClaimWidget();

  @override
  State<_NewClaimWidget> createState() => _NewClaimWidgetState();
}

class _NewClaimWidgetState extends State<_NewClaimWidget> {
  _ClaimScreen _screen = _ClaimScreen.selectType;

  void _onSuccess() {
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      child: switch (_screen) {
        _ClaimScreen.selectType => _TypeSelector(
            key: const ValueKey('type'),
            onSelect: (s) => setState(() => _screen = s),
            onClose: () => Navigator.of(context).pop(false),
          ),
        _ClaimScreen.single => _SingleClaimFlow(
            key: const ValueKey('single'),
            onBack: () => setState(() => _screen = _ClaimScreen.selectType),
            onClose: () => Navigator.of(context).pop(false),
          ),
        _ClaimScreen.batch => BatchClaimFlow(
            key: const ValueKey('batch'),
            onBack: () => setState(() => _screen = _ClaimScreen.selectType),
            onSuccess: _onSuccess,
          ),
        _ClaimScreen.group => GroupClaimFlow(
            key: const ValueKey('group'),
            onBack: () => setState(() => _screen = _ClaimScreen.selectType),
            onSuccess: _onSuccess,
          ),
        _ClaimScreen.mileage => MileageClaimFlow(
            key: const ValueKey('mileage'),
            onBack: () => setState(() => _screen = _ClaimScreen.selectType),
            onSuccess: _onSuccess,
          ),
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Type Selector
// ---------------------------------------------------------------------------

class _TypeSelector extends StatelessWidget {
  final ValueChanged<_ClaimScreen> onSelect;
  final VoidCallback onClose;

  const _TypeSelector({
    super.key,
    required this.onSelect,
    required this.onClose,
  });

  static const _types = [
    (
      screen: _ClaimScreen.single,
      label: 'Single Receipt',
      desc: 'One receipt, one expense line.',
      icon: Icons.receipt_long,
    ),
    (
      screen: _ClaimScreen.batch,
      label: 'Multiple Receipts',
      desc: 'Several receipts, one claim — a trip or a week.',
      icon: Icons.dynamic_feed,
    ),
    (
      screen: _ClaimScreen.group,
      label: 'Group / Team Expense',
      desc: 'One receipt covering multiple people (e.g. team lunch).',
      icon: Icons.groups,
    ),
    (
      screen: _ClaimScreen.mileage,
      label: 'Mileage Claim',
      desc: 'Own vehicle travel claiming at HMRC rate per mile.',
      icon: Icons.route,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Header
        _ClaimHeader(
          title: 'New Expense Claim',
          onClose: onClose,
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'What type of expense?',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: NucleusColors.primaryNavy,
                      ),
                ),
                const SizedBox(height: 16),
                Expanded(
                  child: GridView.count(
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.3,
                    children: _types
                        .map((t) => _TypeCard(
                              icon: t.icon,
                              label: t.label,
                              desc: t.desc,
                              onTap: () => onSelect(t.screen),
                            ))
                        .toList(),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _TypeCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String desc;
  final VoidCallback onTap;

  const _TypeCard({
    required this.icon,
    required this.label,
    required this.desc,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey[200]!, width: 1),
      ),
      color: Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: NucleusColors.accentTeal.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 20, color: NucleusColors.accentTeal),
              ),
              const Spacer(),
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: NucleusColors.primaryNavy,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                desc,
                style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared header widget
// ---------------------------------------------------------------------------

class ClaimHeader extends StatelessWidget {
  final String title;
  final VoidCallback? onBack;
  final VoidCallback? onClose;
  final Widget? trailing;

  const ClaimHeader({
    super.key,
    required this.title,
    this.onBack,
    this.onClose,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: const BoxDecoration(color: NucleusColors.primaryNavy),
      child: Row(
        children: [
          if (onBack != null)
            IconButton(
              icon: const Icon(Icons.arrow_back, color: Colors.white),
              onPressed: onBack,
              visualDensity: VisualDensity.compact,
            ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
                fontSize: 16,
              ),
            ),
          ),
          if (trailing != null) trailing!,
          if (onClose != null)
            IconButton(
              icon: const Icon(Icons.close, color: Colors.white70),
              onPressed: onClose,
              visualDensity: VisualDensity.compact,
            ),
        ],
      ),
    );
  }
}

// Private alias for internal use
class _ClaimHeader extends ClaimHeader {
  const _ClaimHeader({
    required super.title,
    super.onBack,
    super.onClose,
    super.trailing,
  });
}

// ---------------------------------------------------------------------------
// Shared policy checks widget with stagger animation
// ---------------------------------------------------------------------------

class PolicyChecksList extends StatelessWidget {
  final List<Map<String, dynamic>> checks;
  final bool hasAmountFail;
  final bool exceptionRequested;
  final TextEditingController? exceptionJustCtrl;
  final bool exceptionConfirmed;
  final VoidCallback? onRequestException;
  final VoidCallback? onCancelException;
  final ValueChanged<bool>? onConfirmChanged;

  const PolicyChecksList({
    super.key,
    required this.checks,
    this.hasAmountFail = false,
    this.exceptionRequested = false,
    this.exceptionJustCtrl,
    this.exceptionConfirmed = false,
    this.onRequestException,
    this.onCancelException,
    this.onConfirmChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ...checks.asMap().entries.map((e) {
          final check = e.value;
          final severity = check['severity'] ?? 'pass';
          return TweenAnimationBuilder<double>(
            key: ValueKey('check_${check['rule_name']}_${e.key}'),
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
            builder: (_, v, child) => Transform.translate(
              offset: Offset(-10 * (1 - v), 0),
              child: Opacity(opacity: v, child: child),
            ),
            child: Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: _checkBg(severity),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  _severityIcon(severity),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      check['message'] ?? check['rule_name'] ?? '',
                      style:
                          TextStyle(fontSize: 13, color: _checkText(severity)),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
        if (hasAmountFail && !exceptionRequested && onRequestException != null)
          TextButton(
            onPressed: onRequestException,
            child: const Text('Request policy exception instead →'),
          ),
        if (exceptionRequested && exceptionJustCtrl != null) ...[
          const SizedBox(height: 8),
          TextField(
            controller: exceptionJustCtrl,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Business justification…',
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              contentPadding: const EdgeInsets.all(12),
            ),
          ),
          const SizedBox(height: 8),
          CheckboxListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            value: exceptionConfirmed,
            onChanged: (v) => onConfirmChanged?.call(v ?? false),
            title: const Text(
              'I confirm this is a legitimate business expense requiring senior manager approval',
              style: TextStyle(fontSize: 12),
            ),
            controlAffinity: ListTileControlAffinity.leading,
          ),
          TextButton(
            onPressed: onCancelException,
            child: const Text('Cancel exception request'),
          ),
        ],
      ],
    );
  }

  static Color _checkBg(String s) => switch (s) {
        'pass' => const Color(0xFFF0FDF4),
        'warn' => const Color(0xFFFFFBEB),
        'fail' => const Color(0xFFFEF2F2),
        _ => Colors.grey[50]!,
      };

  static Color _checkText(String s) => switch (s) {
        'pass' => const Color(0xFF15803D),
        'warn' => const Color(0xFFB45309),
        'fail' => const Color(0xFFDC2626),
        _ => Colors.grey[700]!,
      };

  static Widget _severityIcon(String s) => switch (s) {
        'pass' =>
          const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 20),
        'warn' =>
          const Icon(Icons.warning, color: Color(0xFFF59E0B), size: 20),
        'fail' =>
          const Icon(Icons.cancel, color: Color(0xFFDC2626), size: 20),
        _ => const Icon(Icons.help, color: Colors.grey, size: 20),
      };
}

// ---------------------------------------------------------------------------
// Shared approval route preview
// ---------------------------------------------------------------------------

class ApprovalRoutePreview extends StatelessWidget {
  final List<Map<String, dynamic>> steps;
  final List<Map<String, dynamic>> skippedSteps;

  const ApprovalRoutePreview({
    super.key,
    required this.steps,
    this.skippedSteps = const [],
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ...steps.asMap().entries.map((e) {
          final i = e.key;
          final step = e.value;
          return TweenAnimationBuilder<double>(
            key: ValueKey('route_${step['person_id']}_$i'),
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
            builder: (_, v, child) => Transform.translate(
              offset: Offset(0, 6 * (1 - v)),
              child: Opacity(opacity: v, child: child),
            ),
            child: Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: const BoxDecoration(
                      color: NucleusColors.accentTeal,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text('${i + 1}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 13)),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    width: 32,
                    height: 32,
                    decoration: const BoxDecoration(
                      color: NucleusColors.primaryNavy,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(step['avatar_initials'] ?? '',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${step['first_name']} ${step['last_name']}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 13)),
                        Text(step['job_title'] ?? '',
                            style: TextStyle(
                                fontSize: 11, color: Colors.grey[500])),
                      ],
                    ),
                  ),
                  if (step['role_label'] != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color:
                            NucleusColors.accentTeal.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(step['role_label'],
                          style: const TextStyle(
                              fontSize: 10,
                              color: NucleusColors.accentTeal,
                              fontWeight: FontWeight.w500)),
                    ),
                ],
              ),
            ),
          );
        }),
        if (skippedSteps.isNotEmpty)
          ...skippedSteps.map((s) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Opacity(
                  opacity: 0.5,
                  child: Row(
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                            color: Colors.grey[200],
                            shape: BoxShape.circle),
                        alignment: Alignment.center,
                        child: Text('${s['step'] ?? '-'}',
                            style: TextStyle(
                                color: Colors.grey[500], fontSize: 12)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                          child: Text('${s['label']} — ${s['reason']}',
                              style: TextStyle(
                                  fontSize: 12, color: Colors.grey[500]))),
                    ],
                  ),
                ),
              )),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Scanning animation (shared)
// ---------------------------------------------------------------------------

class ScanningAnimation extends StatefulWidget {
  const ScanningAnimation({super.key});

  @override
  State<ScanningAnimation> createState() => _ScanningAnimationState();
}

class _ScanningAnimationState extends State<ScanningAnimation>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat(reverse: true);
    _pulse = Tween(begin: 0.8, end: 1.2)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: _pulse,
            builder: (_, __) => Transform.scale(
              scale: _pulse.value,
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: NucleusColors.accentTeal.withValues(alpha: 0.15),
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.document_scanner, size: 36, color: NucleusColors.accentTeal),
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text('Reading receipt…',
              style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: NucleusColors.primaryNavy,
                  fontSize: 16)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Confirmation screen (shared)
// ---------------------------------------------------------------------------

class ClaimConfirmation extends StatelessWidget {
  final Map<String, dynamic> confirmedClaim;
  final double claimAmount;
  final String category;
  final VoidCallback onDone;

  const ClaimConfirmation({
    super.key,
    required this.confirmedClaim,
    required this.claimAmount,
    required this.category,
    required this.onDone,
  });

  @override
  Widget build(BuildContext context) {
    final claim = confirmedClaim['claim'] ?? confirmedClaim;
    final workflow = confirmedClaim['workflow'] ?? claim['workflow'];
    final steps = (workflow?['steps'] as List<dynamic>?) ?? [];
    final firstApprover = steps.isNotEmpty
        ? steps.first['approver_name'] ?? 'the approver'
        : 'the approver';

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 500),
            builder: (_, v, __) => Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: NucleusColors.approved.withValues(alpha: v),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Icon(Icons.check,
                  color: Colors.white.withValues(alpha: v), size: 36),
            ),
          ),
          const SizedBox(height: 20),
          Text('Claim Submitted',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: NucleusColors.primaryNavy)),
          const SizedBox(height: 8),
          Text('Routed to $firstApprover for approval',
              style: TextStyle(color: Colors.grey[600])),
          const SizedBox(height: 24),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _row('Reference', claim['reference'] ?? '—'),
                  _row('Amount', fmtGBP(claimAmount)),
                  _row('Category',
                      category[0].toUpperCase() + category.substring(1)),
                  if (steps.isNotEmpty) ...[
                    const Divider(height: 20),
                    ...steps.asMap().entries.map((e) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(children: [
                            Container(
                              width: 22,
                              height: 22,
                              decoration: const BoxDecoration(
                                  color: NucleusColors.accentTeal,
                                  shape: BoxShape.circle),
                              alignment: Alignment.center,
                              child: Text('${e.key + 1}',
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold)),
                            ),
                            const SizedBox(width: 10),
                            Text(
                                e.value['approver_name'] ??
                                    '${e.value['first_name']} ${e.value['last_name']}',
                                style: const TextStyle(fontSize: 13)),
                          ]),
                        )),
                  ],
                ],
              ),
            ),
          ),
          const Spacer(),
          FilledButton(
            onPressed: onDone,
            style: FilledButton.styleFrom(
              backgroundColor: NucleusColors.primaryNavy,
              minimumSize: const Size(double.infinity, 48),
            ),
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: TextStyle(color: Colors.grey[600], fontSize: 13)),
            Text(value,
                style: const TextStyle(
                    fontWeight: FontWeight.w500, fontSize: 13)),
          ],
        ),
      );
}

// ---------------------------------------------------------------------------
// SINGLE RECEIPT FLOW
// ---------------------------------------------------------------------------

class _SingleClaimFlow extends StatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onClose;

  const _SingleClaimFlow({
    super.key,
    required this.onBack,
    required this.onClose,
  });

  @override
  State<_SingleClaimFlow> createState() => _SingleClaimFlowState();
}

class _SingleClaimFlowState extends State<_SingleClaimFlow> {
  int _step = 0; // 0=scan, 1=form, 2=confirm
  Map<String, dynamic>? _ocr;
  String _category = 'meals';
  final _amountCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _dateCtrl = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(DateTime.now()));
  bool _hasReceipt = false;
  double _receiptAmount = 0;

  // Partial
  String _partialReason = '';
  final _partialOtherCtrl = TextEditingController();
  bool get _isPartial =>
      _ocr != null &&
      _receiptAmount > 0 &&
      _claimAmount > 0 &&
      _receiptAmount > _claimAmount;

  // Exception
  bool _exceptionRequested = false;
  final _exceptionJustCtrl = TextEditingController();
  bool _exceptionConfirmed = false;

  // Policy
  List<Map<String, dynamic>> _policyChecks = [];
  bool _policyLoading = false;
  bool _hasAmountFail = false;
  String? _policyError;
  Timer? _policyDebounce;

  // Route
  List<Map<String, dynamic>> _routeSteps = [];
  List<Map<String, dynamic>> _skippedSteps = [];
  bool _routeLoading = false;
  Timer? _routeDebounce;

  // Submit
  bool _submitting = false;
  Map<String, dynamic>? _confirmedClaim;

  double get _claimAmount => double.tryParse(_amountCtrl.text) ?? 0;

  @override
  void initState() {
    super.initState();
    _amountCtrl.addListener(_onChanged);
  }

  @override
  void dispose() {
    _policyDebounce?.cancel();
    _routeDebounce?.cancel();
    _amountCtrl.dispose();
    _descCtrl.dispose();
    _dateCtrl.dispose();
    _partialOtherCtrl.dispose();
    _exceptionJustCtrl.dispose();
    super.dispose();
  }

  void _onChanged() {
    _debouncePolicy();
    _debounceRoute();
  }

  void _onCategoryChanged(String cat) {
    setState(() => _category = cat);
    _debouncePolicy();
    _debounceRoute();
  }

  Future<void> _scanReceipt() async {
    final picker = ImagePicker();
    await picker.pickImage(source: ImageSource.gallery);
    setState(() => _step = -1);
    try {
      final api = context.read<ApiClient>();
      final resp = await api.post('/expenses/ocr-scan');
      final data = resp['data'] ?? resp;
      _ocr = Map<String, dynamic>.from(data);
      _receiptAmount = (data['amount'] as num?)?.toDouble() ?? 0;
      _amountCtrl.text = _receiptAmount.toStringAsFixed(2);
      _category = data['category_suggestion'] ?? 'other';
      _dateCtrl.text = data['date'] ?? _dateCtrl.text;
      _descCtrl.text = 'Expense at ${data['vendor'] ?? 'vendor'}';
      _hasReceipt = true;
      setState(() => _step = 1);
      _debouncePolicy();
      _debounceRoute();
    } catch (_) {
      setState(() => _step = 1);
    }
  }

  void _debouncePolicy() {
    _policyDebounce?.cancel();
    _policyDebounce = Timer(const Duration(milliseconds: 300), () async {
      final amount = _claimAmount;
      if (amount <= 0) {
        if (mounted) {
          setState(() {
            _policyChecks = [];
            _policyError = null;
            _hasAmountFail = false;
          });
        }
        return;
      }
      if (!mounted) return;
      setState(() {
        _policyLoading = true;
        _policyError = null;
      });
      try {
        final api = context.read<ApiClient>();
        final resp = await api.post('/policies/validate', body: {
          'category': _category,
          'amount': amount,
          'has_receipt': _hasReceipt,
          'date': _dateCtrl.text,
        });
        final data = resp['data'] ?? resp;
        final checks = (data['checks'] as List<dynamic>?)
                ?.map((c) => Map<String, dynamic>.from(c))
                .toList() ??
            [];
        if (mounted) {
          setState(() {
            _policyChecks = checks;
            _hasAmountFail = checks.any((c) =>
                c['rule_name'] == 'Category Limit' &&
                c['severity'] == 'fail');
            _policyLoading = false;
            _policyError = null;
          });
        }
      } catch (e) {
        debugPrint('Policy validation error: $e');
        if (mounted) {
          setState(() {
            _policyLoading = false;
            _policyError = 'Policy check unavailable — tap to retry';
          });
        }
      }
    });
  }

  void _debounceRoute() {
    _routeDebounce?.cancel();
    _routeDebounce = Timer(const Duration(milliseconds: 400), () async {
      final amount = _claimAmount;
      if (amount <= 0) return;
      setState(() => _routeLoading = true);
      try {
        final api = context.read<ApiClient>();
        final resp = await api.post('/expenses/preview-route',
            body: {'amount': amount, 'category': _category});
        final data = resp['data'] ?? resp;
        if (mounted) {
          setState(() {
            _routeSteps = (data['steps'] as List<dynamic>?)
                    ?.map((s) => Map<String, dynamic>.from(s))
                    .toList() ??
                [];
            _skippedSteps = (data['skipped_steps'] as List<dynamic>?)
                    ?.map((s) => Map<String, dynamic>.from(s))
                    .toList() ??
                [];
            _routeLoading = false;
          });
        }
      } catch (_) {
        if (mounted) setState(() => _routeLoading = false);
      }
    });
  }

  bool get _canSubmit {
    if (_claimAmount <= 0 || _descCtrl.text.trim().isEmpty) return false;
    if (_policyChecks.any((c) =>
        c['rule_name'] == 'Receipt Required' && c['severity'] == 'fail')) {
      return false;
    }
    if (_hasAmountFail) {
      if (!_exceptionRequested ||
          _exceptionJustCtrl.text.trim().isEmpty ||
          !_exceptionConfirmed) return false;
    }
    if (_policyChecks.any((c) =>
        c['severity'] == 'fail' &&
        c['rule_name'] != 'Category Limit' &&
        c['rule_name'] != 'Receipt Required')) return false;
    if (_isPartial &&
        (_partialReason.isEmpty ||
            (_partialReason == 'other' &&
                _partialOtherCtrl.text.trim().isEmpty))) return false;
    return true;
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);
    try {
      final api = context.read<ApiClient>();
      final body = <String, dynamic>{
        'category': _category,
        'amount': _claimAmount,
        'date': _dateCtrl.text,
        'has_receipt': _hasReceipt,
        'description': _descCtrl.text.trim(),
        'currency': 'GBP',
        'receipt_amount': _receiptAmount > 0 ? _receiptAmount : _claimAmount,
        'claim_amount': _claimAmount,
      };
      if (_isPartial) {
        body['partial_claim'] = true;
        body['partial_reason'] = _partialReason == 'other'
            ? _partialOtherCtrl.text.trim()
            : _partialReason;
      }
      if (_exceptionRequested) {
        body['exception_requested'] = true;
        body['exception_justification'] = _exceptionJustCtrl.text.trim();
      }
      final resp = await api.post('/expenses', body: body);
      if (mounted) {
        setState(() {
          _confirmedClaim = resp['data'] ?? resp;
          _step = 2;
          _submitting = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Submit failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ClaimHeader(
          title: _step == 2
              ? 'Claim Submitted'
              : _step == 1
                  ? 'Review & Submit'
                  : 'Single Receipt',
          onBack: _step == 0 ? widget.onBack : (_step == 1 ? () => setState(() => _step = 0) : null),
          onClose: _step == 2 ? null : widget.onClose,
        ),
        Expanded(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            child: _step == -1
                ? const ScanningAnimation(key: ValueKey('scan'))
                : _step == 0
                    ? _buildScanStep()
                    : _step == 1
                        ? _buildFormStep()
                        : ClaimConfirmation(
                            key: const ValueKey('confirm'),
                            confirmedClaim: _confirmedClaim!,
                            claimAmount: _claimAmount,
                            category: _category,
                            onDone: () =>
                                Navigator.of(context).pop(true),
                          ),
          ),
        ),
      ],
    );
  }

  Widget _buildScanStep() {
    return Padding(
      key: const ValueKey('step0'),
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.photo_camera, size: 56, color: NucleusColors.accentTeal),
          const SizedBox(height: 20),
          Text('Scan a receipt to auto-fill',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: NucleusColors.primaryNavy)),
          const SizedBox(height: 8),
          Text('Take a photo or choose from your gallery',
              style: TextStyle(color: Colors.grey[600])),
          const SizedBox(height: 32),
          FilledButton.icon(
            onPressed: _scanReceipt,
            icon: const Icon(Icons.photo_camera),
            label: const Text('Scan Receipt'),
            style: FilledButton.styleFrom(
                backgroundColor: NucleusColors.accentTeal,
                minimumSize: const Size(double.infinity, 48)),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => setState(() => _step = 1),
            style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48)),
            child: const Text('Enter manually'),
          ),
        ],
      ),
    );
  }

  Widget _buildFormStep() {
    return SingleChildScrollView(
      key: const ValueKey('step1'),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Category
          const Text('Category',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: categories.map((cat) {
              final selected = _category == cat['key'];
              return ChoiceChip(
                avatar: Icon(categoryIcon(cat['key']!), size: 18),
                label: Text(cat['label']!),
                selected: selected,
                selectedColor:
                    NucleusColors.accentTeal.withValues(alpha: 0.15),
                onSelected: (_) => _onCategoryChanged(cat['key']!),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          // Amount
          const Text('Amount (£)',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 6),
          TextField(
            controller: _amountCtrl,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            style: NucleusTheme.monoAmount(fontSize: 20),
            decoration: InputDecoration(
              prefixText: '£ ',
              prefixStyle:
                  NucleusTheme.monoAmount(fontSize: 20, color: Colors.grey[600]),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              suffixIcon: _policyLoading
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                          width: 20,
                          height: 20,
                          child:
                              CircularProgressIndicator(strokeWidth: 2)))
                  : null,
            ),
          ),
          if (_isPartial) ...[
            const SizedBox(height: 8),
            _PartialClaimInfo(
              receiptAmount: _receiptAmount,
              claimAmount: _claimAmount,
              reason: _partialReason,
              otherController: _partialOtherCtrl,
              onReasonChanged: (r) => setState(() => _partialReason = r),
            ),
          ],
          const SizedBox(height: 16),
          // Description
          const Text('Description',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 6),
          TextField(
            controller: _descCtrl,
            decoration: InputDecoration(
              hintText: 'e.g. Client lunch at The Ivy',
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: 16),
          // Date
          const Text('Date',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 6),
          TextField(
            controller: _dateCtrl,
            readOnly: true,
            decoration: InputDecoration(
              suffixIcon: const Icon(Icons.calendar_today, size: 18),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            onTap: () async {
              final picked = await showDatePicker(
                context: context,
                initialDate:
                    DateTime.tryParse(_dateCtrl.text) ?? DateTime.now(),
                firstDate: DateTime(2020),
                lastDate: DateTime.now(),
              );
              if (picked != null) {
                _dateCtrl.text = DateFormat('yyyy-MM-dd').format(picked);
                _debouncePolicy();
              }
            },
          ),
          const SizedBox(height: 16),
          // Receipt toggle
          GestureDetector(
            onTap: () {
              setState(() => _hasReceipt = !_hasReceipt);
              _debouncePolicy();
            },
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(
                    color: _hasReceipt
                        ? NucleusColors.approved
                        : Colors.grey[300]!),
                borderRadius: BorderRadius.circular(8),
                color: _hasReceipt
                    ? NucleusColors.approved.withValues(alpha: 0.05)
                    : null,
              ),
              child: Row(children: [
                Icon(Icons.photo_camera, size: 18, color: _hasReceipt ? NucleusColors.approved : Colors.grey),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _hasReceipt
                        ? 'Receipt captured ✓'
                        : 'Receipt not attached — tap to mark',
                    style: TextStyle(
                      fontSize: 13,
                      color: _hasReceipt
                          ? NucleusColors.approved
                          : Colors.grey[600],
                      fontWeight:
                          _hasReceipt ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 20),
          // Policy checks
          if (_policyError != null && _policyChecks.isEmpty) ...[
            const Text('Policy Checks',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: _debouncePolicy,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: NucleusColors.warning.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: NucleusColors.warning.withValues(alpha: 0.3),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.refresh, size: 18, color: Color(0xFFB45309)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        _policyError!,
                        style: const TextStyle(fontSize: 13, color: Color(0xFFB45309)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
          ],
          if (_policyChecks.isNotEmpty) ...[
            const Text('Policy Checks',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 8),
            PolicyChecksList(
              checks: _policyChecks,
              hasAmountFail: _hasAmountFail,
              exceptionRequested: _exceptionRequested,
              exceptionJustCtrl: _exceptionJustCtrl,
              exceptionConfirmed: _exceptionConfirmed,
              onRequestException: () =>
                  setState(() => _exceptionRequested = true),
              onCancelException: () => setState(() {
                _exceptionRequested = false;
                _exceptionConfirmed = false;
                _exceptionJustCtrl.clear();
              }),
              onConfirmChanged: (v) =>
                  setState(() => _exceptionConfirmed = v),
            ),
            const SizedBox(height: 20),
          ],
          // Route preview
          if (_routeSteps.isNotEmpty || _routeLoading) ...[
            const Text('Approval Route',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 8),
            if (_routeLoading)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(16),
                      child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))))
            else
              ApprovalRoutePreview(
                  steps: _routeSteps, skippedSteps: _skippedSteps),
            const SizedBox(height: 20),
          ],
          // Submit
          FilledButton(
            onPressed: _canSubmit && !_submitting ? _submit : null,
            style: FilledButton.styleFrom(
              backgroundColor: _exceptionRequested
                  ? NucleusColors.warning
                  : NucleusColors.accentTeal,
              minimumSize: const Size(double.infinity, 48),
            ),
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_exceptionRequested)
                        const Padding(
                          padding: EdgeInsets.only(right: 6),
                          child: Icon(Icons.warning_amber, size: 16),
                        ),
                      Text(
                        _exceptionRequested
                            ? 'Submit with Exception · ${fmtGBP(_claimAmount)}'
                            : 'Submit Claim · ${fmtGBP(_claimAmount)}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Partial claim info (used by single + batch)
// ---------------------------------------------------------------------------

class PartialClaimInfo extends StatelessWidget {
  final double receiptAmount;
  final double claimAmount;
  final String reason;
  final TextEditingController otherController;
  final ValueChanged<String> onReasonChanged;

  const PartialClaimInfo({
    super.key,
    required this.receiptAmount,
    required this.claimAmount,
    required this.reason,
    required this.otherController,
    required this.onReasonChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: NucleusColors.warning.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: NucleusColors.warning.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ℹ️ Claiming ${fmtGBP(claimAmount)} of a ${fmtGBP(receiptAmount)} receipt',
            style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFFB45309)),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            value: reason.isEmpty ? null : reason,
            decoration: InputDecoration(
              hintText: 'Select reason',
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              isDense: true,
            ),
            items: const [
              DropdownMenuItem(
                  value: 'personal_guest',
                  child: Text('Personal guest included')),
              DropdownMenuItem(
                  value: 'shared_bill',
                  child: Text('Shared bill — claiming my portion')),
              DropdownMenuItem(
                  value: 'partial_business',
                  child: Text('Partial business use')),
              DropdownMenuItem(value: 'other', child: Text('Other')),
            ],
            onChanged: (v) => onReasonChanged(v ?? ''),
          ),
          if (reason == 'other') ...[
            const SizedBox(height: 8),
            TextField(
              controller: otherController,
              decoration: InputDecoration(
                hintText: 'Please describe the reason…',
                border:
                    OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// Private alias for internal use
class _PartialClaimInfo extends PartialClaimInfo {
  const _PartialClaimInfo({
    required super.receiptAmount,
    required super.claimAmount,
    required super.reason,
    required super.otherController,
    required super.onReasonChanged,
  });
}
