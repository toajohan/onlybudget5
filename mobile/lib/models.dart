/// Data models mirroring the Prisma schema / API JSON shapes (lib/currency.ts, lib/history.ts on the backend).
library;

enum Role { associe, chatteur }

Role roleFromJson(String s) => s == 'ASSOCIE' ? Role.associe : Role.chatteur;

class AppUser {
  final String id;
  final String name;
  final String email;
  final Role role;
  final String? avatarUrl;
  final double? profitSharePercent;
  final bool active;

  AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.avatarUrl,
    this.profitSharePercent,
    this.active = true,
  });

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: j['id'],
        name: j['name'],
        email: j['email'] ?? '',
        role: roleFromJson(j['role']),
        avatarUrl: j['avatarUrl'],
        profitSharePercent: (j['profitSharePercent'] as num?)?.toDouble(),
        active: j['active'] ?? true,
      );
}

class Currency {
  final String code;
  final String symbol;
  final String name;
  final double rateToBase;
  final bool isBase;

  Currency({required this.code, required this.symbol, required this.name, required this.rateToBase, required this.isBase});

  factory Currency.fromJson(Map<String, dynamic> j) => Currency(
        code: j['code'],
        symbol: j['symbol'] ?? '',
        name: j['name'] ?? j['code'],
        rateToBase: (j['rateToBase'] as num).toDouble(),
        isBase: j['isBase'] ?? false,
      );
}

class Wallet {
  final String id;
  final String name;
  final String? icon;
  final String? logoUrl;
  final String currencyCode;
  final bool isSource;
  final bool archived;
  final double commissionPercent;
  final int balanceMinor; // 0 for the reduced (chatteur) shape, where balance isn't exposed

  Wallet({
    required this.id,
    required this.name,
    this.icon,
    this.logoUrl,
    required this.currencyCode,
    required this.isSource,
    this.archived = false,
    this.commissionPercent = 0,
    this.balanceMinor = 0,
  });

  factory Wallet.fromJson(Map<String, dynamic> j) => Wallet(
        id: j['id'],
        name: (j['name'] as String).trim(),
        icon: j['icon'],
        logoUrl: j['logoUrl'],
        currencyCode: j['currencyCode'],
        isSource: j['isSource'] ?? false,
        archived: j['archived'] ?? false,
        commissionPercent: (j['commissionPercent'] as num?)?.toDouble() ?? 0,
        balanceMinor: (j['balanceMinor'] as num?)?.toInt() ?? 0,
      );
}

class ExpenseCategory {
  final String id;
  final String name;
  final String? icon;

  ExpenseCategory({required this.id, required this.name, this.icon});

  factory ExpenseCategory.fromJson(Map<String, dynamic> j) => ExpenseCategory(id: j['id'], name: j['name'], icon: j['icon']);
}

class Gain {
  final String id;
  final DateTime date;
  final int amountMinor;
  final int? grossAmountMinor;
  final double? commissionPercent;
  final String currencyCode;
  final String chatterId;
  final String chatterName;
  final String walletId;
  final String walletName;
  final String? walletIcon;
  final String? note;
  final String createdByName;

  Gain({
    required this.id,
    required this.date,
    required this.amountMinor,
    this.grossAmountMinor,
    this.commissionPercent,
    required this.currencyCode,
    required this.chatterId,
    required this.chatterName,
    required this.walletId,
    required this.walletName,
    this.walletIcon,
    this.note,
    required this.createdByName,
  });

  factory Gain.fromJson(Map<String, dynamic> j) => Gain(
        id: j['id'],
        date: DateTime.parse(j['date']),
        amountMinor: (j['amountMinor'] as num).toInt(),
        grossAmountMinor: (j['grossAmountMinor'] as num?)?.toInt(),
        commissionPercent: (j['commissionPercent'] as num?)?.toDouble(),
        currencyCode: j['currencyCode'],
        chatterId: j['chatterId'],
        chatterName: j['chatterName'],
        walletId: j['walletId'],
        walletName: (j['walletName'] as String).trim(),
        walletIcon: j['walletIcon'],
        note: j['note'],
        createdByName: j['createdByName'],
      );
}

class Expense {
  final String id;
  final DateTime date;
  final int amountMinor;
  final String currencyCode;
  final String categoryId;
  final String categoryName;
  final String? categoryIcon;
  final String walletId;
  final String walletName;
  final String? note;
  final String createdByName;

  Expense({
    required this.id,
    required this.date,
    required this.amountMinor,
    required this.currencyCode,
    required this.categoryId,
    required this.categoryName,
    this.categoryIcon,
    required this.walletId,
    required this.walletName,
    this.note,
    required this.createdByName,
  });

  factory Expense.fromJson(Map<String, dynamic> j) => Expense(
        id: j['id'],
        date: DateTime.parse(j['date']),
        amountMinor: (j['amountMinor'] as num).toInt(),
        currencyCode: j['currencyCode'],
        categoryId: j['categoryId'],
        categoryName: j['categoryName'],
        categoryIcon: j['categoryIcon'],
        walletId: j['walletId'],
        walletName: (j['walletName'] as String).trim(),
        note: j['note'],
        createdByName: j['createdByName'],
      );
}

class AppNotification {
  final String id;
  final String kind;
  final String title;
  final String body;
  final String? url;
  final DateTime createdAt;
  final bool read;

