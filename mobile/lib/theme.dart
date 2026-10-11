import 'package:flutter/material.dart';

/// "Braise" palette — mirrors app/globals.css in the web app so the mobile app looks like the same product.
class AppColors {
  AppColors._();

  static const background = Color(0xFF0A0A0A);
  static const surface = Color(0xFF212121); // cards, list rows
  static const tile = Color(0xFF262626); // tiles inside cards, inputs
  static const surfaceHover = Color(0xFF303030);
  static const border = Color(0x14FFFFFF); // rgba(255,255,255,0.08)
  static const foreground = Color(0xFFFFFFFF);
  static const muted = Color(0xFFA8A8A8);
  static const primary = Color(0xFFFFFFFF); // white pill buttons / active states
  static const primaryForeground = Color(0xFF0A0A0A);
  static const ember = Color(0xFFF2803A);
  static const emberDeep = Color(0xFFCF2B14);
  static const success = Color(0xFF5BD98A); // gains
  static const danger = Color(0xFFFF8A5B); // expenses, errors, destructive actions

  static const heroGradient = LinearGradient(
    begin: Alignment.topRight,
    end: Alignment.bottomLeft,
    colors: [Color(0xFFCF2B14), Color(0xFFA21A0E), Color(0xFF5C0F09)],
    stops: [0.0, 0.48, 1.0],
  );

  static const avatarGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFD9451F), Color(0xFF8C1A0C)],
  );

  static const glowAmber = Color(0xB8C46E18); // rgba(196,110,24,0.72)
  static const glowMaroon = Color(0xB3801E0C); // rgba(128,30,12,0.70)
}

final appTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  scaffoldBackgroundColor: AppColors.background,
  fontFamily: 'Inter',
  colorScheme: const ColorScheme.dark(
    surface: AppColors.surface,
    primary: AppColors.primary,
    onPrimary: AppColors.primaryForeground,
    error: AppColors.danger,
  ),
  cardColor: AppColors.surface,
  dividerColor: AppColors.border,
  textTheme: const TextTheme(
    headlineMedium: TextStyle(color: AppColors.foreground, fontWeight: FontWeight.w600, letterSpacing: -0.3),
    titleMedium: TextStyle(color: AppColors.foreground, fontWeight: FontWeight.w600),
    bodyMedium: TextStyle(color: AppColors.foreground),
    bodySmall: TextStyle(color: AppColors.muted),
  ),
  appBarTheme: const AppBarTheme(backgroundColor: Colors.transparent, elevation: 0, foregroundColor: AppColors.foreground),
  elevatedButtonTheme: ElevatedButtonThemeData(
    style: ElevatedButton.styleFrom(
      backgroundColor: AppColors.primary,
      foregroundColor: AppColors.primaryForeground,
      minimumSize: const Size.fromHeight(52),
      shape: const StadiumBorder(),
      textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: AppColors.tile,
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
    hintStyle: const TextStyle(color: AppColors.muted),
  ),
  snackBarTheme: const SnackBarThemeData(backgroundColor: Color(0xFF1C1C1C), contentTextStyle: TextStyle(color: Colors.white)),
);

/// Card shape used everywhere (`rounded-3xl` in the web app).
BoxDecoration cardDecoration({Color? color}) =>
    BoxDecoration(color: color ?? AppColors.surface, borderRadius: BorderRadius.circular(24));

BoxDecoration tileDecoration({Color? color}) =>
    BoxDecoration(color: color ?? AppColors.tile, borderRadius: BorderRadius.circular(20));
