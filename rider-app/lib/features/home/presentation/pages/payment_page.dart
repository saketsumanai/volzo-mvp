/**
 * Rider Payment Page
 * Supports:
 *  1. Razorpay native checkout (primary)
 *  2. UPI QR fallback (manual scan)
 */

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:dio/dio.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/config/theme_config.dart';

class PaymentPage extends StatefulWidget {
  final String rideId;
  final double amount;
  final String rideNumber;

  const PaymentPage({
    super.key,
    required this.rideId,
    required this.amount,
    required this.rideNumber,
  });

  @override
  State<PaymentPage> createState() => _PaymentPageState();
}

class _PaymentPageState extends State<PaymentPage> with TickerProviderStateMixin {
  late Razorpay _razorpay;
  late AnimationController _pulseController;
  late AnimationController _successController;

  bool _loading       = false;
  bool _paymentDone   = false;
  String _selectedMethod = 'razorpay'; // 'razorpay' | 'upi_qr'
  String? _error;

  // QR / UPI details (loaded from API)
  String? _upiId;
  String? _upiName;
  String? _qrImageUrl;
  String? _orderId;

  @override
  void initState() {
    super.initState();
    _initRazorpay();
    _initAnimations();
    _loadQrDetails();
  }

  void _initAnimations() {
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _successController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
  }

