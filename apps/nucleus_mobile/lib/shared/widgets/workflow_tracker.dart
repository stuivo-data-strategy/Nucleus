import 'package:flutter/material.dart';
import '../../core/theme.dart';

/// Horizontal workflow step tracker showing approval progress.
class WorkflowTracker extends StatelessWidget {
  final List<Map<String, dynamic>> steps;
  final List<Map<String, dynamic>> skippedSteps;

  const WorkflowTracker({
    super.key,
    required this.steps,
    this.skippedSteps = const [],
  });

  @override
  Widget build(BuildContext context) {
    if (steps.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 48,
      child: Row(
        children: [
          for (int i = 0; i < steps.length; i++) ...[
            _StepCircle(step: steps[i], index: i),
            if (i < steps.length - 1)
              Expanded(
                child: Container(
                  height: 2,
                  color: _lineColor(steps[i]['status'] ?? ''),
                ),
              ),
          ],
        ],
      ),
    );
  }

  static Color _lineColor(String status) {
    return switch (status) {
      'approved' => const Color(0xFF86EFAC),
      'rejected' => const Color(0xFFFCA5A5),
      'queried' => const Color(0xFFD8B4FE),
      'pending' => NucleusColors.accentTeal.withValues(alpha: 0.3),
      _ => Colors.grey[200]!,
    };
  }
}

class _StepCircle extends StatelessWidget {
  final Map<String, dynamic> step;
  final int index;

  const _StepCircle({required this.step, required this.index});

  @override
  Widget build(BuildContext context) {
    final status = step['status'] ?? '';
    final name = step['approver_name'] ?? '';
    final firstName = name.toString().split(' ').first;

    return Tooltip(
      message: '$name — $status',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: _bgColor(status),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: _icon(status, index),
          ),
          const SizedBox(height: 2),
          Text(
            firstName,
            style: TextStyle(fontSize: 10, color: Colors.grey[600]),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Color _bgColor(String status) {
    return switch (status) {
      'approved' => NucleusColors.approved,
      'rejected' => NucleusColors.rejected,
      'queried' => NucleusColors.queried,
      'pending' => NucleusColors.accentTeal,
      _ => Colors.grey[200]!,
    };
  }

  Widget _icon(String status, int idx) {
    final style = const TextStyle(
      color: Colors.white,
      fontSize: 13,
      fontWeight: FontWeight.bold,
    );
    return switch (status) {
      'approved' => Text('✓', style: style),
      'rejected' => Text('✗', style: style),
      'queried' => Text('?', style: style),
      'pending' => Text('${idx + 1}', style: style),
      _ => Text('${idx + 1}',
          style: style.copyWith(color: Colors.grey[500])),
    };
  }
}
