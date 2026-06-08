import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../core/constants.dart';
import '../../services/student_service.dart';
import '../../models/query_model.dart';
import '../../widgets/common/loading_widget.dart';

class QueriesScreen extends ConsumerStatefulWidget {
  const QueriesScreen({super.key});

  @override
  ConsumerState<QueriesScreen> createState() => _QueriesScreenState();
}

class _QueriesScreenState extends ConsumerState<QueriesScreen> {
  List<QueryModel> _queries = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadQueries();
  }

  Future<void> _loadQueries() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final queries = await ref.read(studentServiceProvider).getQueries();
      if (mounted) setState(() { _queries = queries; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load queries'; _isLoading = false; });
    }
  }

  void _showNewQuerySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _NewQuerySheet(
        onSubmit: (question, subject) async {
          await ref.read(studentServiceProvider).createQuery(
            question: question,
            subject: subject,
          );
          _loadQueries();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Queries')),
      body: _isLoading
          ? const LoadingWidget()
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _loadQueries)
              : _queries.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: _loadQueries,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _queries.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) => _buildQueryCard(_queries[i]),
                      ),
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showNewQuerySheet,
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Ask Query', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _buildQueryCard(QueryModel q) {
    final statusColor = switch (q.status) {
      'answered' => AppTheme.success,
      'closed' => AppTheme.textSecondaryDark,
      _ => AppTheme.warning,
    };
    final statusIcon = switch (q.status) {
      'answered' => Icons.check_circle_outline,
      'closed' => Icons.lock_outline,
      _ => Icons.pending_outlined,
    };

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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(q.question, style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.textPrimaryDark,
                )),
              ),
              const SizedBox(width: 8),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(statusIcon, color: statusColor, size: 16),
                  const SizedBox(width: 4),
                  Text(
                    q.status.toUpperCase(),
                    style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              if (q.subject.isNotEmpty) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(q.subject, style: const TextStyle(color: AppTheme.primary, fontSize: 10, fontWeight: FontWeight.w600)),
                ),
                const SizedBox(width: 8),
              ],
              Text(
                DateFormat('MMM d, yyyy').format(q.createdAt),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
          if (q.answer != null && q.answer!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.success.withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.success.withOpacity(0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.school, color: AppTheme.success, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        q.answeredBy ?? 'Teacher',
                        style: const TextStyle(color: AppTheme.success, fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(q.answer!, style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.textSecondaryDark,
                  )),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.question_answer_outlined, size: 60, color: AppTheme.textSecondaryDark),
          const SizedBox(height: 16),
          Text('No queries yet', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text('Ask your teachers anything!', style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _NewQuerySheet extends StatefulWidget {
  final Future<void> Function(String, String) onSubmit;
  const _NewQuerySheet({required this.onSubmit});

  @override
  State<_NewQuerySheet> createState() => _NewQuerySheetState();
}

class _NewQuerySheetState extends State<_NewQuerySheet> {
  final _questionCtrl = TextEditingController();
  String? _selectedSubject;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _questionCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_questionCtrl.text.trim().isEmpty || _selectedSubject == null) return;
    setState(() => _isSubmitting = true);
    try {
      await widget.onSubmit(_questionCtrl.text.trim(), _selectedSubject!);
      if (mounted) Navigator.pop(context);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
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
          Text('Ask a Query', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            decoration: const InputDecoration(labelText: 'Subject', prefixIcon: Icon(Icons.subject)),
            items: AppConstants.subjects.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
            onChanged: (v) => setState(() => _selectedSubject = v),
            dropdownColor: AppTheme.surfaceDark,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _questionCtrl,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Your question',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Submit Query'),
            ),
          ),
        ],
      ),
    );
  }
}
