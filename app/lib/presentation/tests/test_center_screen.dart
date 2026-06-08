import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/ui_helpers.dart';
import '../../core/widgets/app_states.dart';
import '../../core/widgets/app_widgets.dart';
import '../../data/models/test_model.dart';
import '../../data/repositories/test_repository.dart';
import '../providers/auth_provider.dart';
import 'tests_provider.dart';

class TestCenterScreen extends ConsumerStatefulWidget {
  const TestCenterScreen({super.key});

  @override
  ConsumerState<TestCenterScreen> createState() => _TestCenterScreenState();
}

class _TestCenterScreenState extends ConsumerState<TestCenterScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  String _mode = 'ai'; // 'ai' | 'qb'
  String? _subject;
  String? _chapter;
  int _count = 10;
  bool _starting = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user;
    if (user != null && user.subjects.isNotEmpty) _subject = user.subjects.first;
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    final user = ref.read(authProvider).user;
    if (_subject == null) {
      context.showSnack('Please choose a subject first.', isError: true);
      return;
    }
    setState(() => _starting = true);
    try {
      final repo = ref.read(testRepositoryProvider);
      final cls = user?.classLevel ?? '10';
      final session = _mode == 'ai'
          ? await repo.startAITest(
              subject: _subject!,
              chapter: _chapter ?? '',
              classLevel: cls,
              numQuestions: _count)
          : await repo.startQBTest(
              subject: _subject!,
              chapter: _chapter ?? '',
              classLevel: cls,
              numQuestions: _count);
      if (session.questions.isEmpty) {
        if (mounted) {
          context.showSnack('No questions found for that selection.',
              isError: true);
        }
        return;
      }
      if (mounted) context.push('/test-session', extra: session);
    } on ApiException catch (e) {
      if (mounted) context.showSnack(e.message, isError: true);
    } catch (_) {
      if (mounted) context.showSnack('Could not start the test.', isError: true);
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final subjects =
        (user?.subjects.isNotEmpty ?? false) ? user!.subjects : AppConstants.subjects;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Test Center'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [Tab(text: 'New test'), Tab(text: 'History')],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [_buildSetup(subjects), _buildHistory()],
      ),
    );
  }

  Widget _buildSetup(List<String> subjects) {
    final p = context.palette;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Mode toggle
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: p.muted,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Row(
              children: [
                _modeTab('ai', 'AI generated', Icons.smart_toy_rounded),
                _modeTab('qb', 'Question bank', Icons.library_books_rounded),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _mode == 'ai'
                ? 'Fresh AI questions tailored to your chapter.'
                : 'Curated questions from the question bank.',
            style: context.texts.bodySmall?.copyWith(color: p.mutedForeground),
          ),
          const SizedBox(height: 24),
          Text('Configure your test', style: context.texts.titleMedium),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            initialValue: _subject,
            isExpanded: true,
            decoration: const InputDecoration(
              labelText: 'Subject',
              prefixIcon: Icon(Icons.subject_rounded),
            ),
            items: subjects
                .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                .toList(),
            onChanged: (v) => setState(() => _subject = v),
          ),
          const SizedBox(height: 16),
          TextField(
            onChanged: (v) => _chapter = v.trim().isEmpty ? null : v.trim(),
            decoration: const InputDecoration(
              labelText: 'Chapter (optional)',
              prefixIcon: Icon(Icons.menu_book_outlined),
            ),
          ),
          const SizedBox(height: 20),
          Text('Number of questions', style: context.texts.titleSmall),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            children: [5, 10, 15, 20].map((n) {
              final sel = _count == n;
              return ChoiceChip(
                label: Text('$n'),
                selected: sel,
                onSelected: (_) => setState(() => _count = n),
              );
            }).toList(),
          ),
          const SizedBox(height: 28),
          PrimaryButton(
            label: 'Start test',
            icon: Icons.play_arrow_rounded,
            loading: _starting,
            onPressed: _start,
          ),
        ],
      ),
    );
  }

  Widget _modeTab(String value, String label, IconData icon) {
    final p = context.palette;
    final sel = _mode == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _mode = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: sel ? p.card : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadius.sm),
            border: sel ? Border.all(color: p.border) : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 18, color: sel ? p.foreground : p.mutedForeground),
              const SizedBox(width: 8),
              Text(label,
                  style: context.texts.labelMedium?.copyWith(
                      color: sel ? p.foreground : p.mutedForeground)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHistory() {
    final history = ref.watch(testHistoryProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(testHistoryProvider.future),
      child: history.when(
        loading: () => const LoadingView(message: 'Loading history…'),
        error: (e, _) => ListView(
          children: [
            const SizedBox(height: 120),
            ErrorView(
              message: e is ApiException ? e.message : 'Failed to load history.',
              onRetry: () => ref.invalidate(testHistoryProvider),
            ),
          ],
        ),
        data: (items) {
          if (items.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 120),
                EmptyState(
                  icon: Icons.history_edu_outlined,
                  title: 'No tests yet',
                  message: 'Start a test and your results will appear here.',
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(20),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (_, i) => _historyCard(items[i]),
          );
        },
      ),
    );
  }

  Widget _historyCard(TestHistoryItem item) {
    final p = context.palette;
    final pct = item.percentage;
    final color = pct >= 80
        ? p.success
        : pct >= 50
            ? p.warning
            : p.destructive;
    return AppCard(
      onTap: () => context.push('/test-result', extra: _resultFromHistory(item)),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: Text('${pct.round()}%',
                style: context.texts.labelLarge?.copyWith(color: color)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.subject, style: context.texts.titleSmall),
                if (item.chapter.isNotEmpty)
                  Text(item.chapter,
                      style: context.texts.bodySmall
                          ?.copyWith(color: p.mutedForeground),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                const SizedBox(height: 6),
                Row(
                  children: [
                    StatusBadge(
                        label: item.testType.toUpperCase(), color: p.info),
                    const SizedBox(width: 6),
                    StatusBadge(
                        label: '${item.score}/${item.total}', color: color),
                  ],
                ),
              ],
            ),
          ),
          Text(Formatters.date(item.completedAt),
              style:
                  context.texts.bodySmall?.copyWith(color: p.mutedForeground)),
        ],
      ),
    );
  }

  /// History rows already carry the score summary; build a lightweight result
  /// so the result screen can show the headline without another round-trip.
  TestResult _resultFromHistory(TestHistoryItem item) => TestResult(
        testId: item.id,
        score: item.score,
        total: item.total,
        percentage: item.percentage,
        subject: item.subject,
        chapter: item.chapter,
        completedAt: item.completedAt,
        questionResults: const [],
      );
}
