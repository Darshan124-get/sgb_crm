import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/models/lead_model.dart';

class CrmOrderConversionWizard extends StatefulWidget {
  final LeadModel lead;
  final VoidCallback? onConverted;
  final VoidCallback? onUpdated;

  const CrmOrderConversionWizard({
    super.key,
    required this.lead,
    this.onConverted,
    this.onUpdated,
  });

  static Future<void> show(
    BuildContext context, {
    required LeadModel lead,
    VoidCallback? onConverted,
    VoidCallback? onUpdated,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CrmOrderConversionWizard(
        lead: lead,
        onConverted: onConverted,
        onUpdated: onUpdated,
      ),
    );
  }

  @override
  State<CrmOrderConversionWizard> createState() => _CrmOrderConversionWizardState();
}

class _ProductItem {
  final int id;
  final String name;
  final double price;
  final bool isSet;
  final String? setDetails;
  final List<Map<String, dynamic>> setItems;
  int quantity;
  bool isSelected;

  _ProductItem({
    required this.id,
    required this.name,
    required this.price,
    this.isSet = false,
    this.setDetails,
    this.setItems = const [],
    this.quantity = 1,
    this.isSelected = false,
  });
}

class _DealerManager {
  final String id;
  final String name;

  _DealerManager({required this.id, required this.name});
}

class _CrmOrderConversionWizardState extends State<CrmOrderConversionWizard> {
  int _currentStep = 1;
  String _leadPath = 'connected'; // 'connected', 'quick_order', 'not_connected', 'not_interested'

  // Step 1: Call Status
  late final TextEditingController _phoneController;
  String _selectedCallStatus = '';
  final List<String> _callStatuses = [
    'Received',
    'Not Received',
    'Switched Off',
    'Busy',
    'Not Reachable',
    'Not Interested',
    'Booked',
    'WhatsApp',
  ];

  // Step 2: Customer Details
  late final TextEditingController _nameController;
  late final TextEditingController _villageController;
  late final TextEditingController _stateController;
  late final TextEditingController _districtController;
  late final TextEditingController _pincodeController;
  String _selectedLanguage = 'English';
  final List<String> _languages = [
    'English',
    'Kannada',
    'Hindi',
    'Marathi',
    'Telugu',
    'Tamil',
    'Malayalam',
    'Other',
  ];

  // Step 3: Decision & Sales Status
  String _selectedSalesStatus = '';
  final List<String> _salesStatuses = [
    'Ordered',
    'Hot / Very Interested',
    'Mild / Later',
    'Cold / Not Interested',
    'Old Purchased',
    'Dealer',
  ];

  // Subform: Follow-up
  DateTime _followUpDate = DateTime.now().add(const Duration(days: 1, hours: 2));
  String _followUpAction = 'Call Again';
  final List<String> _followUpActions = [
    'Call Again',
    'Send Video',
    'Send Price',
    'After Harvest',
    'Discuss with Family',
    'Koppa Visit',
  ];
  final TextEditingController _followUpNotesController = TextEditingController();

  // Subform: Cold / Reason
  String _lostReason = 'High Price';
  final List<String> _lostReasons = [
    'High Price',
    'Bought competitor',
    'Not required now',
    'Other',
  ];
  final TextEditingController _lostNotesController = TextEditingController();

  // Subform: Old Purchased Feedback
  String _feedbackSatisfaction = 'Happy';
  final List<String> _feedbackOptions = ['Happy', 'Okay', 'Not Satisfied'];
  final TextEditingController _feedbackNotesController = TextEditingController();

  // Subform: Not Connected Log
  String _ncAttempt = '1st Attempt';
  final List<String> _ncAttempts = ['1st Attempt', '2nd Attempt', '3rd Attempt'];
  DateTime _ncDate = DateTime.now().add(const Duration(days: 1));
  final TextEditingController _ncNotesController = TextEditingController();

  // Subform: Dealer
  String? _selectedDealerManagerId;
  List<_DealerManager> _dealerManagers = [];
  bool _isLoadingDealers = false;
  final TextEditingController _dealerNotesController = TextEditingController();

  // Step 4: Product Selection & Order
  List<_ProductItem> _products = [];
  bool _isLoadingProducts = true;
  final TextEditingController _totalAmountController = TextEditingController(text: '0');
  final TextEditingController _discountController = TextEditingController(text: '0');
  final TextEditingController _finalAmountController = TextEditingController(text: '0');
  final TextEditingController _advanceController = TextEditingController(text: '0');
  final TextEditingController _dueAmountController = TextEditingController(text: '0');
  String _deliveryType = 'Post office COD';
  final List<String> _deliveryTypes = [
    'Post office COD',
    'VRL COD',
    'third party',
    'other',
  ];
  final TextEditingController _otherDeliveryController = TextEditingController();
  File? _screenshotFile;

  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _phoneController = TextEditingController(text: widget.lead.phone);
    _nameController = TextEditingController(text: widget.lead.name.replaceFirst(RegExp(r'^Lead #\d+'), ''));
    _villageController = TextEditingController(
      text: widget.lead.village.isNotEmpty ? widget.lead.village : (widget.lead.city != 'Rural' ? widget.lead.city : ''),
    );
    _stateController = TextEditingController(
      text: widget.lead.state.isNotEmpty && widget.lead.state != 'India' ? widget.lead.state : 'Karnataka',
    );
    _districtController = TextEditingController(
      text: widget.lead.district.isNotEmpty ? widget.lead.district : (widget.lead.city != 'Rural' ? widget.lead.city : ''),
    );
    _pincodeController = TextEditingController(text: widget.lead.pincode);

    // Initial attempt calculation
    final currentCount = widget.lead.callCount;
    final nextAttemptNum = (currentCount + 1).clamp(1, 3);
    _ncAttempt = '$nextAttemptNum${nextAttemptNum == 1 ? "st" : (nextAttemptNum == 2 ? "nd" : "rd")} Attempt';

