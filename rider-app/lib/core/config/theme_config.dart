/**
 * Theme Configuration
 * Design system colors and styles
 */

import 'package:flutter/material.dart';

class ThemeConfig {
  // Volzo Brand Colors (Eco Electric Blue)
  static const Color primaryColor = Color(0xFF0066FF); // Volzo Electric Blue
  static const Color primaryDark = Color(0xFF0052C4);
  static const Color primaryLight = Color(0xFF3385FF);

  // Secondary Colors
  static const Color secondaryColor = Color(0xFF00D9FF); // Cyber Light Blue
  static const Color accentColor = Color(0xFF00D9FF); // Cyber Cyan Accents

  // Background Colors (Premium Light Mode)
  static const Color backgroundColor = Color(0xFFF9FAFB); // Ultra-clean background
  static const Color surfaceColor = Color(0xFFFFFFFF); // Pure white cards/panels
  static const Color cardColor = Color(0xFFFFFFFF);
  static const Color dividerColor = Color(0xFFF3F4F6); // Soft gray divider

  // Text Colors (Dynamic & Charcoal)
  static const Color textPrimaryColor = Color(0xFF111827); // Deep Charcoal for high readability
  static const Color textSecondaryColor = Color(0xFF4B5563); // Muted slate gray
  static const Color textTertiaryColor = Color(0xFF9CA3AF); // Light gray

  // Status Colors
  static const Color successColor = Color(0xFF0066FF); // Volzo Blue
  static const Color warningColor = Color(0xFFFFA502);
  static const Color errorColor = Color(0xFFEF4444);
  static const Color infoColor = Color(0xFF0066FF); // Volzo Blue

  // Ride Type Colors
  static const Color scooterColor = Color(0xFF0066FF); // Volzo Blue
  static const Color rickshawSharedColor = Color(0xFF00D9FF); // Light Blue
  static const Color rickshawPrivateColor = Color(0xFF0052C4); // Dark Blue

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [primaryColor, primaryLight],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient successGradient = LinearGradient(
    colors: [Color(0xFF0066FF), Color(0xFF3385FF)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // Shadows
  static List<BoxShadow> cardShadow = [
    BoxShadow(
      color: Colors.black.withOpacity(0.05),
      blurRadius: 10,
      offset: const Offset(0, 4),
    ),
  ];

  static List<BoxShadow> buttonShadow = [
    BoxShadow(
      color: primaryColor.withOpacity(0.3),
      blurRadius: 12,
      offset: const Offset(0, 6),
    ),
  ];

  // Border Radius
  static const double radiusSmall = 8.0;
  static const double radiusMedium = 12.0;
  static const double radiusLarge = 16.0;
  static const double radiusXLarge = 24.0;

  // Spacing
  static const double spacingXSmall = 4.0;
  static const double spacingSmall = 8.0;
  static const double spacingMedium = 16.0;
  static const double spacingLarge = 24.0;
  static const double spacingXLarge = 32.0;

  // Icon Sizes
  static const double iconSmall = 16.0;
  static const double iconMedium = 24.0;
  static const double iconLarge = 32.0;
  static const double iconXLarge = 48.0;

  // Font Sizes
  static const double fontSizeSmall = 12.0;
  static const double fontSizeMedium = 14.0;
  static const double fontSizeRegular = 16.0;
  static const double fontSizeLarge = 18.0;
  static const double fontSizeXLarge = 24.0;
  static const double fontSizeXXLarge = 32.0;

  // Font Weights
  static const FontWeight fontWeightRegular = FontWeight.w400;
  static const FontWeight fontWeightMedium = FontWeight.w500;
  static const FontWeight fontWeightSemiBold = FontWeight.w600;
  static const FontWeight fontWeightBold = FontWeight.w700;

  // Animation Durations
  static const Duration animationFast = Duration(milliseconds: 200);
  static const Duration animationNormal = Duration(milliseconds: 300);
  static const Duration animationSlow = Duration(milliseconds: 500);
}
