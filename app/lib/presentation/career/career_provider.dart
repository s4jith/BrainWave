import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/career_model.dart';
import '../../data/repositories/career_repository.dart';

/// Career aptitude questions.
final careerQuestionsProvider =
    FutureProvider.autoDispose<List<CareerQuestion>>((ref) {
  return ref.read(careerRepositoryProvider).getQuestions();
});

/// A specific career analysis result by id.
final careerResultProvider =
    FutureProvider.autoDispose.family<CareerResult, String>((ref, id) {
  return ref.read(careerRepositoryProvider).getResult(id);
});
