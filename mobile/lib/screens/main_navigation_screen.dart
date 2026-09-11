import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../services/auth_service.dart';
import 'bookings/bookings_list_screen.dart';
import 'home/home_screen.dart';
import 'messages/messages_screen.dart';
import 'profile/profile_screen.dart';
import 'tutor/tutor_dashboard_screen.dart';
import 'tutors/tutor_list_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    final isTeacher = auth.currentUser?.isTeacher ?? false;

    final List<Widget> screens = [
      const HomeScreen(),
      isTeacher ? const TutorDashboardScreen() : const TutorListScreen(),
      const BookingsListScreen(),
      const MessagesScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(
            top: BorderSide(color: AppTheme.lightBorder.withOpacity(0.8), width: 1),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: AppTheme.brandPrimary,
          unselectedItemColor: AppTheme.brandMuted,
          selectedFontSize: 11,
          unselectedFontSize: 11,
          elevation: 0,
          items: [
            const BottomNavigationBarItem(
              icon: Icon(LucideIcons.home, size: 22),
              activeIcon: Icon(LucideIcons.home, size: 22, color: AppTheme.brandPrimary),
              label: "Home",
            ),
            BottomNavigationBarItem(
              icon: Icon(isTeacher ? LucideIcons.layoutDashboard : LucideIcons.search, size: 22),
              activeIcon: Icon(
                isTeacher ? LucideIcons.layoutDashboard : LucideIcons.search,
                size: 22,
                color: AppTheme.brandPrimary,
              ),
              label: isTeacher ? "Dashboard" : "Find Tutor",
            ),
            const BottomNavigationBarItem(
              icon: Icon(LucideIcons.calendar, size: 22),
              activeIcon: Icon(LucideIcons.calendar, size: 22, color: AppTheme.brandPrimary),
              label: "Lessons",
            ),
            const BottomNavigationBarItem(
              icon: Icon(LucideIcons.messageSquare, size: 22),
              activeIcon: Icon(LucideIcons.messageSquare, size: 22, color: AppTheme.brandPrimary),
              label: "Messages",
            ),
            const BottomNavigationBarItem(
              icon: Icon(LucideIcons.user, size: 22),
              activeIcon: Icon(LucideIcons.user, size: 22, color: AppTheme.brandPrimary),
              label: "Profile",
            ),
          ],
        ),
      ),
    );
  }
}
