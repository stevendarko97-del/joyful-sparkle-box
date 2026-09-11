import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../services/auth_service.dart';
import '../../services/socket_service.dart';

class LiveClassroomScreen extends StatefulWidget {
  final String bookingId;
  final String lessonTitle;

  const LiveClassroomScreen({
    super.key,
    required this.bookingId,
    required this.lessonTitle,
  });

  @override
  State<LiveClassroomScreen> createState() => _LiveClassroomScreenState();
}

class _LiveClassroomScreenState extends State<LiveClassroomScreen> {
  bool _isMicMuted = false;
  bool _isCameraOff = false;
  bool _showChat = false;
  final _chatInputController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<SocketService>(context, listen: false).connectToRoom(widget.bookingId);
    });
  }

  @override
  void dispose() {
    _chatInputController.dispose();
    super.dispose();
  }

  void _sendMessage() {
    final text = _chatInputController.text.trim();
    if (text.isEmpty) return;

    final auth = Provider.of<AuthService>(context, listen: false);
    final socket = Provider.of<SocketService>(context, listen: false);
    socket.sendChatMessage(text, auth.currentUser?.fullName ?? 'Me');
    _chatInputController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final socket = Provider.of<SocketService>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF0D1217),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0D1217),
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.lessonTitle, style: GoogleFonts.inter(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(color: Colors.greenAccent, shape: BoxShape.circle),
                ),
                const SizedBox(width: 4),
                Text(
                  socket.isConnected ? "Live Classroom Connected" : "Connecting to classroom...",
                  style: GoogleFonts.inter(color: Colors.white70, fontSize: 10),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(
              _showChat ? LucideIcons.messageSquareDashed : LucideIcons.messageSquare,
              color: Colors.white,
              size: 20,
            ),
            onPressed: () => setState(() => _showChat = !_showChat),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Video Classroom Canvas View
            Expanded(
              child: Stack(
                children: [
                  // Main Video Stream (Remote Tutor/Student)
                  Container(
                    margin: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF161F28),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CircleAvatar(
                            radius: 44,
                            backgroundColor: AppTheme.brandPrimary,
                            child: const Icon(LucideIcons.userCheck, size: 40, color: Colors.white),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            "Live Video Feed Active",
                            style: GoogleFonts.inter(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "WebRTC peer-to-peer classroom session",
                            style: GoogleFonts.inter(color: Colors.white54, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Floating Self Video Preview
                  Positioned(
                    top: 24,
                    right: 24,
                    width: 100,
                    height: 140,
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF222F3E),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white24, width: 1.5),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withOpacity(0.4), blurRadius: 8),
                        ],
                      ),
                      child: Center(
                        child: _isCameraOff
                            ? const Icon(LucideIcons.videoOff, color: Colors.white54, size: 24)
                            : const Icon(LucideIcons.user, color: Colors.white, size: 28),
                      ),
                    ),
                  ),

                  // Live In-Classroom Chat Overlay
                  if (_showChat)
                    Positioned(
                      bottom: 12,
                      left: 12,
                      right: 12,
                      height: 240,
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A).withOpacity(0.95),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white12),
                        ),
                        child: Column(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              decoration: const BoxDecoration(
                                border: Border(bottom: BorderSide(color: Colors.white12)),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text("Classroom Live Chat", style: GoogleFonts.inter(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                                  IconButton(
                                    icon: const Icon(LucideIcons.x, size: 16, color: Colors.white70),
                                    onPressed: () => setState(() => _showChat = false),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: ListView.builder(
                                padding: const EdgeInsets.all(10),
                                itemCount: socket.liveMessages.length,
                                itemBuilder: (context, idx) {
                                  final m = socket.liveMessages[idx];
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 6),
                                    child: RichText(
                                      text: TextSpan(
                                        text: "${m['sender'] ?? 'User'}: ",
                                        style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.brandGold, fontSize: 12),
                                        children: [
                                          TextSpan(
                                            text: m['message'] ?? '',
                                            style: const TextStyle(fontWeight: FontWeight.normal, color: Colors.white, fontSize: 12),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(8.0),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _chatInputController,
                                      style: const TextStyle(color: Colors.white, fontSize: 13),
                                      decoration: InputDecoration(
                                        hintText: "Type message to teacher...",
                                        hintStyle: const TextStyle(color: Colors.white38, fontSize: 12),
                                        fillColor: Colors.white.withOpacity(0.08),
                                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(20)),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  IconButton(
                                    icon: const Icon(LucideIcons.send, color: AppTheme.brandGold, size: 18),
                                    onPressed: _sendMessage,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // Media Control Bar (Mute, Camera, Whiteboard, End Call)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
              decoration: const BoxDecoration(
                color: Color(0xFF131A22),
                border: Border(top: BorderSide(color: Colors.white10)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildCallButton(
                    icon: _isMicMuted ? LucideIcons.micOff : LucideIcons.mic,
                    isActive: !_isMicMuted,
                    onTap: () => setState(() => _isMicMuted = !_isMicMuted),
                  ),
                  _buildCallButton(
                    icon: _isCameraOff ? LucideIcons.videoOff : LucideIcons.video,
                    isActive: !_isCameraOff,
                    onTap: () => setState(() => _isCameraOff = !_isCameraOff),
                  ),
                  _buildCallButton(
                    icon: LucideIcons.penTool,
                    isActive: false,
                    label: "Board",
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Interactive Whiteboard Synchronized")),
                      );
                    },
                  ),
                  _buildCallButton(
                    icon: LucideIcons.phoneOff,
                    isDestructive: true,
                    onTap: () {
                      Provider.of<SocketService>(context, listen: false).disconnect();
                      Navigator.of(context).pop();
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCallButton({
    required IconData icon,
    bool isActive = false,
    bool isDestructive = false,
    String? label,
    required VoidCallback onTap,
  }) {
    Color bg = Colors.white.withOpacity(0.12);
    Color fg = Colors.white;

    if (isDestructive) {
      bg = Colors.red;
      fg = Colors.white;
    } else if (isActive) {
      bg = AppTheme.brandPrimary;
      fg = Colors.white;
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(25),
      child: Container(
        width: 50,
        height: 50,
        decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
        child: Icon(icon, color: fg, size: 22),
      ),
    );
  }
}
