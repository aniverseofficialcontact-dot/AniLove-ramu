package com.anilove.app;

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
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // UI tweaks after activity is created
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemBars();
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
