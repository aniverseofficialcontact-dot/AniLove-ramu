package com.anilove.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQ_CODE = 101;

    public static MainActivity instance;
    public static boolean pendingBackToDetails = false;
    public static boolean isWebReady = false;

    private String pendingDeepLinkToken = null;
    private final Handler splashHandler = new Handler(Looper.getMainLooper());
    private Runnable pollTask;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        instance = this;

        // Keep native splash screen visible until web code signals it's ready
        splashScreen.setKeepOnScreenCondition(() -> !isWebReady);

        registerPlugin(NativePlayerPlugin.class);
        registerPlugin(DownloadPlugin.class);

        super.onCreate(savedInstanceState);

        // Request notification permission for background downloads on Android 13+ (API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQ_CODE);
            }
        }

        // Configure UI & WebSettings
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemBars();
        configureWebViewSettings();

        // AndroidX OnBackPressedDispatcher for predictive back gestures and 3-button navigation back
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    webView.evaluateJavascript(
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

        startWebReadyPolling();
    }

    public class WebReadyBridge {
        @JavascriptInterface
        public void setWebReady() {
            splashHandler.post(() -> {
                if (!isWebReady) {
                    Log.i(TAG, "Web signaled READY via JS Bridge. Revealing web view.");
                    MainActivity.this.setWebReady(true);
                }
            });
        }
    }

    private void configureWebViewSettings() {
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setSupportMultipleWindows(false);
                settings.setJavaScriptCanOpenWindowsAutomatically(false);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                // Allow autoplaying videos without user gesture
                settings.setMediaPlaybackRequiresUserGesture(false);

                // Add Javascript Interface for instant web ready notification
                webView.addJavascriptInterface(new WebReadyBridge(), "NativeApp");
            }
        } catch (Exception e) {
            Log.w(TAG, "WebSettings adjustment error: " + e.getMessage());
        }
    }

    private void startWebReadyPolling() {
        // Safety Timeout: Force dismiss after 2500ms if web fails to signal ready
        splashHandler.postDelayed(() -> {
            if (!isWebReady) {
                Log.w(TAG, "WebReady safety timeout reached. Revealing web view.");
                setWebReady(true);
            }
        }, 2500);

        // Polling loop: Check WebView for ready flag from React
        pollTask = new Runnable() {
            @Override
            public void run() {
                if (isWebReady) return;

                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null && !isWebReady) {
                    webView.evaluateJavascript("window.isWebReady", value -> {
                        if ("true".equals(value)) {
                            Log.i(TAG, "Web signaled READY via polling. Revealing homepage.");
                            setWebReady(true);
                        } else if (!isWebReady) {
                            splashHandler.postDelayed(pollTask, 250);
                        }
                    });
                } else if (!isWebReady) {
                    splashHandler.postDelayed(pollTask, 250);
                }
            }
        };
        splashHandler.post(pollTask);
    }

    private void setWebReady(boolean ready) {
        isWebReady = ready;
        if (ready) {
            splashHandler.removeCallbacksAndMessages(null);
            if (pendingDeepLinkToken != null) {
                injectAniListToken(pendingDeepLinkToken);
                pendingDeepLinkToken = null;
            }
        }
    }

    private void hideSystemBars() {
        try {
            View decorView = getWindow().getDecorView();
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decorView);
            if (insets != null && insets.isVisible(WindowInsetsCompat.Type.ime())) {
                return;
            }

            decorView.post(() -> {
                try {
                    WindowInsetsCompat currentInsets = ViewCompat.getRootWindowInsets(decorView);
                    if (currentInsets != null && currentInsets.isVisible(WindowInsetsCompat.Type.ime())) {
                        return;
                    }
                    WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decorView);
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
            WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(getWindow().getDecorView());
            if (insets == null || !insets.isVisible(WindowInsetsCompat.Type.ime())) {
                hideSystemBars();
            }
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        instance = this;
        configureWebViewSettings();
    }

    public static void forcePortraitOrientation() {
        if (instance != null) {
            instance.runOnUiThread(() -> {
                try {
                    instance.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                } catch (Exception ignored) {}
            });
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        instance = this;
        forcePortraitOrientation();
        hideSystemBars();

        if (pendingBackToDetails) {
            pendingBackToDetails = false;
            dispatchBackToDetails();
        }

        // Process any deep link intent on activity resume
        if (getIntent() != null && getIntent().getData() != null) {
            handleDeepLinkIntent(getIntent());
            getIntent().setData(null); // Clear data so it is only processed once
        }
    }

    @Override
    public void onNewIntent(Intent intent) {
        setIntent(intent);
        super.onNewIntent(intent);
        // onResume() is called immediately following onNewIntent() by the Android framework.
        // It will handle processing the intent data centrally to prevent double-execution.
    }

    private void handleDeepLinkIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        String token = parseAccessToken(data);

        if (token != null && !token.isEmpty()) {
            if (isWebReady) {
                injectAniListToken(token);
            } else {
                // Queue token to inject once React is ready
                pendingDeepLinkToken = token;
            }
        }
    }

    private String parseAccessToken(Uri data) {
        if (data == null) return null;

        // 1. Standard Uri query parameter
        String token = data.getQueryParameter("access_token");
        if (token != null && !token.isEmpty()) return token;

        // 2. URI fragment hash (#access_token=...)
        String fragment = data.getFragment();
        if (fragment != null && fragment.contains("access_token=")) {
            String[] parts = fragment.split("access_token=");
            if (parts.length > 1) {
                return parts[1].split("&")[0];
            }
        }

        // 3. Raw URL string parsing fallback
        String url = data.toString();
        if (url.contains("access_token=")) {
            String[] parts = url.split("access_token=");
            if (parts.length > 1) {
                return parts[1].split("&")[0];
            }
        }

        return null;
    }

    private void injectAniListToken(String token) {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            try {
                // Secure JSON serialization prevents JavaScript Injection vulnerabilities
                String safeTokenJson = JSONObject.quote(token);
                String js = "window.dispatchEvent(new CustomEvent('nativeAniListToken', { detail: " + safeTokenJson + " }));";
                webView.evaluateJavascript(js, null);
                Log.i(TAG, "Injected AniList token into web context securely.");
            } catch (Exception e) {
                Log.e(TAG, "Failed to inject AniList token", e);
            }
        }
    }

    public void dispatchBackToDetails() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            String js = "if (window.closeNativePlayerAndOpenDetails) { " +
                        "  window.closeNativePlayerAndOpenDetails(); " +
                        "} else { " +
                        "  window.dispatchEvent(new CustomEvent('nativePlayerBackButtonPressed')); " +
                        "}";
            webView.evaluateJavascript(js, null);
        }
    }

    @Override
    public void onDestroy() {
        splashHandler.removeCallbacksAndMessages(null);
        if (instance == this) {
            instance = null;
        }
        super.onDestroy();
    }
}
