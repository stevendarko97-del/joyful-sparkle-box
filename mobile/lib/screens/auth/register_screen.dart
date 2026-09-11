import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../services/auth_service.dart';
import '../main_navigation_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  
  String _selectedRole = 'student'; // 'student' | 'teacher'
  String _selectedExam = 'WASSCE';
  String _selectedRegion = 'Greater Accra';

  final List<String> _examOptions = ['BECE', 'WASSCE', 'NOV/DEC', 'Remedials'];
  final List<String> _regions = [
    'Greater Accra', 'Ashanti', 'Central', 'Eastern', 'Western',
    'Volta', 'Northern', 'Upper East', 'Upper West', 'Bono'
  ];

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    final authService = Provider.of<AuthService>(context, listen: false);
    final success = await authService.register(
      fullName: _fullNameController.text,
      email: _emailController.text,
      password: _passwordController.text,
      role: _selectedRole,
      phone: _phoneController.text,
      location: _selectedRegion,
      examType: _selectedExam,
    );

    if (!mounted) return;

    if (success) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const MainNavigationScreen()),
        (route) => false,
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(authService.errorMessage ?? "Registration failed. Please try again."),
          backgroundColor: AppTheme.brandRed,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  "Create Account",
                  style: GoogleFonts.merriweather(
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.brandInk,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  "Join thousands of Ghanaian students and certified tutors",
                  style: GoogleFonts.inter(fontSize: 14, color: AppTheme.brandMuted),
                ),
                const SizedBox(height: 24),

                // Role Toggle (Student vs Tutor)
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: AppTheme.lightBorder.withOpacity(0.5),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _selectedRole = 'student'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: _selectedRole == 'student' ? Colors.white : Colors.transparent,
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: _selectedRole == 'student'
                                  ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)]
                                  : [],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  LucideIcons.bookOpen,
                                  size: 16,
                                  color: _selectedRole == 'student' ? AppTheme.brandPrimary : AppTheme.brandMuted,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  "I'm a Student",
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: _selectedRole == 'student' ? AppTheme.brandPrimary : AppTheme.brandMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _selectedRole = 'teacher'),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: _selectedRole == 'teacher' ? Colors.white : Colors.transparent,
                              borderRadius: BorderRadius.circular(10),
                              boxShadow: _selectedRole == 'teacher'
                                  ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)]
                                  : [],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  LucideIcons.graduationCap,
                                  size: 16,
                                  color: _selectedRole == 'teacher' ? AppTheme.brandPrimary : AppTheme.brandMuted,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  "I'm a Tutor",
                                  style: GoogleFonts.inter(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: _selectedRole == 'teacher' ? AppTheme.brandPrimary : AppTheme.brandMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Full Name
                Text("Full Name", style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _fullNameController,
                  decoration: const InputDecoration(
                    hintText: "e.g. Kwame Mensah",
                    prefixIcon: Icon(LucideIcons.user, size: 20, color: AppTheme.brandMuted),
                  ),
                  validator: (v) => v == null || v.isEmpty ? "Please enter your full name" : null,
                ),
                const SizedBox(height: 16),

                // Email
                Text("Email Address", style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    hintText: "kwame@gmail.com",
                    prefixIcon: Icon(LucideIcons.mail, size: 20, color: AppTheme.brandMuted),
                  ),
                  validator: (v) => v == null || !v.contains("@") ? "Enter a valid email" : null,
                ),
                const SizedBox(height: 16),

                // Ghana Phone Number (for Arkesel SMS & Mobile Money)
                Text("Ghana Phone (MoMo / SMS)", style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    hintText: "024XXXXXXX or +233...",
                    prefixIcon: Icon(LucideIcons.phone, size: 20, color: AppTheme.brandMuted),
                  ),
                  validator: (v) => v == null || v.isEmpty ? "Please enter your phone number" : null,
                ),
                const SizedBox(height: 16),

                // Exam Track
                if (_selectedRole == 'student') ...[
                  Text("Exam Target", style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: _selectedExam,
                    items: _examOptions.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                    onChanged: (val) => setState(() => _selectedExam = val ?? 'WASSCE'),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(LucideIcons.award, size: 20, color: AppTheme.brandMuted),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Region
                Text("Region in Ghana", style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: _selectedRegion,
                  items: _regions.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                  onChanged: (val) => setState(() => _selectedRegion = val ?? 'Greater Accra'),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(LucideIcons.mapPin, size: 20, color: AppTheme.brandMuted),
                  ),
                ),
                const SizedBox(height: 16),

                // Password
                Text("Password", style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    hintText: "At least 6 characters",
                    prefixIcon: Icon(LucideIcons.lock, size: 20, color: AppTheme.brandMuted),
                  ),
                  validator: (v) => v == null || v.length < 6 ? "Password must be at least 6 characters" : null,
                ),
                const SizedBox(height: 30),

                // Register Button
                ElevatedButton(
                  onPressed: authService.isLoading ? null : _handleRegister,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: AppTheme.brandPrimary,
                  ),
                  child: authService.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          "Create My Account",
                          style: GoogleFonts.inter(fontSize: 16, fontWeight: FontWeight.w600),
                        ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
