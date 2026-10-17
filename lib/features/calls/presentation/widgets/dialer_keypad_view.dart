import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../data/calls_service.dart';

class DialerKeypadView extends StatefulWidget {
  final String? initialNumber;
  final VoidCallback? onCallInitiated;

  const DialerKeypadView({
    super.key,
    this.initialNumber,
    this.onCallInitiated,
  });

  @override
  State<DialerKeypadView> createState() => _DialerKeypadViewState();
}

class _DialerKeypadViewState extends State<DialerKeypadView> {
  late String _phoneNumber;

  @override
  void initState() {
    super.initState();
    _phoneNumber = widget.initialNumber ?? '';
  }

  void _appendDigit(String char) {
    HapticFeedback.lightImpact();
    setState(() {
      if (_phoneNumber.length < 18) {
        _phoneNumber += char;
      }
    });
  }

  void _backspace() {
    if (_phoneNumber.isEmpty) return;
    HapticFeedback.lightImpact();
    setState(() {
      _phoneNumber = _phoneNumber.substring(0, _phoneNumber.length - 1);
    });
  }

  void _clearAll() {
    if (_phoneNumber.isEmpty) return;
    HapticFeedback.mediumImpact();
    setState(() {
      _phoneNumber = '';
    });
  }

  Future<void> _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim() ?? '';
    if (text.isNotEmpty) {
      final clean = text.replaceAll(RegExp(r'[^0-9+]'), '');
      if (clean.isNotEmpty) {
        HapticFeedback.lightImpact();
        setState(() {
          _phoneNumber = clean;
        });
      }
    }
  }

  void _initiateCall() {
    final clean = _phoneNumber.trim();
    if (clean.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Please enter a phone number to dial.'),
          backgroundColor: const Color(0xFF0F172A),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          duration: const Duration(seconds: 2),
        ),
      );
      return;
    }

    HapticFeedback.heavyImpact();
    CallsService.dialCustomer(context, phone: clean);
    widget.onCallInitiated?.call();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Phone Number Display Container
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.04),
                      blurRadius: 10,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _phoneNumber.isEmpty ? 'Enter phone number...' : _phoneNumber,
                        style: TextStyle(
                          fontSize: _phoneNumber.length > 12 ? 22 : 28,
                          fontWeight: FontWeight.w800,
                          color: _phoneNumber.isEmpty
                              ? const Color(0xFF94A3B8)
                              : const Color(0xFF0F172A),
                          letterSpacing: 1.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (_phoneNumber.isNotEmpty) ...[
                      GestureDetector(
                        onTap: _backspace,
                        onLongPress: _clearAll,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.backspace_outlined,
                            size: 20,
                            color: Color(0xFF475569),
                          ),
                        ),
                      ),
                    ] else ...[
                      IconButton(
                        icon: const Icon(Icons.paste_rounded, size: 20, color: Color(0xFF0A5844)),
                        tooltip: 'Paste Number',
                        onPressed: _pasteFromClipboard,
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 18),

              // Keypad Grid (3 columns x 4 rows)
              Column(
                children: [
                  _buildKeypadRow([
                    _KeypadButtonConfig('1', ''),
                    _KeypadButtonConfig('2', 'ABC'),
                    _KeypadButtonConfig('3', 'DEF'),
                  ]),
                  const SizedBox(height: 12),
                  _buildKeypadRow([
                    _KeypadButtonConfig('4', 'GHI'),
                    _KeypadButtonConfig('5', 'JKL'),
                    _KeypadButtonConfig('6', 'MNO'),
                  ]),
                  const SizedBox(height: 12),
                  _buildKeypadRow([
                    _KeypadButtonConfig('7', 'PQRS'),
                    _KeypadButtonConfig('8', 'TUV'),
                    _KeypadButtonConfig('9', 'WXYZ'),
                  ]),
                  const SizedBox(height: 12),
                  _buildKeypadRow([
                    _KeypadButtonConfig('*', ''),
                    _KeypadButtonConfig('0', '+', onLongPress: () => _appendDigit('+')),
                    _KeypadButtonConfig('#', ''),
                  ]),
                ],
              ),

              const SizedBox(height: 20),

              // Green Acefone Call Action Button
              GestureDetector(
                onTap: _initiateCall,
                child: Container(
                  width: 68,
                  height: 68,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF059669), Color(0xFF047857)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF059669).withValues(alpha: 0.38),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.phone_rounded,
                      color: Colors.white,
                      size: 32,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 8),

              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: Color(0xFF10B981),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'Acefone Cloud Telephony',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildKeypadRow(List<_KeypadButtonConfig> buttons) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: buttons.map((cfg) {
        return _buildKeypadButton(
          cfg.digit,
          cfg.subtext,
          onTap: () => _appendDigit(cfg.digit),
          onLongPress: cfg.onLongPress,
        );
      }).toList(),
    );
  }

  Widget _buildKeypadButton(
    String digit,
    String subtext, {
    required VoidCallback onTap,
    VoidCallback? onLongPress,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        borderRadius: BorderRadius.circular(36),
        splashColor: const Color(0xFF0A5844).withValues(alpha: 0.12),
        highlightColor: const Color(0xFF0A5844).withValues(alpha: 0.06),
        child: Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.02),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                digit,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                  height: 1.1,
                ),
              ),
              if (subtext.isNotEmpty) ...[
                Text(
                  subtext,
                  style: const TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF64748B),
                    letterSpacing: 1.2,
                  ),
                ),
              ] else ...[
                const SizedBox(height: 11),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _KeypadButtonConfig {
  final String digit;
  final String subtext;
  final VoidCallback? onLongPress;

  _KeypadButtonConfig(this.digit, this.subtext, {this.onLongPress});
}
