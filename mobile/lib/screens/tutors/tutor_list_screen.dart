import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/currency_formatter.dart';
import '../../services/tutor_service.dart';
import 'tutor_detail_screen.dart';

class TutorListScreen extends StatefulWidget {
  final String? initialExam;
  const TutorListScreen({super.key, this.initialExam});

  @override
  State<TutorListScreen> createState() => _TutorListScreenState();
}

class _TutorListScreenState extends State<TutorListScreen> {
  final _searchController = TextEditingController();
  String _selectedExam = 'All';
  String _selectedRegion = 'All Regions';

  final List<String> _examFilters = ['All', 'BECE', 'WASSCE', 'NOV/DEC'];
  final List<String> _regionFilters = [
    'All Regions', 'Greater Accra', 'Ashanti', 'Central', 'Eastern', 'Western', 'Volta', 'Northern'
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialExam != null) {
      _selectedExam = widget.initialExam!;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _applyFilter();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _applyFilter() {
    final tutorService = Provider.of<TutorService>(context, listen: false);
    tutorService.fetchTutors(
      search: _searchController.text.trim().isNotEmpty ? _searchController.text.trim() : null,
      examType: _selectedExam != 'All' ? _selectedExam : null,
      region: _selectedRegion != 'All Regions' ? _selectedRegion : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tutorService = Provider.of<TutorService>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          "Verified Ghanaian Tutors",
          style: GoogleFonts.merriweather(fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
      body: Column(
        children: [
          // Search & Filter header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: Colors.white,
            child: Column(
              children: [
                // Search Input
                TextField(
                  controller: _searchController,
                  onSubmitted: (_) => _applyFilter(),
                  decoration: InputDecoration(
                    hintText: "Search by subject, name, or topic...",
                    prefixIcon: const Icon(LucideIcons.search, size: 20, color: AppTheme.brandMuted),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(LucideIcons.x, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              _applyFilter();
                            },
                          )
                        : null,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
                const SizedBox(height: 10),

                // Exam Filter pills
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _examFilters.map((exam) {
                      final isSelected = _selectedExam == exam;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(exam),
                          selected: isSelected,
                          onSelected: (val) {
                            if (val) {
                              setState(() => _selectedExam = exam);
                              _applyFilter();
                            }
                          },
                          selectedColor: AppTheme.brandPrimary,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : AppTheme.brandInk,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                          backgroundColor: Colors.grey.shade100,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          side: BorderSide.none,
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, thickness: 1, color: AppTheme.lightBorder),

          // Tutors list
          Expanded(
            child: tutorService.isLoading
                ? const Center(child: CircularProgressIndicator())
                : tutorService.tutors.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(LucideIcons.searchX, size: 48, color: AppTheme.brandMuted),
                            const SizedBox(height: 12),
                            Text("No tutors found", style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
                            const SizedBox(height: 4),
                            Text("Try adjusting your search terms or filters", style: GoogleFonts.inter(fontSize: 13, color: AppTheme.brandMuted)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () async => _applyFilter(),
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: tutorService.tutors.length,
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
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        CircleAvatar(
                                          radius: 26,
                                          backgroundColor: AppTheme.brandPrimaryLight,
                                          child: Text(
                                            tutor.fullName.isNotEmpty ? tutor.fullName[0] : 'T',
                                            style: GoogleFonts.merriweather(
                                              fontSize: 18,
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
                                                      style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold),
                                                      overflow: TextOverflow.ellipsis,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 4),
                                                  const Icon(Icons.verified, size: 16, color: AppTheme.brandPrimary),
                                                ],
                                              ),
                                              const SizedBox(height: 2),
                                              Text(
                                                tutor.headline ?? "Experienced WAEC Educator",
                                                style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandMuted),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ],
                                          ),
                                        ),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              CurrencyFormatter.formatGhsCompact(tutor.hourlyRateCents),
                                              style: GoogleFonts.inter(
                                                fontSize: 16,
                                                fontWeight: FontWeight.bold,
                                                color: AppTheme.brandPrimary,
                                              ),
                                            ),
                                            Text("/ hr", style: GoogleFonts.inter(fontSize: 10, color: AppTheme.brandMuted)),
                                          ],
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Text(
                                      tutor.bio ?? '',
                                      style: GoogleFonts.inter(fontSize: 13, color: AppTheme.brandInk.withOpacity(0.8), height: 1.4),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 12),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 4,
                                      children: tutor.subjects.map((s) => Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: AppTheme.brandPrimaryLight,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          s,
                                          style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.brandPrimary),
                                        ),
                                      )).toList(),
                                    ),
                                    const SizedBox(height: 12),
                                    const Divider(height: 1, thickness: 1, color: AppTheme.lightBorder),
                                    const SizedBox(height: 10),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Row(
                                          children: [
                                            const Icon(Icons.star, size: 15, color: AppTheme.brandGold),
                                            const SizedBox(width: 4),
                                            Text(
                                              "${tutor.rating.toStringAsFixed(1)} (${tutor.reviewsCount} reviews)",
                                              style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600),
                                            ),
                                          ],
                                        ),
                                        Row(
                                          children: [
                                            const Icon(LucideIcons.mapPin, size: 13, color: AppTheme.brandMuted),
                                            const SizedBox(width: 4),
                                            Text(
                                              tutor.location ?? 'Ghana',
                                              style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandMuted),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
