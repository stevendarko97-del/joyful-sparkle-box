import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme/app_theme.dart';

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({super.key});

  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  final List<Map<String, dynamic>> _mockConversations = [
    {
      "name": "Mr. Kofi Ansah",
      "role": "Elective Maths Tutor",
      "lastMessage": "We will cover calculus and coordinate geometry tomorrow at 4 PM.",
      "time": "10:45 AM",
      "unread": 2,
    },
    {
      "name": "Dr. Sarah Mensah",
      "role": "Integrated Science Tutor",
      "lastMessage": "Great job on the past questions assignment!",
      "time": "Yesterday",
      "unread": 0,
    },
    {
      "name": "Quick Tutor Support Ghana",
      "role": "Platform Support",
      "lastMessage": "Your Mobile Money payment of GH₵ 80 was confirmed.",
      "time": "Sep 9",
      "unread": 0,
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Direct Messages", style: GoogleFonts.merriweather(fontSize: 18, fontWeight: FontWeight.bold)),
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _mockConversations.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final c = _mockConversations[index];
          return InkWell(
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text("Chat with ${c['name']} active")),
              );
            },
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.lightBorder),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: AppTheme.brandPrimaryLight,
                    child: Text(
                      c['name'][0],
                      style: GoogleFonts.merriweather(fontWeight: FontWeight.bold, color: AppTheme.brandPrimary),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(c['name'], style: GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.bold)),
                            Text(c['time'], style: GoogleFonts.inter(fontSize: 11, color: AppTheme.brandMuted)),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(c['role'], style: GoogleFonts.inter(fontSize: 11, color: AppTheme.brandPrimary, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(
                          c['lastMessage'],
                          style: GoogleFonts.inter(fontSize: 12, color: AppTheme.brandMuted),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
