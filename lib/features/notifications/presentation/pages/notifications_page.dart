import 'package:flutter/material.dart';
import '../../../../app/router/app_router.dart';
import '../../data/notifications_storage_service.dart';
import '../../domain/models/app_notification_model.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _formatTimeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }

  void _handleNotificationTap(AppNotificationModel notif) {
    NotificationsStorageService.markAsRead(notif.id);

    if (notif.leadId != null && notif.leadId!.isNotEmpty) {
      Navigator.of(context).pushNamed(
        AppRouter.leadDetails,
        arguments: notif.leadId,
      );
    } else if (notif.type == 'whatsapp_message') {
      Navigator.of(context).pushNamed(AppRouter.whatsapp);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Notifications',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 18,
            color: Color(0xFF0F172A),
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 19),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF0F172A)),
            onSelected: (val) {
              if (val == 'read_all') {
                NotificationsStorageService.markAllAsRead();
              } else if (val == 'clear_all') {
                NotificationsStorageService.clearAll();
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                value: 'read_all',
                child: Row(
                  children: [
                    Icon(Icons.done_all_rounded, size: 18, color: Color(0xFF0A5844)),
                    SizedBox(width: 10),
                    Text('Mark all as read'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'clear_all',
                child: Row(
                  children: [
                    Icon(Icons.delete_sweep_rounded, size: 18, color: Color(0xFFEF4444)),
                    SizedBox(width: 10),
                    Text('Clear all notifications'),
                  ],
                ),
              ),
            ],
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFF0A5844),
          unselectedLabelColor: const Color(0xFF64748B),
          indicatorColor: const Color(0xFF0A5844),
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: const [
            Tab(text: 'All'),
            Tab(text: 'Leads'),
            Tab(text: 'WhatsApp'),
          ],
        ),
      ),
      body: ValueListenableBuilder<List<AppNotificationModel>>(
        valueListenable: NotificationsStorageService.notificationsNotifier,
        builder: (context, notifications, _) {
          return TabBarView(
            controller: _tabController,
            children: [
              _buildList(notifications),
              _buildList(notifications.where((n) => n.type == 'lead_assigned').toList()),
              _buildList(notifications.where((n) => n.type == 'whatsapp_message').toList()),
            ],
          );
        },
      ),
    );
  }

  Widget _buildList(List<AppNotificationModel> list) {
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: Color(0xFFDCFCE7),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.notifications_none_rounded,
                  size: 38,
                  color: Color(0xFF0A5844),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'No Notifications Yet',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'You will receive instant alerts here whenever a new lead is assigned or a customer messages you.',
                style: TextStyle(
                  fontSize: 13,
                  color: Color(0xFF64748B),
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
      itemCount: list.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final notif = list[index];
        final isLead = notif.type == 'lead_assigned';
        final isWhatsApp = notif.type == 'whatsapp_message';

        final Color iconBg = isLead
            ? const Color(0xFFDCFCE7)
            : isWhatsApp
                ? const Color(0xFFDCFCE7)
                : const Color(0xFFE0F2FE);

        final Color iconColor = isLead
            ? const Color(0xFF0A5844)
            : isWhatsApp
                ? const Color(0xFF25D366)
                : const Color(0xFF0284C7);

        final IconData icon = isLead
            ? Icons.person_add_rounded
            : isWhatsApp
                ? Icons.chat_bubble_rounded
                : Icons.notifications_rounded;

        return Material(
          color: notif.isRead ? Colors.white : const Color(0xFFF0FDF4),
          borderRadius: BorderRadius.circular(16),
          child: InkWell(
            onTap: () => _handleNotificationTap(notif),
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: notif.isRead ? const Color(0xFFE2E8F0) : const Color(0xFF86EFAC),
                  width: notif.isRead ? 1 : 1.5,
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: iconBg,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, color: iconColor, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                notif.title,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: notif.isRead ? FontWeight.w600 : FontWeight.w800,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                            ),
                            if (!notif.isRead)
                              Container(
                                width: 8,
                                height: 8,
                                margin: const EdgeInsets.only(left: 6),
                                decoration: const BoxDecoration(
                                  color: Color(0xFF0A5844),
                                  shape: BoxShape.circle,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          notif.body,
                          style: TextStyle(
                            fontSize: 12.5,
                            color: const Color(0xFF475569),
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Icon(Icons.schedule_rounded, size: 12, color: const Color(0xFF94A3B8)),
                            const SizedBox(width: 4),
                            Text(
                              _formatTimeAgo(notif.timestamp),
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF94A3B8),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const Spacer(),
                            if (notif.leadId != null && notif.leadId!.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0A5844).withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  'View Lead →',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0A5844),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
