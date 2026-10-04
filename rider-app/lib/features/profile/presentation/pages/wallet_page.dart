import 'package:flutter/material.dart';
import '../../../../core/config/theme_config.dart';

class WalletPage extends StatefulWidget {
  const WalletPage({super.key});

  @override
  State<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends State<WalletPage> {
  double _balance = 350.00;
  bool _isLoading = false;
  final TextEditingController _amountController = TextEditingController();
  
  final List<Map<String, dynamic>> _transactions = [
    {
      'title': 'Volzo EV Ride - Gurgaon Huda City',
      'subtitle': '25 May, 08:30 PM',
      'amount': -145.00,
      'isCredit': false,
      'type': 'RIDE',
    },
    {
      'title': 'Added via UPI (Google Pay)',
      'subtitle': '24 May, 11:15 AM',
      'amount': 500.00,
      'isCredit': true,
      'type': 'RECHARGE',
    },
    {
      'title': 'EV Eco Ride - Delhi Metro Stn',
      'subtitle': '22 May, 06:10 PM',
      'amount': -85.00,
      'isCredit': false,
      'type': 'RIDE',
    },
    {
      'title': 'First Ride Promo Code Cashback',
      'subtitle': '20 May, 09:40 AM',
      'amount': 50.00,
      'isCredit': true,
      'type': 'REWARD',
    },
    {
      'title': 'Zero-Emission Eco Bonus',
      'subtitle': '18 May, 02:22 PM',
      'amount': 30.00,
      'isCredit': true,
      'type': 'BONUS',
    },
  ];

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  void _addMoney(double amount) {
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid amount'),
          backgroundColor: ThemeConfig.errorColor,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    // Simulate Network Request / Payment Gateway Processing
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (!mounted) return;
      setState(() {
        _balance += amount;
        _transactions.insert(0, {
          'title': 'Added via Wallet Top-up',
          'subtitle': 'Just Now',
          'amount': amount,
          'isCredit': true,
          'type': 'RECHARGE',
        });
        _isLoading = false;
        _amountController.clear();
      });

      // Show Premium Success Sheet
      showModalBottomSheet(
        context: context,
        backgroundColor: ThemeConfig.surfaceColor,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        builder: (context) => Container(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: ThemeConfig.successColor.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle_outline,
                  color: ThemeConfig.successColor,
                  size: 64,
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Top-up Successful!',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '₹${amount.toStringAsFixed(2)} has been loaded into your Volzo Wallet successfully.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: ThemeConfig.textSecondaryColor,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ThemeConfig.primaryColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: const Text('Back to Wallet', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),
      );
    });
  }

