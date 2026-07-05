import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Selected bottom-nav tab in `HomeShell`: 0 tree, 1 contributions,
/// 2 notifications. Lifted to a provider so a notification tap (or push) can
/// switch tabs without a nested navigation stack.
final homeTabProvider = StateProvider<int>((ref) => 0);
