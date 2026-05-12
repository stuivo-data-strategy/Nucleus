import 'package:flutter/material.dart';
import '../../core/theme.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final double fontSize;

  const StatusBadge({
    super.key,
    required this.status,
    this.fontSize = 11,
  });

  @override
  Widget build(BuildContext context) {
    final config = _statusConfig(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: config.color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        config.label,
        style: TextStyle(
          color: config.color,
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  static ({Color color, String label}) _statusConfig(String status) {
    return switch (status.toLowerCase()) {
      'approved' => (color: NucleusColors.approved, label: 'Approved'),
      'rejected' => (color: NucleusColors.rejected, label: 'Rejected'),
      'pending' || 'submitted' => (color: NucleusColors.pending, label: 'Pending'),
      'in_progress' || 'in_review' => (color: NucleusColors.accentTeal, label: 'In Progress'),
      'queried' => (color: NucleusColors.queried, label: 'Queried'),
      'posted' => (color: NucleusColors.posted, label: 'Posted'),
      _ => (color: Colors.grey, label: status),
    };
  }
}
