import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class NucleusAvatar extends StatelessWidget {
  final String initials;
  final Color backgroundColor;
  final double size;
  final double fontSize;

  const NucleusAvatar({
    super.key,
    required this.initials,
    this.backgroundColor = const Color(0xFF1B2A4A),
    this.size = 40,
    this.fontSize = 14,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: backgroundColor,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: GoogleFonts.dmSans(
          color: Colors.white,
          fontSize: fontSize,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
