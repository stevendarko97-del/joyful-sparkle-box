import 'package:flutter/foundation.dart';
import '../core/constants/api_constants.dart';
import '../core/storage/token_storage.dart';
import '../models/user_model.dart';
import 'api_service.dart';

class AuthService extends ChangeNotifier {
  UserModel? _currentUser;
  bool _isLoading = false;
  String? _errorMessage;

  UserModel? get currentUser => _currentUser;
  bool get isAuthenticated => _currentUser != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  AuthService() {
    initAuth();
  }

  Future<void> initAuth() async {
    final token = await TokenStorage.getToken();
    if (token != null) {
      await fetchCurrentUser();
    }
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.post(ApiConstants.login, {
        'email': email.trim().toLowerCase(),
        'password': password,
      });

      final token = res['token'] ?? res['session']?['access_token'];
      final userData = res['user'] ?? res['profile'];

      if (token != null) {
        await TokenStorage.saveToken(token);
      }

      if (userData != null) {
        _currentUser = UserModel.fromJson(userData);
        await TokenStorage.saveUserInfo(
          id: _currentUser!.id,
          role: _currentUser!.role,
        );
      } else {
        await fetchCurrentUser();
      }

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String fullName,
    required String role, // 'student' | 'teacher'
    String? phone,
    String? location,
    String? examType,
    String? schoolName,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.post(ApiConstants.register, {
        'email': email.trim().toLowerCase(),
        'password': password,
        'fullName': fullName.trim(),
        'role': role,
        'phone': phone,
        'location': location,
        'examType': examType,
        'schoolName': schoolName,
      });

      final token = res['token'] ?? res['session']?['access_token'];
      final userData = res['user'] ?? res['profile'];

      if (token != null) {
        await TokenStorage.saveToken(token);
      }

      if (userData != null) {
        _currentUser = UserModel.fromJson(userData);
        await TokenStorage.saveUserInfo(
          id: _currentUser!.id,
          role: _currentUser!.role,
        );
      }

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> fetchCurrentUser() async {
    try {
      final res = await ApiService.get(ApiConstants.me);
      if (res['user'] != null || res['profile'] != null) {
        _currentUser = UserModel.fromJson(res['user'] ?? res['profile']);
        notifyListeners();
      }
    } catch (_) {
      // Token might be expired
      await logout();
    }
  }

  Future<void> logout() async {
    _currentUser = null;
    await TokenStorage.clear();
    notifyListeners();
  }
}
