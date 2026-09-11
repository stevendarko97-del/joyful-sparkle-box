class BookingModel {
  final String id;
  final String studentId;
  final String teacherId;
  final String? studentName;
  final String? teacherName;
  final String? subjectName;
  final DateTime scheduledAt;
  final int durationMinutes;
  final int totalAmountCents;
  final String status; // 'pending' | 'confirmed' | 'completed' | 'cancelled'
  final String? paystackReference;
  final String? studentPhone;
  final String? teacherPhone;
  final String? notes;

  BookingModel({
    required this.id,
    required this.studentId,
    required this.teacherId,
    this.studentName,
    this.teacherName,
    this.subjectName,
    required this.scheduledAt,
    this.durationMinutes = 60,
    required this.totalAmountCents,
    required this.status,
    this.paystackReference,
    this.studentPhone,
    this.teacherPhone,
    this.notes,
  });

  factory BookingModel.fromJson(Map<String, dynamic> json) {
    return BookingModel(
      id: json['id'] ?? '',
      studentId: json['student_id'] ?? '',
      teacherId: json['teacher_id'] ?? '',
      studentName: json['student_name'] ?? json['student_full_name'],
      teacherName: json['teacher_name'] ?? json['teacher_full_name'],
      subjectName: json['subject_name'] ?? json['subject'],
      scheduledAt: json['scheduled_at'] != null 
          ? DateTime.tryParse(json['scheduled_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
      durationMinutes: json['duration_minutes'] ?? 60,
      totalAmountCents: json['total_amount_cents'] ?? json['amount_cents'] ?? 4000,
      status: json['status'] ?? 'pending',
      paystackReference: json['paystack_reference'],
      studentPhone: json['student_phone'],
      teacherPhone: json['teacher_phone'],
      notes: json['notes'],
    );
  }

  bool get isConfirmed => status == 'confirmed';
  bool get isPending => status == 'pending';
  bool get isCompleted => status == 'completed';
  bool get isCancelled => status == 'cancelled';
}
