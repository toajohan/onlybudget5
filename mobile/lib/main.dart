import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'services/api_client.dart';
import 'services/data_service.dart';
import 'services/push_service.dart';
import 'theme.dart';

/// The real site, shown as-is — identical design, every page, no separate mobile UI to drift out of sync or break.
const String siteUrl = 'https://onlybudget-app.vercel.app';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  await PushService.instance.init();
  runApp(const OnlyBudgetApp());
}

class OnlyBudgetApp extends StatelessWidget {
  const OnlyBudgetApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OnlyBudget',
      debugShowCheckedModeBanner: false,
      theme: appTheme,
      darkTheme: appTheme,
      themeMode: ThemeMode.dark,
      home: const WebShell(),
    );
  }
}

class WebShell extends StatefulWidget {
  const WebShell({super.key});
  @override
  State<WebShell> createState() => _WebShellState();
}

// Hides the page's own scrollbar (the thin bar Chrome/WebView draws over scrollable content) without touching
// the site's CSS — injected fresh on every page since client-side navigations don't reset injected styles reliably.
const String _hideScrollbarCss = '''
(function() {
  var id = "ob-hide-scrollbar";
  if (document.getElementById(id)) return;
  var style = document.createElement("style");
  style.id = id;
  style.textContent = "::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}"
    + "html,body{scrollbar-width:none!important;-ms-overflow-style:none!important}";
  document.head.appendChild(style);
})();
''';

