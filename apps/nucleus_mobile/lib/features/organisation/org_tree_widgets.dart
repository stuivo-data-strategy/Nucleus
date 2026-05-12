import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../shared/widgets/nucleus_avatar.dart';

// ---------------------------------------------------------------------------
// Vertical connector line
// ---------------------------------------------------------------------------

class VLine extends StatelessWidget {
  final double height;

  const VLine({super.key, this.height = 32});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: height,
      color: Colors.grey[300],
    );
  }
}

// ---------------------------------------------------------------------------
// Horizontal connector line (spans across children)
// ---------------------------------------------------------------------------

class HLine extends StatelessWidget {
  final double width;

  const HLine({super.key, required this.width});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: 1,
      color: Colors.grey[300],
    );
  }
}

// ---------------------------------------------------------------------------
// Node card variants
// ---------------------------------------------------------------------------

enum NodeVariant { focus, manager, report, peer }

class NodeCard extends StatefulWidget {
  final Map<String, dynamic> person;
  final NodeVariant variant;
  final bool expanded;
  final int reportCount;
  final bool loading;
  final VoidCallback? onExpand;
  final VoidCallback? onNavigate;
  final VoidCallback? onDetail;

  const NodeCard({
    super.key,
    required this.person,
    required this.variant,
    this.expanded = false,
    this.reportCount = 0,
    this.loading = false,
    this.onExpand,
    this.onNavigate,
    this.onDetail,
  });

  @override
  State<NodeCard> createState() => _NodeCardState();
}

