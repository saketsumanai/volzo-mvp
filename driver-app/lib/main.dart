/**
 * Volzo Mobility — Driver App
 * Main Entry Point
 *
 * Volzo blue/white theme with Inter typography,
 * Firebase, Socket.IO, and full Riverpod state management.
 */

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'core/config/app_config.dart';
import 'core/config/theme_config.dart';
import 'core/network/api_client.dart';
import 'features/auth/presentation/pages/splash_page.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables with fallback
  try {
    await dotenv.load(fileName: '.env');
  } catch (e) {
    debugPrint('ℹ️ .env file not found or empty, using default configurations');
  }

  // Initialize Firebase with graceful fallback for dev
  try {
    await Firebase.initializeApp();
  } catch (e) {
    debugPrint('⚠️ Firebase init skipped: $e — running in local dev mode.');
  }

  // Initialize API client (Dio + FlutterSecureStorage)
  ApiClient.initialize();

  // Lock to portrait mode
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Global light system styling for Volzo blue/white UI
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  runApp(
    const ProviderScope(
      child: VolzoDriverApp(),
    ),
  );
}

class VolzoDriverApp extends StatelessWidget {
  const VolzoDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${AppConfig.appName} Driver',
      debugShowCheckedModeBanner: false,
      theme: ThemeConfig.lightTheme,
      home: const SplashPage(),
    );
  }
}
