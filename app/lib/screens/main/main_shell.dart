import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';

class MainShell extends StatelessWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  static const _tabs = [
    (path: '/dashboard', icon: Icons.home_outlined, selectedIcon: Icons.home, label: 'Home'),
    (path: '/chat', icon: Icons.chat_bubble_outline, selectedIcon: Icons.chat_bubble, label: 'AI Chat'),
    (path: '/tests', icon: Icons.quiz_outlined, selectedIcon: Icons.quiz, label: 'Tests'),
    (path: '/notes', icon: Icons.note_outlined, selectedIcon: Icons.note, label: 'Notes'),
    (path: '/settings', icon: Icons.person_outline, selectedIcon: Icons.person, label: 'Profile'),
  ];

  int _selectedIndex(BuildContext context) {
    final path = GoRouterState.of(context).matchedLocation;
    for (int i = 0; i < _tabs.length; i++) {
      if (path.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _selectedIndex(context);
    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: AppTheme.borderDark, width: 1)),
        ),
        child: NavigationBar(
          selectedIndex: selectedIndex,
          onDestinationSelected: (i) => context.go(_tabs[i].path),
          destinations: _tabs.map((tab) => NavigationDestination(
            icon: Icon(tab.icon),
            selectedIcon: Icon(tab.selectedIcon),
            label: tab.label,
          )).toList(),
        ),
      ),
    );
  }
}
