import 'package:flutter/material.dart';
import '../../../../core/services/telephony_service.dart';
import '../../../whatsapp/whatsapp_navigation_helper.dart';
import '../../data/lead_service.dart';
import '../../domain/models/lead_model.dart';
import 'crm_order_conversion_wizard.dart';

class LeadDetailBottomSheet extends StatefulWidget {
  final LeadModel lead;
  final ValueChanged<LeadStatus>? onStatusChanged;
  final VoidCallback? onCall;
  final VoidCallback? onWhatsApp;
  final VoidCallback? onSchedule;
  final Function(String note)? onNoteAdded;
  final VoidCallback? onConverted;
  final VoidCallback? onUpdated;

  const LeadDetailBottomSheet({
    super.key,
    required this.lead,
    this.onStatusChanged,
    this.onCall,
    this.onWhatsApp,
    this.onSchedule,
    this.onNoteAdded,
    this.onConverted,
    this.onUpdated,
  });

  @override
  State<LeadDetailBottomSheet> createState() => _LeadDetailBottomSheetState();
}

class _LeadDetailBottomSheetState extends State<LeadDetailBottomSheet> {
  late String _currentNotes;
  late String _currentFollowUp;
  late LeadStatus _currentStatus;

  @override
  void initState() {
    super.initState();
    _currentNotes = widget.lead.notes.isNotEmpty
        ? widget.lead.notes
        : (widget.lead.firstMessage.isNotEmpty ? widget.lead.firstMessage : 'hi');
    _currentFollowUp = widget.lead.nextFollowUpFormatted;
    _currentStatus = widget.lead.status;
  }

