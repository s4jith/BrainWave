import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/onboarding/onboarding_screen.dart';
import '../screens/main/main_shell.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/chat/chat_screen.dart';
import '../screens/tests/test_center_screen.dart';
import '../screens/tests/test_session_screen.dart';
import '../screens/tests/test_result_screen.dart';
import '../screens/notes/notes_screen.dart';
import '../screens/queries/queries_screen.dart';
import '../screens/groups/groups_screen.dart';
import '../screens/gradebook/gradebook_screen.dart';
import '../screens/career/career_test_screen.dart';
import '../screens/career/career_result_screen.dart';
import '../screens/support/support_screen.dart';
import '../screens/settings/settings_screen.dart';
import '../screens/report_card/report_card_screen.dart';
import '../models/test_model.dart';

// Notifies GoRouter whenever auth state changes so redirects re-evaluate.
class _RouterNotifier extends ChangeNotifier {
  _RouterNotifier(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = _RouterNotifier(ref);
  ref.onDispose(notifier.dispose);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: notifier,
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final isLoading = authState.isLoading;
      final isAuth = authState.isAuthenticated;
      final path = state.matchedLocation;

      if (isLoading) return '/loading';

      final publicPaths = ['/login', '/forgot-password', '/loading'];
      final isPublic = publicPaths.any((p) => path.startsWith(p));

      if (!isAuth && !isPublic) return '/login';
      if (isAuth && path == '/login') {
        if (authState.user?.isOnboarded == false) return '/onboarding';
        return '/dashboard';
      }
      if (isAuth && authState.user?.isOnboarded == false && path != '/onboarding') {
        return '/onboarding';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/loading', builder: (_, __) => const _LoadingScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingScreen()),

      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
          GoRoute(path: '/chat', builder: (_, __) => const ChatScreen()),
          GoRoute(path: '/tests', builder: (_, __) => const TestCenterScreen()),
          GoRoute(
            path: '/test-session',
            builder: (_, state) {
              final session = state.extra as TestSession?;
              return TestSessionScreen(session: session);
            },
          ),
          GoRoute(
            path: '/test-result',
            builder: (_, state) {
              final result = state.extra as TestResult?;
              return TestResultScreen(result: result);
            },
          ),
          GoRoute(path: '/notes', builder: (_, __) => const NotesScreen()),
          GoRoute(path: '/queries', builder: (_, __) => const QueriesScreen()),
          GoRoute(path: '/groups', builder: (_, __) => const GroupsScreen()),
          GoRoute(path: '/gradebook', builder: (_, __) => const GradebookScreen()),
          GoRoute(path: '/report-card', builder: (_, __) => const ReportCardScreen()),
          GoRoute(path: '/career', builder: (_, __) => const CareerTestScreen()),
          GoRoute(
            path: '/career-result',
            builder: (_, state) => CareerResultScreen(
              resultId: state.extra as String?,
            ),
          ),
          GoRoute(path: '/support', builder: (_, __) => const SupportScreen()),
          GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
        ],
      ),
    ],
  );
});

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
