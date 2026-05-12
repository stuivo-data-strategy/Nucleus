import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import 'new_claim_flow.dart';

class MileageClaimFlow extends StatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onSuccess;

  const MileageClaimFlow({
    super.key,
    required this.onBack,
    required this.onSuccess,
  });

  @override
  State<MileageClaimFlow> createState() => _MileageClaimFlowState();
}

class _MileageClaimFlowState extends State<MileageClaimFlow> {
  final _fromCtrl = TextEditingController();
  final _toCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _dateCtrl = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(DateTime.now()));
  bool _returnJourney = false;

  // Profile
  bool _profileLoading = true;
  List<Map<String, dynamic>> _vehicles = [];
  List<Map<String, dynamic>> _savedJourneys = [];
  double _totalMilesYtd = 0;
  String _selectedVehicle = '';

  // Distance
  double? _distanceMiles;
  String? _route;
  bool _calculating = false;

  // Calculated
  double _calculatedAmount = 0;
  String _rateApplied = '45p';

  // Policy & route
  List<Map<String, dynamic>> _policyChecks = [];
  bool _policyLoading = false;
  List<Map<String, dynamic>> _routeSteps = [];
  bool _routeLoading = false;
  Timer? _policyDebounce;
  Timer? _routeDebounce;

  // Exception
  bool _exceptionRequested = false;
  final _exceptionJustCtrl = TextEditingController();
  bool _exceptionConfirmed = false;
  bool _hasAmountFail = false;

  // Submit
  bool _submitting = false;
  Map<String, dynamic>? _confirmed;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _policyDebounce?.cancel();
    _routeDebounce?.cancel();
    _fromCtrl.dispose();
    _toCtrl.dispose();
    _descCtrl.dispose();
    _dateCtrl.dispose();
    _exceptionJustCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final api = context.read<ApiClient>();
      final resp = await api.get('/expenses/mileage-profile');
      final data = resp['data'] ?? resp;
      if (mounted) {
        setState(() {
          _vehicles = (data['vehicles'] as List<dynamic>?)
                  ?.map((v) => Map<String, dynamic>.from(v))
                  .toList() ??
              [];
          _savedJourneys = (data['saved_journeys'] as List<dynamic>?)
                  ?.map((j) => Map<String, dynamic>.from(j))
                  .toList() ??
              [];
          _totalMilesYtd =
              (data['total_miles'] as num?)?.toDouble() ?? 0;
          if (_vehicles.isNotEmpty) {
            _selectedVehicle = _vehicles.first['id']?.toString() ?? '';
          }
          _profileLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _profileLoading = false);
    }
  }

  Future<void> _calculateDistance() async {
    if (_fromCtrl.text.trim().isEmpty || _toCtrl.text.trim().isEmpty) return;
    setState(() => _calculating = true);
    try {
      final api = context.read<ApiClient>();
      final resp = await api.post('/expenses/calculate-distance', body: {
        'from': _fromCtrl.text.trim(),
        'to': _toCtrl.text.trim(),
      });
      final data = resp['data'] ?? resp;
      if (mounted) {
        setState(() {
          _distanceMiles =
              (data['distanceMiles'] as num?)?.toDouble() ?? 0;
          _route = data['route']?.toString();
          _calculating = false;
        });
        _recalcAmount();
      }
    } catch (_) {
      if (mounted) setState(() => _calculating = false);
    }
  }

  void _recalcAmount() {
    if (_distanceMiles == null) return;
    final finalDist =
        _returnJourney ? _distanceMiles! * 2 : _distanceMiles!;
    final availableAt45 = (10000 - _totalMilesYtd).clamp(0, double.infinity);

    double amount;
    if (finalDist <= availableAt45) {
      amount = finalDist * 0.45;
      _rateApplied = '45p';
    } else if (availableAt45 > 0) {
      amount = (availableAt45 * 0.45) + ((finalDist - availableAt45) * 0.25);
      _rateApplied = 'Split (45p / 25p)';
    } else {
      amount = finalDist * 0.25;
      _rateApplied = '25p';
    }

    setState(() => _calculatedAmount = amount);
    _debouncePolicy();
    _debounceRoute();
  }

  void _selectSavedJourney(Map<String, dynamic> j) {
    _fromCtrl.text = j['from'] ?? '';
    _toCtrl.text = j['to'] ?? '';
    Future.delayed(
        const Duration(milliseconds: 100), () => _calculateDistance());
  }

  void _debouncePolicy() {
    _policyDebounce?.cancel();
    _policyDebounce = Timer(const Duration(milliseconds: 300), () async {
      if (_calculatedAmount <= 0) return;
      setState(() => _policyLoading = true);
      try {
        final api = context.read<ApiClient>();
        final resp = await api.post('/policies/validate', body: {
          'category': 'mileage',
          'amount': _calculatedAmount,
          'has_receipt': false,
          'date': _dateCtrl.text,
        });
        final data = resp['data'] ?? resp;
        if (mounted) {
          setState(() {
            _policyChecks = (data['checks'] as List<dynamic>?)
                    ?.map((c) => Map<String, dynamic>.from(c))
                    .toList() ??
                [];
            _hasAmountFail = _policyChecks.any((c) =>
                c['rule_name'] == 'Category Limit' &&
                c['severity'] == 'fail');
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
      if (_calculatedAmount <= 0) return;
      setState(() => _routeLoading = true);
      try {
        final api = context.read<ApiClient>();
        final resp = await api.post('/expenses/preview-route',
            body: {'amount': _calculatedAmount, 'category': 'mileage'});
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

  bool get _canSubmit {
    if (_calculatedAmount <= 0) return false;
    if (_selectedVehicle.isEmpty) return false;
    if (_distanceMiles == null) return false;
    if (_hasAmountFail &&
        (!_exceptionRequested ||
            _exceptionJustCtrl.text.trim().isEmpty ||
            !_exceptionConfirmed)) return false;
    return !_submitting;
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);
    try {
      final api = context.read<ApiClient>();
      final finalDist =
          _returnJourney ? _distanceMiles! * 2 : _distanceMiles!;
      final body = <String, dynamic>{
        'category': 'mileage',
        'claim_type': 'mileage',
        'amount': _calculatedAmount,
        'claim_amount': _calculatedAmount,
        'receipt_amount': _calculatedAmount,
        'date': _dateCtrl.text,
        'has_receipt': false,
        'description': _descCtrl.text.trim(),
        'currency': 'GBP',
        'journey_from': _fromCtrl.text.trim(),
        'journey_to': _toCtrl.text.trim(),
        'distance_miles': finalDist,
        'return_journey': _returnJourney,
        'vehicle': _selectedVehicle,
        'mileage_rate': _rateApplied == '25p' ? 0.25 : 0.45,
      };
      if (_exceptionRequested) {
        body['exception_requested'] = true;
        body['exception_justification'] = _exceptionJustCtrl.text.trim();
      }
      final resp = await api.post('/expenses', body: body);
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
              claimAmount: _calculatedAmount,
              category: 'mileage',
              onDone: widget.onSuccess,
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        ClaimHeader(
          title: 'Mileage Claim',
          onBack: widget.onBack,
          onClose: () => Navigator.of(context).pop(false),
        ),
        if (_profileLoading)
          const Expanded(
              child: Center(child: CircularProgressIndicator()))
        else
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Saved journeys
                  if (_savedJourneys.isNotEmpty) ...[
                    const Text('Saved Journeys',
                        style: TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 36,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: _savedJourneys.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final j = _savedJourneys[i];
                          return ActionChip(
                            label: Text(j['label'] ?? '${j['from']} → ${j['to']}',
                                style: const TextStyle(fontSize: 12)),
                            onPressed: () => _selectSavedJourney(j),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Journey inputs
                  const Text('Journey',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 8),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        children: [
                          TextField(
                            controller: _fromCtrl,
                            decoration: InputDecoration(
                              labelText: 'From',
                              prefixIcon:
                                  const Icon(Icons.trip_origin, size: 18),
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8)),
                              isDense: true,
                            ),
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _toCtrl,
                            decoration: InputDecoration(
                              labelText: 'To',
                              prefixIcon:
                                  const Icon(Icons.location_on, size: 18),
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8)),
                              isDense: true,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Checkbox(
                                value: _returnJourney,
                                onChanged: (v) {
                                  setState(
                                      () => _returnJourney = v ?? false);
                                  _recalcAmount();
                                },
                              ),
                              const Text('Return journey',
                                  style: TextStyle(fontSize: 13)),
                              const Spacer(),
                              FilledButton(
                                onPressed: _calculating
                                    ? null
                                    : _calculateDistance,
                                style: FilledButton.styleFrom(
                                    backgroundColor:
                                        NucleusColors.accentTeal),
                                child: _calculating
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white))
                                    : const Text('Calculate Distance'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Distance result
                  if (_distanceMiles != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: NucleusColors.accentTeal
                            .withValues(alpha: 0.05),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                            color: NucleusColors.accentTeal
                                .withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.trending_up,
                              color: NucleusColors.accentTeal),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _returnJourney
                                      ? '${(_distanceMiles! * 2).toStringAsFixed(1)} miles total (${_distanceMiles!.toStringAsFixed(1)} each way)'
                                      : '${_distanceMiles!.toStringAsFixed(1)} miles',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14),
                                ),
                                if (_route != null)
                                  Text(_route!,
                                      style: TextStyle(
                                          fontSize: 11,
                                          color: Colors.grey[500])),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Claim value box
                  if (_calculatedAmount > 0) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: const Border(
                            left: BorderSide(
                                color: NucleusColors.accentTeal, width: 4)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 4,
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${(_returnJourney ? _distanceMiles! * 2 : _distanceMiles!).toStringAsFixed(0)} miles × $_rateApplied',
                            style: TextStyle(
                                fontSize: 13, color: Colors.grey[600]),
                          ),
                          Text(
                            fmtGBP(_calculatedAmount),
                            style: NucleusTheme.monoAmount(
                                fontSize: 22,
                                color: NucleusColors.primaryNavy),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // HMRC warning
                  if (_totalMilesYtd > 9500 && _totalMilesYtd < 10000) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: NucleusColors.warning.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.warning_amber, size: 14, color: Color(0xFFB45309)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'You have claimed ${_totalMilesYtd.toStringAsFixed(0)} miles this year — approaching the 10,000 mile HMRC threshold.',
                              style: const TextStyle(
                                  fontSize: 12, color: Color(0xFFB45309)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  // Vehicle selection
                  if (_vehicles.isNotEmpty) ...[
                    const Text('Vehicle',
                        style: TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13)),
                    const SizedBox(height: 8),
                    ..._vehicles.map((v) {
                      final id = v['id']?.toString() ?? '';
                      final isSelected = _selectedVehicle == id;
                      final fuelType = v['fuel_type'] ?? '';
                      final isElectric =
                          fuelType.toString().toLowerCase() == 'electric';
                      return Card(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: BorderSide(
                            color: isSelected
                                ? NucleusColors.accentTeal
                                : Colors.grey[200]!,
                            width: isSelected ? 2 : 1,
                          ),
                        ),
                        color: isSelected
                            ? NucleusColors.accentTeal
                                .withValues(alpha: 0.05)
                            : null,
                        child: ListTile(
                          dense: true,
                          leading: Text(isElectric ? '⚡' : '⛽',
                              style: const TextStyle(fontSize: 20)),
                          title: Text(v['registration'] ?? '',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14)),
                          subtitle: Text(
                            '${v['make'] ?? ''} ${v['engine_cc'] ?? ''}cc · $fuelType',
                            style: const TextStyle(fontSize: 12),
                          ),
                          trailing: isSelected
                              ? const Icon(Icons.check_circle,
                                  color: NucleusColors.accentTeal)
                              : null,
                          onTap: () =>
                              setState(() => _selectedVehicle = id),
                        ),
                      );
                    }),
                    const SizedBox(height: 16),
                  ],

                  // Description
                  const Text('Reason for travel',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _descCtrl,
                    decoration: InputDecoration(
                      hintText: 'e.g. Client visit in Manchester',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Date
                  const Text('Date',
                      style: TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 13)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _dateCtrl,
                    readOnly: true,
                    decoration: InputDecoration(
                      suffixIcon:
                          const Icon(Icons.calendar_today, size: 18),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
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
                        _dateCtrl.text =
                            DateFormat('yyyy-MM-dd').format(picked);
                      }
                    },
                  ),
                  const SizedBox(height: 20),

                  // Policy checks
                  if (_policyChecks.isNotEmpty) ...[
                    const Text('Policy Checks',
                        style: TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13)),
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
                              child: CircularProgressIndicator(
                                  strokeWidth: 2)))
                    else
                      ApprovalRoutePreview(steps: _routeSteps),
                    const SizedBox(height: 16),
                  ],

                  // Submit
                  FilledButton(
                    onPressed: _canSubmit ? _submit : null,
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
                        : Text(
                            'Submit · ${fmtGBP(_calculatedAmount)}',
                            style: const TextStyle(
                                fontWeight: FontWeight.w600)),
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
