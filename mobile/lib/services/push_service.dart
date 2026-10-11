import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:workmanager/workmanager.dart';
import '../models.dart';
import 'api_client.dart';
import 'data_service.dart';

// Android fixes a channel's sound once created, so changing the sound means a new channel id; older ones are deleted.
const String _channelId = 'onlybudget_activity_v3';
const List<String> _legacyChannelIds = ['onlybudget_activity', 'onlybudget_activity_v2'];
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
  final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  for (final id in _legacyChannelIds) {
    await android?.deleteNotificationChannel(id);
  }
  await android?.createNotificationChannel(channel);
}

/// The platform's logo (e.g. OnlyChat) as the notification's picture. Best-effort: SVGs can't be decoded by
/// Android, and a slow or failed download just means the app icon is shown instead.
Future<AndroidBitmap<Object>?> _largeIcon(String? url) async {
  if (url == null || url.isEmpty || url.toLowerCase().endsWith('.svg')) return null;
  try {
    final res = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 6));
    final type = res.headers['content-type'] ?? '';
    if (res.statusCode != 200 || !type.startsWith('image/') || type.contains('svg')) return null;
    return ByteArrayAndroidBitmap(res.bodyBytes);
  } catch (_) {
    return null;
  }
}

Future<void> _showNotification(AppNotification n) async {
  await _plugin.show(
    n.id.hashCode,
    n.title,
    n.body,
    NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        'Activité OnlyBudget',
        channelDescription: 'Nouvelles ventes, dépenses et modifications de l\'agence.',
        importance: Importance.max,
        priority: Priority.high,
        sound: const RawResourceAndroidNotificationSound('cash_register'),
        playSound: true,
        category: AndroidNotificationCategory.message,
        largeIcon: await _largeIcon(n.imageUrl),
        styleInformation: BigTextStyleInformation(n.body),
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

/// A test push carries no activity item (nothing new in /api/notifications), so its own payload is shown as-is.
Future<void> _handleMessage(RemoteMessage message) async {
  if (message.data['tag'] == 'test') {
    await _showNotification(AppNotification(
      id: 'test-${DateTime.now().millisecondsSinceEpoch}',
      kind: 'test',
      title: message.data['title'] ?? 'OnlyBudget',
      body: message.data['body'] ?? '',
      imageUrl: message.data['imageUrl'],
      createdAt: DateTime.now(),
      read: false,
    ));
    return;
  }
  await _checkAndNotify();
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
    await _handleMessage(message);
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
  bool _registered = false;

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
    FirebaseMessaging.onMessage.listen(_handleMessage);
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
    if (_registered) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;
      await DataService.instance.registerFcmToken(token);
      _registered = true;
    } catch (e) {
      if (kDebugMode) print('FCM token registration failed: $e');
      return;
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
    refresh();
    _foregroundTimer = Timer.periodic(const Duration(seconds: 30), (_) => refresh());
  }

  /// Picks up a sign-in on the site (registering this phone for pushes) and shows anything new. Never throws.
  Future<void> refresh() async {
    try {
      if (!await ApiClient.instance.hasSession()) {
        _registered = false;
        return;
      }
      await registerDevice();
      await _checkAndNotify();
    } catch (e) {
      if (kDebugMode) print('notification refresh failed: $e');
    }
  }

  void stopForegroundPolling() {
    _foregroundTimer?.cancel();
    _foregroundTimer = null;
  }
}
