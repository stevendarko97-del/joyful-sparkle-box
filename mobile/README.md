# Quick Tutor Ghana — Flutter Mobile App 🇬🇭📱

Official cross-platform mobile application for **Quick Tutor**, built for Ghanaian students and certified tutors preparing for **BECE, WASSCE, NOV/DEC & Remedial** examinations.

---

## 🚀 Features

- **Tutor Discovery & Filtering**: Search by WAEC subject, exam category, region (all 16 Ghana regions), and ratings.
- **Paystack Mobile Money Checkout**: Escrow-protected payments with **MTN MoMo**, **Telecel Cash**, and **AT Money**.
- **Live 1-on-1 WebRTC Classroom**: Integrated video & audio sessions with real-time in-classroom chat and whiteboard support.
- **SMS Reminders**: Automated Ghanaian SMS alerts sent prior to scheduled lessons via Arkesel.
- **Tutor Ledger & Payouts**: 85% net tutor earnings tracking with instant Mobile Money withdrawal requests.

---

## 🛠️ Getting Started

### 1. Prerequisites
- [Flutter SDK (v3.0.0+)](https://flutter.dev/docs/get-started/install)
- [Android Studio](https://developer.android.com/studio) or VS Code with Flutter extension
- An Android device or Emulator (or iOS Simulator on macOS)

### 2. Install Dependencies
```bash
cd mobile
flutter pub get
```

### 3. Run the App Locally
Make sure the Quick Tutor backend server is running (`cd ../backend && npm run dev`).

**On Android Emulator:**
```bash
flutter run
```
*(Android Emulator automatically maps `http://10.0.2.2:4000` to your localhost backend).*

**On Physical Android Device:**
Make sure your phone is connected via USB debugging and on the same Wi-Fi network, or point `ApiConstants.baseUrl` to your machine's LAN IP.

### 4. Build Release APK
To compile the standalone production Android APK for distribution or direct download:
```bash
flutter build apk --release
```
The compiled APK will be located at:
`mobile/build/app/outputs/flutter-apk/app-release.apk`

---

## 📂 Architecture

```
mobile/lib/
├── core/
│   ├── constants/api_constants.dart
│   ├── storage/token_storage.dart
│   ├── theme/app_theme.dart
│   └── utils/currency_formatter.dart
├── models/
│   ├── booking_model.dart
│   ├── message_model.dart
│   ├── notification_model.dart
│   ├── tutor_model.dart
│   └── user_model.dart
├── services/
│   ├── api_service.dart
│   ├── auth_service.dart
│   ├── booking_service.dart
│   ├── payment_service.dart
│   ├── socket_service.dart
│   └── tutor_service.dart
├── screens/
│   ├── auth/ (LoginScreen, RegisterScreen)
│   ├── home/ (HomeScreen)
│   ├── tutors/ (TutorListScreen, TutorDetailScreen)
│   ├── bookings/ (BookingFlowScreen, BookingsListScreen)
│   ├── classroom/ (LiveClassroomScreen)
│   ├── messages/ (MessagesScreen)
│   ├── tutor/ (TutorDashboardScreen)
│   ├── profile/ (ProfileScreen)
│   └── splash_screen.dart
└── main.dart
```
