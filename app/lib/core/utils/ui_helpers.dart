import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Snackbar + dialog helpers exposed on [BuildContext] for consistent feedback.
extension UiHelpers on BuildContext {
  void showSnack(String message, {bool isError = false}) {
    final p = palette;
    ScaffoldMessenger.of(this)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(
                isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded,
                size: 18,
                color: isError ? p.destructive : p.success,
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(message)),
            ],
          ),
          duration: Duration(milliseconds: isError ? 3500 : 2500),
        ),
      );
  }

  /// Returns `true` when the user confirms the action.
  Future<bool> confirm({
    required String title,
    required String message,
    String confirmLabel = 'Confirm',
    String cancelLabel = 'Cancel',
    bool destructive = false,
  }) async {
    final result = await showDialog<bool>(
      context: this,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(cancelLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: destructive
                ? FilledButton.styleFrom(backgroundColor: ctx.palette.destructive)
                : null,
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}
