import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'core/api_client.dart';
import 'core/auth_provider.dart';
import 'core/theme.dart';
import 'features/shell/app_shell.dart';

void main() {
  runApp(const NucleusApp());
}

class NucleusApp extends StatelessWidget {
  const NucleusApp({super.key});

  @override
  Widget build(BuildContext context) {
    final apiClient = ApiClient();
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        ChangeNotifierProvider<AuthProvider>(
          create: (_) => AuthProvider(apiClient: apiClient),
        ),
      ],
      child: MaterialApp(
        title: 'Nucleus',
        debugShowCheckedModeBanner: false,
        theme: NucleusTheme.light,
        home: const AppShell(),
      ),
    );
  }
}
