import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tftsp_mobile/core/l10n/l10n.dart';
import 'package:tftsp_mobile/core/logging/app_logger.dart';
import 'package:tftsp_mobile/core/providers.dart';
import 'package:tftsp_mobile/core/router/app_router.dart';
import 'package:tftsp_mobile/core/theme/app_theme.dart';
import 'package:tftsp_mobile/features/auth/presentation/auth_controller.dart';
import 'package:tftsp_mobile/features/home/presentation/home_providers.dart';
import 'package:tftsp_mobile/features/notifications/fcm/push_service.dart';
import 'package:tftsp_mobile/features/notifications/presentation/notification_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();
  await _initFirebase();

  runApp(
    ProviderScope(
      child: EasyLocalization(
        supportedLocales: L10n.supportedLocales,
        path: L10n.translationsPath,
        fallbackLocale: L10n.fallbackLocale,
        useOnlyLangCode: true,
        child: const TftspApp(),
      ),
    ),
  );
}

/// Initialise Firebase + register the FCM background handler. No-ops safely
/// when Firebase config is absent (dev/CI) so the app never crashes on boot.
Future<void> _initFirebase() async {
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
  } on Object catch (e) {
    appLogger.w('Firebase init skipped (no config?): $e');
  }
}

class TftspApp extends ConsumerStatefulWidget {
  const TftspApp({super.key});

  @override
  ConsumerState<TftspApp> createState() => _TftspAppState();
}

class _TftspAppState extends ConsumerState<TftspApp> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_initPush()));
  }

  Future<void> _initPush() async {
    final push = ref.read(pushServiceProvider)
      ..onOpenChangeRequest = (_) {
        // Route a push tap to the "My requests" tab.
        ref.read(homeTabProvider.notifier).state = 1;
        ref.invalidate(notificationsProvider);
      };
    await push.init();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final primaryHex = ref.watch(
      authControllerProvider.select((s) => s.primaryColorHex),
    );

    return MaterialApp.router(
      title: 'app.title'.tr(),
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(primaryHex),
      darkTheme: AppTheme.dark(primaryHex),
      routerConfig: router,
      locale: context.locale,
      supportedLocales: context.supportedLocales,
      localizationsDelegates: context.localizationDelegates,
    );
  }
}
