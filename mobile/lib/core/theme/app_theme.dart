import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Palette (Quick Tutor Ghana Colors)
  static const Color brandPrimary = Color(0xFF0D5C3A); // Rich Forest Emerald
  static const Color brandPrimaryDark = Color(0xFF073C25);
  static const Color brandPrimaryLight = Color(0xFFE8F5E9);
  
  static const Color brandGold = Color(0xFFE5A93C); // Ghana Gold
  static const Color brandGoldSoft = Color(0xFFFEF3C7);
  
  static const Color brandRed = Color(0xFFDC2626); // Ghana Red Accent
  static const Color brandInk = Color(0xFF131C18); // Deep Slate Ink
  static const Color brandMuted = Color(0xFF6B7280);
  
  // Backgrounds
  static const Color lightBg = Color(0xFFFBFBFA);
  static const Color lightCard = Color(0xFFFFFFFF);
  static const Color lightBorder = Color(0xFFE5E7EB);
  
  static const Color darkBg = Color(0xFF0E1512);
  static const Color darkCard = Color(0xFF16211C);
  static const Color darkBorder = Color(0xFF24332B);

  // Light Theme
  static ThemeData get lightTheme {
    final baseTextTheme = GoogleFonts.interTextTheme();
    
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: brandPrimary,
      scaffoldBackgroundColor: lightBg,
      colorScheme: const ColorScheme.light(
        primary: brandPrimary,
        secondary: brandGold,
        surface: lightCard,
        background: lightBg,
        error: brandRed,
        onPrimary: Colors.white,
        onSecondary: brandInk,
        onSurface: brandInk,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: lightBg,
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: brandInk),
        titleTextStyle: GoogleFonts.merriweather(
          color: brandInk,
          fontSize: 20,
          fontWeight: FontWeight.bold,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: brandPrimary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: brandInk,
          side: const BorderSide(color: lightBorder),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      cardTheme: CardTheme(
        color: lightCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: lightBorder),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: lightBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: lightBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: brandPrimary, width: 2),
        ),
        labelStyle: const TextStyle(color: brandMuted),
        hintStyle: const TextStyle(color: brandMuted, fontSize: 14),
      ),
      textTheme: baseTextTheme.copyWith(
        displayLarge: GoogleFonts.merriweather(fontSize: 32, fontWeight: FontWeight.bold, color: brandInk),
        headlineMedium: GoogleFonts.merriweather(fontSize: 24, fontWeight: FontWeight.bold, color: brandInk),
        titleLarge: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.w700, color: brandInk),
        bodyLarge: GoogleFonts.inter(fontSize: 15, color: brandInk),
        bodyMedium: GoogleFonts.inter(fontSize: 13, color: brandMuted),
      ),
    );
  }
}
