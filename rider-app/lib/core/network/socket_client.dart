/**
 * Socket.IO Client
 * Real-time communication with backend
 */

import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../config/app_config.dart';
import 'api_client.dart';

class SocketClient {
  static IO.Socket? _socket;
  static bool _isConnected = false;

  // Event callbacks
  static final Map<String, List<Function>> _eventListeners = {};

  static Future<void> connect() async {
    if (_socket != null && _isConnected) {
      print('🔌 Socket already connected');
      return;
    }

    final token = await ApiClient.getToken();
    if (token == null) {
      print('❌ No auth token found');
      return;
    }

    _socket = IO.io(
      AppConfig.socketUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );

    _socket!.onConnect((_) {
      _isConnected = true;
      print('✅ Socket connected');
      _notifyListeners('connect', null);
    });

    _socket!.onDisconnect((_) {
      _isConnected = false;
      print('❌ Socket disconnected');
      _notifyListeners('disconnect', null);
    });

    _socket!.onConnectError((error) {
      print('❌ Socket connection error: $error');
    });

    _socket!.onError((error) {
      print('❌ Socket error: $error');
    });

    // Listen to ride events
    _setupRideListeners();

    // Listen to payment events
    _setupPaymentListeners();

    // Listen to notification events
    _setupNotificationListeners();
  }

  static void _setupRideListeners() {
    _socket!.on('ride:accepted', (data) {
      print('🚗 Ride accepted: $data');
      _notifyListeners('ride:accepted', data);
    });

    _socket!.on('ride:driver_arrived', (data) {
      print('📍 Driver arrived: $data');
      _notifyListeners('ride:driver_arrived', data);
    });

    _socket!.on('ride:started', (data) {
      print('🏁 Ride started: $data');
      _notifyListeners('ride:started', data);
    });

    _socket!.on('ride:completed', (data) {
      print('✅ Ride completed: $data');
      _notifyListeners('ride:completed', data);
    });

    _socket!.on('ride:cancelled', (data) {
      print('❌ Ride cancelled: $data');
      _notifyListeners('ride:cancelled', data);
    });

    _socket!.on('driver:location:updated', (data) {
      _notifyListeners('driver:location:updated', data);
    });
  }

  static void _setupPaymentListeners() {
    _socket!.on('payment:verified', (data) {
      print('💳 Payment verified: $data');
      _notifyListeners('payment:verified', data);
    });
  }

  static void _setupNotificationListeners() {
    _socket!.on('notification:received', (data) {
      print('🔔 Notification: $data');
      _notifyListeners('notification:received', data);
    });
  }

  static void joinRide(String rideId) {
    if (_socket != null && _isConnected) {
      _socket!.emit('ride:join', rideId);
      print('🚗 Joined ride: $rideId');
    }
  }

  static void leaveRide(String rideId) {
    if (_socket != null && _isConnected) {
      _socket!.emit('ride:leave', rideId);
      print('🚗 Left ride: $rideId');
    }
  }

  static void on(String event, Function(dynamic) callback) {
    if (!_eventListeners.containsKey(event)) {
      _eventListeners[event] = [];
    }
    _eventListeners[event]!.add(callback);
  }

  static void off(String event, [Function(dynamic)? callback]) {
    if (callback != null) {
      _eventListeners[event]?.remove(callback);
    } else {
      _eventListeners.remove(event);
    }
  }

  static void _notifyListeners(String event, dynamic data) {
    if (_eventListeners.containsKey(event)) {
      for (var callback in _eventListeners[event]!) {
        callback(data);
      }
    }
  }

  static void disconnect() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket = null;
      _isConnected = false;
      _eventListeners.clear();
      print('🔌 Socket disconnected');
    }
  }

  static bool get isConnected => _isConnected;
}
