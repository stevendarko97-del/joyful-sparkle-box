import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/currency_formatter.dart';
import '../../services/auth_service.dart';
import '../../services/tutor_service.dart';
import '../tutors/tutor_detail_screen.dart';
import '../tutors/tutor_list_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<TutorService>(context, listen: false).fetchTutors();
      Provider.of<TutorService>(context, listen: false).fetchSubjects();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    final tutorService = Provider.of<TutorService>(context);
    final user = auth.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.brandPrimary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(LucideIcons.graduationCap, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Quick Tutor", style: GoogleFonts.merriweather(fontSize: 16, fontWeight: FontWeight.bold)),
                Text("GHANA 1-ON-1 PREP", style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.bold, color: AppTheme.brandPrimary)),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.bell, size: 20),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("No new notifications")),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await tutorService.fetchTutors();
          await tutorService.fetchSubjects();
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Greeting Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.brandPrimaryDark, AppTheme.brandPrimary],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.brandPrimary.withOpacity(0.25),
                      blurRadius: 15,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.brandGold.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppTheme.brandGold.withOpacity(0.4)),
                          ),
                          child: Text(
                            "BECE • WASSCE • NOV/DEC",
                            style: GoogleFonts.inter(
                              color: AppTheme.brandGold,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const Spacer(),
                        const Text("🇬🇭", style: TextStyle(fontSize: 16)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      user != null ? "Hello, ${user.fullName.split(' ')[0]} 👋" : "Pass with Confidence 👋",
                      style: GoogleFonts.merriweather(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      "Find top-rated Ghanaian tutors for one-on-one live lessons.",
                      style: GoogleFonts.inter(color: Colors.white70, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const TutorListScreen()),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.brandGold,
                        foregroundColor: AppTheme.brandInk,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      icon: const Icon(LucideIcons.search, size: 16, color: AppTheme.brandInk),
                      label: Text(
                        "Browse All Tutors",
                        style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Exam Tracks Quick Select
              Text(
                "Select Exam Track",
                style: GoogleFonts.merriweather(fontSize: 17, fontWeight: FontWeight.bold, color: AppTheme.brandInk),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _buildTrackCard(
                    title: "BECE",
                    subtitle: "JHS 1 - 3",
                    icon: "🎒",
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const TutorListScreen(initialExam: "BECE")),
                    ),
                  ),
                  const SizedBox(width: 10),
                  _buildTrackCard(
                    title: "WASSCE",
                    subtitle: "SHS 1 - 3",
                    icon: "📚",
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const TutorListScreen(initialExam: "WASSCE")),
                    ),
                  ),
                  const SizedBox(width: 10),
                  _buildTrackCard(
                    title: "NOV/DEC",
                    subtitle: "Remedials",
                    icon: "🎯",
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const TutorListScreen(initialExam: "NOV/DEC")),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              // Popular WAEC Subjects
              Text(
                "Popular WAEC Subjects",
                style: GoogleFonts.merriweather(fontSize: 17, fontWeight: FontWeight.bold, color: AppTheme.brandInk),
              ),
              const SizedBox(height: 12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildSubjectPill("Core Mathematics", LucideIcons.calculator),
                    _buildSubjectPill("Elective Maths", LucideIcons.trendingUp),
                    _buildSubjectPill("Integrated Science", LucideIcons.flaskConical),
                    _buildSubjectPill("English Language", LucideIcons.bookA),
                    _buildSubjectPill("Social Studies", LucideIcons.globe),
                    _buildSubjectPill("Physics & Chemistry", LucideIcons.atom),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Featured Verified Ghanaian Tutors
              Row(
                mainAxisAlignment: MainAxisAlignment.between,
                children: [
                  Text(
                    "Top Rated Tutors",
                    style: GoogleFonts.merriweather(fontSize: 17, fontWeight: FontWeight.bold, color: AppTheme.brandInk),
                  ),
                  TextButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const TutorListScreen()),
                    ),
                    child: Text("View all", style: GoogleFonts.inter(fontSize: 13, color: AppTheme.brandPrimary, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              if (tutorService.isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (tutorService.tutors.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.lightBorder),
                  ),
                  child: Column(
                    children: [
                      const Icon(LucideIcons.users, size: 32, color: AppTheme.brandMuted),
                      const SizedBox(height: 8),
                      Text("Tutors are loading...", style: GoogleFonts.inter(fontSize: 14, color: AppTheme.brandMuted)),
                    ],
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: tutorService.tutors.take(4).length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final tutor = tutorService.tutors[index];
                    return InkWell(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => TutorDetailScreen(tutor: tutor)),
                      ),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppTheme.lightBorder),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.02),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CircleAvatar(
                              radius: 24,
                              backgroundColor: AppTheme.brandPrimaryLight,
                              child: Text(
                                tutor.fullName.isNotEmpty ? tutor.fullName[0] : 'T',
                                style: GoogleFonts.merriweather(
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.brandPrimary,
                                ),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Flexible(
                                        child: Text(
                                          tutor.fullName,
                                          style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      const Icon(Icons.verified, size: 16, color: AppTheme.brandPrimary),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    tutor.subjects.isNotEmpty ? tutor.subjects.join(" • ") : "Maths & Science",
                                    style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandPrimary, fontWeight: FontWeight.w500),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      const Icon(Icons.star, size: 14, color: AppTheme.brandGold),
                                      const SizedBox(width: 4),
                                      Text(
                                        "${tutor.rating.toStringAsFixed(1)} (${tutor.reviewsCount})",
                                        style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
                                      ),
                                      const SizedBox(width: 10),
                                      const Icon(LucideIcons.mapPin, size: 12, color: AppTheme.brandMuted),
                                      const SizedBox(width: 2),
                                      Expanded(
                                        child: Text(
                                          tutor.location ?? 'Ghana',
                                          style: GoogleFonts.inter(fontSize: 11, color: AppTheme.brandMuted),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  CurrencyFormatter.formatGhsCompact(tutor.hourlyRateCents),
                                  style: GoogleFonts.inter(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.brandPrimary,
                                  ),
                                ),
                                Text(
                                  "/ hr",
                                  style: GoogleFonts.inter(fontSize: 10, color: AppTheme.brandMuted),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTrackCard({
    required String title,
    required String subtitle,
    required String icon,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.lightBorder),
          ),
          child: Column(
            children: [
              Text(icon, style: const TextStyle(fontSize: 22)),
              const SizedBox(height: 6),
              Text(
                title,
                style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.brandInk),
              ),
              Text(
                subtitle,
                style: GoogleFonts.inter(fontSize: 11, color: AppTheme.brandMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSubjectPill(String title, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.lightBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppTheme.brandPrimary),
          const SizedBox(width: 6),
          Text(
            title,
            style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.brandInk),
          ),
        ],
      ),
    );
  }
}
