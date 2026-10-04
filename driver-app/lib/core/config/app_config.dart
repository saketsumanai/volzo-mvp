import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  // App Info
  static String get appName => dotenv.env['APP_NAME'] ?? 'Volzo Driver';
  static String get environment => dotenv.env['ENVIRONMENT'] ?? 'development';

  // API Configuration (platform-aware defaults when .env is missing/wrong)
  static String get apiBaseUrl {
    final configured = dotenv.env['API_BASE_URL'];
    if (configured != null && configured.isNotEmpty) return configured;
    if (kIsWeb) return 'http://localhost:3000/api/v1';
    if (Platform.isAndroid) return 'http://10.0.2.2:3000/api/v1';
    return 'http://127.0.0.1:3000/api/v1';
  }

  static String get socketUrl {
    final configured = dotenv.env['SOCKET_URL'];
    if (configured != null && configured.isNotEmpty) return configured;
    if (kIsWeb) return 'http://localhost:3000';
    if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    return 'http://127.0.0.1:3000';
  }

  // Google Maps
  static String get googleMapsApiKey =>
      dotenv.env['GOOGLE_MAPS_API_KEY'] ?? '';

  // Timeouts
  static const int connectionTimeout = 30000; // 30 seconds
  static const int receiveTimeout = 30000; // 30 seconds

  // Logging
  static bool get enableLogging => environment == 'development';

  // Location
  static const double defaultLatitude = 28.6139; // Delhi
  static const double defaultLongitude = 77.2090;
  static const double locationUpdateInterval = 5.0; // seconds

  // Driver Status
  static const int maxRideRadius = 5000; // meters
  static const int autoAcceptTimeout = 30; // seconds
}
