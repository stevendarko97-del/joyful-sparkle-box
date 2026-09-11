class MessageModel {
  final String id;
  final String conversationId;
  final String senderId;
  final String senderName;
  final String content;
  final DateTime createdAt;
  final bool isMe;

  MessageModel({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    required this.content,
    required this.createdAt,
    required this.isMe,
  });

  factory MessageModel.fromJson(Map<String, dynamic> json, String currentUserId) {
    final sender = json['sender_id'] ?? json['senderId'] ?? '';
    return MessageModel(
      id: json['id'] ?? '',
      conversationId: json['conversation_id'] ?? '',
      senderId: sender,
      senderName: json['sender_name'] ?? 'User',
      content: json['content'] ?? '',
      createdAt: json['created_at'] != null 
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      isMe: sender == currentUserId,
    );
  }
}

class ConversationModel {
  final String id;
  final String otherUserId;
  final String otherUserName;
  final String? otherUserAvatar;
  final String otherUserRole;
  final String? lastMessage;
  final DateTime lastMessageAt;

  ConversationModel({
    required this.id,
    required this.otherUserId,
    required this.otherUserName,
    this.otherUserAvatar,
    required this.otherUserRole,
    this.lastMessage,
    required this.lastMessageAt,
  });

  factory ConversationModel.fromJson(Map<String, dynamic> json) {
    return ConversationModel(
      id: json['id'] ?? '',
      otherUserId: json['other_user_id'] ?? json['user_id'] ?? '',
      otherUserName: json['other_user_name'] ?? json['full_name'] ?? 'Chat',
      otherUserAvatar: json['other_user_avatar'] ?? json['avatar_url'],
      otherUserRole: json['other_user_role'] ?? json['role'] ?? 'teacher',
      lastMessage: json['last_message'] ?? json['latest_message'],
      lastMessageAt: json['last_message_at'] != null
          ? DateTime.tryParse(json['last_message_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}
