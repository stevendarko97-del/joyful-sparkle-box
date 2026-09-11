import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/currency_formatter.dart';
import '../../models/tutor_model.dart';
import '../../services/auth_service.dart';
import '../../services/tutor_service.dart';
import '../auth/login_screen.dart';
import '../bookings/booking_flow_screen.dart';

class TutorDetailScreen extends StatefulWidget {
  final TutorModel tutor;
  const TutorDetailScreen({super.key, required this.tutor});

  @override
  State<TutorDetailScreen> createState() => _TutorDetailScreenState();
}

class _TutorDetailScreenState extends State<TutorDetailScreen> {
  List<TutorReview> _reviews = [];
  bool _loadingReviews = true;

  @override
  void initState() {
    super.initState();
    _loadReviews();
  }

  Future<void> _loadReviews() async {
    final tutorService = Provider.of<TutorService>(context, listen: false);
    final list = await tutorService.getTutorReviews(widget.tutor.id);
    if (mounted) {
      setState(() {
        _reviews = list;
        _loadingReviews = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tutor = widget.tutor;
    final auth = Provider.of<AuthService>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(tutor.fullName, style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.heart, size: 20),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Tutor added to saved favorites")),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header card
            Container(
              padding: const EdgeInsets.all(20),
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
                      tutor.fullName.isNotEmpty ? tutor.fullName[0] : 'T',
                      style: GoogleFonts.merriweather(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.brandPrimary),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        tutor.fullName,
                        style: GoogleFonts.merriweather(fontSize: 20, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.verified, size: 18, color: AppTheme.brandPrimary),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    tutor.headline ?? "Senior WAEC Examiner & Tutor",
                    style: GoogleFonts.inter(fontSize: 13, color: AppTheme.brandMuted),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildStatBadge("Rating", "${tutor.rating.toStringAsFixed(1)} ★"),
                      _buildStatBadge("Experience", "${tutor.yearsExperience}+ Years"),
                      _buildStatBadge("Rate", CurrencyFormatter.formatGhsCompact(tutor.hourlyRateCents)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // About Bio
            Text("About the Tutor", style: GoogleFonts.merriweather(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(16),
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.lightBorder),
              ),
              child: Text(
                tutor.bio ?? "Experienced teacher providing detailed lesson plans, past question walkthroughs, and exam tricks for Ghanaian students.",
                style: GoogleFonts.inter(fontSize: 14, height: 1.5, color: AppTheme.brandInk),
              ),
            ),
            const SizedBox(height: 20),

            // Subjects & Exam tracks
            Text("Subjects & Curriculum", style: GoogleFonts.merriweather(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: tutor.subjects.map((s) => Chip(
                label: Text(s),
                backgroundColor: AppTheme.brandPrimaryLight,
                labelStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.brandPrimary),
                side: BorderSide.none,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              )).toList(),
            ),
            const SizedBox(height: 20),

            // Reviews section
            Text("Student Reviews (${_reviews.length})", style: GoogleFonts.merriweather(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            if (_loadingReviews)
              const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
            else if (_reviews.isEmpty)
              Container(
                padding: const EdgeInsets.all(16),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.lightBorder),
                ),
                child: Column(
                  children: [
                    const Icon(LucideIcons.messageSquare, size: 24, color: AppTheme.brandMuted),
                    const SizedBox(height: 6),
                    Text("5.0 rating from verified student lessons", style: GoogleFonts.inter(fontSize: 13, color: AppTheme.brandMuted)),
                  ],
                ),
              )
            else
              ..._reviews.map((r) => Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.lightBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(r.studentName, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold)),
                        Row(
                          children: List.generate(
                            r.rating,
                            (index) => const Icon(Icons.star, size: 14, color: AppTheme.brandGold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(r.comment, style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandInk.withOpacity(0.8))),
                  ],
                ),
              )),
            const SizedBox(height: 80),
          ],
        ),
      ),
      bottomSheet: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppTheme.lightBorder)),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -4)),
          ],
        ),
        child: SafeArea(
          child: Row(
            children: [
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Total Rate", style: GoogleFonts.inter(fontSize: 11, color: AppTheme.brandMuted)),
                  Text(
                    CurrencyFormatter.formatGhs(tutor.hourlyRateCents),
                    style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.brandPrimary),
                  ),
                ],
              ),
              const SizedBox(width: 20),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    if (!auth.isAuthenticated) {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const LoginScreen()));
                    } else {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => BookingFlowScreen(tutor: tutor)),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.brandPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text("Book 1-on-1 Lesson", style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatBadge(String label, String value) {
    return Column(
      children: [
        Text(value, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.brandInk)),
        const SizedBox(height: 2),
        Text(label, style: GoogleFonts.inter(fontSize: 11, color: AppTheme.brandMuted)),
      ],
    );
  }
}
