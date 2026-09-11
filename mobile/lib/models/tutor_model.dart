class SubjectModel {
  final String id;
  final String name;
  final String? code;
  final String? examType;

  SubjectModel({
    required this.id,
    required this.name,
    this.code,
    this.examType,
  });

  factory SubjectModel.fromJson(Map<String, dynamic> json) {
    return SubjectModel(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      code: json['code'],
      examType: json['exam_type'] ?? json['examType'],
    );
  }
}

class TutorReview {
  final String id;
  final String studentName;
  final int rating;
  final String comment;
  final String createdAt;

  TutorReview({
    required this.id,
    required this.studentName,
    required this.rating,
    required this.comment,
    required this.createdAt,
  });

  factory TutorReview.fromJson(Map<String, dynamic> json) {
    return TutorReview(
      id: json['id'] ?? '',
      studentName: json['student_name'] ?? 'Student',
      rating: json['rating'] ?? 5,
      comment: json['comment'] ?? '',
      createdAt: json['created_at'] ?? '',
    );
  }
}

class TutorModel {
  final String id;
  final String fullName;
  final String? headline;
  final String? bio;
  final int hourlyRateCents;
  final int yearsExperience;
  final String? location;
  final String? avatarUrl;
  final double rating;
  final int reviewsCount;
  final List<String> examTypes;
  final List<String> subjects;
  final bool isVerified;

  TutorModel({
    required this.id,
    required this.fullName,
    this.headline,
    this.bio,
    required this.hourlyRateCents,
    this.yearsExperience = 0,
    this.location,
    this.avatarUrl,
    this.rating = 5.0,
    this.reviewsCount = 0,
    this.examTypes = const [],
    this.subjects = const [],
    this.isVerified = true,
  });

  factory TutorModel.fromJson(Map<String, dynamic> json) {
    List<String> parsedExams = [];
    if (json['exam_types'] is List) {
      parsedExams = List<String>.from(json['exam_types']);
    } else if (json['exam_type'] is String) {
      parsedExams = [json['exam_type']];
    }

    List<String> parsedSubjects = [];
    if (json['subjects'] is List) {
      parsedSubjects = List<String>.from(json['subjects'].map((s) => s is Map ? (s['name'] ?? '') : s.toString()));
    } else if (json['primary_subject_name'] != null) {
      parsedSubjects = [json['primary_subject_name'].toString()];
    }

    return TutorModel(
      id: json['id'] ?? json['user_id'] ?? '',
      fullName: json['full_name'] ?? json['fullName'] ?? 'Ghana Tutor',
      headline: json['headline'] ?? 'Experienced WAEC Educator',
      bio: json['bio'] ?? 'Dedicated to helping Ghanaian students excel in BECE, WASSCE and NOV/DEC examinations.',
      hourlyRateCents: json['hourly_rate_cents'] ?? json['hourlyRateCents'] ?? 4000,
      yearsExperience: json['years_experience'] ?? 2,
      location: json['location'] ?? 'Greater Accra, Ghana',
      avatarUrl: json['avatar_url'],
      rating: (json['rating'] != null) ? (json['rating'] as num).toDouble() : 4.9,
      reviewsCount: json['reviews_count'] ?? json['reviewsCount'] ?? 12,
      examTypes: parsedExams.isNotEmpty ? parsedExams : ['BECE', 'WASSCE', 'NOV/DEC'],
      subjects: parsedSubjects.isNotEmpty ? parsedSubjects : ['Core Mathematics', 'Integrated Science'],
      isVerified: json['is_verified'] ?? true,
    );
  }
}
