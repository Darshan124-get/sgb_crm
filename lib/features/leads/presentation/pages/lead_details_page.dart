import 'package:flutter/material.dart';
import '../../data/lead_service.dart';
import '../../domain/models/lead_detail_model.dart';
import '../widgets/lead_call_logs_tab.dart';
import '../widgets/lead_detail_header.dart';
import '../widgets/lead_detail_tab_bar.dart';
import '../widgets/lead_detail_skeleton.dart';
import '../widgets/lead_extra_details_tab.dart';
import '../widgets/lead_overview_tab.dart';
import '../widgets/lead_purchase_tab.dart';
import '../widgets/lead_timeline_tab.dart';
import '../widgets/crm_order_conversion_wizard.dart';
import '../../../../core/services/telephony_service.dart';
import '../../../whatsapp/whatsapp_navigation_helper.dart';

class LeadDetailsPage extends StatefulWidget {
  final LeadDetailModel? detail;
  final String? leadId;

  const LeadDetailsPage({
    super.key,
    this.detail,
    this.leadId,
  });

  @override
  State<LeadDetailsPage> createState() => _LeadDetailsPageState();
}

class _LeadDetailsPageState extends State<LeadDetailsPage> {
  LeadDetailModel? _detail;
  bool _isLoading = false;
  int _selectedTabIndex = 0;
  final TextEditingController _tagInputController = TextEditingController();
  final TextEditingController _noteInputController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _detail = widget.detail;
    if (_detail == null) {
      _isLoading = true;
      _loadLiveLeadDetails(widget.leadId);
    }
  }

  Future<void> _loadLiveLeadDetails(String? id) async {
    setState(() => _isLoading = true);
    try {
      if (id != null && id.isNotEmpty) {
        final fresh = await LeadService.getLeadById(id);
        if (!mounted) return;
        if (fresh != null) {
          setState(() {
            _detail = fresh;
            _isLoading = false;
          });
          return;
        }
      } else {
        final leads = await LeadService.getLeads(limit: 1);
        if (!mounted) return;
        if (leads.isNotEmpty) {
          final fresh = await LeadService.getLeadById(leads.first.id);
          if (!mounted) return;
          if (fresh != null) {
            setState(() {
              _detail = fresh;
              _isLoading = false;
            });
            return;
          }
        }
      }
      setState(() => _isLoading = false);
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _tagInputController.dispose();
    _noteInputController.dispose();
    super.dispose();
  }

  void _handleAcefoneCall() {
    if (_detail == null) return;
    final messenger = ScaffoldMessenger.of(context);
    final leadName = _detail!.lead.name;
    final leadPhone = _detail!.lead.phone;
    final leadId = _detail!.lead.id;

    messenger.showSnackBar(
      SnackBar(
        content: Text('Dialing $leadName ($leadPhone) via Acefone...'),
        backgroundColor: const Color(0xFF0A5844),
        behavior: SnackBarBehavior.floating,
        action: SnackBarAction(
          label: 'DISCONNECT',
          textColor: const Color(0xFFDCFCE7),
          onPressed: () {
            messenger.hideCurrentSnackBar();
          },
        ),
      ),
    );

    TelephonyService.initiateClickToCall(
      leadId: leadId,
      destinationPhone: leadPhone,
    ).then((result) {
      if (!mounted) return;
      if (result.success) {
        messenger.hideCurrentSnackBar();
        messenger.showSnackBar(
          SnackBar(
            content: Row(
              children: const [
                Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '📞 Acefone Click-to-Call Connected! Your agent phone/extension is ringing now.',
                    style: TextStyle(fontWeight: FontWeight.w700),
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
    if (_detail == null) return;
    final messenger = ScaffoldMessenger.of(context);
    final lead = _detail!.lead;

    messenger.showSnackBar(
      SnackBar(
        content: Text('Opening WhatsApp chat with ${lead.name}...'),
        backgroundColor: const Color(0xFF25D366),
        behavior: SnackBarBehavior.floating,
      ),
    );

    WhatsAppNavigationHelper.openChatForLead(
      context,
      leadId: lead.id,
      phone: lead.phone,
      customerName: lead.name,
      city: lead.city,
      state: lead.state,
      initialNote: lead.notes,
    );
  }

  void _handleConvert() {
    if (_detail == null) return;
    final leadId = _detail!.lead.id;
    CrmOrderConversionWizard.show(
      context,
      lead: _detail!.lead,
      onConverted: () {
        _loadLiveLeadDetails(leadId);
        if (mounted) {
          setState(() => _selectedTabIndex = 3);
        }
      },
      onUpdated: () => _loadLiveLeadDetails(leadId),
    );
  }

  void _openAddTagDialog() {
    if (_detail == null) return;
    final current = _detail!;
    _tagInputController.clear();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Add Tag to Lead'),
        content: TextField(
          controller: _tagInputController,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'e.g. Subsidy Interested, Cotton, Urgent',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final newTag = _tagInputController.text.trim();
              if (newTag.isNotEmpty) {
                setState(() {
                  _detail = LeadDetailModel(
                    lead: current.lead,
                    campaign: current.campaign,
                    language: current.language,
                    assignedTo: current.assignedTo,
                    assignedToAvatar: current.assignedToAvatar,
                    createdOn: current.createdOn,
                    lastContact: current.lastContact,
                    source: current.source,
                    productInterest: current.productInterest,
                    calls: current.calls,
                    timeline: current.timeline,
                    purchaseSummary: current.purchaseSummary,
                    purchases: current.purchases,
                    tags: [...current.tags, newTag],
                  );
                });
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Tag "$newTag" added'),
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0A5844),
              foregroundColor: Colors.white,
            ),
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  void _openNoteDialog() {
    if (_detail == null) return;
    final current = _detail!;
    _noteInputController.clear();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: EdgeInsets.fromLTRB(
          20,
          16,
          20,
          MediaQuery.of(context).viewInsets.bottom + 20,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'Add Note for ${current.lead.name}',
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _noteInputController,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Enter internal notes, customer requirements, or negotiation points...',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () {
                  final noteText = _noteInputController.text.trim();
                  if (noteText.isNotEmpty) {
                    final newTimelineItem = TimelineItem(
                      id: 'tl_note_${DateTime.now().millisecondsSinceEpoch}',
                      title: 'Note Added',
                      description: noteText,
                      time: 'Just now',
                      type: TimelineEventType.noteAdded,
                    );
                    setState(() {
                      _detail = LeadDetailModel(
                        lead: current.lead,
                        campaign: current.campaign,
                        language: current.language,
                        assignedTo: current.assignedTo,
                        assignedToAvatar: current.assignedToAvatar,
                        createdOn: current.createdOn,
                        lastContact: current.lastContact,
                        source: current.source,
                        productInterest: current.productInterest,
                        calls: current.calls,
                        timeline: [newTimelineItem, ...current.timeline],
                        purchaseSummary: current.purchaseSummary,
                        purchases: current.purchases,
                        tags: current.tags,
                      );
                    });
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Note saved to timeline'),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0A5844),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Save Note', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openFollowUpDialog() async {
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 2)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 60)),
    );
    if (pickedDate == null || !mounted) return;

    final pickedTime = await showTimePicker(
      context: context,
      initialTime: const TimeOfDay(hour: 11, minute: 0),
    );
    if (pickedTime == null || !mounted) return;

    final scheduledDateTime = DateTime(
      pickedDate.year,
      pickedDate.month,
      pickedDate.day,
      pickedTime.hour,
      pickedTime.minute,
    );
    final String isoDate = '${scheduledDateTime.year.toString().padLeft(4, '0')}-${scheduledDateTime.month.toString().padLeft(2, '0')}-${scheduledDateTime.day.toString().padLeft(2, '0')} ${scheduledDateTime.hour.toString().padLeft(2, '0')}:${scheduledDateTime.minute.toString().padLeft(2, '0')}:00';

    if (_detail != null) {
      final leadId = _detail!.lead.id;
      try {
        await LeadService.updateLead(leadId, {
          'status': 'followup',
          'next_followup_date': isoDate,
        });
        _loadLiveLeadDetails(leadId);
      } catch (_) {}
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Follow-up scheduled for ${_detail?.lead.name ?? 'Lead'} on ${pickedDate.day}/${pickedDate.month} at ${pickedTime.format(context)} (Status updated to Follow-up)',
          ),
          backgroundColor: const Color(0xFF0A5844),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _openMoreActions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.shopping_cart_checkout_rounded, color: Color(0xFF059669)),
              title: const Text('Convert to Order (Decision Engine)'),
              onTap: () {
                Navigator.pop(context);
                _handleConvert();
              },
            ),
            ListTile(
              leading: const Icon(Icons.share_rounded, color: Color(0xFF0A5844)),
              title: const Text('Share Lead Contact'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Contact vCard shared'), behavior: SnackBarBehavior.floating),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.swap_horiz_rounded, color: Color(0xFF0284C7)),
              title: const Text('Reassign / Handoff Lead'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Lead handoff sheet opened'), behavior: SnackBarBehavior.floating),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.picture_as_pdf_rounded, color: Color(0xFFE11D48)),
              title: const Text('Export Customer Profile (PDF)'),
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Profile PDF downloaded'), behavior: SnackBarBehavior.floating),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _detail == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: const Text(
            'Lead Details',
            style: TextStyle(color: Color(0xFF0F172A), fontSize: 18, fontWeight: FontWeight.w700),
          ),
        ),
        body: const LeadDetailSkeleton(),
      );
    }

    if (_detail == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 20),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: const Text(
            'Lead Details',
            style: TextStyle(color: Color(0xFF0F172A), fontSize: 18, fontWeight: FontWeight.w700),
          ),
        ),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.person_off_outlined, size: 56, color: Color(0xFF94A3B8)),
              const SizedBox(height: 12),
              const Text(
                'No lead details found',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => _loadLiveLeadDetails(widget.leadId),
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Retry'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0A5844),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final currentDetail = _detail!;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Stack(
        children: [
          // Main Scrollable Area
          Column(
            children: [
              // Top Lead Header
              LeadDetailHeader(
                detail: currentDetail,
                onBack: () => Navigator.of(context).pop(),
                onCall: _handleAcefoneCall,
                onWhatsApp: _handleWhatsApp,
                onNote: _openNoteDialog,
                onFollowUp: _openFollowUpDialog,
                onMore: _openMoreActions,
                onOptionsMenu: _openMoreActions,
                onConvert: _handleConvert,
              ),

              if (_isLoading)
                const LinearProgressIndicator(
                  minHeight: 2.5,
                  backgroundColor: Color(0xFFE2E8F0),
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0A5844)),
                ),

              // Animated Tab Bar
              LeadDetailTabBar(
                selectedIndex: _selectedTabIndex,
                onTabSelected: (index) {
                  setState(() => _selectedTabIndex = index);
                },
              ),

              // Active Tab Content with Animated Transition
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 240),
                  transitionBuilder: (child, animation) {
                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween<Offset>(
                          begin: const Offset(0.03, 0),
                          end: Offset.zero,
                        ).animate(animation),
                        child: child,
                      ),
                    );
                  },
                  child: _buildCurrentTab(),
                ),
              ),
            ],
          ),

          // Sticky Bottom "Click to Call" button
          Positioned(
            left: 16,
            right: 16,
            bottom: 20,
            child: SafeArea(
              top: false,
              child: ElevatedButton.icon(
                onPressed: _handleAcefoneCall,
                icon: const Icon(Icons.phone_in_talk_rounded, color: Colors.white, size: 21),
                label: const Text(
                  'Click to Call',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.2,
                    color: Colors.white,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0A5844),
                  elevation: 8,
                  shadowColor: const Color(0xFF0A5844).withValues(alpha: 0.45),
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentTab() {
    if (_detail == null) return const SizedBox.shrink();
    switch (_selectedTabIndex) {
      case 0:
        return LeadOverviewTab(
          key: const ValueKey('tab_overview'),
          detail: _detail!,
          onAddTagPressed: _openAddTagDialog,
          onViewAllCalls: () => setState(() => _selectedTabIndex = 2), // Switch to Call Logs
          onCallPressed: _handleAcefoneCall,
        );
      case 1:
        return LeadTimelineTab(
          key: const ValueKey('tab_timeline'),
          detail: _detail!,
          onViewAllPurchases: () => setState(() => _selectedTabIndex = 3), // Switch to Purchase
        );
      case 2:
        return LeadCallLogsTab(
          key: const ValueKey('tab_call_logs'),
          detail: _detail!,
        );
      case 3:
        return LeadPurchaseTab(
          key: const ValueKey('tab_purchase'),
          detail: _detail!,
        );
      case 4:
        return LeadExtraDetailsTab(
          key: const ValueKey('tab_extra_details'),
          detail: _detail!,
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
