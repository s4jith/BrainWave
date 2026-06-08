import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme.dart';
import '../../services/career_service.dart';
import '../../models/career_model.dart';
import '../../widgets/common/loading_widget.dart';

class SupportScreen extends ConsumerStatefulWidget {
  const SupportScreen({super.key});

  @override
  ConsumerState<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends ConsumerState<SupportScreen> {
  List<SupportTicket> _tickets = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTickets();
  }

  Future<void> _loadTickets() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final tickets = await ref.read(supportServiceProvider).getTickets();
      if (mounted) setState(() { _tickets = tickets; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'Failed to load tickets'; _isLoading = false; });
    }
  }

  void _showNewTicketSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _NewTicketSheet(
        onSubmit: (title, desc, priority) async {
          await ref.read(supportServiceProvider).createTicket(
            title: title,
            description: desc,
            priority: priority,
          );
          _loadTickets();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Support Tickets')),
      body: _isLoading
          ? const LoadingWidget()
          : _error != null
              ? ErrorDisplay(message: _error!, onRetry: _loadTickets)
              : _tickets.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: _loadTickets,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _tickets.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) => _buildTicketCard(_tickets[i]),
                      ),
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showNewTicketSheet,
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Ticket', style: TextStyle(color: Colors.white)),
      ),
    );
  }

  Widget _buildTicketCard(SupportTicket ticket) {
    final statusData = _statusData(ticket.status);
    final priorityColor = _priorityColor(ticket.priority);
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
              Expanded(child: Text(ticket.title, style: Theme.of(context).textTheme.titleMedium)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusData.$2.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusData.$1, color: statusData.$2, size: 12),
                    const SizedBox(width: 4),
                    Text(ticket.status.toUpperCase().replaceAll('_', ' '),
                      style: TextStyle(color: statusData.$2, fontSize: 9, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(ticket.description, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textSecondaryDark), maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 10),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: priorityColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(ticket.priority.toUpperCase(), style: TextStyle(color: priorityColor, fontSize: 9, fontWeight: FontWeight.bold)),
              ),
              const Spacer(),
              Text(DateFormat('MMM d, yyyy').format(ticket.createdAt), style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ],
      ),
    );
  }

  (IconData, Color) _statusData(String status) => switch (status) {
    'resolved' => (Icons.check_circle_outline, AppTheme.success),
    'in_progress' => (Icons.pending_outlined, AppTheme.warning),
    'closed' => (Icons.lock_outline, AppTheme.textSecondaryDark),
    _ => (Icons.fiber_new_outlined, AppTheme.primary),
  };

  Color _priorityColor(String priority) => switch (priority) {
    'high' => AppTheme.error,
    'low' => AppTheme.success,
    _ => AppTheme.warning,
  };

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.support_outlined, size: 60, color: AppTheme.textSecondaryDark),
          const SizedBox(height: 16),
          Text('No support tickets', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text('Create a ticket if you need help', style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _NewTicketSheet extends StatefulWidget {
  final Future<void> Function(String, String, String) onSubmit;
  const _NewTicketSheet({required this.onSubmit});

  @override
  State<_NewTicketSheet> createState() => _NewTicketSheetState();
}

class _NewTicketSheetState extends State<_NewTicketSheet> {
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  String _priority = 'medium';
  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_titleCtrl.text.trim().isEmpty || _descCtrl.text.trim().isEmpty) return;
    setState(() => _isSubmitting = true);
    try {
      await widget.onSubmit(_titleCtrl.text.trim(), _descCtrl.text.trim(), _priority);
      if (mounted) Navigator.pop(context);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('New Support Ticket', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          TextField(controller: _titleCtrl, decoration: const InputDecoration(labelText: 'Title', prefixIcon: Icon(Icons.title))),
          const SizedBox(height: 12),
          TextField(controller: _descCtrl, maxLines: 3, decoration: const InputDecoration(labelText: 'Description', alignLabelWithHint: true)),
          const SizedBox(height: 12),
          Text('Priority', style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 8),
          Row(
            children: ['low', 'medium', 'high'].map((p) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: FilterChip(
                label: Text(p.toUpperCase()),
                selected: _priority == p,
                onSelected: (_) => setState(() => _priority = p),
                selectedColor: (p == 'high' ? AppTheme.error : p == 'medium' ? AppTheme.warning : AppTheme.success).withOpacity(0.2),
              ),
            )).toList(),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _submit,
              child: _isSubmitting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Submit Ticket'),
            ),
          ),
        ],
      ),
    );
  }
}
