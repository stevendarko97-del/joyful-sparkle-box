import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/currency_formatter.dart';
import '../../services/auth_service.dart';
import '../../services/booking_service.dart';

class TutorDashboardScreen extends StatefulWidget {
  const TutorDashboardScreen({super.key});

  @override
  State<TutorDashboardScreen> createState() => _TutorDashboardScreenState();
}

class _TutorDashboardScreenState extends State<TutorDashboardScreen> {
  bool _isAvailable = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<BookingService>(context, listen: false).fetchTeacherBookings();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    final bookingService = Provider.of<BookingService>(context);
    final user = auth.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: Text("Tutor Portal", style: GoogleFonts.merriweather(fontSize: 18, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Tutor Banner Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.brandPrimaryDark, AppTheme.brandPrimary],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        user?.fullName ?? "Tutor",
                        style: GoogleFonts.merriweather(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.brandGold,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text("85% Take-Home", style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.brandInk)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text("Total Net Earnings", style: GoogleFonts.inter(color: Colors.white70, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(
                    CurrencyFormatter.formatGhs(185000), // Example GH₵ 1,850.00
                    style: GoogleFonts.merriweather(color: Colors.white, fontSize: 26, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Payout request queued for Mobile Money dispatch")),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.brandGold,
                      foregroundColor: AppTheme.brandInk,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(LucideIcons.arrowUpRight, size: 16, color: AppTheme.brandInk),
                    label: Text("Request MoMo Payout", style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Availability toggle card
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.lightBorder),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        _isAvailable ? Icons.check_circle : Icons.pause_circle,
                        color: _isAvailable ? AppTheme.brandPrimary : AppTheme.brandMuted,
                      ),
                      const SizedBox(width: 10),
                      Text("Available for Live Bookings", style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600)),
                    ],
                  ),
                  Switch(
                    value: _isAvailable,
                    activeColor: AppTheme.brandPrimary,
                    onChanged: (val) => setState(() => _isAvailable = val),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Tutor Quick Stats
            Text("Overview", style: GoogleFonts.merriweather(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildStatTile("Completed", "32 Lessons", LucideIcons.award),
                const SizedBox(width: 10),
                _buildStatTile("Pending Payout", "GH₵ 420.00", LucideIcons.wallet),
                const SizedBox(width: 10),
                _buildStatTile("Avg Rating", "4.9 ★", Icons.star),
              ],
            ),
            const SizedBox(height: 24),

            // Upcoming Sessions List
            Text("Upcoming Student Bookings", style: GoogleFonts.merriweather(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            if (bookingService.bookings.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.lightBorder),
                ),
                child: Center(
                  child: Text("No new student sessions scheduled today.", style: GoogleFonts.inter(color: AppTheme.brandMuted, fontSize: 13)),
                ),
              )
            else
              ...bookingService.bookings.take(3).map((b) => Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.lightBorder),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(b.studentName ?? "Student", style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold)),
                        Text(b.subjectName ?? "WAEC Session", style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandPrimary)),
                      ],
                    ),
                    Text(CurrencyFormatter.formatGhs(b.totalAmountCents), style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold)),
                  ],
                ),
              )),
          ],
        ),
      ),
    );
  }

  Widget _buildStatTile(String label, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.lightBorder),
        ),
        child: Column(
          children: [
            Icon(icon, size: 20, color: AppTheme.brandPrimary),
            const SizedBox(height: 6),
            Text(value, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.brandInk), textAlign: TextAlign.center),
            const SizedBox(height: 2),
            Text(label, style: GoogleFonts.inter(fontSize: 10, color: AppTheme.brandMuted), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