    _loadInitialData();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _nameController.dispose();
    _villageController.dispose();
    _stateController.dispose();
    _districtController.dispose();
    _pincodeController.dispose();
    _followUpNotesController.dispose();
    _lostNotesController.dispose();
    _feedbackNotesController.dispose();
    _ncNotesController.dispose();
    _dealerNotesController.dispose();
    _totalAmountController.dispose();
    _discountController.dispose();
    _finalAmountController.dispose();
    _advanceController.dispose();
    _dueAmountController.dispose();
    _otherDeliveryController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    _loadProductsAndSets();
    _loadDealerManagers();
  }

  Future<void> _loadProductsAndSets() async {
    setState(() => _isLoadingProducts = true);
    final List<_ProductItem> items = [];

    try {
      // 1. Fetch Product Sets / Bundles
      final setsRes = await ApiClient.get('product-sets');
      if (setsRes.isSuccess && setsRes.data is List) {
        for (final s in setsRes.data) {
          final sName = s['name']?.toString() ?? 'Bundle Set';
          final sId = int.tryParse(s['set_id']?.toString() ?? '') ?? 0;
          final setItems = (s['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
          double total = 0;
          final List<String> descParts = [];
          for (final it in setItems) {
            final pPrice = double.tryParse(it['selling_price']?.toString() ?? '0') ?? 0;
            final pQty = int.tryParse(it['quantity']?.toString() ?? '1') ?? 1;
            total += pPrice * pQty;
            final pName = it['product_name']?.toString() ?? 'Item';
            descParts.add('$pName (x$pQty)');
          }
          items.add(
            _ProductItem(
              id: sId,
              name: sName,
              price: total,
              isSet: true,
              setDetails: descParts.join(', '),
              setItems: setItems,
            ),
          );
        }
      }

      // 2. Fetch standalone products
      final prodRes = await ApiClient.get('products');
      if (prodRes.isSuccess && prodRes.data is List) {
        for (final p in prodRes.data) {
          final pId = int.tryParse(p['product_id']?.toString() ?? '') ?? 0;
          final pName = p['name']?.toString() ?? 'Product';
          final pPrice = double.tryParse(p['selling_price']?.toString() ?? '0') ?? 0;
          items.add(
            _ProductItem(
              id: pId,
              name: pName,
              price: pPrice,
            ),
          );
        }
      }
    } catch (_) {}

    // Fallbacks if backend catalog is empty or unreachable
    if (items.isEmpty) {
      items.addAll([
        _ProductItem(
          id: 1,
          name: 'F1',
          price: 8100,
          isSet: true,
          setDetails: 'Back Pack Trolley (x1), Side Pack Trolley (x1)',
          setItems: [
            {'product_id': 16, 'product_name': 'Back Pack Trolley', 'quantity': 1, 'selling_price': 4300},
            {'product_id': 14, 'product_name': 'Side Pack Trolley', 'quantity': 1, 'selling_price': 3800},
          ],
        ),
        _ProductItem(id: 14, name: 'Side Pack Trolley', price: 3800),
        _ProductItem(id: 15, name: 'Blade Protector', price: 600),
        _ProductItem(id: 16, name: 'Back Pack Trolley', price: 4300),
        _ProductItem(id: 30, name: 'Dumper Wheel barrow', price: 8500),
        _ProductItem(id: 28, name: 'Normal Wheel Borrow', price: 7000),
        _ProductItem(id: 27, name: 'Brush cutter & Trolley 12K', price: 12000),
        _ProductItem(id: 26, name: 'Brush Cutter 16k', price: 16000),
        _ProductItem(id: 25, name: 'Brush cutter & trolley 21k', price: 21000),
        _ProductItem(id: 31, name: 'Rope roller', price: 1000),
        _ProductItem(id: 50, name: 'SGB - Dumper', price: 0),
      ]);
    }

    if (mounted) {
      setState(() {
        _products = items;
        _isLoadingProducts = false;
      });
    }
  }

  Future<void> _loadDealerManagers() async {
    setState(() => _isLoadingDealers = true);
    final List<_DealerManager> list = [];
    try {
      final res = await ApiClient.get('users');
      if (res.isSuccess && res.data is List) {
        for (final u in res.data) {
          final role = (u['role_name'] ?? u['role'] ?? '').toString().toLowerCase();
          if (role.contains('dealer') || role.contains('manager') || role == 'admin') {
            final uid = (u['user_id'] ?? u['id'])?.toString() ?? '';
            final uname = u['name']?.toString() ?? 'User $uid';
            if (uid.isNotEmpty) {
              list.add(_DealerManager(id: uid, name: uname));
            }
          }
        }
      }
    } catch (_) {}

    if (list.isEmpty) {
      list.addAll([
        _DealerManager(id: '77', name: 'D TEST3'),
        _DealerManager(id: '83', name: 'ABHIJITH'),
        _DealerManager(id: '84', name: 'venkat'),
      ]);
    }

    if (mounted) {
      setState(() {
        _dealerManagers = list;
        _isLoadingDealers = false;
        if (list.isNotEmpty && _selectedDealerManagerId == null) {
          _selectedDealerManagerId = list.first.id;
        }
      });
    }
  }

  void _handleCallStatusSelected(String status) {
    setState(() {
      _selectedCallStatus = status;
      if (status == 'Received' || status == 'Booked') {
        _leadPath = status == 'Booked' ? 'quick_order' : 'connected';
      } else if (status == 'Not Interested') {
        _leadPath = 'not_interested';
      } else {
        _leadPath = 'not_connected';
      }
    });

    // Auto advance smoothly
    Future.delayed(const Duration(milliseconds: 250), () {
      if (mounted) _goToNextStep();
    });
  }

  void _handleSalesStatusSelected(String status) {
    setState(() {
      _selectedSalesStatus = status;
    });

    if (status == 'Ordered') {
      _calculateOrderAmounts();
      Future.delayed(const Duration(milliseconds: 250), () {
        if (mounted) _goToStep(4);
      });
    }
  }

  void _goToStep(int step) {
    setState(() => _currentStep = step);
  }

  void _goToNextStep() {
    if (_currentStep == 1) {
      if (_selectedCallStatus.isEmpty) {
        _showToast('Please select a Call Status');
        return;
      }
      if (_leadPath == 'not_connected') {
        _goToStep(3); // skip straight to connection log
        return;
      }
      _goToStep(2);
    } else if (_currentStep == 2) {
      _goToStep(3);
    } else if (_currentStep == 3) {
      if (_selectedSalesStatus == 'Ordered') {
        _calculateOrderAmounts();
        _goToStep(4);
      }
    }
  }

  void _goToPrevStep() {
    if (_currentStep == 4) {
      _goToStep(3);
    } else if (_currentStep == 3) {
      if (_leadPath == 'not_connected') {
        _goToStep(1);
      } else {
        _goToStep(2);
      }
    } else if (_currentStep == 2) {
      _goToStep(1);
    }
  }

  void _toggleProduct(_ProductItem item) {
    setState(() {
      item.isSelected = !item.isSelected;
      if (!item.isSelected) {
        item.quantity = 1;
      }
      _calculateOrderAmounts();
    });
  }

  void _updateQuantity(_ProductItem item, int delta) {
    setState(() {
      final newQty = item.quantity + delta;
      if (newQty >= 1) {
        item.quantity = newQty;
        _calculateOrderAmounts();
      }
    });
  }

  void _calculateOrderAmounts() {
    double total = 0;
    for (final p in _products) {
      if (p.isSelected) {
        total += p.price * p.quantity;
      }
    }
    _totalAmountController.text = total.round().toString();
    _recalculateFinalAndDue();
  }

  void _recalculateFinalAndDue() {
    final total = double.tryParse(_totalAmountController.text.trim()) ?? 0;
    final discount = double.tryParse(_discountController.text.trim()) ?? 0;
    final advance = double.tryParse(_advanceController.text.trim()) ?? 0;

    final finalAmt = (total - discount).clamp(0, double.infinity);
    final dueAmt = (finalAmt - advance).clamp(0, double.infinity);

    _finalAmountController.text = finalAmt.round().toString();
    _dueAmountController.text = dueAmt.round().toString();
  }

  Future<void> _pickScreenshot(ImageSource source) async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: source, imageQuality: 80);
      if (picked != null) {
        setState(() {
          _screenshotFile = File(picked.path);
        });
      }
    } catch (e) {
      _showToast('Failed to pick image: $e');
    }
  }

  Future<void> _lookupPincode(String pin) async {
    if (pin.length == 6 && RegExp(r'^\d{6}$').hasMatch(pin)) {
      try {
        final client = HttpClient();
        final req = await client.getUrl(Uri.parse('https://api.postalpincode.in/pincode/$pin'));
        final res = await req.close();
        if (res.statusCode == 200) {
          final body = await res.transform(utf8.decoder).join();
          final data = jsonDecode(body);
          if (data is List && data.isNotEmpty && data[0]['Status'] == 'Success') {
            final postOffices = data[0]['PostOffice'] as List?;
            if (postOffices != null && postOffices.isNotEmpty) {
              final po = postOffices[0];
              final state = po['State']?.toString() ?? '';
              final dist = po['District']?.toString() ?? '';
              if (mounted) {
                setState(() {
                  if (_districtController.text.trim().isEmpty && dist.isNotEmpty) {
                    _districtController.text = dist;
                  }
                  if (state.isNotEmpty) {
                    _stateController.text = state;
                  }
                });
              }
            }
          }
        }
      } catch (_) {}
    }
  }

  void _showToast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: const Color(0xFF0F172A),
      ),
    );
  }

  Future<void> _submitDecisionEngine() async {
    if (_leadPath == 'not_connected') {
      // Validate nc date
    } else {
      if (_selectedSalesStatus.isEmpty) {
        _showToast('Please select a Sales Status');
        return;
      }
      if (_selectedSalesStatus == 'Ordered') {
        final selectedItems = _products.where((p) => p.isSelected).toList();
        if (selectedItems.isEmpty) {
          _showToast('Please select at least one product in Step 4');
          return;
        }
        final advance = double.tryParse(_advanceController.text.trim()) ?? 0;
        if (advance > 0 && _screenshotFile == null) {
          _showToast('Payment screenshot is required when advance is recorded.');
          return;
        }
      } else if (_selectedSalesStatus.contains('Dealer')) {
        if (_selectedDealerManagerId == null || _selectedDealerManagerId!.isEmpty) {
          _showToast('Please select a Dealer Manager');
          return;
        }
      }
    }

    setState(() => _isSubmitting = true);

    try {
      final leadId = widget.lead.id;
      final customerName = _nameController.text.trim().isNotEmpty ? _nameController.text.trim() : widget.lead.name;
      final phone = _phoneController.text.trim().isNotEmpty ? _phoneController.text.trim() : widget.lead.phone;
      final village = _villageController.text.trim();
      final district = _districtController.text.trim();
      final pincode = _pincodeController.text.trim();
      final state = _stateController.text.trim();

      // 1. Prepare Summary Note & Status Mapping
      String summaryNote = '[Decision Engine] Call: $_selectedCallStatus. Path: $_leadPath. ';
      String finalStatus = 'contacted';
      String finalScore = 'warm';
      int currentCallCount = widget.lead.callCount;

      if (_leadPath == 'not_connected') {
        currentCallCount++;
        if (currentCallCount >= 3) {
          finalStatus = 'lost';
          finalScore = 'cold';
          summaryNote += 'Attempt $currentCallCount ($_selectedCallStatus). Lead automatically marked as LOST after 3 attempts.';
        } else {
          finalStatus = 'callback';
          finalScore = 'warm';
          summaryNote += 'Attempt $currentCallCount ($_selectedCallStatus). Callback scheduled for: ${_ncDate.toIso8601String()}. Notes: ${_ncNotesController.text.trim()}';
        }
      } else {
        summaryNote += 'Decision: $_selectedSalesStatus. ';
        if (_selectedSalesStatus.contains('Ordered')) {
          finalStatus = 'converted';
          finalScore = 'hot';
        } else if (_selectedSalesStatus.contains('Hot')) {
          finalStatus = 'interested';
          finalScore = 'hot';
          summaryNote += 'Hot lead. Follow-up: ${_followUpDate.toIso8601String()}. Action: $_followUpAction. Notes: ${_followUpNotesController.text.trim()}';
        } else if (_selectedSalesStatus.contains('Mild')) {
          finalStatus = 'followup';
          finalScore = 'warm';
          summaryNote += 'Follow-up: ${_followUpDate.toIso8601String()}. Action: $_followUpAction. Notes: ${_followUpNotesController.text.trim()}';
        } else if (_selectedSalesStatus.contains('Cold')) {
          finalStatus = 'not_interested';
          finalScore = 'cold';
          summaryNote += 'Reason: $_lostReason. Notes: ${_lostNotesController.text.trim()}';
        } else if (_selectedSalesStatus.contains('Old')) {
          finalStatus = 'lost';
          finalScore = 'cold';
          summaryNote += 'Satisfaction: $_feedbackSatisfaction. Feedback: ${_feedbackNotesController.text.trim()}';
        } else if (_selectedSalesStatus.contains('Dealer')) {
          finalStatus = 'dealer';
          finalScore = 'warm';
          final mgr = _dealerManagers.firstWhere((m) => m.id == _selectedDealerManagerId, orElse: () => _DealerManager(id: '', name: 'Dealer Manager'));
          summaryNote += 'Assigned to Dealer Manager: ${mgr.name}. Notes: ${_dealerNotesController.text.trim()}';
        }
      }

      // 2. Post Note
      await ApiClient.post('leads/$leadId/notes', body: {'note': summaryNote});

      // 3. Update Lead Details
      final Map<String, dynamic> updatePayload = {
        'customer_name': customerName,
        'city': village,
        'village': village,
        'district': district,
        'pincode': pincode,
        'state': state,
        'status': finalStatus,
        'score': finalScore,
        'phone_number': phone,
        'language': _selectedLanguage,
        'call_count': currentCallCount,
      };

      if (_selectedSalesStatus.contains('Dealer') && _selectedDealerManagerId != null) {
        updatePayload['assigned_to'] = _selectedDealerManagerId;
        if (_dealerNotesController.text.trim().isNotEmpty) {
          updatePayload['notes'] = 'Notes for Dealer Manager: ${_dealerNotesController.text.trim()}';
        }
      }

      if (_leadPath == 'not_connected') {
        updatePayload['next_followup_date'] = _ncDate.toIso8601String();
      } else if (_selectedSalesStatus.contains('Hot') || _selectedSalesStatus.contains('Mild')) {
        updatePayload['next_followup_date'] = _followUpDate.toIso8601String();
      }

      final updateRes = await ApiClient.put('leads/$leadId', body: updatePayload);
      if (!updateRes.isSuccess) {
        throw Exception(updateRes.errorMessage ?? 'Failed to update lead');
      }

      // 4. Create Order if Converted
      if (finalStatus == 'converted') {
        final List<Map<String, dynamic>> orderItems = [];
        for (final p in _products) {
          if (p.isSelected) {
            if (p.isSet && p.setItems.isNotEmpty) {
              for (final sub in p.setItems) {
                final subQty = (int.tryParse(sub['quantity']?.toString() ?? '1') ?? 1) * p.quantity;
                orderItems.add({
                  'product_id': sub['product_id'],
                  'quantity': subQty,
                  'price': double.tryParse(sub['selling_price']?.toString() ?? '0') ?? 0,
                  'name': sub['product_name'] ?? p.name,
                });
              }
            } else {
              orderItems.add({
                'product_id': p.id,
                'quantity': p.quantity,
                'price': p.price,
                'name': p.name,
              });
            }
          }
        }

        final totalAmt = double.tryParse(_totalAmountController.text.trim()) ?? 0;
        final discountAmt = double.tryParse(_discountController.text.trim()) ?? 0;
        final advanceAmt = double.tryParse(_advanceController.text.trim()) ?? 0;
        final deliveryVal = _deliveryType == 'other' ? _otherDeliveryController.text.trim() : _deliveryType;

        final fields = {
          'lead_id': leadId,
          'customer_name': customerName,
          'phone': phone,
          'city': village,
          'village': village,
          'district': district,
          'pincode': pincode,
          'state': state,
          'delivery_type': deliveryVal,
          'total_amount': totalAmt.toString(),
          'advance_amount': advanceAmt.toString(),
          'discount': discountAmt.toString(),
          'items': jsonEncode(orderItems),
        };

        final orderRes = await ApiClient.postMultipart(
          'orders/convert',
          fields: fields,
          fileField: 'screenshot',
          filePath: _screenshotFile?.path,
        );

        if (!orderRes.isSuccess) {
          throw Exception(orderRes.errorMessage ?? 'Failed to convert order');
        }

        final orderId = (orderRes.data is Map) ? orderRes.data['orderId'] : '';
        if (mounted) {
          final parentContext = context;
          Navigator.of(parentContext).pop(); // Close wizard sheet

          final itemsText = orderItems.map((e) => '${e['name']} (x${e['quantity']})').join(', ');

          showDialog(
            context: parentContext,
            barrierDismissible: false,
            builder: (dialogCtx) => _ConversionSuccessDialog(
              orderId: orderId?.toString() ?? '',
              customerName: customerName,
              phone: phone,
              amount: totalAmt,
              deliveryType: deliveryVal,
              itemsSummary: itemsText.isNotEmpty ? itemsText : 'Selected Products',
              onDone: () {
                Navigator.of(dialogCtx).pop();
                widget.onConverted?.call();
                widget.onUpdated?.call();
              },
            ),
          );

          ScaffoldMessenger.of(parentContext).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '🎉 ORDER #${orderId?.toString().isNotEmpty == true ? orderId : 'SGB'} CONVERTED SUCCESSFULLY!',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
              backgroundColor: const Color(0xFF059669),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              duration: const Duration(seconds: 4),
            ),
          );
        }
      } else {
        if (mounted) {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Interaction Saved Successfully!'),
              backgroundColor: Color(0xFF059669),
              behavior: SnackBarBehavior.floating,
            ),
          );
          widget.onUpdated?.call();
        }
      }
    } catch (e) {
      _showToast('Error: $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      clipBehavior: Clip.antiAlias,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.90,
          child: Column(
            children: [
              _buildHeader(),
              _buildStepIndicator(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: _buildCurrentStepContent(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Header ───────────────────────────────────────────────
  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      color: const Color(0xFF059669), // Emerald Green
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Text(
                'CRM Order Conversion Wizard',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                ),
              ),
              SizedBox(height: 3),
              Text(
                'Lead Decision Engine',
                style: TextStyle(
                  color: Color(0xFFD1FAE5),
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          Positioned(
            right: 0,
            child: IconButton(
              icon: const Icon(Icons.close_rounded, color: Colors.white, size: 22),
              onPressed: () => Navigator.of(context).pop(),
              splashRadius: 20,
            ),
          ),
        ],
      ),
    );
  }

  // ─── Step Indicator ────────────────────────────────────────
  Widget _buildStepIndicator() {
    final steps = [
      {'num': 1, 'label': '1. STATUS'},
      {'num': 2, 'label': '2. CUSTOMER'},
      {'num': 3, 'label': '3. DECISION'},
      {'num': 4, 'label': '4. PRODUCT'},
    ];

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: steps.map((s) {
          final sNum = s['num'] as int;
          final sLabel = s['label'] as String;
          final isActive = _currentStep == sNum;
          final isPast = _currentStep > sNum;

          return GestureDetector(
            onTap: () {
              if (isPast || (_currentStep == 1 && _selectedCallStatus.isNotEmpty)) {
                _goToStep(sNum);
              }
            },
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  sLabel,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: isActive ? FontWeight.w800 : FontWeight.w700,
                    color: isActive
                        ? const Color(0xFF059669)
                        : (isPast ? const Color(0xFF0F172A) : const Color(0xFF94A3B8)),
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  height: 3,
                  width: 50,
                  decoration: BoxDecoration(
                    color: isActive ? const Color(0xFF059669) : Colors.transparent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  // ─── Step Router ───────────────────────────────────────────
  Widget _buildCurrentStepContent() {
    switch (_currentStep) {
      case 1:
        return _buildStep1Status();
      case 2:
        return _buildStep2Customer();
      case 3:
        return _buildStep3Decision();
      case 4:
        return _buildStep4Product();
      default:
        return const SizedBox.shrink();
    }
  }

  // ─── STEP 1: STATUS ────────────────────────────────────────
  Widget _buildStep1Status() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Section 1: Call Status',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 16),

        _buildFieldLabel('PHONE NUMBER'),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Text(
            widget.lead.phone,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF475569),
            ),
          ),
        ),
        const SizedBox(height: 20),

        _buildFieldLabel('CALL STATUS *'),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 10,
          children: _callStatuses.map((st) {
            final isSelected = _selectedCallStatus.toLowerCase() == st.toLowerCase();
            return _buildPill(
              label: st.toUpperCase(),
              isSelected: isSelected,
              onTap: () => _handleCallStatusSelected(st),
            );
          }).toList(),
        ),

        const SizedBox(height: 32),
        Align(
          alignment: Alignment.centerRight,
          child: ElevatedButton.icon(
            onPressed: _goToNextStep,
            icon: const Icon(Icons.arrow_forward_rounded, size: 16, color: Colors.white),
            label: const Text(
              'Next',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Colors.white),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF059669),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
          ),
        ),
      ],
    );
  }

  // ─── STEP 2: CUSTOMER ──────────────────────────────────────
  Widget _buildStep2Customer() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Step 2: Customer Details',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 16),

        _buildFieldLabel('FARMER NAME'),
        const SizedBox(height: 6),
        _buildTextInput(controller: _nameController, hint: 'Farmer Name'),
        const SizedBox(height: 14),

        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildFieldLabel('VILLAGE / TALUK'),
                  const SizedBox(height: 6),
                  _buildTextInput(controller: _villageController, hint: 'Enter village'),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildFieldLabel('STATE'),
                  const SizedBox(height: 6),
                  _buildTextInput(controller: _stateController, hint: 'State'),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildFieldLabel('DISTRICT'),
                  const SizedBox(height: 6),
                  _buildTextInput(controller: _districtController, hint: 'Enter District'),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildFieldLabel('PINCODE'),
                  const SizedBox(height: 6),
                  _buildTextInput(
                    controller: _pincodeController,
                    hint: '6-digit Pincode',
                    keyboardType: TextInputType.number,
                    onChanged: (val) {
                      if (val.length == 6) _lookupPincode(val);
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),

        _buildFieldLabel('LEAD LANGUAGE'),
        const SizedBox(height: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: _selectedLanguage,
              isExpanded: true,
              icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B)),
              items: _languages.map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedLanguage = val);
              },
            ),
          ),
        ),

        const SizedBox(height: 32),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            OutlinedButton.icon(
              onPressed: _goToPrevStep,
              icon: const Icon(Icons.arrow_back_rounded, size: 16),
              label: const Text('Back'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF475569),
                side: const BorderSide(color: Color(0xFFCBD5E1)),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            ElevatedButton.icon(
              onPressed: _goToNextStep,
              icon: const Icon(Icons.arrow_forward_rounded, size: 16, color: Colors.white),
              label: const Text('Next', style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ─── STEP 3: DECISION ──────────────────────────────────────
  Widget _buildStep3Decision() {
    if (_leadPath == 'not_connected') {
      return _buildNotConnectedSubform();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Step 3: Sales Status & Decision',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 16),

        _buildFieldLabel('SALES STATUS *'),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 10,
          children: _salesStatuses.map((st) {
            final isSelected = _selectedSalesStatus.toLowerCase() == st.toLowerCase() ||
                (_selectedSalesStatus.contains('Ordered') && st == 'Ordered');
            return _buildPill(
              label: st.toUpperCase(),
              isSelected: isSelected,
              onTap: () => _handleSalesStatusSelected(st),
            );
          }).toList(),
        ),

        const SizedBox(height: 20),

        // Dynamic Subforms for non-order statuses
        if (_selectedSalesStatus.contains('Hot') || _selectedSalesStatus.contains('Mild')) ...[
          _buildFollowUpSubform(),
        ] else if (_selectedSalesStatus.contains('Cold')) ...[
          _buildLostReasonSubform(),
        ] else if (_selectedSalesStatus.contains('Old')) ...[
          _buildCustomerFeedbackSubform(),
        ] else if (_selectedSalesStatus.contains('Dealer')) ...[
          _buildDealerSubform(),
        ],

        const SizedBox(height: 32),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            OutlinedButton.icon(
              onPressed: _goToPrevStep,
              icon: const Icon(Icons.arrow_back_rounded, size: 16),
              label: const Text('Back'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF475569),
                side: const BorderSide(color: Color(0xFFCBD5E1)),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            if (_selectedSalesStatus == 'Ordered')
              ElevatedButton.icon(
                onPressed: () => _goToStep(4),
                icon: const Icon(Icons.arrow_forward_rounded, size: 16, color: Colors.white),
                label: const Text('Next', style: TextStyle(color: Colors.white)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                ),
              )
            else
              ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _submitDecisionEngine,
                icon: _isSubmitting
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.check_rounded, size: 16, color: Colors.white),
                label: Text(
                  _isSubmitting ? 'Saving...' : 'Save Changes',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  elevation: 0,
                ),
              ),
          ],
        ),
      ],
    );
  }

  // ─── Subform: Not Connected / WhatsApp ───────────────────────
  Widget _buildNotConnectedSubform() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Step 3: Connection Log',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
        ),
        const SizedBox(height: 14),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFCBD5E1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: const [
                  Icon(Icons.phone_missed_rounded, color: Color(0xFF334155), size: 18),
                  SizedBox(width: 8),
                  Text(
                    'Connection Log',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF334155)),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              _buildFieldLabel('CALL ATTEMPT'),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _ncAttempt,
                    isExpanded: true,
                    items: _ncAttempts.map((a) => DropdownMenuItem(value: a, child: Text(a))).toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _ncAttempt = val);
                    },
                  ),
                ),
              ),
              const SizedBox(height: 14),

              _buildFieldLabel('NEXT CALL DATE *'),
              const SizedBox(height: 6),
              GestureDetector(
                onTap: () async {
                  final now = DateTime.now();
                  final pickedDate = await showDatePicker(
                    context: context,
                    initialDate: _ncDate,
                    firstDate: now,
                    lastDate: now.add(const Duration(days: 90)),
                  );
                  if (pickedDate != null && mounted) {
                    final pickedTime = await showTimePicker(
                      context: context,
                      initialTime: TimeOfDay.fromDateTime(_ncDate),
                    );
                    if (pickedTime != null && mounted) {
                      setState(() {
                        _ncDate = DateTime(
                          pickedDate.year,
                          pickedDate.month,
                          pickedDate.day,
                          pickedTime.hour,
                          pickedTime.minute,
                        );
                      });
                    }
                  }
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${_ncDate.day}/${_ncDate.month}/${_ncDate.year} at ${TimeOfDay.fromDateTime(_ncDate).format(context)}',
                        style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                      ),
                      const Icon(Icons.calendar_today_rounded, size: 16, color: Color(0xFF64748B)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),

              _buildFieldLabel('NOTES'),
              const SizedBox(height: 6),
              _buildTextInput(controller: _ncNotesController, hint: 'Call remarks...', maxLines: 2),
            ],
          ),
        ),

        const SizedBox(height: 32),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            OutlinedButton.icon(
              onPressed: _goToPrevStep,
              icon: const Icon(Icons.arrow_back_rounded, size: 16),
              label: const Text('Back'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF475569),
                side: const BorderSide(color: Color(0xFFCBD5E1)),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            ElevatedButton.icon(
              onPressed: _isSubmitting ? null : _submitDecisionEngine,
              icon: _isSubmitting
                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.check_rounded, size: 16, color: Colors.white),
              label: Text(
                _isSubmitting ? 'Saving...' : 'Save Changes',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ─── Subform: Follow-up Details ─────────────────────────────
  Widget _buildFollowUpSubform() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFEF3C7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.calendar_month_rounded, color: Color(0xFFD97706), size: 18),
              SizedBox(width: 8),
              Text(
                'Follow-up Details',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFFD97706)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('NEXT FOLLOW-UP DATE *'),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: () async {
              final now = DateTime.now();
              final pickedDate = await showDatePicker(
                context: context,
                initialDate: _followUpDate,
                firstDate: now,
                lastDate: now.add(const Duration(days: 90)),
              );
              if (pickedDate != null && mounted) {
                final pickedTime = await showTimePicker(
                  context: context,
                  initialTime: TimeOfDay.fromDateTime(_followUpDate),
                );
                if (pickedTime != null && mounted) {
                  setState(() {
                    _followUpDate = DateTime(
                      pickedDate.year,
                      pickedDate.month,
                      pickedDate.day,
                      pickedTime.hour,
                      pickedTime.minute,
                    );
                  });
                }
              }
            },
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFCBD5E1)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${_followUpDate.day}/${_followUpDate.month}/${_followUpDate.year} at ${TimeOfDay.fromDateTime(_followUpDate).format(context)}',
                    style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                  ),
                  const Icon(Icons.calendar_today_rounded, size: 16, color: Color(0xFF64748B)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('FOLLOW-UP ACTION'),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _followUpAction,
                isExpanded: true,
                items: _followUpActions.map((a) => DropdownMenuItem(value: a, child: Text(a))).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _followUpAction = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('NOTES'),
          const SizedBox(height: 6),
          _buildTextInput(controller: _followUpNotesController, hint: 'Follow-up discussion notes...', maxLines: 2),
        ],
      ),
    );
  }

  // ─── Subform: Lost Reason ───────────────────────────────────
  Widget _buildLostReasonSubform() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.cancel_rounded, color: Color(0xFF475569), size: 18),
              SizedBox(width: 8),
              Text(
                'Lost Reason',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF475569)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('REASON *'),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _lostReason,
                isExpanded: true,
                items: _lostReasons.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _lostReason = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('ADDITIONAL NOTES'),
          const SizedBox(height: 6),
          _buildTextInput(controller: _lostNotesController, hint: 'Reason explanation...', maxLines: 2),
        ],
      ),
    );
  }

  // ─── Subform: Customer Feedback (Old Purchased) ─────────────
  Widget _buildCustomerFeedbackSubform() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFDBEAFE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.thumb_up_alt_rounded, color: Color(0xFF2563EB), size: 18),
              SizedBox(width: 8),
              Text(
                'Customer Feedback',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF2563EB)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('SATISFACTION *'),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _feedbackSatisfaction,
                isExpanded: true,
                items: _feedbackOptions.map((f) => DropdownMenuItem(value: f, child: Text(f))).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _feedbackSatisfaction = val);
                },
              ),
            ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('FEEDBACK DETAILS'),
          const SizedBox(height: 6),
          _buildTextInput(controller: _feedbackNotesController, hint: 'Feedback & remarks...', maxLines: 2),
        ],
      ),
    );
  }

  // ─── Subform: Assign Dealer Manager ─────────────────────────
  Widget _buildDealerSubform() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFFEDD5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.handshake_rounded, color: Color(0xFFC2410C), size: 18),
              SizedBox(width: 8),
              Text(
                'Assign Dealer Manager',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFFC2410C)),
              ),
            ],
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('SELECT DEALER MANAGER *'),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: _isLoadingDealers
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text('Loading Dealer Managers...'),
                  )
                : DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedDealerManagerId,
                      isExpanded: true,
                      items: _dealerManagers.map((m) => DropdownMenuItem(value: m.id, child: Text(m.name))).toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedDealerManagerId = val);
                      },
                    ),
                  ),
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('NOTES FOR DEALER MANAGER'),
          const SizedBox(height: 6),
          _buildTextInput(controller: _dealerNotesController, hint: 'Add notes or dealer requirements...', maxLines: 2),
        ],
      ),
    );
  }

  // ─── STEP 4: PRODUCT ───────────────────────────────────────
  Widget _buildStep4Product() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Step 4: Product Selection & Order',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 16),

        _buildFieldLabel('SELECT PRODUCTS (1-CLICK SELECTION)'),
        const SizedBox(height: 10),

        if (_isLoadingProducts)
          const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 0.95,
            ),
            itemCount: _products.length,
            itemBuilder: (context, index) {
              final p = _products[index];
              return _buildProductCard(p);
            },
          ),

        const SizedBox(height: 24),

        // Order Configuration form
        _buildOrderConfigurationForm(),

        const SizedBox(height: 32),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            OutlinedButton.icon(
              onPressed: _goToPrevStep,
              icon: const Icon(Icons.arrow_back_rounded, size: 16),
              label: const Text('Back'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF475569),
                side: const BorderSide(color: Color(0xFFCBD5E1)),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            ElevatedButton.icon(
              onPressed: _isSubmitting ? null : _submitDecisionEngine,
              icon: _isSubmitting
                  ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.check_rounded, size: 16, color: Colors.white),
              label: Text(
                _isSubmitting ? 'Converting...' : 'Save & Convert',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF059669),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ─── Product Card ──────────────────────────────────────────
  Widget _buildProductCard(_ProductItem p) {
    final isSelected = p.isSelected;

    return GestureDetector(
      onTap: () => _toggleProduct(p),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: p.isSet
              ? (isSelected ? const Color(0xFFF3E8FF) : const Color(0xFFFAF5FF))
              : (isSelected ? const Color(0xFFECFDF5) : Colors.white),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: p.isSet
                ? (isSelected ? const Color(0xFF8B5CF6) : const Color(0xFFD8B4FE))
                : (isSelected ? const Color(0xFF059669) : const Color(0xFFE2E8F0)),
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: (p.isSet ? const Color(0xFF8B5CF6) : const Color(0xFF059669)).withValues(alpha: 0.15),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (p.isSet)
                  Container(
                    margin: const EdgeInsets.only(bottom: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEDE9FE),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.inventory_2_rounded, size: 10, color: Color(0xFF8B5CF6)),
                        SizedBox(width: 3),
                        Text(
                          'FULL SET BUNDLE',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF8B5CF6),
                          ),
                        ),
                      ],
                    ),
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        p.name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    if (isSelected)
                      Icon(
                        Icons.check_circle_rounded,
                        size: 18,
                        color: p.isSet ? const Color(0xFF8B5CF6) : const Color(0xFF059669),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '₹${p.price.toStringAsFixed(2)}',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    color: p.isSet ? const Color(0xFF8B5CF6) : const Color(0xFF059669),
                  ),
                ),
                if (p.setDetails != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4.0),
                    child: Text(
                      p.setDetails!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                    ),
                  ),
              ],
            ),

            if (isSelected)
              Container(
                margin: const EdgeInsets.only(top: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    InkWell(
                      onTap: () => _updateQuantity(p, -1),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        child: Text('-', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                    ),
                    Text(
                      '${p.quantity}',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                    ),
                    InkWell(
                      onTap: () => _updateQuantity(p, 1),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        child: Text('+', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ─── Order Configuration Form ──────────────────────────────
  Widget _buildOrderConfigurationForm() {
    final selectedItems = _products.where((p) => p.isSelected).toList();
    final summaryNames = selectedItems.isEmpty
        ? 'None'
        : selectedItems.map((p) => '${p.name} (x${p.quantity})').join(', ');

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFECFDF5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFD1FAE5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.shopping_cart_rounded, color: Color(0xFF065F46), size: 18),
              SizedBox(width: 8),
              Text(
                'Order Configuration',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF065F46)),
              ),
            ],
          ),
          const SizedBox(height: 12),

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Selected Products: ', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
              Expanded(
                child: Text(
                  summaryNames,
                  style: const TextStyle(fontSize: 12.5, color: Color(0xFF334155)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('Total Amount (₹)'),
          const SizedBox(height: 6),
          _buildTextInput(
            controller: _totalAmountController,
            hint: '0',
            keyboardType: TextInputType.number,
            onChanged: (_) => _recalculateFinalAndDue(),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildFieldLabel('Discount (₹)'),
                    const SizedBox(height: 6),
                    _buildTextInput(
                      controller: _discountController,
                      hint: '0',
                      keyboardType: TextInputType.number,
                      onChanged: (_) => _recalculateFinalAndDue(),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildFieldLabel('Final Amount (₹)'),
                    const SizedBox(height: 6),
                    _buildTextInput(
                      controller: _finalAmountController,
                      hint: '0',
                      readOnly: true,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildFieldLabel('Advance Amount (₹)'),
                    const SizedBox(height: 6),
                    _buildTextInput(
                      controller: _advanceController,
                      hint: '0',
                      keyboardType: TextInputType.number,
                      onChanged: (_) => _recalculateFinalAndDue(),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildFieldLabel('Due Amount (₹)'),
                    const SizedBox(height: 6),
                    _buildTextInput(
                      controller: _dueAmountController,
                      hint: '0',
                      readOnly: true,
                      textColor: (double.tryParse(_dueAmountController.text) ?? 0) > 0
                          ? const Color(0xFFEF4444)
                          : const Color(0xFF10B981),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          _buildFieldLabel('Delivery Type *'),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFCBD5E1)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _deliveryType,
                isExpanded: true,
                items: _deliveryTypes.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _deliveryType = val);
                },
              ),
            ),
          ),

          if (_deliveryType == 'other') ...[
            const SizedBox(height: 12),
            _buildFieldLabel('Specify Delivery Type *'),
            const SizedBox(height: 6),
            _buildTextInput(controller: _otherDeliveryController, hint: 'Enter delivery type'),
          ],

          const SizedBox(height: 16),
          _buildFieldLabel('Upload Payment Screenshot *'),
          const SizedBox(height: 8),

          if (_screenshotFile != null) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFCBD5E1)),
              ),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Image.file(_screenshotFile!, width: 48, height: 48, fit: BoxFit.cover),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _screenshotFile!.path.split(Platform.pathSeparator).last,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444)),
                    onPressed: () => setState(() => _screenshotFile = null),
                  ),
                ],
              ),
            ),
          ] else ...[
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pickScreenshot(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined, size: 17),
                    label: const Text('Gallery', style: TextStyle(fontSize: 12.5)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF0F172A),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pickScreenshot(ImageSource.camera),
                    icon: const Icon(Icons.camera_alt_outlined, size: 17),
                    label: const Text('Camera', style: TextStyle(fontSize: 12.5)),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF0F172A),
                      side: const BorderSide(color: Color(0xFFCBD5E1)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  // ─── Helpers & Base Components ─────────────────────────────
  Widget _buildFieldLabel(String label) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 11.5,
        fontWeight: FontWeight.w800,
        color: Color(0xFF64748B),
        letterSpacing: 0.3,
      ),
    );
  }

  Widget _buildTextInput({
    required TextEditingController controller,
    required String hint,
    TextInputType keyboardType = TextInputType.text,
    int maxLines = 1,
    bool readOnly = false,
    Color? textColor,
    ValueChanged<String>? onChanged,
  }) {
    return TextField(
      controller: controller,
      readOnly: readOnly,
      keyboardType: keyboardType,
      maxLines: maxLines,
      onChanged: onChanged,
      style: TextStyle(
        fontSize: 13.5,
        fontWeight: FontWeight.w700,
        color: textColor ?? (readOnly ? const Color(0xFF64748B) : const Color(0xFF0F172A)),
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8), fontWeight: FontWeight.normal),
        filled: true,
        fillColor: readOnly ? const Color(0xFFF1F5F9) : Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF059669), width: 1.5),
        ),
      ),
    );
  }

  Widget _buildPill({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8.5),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFECFDF5) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? const Color(0xFF059669) : const Color(0xFFCBD5E1),
            width: isSelected ? 1.5 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFF059669).withValues(alpha: 0.12),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
            color: isSelected ? const Color(0xFF059669) : const Color(0xFF475569),
          ),
        ),
      ),
    );
  }
}

