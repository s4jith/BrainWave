import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../services/career_service.dart';
import '../../models/career_model.dart';
import '../../widgets/common/loading_widget.dart';

class CareerResultScreen extends ConsumerStatefulWidget {
  final String? resultId;
  const CareerResultScreen({super.key, this.resultId});

  @override
  ConsumerState<CareerResultScreen> createState() => _CareerResultScreenState();
}

class _CareerResultScreenState extends ConsumerState<CareerResultScreen> {
  CareerResult? _result;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadResult();
  }

  Future<void> _loadResult() async {
    if (widget.resultId == null) {
      setState(() => _isLoading = false);
      return;
    }
    try {
      final result = await ref.read(careerServiceProvider).getResult(widget.resultId!);
      if (mounted) setState(() { _result = result; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Career Analysis'),
        automaticallyImplyLeading: false,
        actions: [
          TextButton(onPressed: () => context.go('/dashboard'), child: const Text('Home')),
        ],
      ),
      body: _isLoading
          ? const LoadingWidget(message: 'Analyzing your responses...')
          : _result == null
              ? const Center(child: Text('No result found'))
              : _buildResultContent(),
    );
  }

  Widget _buildResultContent() {
    final r = _result!;
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: _buildTopCareers(r)),
        SliverToBoxAdapter(child: _buildAnalysis(r)),
        SliverToBoxAdapter(child: _buildStrengths(r)),
        SliverToBoxAdapter(child: _buildRecommendations(r)),
        const SliverToBoxAdapter(child: SizedBox(height: 24)),
      ],
    );
  }

  Widget _buildTopCareers(CareerResult r) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                const Icon(Icons.workspace_premium, color: Colors.white, size: 48),
                const SizedBox(height: 12),
                const Text('Your Career Matches', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  runSpacing: 8,
                  children: r.topCareers.take(5).map((career) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(career, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                  )).toList(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnalysis(CareerResult r) {
    if (r.analysis.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your Analysis', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.cardDark,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.borderDark),
            ),
            child: Text(r.analysis, style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppTheme.textSecondaryDark, height: 1.6,
            )),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildStrengths(CareerResult r) {
    if (r.strengths.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your Strengths', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...r.strengths.map((s) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                const Icon(Icons.star, color: AppTheme.warning, size: 18),
                const SizedBox(width: 10),
                Expanded(child: Text(s, style: Theme.of(context).textTheme.bodyMedium)),
              ],
            ),
          )),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildRecommendations(CareerResult r) {
    if (r.recommendations.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recommendations', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...r.recommendations.asMap().entries.map((entry) => Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.cardDark,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.borderDark),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 24, height: 24,
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '${entry.key + 1}',
                      style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 11),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(entry.value, style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.textSecondaryDark,
                  )),
                ),
              ],
            ),
          )),
        ],
      ),
    );
  }
}
