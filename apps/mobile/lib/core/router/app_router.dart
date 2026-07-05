import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:tftsp_mobile/features/auth/presentation/auth_controller.dart';
import 'package:tftsp_mobile/features/auth/presentation/auth_state.dart';
import 'package:tftsp_mobile/features/auth/presentation/login_screen.dart';
import 'package:tftsp_mobile/features/auth/presentation/tenant_switch_screen.dart';
import 'package:tftsp_mobile/features/contributions/presentation/create_change_request_screen.dart';
import 'package:tftsp_mobile/features/contributions/presentation/reputation_screen.dart';
import 'package:tftsp_mobile/features/home/presentation/home_shell.dart';
import 'package:tftsp_mobile/features/person/presentation/person_card_screen.dart';
import 'package:tftsp_mobile/features/view_request/presentation/view_request_screen.dart';

/// The app router. Redirects on auth status; a [ValueNotifier] bridges Riverpod
/// state changes to go_router's `refreshListenable`.
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<AuthStatus>(
    ref.read(authControllerProvider).status,
  );
  ref.listen<AuthStatus>(
    authControllerProvider.select((s) => s.status),
    (_, next) => refresh.value = next,
  );
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final status = ref.read(authControllerProvider).status;
      final loc = state.matchedLocation;

      if (status == AuthStatus.unknown) {
        return loc == '/' ? null : '/';
      }
      if (status == AuthStatus.unauthenticated) {
        const publicRoutes = {'/login', '/view-request'};
        return publicRoutes.contains(loc) ? null : '/login';
      }
      // Authenticated.
      if (loc == '/' || loc == '/login') return '/tree';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const _SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
        path: '/view-request',
        builder: (_, __) => const ViewRequestScreen(),
      ),
      GoRoute(path: '/tree', builder: (_, __) => const HomeShell()),
      GoRoute(
        path: '/tenant-switch',
        builder: (_, __) => const TenantSwitchScreen(),
      ),
      GoRoute(
        path: '/reputation',
        builder: (_, __) => const ReputationScreen(),
      ),
      GoRoute(
        path: '/person/:id',
        builder: (_, state) =>
            PersonCardScreen(personId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/contributions/new',
        builder: (_, state) => CreateChangeRequestScreen(
          personId: state.uri.queryParameters['personId'],
        ),
      ),
    ],
  );
});

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}
