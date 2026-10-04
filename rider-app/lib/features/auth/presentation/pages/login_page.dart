/**
 * Volzo Rider App — Login Page
 * Glassmorphic animated phone OTP authentication
 * Production-grade with animated electric bolt logo, floating orbs,
 * adaptive keyboard avoidance, and Firebase OTP verification.
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

class _LoginPageState extends State<LoginPage>
    with TickerProviderStateMixin {
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;

  // Animation controllers
  late AnimationController _logoController;
  late AnimationController _orbController;
  late AnimationController _slideController;

  late Animation<double> _logoScale;
  late Animation<double> _logoGlow;
  late Animation<double> _orbRotate;
  late Animation<double> _slideUp;
  late Animation<double> _fadeIn;

  @override
  void initState() {
    super.initState();

    // Logo pulse animation
    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);

    _logoScale = Tween<double>(begin: 1.0, end: 1.06).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeInOut),
    );
    _logoGlow = Tween<double>(begin: 0.3, end: 0.8).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.easeInOut),
    );

    // Floating orb rotation
    _orbController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 8),
    )..repeat();
    _orbRotate = Tween<double>(begin: 0, end: 2 * math.pi).animate(
      CurvedAnimation(parent: _orbController, curve: Curves.linear),
    );

    // Entry slide-up animation
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();

    _slideUp = Tween<double>(begin: 60.0, end: 0.0).animate(
      CurvedAnimation(parent: _slideController, curve: Curves.easeOutCubic),
    );
    _fadeIn = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _slideController, curve: const Interval(0.2, 1.0)),
    );
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _logoController.dispose();
    _orbController.dispose();
    _slideController.dispose();
    super.dispose();
  }

  Future<void> _sendOTP() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _isLoading = true);

    final phoneNumber = '+91${_phoneController.text.trim()}';

    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: phoneNumber,
        verificationCompleted: (PhoneAuthCredential credential) async {
          // Android auto-verify
          await _signInWithCredential(credential, phoneNumber);
        },
        verificationFailed: (FirebaseAuthException e) {
          if (!mounted) return;
          setState(() => _isLoading = false);
          _showError(e.message ?? 'Verification failed. Check your number.');
        },
        codeSent: (String verificationId, int? resendToken) {
          if (!mounted) return;
          setState(() => _isLoading = false);
          Navigator.push(
            context,
            PageRouteBuilder(
              pageBuilder: (_, a, __) => OTPVerificationPage(
                verificationId: verificationId,
                phoneNumber: phoneNumber,
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
      _showError('Failed to send OTP. Please try again.');
    }
  }

  Future<void> _signInWithGoogle() async {
    setState(() => _isLoading = true);
    try {
      final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) {
        setState(() => _isLoading = false);
        return;
      }
      final GoogleSignInAuthentication auth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: auth.accessToken,
        idToken: auth.idToken,
      );
      final userCredential =
          await FirebaseAuth.instance.signInWithCredential(credential);
      final idToken = await userCredential.user?.getIdToken();
      final name = userCredential.user?.displayName ?? 'Google User';
      final phone = userCredential.user?.phoneNumber ?? '+919999999999';
      if (idToken != null) {
        await _loginToBackend(idToken, phone, name: name);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showMockGoogleDialog();
    }
  }

  void _showMockGoogleDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.g_mobiledata, color: Color(0xFF4285F4), size: 28),
          ),
          const SizedBox(width: 12),
          const Text('Google Auth', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        ]),
        content: Text(
          'Firebase SHA-1 not configured on this device.\n\nWould you like to simulate Google login with a test account?',
          style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 14, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: Colors.white.withOpacity(0.5))),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              setState(() => _isLoading = true);
              await _loginToBackend('mock_google_token_123', '+919999999999', name: 'Test Rider');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0066FF),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Simulate Login'),
          ),
        ],
      ),
    );
  }

  Future<void> _signInWithCredential(
    PhoneAuthCredential credential,
    String phoneNumber,
  ) async {
    try {
      final userCredential =
          await FirebaseAuth.instance.signInWithCredential(credential);
      final idToken = await userCredential.user?.getIdToken();
      if (idToken != null) await _loginToBackend(idToken, phoneNumber);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _showError('Auto sign-in failed. Please enter OTP manually.');
    }
  }

  Future<void> _loginToBackend(String idToken, String phoneNumber,
      {String? name}) async {
    try {
      final response = await ApiClient.post('/auth/login', data: {
        'idToken': idToken,
        'phoneNumber': phoneNumber,
        if (name != null) 'name': name,
      });
      if (response.data['success'] == true) {
        final token = response.data['data']['token'];
        await ApiClient.saveToken(token);
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          PageRouteBuilder(
            pageBuilder: (_, a, __) => const HomePage(),
            transitionsBuilder: (_, a, __, child) => FadeTransition(opacity: a, child: child),
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
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFF080A14),
        resizeToAvoidBottomInset: true,
        body: Stack(
          children: [
            // ─── Animated Background ─────────────────────────────────
            _buildAnimatedBackground(size),

            // ─── Main Content ─────────────────────────────────────────
            SafeArea(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: EdgeInsets.only(
                  bottom: MediaQuery.of(context).viewInsets.bottom + 24,
                ),
                child: AnimatedBuilder(
                  animation: _slideController,
                  builder: (context, child) => Transform.translate(
                    offset: Offset(0, _slideUp.value),
                    child: Opacity(opacity: _fadeIn.value, child: child),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28.0),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 48),
                          _buildLogoSection(),
                          const SizedBox(height: 40),
                          _buildHeaderText(),
                          const SizedBox(height: 36),
                          _buildPhoneField(),
                          const SizedBox(height: 20),
                          _buildGetStartedButton(),
                          const SizedBox(height: 32),
                          _buildDivider(),
                          const SizedBox(height: 24),
                          _buildGoogleButton(),
                          const SizedBox(height: 16),
                          _buildDevButton(),
                          const SizedBox(height: 36),
                          _buildTermsText(),
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

  Widget _buildAnimatedBackground(Size size) {
    return AnimatedBuilder(
      animation: _orbRotate,
      builder: (context, _) {
        return Stack(
          children: [
            // Deep background gradient
            Container(
              decoration: const BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment(-0.3, -0.5),
                  radius: 1.2,
                  colors: [Color(0xFF0A1628), Color(0xFF080A14)],
                ),
              ),
            ),
            // Top-left primary orb
            Positioned(
              top: -80,
              left: -80 + 60 * math.sin(_orbRotate.value * 0.3),
              child: Container(
                width: 280,
                height: 280,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF0066FF).withOpacity(0.25),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            // Bottom-right cyan orb
            Positioned(
              bottom: -60,
              right: -60 + 40 * math.cos(_orbRotate.value * 0.4),
              child: Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF00D9FF).withOpacity(0.2),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            // Mid-screen green EV orb
            Positioned(
              top: size.height * 0.45,
              right: -40 + 30 * math.sin(_orbRotate.value * 0.5),
              child: Container(
                width: 150,
                height: 150,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF00B14F).withOpacity(0.15),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildLogoSection() {
    return Center(
      child: AnimatedBuilder(
        animation: _logoController,
        builder: (_, child) => Transform.scale(
          scale: _logoScale.value,
          child: Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(26),
              gradient: const LinearGradient(
                colors: [Color(0xFF0066FF), Color(0xFF00D9FF)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0066FF).withOpacity(_logoGlow.value),
                  blurRadius: 30,
                  spreadRadius: 4,
                ),
              ],
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Inner glassmorphic shimmer
                Container(
                  margin: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(18),
                    color: Colors.white.withOpacity(0.15),
                  ),
                ),
                // Lightning bolt icon
                const Icon(
                  Icons.bolt_rounded,
                  color: Colors.white,
                  size: 52,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderText() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            children: [
              const TextSpan(
                text: 'Welcome to ',
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -0.8,
                  height: 1.1,
                ),
              ),
              TextSpan(
                text: 'Volzo',
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.8,
                  height: 1.1,
                  foreground: Paint()
                    ..shader = const LinearGradient(
                      colors: [Color(0xFF0066FF), Color(0xFF00D9FF)],
                    ).createShader(const Rect.fromLTWH(0, 0, 200, 70)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Your intelligent EV ride companion',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 15,
            color: Colors.white.withOpacity(0.55),
            fontWeight: FontWeight.w400,
            height: 1.4,
          ),
        ),
        const SizedBox(height: 16),
        // Feature pills row
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _featurePill(Icons.electric_bolt_rounded, 'Zero Emission', const Color(0xFF00B14F)),
            const SizedBox(width: 8),
            _featurePill(Icons.shield_rounded, 'Safe Rides', const Color(0xFF0066FF)),
            const SizedBox(width: 8),
            _featurePill(Icons.timer_rounded, 'Fast Match', const Color(0xFF00D9FF)),
          ],
        ),
      ],
    );
  }

  Widget _featurePill(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 12),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPhoneField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Phone Number',
          style: TextStyle(
            color: Colors.white.withOpacity(0.65),
            fontSize: 13,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.3,
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
            color: Colors.white,
            letterSpacing: 2.0,
          ),
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: InputDecoration(
            counterText: '',
            hintText: '98765 43210',
            hintStyle: TextStyle(
              color: Colors.white.withOpacity(0.2),
              fontSize: 18,
              fontWeight: FontWeight.w400,
              letterSpacing: 2.0,
            ),
            prefix: Container(
              margin: const EdgeInsets.only(right: 12),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF0066FF).withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: const Color(0xFF0066FF).withOpacity(0.3),
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
                      color: Colors.white.withOpacity(0.85),
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                ],
              ),
            ),
            filled: true,
            fillColor: Colors.white.withOpacity(0.06),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFF0066FF), width: 1.8),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.5),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFFEF4444), width: 1.8),
            ),
            errorStyle: const TextStyle(color: Color(0xFFEF4444), fontSize: 12),
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

  Widget _buildGetStartedButton() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      height: 58,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: _isLoading
            ? LinearGradient(
                colors: [
                  const Color(0xFF0066FF).withOpacity(0.5),
                  const Color(0xFF00D9FF).withOpacity(0.5),
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
                  color: const Color(0xFF0066FF).withOpacity(0.45),
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
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
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
                    'Get OTP — Get Started',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildDivider() {
    return Row(
      children: [
        Expanded(
          child: Container(
            height: 1,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.transparent, Colors.white.withOpacity(0.1)],
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            'OR CONTINUE WITH',
            style: TextStyle(
              color: Colors.white.withOpacity(0.3),
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 1.5,
            ),
          ),
        ),
        Expanded(
          child: Container(
            height: 1,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.white.withOpacity(0.1), Colors.transparent],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildGoogleButton() {
    return GestureDetector(
      onTap: _isLoading ? null : _signInWithGoogle,
      child: Container(
        height: 54,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Text('G', style: TextStyle(
                  color: Color(0xFF4285F4),
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                )),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              'Continue with Google',
              style: TextStyle(
                color: Colors.white.withOpacity(0.85),
                fontWeight: FontWeight.w600,
                fontSize: 15,
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
                'mock_token_dev_rider_123',
                '+919999999999',
                name: 'Saket Suman',
              );
            },
      child: Container(
        height: 54,
        decoration: BoxDecoration(
          color: const Color(0xFF0066FF).withOpacity(0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF0066FF).withOpacity(0.25)),
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
              child: const Icon(Icons.flash_on_rounded, color: Color(0xFF0066FF), size: 14),
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

  Widget _buildTermsText() {
    return Text(
      'By continuing, you agree to Volzo\'s Terms of Service and Privacy Policy. '
      'Your location data is only used during active rides.',
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: 11,
        color: Colors.white.withOpacity(0.28),
        height: 1.6,
        fontWeight: FontWeight.w400,
      ),
    );
  }
}
