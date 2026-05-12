import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/api_client.dart';
import '../../core/auth_provider.dart';
import '../../core/theme.dart';
import '../../shared/widgets/nucleus_avatar.dart';
import 'org_tree_widgets.dart';
import 'person_detail_panel.dart';

class OrganisationScreen extends StatefulWidget {
  const OrganisationScreen({super.key});

  @override
  State<OrganisationScreen> createState() => _OrganisationScreenState();
}

class _OrganisationScreenState extends State<OrganisationScreen> {
  String _view = 'people'; // 'people' or 'structure'
  int _chartKey = 0;
  String? _peopleFocusId;
  String? _focusOrgUnit;

  // Detail panel state
  String? _detailPersonId;
  String _detailLevel = 'basic';

  // Zoom / pan
  final TransformationController _transformController =
      TransformationController();

  // Search
  final TextEditingController _searchController = TextEditingController();
  Timer? _searchDebounce;
  List<Map<String, dynamic>> _searchResults = [];
  bool _searchLoading = false;
  final FocusNode _searchFocus = FocusNode();
  final LayerLink _searchLayerLink = LayerLink();
  OverlayEntry? _searchOverlay;

  @override
  void dispose() {
    _transformController.dispose();
    _searchController.dispose();
    _searchDebounce?.cancel();
    _searchFocus.dispose();
    _searchOverlay?.remove();
    super.dispose();
  }

  String get _viewerId {
    final user = context.read<AuthProvider>().currentUser;
    return user?.id ?? 'person:sarah_chen';
  }

  void _openDetail(String personId, String level) {
    final width = MediaQuery.of(context).size.width;
    if (width > kMobileBreakpoint) {
      setState(() {
        _detailPersonId = personId;
        _detailLevel = level;
      });
    } else {
      PersonDetailPanel.showAsBottomSheet(
        context,
        personId: personId,
        level: level,
        viewerId: _viewerId,
      );
    }
  }

  void _closeDetail() {
    setState(() => _detailPersonId = null);
  }

  void _handleSearchNavigate(String id) {
    setState(() {
      _view = 'people';
      _peopleFocusId = id;
      _chartKey++;
    });
    _closeDetail();
    _searchController.clear();
    _hideSearchOverlay();
  }

  void _toggleView(String newView) {
    setState(() {
      _view = newView;
      _chartKey++;
    });
    _closeDetail();
  }

  void _resetView() {
    _transformController.value = Matrix4.identity();
    setState(() {
      _peopleFocusId = null;
      _chartKey++;
    });
    _closeDetail();
  }

