import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/currency_formatter.dart';
import '../../models/tutor_model.dart';
import '../../services/auth_service.dart';
import '../../services/booking_service.dart';
import '../../services/payment_service.dart';
import '../main_navigation_screen.dart';

class BookingFlowScreen extends StatefulWidget {
  final TutorModel tutor;
  const BookingFlowScreen({super.key, required this.tutor});

  @override
  State<BookingFlowScreen> createState() => _BookingFlowScreenState();
}

class _BookingFlowScreenState extends State<BookingFlowScreen> {
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _selectedTime = const TimeOfDay(hour: 16, minute: 0);
  int _selectedDurationMinutes = 60;
  String _selectedProvider = 'mtn'; // 'mtn' | 'vodafone' | 'airteltigo' | 'card'
  final _phoneController = TextEditingController();
  final _notesController = TextEditingController();

  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthService>(context, listen: false);
    if (auth.currentUser?.phone != null) {
      _phoneController.text = auth.currentUser!.phone!;
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  int get _calculatedTotalCents {
    final ratePerMin = widget.tutor.hourlyRateCents / 60.0;
    return (ratePerMin * _selectedDurationMinutes).round();
  }

  DateTime get _combinedDateTime {
    return DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
      _selectedTime.hour,
      _selectedTime.minute,
    );
  }

  Future<void> _handleConfirmAndPay() async {
    if (_phoneController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Please provide a Mobile Money phone number")),
      );
      return;
    }

    setState(() => _isProcessing = true);

    final bookingService = Provider.of<BookingService>(context, listen: false);
    final paymentService = Provider.of<PaymentService>(context, listen: false);
    final authService = Provider.of<AuthService>(context, listen: false);

    // 1. Create Booking in Database
    final booking = await bookingService.createBooking(
      teacherId: widget.tutor.id,
      scheduledAt: _combinedDateTime,
      durationMinutes: _selectedDurationMinutes,
      totalAmountCents: _calculatedTotalCents,
      notes: _notesController.text.trim().isNotEmpty ? _notesController.text.trim() : null,
    );

    if (booking == null) {
      setState(() => _isProcessing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(bookingService.errorMessage ?? "Failed to create booking"),
            backgroundColor: AppTheme.brandRed,
          ),
        );
      }
      return;
    }

    // 2. Initialize Paystack Mobile Money transaction
    final payRes = await paymentService.initializePaystack(
      bookingId: booking.id,
      email: authService.currentUser?.email ?? 'student@quicktutor.gh',
      amountCents: _calculatedTotalCents,
      mobileMoneyProvider: _selectedProvider,
      mobileMoneyPhone: _phoneController.text.trim(),
    );

    setState(() => _isProcessing = false);

    if (!mounted) return;

    // Show Success & Escrow dialog
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.check_circle, color: AppTheme.brandPrimary, size: 28),
            const SizedBox(width: 8),
            Text("Booking Confirmed!", style: GoogleFonts.merriweather(fontSize: 18, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Your 1-on-1 session with ${widget.tutor.fullName} has been created with MoMo Escrow protection.",
              style: GoogleFonts.inter(fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.brandGoldSoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.shieldCheck, size: 20, color: AppTheme.brandInk),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "Funds are held safely in escrow until the lesson completes.",
                      style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.brandInk),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(
              "📱 SMS reminder will be sent 30 mins before lesson starts.",
              style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandMuted),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
                (route) => false,
              );
            },
            child: const Text("Go to My Lessons"),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Book Lesson", style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Tutor Summary card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.lightBorder),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: AppTheme.brandPrimaryLight,
                    child: Text(
                      widget.tutor.fullName[0],
                      style: GoogleFonts.merriweather(color: AppTheme.brandPrimary, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.tutor.fullName, style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold)),
                        Text(
                          widget.tutor.subjects.join(", "),
                          style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandPrimary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Text(
                    CurrencyFormatter.formatGhsCompact(widget.tutor.hourlyRateCents),
                    style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.brandPrimary),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Date & Time Picker
            Text("Schedule Date & Time", style: GoogleFonts.merriweather(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _selectedDate,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 30)),
                      );
                      if (picked != null) setState(() => _selectedDate = picked);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.lightBorder),
                      ),
                      child: Row(
                        children: [
                          const Icon(LucideIcons.calendar, size: 18, color: AppTheme.brandPrimary),
                          const SizedBox(width: 8),
                          Text(DateFormat("MMM dd, yyyy").format(_selectedDate), style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: InkWell(
                    onTap: () async {
                      final picked = await showTimePicker(
                        context: context,
                        initialTime: _selectedTime,
                      );
                      if (picked != null) setState(() => _selectedTime = picked);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.lightBorder),
                      ),
                      child: Row(
                        children: [
                          const Icon(LucideIcons.clock, size: 18, color: AppTheme.brandPrimary),
                          const SizedBox(width: 8),
                          Text(_selectedTime.format(context), style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Lesson Duration
            Text("Lesson Duration", style: GoogleFonts.merriweather(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            Row(
              children: [60, 90, 120].map((mins) {
                final isSelected = _selectedDurationMinutes == mins;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: InkWell(
                      onTap: () => setState(() => _selectedDurationMinutes = mins),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.brandPrimary : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: isSelected ? AppTheme.brandPrimary : AppTheme.lightBorder),
                        ),
                        child: Center(
                          child: Text(
                            "$mins mins",
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: isSelected ? Colors.white : AppTheme.brandInk,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Payment method (Mobile Money Ghana)
            Text("Ghana Mobile Money / Payment", style: GoogleFonts.merriweather(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            Row(
              children: [
                _buildProviderOption("mtn", "MTN MoMo", "💛"),
                const SizedBox(width: 8),
                _buildProviderOption("vodafone", "Telecel Cash", "❤️"),
                const SizedBox(width: 8),
                _buildProviderOption("airteltigo", "AT Money", "💙"),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: "Mobile Money Wallet Number",
                hintText: "024XXXXXXX",
                prefixIcon: Icon(LucideIcons.phoneCall, size: 18, color: AppTheme.brandMuted),
              ),
            ),
            const SizedBox(height: 16),

            // Lesson notes
            TextField(
              controller: _notesController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: "Notes or Topic for Tutor (Optional)",
                hintText: "e.g. Please help with Trigonometry past questions 2023",
              ),
            ),
            const SizedBox(height: 24),

            // Total summary
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.brandPrimaryLight,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.brandPrimary.withOpacity(0.2)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Total Amount (MoMo Escrow)", style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandPrimary)),
                      Text(
                        CurrencyFormatter.formatGhs(_calculatedTotalCents),
                        style: GoogleFonts.merriweather(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.brandPrimaryDark),
                      ),
                    ],
                  ),
                  const Icon(LucideIcons.lock, size: 24, color: AppTheme.brandPrimary),
                ],
              ),
            ),
            const SizedBox(height: 30),

            // Pay & Confirm Button
            ElevatedButton(
              onPressed: _isProcessing ? null : _handleConfirmAndPay,
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                backgroundColor: AppTheme.brandPrimary,
                minimumSize: const Size(double.infinity, 50),
              ),
              child: _isProcessing
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text("Pay with Mobile Money Escrow", style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProviderOption(String value, String label, String emoji) {
    final isSelected = _selectedProvider == value;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _selectedProvider = value),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.brandGoldSoft : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppTheme.brandGold : AppTheme.lightBorder,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Column(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 16)),
              const SizedBox(height: 4),
              Text(
                label,
                style: GoogleFonts.inter(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.brandInk),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
