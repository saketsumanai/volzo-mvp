import 'package:flutter/material.dart';
import '../../../../core/config/theme_config.dart';

class CouponsPage extends StatefulWidget {
  const CouponsPage({super.key});

  @override
  State<CouponsPage> createState() => _CouponsPageState();
}

class _CouponsPageState extends State<CouponsPage> {
  final TextEditingController _couponController = TextEditingController();
  bool _isLoading = false;

  final List<Map<String, dynamic>> _coupons = [
    {
      'code': 'VOLZO50',
      'discount': '50% OFF',
      'desc': 'Get 50% off on your next 3 EV rides. Valid up to ₹75.',
      'expiry': 'Expires in 3 days',
      'isPopular': true,
    },
    {
      'code': 'GREENRIDER',
      'discount': 'FREE RIDE',
      'desc': 'First zero-carbon scooter trip is completely free (up to ₹50).',
      'expiry': 'Expires in 7 days',
      'isPopular': false,
    },
    {
      'code': 'UPITOPUP',
      'discount': '₹50 CASHBACK',
      'desc': 'Get ₹50 flat cashback when adding money to wallet using UPI.',
      'expiry': 'Expires on 31 May',
      'isPopular': false,
    },
    {
      'code': 'EVPOWER',
      'discount': '30% OFF',
      'desc': 'Exclusive discount on private rickshaw and EV cab bookings.',
      'expiry': 'Expires in 15 days',
      'isPopular': true,
    },
  ];

  @override
  void dispose() {
    _couponController.dispose();
    super.dispose();
  }

  void _applyPromoCode(String code) {
    if (code.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a promo code'),
          backgroundColor: ThemeConfig.errorColor,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    Future.delayed(const Duration(seconds: 1), () {
      if (!mounted) return;
      setState(() => _isLoading = false);

      final cleanCode = code.trim().toUpperCase();
      final couponFound = _coupons.any((c) => c['code'] == cleanCode);

      if (couponFound || cleanCode == 'VOLZO100') {
        _showSuccessDialog(cleanCode);
        _couponController.clear();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invalid coupon code. Please try VOLZO50!'),
            backgroundColor: ThemeConfig.errorColor,
          ),
        );
      }
    });
  }

  void _showSuccessDialog(String code) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: ThemeConfig.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Row(
          children: [
            Icon(Icons.stars, color: ThemeConfig.secondaryColor, size: 24),
            SizedBox(width: 10),
            Text('Promo Applied!', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Coupon "$code" has been applied successfully to your account.',
              style: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: ThemeConfig.primaryColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: ThemeConfig.primaryColor.withOpacity(0.2)),
              ),
              child: const Column(
                children: [
                  Text(
                    'DISCOUNT ACTIVATED',
                    style: TextStyle(color: ThemeConfig.primaryColor, fontWeight: FontWeight.bold, fontSize: 10, letterSpacing: 1.5),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Extra savings will be auto-calculated on your next ride estimate screen.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeConfig.primaryColor,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Awesome'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeConfig.backgroundColor,
      appBar: AppBar(
        title: const Text('Coupons & Offers', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(valueColor: AlwaysStoppedAnimation<Color>(ThemeConfig.primaryColor)))
          : SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Promotional Header Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF00C6FF), Color(0xFF0072FF)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: const Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'RIDE SMART, SAVE GREEN',
                                style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.5),
                              ),
                              SizedBox(height: 6),
                              Text(
                                'Ride Volzo EV Scooters & Cabs with Exclusive Discounts',
                                style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, height: 1.3),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(width: 16),
                        Icon(Icons.local_offer, color: Colors.white, size: 48),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Promo Code Input Box
                  const Text(
                    'ENTER PROMO CODE',
                    style: TextStyle(
                      color: ThemeConfig.textTertiaryColor,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _couponController,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                          decoration: InputDecoration(
                            hintText: 'e.g., VOLZO50',
                            hintStyle: const TextStyle(color: ThemeConfig.textSecondaryColor, fontSize: 13, fontWeight: FontWeight.normal),
                            filled: true,
                            fillColor: ThemeConfig.surfaceColor,
                            prefixIcon: const Icon(Icons.confirmation_number_outlined, color: ThemeConfig.primaryColor, size: 20),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        onPressed: () => _applyPromoCode(_couponController.text),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: ThemeConfig.primaryColor,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                        ),
                        child: const Text('Apply', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // Available Coupons Header
                  const Text(
                    'AVAILABLE OFFERS FOR YOU',
                    style: TextStyle(
                      color: ThemeConfig.textTertiaryColor,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Coupons list
                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _coupons.length,
                    itemBuilder: (context, index) {
                      final c = _coupons[index];
                      final bool isPopular = c['isPopular'] ?? false;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: ThemeConfig.surfaceColor,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: isPopular ? ThemeConfig.primaryColor.withOpacity(0.4) : Colors.white.withOpacity(0.04),
                            width: isPopular ? 1.5 : 1.0,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Card Top - Coupon Code Display
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: ThemeConfig.primaryColor.withOpacity(0.12),
                                      border: Border.all(color: ThemeConfig.primaryColor.withOpacity(0.3)),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      c['code'],
                                      style: const TextStyle(
                                        color: ThemeConfig.primaryColor,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 14,
                                        letterSpacing: 1.0,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    c['discount'],
                                    style: const TextStyle(
                                      color: ThemeConfig.secondaryColor,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 16,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Divider(color: Color(0xFF2C2C2C), height: 1),
                            // Card Bottom - Description and action
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    c['desc'],
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 12,
                                      height: 1.4,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Row(
                                        children: [
                                          const Icon(Icons.access_time, color: ThemeConfig.textTertiaryColor, size: 14),
                                          const SizedBox(width: 6),
                                          Text(
                                            c['expiry'],
                                            style: const TextStyle(color: ThemeConfig.textTertiaryColor, fontSize: 11),
                                          ),
                                        ],
                                      ),
                                      TextButton(
                                        onPressed: () => _applyPromoCode(c['code']),
                                        style: TextButton.styleFrom(
                                          foregroundColor: ThemeConfig.primaryColor,
                                          padding: const EdgeInsets.symmetric(horizontal: 16),
                                        ),
                                        child: const Text('Apply Code', style: TextStyle(fontWeight: FontWeight.bold)),
                                      ),
                                    ],
                                  ),
                                ],
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