  // Search
  void _onSearchChanged(String query) {
    _searchDebounce?.cancel();
    if (query.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _searchLoading = false;
      });
      _hideSearchOverlay();
      return;
    }
    setState(() => _searchLoading = true);
    _showSearchOverlay();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final api = context.read<ApiClient>();
        final resp = await api.get('/people',
            queryParams: {'q': query.trim()});
        final data = resp['data'];
        if (mounted) {
          setState(() {
            _searchResults = List<Map<String, dynamic>>.from(
                data is List ? data : []);
            _searchLoading = false;
          });
          _showSearchOverlay();
        }
      } catch (_) {
        if (mounted) {
          setState(() {
            _searchResults = [];
            _searchLoading = false;
          });
        }
      }
    });
  }

  void _showSearchOverlay() {
    _hideSearchOverlay();
    _searchOverlay = OverlayEntry(
      builder: (context) => _SearchOverlay(
        link: _searchLayerLink,
        results: _searchResults,
        loading: _searchLoading,
        onSelect: _handleSearchNavigate,
        onDismiss: _hideSearchOverlay,
      ),
    );
    Overlay.of(context).insert(_searchOverlay!);
  }

  void _hideSearchOverlay() {
    _searchOverlay?.remove();
    _searchOverlay = null;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth > kMobileBreakpoint;

        return Scaffold(
          backgroundColor: Colors.transparent,
          body: Column(
            children: [
              // Header bar
              _buildHeader(isDesktop),

              // Chart + detail panel
              Expanded(
                child: Stack(
                  children: [
                    // Chart area with zoom/pan
                    InteractiveViewer(
                      transformationController: _transformController,
                      minScale: 0.25,
                      maxScale: 2.5,
                      constrained: false,
                      boundaryMargin:
                          const EdgeInsets.all(double.infinity),
                      child: _view == 'people'
                          ? PeopleChart(
                              key: ValueKey(
                                  '$_chartKey-$_peopleFocusId'),
                              viewerId: _viewerId,
                              initialFocusId:
                                  _peopleFocusId ?? _viewerId,
                              onOpenDetail: _openDetail,
                              onOrgUnitChange: (orgUnit) {
                                _focusOrgUnit = orgUnit;
                              },
                            )
                          : StructureChart(
                              key: ValueKey(
                                  '$_chartKey-$_focusOrgUnit'),
                              initialRootId: _focusOrgUnit,
                            ),
                    ),

                    // Zoom controls (desktop)
                    if (isDesktop)
                      Positioned(
                        top: 12,
                        right: _detailPersonId != null ? 392 : 12,
                        child: _ZoomControls(
                          onZoomIn: () => _zoom(1.25),
                          onZoomOut: () => _zoom(0.8),
                          onReset: _resetView,
                        ),
                      ),

                    // Hint text
                    Positioned(
                      bottom: 8,
                      left: 12,
                      child: Text(
                        _view == 'people'
                            ? 'Pinch to zoom \u00B7 Drag to pan'
                            : 'Click a unit to drill in',
                        style: TextStyle(
                          fontSize: 10,
                          color: Colors.grey[300],
                        ),
                      ),
                    ),

                    // Detail panel (desktop slide-in)
                    if (isDesktop && _detailPersonId != null)
                      Positioned(
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: 380,
                        child: AnimatedSlide(
                          offset: Offset.zero,
                          duration: const Duration(milliseconds: 250),
                          curve: Curves.easeOut,
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              border: Border(
                                left: BorderSide(
                                    color: Colors.grey[200]!),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black
                                      .withValues(alpha: 0.1),
                                  blurRadius: 20,
                                  offset: const Offset(-4, 0),
                                ),
                              ],
                            ),
                            child: PersonDetailPanel(
                              key: ValueKey(_detailPersonId),
                              personId: _detailPersonId!,
                              level: _detailLevel,
                              viewerId: _viewerId,
                              onClose: _closeDetail,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _zoom(double factor) {
    final currentScale = _transformController.value.getMaxScaleOnAxis();
    final newScale =
        (currentScale * factor).clamp(0.25, 2.5);
    final scaleFactor = newScale / currentScale;

    // Get the center of the viewport
    final size = MediaQuery.of(context).size;
    final focalPoint = Offset(size.width / 2, size.height / 2);

    final matrix = _transformController.value.clone();
    // Translate so focal point stays fixed
    // ignore: deprecated_member_use
    matrix.translate(focalPoint.dx, focalPoint.dy);
    // ignore: deprecated_member_use
    matrix.scale(scaleFactor);
    // ignore: deprecated_member_use
    matrix.translate(-focalPoint.dx, -focalPoint.dy);

    _transformController.value = matrix;
  }

  Widget _buildHeader(bool isDesktop) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          isDesktop ? 24 : 16, 16, isDesktop ? 24 : 16, 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Colors.grey[200]!),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Organisation & People',
                      style: TextStyle(
                        fontSize: isDesktop ? 24 : 20,
                        fontWeight: FontWeight.w700,
                        color: NucleusColors.primaryNavy,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _view == 'people'
                          ? 'Click avatar to navigate \u00B7 Click name to view profile'
                          : 'Click a unit to drill in \u00B7 Use \u2190 to go back up',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[400],
                      ),
                    ),
                  ],
                ),
              ),
              // View toggle
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey[200]!),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _ViewToggleButton(
                      label: 'People',
                      isActive: _view == 'people',
                      onTap: () => _toggleView('people'),
                      isLeft: true,
                    ),
                    _ViewToggleButton(
                      label: 'Structure',
                      isActive: _view == 'structure',
                      onTap: () => _toggleView('structure'),
                      isLeft: false,
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Search bar (people view only)
          if (_view == 'people') ...[
            const SizedBox(height: 10),
            CompositedTransformTarget(
              link: _searchLayerLink,
              child: SizedBox(
                width: isDesktop ? 280 : double.infinity,
                height: 36,
                child: TextField(
                  controller: _searchController,
                  focusNode: _searchFocus,
                  onChanged: _onSearchChanged,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Search name or role\u2026',
                    hintStyle: TextStyle(
                        fontSize: 13, color: Colors.grey[400]),
                    prefixIcon: Icon(Icons.search,
                        size: 18, color: Colors.grey[400]),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          BorderSide(color: Colors.grey[200]!),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          BorderSide(color: Colors.grey[200]!),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                          color: NucleusColors.accentTeal),
                    ),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 12),
                    isDense: true,
                    filled: true,
                    fillColor: Colors.white,
                  ),
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
// View toggle button
// ---------------------------------------------------------------------------

class _ViewToggleButton extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;
  final bool isLeft;

  const _ViewToggleButton({
    required this.label,
    required this.isActive,
    required this.onTap,
    required this.isLeft,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? NucleusColors.primaryNavy : Colors.white,
          borderRadius: BorderRadius.horizontal(
            left: isLeft ? const Radius.circular(11) : Radius.zero,
            right: !isLeft ? const Radius.circular(11) : Radius.zero,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: isActive ? Colors.white : Colors.grey[500],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Zoom controls
// ---------------------------------------------------------------------------

class _ZoomControls extends StatelessWidget {
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final VoidCallback onReset;

  const _ZoomControls({
    required this.onZoomIn,
    required this.onZoomOut,
    required this.onReset,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _ZoomButton(icon: Icons.add, onTap: onZoomIn),
        const SizedBox(height: 4),
        _ZoomButton(icon: Icons.remove, onTap: onZoomOut),
        const SizedBox(height: 4),
        _ZoomButton(icon: Icons.home_outlined, onTap: onReset),
      ],
    );
  }
}

class _ZoomButton extends StatefulWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _ZoomButton({required this.icon, required this.onTap});

  @override
  State<_ZoomButton> createState() => _ZoomButtonState();
}

class _ZoomButtonState extends State<_ZoomButton> {
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
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: _hovering
                  ? NucleusColors.accentTeal
                  : Colors.grey[200]!,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Icon(
            widget.icon,
            size: 16,
            color: _hovering
                ? NucleusColors.accentTeal
                : Colors.grey[600],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Search overlay
// ---------------------------------------------------------------------------

class _SearchOverlay extends StatelessWidget {
  final LayerLink link;
  final List<Map<String, dynamic>> results;
  final bool loading;
  final void Function(String id) onSelect;
  final VoidCallback onDismiss;

  const _SearchOverlay({
    required this.link,
    required this.results,
    required this.loading,
    required this.onSelect,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Dismiss backdrop
        Positioned.fill(
          child: GestureDetector(
            onTap: onDismiss,
            behavior: HitTestBehavior.translucent,
            child: const SizedBox.expand(),
          ),
        ),
        // Results dropdown
        CompositedTransformFollower(
          link: link,
          offset: const Offset(0, 40),
          child: Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: 280,
              constraints: const BoxConstraints(maxHeight: 280),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey[200]!),
              ),
              child: loading
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: Center(
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                              strokeWidth: 2),
                        ),
                      ),
                    )
                  : results.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(16),
                          child: Center(
                            child: Text(
                              'No results',
                              style: TextStyle(
                                fontSize: 13,
                                color: Colors.grey[400],
                              ),
                            ),
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          shrinkWrap: true,
                          itemCount: results.length,
                          separatorBuilder: (_, _) =>
                              Divider(height: 1, color: Colors.grey[100]),
                          itemBuilder: (context, index) {
                            final p = results[index];
                            final name =
                                '${p['first_name']} ${p['last_name']}';
                            final initials =
                                '${(p['first_name'] ?? '').isNotEmpty ? p['first_name'][0] : ''}${(p['last_name'] ?? '').isNotEmpty ? p['last_name'][0] : ''}';
                            return InkWell(
                              onTap: () => onSelect(p['id']),
                              borderRadius:
                                  BorderRadius.circular(8),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 10),
                                child: Row(
                                  children: [
                                    NucleusAvatar(
                                      initials: initials,
                                      size: 28,
                                      fontSize: 10,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment
                                                .start,
                                        children: [
                                          Text(
                                            name,
                                            style:
                                                const TextStyle(
                                              fontSize: 12,
                                              fontWeight:
                                                  FontWeight.w600,
                                              color: NucleusColors
                                                  .primaryNavy,
                                            ),
                                          ),
                                          Text(
                                            p['job_title'] ?? '',
                                            style: TextStyle(
                                              fontSize: 10,
                                              color:
                                                  Colors.grey[400],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ),
          ),
        ),
      ],
    );
  }
}
