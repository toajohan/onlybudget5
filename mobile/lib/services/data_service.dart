import '../models.dart';
import 'api_client.dart';

/// Thin wrapper around the API's read/write endpoints — no local caching, screens just call these and refresh.
class DataService {
  DataService._();
  static final DataService instance = DataService._();
  final _api = ApiClient.instance;

  Future<List<Wallet>> wallets() async {
    final body = await _api.get('/api/wallets');
    return (body['wallets'] as List).map((e) => Wallet.fromJson(e)).toList();
  }

  Future<List<Currency>> currencies() async {
    final body = await _api.get('/api/currencies');
    return (body['currencies'] as List).map((e) => Currency.fromJson(e)).toList();
  }

  Future<List<AppUser>> members() async {
    final body = await _api.get('/api/users');
    return (body['users'] as List).map((e) => AppUser.fromJson(e)).toList();
  }

  Future<List<ExpenseCategory>> categories() async {
    final body = await _api.get('/api/expense-categories');
    return (body['categories'] as List).map((e) => ExpenseCategory.fromJson(e)).toList();
  }

  Future<DashboardData> dashboard({required String cur, bool month = false}) async {
    final body = await _api.get('/api/dashboard', query: {'cur': cur, 'mode': month ? 'month' : 'day'});
    return DashboardData.fromJson(body);
  }

  Future<List<Gain>> gains() async {
    final body = await _api.get('/api/gains');
    return (body['gains'] as List).map((e) => Gain.fromJson(e)).toList();
  }

  Future<void> createGain({
    required String chatterId,
    required String walletId,
    required double amountMajor,
    required String date,
    String? note,
  }) async {
    await _api.post('/api/gains', body: {
      'chatterId': chatterId,
      'walletId': walletId,
      'amountMajor': amountMajor,
      'date': date,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  Future<void> updateGain(
    String id, {
    required String chatterId,
    required String walletId,
    required double amountMajor,
    required String date,
    String? note,
  }) async {
    await _api.patch('/api/gains/$id', body: {
      'chatterId': chatterId,
      'walletId': walletId,
      'amountMajor': amountMajor,
      'date': date,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  Future<void> deleteGain(String id) async => _api.delete('/api/gains/$id');

  Future<List<Expense>> expenses() async {
    final body = await _api.get('/api/expenses');
    return (body['expenses'] as List).map((e) => Expense.fromJson(e)).toList();
  }

  Future<void> createExpense({
    required String categoryId,
    required String walletId,
    required double amountMajor,
    required String date,
    String? note,
  }) async {
    await _api.post('/api/expenses', body: {
      'categoryId': categoryId,
      'walletId': walletId,
      'amountMajor': amountMajor,
      'date': date,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  Future<void> updateExpense(
    String id, {
    required String categoryId,
    required String walletId,
    required double amountMajor,
    required String date,
    String? note,
  }) async {
    await _api.patch('/api/expenses/$id', body: {
      'categoryId': categoryId,
      'walletId': walletId,
      'amountMajor': amountMajor,
      'date': date,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  Future<void> deleteExpense(String id) async => _api.delete('/api/expenses/$id');

  Future<({List<AppNotification> items, int unreadCount})> notifications() async {
    final body = await _api.get('/api/notifications', query: {'limit': '30'});
    final items = (body['notifications'] as List).map((e) => AppNotification.fromJson(e)).toList();
    return (items: items, unreadCount: body['unreadCount'] as int);
  }

  Future<void> markNotificationsRead({List<String>? ids, bool all = false}) async {
    await _api.patch('/api/notifications', body: {if (all) 'all': true else 'ids': ids});
  }

  /// POST /api/push/test — fires a real system notification at every device this account has registered (web
  /// push and/or this phone's FCM token), independently of whatever the website's own push-enable UI thinks
  /// (that UI tracks browser-native Push API support, which an embedded WebView may not reliably expose).
  /// Returns how many devices (this phone and any browsers) the server sent the test to.
  Future<int> sendTestPush() async {
    final body = await _api.post('/api/push/test');
    return (body?['sent'] as num?)?.toInt() ?? 0;
  }

  Future<void> registerFcmToken(String token) async {
    await _api.post('/api/push/fcm-subscribe', body: {'token': token});
  }

  Future<void> unregisterFcmToken(String token) async {
    await _api.delete('/api/push/fcm-subscribe', body: {'token': token});
  }
}
