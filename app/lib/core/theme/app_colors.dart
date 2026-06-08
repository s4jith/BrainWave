import 'package:flutter/material.dart';

/// Color tokens mirrored from the web design system
/// (`frontend/src/index.css` — `:root` for light, `.dark` for dark).
///
/// The web app uses a monochrome, shadcn-style palette: the primary brand
/// colour is near-black in light mode and near-white in dark mode. A small set
/// of semantic status colours (success / warning / info / destructive) is used
/// contextually for badges, grades and alerts.
class AppColors {
  const AppColors._();

  // ── Light mode ──────────────────────────────────────────────────────────
  static const lightBackground = Color(0xFFFFFFFF); // 0 0% 100%
  static const lightForeground = Color(0xFF0D0D0D); // 0 0% 5%
  static const lightCard = Color(0xFFFFFFFF);
  static const lightCardForeground = Color(0xFF0D0D0D);
  static const lightPopover = Color(0xFFFFFFFF);
  static const lightPrimary = Color(0xFF1A1A1A); // 0 0% 10%
  static const lightPrimaryForeground = Color(0xFFFFFFFF);
  static const lightSecondary = Color(0xFFF5F5F5); // 0 0% 96%
  static const lightSecondaryForeground = Color(0xFF1A1A1A);
  static const lightMuted = Color(0xFFF5F5F5);
  static const lightMutedForeground = Color(0xFF737373); // 0 0% 45%
  static const lightAccent = Color(0xFFF5F5F5);
  static const lightBorder = Color(0xFFE5E5E5); // 0 0% 90%
  static const lightInput = Color(0xFFE5E5E5);
  static const lightRing = Color(0xFF1A1A1A);

  // ── Dark mode ───────────────────────────────────────────────────────────
  static const darkBackground = Color(0xFF000000); // 0 0% 0%
  static const darkForeground = Color(0xFFFAFAFA); // 0 0% 98%
  static const darkCard = Color(0xFF171717); // 0 0% 9%
  static const darkCardForeground = Color(0xFFFAFAFA);
  static const darkPopover = Color(0xFF121212); // 0 0% 7%
  static const darkPrimary = Color(0xFFFAFAFA); // 0 0% 98%
  static const darkPrimaryForeground = Color(0xFF0D0D0D);
  static const darkSecondary = Color(0xFF262626); // 0 0% 15%
  static const darkSecondaryForeground = Color(0xFFFAFAFA);
  static const darkMuted = Color(0xFF262626);
  static const darkMutedForeground = Color(0xFFA6A6A6); // 0 0% 65%
  static const darkAccent = Color(0xFF262626);
  static const darkBorder = Color(0xFF2E2E2E); // 0 0% 18%
  static const darkInput = Color(0xFF2E2E2E);
  static const darkRing = Color(0xFFFAFAFA);

  // ── Shared semantic (status) ────────────────────────────────────────────
  static const destructive = Color(0xFFEF4444); // red-500
  static const destructiveDark = Color(0xFF7F1D1D); // red-900
  static const success = Color(0xFF16A34A); // green-600
  static const warning = Color(0xFFD97706); // amber-600
  static const info = Color(0xFF2563EB); // blue-600
}
