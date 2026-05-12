import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class NucleusColors {
  static const Color primaryNavy = Color(0xFF1B2A4A);
  static const Color accentTeal = Color(0xFF2E8B8B);
  static const Color background = Color(0xFFF5F5F5);
  static const Color surface = Colors.white;
  static const Color error = Color(0xFFDC2626);
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFF59E0B);
  static const Color pending = Color(0xFFF59E0B);
  static const Color approved = Color(0xFF16A34A);
  static const Color rejected = Color(0xFFDC2626);
  static const Color queried = Color(0xFF7C3AED);
  static const Color posted = Color(0xFF2563EB);
  static const Color sidebarHover = Color(0xFF243558);
  static const Color sidebarActive = Color(0x1A2E8B8B);
}

class NucleusTheme {
  static ThemeData get light {
    final textTheme = GoogleFonts.dmSansTextTheme();

    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: NucleusColors.accentTeal,
        primary: NucleusColors.primaryNavy,
        secondary: NucleusColors.accentTeal,
        surface: NucleusColors.surface,
        error: NucleusColors.error,
      ),
      scaffoldBackgroundColor: NucleusColors.background,
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: NucleusColors.primaryNavy,
        foregroundColor: Colors.white,
        elevation: 0,
        titleTextStyle: GoogleFonts.dmSans(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: NucleusColors.accentTeal,
        foregroundColor: Colors.white,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    );
  }

  /// JetBrains Mono text style for monetary values and IDs
  static TextStyle get mono => GoogleFonts.jetBrainsMono();

  static TextStyle monoAmount({
    double fontSize = 16,
    FontWeight fontWeight = FontWeight.w600,
    Color? color,
  }) {
    return GoogleFonts.jetBrainsMono(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
    );
  }
}

const double kMobileBreakpoint = 1000.0;