  AppNotification({
    required this.id,
    required this.kind,
    required this.title,
    required this.body,
    this.url,
    required this.createdAt,
    required this.read,
  });

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id: j['id'],
        kind: j['kind'],
        title: j['title'],
        body: j['body'],
        url: j['url'],
        createdAt: DateTime.parse(j['createdAt']),
        read: j['read'] ?? false,
      );
}

class ChartPoint {
  final String label;
  final double value;
  ChartPoint({required this.label, required this.value});
  factory ChartPoint.fromJson(Map<String, dynamic> j) => ChartPoint(label: j['label'], value: (j['value'] as num).toDouble());
}

class AssociateShare {
  final String id;
  final String name;
  final double? profitSharePercent;
  final double shareAmount;
  AssociateShare({required this.id, required this.name, this.profitSharePercent, required this.shareAmount});
  factory AssociateShare.fromJson(Map<String, dynamic> j) => AssociateShare(
        id: j['id'],
        name: j['name'],
        profitSharePercent: (j['profitSharePercent'] as num?)?.toDouble(),
        shareAmount: (j['shareAmount'] as num).toDouble(),
      );
}

class ChatterTotal {
  final String id;
  final String name;
  final String? avatarUrl;
  final double totalBaseMajor;
  ChatterTotal({required this.id, required this.name, this.avatarUrl, required this.totalBaseMajor});
  factory ChatterTotal.fromJson(Map<String, dynamic> j) => ChatterTotal(
        id: j['id'],
        name: j['name'],
        avatarUrl: j['avatarUrl'],
        totalBaseMajor: (j['totalBaseMajor'] as num).toDouble(),
      );
}

class ActivityItem {
  final String id;
  final DateTime date;
  final int amountMinor;
  final String currencyCode;
  final String title; // chatter/category name
  final String? subtitle; // wallet name
  final bool isExpense;

  ActivityItem({
    required this.id,
    required this.date,
    required this.amountMinor,
    required this.currencyCode,
    required this.title,
    this.subtitle,
    required this.isExpense,
  });

  factory ActivityItem.gain(Map<String, dynamic> j) => ActivityItem(
        id: j['id'],
        date: DateTime.parse(j['date']),
        amountMinor: (j['amountMinor'] as num).toInt(),
        currencyCode: j['currencyCode'],
        title: j['chatterName'],
        subtitle: j['walletName'],
        isExpense: false,
      );

  factory ActivityItem.expense(Map<String, dynamic> j) => ActivityItem(
        id: j['id'],
        date: DateTime.parse(j['date']),
        amountMinor: (j['amountMinor'] as num).toInt(),
        currencyCode: j['currencyCode'],
        title: j['categoryName'],
        subtitle: j['walletName'],
        isExpense: true,
      );
}

/// GET /api/dashboard — both role shapes merged into one (unused fields stay null for the other role).
class DashboardData {
  final Role role;
  final String baseCode;
  final List<Currency> currencies;
  final String periodLabel;
  final bool isMonth;

  // Chatteur
  final double? myTotal;

  // Associate
  final double? netProfit;
  final double? totalGains;
  final double? totalExpenses;
  final List<AssociateShare> shares;
  final double? totalPercent;
  final List<ChatterTotal> chatterTotals;

  final List<ActivityItem> periodGains;
  final List<ActivityItem> periodExpenses;
  final List<ChartPoint> dayData;
  final List<ChartPoint> monthData;

  DashboardData({
    required this.role,
    required this.baseCode,
    required this.currencies,
    required this.periodLabel,
    required this.isMonth,
    this.myTotal,
    this.netProfit,
    this.totalGains,
    this.totalExpenses,
    this.shares = const [],
    this.totalPercent,
    this.chatterTotals = const [],
    this.periodGains = const [],
    this.periodExpenses = const [],
    this.dayData = const [],
    this.monthData = const [],
  });

  factory DashboardData.fromJson(Map<String, dynamic> j) => DashboardData(
        role: roleFromJson(j['role']),
        baseCode: j['baseCode'],
        currencies: (j['currencies'] as List).map((e) => Currency.fromJson(e)).toList(),
        periodLabel: j['periodLabel'],
        isMonth: j['isMonth'] ?? false,
        myTotal: (j['myTotal'] as num?)?.toDouble(),
        netProfit: (j['netProfit'] as num?)?.toDouble(),
        totalGains: (j['totalGains'] as num?)?.toDouble(),
        totalExpenses: (j['totalExpenses'] as num?)?.toDouble(),
        shares: ((j['shares'] as List?) ?? []).map((e) => AssociateShare.fromJson(e)).toList(),
        totalPercent: (j['totalPercent'] as num?)?.toDouble(),
        chatterTotals: ((j['chatterTotals'] as List?) ?? []).map((e) => ChatterTotal.fromJson(e)).toList(),
        periodGains: ((j['periodGains'] as List?) ?? []).map((e) => ActivityItem.gain(e)).toList(),
        periodExpenses: ((j['periodExpenses'] as List?) ?? []).map((e) => ActivityItem.expense(e)).toList(),
        dayData: ((j['dayData'] as List?) ?? []).map((e) => ChartPoint.fromJson(e)).toList(),
        monthData: ((j['monthData'] as List?) ?? []).map((e) => ChartPoint.fromJson(e)).toList(),
      );
}
