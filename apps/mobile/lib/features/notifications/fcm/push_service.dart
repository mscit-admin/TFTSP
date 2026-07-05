import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:tftsp_mobile/core/logging/app_logger.dart';
import 'package:tftsp_mobile/features/notifications/data/device_api.dart';
import 'package:tftsp_mobile/features/notifications/domain/notification_models.dart';

/// Required top-level background handler for FCM. Must be a top-level function.
@pragma('vm:entry-point')
Future<void> firebaseBackgroundHandler(RemoteMessage message) async {
  // Data-only handling; a system notification is shown by the OS for
  // notification messages. Nothing heavy here.
  appLogger.d('BG push: ${message.messageId}');
}

/// Wraps firebase_messaging: token lifecycle + tap routing. Every call is
/// guarded so a missing Firebase config (dev/CI) never crashes the app.
class PushService {
  PushService(this._deviceApi);

  final DeviceApi _deviceApi;

  FirebaseMessaging? _messaging;
  String? _lastToken;
  StreamSubscription<String>? _tokenSub;

  /// Called when the user taps a push; carries the change-request id (if any).
  void Function(String? changeRequestId)? onOpenChangeRequest;

  bool get _supported => Platform.isAndroid || Platform.isIOS;

  /// Prepare listeners. Safe to call even without Firebase credentials.
  Future<void> init() async {
    if (!_supported) return;
    try {
      _messaging = FirebaseMessaging.instance;
      await _messaging!.requestPermission();

      FirebaseMessaging.onMessageOpenedApp.listen(_handleOpened);
      final initial = await _messaging!.getInitialMessage();
      if (initial != null) _handleOpened(initial);

      _tokenSub = _messaging!.onTokenRefresh.listen((token) {
        _lastToken = token;
        unawaited(_registerSilently(token));
      });
    } on Object catch (e) {
      appLogger.w('Push init skipped (no Firebase config?): $e');
    }
  }

  /// Register the current device token after login.
  Future<void> registerForCurrentUser() async {
    if (!_supported) return;
    try {
      final token = await _messaging?.getToken();
      if (token == null) return;
      _lastToken = token;
      await _registerSilently(token);
    } on Object catch (e) {
      appLogger.w('Device registration skipped: $e');
    }
  }

  /// Deregister on logout so a signed-out device stops receiving pushes.
  Future<void> deregister() async {
    final token = _lastToken;
    if (token == null) return;
    try {
      await _deviceApi.deregister(token);
    } on Object catch (e) {
      appLogger.w('Device deregistration failed: $e');
    } finally {
      _lastToken = null;
    }
  }

  Future<void> _registerSilently(String token) async {
    try {
      final platform = Platform.isIOS ? 'ios' : 'android';
      await _deviceApi.register(
        RegisterDevice(token: token, platform: platform),
      );
    } on Object catch (e) {
      appLogger.w('Device upsert failed: $e');
    }
  }

  void _handleOpened(RemoteMessage message) {
    final crId = message.data['changeRequestId'] as String?;
    onOpenChangeRequest?.call(crId);
  }

  Future<void> dispose() async {
    await _tokenSub?.cancel();
  }
}
