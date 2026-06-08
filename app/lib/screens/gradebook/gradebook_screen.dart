import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:percent_indicator/linear_percent_indicator.dart';
import '../../core/theme.dart';
import '../../services/student_service.dart';
import '../../models/query_model.dart';
import '../../widgets/common/loading_widget.dart';

class GradebookScreen extends ConsumerStatefulWidget {
  const GradebookScreen({super.key});

  @override
  ConsumerState<GradebookScreen> createState() => _GradebookScreenState();
}

class _GradebookScreenState extends ConsumerState<GradebookScreen> {
  List<GradeModel> _grades = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadGrades();
  }

  Future<void> _loadGrades() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final grades = await ref.read(studentServiceProvider).getGrades();
      if (mounted) setState(() { _grades = grades; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load grades'; _isLoading = false; });
    }
  }

  double get _average {
    if (_grades.isEmpty) return 0;
    return _grades.fold(0.0, (sum, g) => sum + g.grade) / _grades.length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Gradebook')),
      body: _isLoading
          ? const LoadingWidget()
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _loadGrades)
              : _grades.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: _loadGrades,
                      child: CustomScrollView(
                        slivers: [
                          SliverToBoxAdapter(child: _buildSummaryCard()),
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            sliver: SliverList(
                              delegate: SliverChildBuilderDelegate(
                                (_, i) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _buildGradeCard(_grades[i]),
                                ),
                                childCount: _grades.length,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
    );
  }

  Widget _buildSummaryCard() {
    final avg = _average;
    final color = avg >= 80 ? AppTheme.success : avg >= 60 ? AppTheme.warning : AppTheme.error;
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color.withOpacity(0.2), AppTheme.cardDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Overall Performance', style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 4),
                Text(
                  '${avg.toStringAsFixed(1)}%',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: color, fontWeight: FontWeight.bold,
                  ),
                ),
                Text('${_grades.length} subjects', style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                _gradeLetterFromPercent(avg),
                style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 24),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGradeCard(GradeModel grade) {
    final color = grade.grade >= 80
        ? AppTheme.success
        : grade.grade >= 60
            ? AppTheme.warning
            : AppTheme.error;
    return Container(
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(grade.courseName, style: Theme.of(context).textTheme.titleMedium),
                    Text(grade.subject, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  grade.letterGrade,
                  style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 18),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          LinearPercentIndicator(
            lineHeight: 8,
            percent: (grade.grade / 100).clamp(0, 1),
            progressColor: color,
            backgroundColor: color.withOpacity(0.15),
            barRadius: const Radius.circular(4),
            padding: EdgeInsets.zero,
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${grade.grade.toStringAsFixed(1)}%', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: color)),
              if (grade.totalAssignments > 0)
                Text(
                  '${grade.completedAssignments}/${grade.totalAssignments} assignments',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.grade_outlined, size: 60, color: AppTheme.textSecondaryDark),
          const SizedBox(height: 16),
          Text('No grades yet', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text('Grades will appear once enrolled in courses', style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }

  String _gradeLetterFromPercent(double p) {
    if (p >= 90) return 'A+';
    if (p >= 80) return 'A';
    if (p >= 70) return 'B';
    if (p >= 60) return 'C';
    return 'D';
  }
}
