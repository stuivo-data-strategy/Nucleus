import 'package:flutter/material.dart';
import '../shared/models/user.dart';
import 'api_client.dart';
import 'constants.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient apiClient;
  NucleusUser? _currentUser;
  List<NucleusUser> _availableUsers = [];
  int _pendingApprovals = 0;
  bool _isLoading = true;

  AuthProvider({required this.apiClient}) {
    _init();
  }

  NucleusUser? get currentUser => _currentUser;
  List<NucleusUser> get availableUsers => _availableUsers;
  int get pendingApprovals => _pendingApprovals;
  bool get isLoading => _isLoading;

  Future<void> _init() async {
    try {
      // Fetch available switch options from API
      final response = await apiClient.get('/auth/switch-options');
      final users = response['data'] as List<dynamic>? ?? [];
      _availableUsers = users.map((u) {
        final map = Map<String, dynamic>.from(u);
        // Find matching demo persona for avatar color and role
        final persona = DemoPersonas.all.firstWhere(
          (p) => p['id'] == map['id'],
          orElse: () => {'color': '0xFF1B2A4A'},
        );
        map['avatarColor'] = int.parse(persona['color'] ?? '0xFF1B2A4A');
        // API switch-options doesn't return roles — merge from persona constants
        if (map['roles'] == null && persona['role'] != null) {
          map['roles'] = [persona['role']];
        }
        return NucleusUser.fromJson(map);
      }).toList();

      // Default to Sarah Chen
      await switchUser(DemoPersonas.all.first['id']!);
    } catch (e) {
      // Fallback: build users from constants if API unreachable
      _availableUsers = DemoPersonas.all.map((p) {
        return NucleusUser(
          id: p['id']!,
          firstName: p['firstName']!,
          lastName: p['lastName']!,
          email: '',
          jobTitle: p['jobTitle']!,
          roles: [p['role']!],
          initials: p['initials']!,
          avatarColor: int.parse(p['color']!),
        );
      }).toList();
      _currentUser = _availableUsers.first;
      apiClient.setCurrentUser(_currentUser!.id);
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> switchUser(String personId) async {
    try {
      // Call bypass auth to set server-side session
      await apiClient.post('/auth/bypass', body: {
        'person_id': personId,
      });

      // Use the already-loaded user from _availableUsers (populated from switch-options)
      final knownUser = _availableUsers.cast<NucleusUser?>().firstWhere(
        (u) => u?.id == personId,
        orElse: () => null,
      );

      if (knownUser != null) {
        _currentUser = knownUser;
      } else {
        // Fallback: build from demo persona constants
        final persona = DemoPersonas.all.firstWhere(
          (p) => p['id'] == personId,
          orElse: () => DemoPersonas.all.first,
        );
        _currentUser = NucleusUser(
          id: persona['id']!,
          firstName: persona['firstName']!,
          lastName: persona['lastName']!,
          email: '',
          jobTitle: persona['jobTitle']!,
          roles: [persona['role']!],
          initials: persona['initials']!,
          avatarColor: int.parse(persona['color']!),
        );
      }

      apiClient.setCurrentUser(personId);
      _isLoading = false;
      notifyListeners();

      // Fetch pending approvals count
      await refreshPendingApprovals();
    } catch (e) {
      // Fallback: use local persona data
      final persona = DemoPersonas.all.firstWhere(
        (p) => p['id'] == personId,
        orElse: () => DemoPersonas.all.first,
      );
      _currentUser = NucleusUser(
        id: persona['id']!,
        firstName: persona['firstName']!,
        lastName: persona['lastName']!,
        email: '',
        jobTitle: persona['jobTitle']!,
        roles: [persona['role']!],
        initials: persona['initials']!,
        avatarColor: int.parse(persona['color']!),
      );
      apiClient.setCurrentUser(personId);
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshPendingApprovals() async {
    try {
      final response =
          await apiClient.get('/expenses', queryParams: {'role': 'approver'});
      final claims = response['data']?['claims'] as List<dynamic>? ?? [];
      _pendingApprovals = claims.length;
      notifyListeners();
    } catch (e) {
      _pendingApprovals = 0;
      notifyListeners();
    }
  }
}