class _NodeCardState extends State<NodeCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  Map<String, dynamic> get person => widget.person;
  NodeVariant get variant => widget.variant;

  String get _initials {
    final f = person['first_name'] ?? '';
    final l = person['last_name'] ?? '';
    return '${f.isNotEmpty ? f[0] : ''}${l.isNotEmpty ? l[0] : ''}';
  }

  String get _fullName =>
      '${person['first_name'] ?? ''} ${person['last_name'] ?? ''}'.trim();

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _pulseAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  void _triggerPulse() {
    _pulseController.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final isFocus = variant == NodeVariant.focus;
    final isPeer = variant == NodeVariant.peer;
    final isManager = variant == NodeVariant.manager;
    final avatarSize = isFocus ? 52.0 : 40.0;

    return SizedBox(
      width: 120,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Avatar with edge pulse
          GestureDetector(
            onTap: widget.onNavigate,
            child: AnimatedBuilder(
              animation: _pulseAnimation,
              builder: (context, child) {
                final pulseValue = _pulseAnimation.value;
                return Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isFocus
                          ? NucleusColors.accentTeal
                          : Colors.grey[300]!,
                      width: isFocus ? 3 : 2,
                    ),
                    boxShadow: [
                      if (isFocus)
                        BoxShadow(
                          color: NucleusColors.accentTeal
                              .withValues(alpha: 0.25),
                          blurRadius: 8,
                          spreadRadius: 1,
                        ),
                      // Pulse ring
                      if (pulseValue > 0)
                        BoxShadow(
                          color: NucleusColors.accentTeal
                              .withValues(alpha: 0.5 * (1 - pulseValue)),
                          blurRadius: 4 + 16 * pulseValue,
                          spreadRadius: 8 * pulseValue,
                        ),
                    ],
                  ),
                  child: child,
                );
              },
              child: Opacity(
                opacity: isPeer ? 0.5 : 1.0,
                child: NucleusAvatar(
                  initials: _initials,
                  size: avatarSize,
                  fontSize: isFocus ? 18 : 14,
                  backgroundColor: NucleusColors.primaryNavy,
                ),
              ),
            ),
          ),

          const SizedBox(height: 6),

          // Name (tappable for detail — triggers pulse)
          GestureDetector(
            onTap: () {
              _triggerPulse();
              widget.onDetail?.call();
            },
            child: Opacity(
              opacity: isPeer ? 0.5 : 1.0,
              child: Column(
                children: [
                  Text(
                    _fullName,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: isFocus
                          ? NucleusColors.accentTeal
                          : NucleusColors.primaryNavy,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    person['job_title'] ?? '',
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10,
                      color: Colors.grey[500],
                    ),
                  ),
                  if (isManager)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        'tap avatar \u2191',
                        style: TextStyle(
                          fontSize: 9,
                          color: NucleusColors.accentTeal,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Expand button
          if (widget.reportCount > 0 && widget.onExpand != null) ...[
            const SizedBox(height: 6),
            GestureDetector(
              onTap: widget.onExpand,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: widget.expanded
                      ? NucleusColors.accentTeal
                      : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: widget.expanded
                        ? NucleusColors.accentTeal
                        : NucleusColors.accentTeal.withValues(alpha: 0.4),
                  ),
                ),
                child: widget.loading
                    ? SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(
                          strokeWidth: 1.5,
                          color: widget.expanded
                              ? Colors.white
                              : NucleusColors.accentTeal,
                        ),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '${widget.reportCount}',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: widget.expanded
                                  ? Colors.white
                                  : NucleusColors.accentTeal,
                            ),
                          ),
                          const SizedBox(width: 2),
                          Icon(
                            widget.expanded
                                ? Icons.expand_less
                                : Icons.expand_more,
                            size: 12,
                            color: widget.expanded
                                ? Colors.white
                                : NucleusColors.accentTeal,
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Expandable node (loads children on demand, recurses)
// ---------------------------------------------------------------------------

class ExpandableNode extends StatefulWidget {
  final Map<String, dynamic> person;
  final int depth;
  final void Function(String id) onSetFocus;
  final void Function(String personId) onOpenDetail;

  const ExpandableNode({
    super.key,
    required this.person,
    required this.depth,
    required this.onSetFocus,
    required this.onOpenDetail,
  });

  @override
  State<ExpandableNode> createState() => _ExpandableNodeState();
}

class _ExpandableNodeState extends State<ExpandableNode> {
  List<Map<String, dynamic>>? _children;
  bool _loading = false;
  bool _expanded = false;

  int get _reportCount => (widget.person['reportCount'] as int?) ?? 0;

  Future<void> _toggleExpand() async {
    if (!_expanded && _children == null) {
      setState(() => _loading = true);
      try {
        final api = context.read<ApiClient>();
        final resp = await api.get(
            '/people/${Uri.encodeComponent(widget.person['id'])}/reports');
        final list = resp['data'];
        _children = List<Map<String, dynamic>>.from(
            list is List ? list : []);
      } catch (_) {
        _children = [];
      }
      if (mounted) setState(() => _loading = false);
    }
    if (mounted) setState(() => _expanded = !_expanded);
  }

  @override
  Widget build(BuildContext context) {
    const nodeGap = 24.0;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        NodeCard(
          person: widget.person,
          variant: NodeVariant.report,
          reportCount: _reportCount,
          expanded: _expanded,
          loading: _loading,
          onExpand: _reportCount > 0 ? _toggleExpand : null,
          onNavigate: () => widget.onSetFocus(widget.person['id']),
          onDetail: () => widget.onOpenDetail(widget.person['id']),
        ),
        if (_expanded && _children != null && _children!.isNotEmpty) ...[
          const VLine(),
          if (_children!.length > 1)
            HLine(
              width: (_children!.length - 1) * (120 + nodeGap) + 120,
            ),
          Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: _children!.asMap().entries.map((entry) {
              final child = entry.value;
              return Padding(
                padding: EdgeInsets.only(
                  left: entry.key > 0 ? nodeGap : 0,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const VLine(height: 16),
                    if (widget.depth < 4)
                      ExpandableNode(
                        person: child,
                        depth: widget.depth + 1,
                        onSetFocus: widget.onSetFocus,
                        onOpenDetail: widget.onOpenDetail,
                      )
                    else
                      NodeCard(
                        person: child,
                        variant: NodeVariant.report,
                        reportCount:
                            (child['reportCount'] as int?) ?? 0,
                        onNavigate: () =>
                            widget.onSetFocus(child['id']),
                        onDetail: () =>
                            widget.onOpenDetail(child['id']),
                      ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// People chart — manager → focus → peers → reports
// ---------------------------------------------------------------------------

class PeopleChart extends StatefulWidget {
  final String viewerId;
  final String? initialFocusId;
  final void Function(String personId, String level) onOpenDetail;
  final void Function(String? orgUnit) onOrgUnitChange;

  const PeopleChart({
    super.key,
    required this.viewerId,
    this.initialFocusId,
    required this.onOpenDetail,
    required this.onOrgUnitChange,
  });

  @override
  State<PeopleChart> createState() => PeopleChartState();
}

class PeopleChartState extends State<PeopleChart> {
  late String _focusId;
  Map<String, dynamic>? _context;
  bool _loading = true;
  Set<String> _viewerReportIds = {};
  bool _viewerReportsFetched = false;

  @override
  void initState() {
    super.initState();
    _focusId = widget.initialFocusId ?? widget.viewerId;
    _fetchViewerReports();
    _loadContext(_focusId);
  }

  Future<void> _fetchViewerReports() async {
    if (_viewerReportsFetched) return;
    _viewerReportsFetched = true;
    try {
      final api = context.read<ApiClient>();
      final data = await api.get(
          '/people/${Uri.encodeComponent(widget.viewerId)}/context');
      final reports = data['data']?['directReports'] as List? ?? [];
      _viewerReportIds =
          reports.map<String>((r) => r['id'] as String).toSet();
    } catch (_) {}
  }

  String _getDetailLevel(String personId) {
    if (personId == widget.viewerId) return 'self';
    if (_viewerReportIds.contains(personId)) return 'report';
    return 'basic';
  }

  Future<void> _loadContext(String id) async {
    setState(() {
      _loading = true;
      _context = null;
    });
    try {
      final api = context.read<ApiClient>();
      final data = await api.get(
          '/people/${Uri.encodeComponent(id)}/context');
      if (mounted) {
        setState(() {
          _context = data['data'];
          _loading = false;
        });
        widget.onOrgUnitChange(_context?['self']?['org_unit']);
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _context = null;
          _loading = false;
        });
        widget.onOrgUnitChange(null);
      }
    }
  }

  void navigateTo(String id) {
    setState(() => _focusId = id);
    _loadContext(id);
  }

  @override
  Widget build(BuildContext context) {
    const nodeGap = 24.0;

    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_context == null) {
      return Center(
        child: Text(
          'Could not load chart data',
          style: TextStyle(color: Colors.grey[400]),
        ),
      );
    }

    final self = _context!['self'] as Map<String, dynamic>;
    final manager = _context!['manager'] as Map<String, dynamic>?;
    final peers = List<Map<String, dynamic>>.from(
        _context!['peers'] ?? []);
    final directReports = List<Map<String, dynamic>>.from(
        _context!['directReports'] ?? []);
    final isOwnView = self['id'] == widget.viewerId;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Manager above
            if (manager != null) ...[
              NodeCard(
                person: manager,
                variant: NodeVariant.manager,
                onNavigate: () => navigateTo(manager['id']),
                onDetail: () => widget.onOpenDetail(
                    manager['id'], _getDetailLevel(manager['id'])),
              ),
              const VLine(),
            ] else
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'Top of chain',
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.grey[400],
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),

            // Self + peers row
            if (peers.isNotEmpty)
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ...peers
                      .sublist(0, (peers.length / 2).ceil())
                      .map((p) => Padding(
                            padding: const EdgeInsets.only(
                                right: nodeGap, top: 8),
                            child: NodeCard(
                              person: p,
                              variant: NodeVariant.peer,
                              onNavigate: () => navigateTo(p['id']),
                              onDetail: () => widget.onOpenDetail(
                                  p['id'], _getDetailLevel(p['id'])),
                            ),
                          )),
                  NodeCard(
                    person: self,
                    variant: NodeVariant.focus,
                    reportCount:
                        (self['reportCount'] as int?) ?? 0,
                    onDetail: () => widget.onOpenDetail(
                        self['id'], _getDetailLevel(self['id'])),
                  ),
                  ...peers
                      .sublist((peers.length / 2).ceil())
                      .map((p) => Padding(
                            padding: const EdgeInsets.only(
                                left: nodeGap, top: 8),
                            child: NodeCard(
                              person: p,
                              variant: NodeVariant.peer,
                              onNavigate: () => navigateTo(p['id']),
                              onDetail: () => widget.onOpenDetail(
                                  p['id'], _getDetailLevel(p['id'])),
                            ),
                          )),
                ],
              )
            else
              NodeCard(
                person: self,
                variant: NodeVariant.focus,
                reportCount: (self['reportCount'] as int?) ?? 0,
                onDetail: () => widget.onOpenDetail(
                    self['id'], _getDetailLevel(self['id'])),
              ),

            // Direct reports below
            if (directReports.isNotEmpty) ...[
              const VLine(),
              if (directReports.length > 1)
                HLine(
                  width: (directReports.length - 1) * (120 + nodeGap) +
                      120,
                ),
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: directReports.asMap().entries.map((entry) {
                  final dr = entry.value;
                  return Padding(
                    padding: EdgeInsets.only(
                      left: entry.key > 0 ? nodeGap : 0,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const VLine(height: 16),
                        ExpandableNode(
                          person: dr,
                          depth: 1,
                          onSetFocus: navigateTo,
                          onOpenDetail: (id) => widget.onOpenDetail(
                              id, _getDetailLevel(id)),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ],

            // Return to self
            if (!isOwnView) ...[
              const SizedBox(height: 32),
              OutlinedButton.icon(
                onPressed: () => navigateTo(widget.viewerId),
                icon: const Icon(Icons.arrow_back, size: 14),
                label: const Text('Return to my position'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: NucleusColors.accentTeal,
                  side: BorderSide(
                    color:
                        NucleusColors.accentTeal.withValues(alpha: 0.3),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Structure chart — org unit tree
// ---------------------------------------------------------------------------

class StructureChart extends StatefulWidget {
  final String? initialRootId;

  const StructureChart({super.key, this.initialRootId});

  @override
  State<StructureChart> createState() => _StructureChartState();
}

class _StructureChartState extends State<StructureChart> {
  String? _rootId;
  List<String> _history = [];
  Map<String, dynamic>? _tree;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _rootId = widget.initialRootId;
    if (widget.initialRootId != null) _history = [''];
    _loadTree();
  }

  Future<void> _loadTree() async {
    setState(() => _loading = true);
    try {
      final api = context.read<ApiClient>();
      final params = <String, String>{};
      if (_rootId != null) params['rootId'] = _rootId!;
      final resp = await api.get('/org/tree', queryParams: params);
      final data = resp['data'];
      if (data == null && _rootId != null) {
        _rootId = null;
        _history = [];
        _loadTree();
        return;
      }
      if (mounted) {
        setState(() {
          _tree = data is Map<String, dynamic> ? data : null;
          _loading = false;
        });
      }
    } catch (_) {
      if (_rootId != null) {
        _rootId = null;
        _history = [];
        if (mounted) {
          _loadTree();
        }
      } else {
        if (mounted) {
          setState(() {
            _tree = null;
            _loading = false;
          });
        }
      }
    }
  }

  void _drillInto(String id) {
    _history.add(_rootId ?? '');
    _rootId = id;
    _loadTree();
  }

  void _drillUp() {
    final prev = _history.removeLast();
    _rootId = prev.isEmpty ? null : prev;
    _loadTree();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(48),
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_tree == null) {
      return Center(
        child: Text(
          'Failed to load structure',
          style: TextStyle(color: Colors.grey[400]),
        ),
      );
    }

    final children = List<Map<String, dynamic>>.from(
        _tree!['children'] ?? []);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Back button
            if (_history.isNotEmpty)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: _drillUp,
                  icon: const Icon(Icons.arrow_back, size: 14),
                  label: Text(
                    _history.length == 1
                        ? 'Up to Company'
                        : 'Up to previous',
                  ),
                  style: TextButton.styleFrom(
                    foregroundColor: NucleusColors.accentTeal,
                    textStyle: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),

            // Root node
            Container(
              constraints: const BoxConstraints(minWidth: 200),
              padding:
                  const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: const Border(
                  top: BorderSide(
                    color: NucleusColors.primaryNavy,
                    width: 4,
                  ),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Text(
                    (_tree!['type'] ?? '')
                        .toString()
                        .replaceAll('_', ' ')
                        .toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Colors.grey[400],
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _tree!['name'] ?? '',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: NucleusColors.primaryNavy,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _tree!['code'] ?? '',
                    style: NucleusTheme.mono.copyWith(
                      fontSize: 12,
                      color: Colors.grey[400],
                    ),
                  ),
                ],
              ),
            ),

            // Children
            if (children.isNotEmpty) ...[
              const VLine(),
              if (children.length > 1)
                HLine(
                  width:
                      (children.length - 1) * 184 + 160,
                ),
              Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: children.asMap().entries.map((entry) {
                  final child = entry.value;
                  return Padding(
                    padding: EdgeInsets.only(
                      left: entry.key > 0 ? 24 : 0,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const VLine(height: 16),
                        _OrgUnitCard(
                          unit: child,
                          onTap: () => _drillInto(child['id']),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _OrgUnitCard extends StatefulWidget {
  final Map<String, dynamic> unit;
  final VoidCallback onTap;

  const _OrgUnitCard({required this.unit, required this.onTap});

  @override
  State<_OrgUnitCard> createState() => _OrgUnitCardState();
}

class _OrgUnitCardState extends State<_OrgUnitCard> {
  bool _hovering = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovering = true),
      onExit: (_) => setState(() => _hovering = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minWidth: 152),
          padding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: _hovering
                  ? NucleusColors.accentTeal
                  : Colors.grey[200]!,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            children: [
              Text(
                (widget.unit['type'] ?? '')
                    .toString()
                    .replaceAll('_', ' ')
                    .toUpperCase(),
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: Colors.grey[400],
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.unit['name'] ?? '',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: _hovering
                      ? NucleusColors.accentTeal
                      : NucleusColors.primaryNavy,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                widget.unit['code'] ?? '',
                style: NucleusTheme.mono.copyWith(
                  fontSize: 10,
                  color: Colors.grey[400],
                ),
              ),
              if (widget.unit['headcount'] != null) ...[
                const SizedBox(height: 4),
                Text(
                  '${widget.unit['headcount']} people',
                  style: TextStyle(
                    fontSize: 9,
                    color: Colors.grey[400],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