  void _handleCall() {
    final messenger = ScaffoldMessenger.of(context);
    final leadName = widget.lead.name;
    final leadPhone = widget.lead.phone;
    final leadId = widget.lead.id;
    Navigator.pop(context);
    widget.onCall?.call();
    messenger.showSnackBar(
      SnackBar(
        content: Text('Dialing $leadName ($leadPhone) via Acefone...'),
        backgroundColor: const Color(0xFF0A5844),
        behavior: SnackBarBehavior.floating,
      ),
    );

    TelephonyService.initiateClickToCall(
      leadId: leadId,
      destinationPhone: leadPhone,
    ).then((result) {
      if (result.success) {
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '📞 Acefone Click-to-Call Connected! Your agent phone/extension is ringing now.',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            backgroundColor: const Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    });
  }

  void _handleWhatsApp() {
    final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    final lead = widget.lead;
    Navigator.pop(context);
    if (widget.onWhatsApp != null) {
      widget.onWhatsApp!.call();
    } else {
      WhatsAppNavigationHelper.openChatForLeadWithNavigator(
        nav,
        leadId: lead.id,
        phone: lead.phone,
        customerName: lead.name,
        city: lead.city,
        state: lead.state,
        initialNote: lead.notes,
      );
    }
    messenger.showSnackBar(
      SnackBar(
        content: Text('Opening WhatsApp chat with ${lead.name}...'),
        backgroundColor: const Color(0xFF25D366),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _handleAddNoteDialog() async {
    final messenger = ScaffoldMessenger.of(context);
    final noteController = TextEditingController();
    await showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            const Icon(Icons.note_add_rounded, color: Color(0xFF0A5844), size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Add Note for ${widget.lead.name}',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        content: TextField(
          controller: noteController,
          maxLines: 4,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Enter lead notes, call discussion, or remarks...',
            hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF0A5844), width: 1.5),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            onPressed: () {
              final newNote = noteController.text.trim();
              if (newNote.isNotEmpty) {
                if (mounted) {
                  setState(() {
                    _currentNotes = newNote;
                  });
                }
                widget.onNoteAdded?.call(newNote);
                Navigator.pop(dialogCtx);
                messenger.showSnackBar(
                  SnackBar(
                    content: Text('Note added to ${widget.lead.name}'),
                    backgroundColor: const Color(0xFF0A5844),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0A5844),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Save Note'),
          ),
        ],
      ),
    );
  }

  void _handleConvert() {
    Navigator.of(context).pop();
    CrmOrderConversionWizard.show(
      context,
      lead: widget.lead,
      onConverted: widget.onConverted,
      onUpdated: widget.onUpdated,
    );
  }

  String _getStatusLabel(LeadStatus st) {
    switch (st) {
      case LeadStatus.newLead:
        return 'New';
      case LeadStatus.followUp:
        return 'Follow-up';
      case LeadStatus.interested:
        return 'Interested';
      case LeadStatus.contacted:
        return 'Call Connected';
      case LeadStatus.callback:
        return 'Callback';
      case LeadStatus.converted:
        return 'Converted';
      case LeadStatus.lost:
        return 'Lost';
    }
  }

  Color _getStatusBgColor(LeadStatus st) {
    switch (st) {
      case LeadStatus.newLead:
        return const Color(0xFFDCFCE7);
      case LeadStatus.followUp:
        return const Color(0xFFFFEDD5);
      case LeadStatus.interested:
        return const Color(0xFFF3E8FF);
      case LeadStatus.contacted:
        return const Color(0xFFE0F2FE);
      case LeadStatus.callback:
        return const Color(0xFFFEF3C7);
      case LeadStatus.converted:
        return const Color(0xFFD1FAE5);
      case LeadStatus.lost:
        return const Color(0xFFFEE2E2);
    }
  }

  Color _getStatusTextColor(LeadStatus st) {
    switch (st) {
      case LeadStatus.newLead:
        return const Color(0xFF166534);
      case LeadStatus.followUp:
        return const Color(0xFFC2410C);
      case LeadStatus.interested:
        return const Color(0xFF7E22CE);
      case LeadStatus.contacted:
        return const Color(0xFF0369A1);
      case LeadStatus.callback:
        return const Color(0xFFB45309);
      case LeadStatus.converted:
        return const Color(0xFF047857);
      case LeadStatus.lost:
        return const Color(0xFFB91C1C);
    }
  }

  Future<void> _updateLeadStatus(LeadStatus newStatus, {String? notes}) async {
    setState(() => _currentStatus = newStatus);
    widget.onStatusChanged?.call(newStatus);

    String backendStatus = 'new';
    switch (newStatus) {
      case LeadStatus.newLead:
        backendStatus = 'new';
        break;
      case LeadStatus.followUp:
        backendStatus = 'followup';
        break;
      case LeadStatus.contacted:
        backendStatus = 'contacted';
        break;
      case LeadStatus.callback:
        backendStatus = 'callback';
        break;
      case LeadStatus.interested:
        backendStatus = 'interested';
        break;
      case LeadStatus.converted:
        backendStatus = 'converted';
        break;
      case LeadStatus.lost:
        backendStatus = 'lost';
        break;
    }

    try {
      final payload = <String, dynamic>{'status': backendStatus};
      if (notes != null && notes.isNotEmpty) {
        payload['notes'] = notes;
      }
      if (newStatus == LeadStatus.callback) {
        payload['call_count'] = (widget.lead.callCount + 1);
      }
      await LeadService.updateLead(widget.lead.id, payload);
      widget.onUpdated?.call();
    } catch (_) {}

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Lead status updated to ${_getStatusLabel(newStatus)}'),
          backgroundColor: const Color(0xFF0A5844),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _openChangeStatusDialog() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Row(
                  children: [
                    Icon(Icons.tune_rounded, size: 20, color: Color(0xFF0A5844)),
                    SizedBox(width: 8),
                    Text('Update Lead Status', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  ],
                ),
              ),
              const Divider(),
              ...[
                LeadStatus.newLead,
                LeadStatus.followUp,
                LeadStatus.contacted,
                LeadStatus.callback,
                LeadStatus.interested,
                LeadStatus.converted,
                LeadStatus.lost,
              ].map((st) {
                final isSelected = st == _currentStatus;
                return ListTile(
                  leading: Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: _getStatusBgColor(st),
                      border: Border.all(color: _getStatusTextColor(st), width: 2),
                      shape: BoxShape.circle,
                    ),
                  ),
                  title: Text(
                    _getStatusLabel(st),
                    style: TextStyle(
                      fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                      color: isSelected ? const Color(0xFF0A5844) : const Color(0xFF1E293B),
                    ),
                  ),
                  trailing: isSelected ? const Icon(Icons.check_circle_rounded, color: Color(0xFF0A5844), size: 20) : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    if (st == LeadStatus.followUp) {
                      _handleSchedulePicker();
                    } else {
                      _updateLeadStatus(st);
                    }
                  },
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleSchedulePicker() async {
    final messenger = ScaffoldMessenger.of(context);
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF0A5844),
            onPrimary: Colors.white,
            onSurface: Color(0xFF0F172A),
          ),
        ),
        child: child!,
      ),
    );

    if (pickedDate == null || !mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 10, minute: 0),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
            primary: Color(0xFF0A5844),
            onPrimary: Colors.white,
            onSurface: Color(0xFF0F172A),
          ),
        ),
        child: child!,
      ),
    );

    if (pickedTime == null || !mounted) return;

    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final hour = pickedTime.hourOfPeriod == 0 ? 12 : pickedTime.hourOfPeriod;
    final amPm = pickedTime.period == DayPeriod.am ? 'AM' : 'PM';
    final minuteStr = pickedTime.minute.toString().padLeft(2, '0');
    final formatted = '${pickedDate.day} ${months[pickedDate.month - 1]} ${pickedDate.year}, $hour:$minuteStr $amPm';

    final scheduledDateTime = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime.hour,
      pickedTime.minute,
    );
    final String isoDate = '${scheduledDateTime.year.toString().padLeft(4, '0')}-${scheduledDateTime.month.toString().padLeft(2, '0')}-${scheduledDateTime.day.toString().padLeft(2, '0')} ${scheduledDateTime.hour.toString().padLeft(2, '0')}:${scheduledDateTime.minute.toString().padLeft(2, '0')}:00';

    setState(() {
      _currentFollowUp = formatted;
      _currentStatus = LeadStatus.followUp;
    });

    try {
      await LeadService.updateLead(widget.lead.id, {
        'status': 'followup',
        'next_followup_date': isoDate,
      });
      widget.onStatusChanged?.call(LeadStatus.followUp);
      widget.onUpdated?.call();
    } catch (_) {}

    widget.onSchedule?.call();

    messenger.showSnackBar(
      SnackBar(
        content: Text('Next follow-up set for ${widget.lead.name}: $formatted (Status updated to Follow-up)'),
        backgroundColor: const Color(0xFF0A5844),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _handleViewCompleteDetails() {
    final nav = Navigator.of(context);
    final leadId = widget.lead.id;
    Navigator.pop(context);
    nav.pushNamed('/lead-details', arguments: leadId);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.90,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top Drag Handle Bar
            Center(
              child: Container(
                width: 40,
                height: 4.5,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),

            // Scrollable Lead Details Content
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 1. Profile Header Row
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Avatar Circle (TJ)
                        Container(
                          width: 52,
                          height: 52,
                          decoration: const BoxDecoration(
                            color: Color(0xFFDCFCE7), // soft light green
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(
                              widget.lead.initials,
                              style: const TextStyle(
                                color: Color(0xFF0F172A),
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.lead.name,
                                style: const TextStyle(
                                  color: Color(0xFF0F172A),
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const SizedBox(height: 3),
                              // Phone row with call & whatsapp icon
                              Row(
                                children: [
                                  const Icon(
                                    Icons.phone_rounded,
                                    size: 15,
                                    color: Color(0xFF475569),
                                  ),
                                  const SizedBox(width: 6),
                                  Flexible(
                                    child: GestureDetector(
                                      onTap: _handleCall,
                                      child: Text(
                                        widget.lead.phone,
                                        style: const TextStyle(
                                          color: Color(0xFF334155),
                                          fontSize: 13.5,
                                          fontWeight: FontWeight.w600,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  GestureDetector(
                                    onTap: _handleWhatsApp,
                                    child: const Icon(
                                      Icons.chat_rounded,
                                      size: 16,
                                      color: Color(0xFF25D366),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 3),
                              // Message preview (chat bubble + note)
                              Row(
                                children: [
                                  const Icon(
                                    Icons.chat_bubble_outline_rounded,
                                    size: 14,
                                    color: Color(0xFF64748B),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      _currentNotes,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: Color(0xFF64748B),
                                        fontSize: 12.5,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        // Status Badge (New)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: _getStatusBgColor(_currentStatus),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            _getStatusLabel(_currentStatus),
                            style: TextStyle(
                              color: _getStatusTextColor(_currentStatus),
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 18),

                    // 2. Status / Priority / Score Cards (3 in a Row)
                    Row(
                      children: [
                        // Status Card
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                const Text(
                                  'Status',
                                  style: TextStyle(
                                    color: Color(0xFF64748B),
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                GestureDetector(
                                  onTap: _openChangeStatusDialog,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: _getStatusBgColor(_currentStatus),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          _getStatusLabel(_currentStatus),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: _getStatusTextColor(_currentStatus),
                                            fontSize: 11.5,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(width: 2),
                                        Icon(
                                          Icons.arrow_drop_down_rounded,
                                          size: 15,
                                          color: _getStatusTextColor(_currentStatus),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),

                        // Priority Card (Chatbot Progress Steps: 1/5, 2/5, 3/5, 4/5, 5/5)
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                const Text(
                                  'Priority',
                                  style: TextStyle(
                                    color: Color(0xFF64748B),
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        Icons.cloud_rounded,
                                        size: 13,
                                        color: Color(0xFFD97706),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        widget.lead.priorityDisplay,
                                        style: const TextStyle(
                                          color: Color(0xFFD97706),
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),

                        // Score Card (Telecaller Web CRM Score: High, Mid, Low)
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                const Text(
                                  'Score',
                                  style: TextStyle(
                                    color: Color(0xFF64748B),
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: _getScoreBgColor(widget.lead.scoreDisplay),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    widget.lead.scoreDisplay,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: _getScoreTextColor(widget.lead.scoreDisplay),
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 18),

                    // 3. Created On & Next Follow-up (Two Columns)
                    Row(
                      children: [
                        // Created On
                        Expanded(
                          child: Row(
                            children: [
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(
                                  Icons.calendar_month_outlined,
                                  size: 19,
                                  color: Color(0xFF475569),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Created On',
                                      style: TextStyle(
                                        color: Color(0xFF64748B),
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    const SizedBox(height: 1),
                                    Text(
                                      widget.lead.createdOnFormatted,
                                      style: const TextStyle(
                                        color: Color(0xFF0F172A),
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),

                        // Next Follow-up
                        Expanded(
                          child: Row(
                            children: [
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: (_currentStatus == LeadStatus.followUp || _currentFollowUp.isNotEmpty)
                                      ? const Color(0xFFFEE2E2)
                                      : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(
                                  Icons.calendar_month_outlined,
                                  size: 19,
                                  color: (_currentStatus == LeadStatus.followUp || _currentFollowUp.isNotEmpty)
                                      ? const Color(0xFFDC2626)
                                      : const Color(0xFF475569),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Next Follow-up',
                                      style: TextStyle(
                                        color: Color(0xFF64748B),
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                    const SizedBox(height: 1),
                                    Text(
                                      _currentFollowUp,
                                      style: TextStyle(
                                        color: (_currentStatus == LeadStatus.followUp || _currentFollowUp.isNotEmpty)
                                            ? const Color(0xFFDC2626)
                                            : const Color(0xFF0F172A),
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 18),

                    // 4. Message Box
                    Row(
                      children: const [
                        Icon(Icons.chat_bubble_outline_rounded, size: 15, color: Color(0xFF334155)),
                        SizedBox(width: 6),
                        Text(
                          'Message',
                          style: TextStyle(
                            color: Color(0xFF0F172A),
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Text(
                        _currentNotes,
                        style: const TextStyle(
                          color: Color(0xFF334155),
                          fontSize: 13.5,
                          height: 1.4,
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // 5. Action Buttons (3 in a row: Call Lead, WhatsApp, Add Note)
                    Row(
                      children: [
                        // Call Lead
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _handleCall,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0A5844),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 0,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.phone_rounded, size: 15),
                                SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    'Call Lead',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),

                        // WhatsApp
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _handleWhatsApp,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF0A5844),
                              side: const BorderSide(color: Color(0xFF0A5844), width: 1.2),
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.chat_rounded, size: 15, color: Color(0xFF25D366)),
                                SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    'WhatsApp',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),

                        // Convert Button
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _handleConvert,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF059669),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 0,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Icon(Icons.shopping_cart_checkout_rounded, size: 15, color: Colors.white),
                                SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    'Convert',
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),

                    // 6. Schedule Next Follow-up Full Width Button
                    OutlinedButton(
                      onPressed: _handleSchedulePicker,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF334155),
                        side: const BorderSide(color: Color(0xFFE2E8F0), width: 1.2),
                        minimumSize: const Size(double.infinity, 44),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.calendar_month_outlined, size: 17, color: Color(0xFF334155)),
                          SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              'Schedule Next Follow-up',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 18),

                    // 7. Metadata Rows (Campaign, Lead Source, Product Interest, Assigned Staff)
                    _buildMetadataRow(
                      icon: Icons.campaign_outlined,
                      label: 'Campaign',
                      value: widget.lead.campaign.isNotEmpty ? widget.lead.campaign : '-',
                    ),
                    _buildMetadataRow(
                      icon: Icons.track_changes_rounded,
                      label: 'Lead Source',
                      value: widget.lead.leadSource.isNotEmpty ? widget.lead.leadSource : '-',
                    ),
                    _buildMetadataRow(
                      icon: Icons.inventory_2_outlined,
                      label: 'Product Interest',
                      value: widget.lead.productInterest.isNotEmpty ? widget.lead.productInterest : '-',
                    ),
                    _buildAssignedStaffRow(
                      name: widget.lead.assignedStaff.isNotEmpty
                          ? widget.lead.assignedStaff
                          : 'darshan_acefone_test_2',
                    ),

                    const SizedBox(height: 20),

                    // 8. View Complete Lead Details & Timeline Button
                    ElevatedButton(
                      onPressed: _handleViewCompleteDetails,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0A5844),
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 48),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.assignment_outlined, size: 18),
                          SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              'View Complete Lead Details & Timeline',
                              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          SizedBox(width: 6),
                          Icon(Icons.chevron_right_rounded, size: 20),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetadataRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 16, color: const Color(0xFF64748B)),
          const SizedBox(width: 10),
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF475569),
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.start,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Color(0xFF0F172A),
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAssignedStaffRow({required String name}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          const Icon(Icons.person_outline_rounded, size: 16, color: Color(0xFF64748B)),
          const SizedBox(width: 10),
          const SizedBox(
            width: 120,
            child: Text(
              'Assigned Staff',
              style: TextStyle(
                color: Color(0xFF475569),
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          // Small staff avatar circle + name
          Container(
            width: 24,
            height: 24,
            decoration: const BoxDecoration(
              color: Color(0xFF0A5844),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: Icon(Icons.person, size: 15, color: Colors.white),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Color(0xFF0F172A),
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _getScoreBgColor(String score) {
    final s = score.toLowerCase();
    if (s == 'high' || s.contains('hot')) return const Color(0xFFDCFCE7);
    if (s == 'mid' || s == 'medium' || s.contains('warm') || s.contains('mild')) return const Color(0xFFEFF6FF);
    return const Color(0xFFF1F5F9);
  }

  Color _getScoreTextColor(String score) {
    final s = score.toLowerCase();
    if (s == 'high' || s.contains('hot')) return const Color(0xFF166534);
    if (s == 'mid' || s == 'medium' || s.contains('warm') || s.contains('mild')) return const Color(0xFF2563EB);
    return const Color(0xFF64748B);
  }
}
