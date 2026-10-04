/**
 * Driver Payment Verification Page
 *
 * Shown after the rider has confirmed payment via QR/UPI.
 * Driver verifies the payment or rejects it.
 * 
 * NOTE: This replaces the orphaned foolproof_payment_page,
 * simple_payment_page, and test_payment_page files.
 */

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:dio/dio.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/config/theme_config.dart';

class PaymentVerificationPage extends StatefulWidget {
  final String rideId;
  final String rideNumber;
  final double amount;
  final String? paymentId;
  final String? riderName;
  final String? upiTransactionId;
  final String? screenshotUrl;

  const PaymentVerificationPage({
    super.key,
    required this.rideId,
    required this.rideNumber,
    required this.amount,
    this.paymentId,
    this.riderName,
    this.upiTransactionId,
    this.screenshotUrl,
  });

  @override
  State<PaymentVerificationPage> createState() => _PaymentVerificationPageState();
}

class _PaymentVerificationPageState extends State<PaymentVerificationPage> {
  bool _loading        = false;
  bool _loadingPayment = true;
  Map<String, dynamic>? _payment;
  String? _error;
  String? _rejectionReason;
  bool _showRejectInput = false;
  final _reasonController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadPayment();
  }

  Future<void> _loadPayment() async {
    setState(() => _loadingPayment = true);
    try {
      // Try by payment ID first, then by ride ID
      Response res;
      if (widget.paymentId != null) {
        res = await ApiClient.get('/payments/${widget.paymentId}');
      } else {
        res = await ApiClient.get('/payments/ride/${widget.rideId}');
      }

      if (res.data['success'] == true) {
        setState(() {
          _payment = res.data['data']['payment'];
          _loadingPayment = false;
        });
      }
    } catch (e) {
      setState(() {
        _loadingPayment = false;
        _error = 'Could not load payment details';
      });
    }
  }

  Future<void> _verifyPayment(bool isVerified) async {
    if (!isVerified && _reasonController.text.trim().isEmpty) {
      setState(() => _showRejectInput = true);
      return;
    }

    setState(() { _loading = true; _error = null; });
    try {
      final paymentId = widget.paymentId ?? _payment?['id'];
      if (paymentId == null) throw Exception('Payment ID not found');

      await ApiClient.post('/payments/$paymentId/verify', data: {
        'isVerified':      isVerified,
        'rejectionReason': isVerified ? null : _reasonController.text.trim(),
      });

      HapticFeedback.heavyImpact();

      if (mounted) {
        _showResultDialog(isVerified);
      }
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e is DioException
            ? (e.response?.data?['message'] ?? 'Verification failed')
            : e.toString();
      });
    }
  }

  void _showResultDialog(bool verified) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: verified ? const Color(0xFF1565C0).withOpacity(0.1) : Colors.red.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                verified ? Icons.check_circle : Icons.cancel,
                color: verified ? const Color(0xFF1565C0) : Colors.red,
                size: 44,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              verified ? 'Payment Verified!' : 'Payment Rejected',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
            ),
            const SizedBox(height: 8),
            Text(
              verified
                  ? '₹${widget.amount.toStringAsFixed(0)} confirmed for ride ${widget.rideNumber}'
                  : 'Rider has been notified about the rejection',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.of(context).popUntil((r) => r.isFirst);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1565C0),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Done', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F8FF),
      appBar: AppBar(
        title: const Text('Verify Payment'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1A2038),
        elevation: 0,
      ),
      body: _loadingPayment
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Payment summary card
                  _buildSummaryCard(),
                  const SizedBox(height: 20),

                  // UPI screenshot if available
                  if ((_payment?['paymentScreenshot'] ?? widget.screenshotUrl) != null) ...[
                    _buildScreenshotCard(),
                    const SizedBox(height: 20),
                  ],

                  // Transaction ID
                  if ((_payment?['upiTransactionId'] ?? widget.upiTransactionId)?.isNotEmpty == true) ...[
                    _buildTransactionIdCard(),
                    const SizedBox(height: 20),
                  ],

                  // Error
                  if (_error != null) ...[
                    _buildErrorBanner(),
                    const SizedBox(height: 16),
                  ],

                  // Reject reason input
                  if (_showRejectInput) ...[
                    _buildRejectInput(),
                    const SizedBox(height: 16),
                  ],

                  // Action buttons
                  _buildActionButtons(),
                ],
              ),
            ),
    );
  }

  Widget _buildSummaryCard() {
    final status = _payment?['status'] ?? 'PENDING';
    final riderName = _payment?['ride']?['rider']?['name'] ?? widget.riderName ?? 'Rider';
    final method    = _payment?['method'] ?? 'QR_UPI';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1565C0), Color(0xFF0D47A1)],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF1565C0).withOpacity(0.35),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Amount to Verify', style: TextStyle(color: Colors.white70, fontSize: 13)),
                Text(
                  '₹${widget.amount.toStringAsFixed(0)}',
                  style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w800),
                ),
              ]),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Icon(
                      method == 'RAZORPAY' ? Icons.payment : Icons.qr_code,
                      color: Colors.white,
                      size: 14,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      method == 'RAZORPAY' ? 'Razorpay' : 'UPI/QR',
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: Colors.white24),
          const SizedBox(height: 12),
          Row(
            children: [
              CircleAvatar(
                backgroundColor: Colors.white24,
                radius: 18,
                child: Text(
                  riderName.isNotEmpty ? riderName[0].toUpperCase() : 'R',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Rider', style: TextStyle(color: Colors.white60, fontSize: 11)),
                  Text(riderName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                ]),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: status == 'RIDER_CONFIRMED' ? Colors.green.withOpacity(0.2) : Colors.orange.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: status == 'RIDER_CONFIRMED' ? Colors.green.withOpacity(0.5) : Colors.orange.withOpacity(0.5),
                  ),
                ),
                child: Text(
                  status == 'RIDER_CONFIRMED' ? 'Rider Confirmed' : 'Awaiting',
                  style: TextStyle(
                    color: status == 'RIDER_CONFIRMED' ? Colors.green.shade200 : Colors.orange.shade200,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Ride ${widget.rideNumber}',
            style: const TextStyle(color: Colors.white38, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildScreenshotCard() {
    final url = _payment?['paymentScreenshot'] ?? widget.screenshotUrl;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Payment Screenshot', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          constraints: const BoxConstraints(maxHeight: 300),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 10)],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: Image.network(
              url,
              fit: BoxFit.contain,
              loadingBuilder: (_, child, progress) => progress == null
                  ? child
                  : const Center(child: CircularProgressIndicator()),
              errorBuilder: (_, __, ___) => const Center(
                child: Text('Screenshot unavailable', style: TextStyle(color: Colors.grey)),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTransactionIdCard() {
    final txnId = _payment?['upiTransactionId'] ?? widget.upiTransactionId;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.blue.shade100),
      ),
      child: Row(
        children: [
          const Icon(Icons.receipt_long, color: Color(0xFF1565C0)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('UPI Transaction ID', style: TextStyle(color: Colors.grey, fontSize: 12)),
              Text(txnId ?? '—', style: const TextStyle(fontWeight: FontWeight.w600)),
            ]),
          ),
          IconButton(
            icon: const Icon(Icons.copy, size: 18, color: Colors.grey),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: txnId ?? ''));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Transaction ID copied')),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildRejectInput() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Reason for Rejection', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.red.shade700)),
          const SizedBox(height: 8),
          TextField(
            controller: _reasonController,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: 'e.g., Wrong amount paid, payment not received…',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.red.shade400),
              ),
            ),
          ),
        ],
      ),
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
          Expanded(child: Text(_error!, style: TextStyle(color: Colors.red.shade700, fontSize: 13))),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // VERIFY button
        ElevatedButton.icon(
          onPressed: _loading ? null : () => _verifyPayment(true),
          icon: _loading
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
              : const Icon(Icons.check_circle),
          label: const Text('Verify Payment', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1565C0),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 18),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 0,
          ),
        ),
        const SizedBox(height: 12),

        // REJECT button
        OutlinedButton.icon(
          onPressed: _loading ? null : () {
            if (_showRejectInput && _reasonController.text.trim().isNotEmpty) {
              _verifyPayment(false);
            } else {
              setState(() => _showRejectInput = !_showRejectInput);
            }
          },
          icon: Icon(
            _showRejectInput ? Icons.send : Icons.cancel_outlined,
            color: Colors.red.shade600,
          ),
          label: Text(
            _showRejectInput ? 'Submit Rejection' : 'Reject Payment',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Colors.red.shade600),
          ),
          style: OutlinedButton.styleFrom(
            side: BorderSide(color: Colors.red.shade300),
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
        ),
        const SizedBox(height: 12),

        Text(
          '⚠️ Only verify if you received the exact payment amount.',
          style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
