import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/note_model.dart';
import '../providers/auth_provider.dart';
import 'notes_provider.dart';

class NotesScreen extends ConsumerWidget {
  const NotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notes = ref.watch(notesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My Notes')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openEditor(context, ref),
        backgroundColor: context.palette.primary,
        foregroundColor: context.palette.primaryForeground,
        child: const Icon(Icons.add_rounded),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(notesProvider.future),
        child: notes.when(
          loading: () => const LoadingView(message: 'Loading notes…'),
          error: (e, _) => ListView(children: [
            const SizedBox(height: 120),
            ErrorView(
                message: '$e', onRetry: () => ref.invalidate(notesProvider)),
          ]),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: [
                const SizedBox(height: 100),
                EmptyState(
                  icon: Icons.note_alt_outlined,
                  title: 'No notes yet',
                  message: 'Capture key ideas and revise them anytime.',
                  actionLabel: 'Add a note',
                  onAction: () => _openEditor(context, ref),
                ),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 92),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _noteCard(context, ref, list[i]),
            );
          },
        ),
      ),
    );
  }

  Widget _noteCard(BuildContext context, WidgetRef ref, NoteModel note) {
    final p = context.palette;
    return Dismissible(
      key: ValueKey(note.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        decoration: BoxDecoration(
          color: p.destructive.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Icon(Icons.delete_outline_rounded, color: p.destructive),
      ),
      confirmDismiss: (_) => context.confirm(
        title: 'Delete note?',
        message: 'This note will be permanently removed.',
        confirmLabel: 'Delete',
        destructive: true,
      ),
      onDismissed: (_) async {
        try {
          await ref.read(notesProvider.notifier).remove(note.id);
          if (context.mounted) context.showSnack('Note deleted');
        } catch (e) {
          if (context.mounted) context.showSnack('$e', isError: true);
        }
      },
      child: AppCard(
        onTap: () => _openEditor(context, ref, note: note),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (note.subject.isNotEmpty) ...[
                  Text(Formatters.subjectEmoji(note.subject),
                      style: const TextStyle(fontSize: 16)),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(note.title,
                      style: context.texts.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                ),
                if (note.noteType != 'manual')
                  StatusBadge(
                      label: note.noteType.toUpperCase(), color: p.info),
              ],
            ),
            if (note.content.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(note.content,
                  style: context.texts.bodySmall
                      ?.copyWith(color: p.mutedForeground),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
            ],
            const SizedBox(height: 8),
            Text(
              [
                if (note.subject.isNotEmpty) note.subject,
                if (note.chapter.isNotEmpty) 'Ch ${note.chapter}',
                Formatters.relative(note.updatedAt),
              ].join(' • '),
              style: context.texts.labelSmall?.copyWith(color: p.mutedForeground),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openEditor(BuildContext context, WidgetRef ref,
      {NoteModel? note}) async {
    final user = ref.read(authProvider).user;
    final subjects =
        (user?.subjects.isNotEmpty ?? false) ? user!.subjects : AppConstants.subjects;
    final result = await showModalBottomSheet<_NoteDraft>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.palette.background,
      builder: (_) => _NoteEditorSheet(note: note, subjects: subjects),
    );
    if (result == null) return;
    try {
      if (note == null) {
        await ref.read(notesProvider.notifier).add(
              title: result.title,
              content: result.content,
              subject: result.subject,
              chapter: result.chapter,
            );
        if (context.mounted) context.showSnack('Note added');
      } else {
        await ref.read(notesProvider.notifier).edit(
            id: note.id, title: result.title, content: result.content);
        if (context.mounted) context.showSnack('Note updated');
      }
    } catch (e) {
      if (context.mounted) context.showSnack('$e', isError: true);
    }
  }
}

class _NoteDraft {
  final String title;
  final String content;
  final String subject;
  final String chapter;
  const _NoteDraft(this.title, this.content, this.subject, this.chapter);
}

class _NoteEditorSheet extends StatefulWidget {
  final NoteModel? note;
  final List<String> subjects;
  const _NoteEditorSheet({this.note, required this.subjects});

  @override
  State<_NoteEditorSheet> createState() => _NoteEditorSheetState();
}

class _NoteEditorSheetState extends State<_NoteEditorSheet> {
  late final _titleCtrl = TextEditingController(text: widget.note?.title ?? '');
  late final _contentCtrl =
      TextEditingController(text: widget.note?.content ?? '');
  late final _chapterCtrl =
      TextEditingController(text: widget.note?.chapter ?? '');
  late String? _subject = widget.note?.subject.isNotEmpty == true
      ? widget.note!.subject
      : null;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    _chapterCtrl.dispose();
    super.dispose();
  }

  void _save() {
    final title = _titleCtrl.text.trim();
    if (title.isEmpty) {
      context.showSnack('Add a title for your note.', isError: true);
      return;
    }
    Navigator.of(context).pop(_NoteDraft(
      title,
      _contentCtrl.text.trim(),
      _subject ?? '',
      _chapterCtrl.text.trim(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.note != null;
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: context.palette.border,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(isEdit ? 'Edit note' : 'New note',
                style: context.texts.titleLarge),
            const SizedBox(height: 16),
            TextField(
              controller: _titleCtrl,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(labelText: 'Title'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _contentCtrl,
              minLines: 4,
              maxLines: 10,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                  labelText: 'Content', alignLabelWithHint: true),
            ),
            if (!isEdit) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: _subject,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Subject'),
                      items: widget.subjects
                          .map((s) =>
                              DropdownMenuItem(value: s, child: Text(s)))
                          .toList(),
                      onChanged: (v) => setState(() => _subject = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _chapterCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Chapter'),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 20),
            PrimaryButton(
                label: isEdit ? 'Save changes' : 'Add note', onPressed: _save),
          ],
        ),
      ),
    );
  }
}
