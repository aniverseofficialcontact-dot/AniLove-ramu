package com.anilove.app;

import android.Manifest;
import android.content.Context;
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
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static MainActivity instance;
    public static boolean pendingBackToDetails = false;
    public static boolean isWebReady = false;
    private final Handler splashHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        instance = this;
        
        // Keep the native splash screen visible until the web code signals it's ready
        splashScreen.setKeepOnScreenCondition(() -> !isWebReady);
        
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

        // AndroidX OnBackPressedDispatcher for predictive back gestures and 3-button navigation back
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                        "(function() { return typeof window.handleHardwareBackPress === 'function' ? Boolean(window.handleHardwareBackPress()) : false; })()",
                        value -> {
                            boolean handled = "true".equals(value);
                            if (!handled) {
                                runOnUiThread(() -> moveTaskToBack(true));
                            }
                        }
                    );
                } else {
                    moveTaskToBack(true);
                }
            }
        });

        // 100% Sure Fix: Clear all WebView cache on every launch to prevent old versions from showing
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().clearCache(true);
        }

        // High-frequency polling to dismiss native logo the moment the homepage is actually loaded in background
        startWebReadyPolling();
    }

    private void startWebReadyPolling() {
        // Safety Timeout: Force dismiss after 500 milliseconds to ensure instant feel
        splashHandler.postDelayed(() -> {
            if (!isWebReady) {
                Log.w("MainActivity", "WebReady timeout. Transitioning to home screen.");
                isWebReady = true;
            }
        }, 500);

        // Polling loop: Check WebView every 100ms for the ready flag from React
        Runnable pollTask = new Runnable() {
            @Override
            public void run() {
                if (isWebReady) return;

                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript("window.isWebReady", value -> {
                        if ("true".equals(value)) {
                            Log.i("MainActivity", "Web signaled READY. Revealing homepage.");
                            isWebReady = true;
                        } else {
                            // Ultra-aggressive polling (50ms) for an instant feel
                            splashHandler.postDelayed(this, 50);
                        }
                    });
                } else {
                    splashHandler.postDelayed(this, 50);
                }
            }
        };
        splashHandler.post(pollTask);
    }

    private void hideSystemBars() {
        try {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
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
                webView.setFocusable(true);
                webView.setFocusableInTouchMode(true);
                webView.requestFocus();
                webView.requestFocusFromTouch();
                webView.addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void show() {
                        runOnUiThread(() -> {
                            try {
                                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                                if (wv != null) {
                                    wv.requestFocus();
                                    wv.requestFocusFromTouch();
                                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                                    if (imm != null) {
                                        imm.restartInput(wv);
                                        imm.showSoftInput(wv, InputMethodManager.SHOW_FORCED);
                                        imm.toggleSoftInput(InputMethodManager.SHOW_FORCED, InputMethodManager.HIDE_IMPLICIT_ONLY);
                                    }
                                }
                            } catch (Exception ignored) {}
                        });
                    }

                    @JavascriptInterface
                    public void hide() {
                        runOnUiThread(() -> {
                            try {
                                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                                if (wv != null) {
                                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                                    if (imm != null) {
                                        imm.hideSoftInputFromWindow(wv.getWindowToken(), 0);
                                    }
                                }
                            } catch (Exception ignored) {}
                        });
                    }
                }, "AndroidKeyboard");
                WebSettings settings = webView.getSettings();
                settings.setSupportMultipleWindows(false);
                settings.setJavaScriptCanOpenWindowsAutomatically(false);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                // Allow autoplaying videos without user interaction
                settings.setMediaPlaybackRequiresUserGesture(false);
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
                        // Use bridge to inject token into WebView
                        if (getBridge() != null && getBridge().getWebView() != null) {
                            String js = "window.dispatchEvent(new CustomEvent('nativeAniListToken', { detail: '" + token + "' }));";
                            getBridge().getWebView().evaluateJavascript(js, null);
                            Log.i("MainActivity", "Injected AniList token into web context successfully!");
                        }
                    }
                }
            } catch (Exception e) {
                Log.e("MainActivity", "Error splitting token from intent URL", e);
            }
        }
    }

    public void dispatchBackToDetails() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            String js = "if (window.closeNativePlayerAndOpenDetails) { " +
                        "  window.closeNativePlayerAndOpenDetails(); " +
                        "} else { " +
                        "  window.dispatchEvent(new CustomEvent('nativePlayerBackButtonPressed')); " +
                        "}";
            getBridge().getWebView().evaluateJavascript(js, null);
        }
    }
}
