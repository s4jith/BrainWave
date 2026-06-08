import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_states.dart';
import '../../data/models/lesson_model.dart';
import '../providers/auth_provider.dart';
import 'learn_providers.dart';
import 'widgets/chat_view.dart';
import 'widgets/lesson_pdf_view.dart';

/// The Learn tab — read NCERT chapter PDFs and ask the AI about the open
/// chapter. Mirrors the web "BookToBot" experience, adapted for mobile.
class BookToBotScreen extends ConsumerStatefulWidget {
  const BookToBotScreen({super.key});

  @override
  ConsumerState<BookToBotScreen> createState() => _BookToBotScreenState();
}

class _BookToBotScreenState extends ConsumerState<BookToBotScreen> {
  LessonModel? _current;

  String get _classLevel =>
      (ref.read(authProvider).user?.classLevelInt ?? 10).toString();

  @override
  Widget build(BuildContext context) {
    // Auto-select the first subject once subjects load.
    ref.listen(bookSubjectsProvider, (_, next) {
      next.whenData((subs) {
        if (subs.isNotEmpty && ref.read(selectedSubjectProvider) == null) {
          ref.read(selectedSubjectProvider.notifier).state = subs.first.name;
        }
      });
    });
    // Keep the open chapter in sync with the loaded lesson list.
    ref.listen(lessonsProvider, (_, next) {
      next.whenData((lessons) {
        final stillThere =
            _current != null && lessons.any((l) => l.id == _current!.id);
        if (!stillThere) {
          setState(() => _current = lessons.isEmpty ? null : lessons.first);
        }
      });
    });

    final subjects = ref.watch(bookSubjectsProvider);
    final selectedSubject = ref.watch(selectedSubjectProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Learn'),
        actions: [
          if (selectedSubject != null)
            IconButton(
              tooltip: 'Chapters',
              onPressed: _openChapters,
              icon: const Icon(Icons.menu_book_rounded),
            ),
        ],
      ),
      floatingActionButton: selectedSubject == null
          ? null
          : FloatingActionButton.extended(
              onPressed: _openChat,
              backgroundColor: context.palette.primary,
              foregroundColor: context.palette.primaryForeground,
              icon: const Icon(Icons.smart_toy_rounded),
              label: const Text('Ask AI'),
            ),
      body: subjects.when(
        loading: () => const LoadingView(message: 'Loading your books…'),
        error: (e, _) => ErrorView(
          message: e is ApiException ? e.message : 'Could not load your books.',
          onRetry: () => ref.invalidate(bookSubjectsProvider),
        ),
        data: (subs) {
          if (subs.isEmpty) {
            return const EmptyState(
              icon: Icons.menu_book_outlined,
              title: 'No books yet',
              message:
                  'There are no AI-ready books for your class yet. Please check back later.',
            );
          }
          return Column(
            children: [
              _subjectBar(subs, selectedSubject),
              Expanded(child: _pdfArea()),
            ],
          );
        },
      ),
    );
  }

  Widget _subjectBar(List<SubjectInfo> subjects, String? selected) {
    final p = context.palette;
    return Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: p.border)),
      ),
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 34,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: subjects.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final s = subjects[i];
                final isSel = s.name == selected;
                return GestureDetector(
                  onTap: () {
                    ref.read(selectedSubjectProvider.notifier).state = s.name;
                  },
                  child: Container(
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: isSel ? p.primary : p.card,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                      border: Border.all(color: isSel ? p.primary : p.border),
                    ),
                    child: Text(
                      s.name,
                      style: context.texts.labelMedium?.copyWith(
                          color: isSel ? p.primaryForeground : p.foreground),
                    ),
                  ),
                );
              },
            ),
          ),
          if (_current != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: GestureDetector(
                onTap: _openChapters,
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Ch ${_current!.number} • ${_current!.title}',
                        style: context.texts.titleSmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Icon(Icons.expand_more_rounded, color: p.mutedForeground),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _pdfArea() {
    final lessons = ref.watch(lessonsProvider);
    return lessons.when(
      loading: () => const LoadingView(message: 'Loading chapters…'),
      error: (e, _) => ErrorView(
        message: e is ApiException ? e.message : 'Could not load chapters.',
        onRetry: () => ref.invalidate(lessonsProvider),
      ),
      data: (list) {
        if (list.isEmpty) {
          return const EmptyState(
            icon: Icons.auto_stories_outlined,
            title: 'No chapters available',
            message: 'This subject has no chapters uploaded yet.',
          );
        }
        final current = _current;
        if (current == null) return const LoadingView();
        if (current.pdfUrl.isEmpty) {
          return EmptyState(
            icon: Icons.picture_as_pdf_outlined,
            title: 'No PDF for this chapter',
            message: 'You can still ask the AI about “${current.title}”.',
            actionLabel: 'Ask AI',
            onAction: _openChat,
          );
        }
        return LessonPdfView(key: ValueKey(current.pdfUrl), url: current.pdfUrl);
      },
    );
  }

  void _openChapters() {
    final lessons = ref.read(lessonsProvider).asData?.value ?? const [];
    if (lessons.isEmpty) return;
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        final p = ctx.palette;
        return SafeArea(
          child: ListView.builder(
            shrinkWrap: true,
            padding: const EdgeInsets.only(bottom: 12),
            itemCount: lessons.length,
            itemBuilder: (_, i) {
              final l = lessons[i];
              final isSel = l.id == _current?.id;
              return ListTile(
                leading: CircleAvatar(
                  radius: 16,
                  backgroundColor: isSel ? p.primary : p.muted,
                  child: Text('${l.number}',
                      style: ctx.texts.labelMedium?.copyWith(
                          color: isSel ? p.primaryForeground : p.foreground)),
                ),
                title: Text(l.title,
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  l.hasAiSupport ? 'AI ready' : 'Embeddings pending',
                  style: ctx.texts.bodySmall
                      ?.copyWith(color: p.mutedForeground),
                ),
                trailing: isSel
                    ? Icon(Icons.check_rounded, color: p.foreground)
                    : null,
                onTap: () {
                  setState(() => _current = l);
                  Navigator.of(ctx).pop();
                },
              );
            },
          ),
        );
      },
    );
  }

  void _openChat() {
    final subject = ref.read(selectedSubjectProvider);
    if (subject == null) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.palette.background,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          initialChildSize: 0.86,
          minChildSize: 0.5,
          maxChildSize: 0.96,
          expand: false,
          builder: (_, controller) {
            return Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 8, 4),
                  child: Row(
                    children: [
                      Icon(Icons.smart_toy_rounded,
                          color: ctx.palette.foreground, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _current != null
                              ? 'Ask about: ${_current!.title}'
                              : 'Ask AI • $subject',
                          style: ctx.texts.titleSmall,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: ChatView(
                    scope: 'book',
                    classLevel: _classLevel,
                    fixedSubject: subject,
                    fixedChapter: _current?.title,
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
