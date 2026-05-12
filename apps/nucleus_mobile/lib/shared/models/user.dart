class NucleusUser {
  final String id;
  final String firstName;
  final String lastName;
  final String email;
  final String jobTitle;
  final List<String> roles;
  final String initials;
  final int avatarColor;

  NucleusUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.email,
    required this.jobTitle,
    required this.roles,
    required this.initials,
    required this.avatarColor,
  });

  String get fullName => '$firstName $lastName';

  bool get isFinanceApprover => roles.contains('finance_approver');
  bool get isAuditor =>
      roles.contains('expenses_auditor') || roles.contains('system_admin');
  bool get isVatOfficer =>
      roles.contains('vat_officer') ||
      roles.contains('finance_approver') ||
      roles.contains('system_admin');

  factory NucleusUser.fromJson(Map<String, dynamic> json) {
    // Support both {first_name, last_name} and {name: "First Last"} formats
    String firstName = json['first_name'] ?? json['firstName'] ?? '';
    String lastName = json['last_name'] ?? json['lastName'] ?? '';
    if (firstName.isEmpty && lastName.isEmpty && json['name'] != null) {
      final parts = (json['name'] as String).split(' ');
      firstName = parts.first;
      lastName = parts.length > 1 ? parts.sublist(1).join(' ') : '';
    }
    return NucleusUser(
      id: json['id'] ?? '',
      firstName: firstName,
      lastName: lastName,
      email: json['email'] ?? '',
      jobTitle: json['job_title'] ?? json['jobTitle'] ?? json['title'] ?? '',
      roles: List<String>.from(json['roles'] ?? []),
      initials: '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}',
      avatarColor: json['avatarColor'] ?? 0xFF1B2A4A,
    );
  }
}
