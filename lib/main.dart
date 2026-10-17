import 'package:flutter/material.dart';
import 'app/app.dart';
import 'core/network/api_config.dart';
import 'core/storage/session_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiConfig.init();
  await SessionStorage.init();
  runApp(const App());
}
