package com.onlybudget.onlybudget_mobile

import android.webkit.CookieManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // The site's session cookie is HttpOnly, so `document.cookie` can't see it; the WebView's native cookie
        // store can.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "onlybudget/cookies").setMethodCallHandler { call, result ->
            when (call.method) {
                "get" -> result.success(CookieManager.getInstance().getCookie(call.argument<String>("url")))
                else -> result.notImplemented()
            }
        }
    }
}