class _WebShellState extends State<WebShell> with WidgetsBindingObserver {
  late final WebViewController _controller;
  bool _loading = true;
  bool _firstLoadDone = false;
  String? _error;
  Timer? _loadTimeout;
  bool _testingPush = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(AppColors.background)
      ..setNavigationDelegate(
        NavigationDelegate(
          // Explicit, rather than relying on the default: every navigation (including the site's own client-side
          // page-to-page links) is allowed to proceed inside this WebView.
          onNavigationRequest: (request) => NavigationDecision.navigate,
          // Only the very first load gets the full-screen spinner: later full-page loads keep the current page
          // visible while the next one arrives, like a normal browser, instead of hiding it behind a black screen.
          onPageStarted: (_) {
            if (_firstLoadDone) return;
            setState(() {
              _error = null;
              _loading = true;
            });
            _armLoadTimeout();
          },
          onPageFinished: (_) {
            _loadTimeout?.cancel();
            setState(() {
              _loading = false;
              _firstLoadDone = true;
            });
            _controller.runJavaScript(_hideScrollbarCss);
            PushService.instance.refresh();
          },
          onWebResourceError: (error) {
            // Only the main frame failing (not a sub-resource, e.g. an ad/font blocked) is worth a retry screen.
            if (error.isForMainFrame ?? true) {
              _loadTimeout?.cancel();
              setState(() {
                _loading = false;
                _error = _messageFor(error);
              });
            }
          },
        ),
      )
      ..loadRequest(Uri.parse(siteUrl));
    PushService.instance.startForegroundPolling();
  }

  /// The site itself is a client-side-routed app (Next.js): switching pages after the first load does NOT always
  /// re-fire onPageStarted/onPageFinished, so a genuinely stuck load (bad connection, DNS failure, timeout) must
  /// not be allowed to spin forever — if nothing finishes within 20 s, show the retry screen instead.
  void _armLoadTimeout() {
    _loadTimeout?.cancel();
    _loadTimeout = Timer(const Duration(seconds: 20), () {
      if (!mounted || !_loading) return;
      setState(() {
        _loading = false;
        _error = "La connexion est trop lente ou indisponible. Vérifiez votre réseau.";
      });
    });
  }

  String _messageFor(WebResourceError error) {
    // errorType is Android-specific (unavailable on iOS/other platforms); fall back to a generic message there.
    final type = error.errorType;
    if (type == WebResourceErrorType.hostLookup || type == WebResourceErrorType.connect || type == WebResourceErrorType.timeout) {
      return "Pas de connexion internet. Vérifiez votre réseau puis réessayez.";
    }
    return "Impossible de charger OnlyBudget. Vérifiez votre connexion.";
  }

  @override
  void dispose() {
    _loadTimeout?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    PushService.instance.stopForegroundPolling();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      PushService.instance.startForegroundPolling();
      _reloadIfPageLost();
    } else if (state == AppLifecycleState.paused) {
      PushService.instance.stopForegroundPolling();
    }
  }

  /// Android may discard the page while the app sits in the background; coming back to an empty or unresponsive
  /// page reloads it instead of leaving a black screen.
  Future<void> _reloadIfPageLost() async {
    if (_error != null || !_firstLoadDone) return;
    try {
      final count = await _controller
          .runJavaScriptReturningResult('document.body ? document.body.childElementCount : 0')
          .timeout(const Duration(seconds: 3));
      if (count.toString() == '0') _controller.reload();
    } catch (_) {
      _controller.reload();
    }
  }

  void _reload() {
    setState(() {
      _loading = true;
      _error = null;
    });
    _controller.reload();
  }

  /// Bypasses the site's own "Activer les notifications" UI entirely (it tracks browser-native Push API support,
  /// which an embedded WebView may not reliably expose) and tests this phone's native FCM registration directly.
  Future<void> _sendTestPush() async {
    setState(() => _testingPush = true);
    String message = "Test envoyé — vous devriez recevoir une notification avec le son dans quelques secondes.";
    bool isError = false;
    try {
      await PushService.instance.registerDevice();
      final sent = await DataService.instance.sendTestPush();
      if (sent == 0) {
        isError = true;
        message = "Aucun appareil enregistré pour les notifications. Fermez et rouvrez l'application, puis réessayez.";
      }
    } on ApiException catch (e) {
      isError = true;
      message = e.statusCode == 401 || e.statusCode == 307
          ? "Connectez-vous d'abord dans l'application, puis réessayez."
          : e.message;
    } catch (_) {
      isError = true;
      message = "Échec de l'envoi du test — vérifiez votre connexion.";
    }
    if (!mounted) return;
    setState(() => _testingPush = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? const Color(0xFFFF8A5B) : const Color(0xFF1C1C1C),
      ),
    );
  }

  /// Real Hybrid Composition (the native WebView placed directly on screen) rather than the plugin's default
  /// texture mode, which on some phones leaves the page black after returning to the app or stops repainting it
  /// after a page change.
  Widget _webView() {
    final platform = _controller.platform;
    if (platform is AndroidWebViewController) {
      return WebViewWidget.fromPlatformCreationParams(
        params: AndroidWebViewWidgetCreationParams(controller: platform, displayWithHybridComposition: true),
      );
    }
    return WebViewWidget(controller: _controller);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (await _controller.canGoBack()) {
          _controller.goBack();
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: SafeArea(
          child: Stack(
            children: [
              _webView(),
              if (_loading) const Center(child: CircularProgressIndicator(color: AppColors.foreground)),
              // Small, deliberately out-of-the-way diagnostic control — not part of the site itself. Tests this
              // phone's real notification (push + cash sound) directly, without depending on the site's own
              // "Activer les notifications" button (which may not detect push support correctly inside a WebView).
              // Bottom-right, just above the site's floating tab bar: the top-right corner holds the site's own
              // bell and menu buttons.
              Positioned(
                bottom: 96,
                right: 8,
                child: Material(
                  color: Colors.black.withValues(alpha: 0.35),
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: _testingPush ? null : _sendTestPush,
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: _testingPush
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white70),
                            )
                          : const Icon(Icons.notifications_active_outlined, size: 18, color: Colors.white70),
                    ),
                  ),
                ),
              ),
              if (_error != null)
                Container(
                  color: AppColors.background,
                  alignment: Alignment.center,
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.wifi_off_rounded, color: AppColors.muted, size: 32),
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: AppColors.muted), textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      OutlinedButton(onPressed: _reload, child: const Text('Réessayer')),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
