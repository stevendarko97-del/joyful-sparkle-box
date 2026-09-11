import 'package:flutter/foundation.dart';

class ApiConstants {
  // Base URLs (Switch automatically for Android Emulator, iOS Simulator, or Production)
  static String get baseUrl {
    if (kReleaseMode) {
      return "https://quicktutor-backend.onrender.com"; // Production deployed API
    }
    // Android Emulator uses 10.0.2.2 to access host localhost
    if (defaultTargetPlatform == TargetPlatform.android) {
      return "http://10.0.2.2:4000";
    }
    // iOS simulator / Desktop / Web
    return "http://localhost:4000";
  }

  static String get socketUrl => baseUrl;

  // Auth endpoints
  static const String login = "/api/auth/login";
  static const String register = "/api/auth/register";
  static const String me = "/api/auth/me";
  static const String updateProfile = "/api/auth/profile";

  // Teachers & Subjects
  static const String teachers = "/api/teachers";
  static const String subjects = "/api/subjects";
  static const String topics = "/api/topics";
  static String teacherDetail(String id) => "/api/teacher/$id";
  static String teacherReviews(String id) => "/api/teacher/$id/reviews";

  // Bookings & Student / Teacher
  static const String createBooking = "/api/bookings";
  static const String studentBookings = "/api/student/bookings";
  static const String teacherBookings = "/api/teacher/bookings";
  static const String teacherEarnings = "/api/teacher/earnings";
  static const String teacherPayouts = "/api/teacher/payouts";

  // Payments & Paystack Mobile Money
  static const String initializePayment = "/api/paystack/initialize";
  static const String verifyPayment = "/api/paystack/verify";

  // Messages & Notifications
  static const String conversations = "/api/messages/conversations";
  static String messages(String conversationId) => "/api/messages/$conversationId";
  static const String notifications = "/api/notifications";
  static const String readAllNotifications = "/api/notifications/read-all";

  // App info
  static const String appInfo = "/api/app/info";
}
