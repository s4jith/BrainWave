import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/test_model.dart';
import '../../presentation/assessments/assessment_result_screen.dart';
import '../../presentation/assessments/assessment_taker_screen.dart';
import '../../presentation/assessments/assessments_list_screen.dart';
import '../../presentation/auth/forgot_password_screen.dart';
import '../../presentation/auth/login_screen.dart';
import '../../presentation/career/career_result_screen.dart';
import '../../presentation/career/career_test_screen.dart';
import '../../presentation/dashboard/dashboard_screen.dart';
import '../../presentation/gradebook/gradebook_screen.dart';
import '../../presentation/groups/groups_screen.dart';
import '../../presentation/learn/ai_chat_screen.dart';
import '../../presentation/learn/book_to_bot_screen.dart';
import '../../presentation/notes/notes_screen.dart';
import '../../presentation/onboarding/onboarding_screen.dart';
import '../../presentation/providers/auth_provider.dart';
import '../../presentation/queries/queries_screen.dart';
import '../../presentation/report_card/report_card_screen.dart';
import '../../presentation/settings/settings_screen.dart';
import '../../presentation/shell/main_shell.dart';
import '../../presentation/suggestions/suggestions_screen.dart';
import '../../presentation/support/support_screen.dart';
import '../../presentation/support/support_ticket_detail_screen.dart';
import '../../presentation/tests/test_center_screen.dart';
import '../../presentation/tests/test_result_screen.dart';
import '../../presentation/tests/test_session_screen.dart';

final _rootKey = GlobalKey<NavigatorState>();

/// Bridges Riverpod auth state into GoRouter so redirects re-run on changes.
class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final listenable = _AuthListenable(ref);
  ref.onDispose(listenable.dispose);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/login',
    refreshListenable: listenable,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final path = state.matchedLocation;

      // Session restore in flight → hold on the splash.
      if (auth.isLoading) return path == '/loading' ? null : '/loading';

      // Unauthenticated: only the auth pages are reachable (incl. leaving /loading).
      if (!auth.isAuthenticated) {
        final onAuthPage = path == '/login' || path == '/forgot-password';
        return onAuthPage ? null : '/login';
      }

      // Authenticated but not onboarded → finish onboarding first.
      final onboarded = auth.user?.isOnboarded ?? true;
      if (!onboarded) return path == '/onboarding' ? null : '/onboarding';

      // Signed-in users should never sit on auth/splash/onboarding screens.
      if (path == '/login' || path == '/loading' || path == '/onboarding') {
        return '/dashboard';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/loading', builder: (_, __) => const _LoadingScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(
          path: '/forgot-password',
          builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(
          path: '/onboarding', builder: (_, __) => const OnboardingScreen()),

      // ── Bottom-nav shell (five tabs, state preserved per branch) ──────────
      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => MainShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(
                path: '/dashboard',
                builder: (_, __) => const DashboardScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
                path: '/learn', builder: (_, __) => const BookToBotScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
                path: '/tests', builder: (_, __) => const TestCenterScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/notes', builder: (_, __) => const NotesScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
                path: '/settings', builder: (_, __) => const SettingsScreen()),
          ]),
        ],
      ),

      // ── Secondary routes (pushed over the shell, on the root navigator) ───
      GoRoute(path: '/ai-chat', builder: (_, __) => const AiChatScreen()),
      GoRoute(
        path: '/test-session',
        builder: (_, state) =>
            TestSessionScreen(session: state.extra as TestSession?),
      ),
      GoRoute(
        path: '/test-result',
        builder: (_, state) =>
            TestResultScreen(result: state.extra as TestResult?),
      ),
      GoRoute(
          path: '/assessments',
          builder: (_, __) => const AssessmentsListScreen()),
      GoRoute(
        path: '/assessment/:id',
        builder: (_, state) =>
            AssessmentTakerScreen(assessmentId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/assessment-result',
        builder: (_, state) =>
            AssessmentResultScreen(submissionId: state.extra as String? ?? ''),
      ),
      GoRoute(
          path: '/report-card', builder: (_, __) => const ReportCardScreen()),
      GoRoute(path: '/groups', builder: (_, __) => const GroupsScreen()),
      GoRoute(path: '/queries', builder: (_, __) => const QueriesScreen()),
      GoRoute(path: '/gradebook', builder: (_, __) => const GradebookScreen()),
      GoRoute(
          path: '/gradebook/:courseId',
          builder: (_, __) => const GradebookScreen()),
      GoRoute(path: '/career', builder: (_, __) => const CareerTestScreen()),
      GoRoute(
        path: '/career-result',
        builder: (_, state) =>
            CareerResultScreen(resultId: state.extra as String?),
      ),
      GoRoute(path: '/support', builder: (_, __) => const SupportScreen()),
      GoRoute(
        path: '/support-ticket',
        builder: (_, state) =>
            SupportTicketDetailScreen(ticketId: state.extra as String? ?? ''),
      ),
      GoRoute(
          path: '/suggestions',
          builder: (_, __) => const SuggestionsScreen()),
    ],
    errorBuilder: (_, state) => Scaffold(
      body: Center(child: Text('Route not found: ${state.uri}')),
    ),
  );
});

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}
