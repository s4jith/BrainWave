import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/constants.dart';
import '../../providers/auth_provider.dart';
import '../../services/test_service.dart';
import '../../models/test_model.dart';
import '../../widgets/common/loading_widget.dart';
import 'package:intl/intl.dart';

class TestCenterScreen extends ConsumerStatefulWidget {
  const TestCenterScreen({super.key});

  @override
  ConsumerState<TestCenterScreen> createState() => _TestCenterScreenState();
}

class _TestCenterScreenState extends ConsumerState<TestCenterScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<TestHistoryItem> _history = [];
  bool _historyLoading = true;

  // Test config
  String? _selectedSubject;
  String? _selectedChapter;
  int _numQuestions = 10;
  bool _isStarting = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    final user = ref.read(authProvider).user;
    if (user?.subjects.isNotEmpty == true) _selectedSubject = user!.subjects.first;
    _loadHistory();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    setState(() => _historyLoading = true);
    try {
      final studentId = ref.read(authProvider).user?.id ?? '';
      final h = await ref.read(testServiceProvider).getTestHistory(studentId);
      if (mounted) setState(() { _history = h; _historyLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _historyLoading = false);
    }
  }

  Future<void> _startTest(String testType) async {
    if (_selectedSubject == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select a subject first')),
      );
      return;
    }
    setState(() => _isStarting = true);
    try {
      final user = ref.read(authProvider).user;
      final session = testType == 'ai'
          ? await ref.read(testServiceProvider).startAITest(
              subject: _selectedSubject!,
              chapter: _selectedChapter ?? '',
              classLevel: user?.classLevel ?? 'Class 9',
              numQuestions: _numQuestions,
            )
          : await ref.read(testServiceProvider).startQBTest(
              subject: _selectedSubject!,
              chapter: _selectedChapter ?? '',
              classLevel: user?.classLevel ?? 'Class 9',
              numQuestions: _numQuestions,
            );
      if (mounted) context.push('/test-session', extra: session);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to start test: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isStarting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Test Center'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'AI Test'),
            Tab(text: 'Question Bank'),
            Tab(text: 'History'),
          ],
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.textSecondaryDark,
          indicatorColor: AppTheme.primary,
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildTestSetup('ai', user?.subjects ?? AppConstants.subjects),
          _buildTestSetup('qb', user?.subjects ?? AppConstants.subjects),
          _buildHistory(),
        ],
      ),
    );
  }

  Widget _buildTestSetup(String testType, List<String> subjects) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildTestTypeCard(testType),
          const SizedBox(height: 24),
          Text('Configure Your Test', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: _selectedSubject,
            decoration: const InputDecoration(labelText: 'Subject', prefixIcon: Icon(Icons.subject)),
            items: subjects.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) => setState(() => _selectedSubject = v),
            dropdownColor: AppTheme.surfaceDark,
          ),
          const SizedBox(height: 16),
          TextField(
            onChanged: (v) => setState(() => _selectedChapter = v.isEmpty ? null : v),
            decoration: const InputDecoration(
              labelText: 'Chapter (optional)',
              prefixIcon: Icon(Icons.menu_book_outlined),
            ),
          ),
          const SizedBox(height: 16),
          Text('Number of Questions', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 8),
          Row(
            children: [5, 10, 15, 20].map((n) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilterChip(
                label: Text('$n'),
                selected: _numQuestions == n,
                onSelected: (_) => setState(() => _numQuestions = n),
                selectedColor: AppTheme.primary.withOpacity(0.2),
                checkmarkColor: AppTheme.primary,
              ),
            )).toList(),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _isStarting ? null : () => _startTest(testType),
              icon: _isStarting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.play_arrow),
              label: Text(_isStarting ? 'Starting...' : 'Start Test'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTestTypeCard(String type) {
    final isAI = type == 'ai';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isAI
              ? [AppTheme.primary.withOpacity(0.3), AppTheme.secondary.withOpacity(0.3)]
              : [AppTheme.accent.withOpacity(0.3), AppTheme.primary.withOpacity(0.3)],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isAI ? AppTheme.primary.withOpacity(0.3) : AppTheme.accent.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(
            isAI ? Icons.psychology : Icons.library_books,
            color: isAI ? AppTheme.primary : AppTheme.accent,
            size: 36,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isAI ? 'AI Generated Test' : 'Question Bank Test',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(
                  isAI
                      ? 'Fresh AI-generated questions tailored for you'
                      : 'Curated questions from our question bank',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistory() {
    if (_historyLoading) {
      return const LoadingWidget(message: 'Loading test history...');
    }
    if (_history.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.history_edu, size: 60, color: AppTheme.textSecondaryDark),
            const SizedBox(height: 16),
            Text('No tests taken yet', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text('Start a test to see your history here', style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _loadHistory,
      child: ListView.separated(
        padding: const EdgeInsets.all(20),
        itemCount: _history.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _buildHistoryCard(_history[i]),
      ),
    );
  }

  Widget _buildHistoryCard(TestHistoryItem item) {
    final pct = item.percentage;
    final color = pct >= 80 ? AppTheme.success : pct >= 60 ? AppTheme.warning : AppTheme.error;
    return GestureDetector(
      onTap: () async {
        try {
          final result = await ref.read(testServiceProvider).getTestResult(item.id);
          if (mounted) context.push('/test-result', extra: result);
        } catch (_) {}
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.cardDark,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderDark),
        ),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  '${pct.round()}%',
                  style: TextStyle(
                    color: color,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.subject, style: Theme.of(context).textTheme.titleMedium),
                  if (item.chapter.isNotEmpty)
                    Text(item.chapter, style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      _buildTag(item.testType.toUpperCase(), AppTheme.primary),
                      const SizedBox(width: 6),
                      _buildTag('${item.score}/${item.total}', color),
                    ],
                  ),
                ],
              ),
            ),
            Text(
              DateFormat('MMM d').format(item.completedAt),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTag(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600),
      ),
    );
  }
}
