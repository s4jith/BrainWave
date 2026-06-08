import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../services/student_service.dart';
import '../../widgets/common/loading_widget.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  Map<String, dynamic>? _dashboardData;
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
      final data = await ref.read(studentServiceProvider).getDashboardData(user.id);
      if (mounted) setState(() { _dashboardData = data; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load dashboard'; _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          color: AppTheme.primary,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _buildHeader(user?.name ?? 'Student')),
              SliverToBoxAdapter(child: _buildStatsRow()),
              SliverToBoxAdapter(child: _buildQuickActions()),
              SliverToBoxAdapter(child: _buildSubjectProgress()),
              SliverToBoxAdapter(child: _buildMenuGrid()),
              const SliverToBoxAdapter(child: SizedBox(height: 24)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(String name) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$greeting,',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                Text(
                  name.split(' ').first,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () => context.push('/settings'),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  ref.watch(authProvider).user?.initials ?? 'S',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow() {
    if (_isLoading) {
      return const Padding(
        padding: EdgeInsets.all(20),
        child: Row(
          children: [
            Expanded(child: ShimmerCard(height: 90)),
            SizedBox(width: 12),
            Expanded(child: ShimmerCard(height: 90)),
            SizedBox(width: 12),
            Expanded(child: ShimmerCard(height: 90)),
          ],
        ),
      );
    }
    final streak = _dashboardData?['streak'] ?? 0;
    final testsCompleted = _dashboardData?['tests_completed'] ?? 0;
    final avgScore = _dashboardData?['average_score'] ?? 0;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        children: [
          _buildStatCard('🔥', '$streak', 'Day Streak'),
          const SizedBox(width: 12),
          _buildStatCard('✅', '$testsCompleted', 'Tests Done'),
          const SizedBox(width: 12),
          _buildStatCard('⭐', '$avgScore%', 'Avg Score'),
        ],
      ),
    );
  }

  Widget _buildStatCard(String emoji, String value, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.cardDark,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.borderDark),
        ),
        child: Column(
          children: [
            Text(emoji, style: const TextStyle(fontSize: 22)),
            const SizedBox(height: 4),
            Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.bold, color: AppTheme.textPrimaryDark,
            )),
            Text(label, style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Quick Actions', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildActionBtn('Ask AI', Icons.chat_bubble_outline, AppTheme.primary, () => context.go('/chat')),
              const SizedBox(width: 10),
              _buildActionBtn('Take Test', Icons.quiz_outlined, AppTheme.secondary, () => context.go('/tests')),
              const SizedBox(width: 10),
              _buildActionBtn('My Notes', Icons.note_outlined, AppTheme.accent, () => context.go('/notes')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionBtn(String label, IconData icon, Color color, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withOpacity(0.3)),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 26),
              const SizedBox(height: 6),
              Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textPrimaryDark, fontWeight: FontWeight.w500,
              )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSubjectProgress() {
    final user = ref.watch(authProvider).user;
    final subjects = user?.subjects ?? [];
    if (subjects.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your Subjects', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          SizedBox(
            height: 80,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: subjects.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (_, i) => _buildSubjectChip(subjects[i]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubjectChip(String subject) {
    final colors = [AppTheme.primary, AppTheme.secondary, AppTheme.accent, AppTheme.warning, AppTheme.success];
    final color = colors[subject.hashCode % colors.length];
    return GestureDetector(
      onTap: () => context.go('/chat'),
      child: Container(
        width: 100,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(_subjectEmoji(subject), style: const TextStyle(fontSize: 22)),
            const SizedBox(height: 4),
            Text(
              subject,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuGrid() {
    final menuItems = [
      (icon: Icons.bar_chart, label: 'Report Card', color: AppTheme.primary, path: '/report-card'),
      (icon: Icons.people_outline, label: 'My Groups', color: AppTheme.secondary, path: '/groups'),
      (icon: Icons.question_answer_outlined, label: 'My Queries', color: AppTheme.accent, path: '/queries'),
      (icon: Icons.grade_outlined, label: 'Gradebook', color: AppTheme.warning, path: '/gradebook'),
      (icon: Icons.work_outline, label: 'Career Test', color: AppTheme.success, path: '/career'),
      (icon: Icons.support_outlined, label: 'Support', color: Colors.orange, path: '/support'),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Explore', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              childAspectRatio: 1.0,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
            ),
            itemCount: menuItems.length,
            itemBuilder: (_, i) {
              final item = menuItems[i];
              return GestureDetector(
                onTap: () => context.go(item.path),
                child: Container(
                  decoration: BoxDecoration(
                    color: AppTheme.cardDark,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.borderDark),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: item.color.withOpacity(0.12),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(item.icon, color: item.color, size: 24),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        item.label,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w500, color: AppTheme.textPrimaryDark,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  String _subjectEmoji(String s) => switch (s) {
    'Mathematics' => '📐',
    'Science' => '🔬',
    'Physics' => '⚡',
    'Chemistry' => '🧪',
    'Biology' => '🌱',
    'Social Science' => '🌍',
    'English' => '📚',
    'Hindi' => '🔤',
    _ => '📖',
  };
}
