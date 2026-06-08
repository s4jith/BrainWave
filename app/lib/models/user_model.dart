class UserModel {
  final String id;      // MongoDB _id
  final String userId;  // custom ID, e.g. "11_00001_20" — used for API calls
  final String name;
  final String email;
  final String role;
  final String classLevel;
  final List<String> subjects;
  final bool isOnboarded;
  final String? avatarSeed;
  final String? avatarStyle;
  final List<String> permissions;

  const UserModel({
    required this.id,
    required this.userId,
    required this.name,
    required this.email,
    required this.role,
    required this.classLevel,
    required this.subjects,
    required this.isOnboarded,
    this.avatarSeed,
    this.avatarStyle,
    this.permissions = const [],
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['_id'] ?? json['id'] ?? '',
      userId: json['user_id'] ?? json['userId'] ?? json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'student',
      classLevel: (json['classLevel'] ?? json['class_level'] ?? '').toString(),
      subjects: List<String>.from(json['subjects'] ?? []),
      // login response returns is_onboarded; /me does not → default true for
      // restored sessions (user already had a valid session → was onboarded)
      isOnboarded: json['is_onboarded'] ?? json['isOnboarded'] ?? true,
      avatarSeed: json['avatarSeed'] ?? json['avatar_seed'],
      avatarStyle: json['avatarStyle'] ?? json['avatar_style'],
      permissions: List<String>.from(json['permissions'] ?? []),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'name': name,
    'email': email,
    'role': role,
    'classLevel': classLevel,
    'subjects': subjects,
    'is_onboarded': isOnboarded,
    'avatarSeed': avatarSeed,
    'avatarStyle': avatarStyle,
    'permissions': permissions,
  };

  String get initials {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name.isNotEmpty ? name[0].toUpperCase() : 'S';
  }
}

class AuthState {
  final UserModel? user;
  final String? token;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.user,
    this.token,
    this.isLoading = false,
    this.error,
  });

  bool get isAuthenticated => user != null && token != null;

  AuthState copyWith({
    UserModel? user,
    String? token,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      user: user ?? this.user,
      token: token ?? this.token,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}