  void _initRazorpay() {
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR,   _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  Future<void> _loadQrDetails() async {
    try {
      final res = await ApiClient.get('/payments/qr-details');
      if (res.data['success'] == true) {
        final d = res.data['data'];
        setState(() {
          _upiId      = d['upiId'];
          _upiName    = d['name'];
          _qrImageUrl = d['qrImageUrl'];
        });
      }
    } catch (_) {}
  }

  // ─────────────────────────────────────────────
  // RAZORPAY FLOW
  // ─────────────────────────────────────────────

  Future<void> _startRazorpayPayment() async {
    setState(() { _loading = true; _error = null; });
    try {
      // Create order on backend
      final res = await ApiClient.post('/payments/razorpay/create-order', data: {
        'rideId': widget.rideId,
      });

      final orderData = res.data['data'];
      _orderId = orderData['orderId'];

      final prefs = await SharedPreferences.getInstance();
      final userName  = prefs.getString('user_name')  ?? 'Volzo Rider';
      final userPhone = prefs.getString('user_phone') ?? '';
      final userEmail = prefs.getString('user_email') ?? 'rider@volzo.in';

      final options = {
        'key':         orderData['keyId'],
        'amount':      orderData['amount'],
        'currency':    'INR',
        'name':        'Volzo Mobility',
        'description': 'Ride ${widget.rideNumber}',
        'order_id':    orderData['orderId'],
        'prefill': {
          'contact': userPhone,
          'email':   userEmail,
          'name':    userName,
        },
        'theme': {
          'color': '#1565C0',
        },
        'notes': {
          'rideId':     widget.rideId,
          'rideNumber': widget.rideNumber,
        }
      };

      _razorpay.open(options);
    } catch (e) {
      setState(() {
        _error = e is DioException
            ? (e.response?.data?['message'] ?? 'Failed to create payment order')
            : 'Something went wrong. Please try again.';
        _loading = false;
      });
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    setState(() { _loading = true; });
    try {
      await ApiClient.post('/payments/razorpay/verify', data: {
        'rideId':             widget.rideId,
        'razorpayOrderId':    response.orderId,
        'razorpayPaymentId':  response.paymentId,
        'razorpaySignature':  response.signature,
      });

      setState(() { _paymentDone = true; _loading = false; });
      _successController.forward();
      HapticFeedback.heavyImpact();
    } catch (e) {
      setState(() {
        _error = 'Payment done but verification failed. Please contact support.';
        _loading = false;
      });
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    setState(() {
      _error = response.message ?? 'Payment failed. Please try again.';
      _loading = false;
    });
    HapticFeedback.mediumImpact();
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('External wallet: ${response.walletName}')),
    );
    setState(() { _loading = false; });
  }

  // ─────────────────────────────────────────────
  // UPI QR CONFIRM FLOW
  // ─────────────────────────────────────────────

  Future<void> _confirmUpiPayment(String? txnId) async {
    setState(() { _loading = true; _error = null; });
    try {
      // First initiate payment record
      final initiateRes = await ApiClient.post('/payments/initiate', data: {
        'rideId': widget.rideId,
      });
      final paymentId = initiateRes.data['data']['paymentId'];

      // Then confirm with optional transaction ID
      await ApiClient.post('/payments/$paymentId/confirm', data: {
        'upiTransactionId': txnId ?? '',
        'note': 'Rider confirmed via QR',
      });

      setState(() { _paymentDone = true; _loading = false; });
      _successController.forward();
      HapticFeedback.heavyImpact();
    } catch (e) {
      setState(() {
        _error = e is DioException
            ? (e.response?.data?['message'] ?? 'Confirmation failed')
            : 'Network error. Please try again.';
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _razorpay.clear();
    _pulseController.dispose();
    _successController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_paymentDone) return _buildSuccessScreen();

    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      appBar: AppBar(
        title: const Text('Payment'),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: ThemeConfig.textPrimaryColor,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Amount card
            _buildAmountCard(),
            const SizedBox(height: 24),

            // Payment method selector
            _buildMethodSelector(),
            const SizedBox(height: 24),

            // Method-specific UI
            if (_selectedMethod == 'razorpay') ...[
              _buildRazorpaySection(),
            ] else ...[
              _buildQrSection(),
            ],

            // Error
            if (_error != null) ...[
              const SizedBox(height: 16),
              _buildErrorBanner(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAmountCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1565C0), Color(0xFF0D47A1)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1565C0).withOpacity(0.4),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          const Text('Total Amount', style: TextStyle(color: Colors.white70, fontSize: 14)),
          const SizedBox(height: 8),
          Text(
            '₹${widget.amount.toStringAsFixed(0)}',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 48,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Ride ${widget.rideNumber}',
            style: const TextStyle(color: Colors.white60, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildMethodSelector() {
    return Row(
      children: [
        Expanded(child: _methodTab('razorpay', Icons.payment, 'Pay Online')),
        const SizedBox(width: 12),
        Expanded(child: _methodTab('upi_qr', Icons.qr_code, 'UPI / QR')),
      ],
    );
  }

  Widget _methodTab(String method, IconData icon, String label) {
    final selected = _selectedMethod == method;
    return GestureDetector(
      onTap: () => setState(() => _selectedMethod = method),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected ? ThemeConfig.primaryColor : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? ThemeConfig.primaryColor : Colors.grey.shade200,
            width: 2,
          ),
          boxShadow: selected ? [
            BoxShadow(
              color: ThemeConfig.primaryColor.withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            )
          ] : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: selected ? Colors.white : Colors.grey.shade600, size: 20),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                color: selected ? Colors.white : Colors.grey.shade700,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRazorpaySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12),
            ],
          ),
          child: Column(
            children: [
              const Icon(Icons.security, color: Color(0xFF1565C0), size: 36),
              const SizedBox(height: 12),
              const Text(
                'Secure Payment via Razorpay',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              const SizedBox(height: 8),
              Text(
                'Pay using UPI, Cards, Net Banking, or Wallets',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              // Payment icons
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: ['GPay', 'PhonePe', 'Paytm', 'Cards'].map((name) =>
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(name, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600)),
                  )
                ).toList(),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _loading ? null : _startRazorpayPayment,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1565C0),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 18),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 0,
          ),
          child: _loading
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                )
              : Text(
                  'Pay ₹${widget.amount.toStringAsFixed(0)}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
        ),
      ],
    );
  }

  Widget _buildQrSection() {
    final txnController = TextEditingController();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 12),
            ],
          ),
          child: Column(
            children: [
              // QR image
              if (_qrImageUrl != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    _qrImageUrl!,
                    width: 200,
                    height: 200,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 200,
                      height: 200,
                      color: Colors.grey.shade100,
                      child: const Icon(Icons.qr_code, size: 80, color: Colors.grey),
                    ),
                  ),
                )
              else
                Container(
                  width: 200,
                  height: 200,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Center(child: CircularProgressIndicator()),
                ),

              const SizedBox(height: 16),
              if (_upiId != null) ...[
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                      Text('UPI ID', style: TextStyle(color: Colors.blue.shade700, fontSize: 11, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      GestureDetector(
                        onTap: () {
                          Clipboard.setData(ClipboardData(text: _upiId!));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('UPI ID copied!')),
                          );
                        },
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_upiId!, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                            const SizedBox(width: 8),
                            Icon(Icons.copy, size: 14, color: Colors.blue.shade700),
                          ],
                        ),
                      ),
                      if (_upiName != null)
                        Text(_upiName!, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Column(
                  children: [
                    Text(
                      'Amount to Pay: ₹${widget.amount.toStringAsFixed(0)}',
                      style: TextStyle(
                        color: Colors.orange.shade800,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Pay exact amount using any UPI app',
                      style: TextStyle(color: Colors.orange.shade600, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Optional: enter UPI transaction ID
        TextField(
          controller: txnController,
          decoration: InputDecoration(
            labelText: 'UPI Transaction ID (optional)',
            hintText: 'e.g., 123456789012',
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            prefixIcon: const Icon(Icons.receipt_long),
          ),
        ),

        const SizedBox(height: 16),

        ElevatedButton(
          onPressed: _loading ? null : () => _confirmUpiPayment(txnController.text.trim()),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1565C0),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 18),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 0,
          ),
          child: _loading
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                )
              : const Text(
                  "I've Paid — Confirm",
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                ),
        ),

        const SizedBox(height: 12),
        Text(
          'Tap after completing the UPI payment. Your driver will verify.',
          style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: Colors.red.shade600),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _error!,
              style: TextStyle(color: Colors.red.shade700, fontSize: 13),
            ),
          ),
          GestureDetector(
            onTap: () => setState(() => _error = null),
            child: Icon(Icons.close, size: 18, color: Colors.red.shade400),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccessScreen() {
    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF1565C0), Color(0xFF00BCD4)],
                    ),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF1565C0).withOpacity(0.4),
                        blurRadius: 24,
                        spreadRadius: 4,
                      ),
                    ],
                  ),
                  child: const Icon(Icons.check_rounded, color: Colors.white, size: 56),
                ),
                const SizedBox(height: 32),
                const Text(
                  'Payment Successful!',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                Text(
                  '₹${widget.amount.toStringAsFixed(0)} paid for ride ${widget.rideNumber}',
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 15),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1565C0),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('Back to Home', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
