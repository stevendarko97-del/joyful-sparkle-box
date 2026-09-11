import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../services/auth_service.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    final user = auth.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: Text("My Profile", style: GoogleFonts.merriweather(fontSize: 18, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // User Avatar Card
            Container(
              padding: const EdgeInsets.all(20),
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.lightBorder),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: AppTheme.brandPrimaryLight,
                    child: Text(
                      user?.fullName.isNotEmpty == true ? user!.fullName[0] : 'U',
                      style: GoogleFonts.merriweather(fontSize: 26, fontWeight: FontWeight.bold, color: AppTheme.brandPrimary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    user?.fullName ?? "Quick Tutor User",
                    style: GoogleFonts.merriweather(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user?.email ?? "",
                    style: GoogleFonts.inter(fontSize: 13, color: AppTheme.brandMuted),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.brandPrimaryLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      (user?.role ?? 'Student').toUpperCase(),
                      style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.brandPrimary),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Settings Group
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.lightBorder),
              ),
              child: Column(
                children: [
                  _buildSettingItem(
                    icon: LucideIcons.phone,
                    title: "Phone & Mobile Money",
                    subtitle: user?.phone ?? "024XXXXXXX",
                    onTap: () {},
                  ),
                  const Divider(height: 1, color: AppTheme.lightBorder),
                  _buildSettingItem(
                    icon: LucideIcons.mapPin,
                    title: "Location / Region",
                    subtitle: user?.location ?? "Greater Accra, Ghana",
                    onTap: () {},
                  ),
                  const Divider(height: 1, color: AppTheme.lightBorder),
                  _buildSettingItem(
                    icon: LucideIcons.bell,
                    title: "SMS Lesson Alerts",
                    subtitle: "Enabled via Arkesel Ghana Gateway",
                    onTap: () {},
                  ),
                  const Divider(height: 1, color: AppTheme.lightBorder),
                  _buildSettingItem(
                    icon: LucideIcons.downloadCloud,
                    title: "Check Mobile App Updates",
                    subtitle: "v1.0.0 (Latest Release)",
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Quick Tutor Mobile App is up to date!")),
                      );
                    },
                  ),
                  const Divider(height: 1, color: AppTheme.lightBorder),
                  _buildSettingItem(
                    icon: LucideIcons.helpCircle,
                    title: "Ghana Support & Help",
                    subtitle: "WhatsApp & In-App Helpdesk",
                    onTap: () {},
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Logout Button
            ElevatedButton.icon(
              onPressed: () async {
                await auth.logout();
                if (context.mounted) {
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (route) => false,
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red.shade50,
                foregroundColor: Colors.red.shade700,
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(LucideIcons.logOut, size: 18),
              label: Text("Sign Out", style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: AppTheme.brandPrimaryLight,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, size: 18, color: AppTheme.brandPrimary),
      ),
      title: Text(title, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
      subtitle: Text(subtitle, style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandMuted)),
      trailing: const Icon(LucideIcons.chevronRight, size: 16, color: AppTheme.brandMuted),
      onTap: onTap,
    );
  }
}
