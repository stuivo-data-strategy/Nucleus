/// Demo personas available in the user switcher.
/// Must match the IDs returned by GET /auth/switch-options.
class DemoPersonas {
  static const List<Map<String, String>> all = [
    {
      'id': 'person:sarah_chen',
      'firstName': 'Sarah',
      'lastName': 'Chen',
      'jobTitle': 'Senior Developer',
      'role': 'employee',
      'initials': 'SC',
      'color': '0xFF4F46E5',
    },
    {
      'id': 'person:james_morton',
      'firstName': 'Stu',
      'lastName': 'Morris',
      'jobTitle': 'Head of Digital Delivery',
      'role': 'line_manager',
      'initials': 'SM',
      'color': '0xFF0891B2',
    },
    {
      'id': 'person:peter_blackwell',
      'firstName': 'Peter',
      'lastName': 'Passaro',
      'jobTitle': 'Global Director of AI and Data',
      'role': 'senior_manager',
      'initials': 'PP',
      'color': '0xFFD97706',
    },
    {
      'id': 'person:peter_diciacca',
      'firstName': 'Peter',
      'lastName': 'DiCiacca',
      'jobTitle': 'Global IT Director',
      'role': 'senior_manager',
      'initials': 'PD',
      'color': '0xFF059669',
    },
    {
      'id': 'person:amara_okafor',
      'firstName': 'Amara',
      'lastName': 'Okafor',
      'jobTitle': 'CFO',
      'role': 'finance_approver',
      'initials': 'AO',
      'color': '0xFF0D9488',
    },
    {
      'id': 'person:lisa_thornton',
      'firstName': 'Lisa',
      'lastName': 'Thornton',
      'jobTitle': 'Expenses Officer',
      'role': 'expenses_auditor',
      'initials': 'LT',
      'color': '0xFFDC2626',
    },
    {
      'id': 'person:daniel_frost',
      'firstName': 'Daniel',
      'lastName': 'Frost',
      'jobTitle': 'Management Accountant',
      'role': 'vat_officer',
      'initials': 'DF',
      'color': '0xFF7C3AED',
    },
  ];
}
