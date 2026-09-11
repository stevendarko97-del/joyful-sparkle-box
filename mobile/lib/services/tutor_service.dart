import 'package:flutter/foundation.dart';
import '../core/constants/api_constants.dart';
import '../models/tutor_model.dart';
import 'api_service.dart';

class TutorService extends ChangeNotifier {
  List<TutorModel> _tutors = [];
  List<SubjectModel> _subjects = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<TutorModel> get tutors => _tutors;
  List<SubjectModel> get subjects => _subjects;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchTutors({
    String? search,
    String? subjectId,
    String? examType,
    String? region,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final queryParams = <String, String>{};
      if (search != null && search.isNotEmpty) queryParams['search'] = search;
      if (subjectId != null && subjectId.isNotEmpty) queryParams['subject_id'] = subjectId;
      if (examType != null && examType.isNotEmpty) queryParams['exam_type'] = examType;
      if (region != null && region.isNotEmpty) queryParams['region'] = region;

      final queryString = queryParams.isNotEmpty 
          ? '?${Uri(queryParameters: queryParams).query}' 
          : '';

      final res = await ApiService.get('${ApiConstants.teachers}$queryString');
      final List list = res['teachers'] ?? res['data'] ?? (res is List ? res : []);
      
      _tutors = list.map((item) => TutorModel.fromJson(item)).toList();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchSubjects() async {
    try {
      final res = await ApiService.get(ApiConstants.subjects);
      final List list = res['subjects'] ?? res['data'] ?? (res is List ? res : []);
      _subjects = list.map((item) => SubjectModel.fromJson(item)).toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<TutorModel?> getTutorById(String id) async {
    try {
      final res = await ApiService.get(ApiConstants.teacherDetail(id));
      final data = res['teacher'] ?? res['data'] ?? res;
      return TutorModel.fromJson(data);
    } catch (e) {
      return null;
    }
  }

  Future<List<TutorReview>> getTutorReviews(String id) async {
    try {
      final res = await ApiService.get(ApiConstants.teacherReviews(id));
      final List list = res['reviews'] ?? (res is List ? res : []);
      return list.map((item) => TutorReview.fromJson(item)).toList();
    } catch (_) {
      return [];
    }
  }
}
