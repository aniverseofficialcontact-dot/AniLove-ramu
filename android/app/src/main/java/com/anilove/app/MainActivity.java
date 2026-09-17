package com.anilove.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static MainActivity instance;
    public static boolean pendingBackToDetails = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        instance = this;
        registerPlugin(NativePlayerPlugin.class);
        registerPlugin(DownloadPlugin.class);
        
        super.onCreate(savedInstanceState);

        // Request notification permission for background downloads on Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // UI tweaks after activity is created
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemBars();

        // 100% Sure Fix: Clear all WebView cache on every launch to prevent old versions from showing
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().clearCache(true);
        }
    }

    private void hideSystemBars() {
        try {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            getWindow().getDecorView().post(() -> {
                try {
                    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                    if (controller != null) {
                        controller.hide(WindowInsetsCompat.Type.statusBars());
                        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    }
                } catch (Exception ignored) {}
            });
        } catch (Exception ignored) {}
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        instance = this;
        
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setSupportMultipleWindows(false);
                settings.setJavaScriptCanOpenWindowsAutomatically(false);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
            }
        } catch (Exception e) {
            Log.w("MainActivity", "WebSettings adjustment error: " + e.getMessage());
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        instance = this;
        
        hideSystemBars();

        if (pendingBackToDetails) {
            pendingBackToDetails = false;
            dispatchBackToDetails();
        }

        // Process any deep link token on activity resume (handles cold boots)
        if (getIntent() != null && getIntent().getData() != null) {
            handleDeepLinkIntent(getIntent());
            getIntent().setData(null); // Clear to ensure it only processes once
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        setIntent(intent);
        super.onNewIntent(intent);
        // Process deep link token on new intent (handles background resumes)
        handleDeepLinkIntent(intent);
    }

    private void handleDeepLinkIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        String url = data.toString();
        String fragment = data.getFragment();
        
        String tokenPayload = null;
        if (url != null && url.contains("access_token=")) {
            tokenPayload = url;
        } else if (fragment != null && fragment.contains("access_token=")) {
            tokenPayload = fragment;
        }

        if (tokenPayload != null) {
            try {
                String[] parts = tokenPayload.split("access_token=");
                if (parts.length > 1) {
                    final String token = parts[1].split("&")[0];
                    if (token != null && !token.isEmpty()) {
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            try {
                                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                                if (webView != null) {
                                    String js = "window.dispatchEvent(new CustomEvent('nativeAniListToken', { detail: '" + token + "' }));";
                                    webView.evaluateJavascript(js, null);
                                    Log.i("MainActivity", "Injected AniList token into web context successfully!");
                                }
                            } catch (Exception e) {
                                Log.e("MainActivity", "Error injecting token into webview", e);
                            }
                        }, 800); // stable buffer duration to let react listeners hydrate completely
                    }
                }
            } catch (Exception e) {
                Log.e("MainActivity", "Error splitting token from intent URL", e);
            }
        }
    }

    public void dispatchBackToDetails() {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    String js = "if (window.closeNativePlayerAndOpenDetails) { " +
                                "  window.closeNativePlayerAndOpenDetails(); " +
                                "} else { " +
                                "  window.dispatchEvent(new CustomEvent('nativePlayerBackButtonPressed')); " +
                                "}";
                    webView.evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                Log.e("MainActivity", "Error dispatching back to details", e);
            }
        }, 120);
    }
}
