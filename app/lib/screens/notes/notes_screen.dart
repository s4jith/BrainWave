import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../services/notes_service.dart';
import '../../models/note_model.dart';
import '../../widgets/common/loading_widget.dart';

class NotesScreen extends ConsumerStatefulWidget {
  const NotesScreen({super.key});

  @override
  ConsumerState<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends ConsumerState<NotesScreen> {
  List<NoteModel> _notes = [];
  bool _isLoading = true;
  String? _error;
  String? _filterSubject;

  @override
  void initState() {
    super.initState();
    _loadNotes();
  }

  Future<void> _loadNotes() async {
    final user = ref.read(authProvider).user;
    if (user == null) return;
    setState(() { _isLoading = true; _error = null; });
    try {
      final notes = await ref.read(notesServiceProvider).getNotes(
        user.id,
        subject: _filterSubject,
      );
      if (mounted) setState(() { _notes = notes; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load notes'; _isLoading = false; });
    }
  }

  Future<void> _deleteNote(NoteModel note) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        title: const Text('Delete Note?'),
        content: Text('Delete "${note.title}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: AppTheme.error)),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ref.read(notesServiceProvider).deleteNote(note.id);
      _loadNotes();
    } catch (_) {}
  }

  void _showAddNoteSheet({NoteModel? existing}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _NoteEditorSheet(
        existing: existing,
        onSave: (title, content, subject, chapter) async {
          final user = ref.read(authProvider).user!;
          if (existing != null) {
            await ref.read(notesServiceProvider).updateNote(existing.id, title, content);
          } else {
            await ref.read(notesServiceProvider).createNote(
              NoteModel(
                id: '', studentId: user.id, title: title, content: content,
                subject: subject, chapter: chapter, classLevel: user.classLevel,
                noteType: 'manual', createdAt: DateTime.now(), updatedAt: DateTime.now(),
              ),
              user.id,
            );
          }
          _loadNotes();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Notes'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list),
            onSelected: (v) {
              setState(() => _filterSubject = v == 'all' ? null : v);
              _loadNotes();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'all', child: Text('All Subjects')),
              ...(user?.subjects ?? []).map((s) => PopupMenuItem(value: s, child: Text(s))),
            ],
          ),
        ],
      ),
      body: _isLoading
          ? const LoadingWidget()
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _loadNotes)
              : _notes.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: _loadNotes,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _notes.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) => _buildNoteCard(_notes[i]),
                      ),
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddNoteSheet(),
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Note', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _buildNoteCard(NoteModel note) {
    return Dismissible(
      key: Key(note.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(
          color: AppTheme.error.withOpacity(0.2),
          borderRadius: BorderRadius.circular(14),
        ),
        child: const Icon(Icons.delete, color: AppTheme.error),
      ),
      confirmDismiss: (_) async {
        await _deleteNote(note);
        return false;
      },
      child: GestureDetector(
        onTap: () => _showAddNoteSheet(existing: note),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.cardDark,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.borderDark),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      note.title,
                      style: Theme.of(context).textTheme.titleMedium,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    DateFormat('MMM d').format(note.updatedAt),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                note.content,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textSecondaryDark),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  if (note.subject.isNotEmpty)
                    _buildChip(note.subject, AppTheme.primary),
                  if (note.chapter.isNotEmpty) ...[
                    const SizedBox(width: 6),
                    _buildChip(note.chapter, AppTheme.accent),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600)),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.note_add_outlined, size: 60, color: AppTheme.textSecondaryDark),
          const SizedBox(height: 16),
          Text('No notes yet', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text('Tap + to create your first note', style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _NoteEditorSheet extends StatefulWidget {
  final NoteModel? existing;
  final Future<void> Function(String, String, String, String) onSave;

  const _NoteEditorSheet({this.existing, required this.onSave});

  @override
  State<_NoteEditorSheet> createState() => _NoteEditorSheetState();
}

class _NoteEditorSheetState extends State<_NoteEditorSheet> {
  late final TextEditingController _titleCtrl;
  late final TextEditingController _contentCtrl;
  final _subjectCtrl = TextEditingController();
  final _chapterCtrl = TextEditingController();
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _titleCtrl = TextEditingController(text: widget.existing?.title ?? '');
    _contentCtrl = TextEditingController(text: widget.existing?.content ?? '');
    _subjectCtrl.text = widget.existing?.subject ?? '';
    _chapterCtrl.text = widget.existing?.chapter ?? '';
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    _subjectCtrl.dispose();
    _chapterCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_titleCtrl.text.trim().isEmpty) return;
    setState(() => _isSaving = true);
    try {
      await widget.onSave(
        _titleCtrl.text.trim(),
        _contentCtrl.text.trim(),
        _subjectCtrl.text.trim(),
        _chapterCtrl.text.trim(),
      );
      if (mounted) Navigator.pop(context);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.existing != null ? 'Edit Note' : 'New Note',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              TextButton(
                onPressed: _isSaving ? null : _save,
                child: _isSaving
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Save'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(labelText: 'Title', prefixIcon: Icon(Icons.title)),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _contentCtrl,
            maxLines: 5,
            decoration: const InputDecoration(labelText: 'Content', alignLabelWithHint: true),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _subjectCtrl,
                  decoration: const InputDecoration(labelText: 'Subject', isDense: true),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _chapterCtrl,
                  decoration: const InputDecoration(labelText: 'Chapter', isDense: true),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
