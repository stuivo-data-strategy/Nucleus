import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import 'new_claim_flow.dart';

class GroupClaimFlow extends StatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onSuccess;

  const GroupClaimFlow({
    super.key,
    required this.onBack,
    required this.onSuccess,
  });

  @override
  State<GroupClaimFlow> createState() => _GroupClaimFlowState();
}

class _GroupClaimFlowState extends State<GroupClaimFlow> {
  final _amountCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _dateCtrl = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(DateTime.now()));
  final _searchCtrl = TextEditingController();

  List<Map<String, dynamic>> _attendees = [];
  List<Map<String, dynamic>> _searchResults = [];
  String _splitMode = 'equal'; // equal | custom
  final Map<String, TextEditingController> _customAmounts = {};

  List<Map<String, dynamic>> _policyChecks = [];
  bool _policyLoading = false;
  List<Map<String, dynamic>> _routeSteps = [];
  bool _routeLoading = false;
  Timer? _policyDebounce;
  Timer? _routeDebounce;

  bool _submitting = false;
  Map<String, dynamic>? _confirmed;

  double get _totalAmount => double.tryParse(_amountCtrl.text) ?? 0;

  @override
  void initState() {
    super.initState();
    // Add current user as claimant
    final auth = context.read<AuthProvider>();
    final user = auth.currentUser;
    if (user != null) {
      _attendees = [
        {
          'id': user.id,
          'name': user.fullName,
          'isClaimant': true,
        }
      ];
    }
    _amountCtrl.addListener(_onAmountChanged);
  }

  @override
  void dispose() {
    _policyDebounce?.cancel();
    _routeDebounce?.cancel();
    _amountCtrl.dispose();
    _descCtrl.dispose();
    _dateCtrl.dispose();
    _searchCtrl.dispose();
    for (final c in _customAmounts.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _onAmountChanged() {
    _debouncePolicy();
    _debounceRoute();
  }

  Future<void> _searchPeople(String query) async {
    if (query.length < 3) {
      setState(() => _searchResults = []);
      return;
    }
    try {
      final api = context.read<ApiClient>();
      final resp = await api.get('/people', queryParams: {'q': query});
      final people = (resp['data'] as List<dynamic>?) ?? [];
      final existingIds = _attendees.map((a) => a['id']).toSet();
      setState(() {
        _searchResults = people
            .map((p) => Map<String, dynamic>.from(p))
            .where((p) => !existingIds.contains(p['id']))
            .toList();
      });
    } catch (_) {
      setState(() => _searchResults = []);
    }
  }

  void _addAttendee(Map<String, dynamic> person) {
    setState(() {
      _attendees.add({
        'id': person['id'],
        'name':
            '${person['first_name'] ?? ''} ${person['last_name'] ?? ''}'.trim(),
        'isClaimant': false,
      });
      _searchResults = [];
      _searchCtrl.clear();
    });
  }

  void _removeAttendee(int index) {
    if (_attendees[index]['isClaimant'] == true) return;
    setState(() {
      _customAmounts.remove(_attendees[index]['id']);
      _attendees.removeAt(index);
    });
  }

  void _debouncePolicy() {
    _policyDebounce?.cancel();
    _policyDebounce = Timer(const Duration(milliseconds: 300), () async {
      if (_totalAmount <= 0) return;
      setState(() => _policyLoading = true);
      try {
        final api = context.read<ApiClient>();
        final resp = await api.post('/policies/validate', body: {
          'category': 'meals',
          'amount': _totalAmount,
          'has_receipt': true,
          'date': _dateCtrl.text,
        });
        final data = resp['data'] ?? resp;
        if (mounted) {
          setState(() {
            _policyChecks = (data['checks'] as List<dynamic>?)
                    ?.map((c) => Map<String, dynamic>.from(c))
                    .toList() ??
                [];
            _policyLoading = false;
          });
        }
      } catch (_) {
        if (mounted) setState(() => _policyLoading = false);
      }
    });
  }

  void _debounceRoute() {
    _routeDebounce?.cancel();
    _routeDebounce = Timer(const Duration(milliseconds: 400), () async {
      if (_totalAmount <= 0) return;
      setState(() => _routeLoading = true);
      try {
        final api = context.read<ApiClient>();
        final resp = await api.post('/expenses/preview-route',
            body: {'amount': _totalAmount, 'category': 'meals'});
        final data = resp['data'] ?? resp;
        if (mounted) {
          setState(() {
            _routeSteps = (data['steps'] as List<dynamic>?)
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

  bool get _isCustomValid {
    if (_splitMode == 'equal') return true;
    final total = _attendees.fold(0.0, (sum, a) {
      final ctrl = _customAmounts[a['id']];
      return sum + (double.tryParse(ctrl?.text ?? '') ?? 0);
    });
    return (total - _totalAmount).abs() < 0.02;
  }

  bool get _canSubmit {
    if (_totalAmount <= 0) return false;
    if (_attendees.length < 2) return false;
    if (!_isCustomValid) return false;
    if (_policyChecks.any((c) => c['severity'] == 'fail')) return false;
    return !_submitting;
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);
    try {
      final api = context.read<ApiClient>();
      final attendeeAmounts = _attendees.map((a) {
        if (_splitMode == 'equal') {
          return {
            'person_id': a['id'],
            'amount': _totalAmount / _attendees.length,
          };
        }
        final ctrl = _customAmounts[a['id']];
        return {
          'person_id': a['id'],
          'amount': double.tryParse(ctrl?.text ?? '') ?? 0,
        };
      }).toList();

      final resp = await api.post('/expenses', body: {
        'category': 'meals',
        'claim_type': 'group',
        'amount': _totalAmount,
        'receipt_amount': _totalAmount,
        'claim_amount': _totalAmount,
        'date': _dateCtrl.text,
        'has_receipt': true,
        'description': _descCtrl.text.trim(),
        'currency': 'GBP',
        'attendees': _attendees.map((a) => a['id']).toList(),
        'cost_split': _splitMode,
        'attendee_amounts': attendeeAmounts,
      });

      if (mounted) {
        setState(() {
          _confirmed = resp['data'] ?? resp;
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
    if (_confirmed != null) {
      return Column(
        children: [
          const ClaimHeader(title: 'Claim Submitted'),
          Expanded(
            child: ClaimConfirmation(
              confirmedClaim: _confirmed!,
              claimAmount: _totalAmount,
              category: 'meals',
              onDone: widget.onSuccess,
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        ClaimHeader(
          title: 'Group Expense',
          onBack: widget.onBack,
          onClose: () => Navigator.of(context).pop(false),
        ),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Total amount
                const Text('Total Receipt Amount (£)',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                TextField(
                  controller: _amountCtrl,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  style: NucleusTheme.monoAmount(fontSize: 20),
                  decoration: InputDecoration(
                    prefixText: '£ ',
                    prefixStyle: NucleusTheme.monoAmount(
                        fontSize: 20, color: Colors.grey[600]),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                  ),
                ),
                const SizedBox(height: 16),

                // Description
                const Text('Reason for meeting/expense',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                TextField(
                  controller: _descCtrl,
                  decoration: InputDecoration(
                    hintText: 'e.g. Team lunch to welcome new starter',
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                  ),
                ),
                const SizedBox(height: 16),

                // Date
                const Text('Date',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                TextField(
                  controller: _dateCtrl,
                  readOnly: true,
                  decoration: InputDecoration(
                    suffixIcon: const Icon(Icons.calendar_today, size: 18),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                  ),
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.tryParse(_dateCtrl.text) ??
                          DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now(),
                    );
                    if (picked != null) {
                      _dateCtrl.text =
                          DateFormat('yyyy-MM-dd').format(picked);
                    }
                  },
                ),
                const SizedBox(height: 20),

                // Attendees
                Text(
                  'Attendees (${_attendees.length} people${_attendees.any((a) => a['isClaimant'] == true) ? ' including you' : ''})',
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 13),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: _attendees.asMap().entries.map((e) {
                    final a = e.value;
                    final isClaim = a['isClaimant'] == true;
                    return Chip(
                      label: Text(a['name'] ?? '',
                          style: const TextStyle(fontSize: 12)),
                      backgroundColor:
                          NucleusColors.accentTeal.withValues(alpha: 0.1),
                      side: const BorderSide(color: NucleusColors.accentTeal),
                      deleteIcon: isClaim
                          ? const Icon(Icons.lock, size: 14)
                          : const Icon(Icons.close, size: 14),
                      onDeleted:
                          isClaim ? null : () => _removeAttendee(e.key),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 8),
                // Search to add
                TextField(
                  controller: _searchCtrl,
                  decoration: InputDecoration(
                    hintText: 'Search people to add…',
                    prefixIcon: const Icon(Icons.search, size: 18),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    isDense: true,
                  ),
                  onChanged: _searchPeople,
                ),
                if (_searchResults.isNotEmpty)
                  Card(
                    margin: const EdgeInsets.only(top: 4),
                    child: Column(
                      children: _searchResults
                          .take(5)
                          .map((p) => ListTile(
                                dense: true,
                                title: Text(
                                    '${p['first_name']} ${p['last_name']}',
                                    style: const TextStyle(fontSize: 13)),
                                subtitle: Text(p['job_title'] ?? '',
                                    style: const TextStyle(fontSize: 11)),
                                onTap: () => _addAttendee(p),
                              ))
                          .toList(),
                    ),
                  ),

                // Split section
                if (_attendees.length > 1 && _totalAmount > 0) ...[
                  const SizedBox(height: 20),
                  const Text('Cost Split',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 8),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'equal', label: Text('Equal')),
                      ButtonSegment(value: 'custom', label: Text('Custom')),
                    ],
                    selected: {_splitMode},
                    onSelectionChanged: (s) =>
                        setState(() => _splitMode = s.first),
                  ),
                  const SizedBox(height: 12),
                  if (_splitMode == 'equal')
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: NucleusColors.accentTeal.withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${fmtGBP(_totalAmount / _attendees.length)} per person',
                        style: NucleusTheme.monoAmount(
                            fontSize: 16, color: NucleusColors.primaryNavy),
                      ),
                    )
                  else ...[
                    ..._attendees.map((a) {
                      final ctrl = _customAmounts.putIfAbsent(
                          a['id']!, () => TextEditingController());
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 2,
                              child: Text(a['name'] ?? '',
                                  style: const TextStyle(fontSize: 13)),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: ctrl,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                        decimal: true),
                                style: NucleusTheme.monoAmount(fontSize: 14),
                                decoration: InputDecoration(
                                  prefixText: '£',
                                  isDense: true,
                                  border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(6)),
                                  contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 8),
                                ),
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                    if (!_isCustomValid)
                      Text(
                        'Total must equal ${fmtGBP(_totalAmount)}',
                        style: const TextStyle(
                            color: Color(0xFFDC2626), fontSize: 12),
                      ),
                  ],
                ],

                const SizedBox(height: 20),

                // Policy checks
                if (_policyChecks.isNotEmpty) ...[
                  const Text('Policy Checks',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 8),
                  PolicyChecksList(checks: _policyChecks),
                  const SizedBox(height: 16),
                ],

                // Route preview
                if (_routeSteps.isNotEmpty || _routeLoading) ...[
                  const Text('Approval Route',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 8),
                  if (_routeLoading)
                    const Center(
                        child: SizedBox(
                            width: 20,
                            height: 20,
                            child:
                                CircularProgressIndicator(strokeWidth: 2)))
                  else
                    ApprovalRoutePreview(steps: _routeSteps),
                  const SizedBox(height: 16),
                ],

                // Submit
                FilledButton(
                  onPressed: _canSubmit ? _submit : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: NucleusColors.accentTeal,
                    minimumSize: const Size(double.infinity, 48),
                  ),
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : Text('Submit · ${fmtGBP(_totalAmount)}',
                          style:
                              const TextStyle(fontWeight: FontWeight.w600)),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
