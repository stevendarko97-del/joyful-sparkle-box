class UserModel {
  final String id;
  final String email;
  final String fullName;
  final String role; // 'student' | 'teacher' | 'admin'
  final String? phone;
  final String? avatarUrl;
  final String? schoolName;
  final String? level;
  final String? examType;
  final String? location;

  UserModel({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.phone,
    this.avatarUrl,
    this.schoolName,
    this.level,
    this.examType,
    this.location,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      fullName: json['full_name'] ?? json['fullName'] ?? 'User',
      role: json['role'] ?? 'student',
      phone: json['phone'],
      avatarUrl: json['avatar_url'] ?? json['avatarUrl'],
      schoolName: json['school_name'],
      level: json['level'],
      examType: json['exam_type'],
      location: json['location'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'full_name': fullName,
      'role': role,
      'phone': phone,
      'avatar_url': avatarUrl,
      'school_name': schoolName,
      'level': level,
      'exam_type': examType,
      'location': location,
    };
  }

  bool get isTeacher => role == 'teacher';
  bool get isAdmin => role == 'admin';
  bool get isStudent => role == 'student';
}
