/**
 * Volzo Driver App — OTP Verification Page
 * Dark glassmorphic theme, resend countdown, smart routing based on KYC status
 */

import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:pin_code_fields/pin_code_fields.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import 'driver_registration_page.dart';
import '../../../home/presentation/pages/home_page.dart';

class OTPVerificationPage extends StatefulWidget {
  final String phoneNumber;
  final String verificationId;

  const OTPVerificationPage({
    super.key,
    required this.phoneNumber,
    required this.verificationId,
  });

  @override
  State<OTPVerificationPage> createState() => _OTPVerificationPageState();
}

class _OTPVerificationPageState extends State<OTPVerificationPage>
    with TickerProviderStateMixin {
  final _otpController = TextEditingController();
  bool _isLoading = false;
  bool _isResending = false;
  int _resendCountdown = 30;
  Timer? _resendTimer;
  String _currentVerificationId = '';

  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;
  late AnimationController _entryController;
  late Animation<double> _entryFade;
  late Animation<Offset> _entrySlide;

  @override
  void initState() {
    super.initState();
    _currentVerificationId = widget.verificationId;

    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _shakeAnimation = Tween<double>(begin: 0, end: 1)
        .animate(CurvedAnimation(parent: _shakeController, curve: Curves.elasticIn));

    _entryController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..forward();
    _entryFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _entryController, curve: const Interval(0.2, 1.0, curve: Curves.easeOut)),
    );
    _entrySlide = Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _entryController, curve: Curves.easeOutCubic));

    _startResendTimer();
  }

  void _startResendTimer() {
    _resendCountdown = 30;
    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_resendCountdown <= 0) {
        timer.cancel();
        setState(() {});
        return;
      }
      setState(() => _resendCountdown--);
    });
  }

  @override
  void dispose() {
    _otpController.dispose();
    _resendTimer?.cancel();
    _shakeController.dispose();
    _entryController.dispose();
    super.dispose();
  }

  Future<void> _verifyOTP() async {
    final code = _otpController.text.trim();
    if (code.length != 6) {
      _showError('Enter the complete 6-digit OTP');
      return;
    }
    setState(() => _isLoading = true);

    try {
      final credential = PhoneAuthProvider.credential(
        verificationId: _currentVerificationId,
        smsCode: code,
      );
      final uc = await FirebaseAuth.instance.signInWithCredential(credential);
      final idToken = await uc.user?.getIdToken();
      if (idToken == null) throw Exception('No ID token');

      final response = await ApiClient.post('/auth/verify-otp', data: {
        'phone': widget.phoneNumber,
        'firebaseToken': idToken,
      });

      if (!mounted) return;

      if (response.statusCode == 200) {
        final data = response.data['data'];
        await ApiClient.saveToken(data['token']);
        if (data['driver'] != null) {
          await ApiClient.saveDriverData(data['driver']);
        }

        final driver = data['driver'];
        final kycStatus = (driver?['kycStatus'] ?? driver?['status'] ?? '').toString().toUpperCase();
        // Route based on KYC status
        if (driver == null || kycStatus != 'APPROVED') {
          Navigator.of(context).pushAndRemoveUntil(
            PageRouteBuilder(
              pageBuilder: (_, a, __) => const DriverRegistrationPage(),
              transitionsBuilder: (_, a, __, child) =>
                  FadeTransition(opacity: a, child: child),
              transitionDuration: const Duration(milliseconds: 600),
            ),
            (route) => false,
          );
        } else {
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
      }
    } on FirebaseAuthException catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _shakeController.forward(from: 0);
      _otpController.clear();
      _showError(e.code == 'invalid-verification-code'
          ? 'Incorrect OTP. Please try again.'
          : e.message ?? 'Verification failed.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      _shakeController.forward(from: 0);
      _otpController.clear();
      _showError(ApiClient.getErrorMessage(e));
    }
  }

  Future<void> _resendOTP() async {
    if (_resendCountdown > 0 || _isResending) return;
    setState(() => _isResending = true);

    try {
      await FirebaseAuth.instance.verifyPhoneNumber(
        phoneNumber: widget.phoneNumber,
        verificationCompleted: (PhoneAuthCredential credential) {},
        verificationFailed: (FirebaseAuthException e) {
          if (!mounted) return;
          setState(() => _isResending = false);
          _showError(e.message ?? 'Failed to resend OTP');
        },
        codeSent: (String newVerificationId, int? resendToken) {
          if (!mounted) return;
          setState(() {
            _currentVerificationId = newVerificationId;
            _isResending = false;
          });
          _startResendTimer();
          _otpController.clear();
          _showSuccess('OTP resent to ${widget.phoneNumber}');
        },
        codeAutoRetrievalTimeout: (_) {},
        timeout: const Duration(seconds: 60),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isResending = false);
      _showError('Failed to resend. Check your connection.');
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        const Icon(Icons.error_outline, color: Colors.white, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Text(message, style: const TextStyle(color: Colors.white))),
      ]),
      backgroundColor: const Color(0xFFEF4444),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(children: [
        const Icon(Icons.check_circle_outline, color: Colors.white, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Text(message, style: const TextStyle(color: Colors.white))),
      ]),
      backgroundColor: const Color(0xFF00C853),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFF060811),
        body: Stack(
          children: [
            Positioned(
              top: -100,
              right: -60,
              child: Container(
                width: 280,
                height: 280,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF00C853).withOpacity(0.15),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            SafeArea(
              child: SlideTransition(
                position: _entrySlide,
                child: FadeTransition(
                  opacity: _entryFade,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 16),
                        // Back button
                        Row(children: [
                          GestureDetector(
                            onTap: () => Navigator.pop(context),
                            child: Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.07),
                                borderRadius: BorderRadius.circular(13),
                                border: Border.all(color: Colors.white.withOpacity(0.12)),
                              ),
                              child: const Icon(Icons.arrow_back_ios_new_rounded,
                                  color: Colors.white, size: 18),
                            ),
                          ),
                        ]),
                        const SizedBox(height: 36),
                        Center(
                          child: Stack(alignment: Alignment.center, children: [
                            Container(
                              width: 88, height: 88,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: RadialGradient(
                                  colors: [const Color(0xFF00C853).withOpacity(0.2), Colors.transparent],
                                ),
                              ),
                            ),
                            Container(
                              width: 70, height: 70,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white.withOpacity(0.07),
                                border: Border.all(color: const Color(0xFF00C853).withOpacity(0.5), width: 1.5),
                              ),
                              child: const Icon(Icons.sms_rounded, color: Color(0xFF00C853), size: 32),
                            ),
                          ]),
                        ),
                        const SizedBox(height: 28),
                        const Text('Verify Your Number',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.5)),
                        const SizedBox(height: 10),
                        Center(
                          child: RichText(
                            text: TextSpan(children: [
                              TextSpan(
                                text: 'Code sent to ',
                                style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14),
                              ),
                              TextSpan(
                                text: _maskPhone(widget.phoneNumber),
                                style: const TextStyle(color: Color(0xFF00C853), fontSize: 14, fontWeight: FontWeight.w700),
                              ),
                            ]),
                          ),
                        ),
                        const SizedBox(height: 44),
                        AnimatedBuilder(
                          animation: _shakeAnimation,
                          builder: (ctx, child) => Transform.translate(
                            offset: Offset(
                              8 * math.sin(_shakeAnimation.value * 3 * math.pi) *
                                  (1 - _shakeAnimation.value),
                              0,
                            ),
                            child: child,
                          ),
                          child: PinCodeTextField(
                            appContext: context,
                            length: 6,
                            controller: _otpController,
                            keyboardType: TextInputType.number,
                            animationType: AnimationType.scale,
                            animationDuration: const Duration(milliseconds: 200),
                            enabled: !_isLoading,
                            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                            pinTheme: PinTheme(
                              shape: PinCodeFieldShape.box,
                              borderRadius: BorderRadius.circular(14),
                              fieldHeight: 58,
                              fieldWidth: 46,
                              activeFillColor: const Color(0xFF00C853).withOpacity(0.15),
                              inactiveFillColor: Colors.white.withOpacity(0.05),
                              selectedFillColor: const Color(0xFF00C853).withOpacity(0.1),
                              activeColor: const Color(0xFF00C853),
                              inactiveColor: Colors.white.withOpacity(0.15),
                              selectedColor: const Color(0xFF00C853),
                            ),
                            textStyle: const TextStyle(
                              color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: 1.0,
                            ),
                            cursorColor: const Color(0xFF00C853),
                            enableActiveFill: true,
                            onCompleted: (code) { if (!_isLoading) _verifyOTP(); },
                            onChanged: (_) {},
                            beforeTextPaste: (text) {
                              if (text == null) return false;
                              return RegExp(r'^\d{6}$').hasMatch(text);
                            },
                          ),
                        ),
                        const SizedBox(height: 32),
                        // Verify button
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          height: 58,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            gradient: _isLoading
                                ? LinearGradient(colors: [
                                    const Color(0xFF00C853).withOpacity(0.4),
                                    const Color(0xFF00E676).withOpacity(0.4),
                                  ])
                                : const LinearGradient(
                                    colors: [Color(0xFF00C853), Color(0xFF00E676)],
                                    begin: Alignment.centerLeft,
                                    end: Alignment.centerRight,
                                  ),
                            boxShadow: _isLoading ? [] : [
                              BoxShadow(color: const Color(0xFF00C853).withOpacity(0.45), blurRadius: 20, offset: const Offset(0, 8)),
                            ],
                          ),
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _verifyOTP,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.transparent,
                              shadowColor: Colors.transparent,
                              disabledBackgroundColor: Colors.transparent,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    height: 22, width: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                    ),
                                  )
                                : Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: const [
                                      Icon(Icons.verified_user_rounded, size: 20, color: Colors.white),
                                      SizedBox(width: 10),
                                      Text('Verify & Continue',
                                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white)),
                                    ],
                                  ),
                          ),
                        ),
                        const SizedBox(height: 28),
                        // Resend section
                        Center(
                          child: _resendCountdown > 0
                              ? Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                  Text('Resend OTP in ',
                                      style: TextStyle(color: Colors.white.withOpacity(0.45), fontSize: 14)),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF00C853).withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text('${_resendCountdown}s',
                                        style: const TextStyle(color: Color(0xFF00C853), fontSize: 14, fontWeight: FontWeight.w800)),
                                  ),
                                ])
                              : GestureDetector(
                                  onTap: _isResending ? null : _resendOTP,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withOpacity(0.06),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: Colors.white.withOpacity(0.12)),
                                    ),
                                    child: _isResending
                                        ? const SizedBox(height: 18, width: 18,
                                            child: CircularProgressIndicator(strokeWidth: 2,
                                                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00C853))))
                                        : Row(mainAxisSize: MainAxisSize.min, children: [
                                            const Icon(Icons.refresh_rounded, size: 16, color: Color(0xFF00C853)),
                                            const SizedBox(width: 6),
                                            Text('Resend OTP',
                                                style: TextStyle(color: const Color(0xFF00C853), fontSize: 14, fontWeight: FontWeight.w700)),
                                          ]),
                                  ),
                                ),
                        ),
                        const Spacer(),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 24),
                          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Icon(Icons.lock_outline_rounded, size: 13, color: Colors.white.withOpacity(0.3)),
                            const SizedBox(width: 6),
                            Text('Secured by Firebase Authentication',
                                style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 11)),
                          ]),
                        ),
                      ],
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

  String _maskPhone(String phone) {
    if (phone.length >= 10) {
      final digits = phone.replaceAll('+91', '').trim();
      if (digits.length == 10) {
        return '+91 XXXXX ${digits.substring(5)}';
      }
    }
    return phone;
  }
}
