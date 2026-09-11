import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/currency_formatter.dart';
import '../../models/booking_model.dart';
import '../../services/auth_service.dart';
import '../../services/booking_service.dart';
import '../classroom/live_classroom_screen.dart';

class BookingsListScreen extends StatefulWidget {
  const BookingsListScreen({super.key});

  @override
  State<BookingsListScreen> createState() => _BookingsListScreenState();
}

class _BookingsListScreenState extends State<BookingsListScreen> {
  @override
  void initState() {
    super.initState();
    _loadBookings();
  }

  void _loadBookings() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthService>(context, listen: false);
      final bookingService = Provider.of<BookingService>(context, listen: false);
      if (auth.currentUser?.isTeacher == true) {
        bookingService.fetchTeacherBookings();
      } else {
        bookingService.fetchStudentBookings();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bookingService = Provider.of<BookingService>(context);
    final auth = Provider.of<AuthService>(context);
    final isTeacher = auth.currentUser?.isTeacher ?? false;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          isTeacher ? "Scheduled Lessons" : "My Bookings & Lessons",
          style: GoogleFonts.merriweather(fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: bookingService.isLoading
          ? const Center(child: CircularProgressIndicator())
          : bookingService.bookings.isEmpty
              ? RefreshIndicator(
                  onRefresh: () async => _loadBookings(),
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(LucideIcons.calendarX, size: 48, color: AppTheme.brandMuted),
                        const SizedBox(height: 12),
                        Text("No scheduled lessons yet", style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text(
                          isTeacher ? "Upcoming student sessions will appear here." : "Book a tutor to start your live preparation lessons.",
                          style: GoogleFonts.inter(fontSize: 13, color: AppTheme.brandMuted),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async => _loadBookings(),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: bookingService.bookings.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 14),
                    itemBuilder: (context, index) {
                      final b = bookingService.bookings[index];
                      final isUpcoming = b.scheduledAt.isAfter(DateTime.now().subtract(const Duration(minutes: 60)));

                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppTheme.lightBorder),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: b.isConfirmed
                                        ? AppTheme.brandPrimaryLight
                                        : AppTheme.brandGoldSoft,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    b.status.toUpperCase(),
                                    style: GoogleFonts.inter(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: b.isConfirmed ? AppTheme.brandPrimary : AppTheme.brandGold,
                                    ),
                                  ),
                                ),
                                Text(
                                  CurrencyFormatter.formatGhs(b.totalAmountCents),
                                  style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.brandInk),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              isTeacher
                                  ? (b.studentName ?? "Student Session")
                                  : (b.teacherName ?? "Tutor Lesson"),
                              style: GoogleFonts.merriweather(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              b.subjectName ?? "General WAEC Preparation",
                              style: GoogleFonts.inter(fontSize: 13, color: AppTheme.brandPrimary, fontWeight: FontWeight.w500),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                const Icon(LucideIcons.calendar, size: 14, color: AppTheme.brandMuted),
                                const SizedBox(width: 6),
                                Text(
                                  DateFormat("EEE, MMM d • h:mm a").format(b.scheduledAt),
                                  style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandMuted),
                                ),
                                const SizedBox(width: 14),
                                const Icon(LucideIcons.clock, size: 14, color: AppTheme.brandMuted),
                                const SizedBox(width: 6),
                                Text(
                                  "${b.durationMinutes} mins",
                                  style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandMuted),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),

                            // Join Live Classroom button
                            ElevatedButton.icon(
                              onPressed: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute(
                                    builder: (_) => LiveClassroomScreen(
                                      bookingId: b.id,
                                      lessonTitle: isTeacher
                                          ? "Lesson with ${b.studentName ?? 'Student'}"
                                          : "Lesson with ${b.teacherName ?? 'Tutor'}",
                                    ),
                                  ),
                                );
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isUpcoming ? AppTheme.brandPrimary : AppTheme.brandInk,
                                padding: const EdgeInsets.symmetric(vertical: 12),
                                minimumSize: const Size(double.infinity, 44),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                              icon: const Icon(LucideIcons.video, size: 16),
                              label: Text(
                                isUpcoming ? "Enter Live Classroom" : "Review Room Session",
                                style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
