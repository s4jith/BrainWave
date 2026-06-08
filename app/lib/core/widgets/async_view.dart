import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/api_exception.dart';
import 'app_states.dart';

/// Renders an [AsyncValue] with consistent loading / error / empty / data
/// handling so every screen gets the same UX for free.
///
/// - `loading`  → custom skeleton, otherwise a centered spinner.
/// - `error`    → [ErrorView] with a retry button wired to [onRetry].
/// - `data`     → [emptyWhen] check first (renders [empty] / default EmptyState),
///                otherwise [data].
class AsyncView<T> extends StatelessWidget {
  final AsyncValue<T> value;
  final Widget Function(T data) data;
  final Widget? loading;
  final VoidCallback? onRetry;
  final bool Function(T data)? emptyWhen;
  final Widget? empty;
  final String emptyTitle;
  final String? emptyMessage;
  final IconData emptyIcon;

  const AsyncView({
    super.key,
    required this.value,
    required this.data,
    this.loading,
    this.onRetry,
    this.emptyWhen,
    this.empty,
    this.emptyTitle = 'Nothing here yet',
    this.emptyMessage,
    this.emptyIcon = Icons.inbox_outlined,
  });

  @override
  Widget build(BuildContext context) {
    return value.when(
      skipLoadingOnRefresh: false,
      data: (d) {
        if (emptyWhen?.call(d) ?? false) {
          return empty ??
              EmptyState(
                  icon: emptyIcon, title: emptyTitle, message: emptyMessage);
        }
        return data(d);
      },
      loading: () => loading ?? const LoadingView(),
      error: (e, _) => ErrorView(
        message: e is ApiException ? e.message : e.toString(),
        onRetry: onRetry,
      ),
    );
  }
}
