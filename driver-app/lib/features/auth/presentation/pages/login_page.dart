/**
 * Volzo Driver App — Login Page
 * Dark-mode glassmorphic phone OTP auth with driver-specific branding,
 * animated earnings ticker, and Firebase verification.
 */

import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import 'otp_verification_page.dart';
import '../../../home/presentation/pages/home_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> with TickerProviderStateMixin {
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;

  late AnimationController _orbController;
  late AnimationController _entryController;
  late AnimationController _glowController;

  late Animation<double> _orbRotate;
  late Animation<double> _entrySlide;
  late Animation<double> _entryFade;
  late Animation<double> _glow;

  @override
  void initState() {
    super.initState();

    _orbController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10),
    )..repeat();
    _orbRotate = Tween<double>(begin: 0, end: 2 * math.pi)
        .animate(CurvedAnimation(parent: _orbController, curve: Curves.linear));

    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    )..repeat(reverse: true);
    _glow = Tween<double>(begin: 0.35, end: 0.85)
        .animate(CurvedAnimation(parent: _glowController, curve: Curves.easeInOut));

    _entryController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 950),
    )..forward();
    _entrySlide = Tween<double>(begin: 80.0, end: 0.0).animate(
      CurvedAnimation(parent: _entryController, curve: Curves.easeOutCubic),
    );
    _entryFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
          parent: _entryController,
          curve: const Interval(0.15, 1.0, curve: Curves.easeOut)),
    );
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _orbController.dispose();
    _entryController.dispose();
    _glowController.dispose();
    super.dispose();
  }

  Future<void> _sendOTP() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _isLoading = true);
    final phone = '+91${_phoneController.text.trim()}';

    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: phone,
        verificationCompleted: (PhoneAuthCredential credential) async {
          final uc = await FirebaseAuth.instance.signInWithCredential(credential);
          final idToken = await uc.user?.getIdToken();
          if (idToken != null && mounted) {
            await _loginToBackend(idToken, phone);
          }
        },
        verificationFailed: (FirebaseAuthException e) {
          if (!mounted) return;
          setState(() => _isLoading = false);
          _showError(e.message ?? 'Verification failed');
        },
        codeSent: (String verificationId, int? resendToken) {
          if (!mounted) return;
          setState(() => _isLoading = false);
          Navigator.push(
            context,
            PageRouteBuilder(
              pageBuilder: (_, a, __) => OTPVerificationPage(
                verificationId: verificationId,
                phoneNumber: phone,
              ),
              transitionsBuilder: (_, a, __, child) => SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(1.0, 0.0),
                  end: Offset.zero,
                ).animate(CurvedAnimation(parent: a, curve: Curves.easeOutCubic)),
                child: child,
              ),
              transitionDuration: const Duration(milliseconds: 450),
            ),
          );
        },
        codeAutoRetrievalTimeout: (_) {},
        timeout: const Duration(seconds: 60),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showError('Failed to send OTP. Check your connection.');
    }
  }

  Future<void> _loginToBackend(String idToken, String phoneNumber,
      {String? name}) async {
    try {
      final response = await ApiClient.post('/auth/verify-otp', data: {
        'phone': phoneNumber,
        'firebaseToken': idToken,
        if (name != null) 'name': name,
      });

      if (!mounted) return;

      if (response.statusCode == 200) {
        final data = response.data['data'];
        await ApiClient.saveToken(data['token']);
        if (data['driver'] != null) {
          await ApiClient.saveDriverData(data['driver']);
        }
        Navigator.of(context).pushAndRemoveUntil(
          PageRouteBuilder(
            pageBuilder: (_, a, __) => const HomePage(),
            transitionsBuilder: (_, a, __, child) =>
                FadeTransition(opacity: a, child: child),
            transitionDuration: const Duration(milliseconds: 600),
          ),
          (route) => false,
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showError(ApiClient.getErrorMessage(e));
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(children: [
          const Icon(Icons.error_outline, color: Colors.white, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(message, style: const TextStyle(color: Colors.white))),
        ]),
        backgroundColor: const Color(0xFFEF4444),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: Colors.white,
        resizeToAvoidBottomInset: true,
        body: Stack(
          children: [
            _buildBackground(size),
            SafeArea(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: EdgeInsets.only(
                  bottom: MediaQuery.of(context).viewInsets.bottom + 24,
                ),
                child: AnimatedBuilder(
                  animation: _entryController,
                  builder: (_, child) => Transform.translate(
                    offset: Offset(0, _entrySlide.value),
                    child: Opacity(opacity: _entryFade.value, child: child),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 40),
                          _buildLogoArea(),
                          const SizedBox(height: 36),
                          _buildDriverBenefits(),
                          const SizedBox(height: 40),
                          _buildPhoneField(),
                          const SizedBox(height: 20),
                          _buildSendOTPButton(),
                          const SizedBox(height: 20),
                          _buildDevButton(),
                          const SizedBox(height: 32),
                          _buildTerms(),
                          const SizedBox(height: 24),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBackground(Size size) {
    return AnimatedBuilder(
      animation: _orbRotate,
      builder: (_, __) => Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0.3, -0.6),
                radius: 1.3,
                colors: [Color(0xFFF8FAFC), Colors.white],
              ),
            ),
          ),
          Positioned(
            top: -60,
            right: -80 + 50 * math.sin(_orbRotate.value * 0.25),
            child: AnimatedBuilder(
              animation: _glow,
              builder: (_, __) => Container(
                width: 260,
                height: 260,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF0066FF).withOpacity(_glow.value * 0.2),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -80,
            left: -60 + 40 * math.cos(_orbRotate.value * 0.3),
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF0066FF).withOpacity(0.2),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogoArea() {
    return Column(
      children: [
        AnimatedBuilder(
          animation: _glowController,
          builder: (_, child) => Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: const LinearGradient(
                colors: [Color(0xFF0066FF), Color(0xFF00D9FF)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0066FF).withOpacity(_glow.value),
                  blurRadius: 28,
                  spreadRadius: 3,
                ),
              ],
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  margin: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: Colors.white.withOpacity(0.15),
                  ),
                ),
                const Icon(Icons.directions_car_rounded, color: Colors.white, size: 48),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            children: [
              const TextSpan(
                text: 'Volzo ',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF060811),
                  letterSpacing: -0.5,
                ),
              ),
              TextSpan(
                text: 'Driver',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                  foreground: Paint()
                    ..shader = const LinearGradient(
                      colors: [Color(0xFF0066FF), Color(0xFF00D9FF)],
                    ).createShader(const Rect.fromLTWH(0, 0, 120, 50)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Earn more. Drive green. Live free.',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            color: Color(0xFF7F8C8D),
            fontWeight: FontWeight.w400,
          ),
        ),
      ],
    );
  }

  Widget _buildDriverBenefits() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          _benefitRow(Icons.account_balance_wallet_rounded, '₹25,000+',
              'Average monthly earnings', const Color(0xFF0066FF)),
          const SizedBox(height: 14),
          _benefitRow(Icons.schedule_rounded, 'Flexible Hours',
              'Work when you want', const Color(0xFF0066FF)),
          const SizedBox(height: 14),
          _benefitRow(Icons.eco_rounded, 'Zero Emissions',
              'EV rides — green & clean', const Color(0xFF00D9FF)),
        ],
      ),
    );
  }

  Widget _benefitRow(IconData icon, String title, String subtitle, Color color) {
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(
                    color: Color(0xFF1A1A1A),
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  )),
              Text(subtitle,
                  style: TextStyle(
                    color: Color(0xFF7F8C8D),
                    fontSize: 12,
                    fontWeight: FontWeight.w400,
                  )),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Phone Number',
          style: TextStyle(
            color: Color(0xFF1A1A1A).withOpacity(0.7),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1A1A1A),
            letterSpacing: 2.0,
          ),
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(
            counterText: '',
            hintText: '98765 43210',
            hintStyle: TextStyle(
              color: Color(0xFF1A1A1A).withOpacity(0.2),
              fontSize: 18,
              fontWeight: FontWeight.w400,
              letterSpacing: 2.0,
            ),
            prefix: Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF0066FF).withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: const Color(0xFF0066FF).withOpacity(0.2),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('🇮🇳', style: TextStyle(fontSize: 16)),
                  const SizedBox(width: 6),
                  Text(
                    '+91',
                    style: TextStyle(
                      color: Color(0xFF1A1A1A),
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ),
            filled: true,
            fillColor: const Color(0xFFF1F5F9),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide:
                  const BorderSide(color: Color(0xFF0066FF), width: 1.8),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide:
                  const BorderSide(color: Color(0xFFEF4444), width: 1.5),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide:
                  const BorderSide(color: Color(0xFFEF4444), width: 1.8),
            ),
            errorStyle:
                const TextStyle(color: Color(0xFFEF4444), fontSize: 12),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 18, vertical: 18),
          ),
          validator: (value) {
            if (value == null || value.trim().isEmpty) {
              return 'Please enter your 10-digit phone number';
            }
            if (value.trim().length != 10) {
              return 'Enter a valid 10-digit Indian mobile number';
            }
            if (!RegExp(r'^[6-9]\d{9}$').hasMatch(value.trim())) {
              return 'Number must start with 6, 7, 8 or 9';
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildSendOTPButton() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      height: 58,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: _isLoading
            ? LinearGradient(
                colors: [
                  const Color(0xFF0066FF).withOpacity(0.4),
                  const Color(0xFF00D9FF).withOpacity(0.4),
                ],
              )
            : const LinearGradient(
                colors: [Color(0xFF0066FF), Color(0xFF00D9FF)],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
        boxShadow: _isLoading
            ? []
            : [
                BoxShadow(
                  color: const Color(0xFF0066FF).withOpacity(0.3),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
      ),
      child: ElevatedButton(
        onPressed: _isLoading ? null : _sendOTP,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          disabledBackgroundColor: Colors.transparent,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        child: _isLoading
            ? const SizedBox(
                height: 22,
                width: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(Icons.phone_android_rounded, size: 20, color: Colors.white),
                  SizedBox(width: 10),
                  Text(
                    'Continue as Driver',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildDevButton() {
    return GestureDetector(
      onTap: _isLoading
          ? null
          : () async {
              setState(() => _isLoading = true);
              await _loginToBackend(
                'mock_driver_token_dev_123',
                '+919999999999',
                name: 'Dev Driver',
              );
            },
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: const Color(0xFF0066FF).withOpacity(0.08),
          borderRadius: BorderRadius.circular(16),
          border:
              Border.all(color: const Color(0xFF0066FF).withOpacity(0.25)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: const Color(0xFF0066FF).withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.flash_on_rounded,
                  color: Color(0xFF0066FF), size: 14),
            ),
            const SizedBox(width: 10),
            const Text(
              'Instant Dev Login',
              style: TextStyle(
                color: Color(0xFF0066FF),
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTerms() {
    return Text(
      'By continuing, you agree to Volzo\'s Driver Partner Terms and Privacy Policy.',
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: 11,
        color: Color(0xFF7F8C8D).withOpacity(0.5),
        height: 1.6,
      ),
    );
  }
}
