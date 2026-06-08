/// Authenticated student profile. Mirrors the `/api/auth/login` and
/// `/api/auth/me` payloads (and tolerates both snake_case and camelCase).
class UserModel {
  final String id; // MongoDB _id
  final String userId; // custom id, e.g. "11_00001_20" — used for most API calls
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
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      userId:
          (json['user_id'] ?? json['userId'] ?? json['_id'] ?? json['id'] ?? '')
              .toString(),
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? 'student',
      classLevel: (json['classLevel'] ?? json['class_level'] ?? '').toString(),
      subjects: List<String>.from(json['subjects'] ?? const []),
      // login returns is_onboarded; /me does not → default true for restored
      // sessions (a valid session implies the user was already onboarded).
      isOnboarded: json['is_onboarded'] ?? json['isOnboarded'] ?? true,
      avatarSeed: json['avatarSeed'] ?? json['avatar_seed'],
      avatarStyle: json['avatarStyle'] ?? json['avatar_style'],
      permissions: List<String>.from(json['permissions'] ?? const []),
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

  /// Numeric class level extracted from strings like "Class 10" or "10".
  int? get classLevelInt {
    final digits = classLevel.replaceAll(RegExp(r'[^0-9]'), '');
    return digits.isEmpty ? null : int.tryParse(digits);
  }

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name.isNotEmpty ? name[0].toUpperCase() : 'S';
  }

  UserModel copyWith({
    String? name,
    String? classLevel,
    List<String>? subjects,
    bool? isOnboarded,
    String? avatarSeed,
    String? avatarStyle,
  }) {
    return UserModel(
      id: id,
      userId: userId,
      name: name ?? this.name,
      email: email,
      role: role,
      classLevel: classLevel ?? this.classLevel,
      subjects: subjects ?? this.subjects,
      isOnboarded: isOnboarded ?? this.isOnboarded,
      avatarSeed: avatarSeed ?? this.avatarSeed,
      avatarStyle: avatarStyle ?? this.avatarStyle,
      permissions: permissions,
    );
  }
}