  void _showUPIQRCode() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Row(
          children: [
            Icon(Icons.qr_code_2, color: ThemeConfig.primaryColor, size: 24),
            SizedBox(width: 10),
            Text(
              'UPI QR Code',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Scan this custom QR using any UPI app (GPay, PhonePe, Paytm) to recharge your Volzo Wallet instantly.',
              style: TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Image.network(
                'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=volzo@sbi%26pn=Volzo%20Mobility%26am=100%26cu=INR',
                width: 180,
                height: 180,
                errorBuilder: (context, error, stackTrace) => Container(
                  width: 180,
                  height: 180,
                  color: Colors.grey[200],
                  child: const Icon(Icons.qr_code, color: Colors.black, size: 64),
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'UPI ID: volzo@sbi',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
            ),
            const Text(
              'Merchant: Volzo Mobility Pvt Ltd',
              style: TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 10),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Dismiss', style: TextStyle(color: ThemeConfig.textSecondaryColor)),
          ),
        ],
      ),
    );
  }

  void _simulateUPIPaymentScan() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.85,
        decoration: const BoxDecoration(
          color: ThemeConfig.backgroundColor,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 16),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24),
              child: Row(
                children: [
                  Icon(Icons.qr_code_scanner, color: ThemeConfig.primaryColor),
                  SizedBox(width: 12),
                  Text(
                    'Scan & Pay via UPI',
                    style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Mock camera scan viewfinder
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 24),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.6),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.photo_camera_outlined, color: Colors.white24, size: 64),
                          const SizedBox(height: 16),
                          Text(
                            'Align the merchant QR code inside the box',
                            style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ),
                  
                  // Scanning target box with dynamic laser animation
                  Container(
                    width: 220,
                    height: 220,
                    decoration: BoxDecoration(
                      border: Border.all(color: ThemeConfig.primaryColor, width: 3),
                      borderRadius: BorderRadius.circular(24),
                    ),
                  ),

                  // Close button
                  Positioned(
                    bottom: 40,
                    child: FloatingActionButton(
                      onPressed: () {
                        Navigator.pop(context);
                        // Trigger immediate mock payment success
                        _simulateDirectQRTransfer();
                      },
                      backgroundColor: ThemeConfig.primaryColor,
                      child: const Icon(Icons.flash_on, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Demo Tip: Tap the flash icon below to simulate a successful payment scan!',
                textAlign: TextAlign.center,
                style: TextStyle(color: ThemeConfig.primaryColor.withOpacity(0.8), fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _simulateDirectQRTransfer() {
    setState(() => _isLoading = true);
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (!mounted) return;
      setState(() {
        _balance -= 120.00;
        _transactions.insert(0, {
          'title': 'Paid to EV Scooter Terminal',
          'subtitle': 'Just Now',
          'amount': -120.00,
          'isCredit': false,
          'type': 'SCAN_PAY',
        });
        _isLoading = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('UPI QR Transfer of ₹120.00 Successful!'),
          backgroundColor: ThemeConfig.successColor,
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      appBar: AppBar(
        title: const Text('Volzo Wallet', style: TextStyle(fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(ThemeConfig.primaryColor)))
          : SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Gradient Premium Balance Card
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [ThemeConfig.primaryColor, Color(0xFF00388F)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: ThemeConfig.primaryColor.withOpacity(0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'VOLZO PASS BALANCE',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.5,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Row(
                                children: [
                                  Icon(Icons.eco, color: ThemeConfig.secondaryColor, size: 12),
                                  SizedBox(width: 4),
                                  Text(
                                    '100% Eco',
                                    style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '₹${_balance.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 36,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 24),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: _showUPIQRCode,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white,
                                  foregroundColor: ThemeConfig.primaryColor,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                icon: const Icon(Icons.qr_code, size: 18),
                                label: const Text('My QR ID', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: _simulateUPIPaymentScan,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.white.withOpacity(0.15),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                icon: const Icon(Icons.qr_code_scanner, size: 18),
                                label: const Text('Scan QR', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Recharge Section Header
                  const Text(
                    'QUICK TOP-UP WALLET',
                    style: TextStyle(
                      color: ThemeConfig.textTertiaryColor,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Presets Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [100.0, 200.0, 500.0, 1000.0].map((amt) {
                      return Expanded(
                        child: InkWell(
                          onTap: () => _addMoney(amt),
                          child: Container(
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            decoration: BoxDecoration(
                              color: ThemeConfig.surfaceColor,
                              border: Border.all(color: Colors.white.withOpacity(0.04)),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '+₹${amt.toInt()}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  // Custom input field
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _amountController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            hintText: 'Enter other amount...',
                            hintStyle: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 14),
                            prefixIcon: const Icon(Icons.currency_rupee, color: ThemeConfig.primaryColor, size: 18),
                            filled: true,
                            fillColor: ThemeConfig.surfaceColor,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        onPressed: () {
                          final customVal = double.tryParse(_amountController.text.trim()) ?? 0.0;
                          _addMoney(customVal);
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: ThemeConfig.primaryColor,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        ),
                        child: const Icon(Icons.add, color: Colors.white),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // Transaction History Header
                  const Text(
                    'TRANSACTION HISTORY',
                    style: TextStyle(
                      color: ThemeConfig.textTertiaryColor,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Transaction List
                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _transactions.length,
                    itemBuilder: (context, index) {
                      final tx = _transactions[index];
                      final isCredit = tx['isCredit'] as bool;
                      final type = tx['type'] as String;

                      Color badgeColor = Colors.redAccent;
                      IconData txIcon = Icons.arrow_outward;

                      if (isCredit) {
                        badgeColor = ThemeConfig.successColor;
                        txIcon = Icons.call_received;
                      } else if (type == 'SCAN_PAY') {
                        badgeColor = ThemeConfig.secondaryColor;
                        txIcon = Icons.qr_code;
                      }

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: ThemeConfig.surfaceColor,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: Colors.white.withOpacity(0.03)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: badgeColor.withOpacity(0.1),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(txIcon, color: badgeColor, size: 18),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    tx['title'],
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    tx['subtitle'],
                                    style: const TextStyle(
                                      color: ThemeConfig.textSecondaryColor,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              '${isCredit ? "+" : "-"}₹${(tx['amount'] as double).abs().toStringAsFixed(0)}',
                              style: TextStyle(
                                color: isCredit ? ThemeConfig.successColor : Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
    );
  }
}
