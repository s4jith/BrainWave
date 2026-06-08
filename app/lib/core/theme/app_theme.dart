import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// Semantic palette exposed as a [ThemeExtension] so widgets can read brand and
/// status colours ergonomically via `context.palette`, independent of light/dark.
@immutable
class AppPalette extends ThemeExtension<AppPalette> {
  final Color background;
  final Color foreground;
  final Color card;
  final Color cardForeground;
  final Color muted;
  final Color mutedForeground;
  final Color border;
  final Color primary;
  final Color primaryForeground;
  final Color secondary;
  final Color destructive;
  final Color success;
  final Color warning;
  final Color info;

  const AppPalette({
    required this.background,
    required this.foreground,
    required this.card,
    required this.cardForeground,
    required this.muted,
    required this.mutedForeground,
    required this.border,
    required this.primary,
    required this.primaryForeground,
    required this.secondary,
    required this.destructive,
    required this.success,
    required this.warning,
    required this.info,
  });

  static const light = AppPalette(
    background: AppColors.lightBackground,
    foreground: AppColors.lightForeground,
    card: AppColors.lightCard,
    cardForeground: AppColors.lightCardForeground,
    muted: AppColors.lightMuted,
    mutedForeground: AppColors.lightMutedForeground,
    border: AppColors.lightBorder,
    primary: AppColors.lightPrimary,
    primaryForeground: AppColors.lightPrimaryForeground,
    secondary: AppColors.lightSecondary,
    destructive: AppColors.destructive,
    success: AppColors.success,
    warning: AppColors.warning,
    info: AppColors.info,
  );

  static const dark = AppPalette(
    background: AppColors.darkBackground,
    foreground: AppColors.darkForeground,
    card: AppColors.darkCard,
    cardForeground: AppColors.darkCardForeground,
    muted: AppColors.darkMuted,
    mutedForeground: AppColors.darkMutedForeground,
    border: AppColors.darkBorder,
    primary: AppColors.darkPrimary,
    primaryForeground: AppColors.darkPrimaryForeground,
    secondary: AppColors.darkSecondary,
    destructive: AppColors.destructiveDark,
    success: AppColors.success,
    warning: AppColors.warning,
    info: AppColors.info,
  );

  @override
  AppPalette copyWith({
    Color? background,
    Color? foreground,
    Color? card,
    Color? cardForeground,
    Color? muted,
    Color? mutedForeground,
    Color? border,
    Color? primary,
    Color? primaryForeground,
    Color? secondary,
    Color? destructive,
    Color? success,
    Color? warning,
    Color? info,
  }) {
    return AppPalette(
      background: background ?? this.background,
      foreground: foreground ?? this.foreground,
      card: card ?? this.card,
      cardForeground: cardForeground ?? this.cardForeground,
      muted: muted ?? this.muted,
      mutedForeground: mutedForeground ?? this.mutedForeground,
      border: border ?? this.border,
      primary: primary ?? this.primary,
      primaryForeground: primaryForeground ?? this.primaryForeground,
      secondary: secondary ?? this.secondary,
      destructive: destructive ?? this.destructive,
      success: success ?? this.success,
      warning: warning ?? this.warning,
      info: info ?? this.info,
    );
  }

