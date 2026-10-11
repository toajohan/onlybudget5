import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:workmanager/workmanager.dart';
import '../models.dart';
import 'api_client.dart';
import 'data_service.dart';

const String _channelId = 'onlybudget_activity';
const String _backgroundTask = 'onlybudget_check_notifications';

final _plugin = FlutterLocalNotificationsPlugin();

Future<void> _ensureChannel() async {
  const channel = AndroidNotificationChannel(
    _channelId,
    'Activité OnlyBudget',
    description: 'Nouvelles ventes, dépenses et modifications de l\'agence.',
    importance: Importance.max,
    sound: RawResourceAndroidNotificationSound('cash_register'),
    playSound: true,
  );
  await _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(channel);
}

Future<void> _showNotification(AppNotification n) async {
  await _plugin.show(
    n.id.hashCode,
    n.title,
    n.body,
    const NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        'Activité OnlyBudget',
        channelDescription: 'Nouvelles ventes, dépenses et modifications de l\'agence.',
        importance: Importance.max,
        priority: Priority.high,
        sound: RawResourceAndroidNotificationSound('cash_register'),
        playSound: true,
        category: AndroidNotificationCategory.message,
      ),
    ),
  );
}

/// Fetches unread notifications, shows a real Android notification (cash-register sound) for each one, then marks
/// them read — that "read" flag (shared with the web app) IS the dedupe: whatever woke this check (a 30 s
/// foreground poll, an FCM push, or the ~15 min background task), the same item is never shown twice.
Future<void> _checkAndNotify() async {
  if (!await ApiClient.instance.hasSession()) return;
  final items = (await DataService.instance.notifications()).items;
  final unread = items.where((n) => !n.read).toList()..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  if (unread.isEmpty) return;
  for (final n in unread) {
    await _showNotification(n);
  }
  await DataService.instance.markNotificationsRead(ids: unread.map((n) => n.id).toList());
}

/// WorkManager's own isolate entry point (~15 min minimum interval on Android) — a redundant safety net under FCM,
/// for the rare case a push is dropped (Doze mode, a flaky connection, a token not refreshed yet).
@pragma('vm:entry-point')
void backgroundDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    try {
      await _ensureChannel();
      await _checkAndNotify();
    } catch (e) {
      if (kDebugMode) print('background notification check failed: $e');
    }
    return true;
  });
}

/// FCM background/terminated handler: a top-level function Firebase calls in its own isolate when a data message
/// arrives and the app isn't running. The message content itself is ignored — it's only a "check now" wake-up;
/// what gets shown always comes fresh from /api/notifications, so it can never go stale or mismatch the server.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    if (Firebase.apps.isEmpty) await Firebase.initializeApp();
    await _ensureChannel();
    await _checkAndNotify();
  } catch (e) {
    if (kDebugMode) print('FCM background handler failed: $e');
  }
}

class PushService {
  PushService._();
  static final PushService instance = PushService._();

  Timer? _foregroundTimer;
  StreamSubscription<String>? _onTokenRefreshSub;
  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    await _plugin.initialize(const InitializationSettings(android: androidInit));
    await _ensureChannel();

    if (await Permission.notification.isDenied) {
      await Permission.notification.request();
    }

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    // Fire-and-forget: PushService is a permanent singleton (lives as long as the app does), so these never need cancelling.
    FirebaseMessaging.onMessage.listen((_) => _checkAndNotify());
    FirebaseMessaging.onMessageOpenedApp.listen((_) => _checkAndNotify());

    try {
      await Workmanager().initialize(backgroundDispatcher);
      await Workmanager().registerPeriodicTask(
        _backgroundTask,
        _backgroundTask,
        frequency: const Duration(minutes: 15),
        constraints: Constraints(networkType: NetworkType.connected),
        existingWorkPolicy: ExistingWorkPolicy.keep,
      );
    } catch (e) {
      if (kDebugMode) print('WorkManager setup skipped: $e');
    }
  }

  /// Call right after a successful login: registers this device's FCM token with the backend (so FCM pushes can
  /// reach it) and keeps it updated if Firebase rotates the token later.
  Future<void> registerDevice() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await DataService.instance.registerFcmToken(token);
    } catch (e) {
      if (kDebugMode) print('FCM token registration failed: $e');
    }
    _onTokenRefreshSub?.cancel();
    _onTokenRefreshSub = FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      DataService.instance.registerFcmToken(token).catchError((_) {});
    });
  }

  /// Call on logout: best-effort, so a signed-out device stops receiving this user's pushes.
  Future<void> unregisterDevice() async {
    _onTokenRefreshSub?.cancel();
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await DataService.instance.unregisterFcmToken(token);
    } catch (_) {
      // Best-effort only — the token will simply expire/rotate server-side if this fails.
    }
  }

  /// Call when the app becomes visible: starts 30 s polling, matching the web app's own in-app polling cadence
  /// (and catching anything FCM might have missed).
  void startForegroundPolling() {
    _foregroundTimer?.cancel();
    _checkAndNotify();
    _foregroundTimer = Timer.periodic(const Duration(seconds: 30), (_) => _checkAndNotify());
  }

  void stopForegroundPolling() {
    _foregroundTimer?.cancel();
    _foregroundTimer = null;
  }

  /// "Envoyer un test" button: fires the exact same real notification + sound as a genuine new activity item.
  Future<void> sendTestNotification() async {
    await _showNotification(AppNotification(
      id: 'test-${DateTime.now().millisecondsSinceEpoch}',
      kind: 'test',
      title: 'Test OnlyBudget',
      body: 'Ceci est un test : vous recevrez cette notification (avec le son) pour chaque nouvelle vente.',
      createdAt: DateTime.now(),
      read: false,
    ));
  }
}