class _ConversionSuccessDialog extends StatelessWidget {
  final String orderId;
  final String customerName;
  final String phone;
  final double amount;
  final String deliveryType;
  final String itemsSummary;
  final VoidCallback onDone;

  const _ConversionSuccessDialog({
    required this.orderId,
    required this.customerName,
    required this.phone,
    required this.amount,
    required this.deliveryType,
    required this.itemsSummary,
    required this.onDone,
  });

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: Colors.white,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Celebratory Green Circle
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFF86EFAC), width: 3),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF059669).withValues(alpha: 0.15),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(
                  Icons.check_circle_rounded,
                  size: 44,
                  color: Color(0xFF059669),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Converted Successfully! 🎉',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: Color(0xFF0F172A),
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              orderId.isNotEmpty
                  ? 'Order #$orderId has been placed and assigned.'
                  : 'Order has been placed and assigned successfully.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 20),

            // Order Details Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  _buildRow('Customer', customerName),
                  const Divider(height: 16, thickness: 0.8, color: Color(0xFFE2E8F0)),
                  _buildRow('Phone', phone),
                  const Divider(height: 16, thickness: 0.8, color: Color(0xFFE2E8F0)),
                  _buildRow('Items', itemsSummary, isFlexible: true),
                  const Divider(height: 16, thickness: 0.8, color: Color(0xFFE2E8F0)),
                  _buildRow(
                    'Total Amount',
                    '₹${amount.toStringAsFixed(0)}',
                    valueColor: const Color(0xFF059669),
                    isBold: true,
                  ),
                  if (deliveryType.isNotEmpty) ...[
                    const Divider(height: 16, thickness: 0.8, color: Color(0xFFE2E8F0)),
                    _buildRow('Delivery Type', deliveryType),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 22),

            // Action Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton.icon(
                onPressed: onDone,
                icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 18),
                label: const Text(
                  'Done & View Purchases',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF059669),
                  elevation: 2,
                  shadowColor: const Color(0xFF059669).withValues(alpha: 0.3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRow(String label, String value, {Color? valueColor, bool isBold = false, bool isFlexible = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: Color(0xFF64748B),
          ),
        ),
        const SizedBox(width: 12),
        isFlexible
            ? Expanded(
                child: Text(
                  value,
                  textAlign: TextAlign.end,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                    color: valueColor ?? const Color(0xFF1E293B),
                  ),
                ),
              )
            : Text(
                value,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                  color: valueColor ?? const Color(0xFF1E293B),
                ),
              ),
      ],
    );
  }
}