  @override
  AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return AppPalette(
      background: Color.lerp(background, other.background, t)!,
      foreground: Color.lerp(foreground, other.foreground, t)!,
      card: Color.lerp(card, other.card, t)!,
      cardForeground: Color.lerp(cardForeground, other.cardForeground, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      mutedForeground: Color.lerp(mutedForeground, other.mutedForeground, t)!,
      border: Color.lerp(border, other.border, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      primaryForeground: Color.lerp(primaryForeground, other.primaryForeground, t)!,
      secondary: Color.lerp(secondary, other.secondary, t)!,
      destructive: Color.lerp(destructive, other.destructive, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      info: Color.lerp(info, other.info, t)!,
    );
  }
}

/// Ergonomic accessors used throughout the UI layer.
extension AppThemeX on BuildContext {
  AppPalette get palette => Theme.of(this).extension<AppPalette>() ?? AppPalette.dark;
  TextTheme get texts => Theme.of(this).textTheme;
  ColorScheme get scheme => Theme.of(this).colorScheme;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}

/// App-wide radius scale (web uses 0.5rem ≈ 8px as the base).
class AppRadius {
  const AppRadius._();
  static const double sm = 6;
  static const double md = 8;
  static const double lg = 12;
  static const double xl = 16;
  static const double pill = 999;
}

class AppTheme {
  const AppTheme._();

  static ThemeData get light => _build(Brightness.light, AppPalette.light);
  static ThemeData get dark => _build(Brightness.dark, AppPalette.dark);

  static TextTheme _textTheme(Color fg, Color muted) {
    TextStyle sg(double size, FontWeight w, {double? ls, double? h}) =>
        GoogleFonts.spaceGrotesk(
            fontSize: size, fontWeight: w, color: fg, letterSpacing: ls, height: h);
    TextStyle pp(double size, FontWeight w, {Color? c, double? h}) =>
        GoogleFonts.poppins(fontSize: size, fontWeight: w, color: c ?? fg, height: h);
    return TextTheme(
      displayLarge: sg(36, FontWeight.w700, ls: -0.5),
      displayMedium: sg(30, FontWeight.w700, ls: -0.5),
      displaySmall: sg(26, FontWeight.w600, ls: -0.25),
      headlineLarge: sg(24, FontWeight.w700, ls: -0.25),
      headlineMedium: sg(22, FontWeight.w600),
      headlineSmall: sg(20, FontWeight.w600),
      titleLarge: pp(18, FontWeight.w600),
      titleMedium: pp(16, FontWeight.w600),
      titleSmall: pp(14, FontWeight.w600),
      bodyLarge: pp(16, FontWeight.w400, h: 1.45),
      bodyMedium: pp(14, FontWeight.w400, h: 1.45),
      bodySmall: pp(12, FontWeight.w400, c: muted, h: 1.4),
      labelLarge: pp(14, FontWeight.w600),
      labelMedium: pp(12, FontWeight.w500),
      labelSmall: pp(11, FontWeight.w500, c: muted),
    );
  }

  static ThemeData _build(Brightness brightness, AppPalette p) {
    final isDark = brightness == Brightness.dark;
    final scheme = ColorScheme(
      brightness: brightness,
      primary: p.primary,
      onPrimary: p.primaryForeground,
      secondary: p.secondary,
      onSecondary: p.foreground,
      surface: p.card,
      onSurface: p.cardForeground,
      surfaceContainerHighest: p.muted,
      onSurfaceVariant: p.mutedForeground,
      error: p.destructive,
      onError: Colors.white,
      outline: p.border,
      outlineVariant: p.border,
    );
    final textTheme = _textTheme(p.foreground, p.mutedForeground);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      scaffoldBackgroundColor: p.background,
      colorScheme: scheme,
      textTheme: textTheme,
      extensions: const <ThemeExtension>[],
      splashFactory: InkRipple.splashFactory,
      appBarTheme: AppBarTheme(
        backgroundColor: p.background,
        surfaceTintColor: Colors.transparent,
        foregroundColor: p.foreground,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.spaceGrotesk(
            fontSize: 20, fontWeight: FontWeight.w700, color: p.foreground),
        systemOverlayStyle:
            isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),
      cardTheme: CardThemeData(
        color: p.card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          side: BorderSide(color: p.border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? p.card : p.muted,
        hintStyle: GoogleFonts.poppins(color: p.mutedForeground, fontSize: 14),
        labelStyle: GoogleFonts.poppins(color: p.mutedForeground, fontSize: 14),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: p.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: p.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: p.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: p.destructive),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: p.destructive, width: 1.5),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p.primary,
          foregroundColor: p.primaryForeground,
          disabledBackgroundColor: p.muted,
          disabledForegroundColor: p.mutedForeground,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: p.primary,
          foregroundColor: p.primaryForeground,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: p.foreground,
          side: BorderSide(color: p.border),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          textStyle: GoogleFonts.poppins(fontSize: 15, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: p.foreground,
          textStyle: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: p.foreground),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: isDark ? p.card : p.muted,
        selectedColor: p.primary,
        secondarySelectedColor: p.primary,
        labelStyle: GoogleFonts.poppins(fontSize: 12, color: p.foreground),
        secondaryLabelStyle:
            GoogleFonts.poppins(fontSize: 12, color: p.primaryForeground),
        side: BorderSide(color: p.border),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.pill)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: p.background,
        surfaceTintColor: Colors.transparent,
        indicatorColor: isDark ? p.secondary : p.muted,
        height: 64,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.poppins(
            fontSize: 11,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? p.foreground : p.mutedForeground,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
              size: 24, color: selected ? p.foreground : p.mutedForeground);
        }),
      ),
      dividerTheme: DividerThemeData(color: p.border, thickness: 1, space: 1),
      iconTheme: IconThemeData(color: p.foreground),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: p.primary,
        linearTrackColor: p.muted,
        circularTrackColor: p.muted,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected) ? p.primaryForeground : p.mutedForeground),
        trackColor: WidgetStateProperty.resolveWith((s) =>
            s.contains(WidgetState.selected) ? p.primary : p.muted),
        trackOutlineColor: WidgetStateProperty.all(p.border),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: p.foreground,
        textColor: p.foreground,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md)),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: p.card,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.lg)),
        titleTextStyle: GoogleFonts.spaceGrotesk(
            fontSize: 18, fontWeight: FontWeight.w700, color: p.foreground),
        contentTextStyle: GoogleFonts.poppins(fontSize: 14, color: p.foreground),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.background,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: isDark ? p.card : p.primary,
        contentTextStyle: GoogleFonts.poppins(
            color: isDark ? p.foreground : p.primaryForeground, fontSize: 14),
        actionTextColor: isDark ? p.foreground : p.primaryForeground,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md)),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: p.foreground,
        unselectedLabelColor: p.mutedForeground,
        labelStyle: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.poppins(fontSize: 14),
        indicatorColor: p.foreground,
        dividerColor: p.border,
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
          color: p.foreground,
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        textStyle: GoogleFonts.poppins(color: p.background, fontSize: 12),
      ),
    ).copyWith(extensions: <ThemeExtension>[p]);
  }
}
