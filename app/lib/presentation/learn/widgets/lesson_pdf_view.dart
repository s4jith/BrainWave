import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdfx/pdfx.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/widgets/app_states.dart';
import '../learn_providers.dart';

/// Renders a lesson PDF from downloaded bytes using a pinch-zoom viewer.
///
/// Give this a `ValueKey(url)` so switching chapters recreates the state and
/// disposes the previous [PdfControllerPinch].
class LessonPdfView extends ConsumerStatefulWidget {
  final String url;
  const LessonPdfView({super.key, required this.url});

  @override
  ConsumerState<LessonPdfView> createState() => _LessonPdfViewState();
}

class _LessonPdfViewState extends ConsumerState<LessonPdfView> {
  PdfControllerPinch? _controller;

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bytes = ref.watch(pdfBytesProvider(widget.url));
    return bytes.when(
      loading: () => const LoadingView(message: 'Loading chapter…'),
      error: (e, _) => ErrorView(
        message: e is ApiException ? e.message : 'Could not load this chapter.',
        onRetry: () => ref.invalidate(pdfBytesProvider(widget.url)),
      ),
      data: (data) {
        _controller ??=
            PdfControllerPinch(document: PdfDocument.openData(data));
        return PdfViewPinch(controller: _controller!);
      },
    );
  }
}
