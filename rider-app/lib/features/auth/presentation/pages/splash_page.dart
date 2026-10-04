/**
 * Splash Screen
 * Initial loading screen
 */

import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';
import '../../../../core/config/theme_config.dart';
import '../../../../core/network/api_client.dart';
import 'login_page.dart';
import '../../../home/presentation/pages/home_page.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key});

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    await Future.delayed(const Duration(seconds: 2));

    final token = await ApiClient.getToken();

    if (!mounted) return;

    if (token != null) {
      // Verify token is valid
      try {
        final response = await ApiClient.get('/auth/me');
        if (response.statusCode == 200) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const HomePage()),
          );
          return;
        }
      } catch (e) {
        // Token invalid, clear it
        await ApiClient.clearToken();
      }
    }

    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginPage()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Color(0xFFFFFFFF), // Pure white
              Color(0xFFEBF3FF), // Soft premium brand light blue tint
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Branded Clean Logo Container
              Container(
                width: 140,
                height: 140,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(32),
                  border: Border.all(
                    color: ThemeConfig.dividerColor,
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 25,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Image.asset(
                  'assets/images/volzo_logo.png',
                  fit: BoxFit.contain,
                ),
              ),

              const SizedBox(height: ThemeConfig.spacingXLarge),

              // Brand Title
              const Text(
                'VOLZO',
                style: TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                  color: ThemeConfig.primaryColor,
                  letterSpacing: 4.0,
                ),
              ),

              const SizedBox(height: ThemeConfig.spacingSmall),

              // Slogan
              const Text(
                'EV MOBILITY FOR EVERYONE',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2.0,
                  color: ThemeConfig.textSecondaryColor,
                ),
              ),

              const SizedBox(height: 50),

              // Modern progress indicator
              const SizedBox(
                width: 40,
                height: 4,
                child: LinearProgressIndicator(
                  backgroundColor: ThemeConfig.dividerColor,
                  valueColor: AlwaysStoppedAnimation<Color>(ThemeConfig.primaryColor),
                  borderRadius: BorderRadius.all(Radius.circular(2)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
