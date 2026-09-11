import 'package:flutter/foundation.dart';
import '../core/constants/api_constants.dart';
import '../models/booking_model.dart';
import 'api_service.dart';

class BookingService extends ChangeNotifier {
  List<BookingModel> _bookings = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<BookingModel> get bookings => _bookings;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchStudentBookings() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.get(ApiConstants.studentBookings);
      final List list = res['bookings'] ?? res['data'] ?? (res is List ? res : []);
      _bookings = list.map((item) => BookingModel.fromJson(item)).toList();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchTeacherBookings() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.get(ApiConstants.teacherBookings);
      final List list = res['bookings'] ?? res['data'] ?? (res is List ? res : []);
      _bookings = list.map((item) => BookingModel.fromJson(item)).toList();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<BookingModel?> createBooking({
    required String teacherId,
    required DateTime scheduledAt,
    required int durationMinutes,
    required int totalAmountCents,
    String? notes,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.post(ApiConstants.createBooking, {
        'teacher_id': teacherId,
        'scheduled_at': scheduledAt.toIso8601String(),
        'duration_minutes': durationMinutes,
        'total_amount_cents': totalAmountCents,
        'notes': notes,
      });

      _isLoading = false;
      notifyListeners();
      
      final bookingData = res['booking'] ?? res['data'] ?? res;
      return BookingModel.fromJson(bookingData);
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }
}
