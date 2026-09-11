import 'package:flutter/foundation.dart';
import '../core/constants/api_constants.dart';
import 'api_service.dart';

class PaymentService extends ChangeNotifier {
  bool _isProcessing = false;
  String? _errorMessage;

  bool get isProcessing => _isProcessing;
  String? get errorMessage => _errorMessage;

  Future<Map<String, dynamic>?> initializePaystack({
    required String bookingId,
    required String email,
    required int amountCents,
    required String mobileMoneyProvider, // 'mtn' | 'vodafone' | 'airteltigo' | 'card'
    required String mobileMoneyPhone,
  }) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.post(ApiConstants.initializePayment, {
        'booking_id': bookingId,
        'email': email,
        'amount': amountCents,
        'currency': 'GHS',
        'provider': mobileMoneyProvider,
        'phone': mobileMoneyPhone,
        'callback_url': 'quicktutor://payment-callback',
      });

      _isProcessing = false;
      notifyListeners();
      return res;
    } catch (e) {
      _errorMessage = e.toString();
      _isProcessing = false;
      notifyListeners();
      return null;
    }
  }

  Future<bool> verifyPayment(String reference) async {
    _isProcessing = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await ApiService.get('${ApiConstants.verifyPayment}/$reference');
      _isProcessing = false;
      notifyListeners();
      return res['status'] == 'success' || res['verified'] == true;
    } catch (e) {
      _errorMessage = e.toString();
      _isProcessing = false;
      notifyListeners();
      return false;
    }
  }
}
