import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../services/student_service.dart';
import '../../models/query_model.dart';
import '../../widgets/common/loading_widget.dart';

class GroupsScreen extends ConsumerStatefulWidget {
  const GroupsScreen({super.key});

  @override
  ConsumerState<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends ConsumerState<GroupsScreen> {
  List<GroupModel> _groups = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadGroups();
  }

  Future<void> _loadGroups() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final groups = await ref.read(studentServiceProvider).getGroups();
      if (mounted) setState(() { _groups = groups; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load groups'; _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Groups')),
      body: _isLoading
          ? const LoadingWidget()
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _loadGroups)
              : _groups.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: _loadGroups,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _groups.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) => _buildGroupCard(_groups[i]),
                      ),
                    ),
    );
  }

  Widget _buildGroupCard(GroupModel group) {
    final colors = [AppTheme.primary, AppTheme.secondary, AppTheme.accent, AppTheme.warning, AppTheme.success];
    final color = colors[group.id.hashCode % colors.length];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    group.name.isNotEmpty ? group.name[0].toUpperCase() : 'G',
                    style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 20),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(group.name, style: Theme.of(context).textTheme.titleMedium),
                    Text(group.classLevel, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(color: AppTheme.borderDark, height: 1),
          const SizedBox(height: 14),
          Row(
            children: [
              _buildInfoItem(Icons.person_outline, group.teacherName, AppTheme.primary),
              const SizedBox(width: 16),
              _buildInfoItem(Icons.subject, group.subject, AppTheme.accent),
              const SizedBox(width: 16),
              _buildInfoItem(Icons.people_outline, '${group.studentCount} students', AppTheme.secondary),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoItem(IconData icon, String text, Color color) {
    return Expanded(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textSecondaryDark),
              overflow: TextOverflow.ellipsis,
            ),
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
          const Icon(Icons.group_outlined, size: 60, color: AppTheme.textSecondaryDark),
          const SizedBox(height: 16),
          Text('Not in any groups', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text("Your teacher will add you to a group", style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}
