import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:percent_indicator/circular_percent_indicator.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../services/student_service.dart';
import '../../widgets/common/loading_widget.dart';

class ReportCardScreen extends ConsumerStatefulWidget {
  const ReportCardScreen({super.key});

  @override
  ConsumerState<ReportCardScreen> createState() => _ReportCardScreenState();
}

class _ReportCardScreenState extends ConsumerState<ReportCardScreen> {
  Map<String, dynamic>? _data;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final user = ref.read(authProvider).user;
    if (user == null) return;
    setState(() { _isLoading = true; _error = null; });
    try {
      final progressData = await ref.read(studentServiceProvider).getProgressData(user.id);
      if (mounted) setState(() { _data = progressData; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load report card'; _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report Card')),
      body: _isLoading
          ? const LoadingWidget()
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _loadData)
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final user = ref.watch(authProvider).user;
    final overallScore = (_data?['average_score'] ?? 0).toDouble();
    final streak = _data?['streak'] ?? 0;
    final totalTests = _data?['total_tests'] ?? 0;
    final studyHours = (_data?['study_hours'] ?? 0).toDouble();

    return RefreshIndicator(
      onRefresh: _loadData,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildStudentHeader(user?.name ?? 'Student', user?.classLevel ?? ''),
            const SizedBox(height: 16),
            _buildOverallCard(overallScore),
            const SizedBox(height: 16),
            _buildStatsGrid(streak, totalTests, studyHours),
            const SizedBox(height: 16),
            _buildSubjectBreakdown(),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildStudentHeader(String name, String classLevel) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                ref.watch(authProvider).user?.initials ?? 'S',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 22),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: Theme.of(context).textTheme.titleLarge),
              Text(classLevel, style: Theme.of(context).textTheme.bodyMedium),
              Text('Academic Year 2024-25', style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildOverallCard(double score) {
    final color = score >= 80 ? AppTheme.success : score >= 60 ? AppTheme.warning : AppTheme.error;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          CircularPercentIndicator(
            radius: 50,
            lineWidth: 8,
            percent: (score / 100).clamp(0, 1),
            center: Text(
              '${score.round()}%',
              style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 16),
            ),
            progressColor: color,
            backgroundColor: color.withOpacity(0.15),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Overall Score', style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 4),
                Text(
                  score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Improvement',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(color: color),
                ),
                Text('Keep up the great work!', style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsGrid(int streak, int tests, double hours) {
    return Row(
      children: [
        Expanded(child: _buildStatCard('🔥', '$streak days', 'Streak', AppTheme.warning)),
        const SizedBox(width: 10),
        Expanded(child: _buildStatCard('📝', '$tests', 'Tests Done', AppTheme.primary)),
        const SizedBox(width: 10),
        Expanded(child: _buildStatCard('⏱️', '${hours.toStringAsFixed(1)}h', 'Study Hours', AppTheme.success)),
      ],
    );
  }

  Widget _buildStatCard(String emoji, String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(color: color, fontWeight: FontWeight.bold)),
          Text(label, style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildSubjectBreakdown() {
    final subjects = _data?['subject_scores'] as Map<String, dynamic>? ?? {};
    if (subjects.isEmpty) {
      final user = ref.watch(authProvider).user;
      final userSubjects = user?.subjects ?? [];
      if (userSubjects.isEmpty) return const SizedBox.shrink();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Subjects', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...userSubjects.map((s) => Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.cardDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.borderDark),
            ),
            child: Row(
              children: [
                Text(_subjectEmoji(s), style: const TextStyle(fontSize: 20)),
                const SizedBox(width: 12),
                Expanded(child: Text(s, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textPrimaryDark))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('—', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.primary)),
                ),
              ],
            ),
          )),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Subject Performance', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        ...subjects.entries.map((e) {
          final score = (e.value as num).toDouble();
          final color = score >= 80 ? AppTheme.success : score >= 60 ? AppTheme.warning : AppTheme.error;
          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.cardDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.borderDark),
            ),
            child: Row(
              children: [
                Text(_subjectEmoji(e.key), style: const TextStyle(fontSize: 20)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(e.key, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppTheme.textPrimaryDark)),
                      const SizedBox(height: 4),
                      LinearProgressIndicator(
                        value: (score / 100).clamp(0, 1),
                        backgroundColor: color.withOpacity(0.15),
                        valueColor: AlwaysStoppedAnimation(color),
                        minHeight: 4,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text('${score.round()}%', style: TextStyle(color: color, fontWeight: FontWeight.bold)),
              ],
            ),
          );
        }),
      ],
    );
  }

  String _subjectEmoji(String s) => switch (s) {
    'Mathematics' || 'Math' => '📐',
    'Science' => '🔬',
    'Physics' => '⚡',
    'Chemistry' => '🧪',
    'Biology' => '🌱',
    'Social Science' || 'Social' => '🌍',
    'English' => '📚',
    'Hindi' => '🔤',
    _ => '📖',
  };
}
