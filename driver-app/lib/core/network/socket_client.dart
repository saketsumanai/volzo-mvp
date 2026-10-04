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
  static bool _isDriverOnline = false; // Track online state for auto-rejoin on reconnect

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
      // If the driver was online before the reconnect, re-join the room automatically
      if (_isDriverOnline) {
        _socket!.emit('driver:online', {});
        print('🔄 Re-joined drivers:online room after reconnect');
      }
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

    // Listen to driver-specific events
    _setupDriverListeners();

    // Listen to ride events
    _setupRideListeners();

    // Listen to payment events
    _setupPaymentListeners();

    // Listen to notification events
    _setupNotificationListeners();
  }

  static void _setupDriverListeners() {
    _socket!.on('ride:new_request', (data) {
      print('🚗 New ride request: $data');
      _notifyListeners('ride:new_request', data);
    });

    _socket!.on('ride:cancelled_by_rider', (data) {
      print('❌ Ride cancelled by rider: $data');
      _notifyListeners('ride:cancelled_by_rider', data);
    });
  }

  static void _setupRideListeners() {
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
  }

  static void _setupPaymentListeners() {
    _socket!.on('payment:confirmed', (data) {
      print('💳 Payment confirmed: $data');
      _notifyListeners('payment:confirmed', data);
    });
  }

  static void _setupNotificationListeners() {
    _socket!.on('notification:received', (data) {
      print('🔔 Notification: $data');
      _notifyListeners('notification:received', data);
    });
  }

  // Driver location update - use lat/lng keys to match backend socket handler
  static void updateLocation(double latitude, double longitude, {String? rideId}) {
    if (_socket != null && _isConnected) {
      _socket!.emit('driver:location:update', {
        'lat': latitude,
        'lng': longitude,
        'heading': 0.0,
        if (rideId != null) 'rideId': rideId,
        'timestamp': DateTime.now().toIso8601String(),
      });
    }
  }

  // Driver status update (legacy)
  static void updateStatus(String status) {
    if (_socket != null && _isConnected) {
      _socket!.emit('driver:status:update', {
        'status': status,
        'timestamp': DateTime.now().toIso8601String(),
      });
    }
  }

  // Go online - join drivers:online room to receive ride requests
  static void goOnline() {
    _isDriverOnline = true;
    if (_socket != null && _isConnected) {
      _socket!.emit('driver:online', {});
      print('✅ Driver is now ONLINE - listening for ride requests');
    }
  }

  // Go offline - leave drivers:online room
  static void goOffline() {
    _isDriverOnline = false;
    if (_socket != null && _isConnected) {
      _socket!.emit('driver:offline', {});
      print('⚪ Driver is now OFFLINE');
    }
  }

  // Join ride
  static void joinRide(String rideId) {
    if (_socket != null && _isConnected) {
      _socket!.emit('ride:join', rideId);
      print('🚗 Joined ride: $rideId');
    }
  }

  // Leave ride
  static void leaveRide(String rideId) {
    if (_socket != null && _isConnected) {
      _socket!.emit('ride:leave', rideId);
      print('🚗 Left ride: $rideId');
    }
  }

  // Event listener management
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
      _isDriverOnline = false;
      _socket!.disconnect();
      _socket = null;
      _isConnected = false;
      _eventListeners.clear();
      print('🔌 Socket disconnected');
    }
  }

  static bool get isConnected => _isConnected;
}
