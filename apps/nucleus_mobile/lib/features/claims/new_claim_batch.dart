import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import 'new_claim_flow.dart';

// ---------------------------------------------------------------------------
// Multi-Line / Batch Claim Flow
//
// Step 1 — Header creation (trip name, date range → draft)
// Step 2 — Sequential scanning loop (scan receipts, build line list)
// Step 3 — Review & edit all lines (include/exclude, edit fields)
// Step 4 — Submit included lines, excluded stay as draft
// ---------------------------------------------------------------------------

class BatchClaimFlow extends StatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onSuccess;

  const BatchClaimFlow({
    super.key,
    required this.onBack,
    required this.onSuccess,
  });

  @override
  State<BatchClaimFlow> createState() => _BatchClaimFlowState();
}

enum _BatchScreen { header, scanning, scanProgress, editing, review, confirmed }

class _BatchClaimFlowState extends State<BatchClaimFlow> {
  _BatchScreen _screen = _BatchScreen.header;

  // ---- Step 1: Header ----
  final _tripNameCtrl = TextEditingController();
  final _startDateCtrl = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(DateTime.now()));
  final _endDateCtrl = TextEditingController(
      text: DateFormat('yyyy-MM-dd').format(DateTime.now()));
  String _headerRef = '';

  // ---- Step 2: Line items ----
  final List<_LineItem> _items = [];
  int? _editingIndex;

  // Desktop multi-file progress
  int _scanTotal = 0;
  int _scanCurrent = 0;
  String? _lastError;

  // ---- Step 3: Editing controllers ----
  final _editAmountCtrl = TextEditingController();
  final _editDescCtrl = TextEditingController();
  final _editDateCtrl = TextEditingController();
  String _editCategory = 'meals';
  _BatchScreen _returnAfterEdit = _BatchScreen.scanning;

  // Per-line policy (index → checks)
  final Map<int, List<Map<String, dynamic>>> _linePolicyChecks = {};
  final Map<int, bool> _linePolicyLoading = {};

  // Overall route
  List<Map<String, dynamic>> _routeSteps = [];
  List<Map<String, dynamic>> _skippedSteps = [];
  bool _routeLoading = false;
  Timer? _routeDebounce;

  // Submit
  bool _submitting = false;
  Map<String, dynamic>? _confirmed;

  double get _totalIncluded => _items
      .where((i) => i.included)
      .fold(0.0, (s, i) => s + i.amount);

  int get _includedCount => _items.where((i) => i.included).length;
  int get _excludedCount => _items.where((i) => !i.included).length;

  @override
  void dispose() {
    _routeDebounce?.cancel();
    _tripNameCtrl.dispose();
    _startDateCtrl.dispose();
    _endDateCtrl.dispose();
    _editAmountCtrl.dispose();
    _editDescCtrl.dispose();
    _editDateCtrl.dispose();
    super.dispose();
  }

  // ===========================================================================
  // STEP 1 — Create header
  // ===========================================================================

  String _generateRef() {
    final now = DateTime.now();
    return 'TRIP-${now.millisecondsSinceEpoch.toString().substring(7)}';
  }

  void _createHeader() {
    if (_tripNameCtrl.text.trim().isEmpty) return;
    setState(() {
      _headerRef = _generateRef();
      _screen = _BatchScreen.scanning;
    });
  }

  // ===========================================================================
  // STEP 2 — Scanning
  // ===========================================================================

  /// Mobile: pick a single image and process OCR
  Future<void> _scanSingleReceipt() async {
    setState(() => _lastError = null);
    final picker = ImagePicker();
    debugPrint('[BatchClaim] Opening image picker (single)...');
    final file = await picker.pickImage(source: ImageSource.gallery);
    if (file == null) {
      debugPrint('[BatchClaim] Image picker cancelled');
      return;
    }
    debugPrint('[BatchClaim] File selected: ${file.name}');

    setState(() {
      _scanTotal = 1;
      _scanCurrent = 1;
      _screen = _BatchScreen.scanProgress;
    });

    await _processOcrFromFile(file);

    if (mounted) setState(() => _screen = _BatchScreen.scanning);
  }

  /// Desktop: pick multiple files and process sequentially
  Future<void> _pickMultipleFiles() async {
    setState(() => _lastError = null);
    final picker = ImagePicker();
    debugPrint('[BatchClaim] Opening multi-image picker...');
    final files = await picker.pickMultiImage();
    if (files.isEmpty) {
      debugPrint('[BatchClaim] Multi-image picker cancelled or empty');
      return;
    }
    debugPrint('[BatchClaim] ${files.length} file(s) selected');

    setState(() {
      _scanTotal = files.length;
      _scanCurrent = 0;
      _screen = _BatchScreen.scanProgress;
    });

    for (var i = 0; i < files.length; i++) {
      if (!mounted) return;
      setState(() => _scanCurrent = i + 1);
      debugPrint('[BatchClaim] Processing file ${i + 1}/${files.length}: ${files[i].name}');
      await _processOcrFromFile(files[i]);
    }

    if (mounted) setState(() => _screen = _BatchScreen.scanning);
  }

  /// Read file bytes, encode as base64, send to OCR endpoint, add line item
  Future<void> _processOcrFromFile(XFile file) async {
    try {
      // Read the file bytes (works on web and native)
      debugPrint('[BatchClaim] Reading bytes for: ${file.name}');
      final bytes = await file.readAsBytes();
      final base64Image = base64Encode(bytes);
      debugPrint('[BatchClaim] File read: ${bytes.length} bytes, base64 length: ${base64Image.length}');

      debugPrint('[BatchClaim] Sending to OCR endpoint...');
      final api = context.read<ApiClient>();
      final resp = await api.post('/expenses/ocr-scan', body: {
        'image': base64Image,
        'filename': file.name,
      });
      final data = resp['data'] ?? resp;
      debugPrint('[BatchClaim] OCR response received: vendor=${data['vendor']}, amount=${data['amount']}, category=${data['category_suggestion']}');

      final item = _LineItem(
        amount: (data['amount'] as num?)?.toDouble() ?? 0,
        category: data['category_suggestion'] ?? 'other',
        description: 'Expense at ${data['vendor'] ?? 'vendor'}',
        date: data['date'] ?? DateFormat('yyyy-MM-dd').format(DateTime.now()),
        receiptAmount: (data['amount'] as num?)?.toDouble() ?? 0,
        hasReceipt: true,
        vendor: data['vendor'] ?? '',
        included: true,
      );

      if (mounted) {
        setState(() {
          _items.add(item);
          _lastError = null;
        });
        _validateLinePolicy(_items.length - 1);
      }
    } catch (e) {
      debugPrint('[BatchClaim] OCR error: $e');
      if (mounted) {
        setState(() => _lastError = 'OCR failed: $e');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to process receipt: $e'),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    }
  }

  void _addManualItem() {
    final item = _LineItem(
      amount: 0,
      category: 'meals',
      description: '',
      date: DateFormat('yyyy-MM-dd').format(DateTime.now()),
      receiptAmount: 0,
      hasReceipt: false,
      vendor: '',
      included: true,
    );
    setState(() {
      _items.add(item);
      _editingIndex = _items.length - 1;
      _loadEditControllers(_items.length - 1);
      _screen = _BatchScreen.editing;
    });
  }

  // ===========================================================================
  // Editing a single line
  // ===========================================================================

  void _startEditing(int index, {_BatchScreen? returnTo}) {
    _loadEditControllers(index);
    setState(() {
      _editingIndex = index;
      _returnAfterEdit = returnTo ?? _screen;
      _screen = _BatchScreen.editing;
    });
  }

  void _loadEditControllers(int index) {
    final item = _items[index];
    _editAmountCtrl.text =
        item.amount > 0 ? item.amount.toStringAsFixed(2) : '';
    _editDescCtrl.text = item.description;
    _editDateCtrl.text = item.date;
    _editCategory = item.category;
  }

  void _saveEdit() {
    if (_editingIndex == null) return;
    final amount = double.tryParse(_editAmountCtrl.text) ?? 0;
    final old = _items[_editingIndex!];
    setState(() {
      _items[_editingIndex!] = _LineItem(
        amount: amount,
        category: _editCategory,
        description: _editDescCtrl.text.trim(),
        date: _editDateCtrl.text,
        receiptAmount: old.receiptAmount,
        hasReceipt: old.hasReceipt,
        vendor: old.vendor,
        included: old.included,
      );
    });
    _validateLinePolicy(_editingIndex!);
    setState(() {
      _screen = _returnAfterEdit;
      _editingIndex = null;
    });
  }

  void _removeItem(int index) {
    setState(() {
      _items.removeAt(index);
      // Re-key policy maps
      final newChecks = <int, List<Map<String, dynamic>>>{};
      final newLoading = <int, bool>{};
      for (final e in _linePolicyChecks.entries) {
        if (e.key == index) continue;
        final k = e.key > index ? e.key - 1 : e.key;
        newChecks[k] = e.value;
      }
      for (final e in _linePolicyLoading.entries) {
        if (e.key == index) continue;
        final k = e.key > index ? e.key - 1 : e.key;
        newLoading[k] = e.value;
      }
      _linePolicyChecks
        ..clear()
        ..addAll(newChecks);
      _linePolicyLoading
        ..clear()
        ..addAll(newLoading);
    });
  }

  void _toggleInclude(int index) {
    setState(() {
      final old = _items[index];
      _items[index] = _LineItem(
        amount: old.amount,
        category: old.category,
        description: old.description,
        date: old.date,
        receiptAmount: old.receiptAmount,
        hasReceipt: old.hasReceipt,
        vendor: old.vendor,
        included: !old.included,
      );
    });
  }

  // ===========================================================================
  // Per-line policy validation
  // ===========================================================================

  Future<void> _validateLinePolicy(int index) async {
    if (index >= _items.length) return;
    final item = _items[index];
    if (item.amount <= 0) return;

    setState(() => _linePolicyLoading[index] = true);
    try {
      final api = context.read<ApiClient>();
      final resp = await api.post('/policies/validate', body: {
        'category': item.category,
        'amount': item.amount,
        'has_receipt': item.hasReceipt,
        'date': item.date,
      });
      final data = resp['data'] ?? resp;
      final checks = (data['checks'] as List<dynamic>?)
              ?.map((c) => Map<String, dynamic>.from(c))
              .toList() ??
          [];
      if (mounted) {
        setState(() {
          _linePolicyChecks[index] = checks;
          _linePolicyLoading[index] = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _linePolicyLoading[index] = false);
    }
  }

  // ===========================================================================
  // Approval route (based on total of included lines)
  // ===========================================================================

  void _debounceRoute() {
    _routeDebounce?.cancel();
    _routeDebounce = Timer(const Duration(milliseconds: 400), () async {
      if (_totalIncluded <= 0) return;
      setState(() => _routeLoading = true);
      try {
        final api = context.read<ApiClient>();
        final resp = await api.post('/expenses/preview-route',
            body: {'amount': _totalIncluded, 'category': 'meals'});
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

  // ===========================================================================
  // Submit
  // ===========================================================================

  bool get _canSubmit {
    if (_includedCount == 0) return false;
    final included = _items.where((i) => i.included);
    if (included.any((i) => i.amount <= 0 || i.description.trim().isEmpty)) {
      return false;
    }
    return !_submitting;
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() => _submitting = true);
    try {
      final api = context.read<ApiClient>();
      final includedLines = <Map<String, dynamic>>[];
      final excludedLines = <Map<String, dynamic>>[];

      for (final item in _items) {
        final line = {
          'category': item.category,
          'amount': item.amount,
          'date': item.date,
          'has_receipt': item.hasReceipt,
          'description': item.description,
          'receipt_amount':
              item.receiptAmount > 0 ? item.receiptAmount : item.amount,
        };
        if (item.included) {
          includedLines.add(line);
        } else {
          excludedLines.add(line);
        }
      }

      final resp = await api.post('/expenses', body: {
        'claim_type': 'batch',
        'category': 'other',
        'amount': _totalIncluded,
        'receipt_amount': _totalIncluded,
        'claim_amount': _totalIncluded,
        'date': _startDateCtrl.text,
        'has_receipt': includedLines.any((l) => l['has_receipt'] == true),
        'description': _tripNameCtrl.text.trim(),
        'currency': 'GBP',
        'reference': _headerRef,
        'trip_name': _tripNameCtrl.text.trim(),
        'date_from': _startDateCtrl.text,
        'date_to': _endDateCtrl.text,
        'line_items': includedLines,
        if (excludedLines.isNotEmpty) 'draft_lines': excludedLines,
      });

      if (mounted) {
        setState(() {
          _confirmed = resp['data'] ?? resp;
          _screen = _BatchScreen.confirmed;
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

  // ===========================================================================
  // BUILD
  // ===========================================================================

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width > kMobileBreakpoint;

    return Column(
      children: [
        ClaimHeader(
          title: _headerTitle,
          onBack: _handleBack,
          onClose: _screen == _BatchScreen.confirmed
              ? null
              : () => Navigator.of(context).pop(false),
        ),
        Expanded(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            child: switch (_screen) {
              _BatchScreen.header => _buildHeaderStep(),
              _BatchScreen.scanning => _buildScanningStep(isDesktop),
              _BatchScreen.scanProgress => _buildScanProgressStep(),
              _BatchScreen.editing => _buildEditStep(),
              _BatchScreen.review => _buildReviewStep(),
              _BatchScreen.confirmed => _buildConfirmation(),
            },
          ),
        ),
      ],
    );
  }

  String get _headerTitle => switch (_screen) {
        _BatchScreen.header => 'Multi-Line Claim',
        _BatchScreen.scanning =>
          _items.isEmpty ? 'Scan Receipts' : _tripNameCtrl.text.trim(),
        _BatchScreen.scanProgress => 'Processing Receipts',
        _BatchScreen.editing => 'Edit Line Item',
        _BatchScreen.review => 'Review & Submit',
        _BatchScreen.confirmed => 'Claim Submitted',
      };

  VoidCallback? get _handleBack => switch (_screen) {
        _BatchScreen.header => widget.onBack,
        _BatchScreen.scanning => () =>
            setState(() => _screen = _BatchScreen.header),
        _BatchScreen.scanProgress => null,
        _BatchScreen.editing => () {
            setState(() {
              _editingIndex = null;
              _screen = _returnAfterEdit;
            });
          },
        _BatchScreen.review => () =>
            setState(() => _screen = _BatchScreen.scanning),
        _BatchScreen.confirmed => null,
      };

  // ===========================================================================
  // STEP 1 — Header form
  // ===========================================================================

  Widget _buildHeaderStep() {
    return SingleChildScrollView(
      key: const ValueKey('header'),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Intro
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: NucleusColors.accentTeal.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: NucleusColors.accentTeal.withValues(alpha: 0.15)),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: NucleusColors.accentTeal.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(Icons.dynamic_feed,
                      color: NucleusColors.accentTeal, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Group multiple receipts under one header',
                        style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            color: NucleusColors.primaryNavy),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Create a trip or period header first, then scan receipts.',
                        style:
                            TextStyle(fontSize: 12, color: Colors.grey[600]),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Trip name
          const Text('Trip / Header Name',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 6),
          TextField(
            controller: _tripNameCtrl,
            decoration: InputDecoration(
              hintText: 'e.g. London Trip, January Receipts, Client Visit Birmingham',
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 20),

          // Date range
          const Text('Date Range',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _startDateCtrl,
                  readOnly: true,
                  decoration: InputDecoration(
                    labelText: 'Start',
                    suffixIcon: const Icon(Icons.calendar_today, size: 16),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                  onTap: () => _pickDate(_startDateCtrl),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                child: Icon(Icons.arrow_forward, size: 16, color: Colors.grey[400]),
              ),
              Expanded(
                child: TextField(
                  controller: _endDateCtrl,
                  readOnly: true,
                  decoration: InputDecoration(
                    labelText: 'End',
                    suffixIcon: const Icon(Icons.calendar_today, size: 16),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                  onTap: () => _pickDate(_endDateCtrl),
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),

          // Start scanning
          FilledButton.icon(
            onPressed:
                _tripNameCtrl.text.trim().isNotEmpty ? _createHeader : null,
            icon: const Icon(Icons.photo_camera),
            label: const Text('Start Scanning',
                style: TextStyle(fontWeight: FontWeight.w600)),
            style: FilledButton.styleFrom(
              backgroundColor: NucleusColors.accentTeal,
              minimumSize: const Size(double.infinity, 48),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickDate(TextEditingController ctrl) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(ctrl.text) ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) {
      ctrl.text = DateFormat('yyyy-MM-dd').format(picked);
      setState(() {});
    }
  }

  // ===========================================================================
  // STEP 2 — Scanning loop
  // ===========================================================================

  Widget _buildScanningStep(bool isDesktop) {
    return Column(
      key: const ValueKey('scanning'),
      children: [
        // Header info bar
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: NucleusColors.primaryNavy.withValues(alpha: 0.04),
          child: Row(
            children: [
              const Icon(Icons.folder_open,
                  size: 16, color: NucleusColors.accentTeal),
              const SizedBox(width: 8),
              Expanded(
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(
                      text: _tripNameCtrl.text.trim(),
                      style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: NucleusColors.primaryNavy),
                    ),
                    TextSpan(
                      text:
                          ' — ${_items.length} line${_items.length == 1 ? '' : 's'} added',
                      style: TextStyle(fontSize: 13, color: Colors.grey[500]),
                    ),
                  ]),
                ),
              ),
              Text(
                _headerRef,
                style: NucleusTheme.mono.copyWith(
                    fontSize: 11, color: Colors.grey[400]),
              ),
            ],
          ),
        ),

        // Error banner
        if (_lastError != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: const Color(0xFFFEF2F2),
            child: Row(
              children: [
                const Icon(Icons.error,
                    size: 16, color: Color(0xFFDC2626)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _lastError!,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFFDC2626)),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 14),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () => setState(() => _lastError = null),
                  color: const Color(0xFFDC2626),
                ),
              ],
            ),
          ),

        // Line items list
        Expanded(
          child: _items.isEmpty
              ? _buildScanEmpty(isDesktop)
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
                  itemCount: _items.length,
                  itemBuilder: (_, i) => _buildScanLineCard(i),
                ),
        ),

        // Bottom action bar
        Container(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 8,
                  offset: const Offset(0, -2)),
            ],
          ),
          child: Column(
            children: [
              if (_items.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${_items.length} line${_items.length == 1 ? '' : 's'}',
                        style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                      ),
                      Text(
                        'Total: ${fmtGBP(_totalIncluded)}',
                        style: NucleusTheme.monoAmount(
                            fontSize: 16, color: NucleusColors.primaryNavy),
                      ),
                    ],
                  ),
                ),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed:
                          isDesktop ? _pickMultipleFiles : _scanSingleReceipt,
                      icon: Icon(
                          isDesktop ? Icons.upload_file : Icons.photo_camera,
                          size: 18),
                      label: Text(isDesktop
                          ? 'Select Receipt Files'
                          : 'Scan Receipt'),
                      style: FilledButton.styleFrom(
                        backgroundColor: NucleusColors.accentTeal,
                        minimumSize: const Size(0, 44),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _addManualItem,
                      icon: const Icon(Icons.edit, size: 18),
                      label: const Text('Add Manually'),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 44),
                      ),
                    ),
                  ),
                ],
              ),
              if (_items.isNotEmpty) ...[
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: () {
                    _debounceRoute();
                    setState(() => _screen = _BatchScreen.review);
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: NucleusColors.primaryNavy,
                    minimumSize: const Size(double.infinity, 44),
                  ),
                  child: Text(
                    'Done — Review All (${_items.length})',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildScanEmpty(bool isDesktop) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.photo_camera, size: 56, color: NucleusColors.accentTeal),
          const SizedBox(height: 16),
          Text(
            isDesktop ? 'Select receipt files' : 'Scan your receipts',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold, color: NucleusColors.primaryNavy),
          ),
          const SizedBox(height: 8),
          Text(
            isDesktop
                ? 'Select one or more receipt image files.\nEach file becomes a line on this claim.'
                : 'Scan receipts one by one.\nEach receipt becomes a line on this claim.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey[600], fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildScanLineCard(int index) {
    final item = _items[index];
    final checks = _linePolicyChecks[index] ?? [];
    final loading = _linePolicyLoading[index] ?? false;
    final catInfo = categories.firstWhere((c) => c['key'] == item.category,
        orElse: () => categories.last);

    // Policy indicator
    Widget policyIndicator;
    if (loading) {
      policyIndicator = const SizedBox(
          width: 14,
          height: 14,
          child: CircularProgressIndicator(strokeWidth: 2));
    } else if (checks.isEmpty) {
      policyIndicator = Icon(Icons.circle, size: 10, color: Colors.grey[300]);
    } else {
      final hasFail = checks.any((c) => c['severity'] == 'fail');
      final hasWarn = checks.any((c) => c['severity'] == 'warn');
      policyIndicator = Icon(
        hasFail
            ? Icons.cancel
            : hasWarn
                ? Icons.warning
                : Icons.check_circle,
        size: 16,
        color: hasFail
            ? const Color(0xFFDC2626)
            : hasWarn
                ? const Color(0xFFF59E0B)
                : const Color(0xFF16A34A),
      );
    }

    return Dismissible(
      key: ValueKey('line_$index'),
      direction: DismissDirection.endToStart,
      background: Container(
        margin: const EdgeInsets.only(bottom: 6),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: const Color(0xFFDC2626),
          borderRadius: BorderRadius.circular(10),
        ),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      onDismissed: (_) => _removeItem(index),
      child: Card(
        margin: const EdgeInsets.only(bottom: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () => _startEditing(index),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                // Line number
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: NucleusColors.primaryNavy.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  alignment: Alignment.center,
                  child: Text('${index + 1}',
                      style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: NucleusColors.primaryNavy)),
                ),
                const SizedBox(width: 10),
                // Vendor/description
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.vendor.isNotEmpty ? item.vendor : item.description,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Icon(categoryIcon(item.category), size: 13, color: Colors.grey[500]),
                          const SizedBox(width: 4),
                          Text(
                            catInfo['label']!,
                            style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // Amount
                Text(
                  fmtGBP(item.amount),
                  style: NucleusTheme.monoAmount(
                      fontSize: 14, color: NucleusColors.primaryNavy),
                ),
                const SizedBox(width: 10),
                // Policy indicator
                policyIndicator,
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ===========================================================================
  // Desktop multi-file progress
  // ===========================================================================

  Widget _buildScanProgressStep() {
    return Center(
      key: const ValueKey('progress'),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const ScanningAnimation(),
          const SizedBox(height: 16),
          if (_scanTotal > 1)
            Text(
              'Processing receipt $_scanCurrent of $_scanTotal...',
              style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: NucleusColors.primaryNavy),
            )
          else
            const Text(
              'Reading receipt...',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: NucleusColors.primaryNavy),
            ),
          if (_scanTotal > 1) ...[
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 60),
              child: LinearProgressIndicator(
                value: _scanCurrent / _scanTotal,
                backgroundColor: Colors.grey[200],
                valueColor: const AlwaysStoppedAnimation(NucleusColors.accentTeal),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ===========================================================================
  // STEP 3 — Edit single line
  // ===========================================================================

  Widget _buildEditStep() {
    return SingleChildScrollView(
      key: const ValueKey('edit'),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_editingIndex != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                'Line ${_editingIndex! + 1} of ${_items.length}',
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Colors.grey[500]),
              ),
            ),

          // Category
          const Text('Category',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: categories.map((cat) {
              final selected = _editCategory == cat['key'];
              return ChoiceChip(
                avatar: Icon(categoryIcon(cat['key']!), size: 18),
                label: Text(cat['label']!),
                selected: selected,
                selectedColor:
                    NucleusColors.accentTeal.withValues(alpha: 0.15),
                onSelected: (_) =>
                    setState(() => _editCategory = cat['key']!),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),

          // Amount
          const Text('Amount (£)',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 6),
          TextField(
            controller: _editAmountCtrl,
            keyboardType:
                const TextInputType.numberWithOptions(decimal: true),
            style: NucleusTheme.monoAmount(fontSize: 20),
            decoration: InputDecoration(
              prefixText: '£ ',
              prefixStyle: NucleusTheme.monoAmount(
                  fontSize: 20, color: Colors.grey[600]),
              border:
                  OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: 16),

          // Description
          const Text('Description',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          const SizedBox(height: 6),
          TextField(
            controller: _editDescCtrl,
            decoration: InputDecoration(
              hintText: 'e.g. Train ticket London to Manchester',
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
            controller: _editDateCtrl,
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
                    DateTime.tryParse(_editDateCtrl.text) ?? DateTime.now(),
                firstDate: DateTime(2020),
                lastDate: DateTime.now(),
              );
              if (picked != null) {
                _editDateCtrl.text = DateFormat('yyyy-MM-dd').format(picked);
              }
            },
          ),

          // Per-line policy checks
          if (_editingIndex != null &&
              (_linePolicyChecks[_editingIndex!] ?? []).isNotEmpty) ...[
            const SizedBox(height: 20),
            const Text('Policy Checks',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 8),
            PolicyChecksList(checks: _linePolicyChecks[_editingIndex!]!),
          ],

          const SizedBox(height: 24),

          // Save
          FilledButton(
            onPressed: () {
              final amount = double.tryParse(_editAmountCtrl.text) ?? 0;
              if (amount <= 0 || _editDescCtrl.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                      content: Text('Amount and description are required')),
                );
                return;
              }
              _saveEdit();
            },
            style: FilledButton.styleFrom(
              backgroundColor: NucleusColors.accentTeal,
              minimumSize: const Size(double.infinity, 48),
            ),
            child: const Text('Save Line Item',
                style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }

  // ===========================================================================
  // STEP 3 — Review all lines
  // ===========================================================================

  Widget _buildReviewStep() {
    return SingleChildScrollView(
      key: const ValueKey('review'),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header info (editable)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: NucleusColors.primaryNavy.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey[200]!),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.folder_open,
                        size: 16, color: NucleusColors.accentTeal),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _tripNameCtrl.text.trim(),
                        style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                            color: NucleusColors.primaryNavy),
                      ),
                    ),
                    Text(
                      _headerRef,
                      style: NucleusTheme.mono.copyWith(
                          fontSize: 11, color: Colors.grey[400]),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '${_formatDate(_startDateCtrl.text)} — ${_formatDate(_endDateCtrl.text)}',
                  style: TextStyle(fontSize: 12, color: Colors.grey[500]),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Overall policy status
          _buildOverallPolicyStatus(),
          const SizedBox(height: 16),

          // Line items
          Text(
            '${_items.length} Line Items',
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          ),
          const SizedBox(height: 8),

          ...List.generate(_items.length, (i) => _buildReviewLineCard(i)),

          // Total
          Container(
            margin: const EdgeInsets.only(top: 4, bottom: 4),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: NucleusColors.primaryNavy.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(8),
              border: const Border(
                  left: BorderSide(color: NucleusColors.accentTeal, width: 3)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Total',
                        style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                            color: NucleusColors.primaryNavy)),
                    if (_excludedCount > 0)
                      Text(
                        '$_includedCount of ${_items.length} lines included',
                        style:
                            TextStyle(fontSize: 11, color: Colors.grey[500]),
                      ),
                  ],
                ),
                Text(
                  fmtGBP(_totalIncluded),
                  style: NucleusTheme.monoAmount(
                      fontSize: 20, color: NucleusColors.primaryNavy),
                ),
              ],
            ),
          ),

          if (_excludedCount > 0) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: NucleusColors.warning.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info,
                      size: 16, color: Color(0xFFB45309)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '$_excludedCount line${_excludedCount == 1 ? '' : 's'} excluded — will remain as draft for later submission.',
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFFB45309)),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 20),

          // Approval route
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
                : Text(
                    'Submit $_includedCount Line${_includedCount == 1 ? '' : 's'} · ${fmtGBP(_totalIncluded)}',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildOverallPolicyStatus() {
    int passes = 0;
    int warns = 0;
    int fails = 0;
    for (final entry in _linePolicyChecks.entries) {
      // Only count included lines
      if (entry.key < _items.length && _items[entry.key].included) {
        for (final c in entry.value) {
          final s = c['severity'];
          if (s == 'pass') passes++;
          if (s == 'warn') warns++;
          if (s == 'fail') fails++;
        }
      }
    }
    if (passes == 0 && warns == 0 && fails == 0) return const SizedBox.shrink();

    final Color bg;
    final Color fg;
    final IconData icon;
    final String label;
    if (fails > 0) {
      bg = const Color(0xFFFEF2F2);
      fg = const Color(0xFFDC2626);
      icon = Icons.cancel;
      label = '$fails policy failure${fails == 1 ? '' : 's'} across lines';
    } else if (warns > 0) {
      bg = const Color(0xFFFFFBEB);
      fg = const Color(0xFFB45309);
      icon = Icons.warning;
      label = '$warns policy warning${warns == 1 ? '' : 's'} across lines';
    } else {
      bg = const Color(0xFFF0FDF4);
      fg = const Color(0xFF15803D);
      icon = Icons.check_circle;
      label = 'All policy checks passed';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: TextStyle(fontSize: 13, color: fg)),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewLineCard(int index) {
    final item = _items[index];
    final catInfo = categories.firstWhere((c) => c['key'] == item.category,
        orElse: () => categories.last);
    final checks = _linePolicyChecks[index] ?? [];
    final hasFail =
        checks.any((c) => c['severity'] == 'fail');
    final hasWarn =
        checks.any((c) => c['severity'] == 'warn');

    return Opacity(
      opacity: item.included ? 1.0 : 0.5,
      child: Card(
        margin: const EdgeInsets.only(bottom: 6),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(
            color: !item.included
                ? Colors.grey[300]!
                : hasFail
                    ? const Color(0xFFDC2626)
                    : hasWarn
                        ? const Color(0xFFF59E0B)
                        : Colors.grey[200]!,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Column(
            children: [
              Row(
                children: [
                  // Include/exclude toggle
                  SizedBox(
                    width: 28,
                    height: 28,
                    child: Checkbox(
                      value: item.included,
                      onChanged: (_) => _toggleInclude(index),
                      activeColor: NucleusColors.accentTeal,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(categoryIcon(item.category), size: 18, color: NucleusColors.primaryNavy),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.description.isNotEmpty
                              ? item.description
                              : catInfo['label']!,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            decoration: item.included
                                ? null
                                : TextDecoration.lineThrough,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          '${_formatDate(item.date)} · ${catInfo['label']}',
                          style:
                              TextStyle(fontSize: 11, color: Colors.grey[500]),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    fmtGBP(item.amount),
                    style: NucleusTheme.monoAmount(
                        fontSize: 14, color: NucleusColors.primaryNavy),
                  ),
                  const SizedBox(width: 6),
                  // Policy indicator
                  if (hasFail)
                    const Icon(Icons.cancel,
                        size: 16, color: Color(0xFFDC2626))
                  else if (hasWarn)
                    const Icon(Icons.warning,
                        size: 16, color: Color(0xFFF59E0B))
                  else if (checks.isNotEmpty)
                    const Icon(Icons.check_circle,
                        size: 16, color: Color(0xFF16A34A)),
                  // Edit button
                  SizedBox(
                    width: 28,
                    child: IconButton(
                      icon: const Icon(Icons.edit, size: 14),
                      padding: EdgeInsets.zero,
                      visualDensity: VisualDensity.compact,
                      onPressed: () =>
                          _startEditing(index, returnTo: _BatchScreen.review),
                      color: Colors.grey[400],
                    ),
                  ),
                ],
              ),
              // Show policy issues for this line
              if (item.included &&
                  checks
                      .where((c) => c['severity'] != 'pass')
                      .isNotEmpty) ...[
                const SizedBox(height: 6),
                ...checks
                    .where((c) => c['severity'] != 'pass')
                    .take(2)
                    .map((c) => Padding(
                          padding: const EdgeInsets.only(left: 36, bottom: 2),
                          child: Row(
                            children: [
                              Icon(
                                c['severity'] == 'fail'
                                    ? Icons.cancel
                                    : Icons.warning,
                                size: 12,
                                color: c['severity'] == 'fail'
                                    ? const Color(0xFFDC2626)
                                    : const Color(0xFFF59E0B),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  c['message'] ?? c['rule_name'] ?? '',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: c['severity'] == 'fail'
                                        ? const Color(0xFFDC2626)
                                        : const Color(0xFFB45309),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        )),
              ],
            ],
          ),
        ),
      ),
    );
  }

  // ===========================================================================
  // STEP 4 — Confirmation
  // ===========================================================================

  Widget _buildConfirmation() {
    final claim = _confirmed?['claim'] ?? _confirmed ?? {};
    final workflow = _confirmed?['workflow'] ?? claim['workflow'];
    final steps = (workflow?['steps'] as List<dynamic>?) ?? [];
    final firstApprover = steps.isNotEmpty
        ? steps.first['approver_name'] ?? 'the approver'
        : 'the approver';

    return Padding(
      key: const ValueKey('confirmed'),
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
                  _confirmRow('Reference', _headerRef),
                  _confirmRow('Trip', _tripNameCtrl.text.trim()),
                  _confirmRow('Lines', '$_includedCount submitted'),
                  _confirmRow('Total', fmtGBP(_totalIncluded)),
                  if (_excludedCount > 0)
                    _confirmRow(
                        'Draft Lines', '$_excludedCount for later'),
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
            onPressed: widget.onSuccess,
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

  Widget _confirmRow(String label, String value) => Padding(
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

  String _formatDate(String dateStr) {
    try {
      return DateFormat('d MMM yyyy').format(DateTime.parse(dateStr));
    } catch (_) {
      return dateStr;
    }
  }
}

// ---------------------------------------------------------------------------
// Line item data class
// ---------------------------------------------------------------------------

class _LineItem {
  final double amount;
  final String category;
  final String description;
  final String date;
  final double receiptAmount;
  final bool hasReceipt;
  final String vendor;
  final bool included;

  const _LineItem({
    required this.amount,
    required this.category,
    required this.description,
    required this.date,
    required this.receiptAmount,
    required this.hasReceipt,
    required this.vendor,
    required this.included,
  });
}
