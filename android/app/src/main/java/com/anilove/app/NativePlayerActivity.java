package com.anilove.app;

import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.Icon;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Objects;
import java.util.Set;
import java.util.LinkedHashSet;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.GZIPInputStream;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.util.Log;
import android.util.Rational;
import android.util.TypedValue;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.SwitchCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.common.Tracks;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.FileDataSource;
import androidx.media3.datasource.HttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.source.MediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.exoplayer.source.UnrecognizedInputFormatException;
import androidx.media3.extractor.DefaultExtractorsFactory;
import androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory;
import androidx.media3.ui.PlayerView;

@SuppressWarnings({"deprecation", "RedundantSuppression", "SpellCheckingInspection", "Convert2Lambda", "NullableProblems", "UnusedDeclaration"})
public class NativePlayerActivity extends AppCompatActivity {
    public interface PlayerNavigationListener {
        void onNavigate(boolean next);
        void onBack();
        void onHome();
    }
    public static PlayerNavigationListener navigationListener;

    private PlayerView exoPlayerView;
    private ExoPlayer exoPlayer;
    private boolean isOfflineMode = false;
    private ProgressBar loadingProgress;
    private View controlsOverlay;
    private ImageButton btnPlayPause;
    private SeekBar seekBar;
    private TextView textCurrentTime, textTotalTime, textTimeLeft, indicator2x;
    private TextView indicatorRewind, indicatorForward;
    
    // Volume / Brightness
    private boolean isAdvancePlayerEnabled = false;
    private boolean hasNextEpisode = false;
    private boolean hasPrevEpisode = false;
    private long lastNavigationTimestamp = 0;
    private TextView indicatorVolume, indicatorBrightness;
    private AudioManager audioManager;
    private int initialVolume = -1;
    private float initialBrightness = -1.0f;
    
    // Scrubber Preview
    private View scrubberContainer;
    private TextView scrubberTime;
    
    // Caption Preview
    private TextView captionPreview;
    
    // Dual Player Engine (ExoPlayer <-> WebView Player)
    private static final Pattern SERVER2_EXTRACT_PATTERN = Pattern.compile("(embed/anime|anime|animepahe|v|e)/([a-zA-Z0-9_.-]+)/(\\d+)/(sub|dub)");
    private static final Pattern VIDLINK_EXTRACT_PATTERN = Pattern.compile("vidlink\\.pro/anime/(\\d+)/(\\d+)");

    private WebView playerWebView;
    private boolean isWebViewPlayerMode = false;
    private String currentEmbedUrl = null;
    private String currentActiveServerName = "";
    private String currentActiveSourceName = "";
    private final Map<String, Map<String, String>> activeLanguageQualityMap = new HashMap<>();

    public boolean is18PlusActive() {
        return (currentLoadedStreamUrl != null && currentLoadedStreamUrl.contains("hentaiocean")) ||
               (currentEmbedUrl != null && currentEmbedUrl.contains("hentaiocean")) ||
               "HentaiOcean".equalsIgnoreCase(currentActiveSourceName);
    }

    private boolean isPlaying = true;
    private boolean isControlsVisible = true;
    private boolean isDragging = false;
    private boolean is2xSpeed = false;
    private float currentPermanentSpeed = 1.0f;
    private boolean isVolumeBoosted = false;
    private boolean isSubtitlesEnabled = true;

    // Auto-Next Toast & Sniffer Retry State
    private View layoutAutoNextToast;
    private TextView textAutoNextCountdown;
    private boolean isAutoNextCanceled = false;
    private boolean isAutoNextTriggered = false;
    private boolean hasRetriedSniffer = false;

    // Real-Time Dynamic Media Track States
    private String currentLoadedStreamUrl = "";
    private List<String> detectedQualities = new ArrayList<>();
    private List<String> detectedAudios = new ArrayList<>();
    private List<String> detectedSubtitles = new ArrayList<>();
    private String currentSelectedQuality = "Auto";
    private String currentSelectedAudio = "Hindi";
    private String currentSelectedSubtitle = "English";
    
    // Caption State Defaults
    private double subtitleTimingOffset = 0.0;
    private String bgOpacity = "Off";
    private String bgColor = "Black";
    private int captionFontSize = 90;
    private String captionWeight = "Bold";
    private String captionPosition = "Bottom";
    private int bottomMargin = 12;
    private String captionColorName = "White";
    private String captionColorHex = "#FFFFFF";
    private String edgeStyle = "Shadow";
    private String subtitleUrl = null;
    private String subtitleLang = "English";

    private void loadEpisodeSubOffset() {
        int anilistId = getIntent().getIntExtra("anilistId", 0);
        int episodeNumber = getIntent().getIntExtra("episodeNumber", 0);
        if (anilistId <= 0 || episodeNumber <= 0) return;

        try {
            SharedPreferences prefs = getSharedPreferences("AniLoveSubTimingOffsets", MODE_PRIVATE);
            String key = anilistId + "_ep" + episodeNumber;
            String valStr = prefs.getString(key, null);

            if (valStr != null) {
                JSONObject obj = new JSONObject(valStr);
                long timestamp = obj.optLong("timestamp", 0);
                long ageDays = (System.currentTimeMillis() - timestamp) / (24 * 60 * 60 * 1000L);
                if (ageDays < 7) {
                    subtitleTimingOffset = obj.optDouble("offset", 0.0);
                } else {
                    prefs.edit().remove(key).apply();
                    subtitleTimingOffset = 0.0;
                }
            }
        } catch (Exception ignored) {
            subtitleTimingOffset = 0.0;
        }
    }

    private void saveEpisodeSubOffset(double offset) {
        int anilistId = getIntent().getIntExtra("anilistId", 0);
        int episodeNumber = getIntent().getIntExtra("episodeNumber", 0);
        if (anilistId <= 0 || episodeNumber <= 0) return;

        try {
            SharedPreferences prefs = getSharedPreferences("AniLoveSubTimingOffsets", MODE_PRIVATE);
            String key = anilistId + "_ep" + episodeNumber;
            subtitleTimingOffset = Math.round(offset * 10.0) / 10.0;

            JSONObject obj = new JSONObject();
            obj.put("offset", subtitleTimingOffset);
            obj.put("timestamp", System.currentTimeMillis());
            prefs.edit().putString(key, obj.toString()).apply();
        } catch (Exception ignored) {}

        applySubtitleTimingOffsetInWeb();
    }

    private void deleteEpisodeSubOffset() {
        int anilistId = getIntent().getIntExtra("anilistId", 0);
        int episodeNumber = getIntent().getIntExtra("episodeNumber", 0);
        if (anilistId <= 0 || episodeNumber <= 0) return;

        try {
            SharedPreferences prefs = getSharedPreferences("AniLoveSubTimingOffsets", MODE_PRIVATE);
            String key = anilistId + "_ep" + episodeNumber;
            prefs.edit().remove(key).apply();
            subtitleTimingOffset = 0.0;
        } catch (Exception ignored) {}
    }

    private void applySubtitleTimingOffsetInWeb() {
        runOnUiThread(() -> updateNativeSubtitleOverlay(exoPlayer != null ? exoPlayer.getCurrentPosition() / 1000.0 : 0));
    }

    private void saveCaptionSettingsToPrefs() {
        try {
            SharedPreferences prefs = getSharedPreferences("AniLoveCaptionPrefs", MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("bgOpacity", bgOpacity);
            editor.putString("bgColor", bgColor);
            editor.putInt("captionFontSize", captionFontSize);
            editor.putString("captionWeight", captionWeight);
            editor.putString("captionPosition", captionPosition);
            editor.putInt("bottomMargin", bottomMargin);
            editor.putString("captionColorName", captionColorName);
            editor.putString("captionColorHex", captionColorHex);
            editor.putString("edgeStyle", edgeStyle);
            editor.putString("currentSelectedSubtitle", currentSelectedSubtitle);
            editor.apply();
        } catch (Exception ignored) {}
    }

    private void loadCaptionSettingsFromPrefs() {
        try {
            SharedPreferences prefs = getSharedPreferences("AniLoveCaptionPrefs", MODE_PRIVATE);
            bgOpacity = prefs.getString("bgOpacity", "Off");
            bgColor = prefs.getString("bgColor", "Black");
            captionFontSize = prefs.getInt("captionFontSize", 90);
            captionWeight = prefs.getString("captionWeight", "Bold");
            captionPosition = prefs.getString("captionPosition", "Bottom");
            bottomMargin = prefs.getInt("bottomMargin", 12);
            captionColorName = prefs.getString("captionColorName", "White");
            captionColorHex = prefs.getString("captionColorHex", "#FFFFFF");
            edgeStyle = prefs.getString("edgeStyle", "Shadow");
            currentSelectedSubtitle = prefs.getString("currentSelectedSubtitle", "English");
        } catch (Exception ignored) {}
    }

    private double videoDuration = 0;
    private double currentVideoTime = 0;
    private OpEdSeekBarDrawable opEdSeekBarDrawable = null;
    private final Map<String, String> capturedServer2BSubtitles = new ConcurrentHashMap<>();

    private class OpEdSeekBarDrawable extends Drawable {
        private final Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint opEdPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint progressPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

        public OpEdSeekBarDrawable() {
            bgPaint.setColor(Color.parseColor("#44FFFFFF"));
            opEdPaint.setColor(Color.parseColor("#FFD700")); // Vibrant Yellow for Intro/Outro gaps
            progressPaint.setColor(Color.WHITE);
        }

        @Override
        public void draw(Canvas canvas) {
            Rect bounds = getBounds();
            float left = bounds.left;
            float right = bounds.right;
            float width = bounds.width();
            float centerY = bounds.centerY();
            float trackHeight = 12f;

            float top = centerY - (trackHeight / 2f);
            float bottom = centerY + (trackHeight / 2f);

            // 1. Base track background
            canvas.drawRoundRect(left, top, right, bottom, 6f, 6f, bgPaint);

            double effDuration = (videoDuration > 0) ? videoDuration : (seekBar != null && seekBar.getMax() > 0 ? seekBar.getMax() : 1440.0);
            if (effDuration > 0 && width > 0) {
                // 2. Current progress bar
                float progressRight = left + (float) ((currentVideoTime / effDuration) * width);
                canvas.drawRoundRect(left, top, Math.min(right, progressRight), bottom, 6f, 6f, progressPaint);

                // 3. Permanent vibrant yellow highlight for Intro (OP)
                if (aniSkipOpStart >= 0 && aniSkipOpEnd > aniSkipOpStart) {
                    float opLeft = left + (float) ((aniSkipOpStart / effDuration) * width);
                    float opRight = left + (float) ((aniSkipOpEnd / effDuration) * width);
                    canvas.drawRoundRect(opLeft, top - 2f, opRight, bottom + 2f, 4f, 4f, opEdPaint);
                }

                // 4. Permanent vibrant yellow highlight for Outro (ED)
                if (aniSkipEdStart >= 0 && aniSkipEdEnd > aniSkipEdStart) {
                    float edLeft = left + (float) ((aniSkipEdStart / effDuration) * width);
                    float edRight = left + (float) ((aniSkipEdEnd / effDuration) * width);
                    canvas.drawRoundRect(edLeft, top - 2f, edRight, bottom + 2f, 4f, 4f, opEdPaint);
                }
            }
        }

        @Override public void setAlpha(int alpha) { bgPaint.setAlpha(alpha); }
        @Override public void setColorFilter(ColorFilter colorFilter) {}
        @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
    }
    
    private final Handler updateHandler = new Handler(Looper.getMainLooper());
    private final Handler hideHandler = new Handler(Looper.getMainLooper());
    private GestureDetector gestureDetector;

    private final BroadcastReceiver pipReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || !"ACTION_PIP_CONTROL".equals(intent.getAction())) return;
            int controlType = intent.getIntExtra("control_type", 0);
            switch (controlType) {
                case 1: togglePlayPause(); updatePipParams(); break; // Play/Pause
                case 2: seekVideo(-10); break; // Rewind
                case 3: seekVideo(10); break; // Forward
            }
        }
    };

    private void updatePipParams() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Icon playPauseIcon = Icon.createWithResource(this, isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
            
            Intent intent = new Intent("ACTION_PIP_CONTROL");
            intent.putExtra("control_type", 1);
            PendingIntent playPausePending = PendingIntent.getBroadcast(this, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            RemoteAction playPauseAction = new RemoteAction(playPauseIcon, isPlaying ? "Pause" : "Play", isPlaying ? "Pause" : "Play", playPausePending);

            Icon rewindIcon = Icon.createWithResource(this, android.R.drawable.ic_media_rew);
            Intent rewindIntent = new Intent("ACTION_PIP_CONTROL");
            rewindIntent.putExtra("control_type", 2);
            PendingIntent rewindPending = PendingIntent.getBroadcast(this, 2, rewindIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            RemoteAction rewindAction = new RemoteAction(rewindIcon, "Rewind", "Rewind", rewindPending);

            Icon forwardIcon = Icon.createWithResource(this, android.R.drawable.ic_media_ff);
            Intent forwardIntent = new Intent("ACTION_PIP_CONTROL");
            forwardIntent.putExtra("control_type", 3);
            PendingIntent forwardPending = PendingIntent.getBroadcast(this, 3, forwardIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            RemoteAction forwardAction = new RemoteAction(forwardIcon, "Forward", "Forward", forwardPending);

            List<RemoteAction> actions = new ArrayList<>();
            actions.add(rewindAction);
            actions.add(playPauseAction);
            actions.add(forwardAction);

            PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9))
                    .setActions(actions);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setAutoEnterEnabled(isPlaying);
            }

            PictureInPictureParams params = builder.build();
            setPictureInPictureParams(params);
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (isPlaying && !isInPictureInPictureMode()) {
            enterPipMode();
        }
    }

    @SuppressWarnings("StaticFieldLeak")
    public static NativePlayerActivity currentInstance;

    private boolean isFullscreenMode = false;
    private void cleanupPlaybackEngines() {
        // 1. Immediately cancel all active background Sniffers
        VideoSniffer.cancelActiveSniffers();

        if (exoPlayerView != null) exoPlayerView.setVisibility(View.VISIBLE);

        // 3. Stop ExoPlayer playback synchronously without destroying the player instance for stream reuse
        if (exoPlayer != null) {
            try {
                exoPlayer.setPlayWhenReady(false);
                exoPlayer.stop();
                exoPlayer.clearMediaItems();
            } catch (Exception ignored) {}
        }
    }

    private boolean isWebViewInitialized = false;
    private void ensureWebViewInitialized() {
        if (isWebViewInitialized) return;
        isWebViewInitialized = true;
        playerWebView = findViewById(R.id.player_webview);
        if (playerWebView != null) {
            playerWebView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void onTimeUpdate(double currentSec) {
                    runOnUiThread(() -> {
                        currentVideoTime = currentSec;
                        updateNativeSubtitleOverlay(currentSec);
                    });
                }
            }, "AniLoveWebPlayerBridge");

            WebSettings settings = playerWebView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
            settings.setSupportMultipleWindows(false);
            settings.setJavaScriptCanOpenWindowsAutomatically(false);

            playerWebView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onShowCustomView(View view, CustomViewCallback callback) {
                    if (callback != null) {
                        try { callback.onCustomViewHidden(); } catch (Exception ignored) {}
                    }
                }
                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    return false;
                }
            });

            playerWebView.setWebViewClient(new WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    if (request != null && request.getUrl() != null) {
                        String url = request.getUrl().toString().toLowerCase();
                        if (isAdUrl(url)) {
                            Log.i("AniLove_AdBlock", "Blocked ad request: " + url);
                            return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("".getBytes()));
                        }
                    }
                    return super.shouldInterceptRequest(view, request);
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    if (request != null && request.getUrl() != null) {
                        String url = request.getUrl().toString();
                        String lower = url.toLowerCase();
                        String host = request.getUrl().getHost() != null ? request.getUrl().getHost().toLowerCase() : "";

                        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
                            Log.i("AniLove_AdBlock", "Blocked non-http url: " + url);
                            return true;
                        }

                        if (isAdUrl(lower) || host.contains("youtube") || host.contains("youtu.be") || host.contains("ytimg")) {
                            Log.i("AniLove_AdBlock", "Blocked ad redirect: " + url);
                            return true;
                        }

                        if (is18PlusActive() || (currentEmbedUrl != null && currentEmbedUrl.contains("hentaiocean"))) {
                            if (!host.contains("hentaiocean") && !host.contains("pyyokibh") && !host.contains("localhost")) {
                                Log.i("AniLove_AdBlock", "KILLED 18+ ad redirect to external domain: " + host + " (" + url + ")");
                                return true;
                            }
                        }

                        if (request.isForMainFrame()) {
                            if (currentEmbedUrl != null && !currentEmbedUrl.isEmpty()) {
                                try {
                                    String originalHost = new URL(currentEmbedUrl).getHost().toLowerCase();
                                    if (!host.contains("hentaiocean") && !host.equals(originalHost) && !originalHost.contains(host)) {
                                        Log.i("AniLove_AdBlock", "Blocked top-level ad redirect: " + host);
                                        return true;
                                    }
                                } catch (Exception ignored) {}
                            }
                        }
                    }
                    return false;
                }

                @Override
                public void onPageStarted(WebView view, String url, Bitmap favicon) {
                    super.onPageStarted(view, url, favicon);
                    injectAdEraserScript(view);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    injectAdEraserScript(view);
                }
            });

            playerWebView.setOnTouchListener((v, event) -> {
                if (event.getAction() == MotionEvent.ACTION_UP) {
                    v.performClick();
                    float x = event.getX();
                    float y = event.getY();
                    String clickScript = "var el = document.elementFromPoint(" + x + ", " + y + "); if (el) el.click();";
                    playerWebView.evaluateJavascript(clickScript, null);
                }
                return false;
            });
        }
    }

    @UnstableApi
    private void processIncomingIntent(Intent intent) {
        if (intent == null) return;
        setIntent(intent);

        StreamCache.clear();
        cleanupPlaybackEngines();

        stopHideTimer();
        isControlsVisible = true;
        if (controlsOverlay != null) controlsOverlay.setVisibility(View.VISIBLE);

        View touchWall = findViewById(R.id.touch_wall);
        if (touchWall != null) {
            touchWall.setVisibility(View.VISIBLE);
            touchWall.setClickable(true);
            touchWall.setFocusable(true);
        }

        updateMetadataFromIntent(intent);
        applyWindowSettings(intent);

        isPlaying = true;
        if (loadingProgress != null) loadingProgress.setVisibility(View.VISIBLE);
        if (textCurrentTime != null) textCurrentTime.setText("00:00");
        if (textTimeLeft != null) textTimeLeft.setText("-00:00");
        if (seekBar != null) seekBar.setProgress(0);
        if (btnPlayPause != null) btnPlayPause.setImageResource(android.R.drawable.ic_media_pause);

        parsedVttCues.clear();
        currentSelectedSubtitle = "English";

        int anilistId = intent.getIntExtra("anilistId", 0);
        int epNum = intent.getIntExtra("episodeNumber", 1);
        int idMal = intent.getIntExtra("idMal", 0);
        if ((idMal > 0 || anilistId > 0) && epNum > 0) {
            fetchAniSkipIntervals(idMal, anilistId, epNum);
        }

        String subUrl = intent.getStringExtra("subtitleUrl");
        String subLang = intent.getStringExtra("subtitleLang");
        if (subLang == null || subLang.isEmpty()) subLang = "English";

        String allSubsJson = intent.getStringExtra("allSubtitles");
        if (allSubsJson != null && !allSubsJson.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(allSubsJson);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    String label = obj.optString("displayLabel", obj.optString("language", ""));
                    String url = obj.optString("url", "");
                    if (!label.isEmpty() && !url.isEmpty()) {
                        capturedServer2BSubtitles.put(label, url);
                        if (!detectedSubtitles.contains(label)) {
                            detectedSubtitles.add(label);
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        if (subUrl != null && !subUrl.isEmpty()) {
            subtitleUrl = subUrl;
            subtitleLang = subLang;
            capturedServer2BSubtitles.put(subLang, subUrl);
            if (!detectedSubtitles.contains(subLang)) {
                detectedSubtitles.add(subLang);
            }
            downloadAndParseVttFile(subUrl);
        } else if (anilistId > 0 && epNum > 0 && !intent.getBooleanExtra("offlineMode", false)) {
            fetchUnifiedSubtitlesJava(anilistId, epNum);
        }

        String subUrl2 = intent.getStringExtra("subtitleUrl2");
        if (subUrl2 == null || subUrl2.isEmpty()) {
            subUrl2 = intent.getStringExtra("localSubPath2");
        }
        if (subUrl2 != null && !subUrl2.isEmpty()) {
            capturedServer2BSubtitles.put("English 2", subUrl2);
            if (!detectedSubtitles.contains("English 2")) {
                detectedSubtitles.add("English 2");
            }
        }

        isOfflineMode = intent.getBooleanExtra("offlineMode", false);
        if (isOfflineMode) {
            setupExoPlayer(intent.getStringExtra("localFilePath"), intent.getStringExtra("localSubPath"));
        } else {
            String streamUrl = intent.getStringExtra("videoUrl");
            if (streamUrl == null) streamUrl = intent.getStringExtra("url");
            String referer = intent.getStringExtra("referer");
            setupExoPlayerOnline(streamUrl, referer, null);
        }

        String reqEngine = intent.getStringExtra("engineMode");
        if (is18PlusActive() || "web".equalsIgnoreCase(reqEngine)) {
            ensureWebViewInitialized();
            switchPlayerEngine(true);
        }

        resetHideTimer();
    }

    @UnstableApi
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        overridePendingTransition(0, 0);
        processIncomingIntent(intent);
    }

    private int getPhysicalScreenWidth() {
        DisplayMetrics dm = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getRealMetrics(dm);
        return Math.min(dm.widthPixels, dm.heightPixels);
    }

    private void updateMetadataFromIntent(Intent intent) {
        if (intent == null) return;
        hasNextEpisode = intent.getBooleanExtra("hasNext", false);
        hasPrevEpisode = intent.getBooleanExtra("hasPrev", false);
        String rawUrl = intent.getStringExtra("url");
        if (rawUrl != null && !rawUrl.trim().isEmpty()) {
            if (rawUrl.contains("short.icu/")) {
                rawUrl = rawUrl.replace("short.icu/", "abyssplayer.com/");
            }
            currentEmbedUrl = rawUrl;
        }

        String sName = intent.getStringExtra("serverName");
        if (sName != null && !sName.isEmpty()) {
            currentActiveServerName = sName;
        }

        String srcName = intent.getStringExtra("sourceName");
        if (srcName != null && !srcName.isEmpty()) {
            currentActiveSourceName = srcName;
        }

        String availableLangsJson = intent.getStringExtra("availableLanguages");
        if (availableLangsJson != null && !availableLangsJson.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(availableLangsJson);
                List<String> list = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) {
                    list.add(arr.getString(i));
                }
                if (!list.isEmpty()) {
                    detectedAudios = list;
                }
            } catch (Exception ignored) {}
        }

        String availableResJson = intent.getStringExtra("availableResolutions");
        if (availableResJson != null && !availableResJson.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(availableResJson);
                List<String> list = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) {
                    list.add(arr.getString(i));
                }
                if (!list.isEmpty()) {
                    detectedQualities = list;
                }
            } catch (Exception ignored) {}
        }

        String langQualMapJson = intent.getStringExtra("languageQualityMap");
        if (langQualMapJson != null && !langQualMapJson.isEmpty()) {
            try {
                JSONObject obj = new JSONObject(langQualMapJson);
                activeLanguageQualityMap.clear();
                Iterator<String> keys = obj.keys();
                while (keys.hasNext()) {
                    String langKey = keys.next();
                    JSONObject qObj = obj.getJSONObject(langKey);
                    Map<String, String> qMap = new HashMap<>();
                    Iterator<String> qKeys = qObj.keys();
                    while (qKeys.hasNext()) {
                        String qKey = qKeys.next();
                        qMap.put(qKey, qObj.getString(qKey));
                    }
                    activeLanguageQualityMap.put(langKey, qMap);
                }
            } catch (Exception e) {
                Log.w("AniLove", "Error parsing languageQualityMap: " + e.getMessage());
            }
        }
        String animeTitle = intent.getStringExtra("animeTitle");
        String rawTitle = intent.getStringExtra("title");
        int epNum = intent.getIntExtra("episodeNumber", 1);
        int anilistId = intent.getIntExtra("anilistId", 0);
        int idMal = intent.getIntExtra("idMal", 0);
        if ((idMal > 0 || anilistId > 0) && epNum > 0) {
            fetchAniSkipIntervals(idMal, anilistId, epNum);
        }
        if (anilistId > 0 && epNum > 0) {
            fetchUnifiedSubtitlesJava(anilistId, epNum);
        }
        startTime = intent.getIntExtra("startTime", 0);
        subtitleUrl = intent.getStringExtra("subtitleUrl");
        subtitleLang = intent.getStringExtra("subtitleLang");
        if (subtitleLang == null || subtitleLang.isEmpty()) subtitleLang = "English";

        String allSubtitlesJson = intent.getStringExtra("allSubtitles");
        if (allSubtitlesJson != null && !allSubtitlesJson.isEmpty()) {
            try {
                JSONArray arr = new JSONArray(allSubtitlesJson);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    String label = obj.optString("displayLabel", obj.optString("language", ""));
                    String url = obj.optString("url", "");
                    if (!label.isEmpty() && !url.isEmpty()) {
                        capturedServer2BSubtitles.put(label, url);
                        if (!detectedSubtitles.contains(label)) {
                            detectedSubtitles.add(label);
                        }
                    }
                }
            } catch (Exception e) {
                Log.e("AniLove", "Error parsing allSubtitles JSON: " + e.getMessage());
            }
        }

        if (subtitleUrl != null && !subtitleUrl.isEmpty()) {
            capturedServer2BSubtitles.put(subtitleLang, subtitleUrl);
            if (!detectedSubtitles.contains(subtitleLang)) {
                detectedSubtitles.add(subtitleLang);
            }
            downloadAndParseVttFile(subtitleUrl);
        }

        String audio = intent.getStringExtra("audio");
        if (audio == null || audio.isEmpty()) audio = "DUB";

        if (rawTitle == null || rawTitle.isEmpty()) {
            rawTitle = Objects.requireNonNullElse(animeTitle, "Now Playing");
        }
        
        // Clean duplicate episode suffix if present (e.g., "Title - Ep 8 - EP 8" -> "Title - Ep 8")
        String displayTitle = rawTitle;
        if (displayTitle.matches("(?i).*\\b[-–|]?\\s*(ep|episode)\\s*\\d+.*")) {
            displayTitle = displayTitle.replaceAll("(?i)\\s*-\\s*(ep|episode)\\s*\\d+\\s*-\\s*(ep|episode)\\s*(\\d+)", " - Ep $3");
        } else if (epNum > 0) {
            displayTitle = displayTitle + " - Ep " + epNum;
        }

        TextView videoTitleView = findViewById(R.id.video_title);
        TextView portraitAnimeTitle = findViewById(R.id.portrait_anime_title);
        TextView portraitEpSubtitle = findViewById(R.id.portrait_episode_subtitle);
        TextView portraitBadgeAudio = findViewById(R.id.portrait_badge_audio);

        if (videoTitleView != null) videoTitleView.setText(displayTitle);
        if (portraitAnimeTitle != null) portraitAnimeTitle.setText(animeTitle != null ? animeTitle : displayTitle);
        if (portraitEpSubtitle != null) portraitEpSubtitle.setText("Episode " + epNum);
        if (portraitBadgeAudio != null) portraitBadgeAudio.setText(audio.toUpperCase());
    }

    private int currentY = 0;
    private int startTime = 0;

    private boolean hasInitializedWindowSettings = false;

    private void applyWindowSettings(Intent intent) {
        if (intent == null) intent = getIntent();
        if (intent != null && intent.hasExtra("startFullscreen")) {
            isFullscreenMode = intent.getBooleanExtra("startFullscreen", false);
        }
        hasInitializedWindowSettings = true;
        isOfflineMode = intent != null && intent.getBooleanExtra("offlineMode", isOfflineMode);
        if (intent != null && intent.hasExtra("yOffset")) {
            currentY = intent.getIntExtra("yOffset", 0);
        }
        Log.i("AniLove", "applyWindowSettings | isFullscreen: " + isFullscreenMode + " | isOffline: " + isOfflineMode);
        
        final Window window = getWindow();
        final View decorView = window.getDecorView();
        
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        
        decorView.post(() -> {
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
            if (controller != null) {
                if (isFullscreenMode) {
                    controller.hide(WindowInsetsCompat.Type.statusBars());
                    controller.hide(WindowInsetsCompat.Type.navigationBars());
                    window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
                } else if (isOfflineMode) {
                    controller.show(WindowInsetsCompat.Type.statusBars());
                    controller.setAppearanceLightStatusBars(false);
                    window.setStatusBarColor(Color.BLACK);
                    controller.show(WindowInsetsCompat.Type.navigationBars());
                    window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                } else {
                    // Portrait streaming: hide status bar AND nav bar so they
                    // don't overlap video controls; swipe from edge to reveal temporarily
                    controller.hide(WindowInsetsCompat.Type.statusBars());
                    controller.hide(WindowInsetsCompat.Type.navigationBars());
                    window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
                }
                controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        });

        WindowManager.LayoutParams params = window.getAttributes();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        if (isFullscreenMode) {
            // FULLSCREEN LANDSCAPE (both streaming and offline playback)
            NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);

            window.clearFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH);
            window.setBackgroundDrawable(new ColorDrawable(Color.BLACK));
            findViewById(android.R.id.content).setBackgroundColor(Color.BLACK);

            params.width = WindowManager.LayoutParams.MATCH_PARENT;
            params.height = WindowManager.LayoutParams.MATCH_PARENT;
            params.gravity = Gravity.FILL;
            params.x = 0;
            params.y = 0;

            decorView.post(() -> {
                View videoRoot = findViewById(R.id.video_root_container);
                View portraitBottom = findViewById(R.id.portrait_bottom_container);
                View statusBarFiller = findViewById(R.id.status_bar_filler);
                View topBar = findViewById(R.id.top_bar);
                View topCenterBar = findViewById(R.id.top_center_button_bar);
                
                if (videoRoot != null) {
                    ViewGroup.LayoutParams lp = videoRoot.getLayoutParams();
                    lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                    lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
                    videoRoot.setLayoutParams(lp);
                }
                if (portraitBottom != null) portraitBottom.setVisibility(View.GONE);
                if (statusBarFiller != null) statusBarFiller.setVisibility(View.GONE);
                if (topCenterBar != null) topCenterBar.setVisibility(View.GONE);
                if (topBar != null) {
                    topBar.setVisibility(View.VISIBLE);
                    int safeTopPadding = (int) (14 * getResources().getDisplayMetrics().density);
                    topBar.setPadding(topBar.getPaddingLeft(), safeTopPadding, topBar.getPaddingRight(), topBar.getPaddingBottom());
                }
            });
        } else if (isOfflineMode) {
            // PORTRAIT OFFLINE DOWNLOAD PLAYBACK: Full Activity with top video + bottom episode details container
            NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

            window.clearFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH);
            window.setBackgroundDrawable(new ColorDrawable(Color.BLACK));
            findViewById(android.R.id.content).setBackgroundColor(Color.BLACK);

            params.width = WindowManager.LayoutParams.MATCH_PARENT;
            params.height = WindowManager.LayoutParams.MATCH_PARENT;
            params.gravity = Gravity.FILL;
            params.x = 0;
            params.y = 0;

            int physicalWidth = getPhysicalScreenWidth();
            int videoHeight = (int) (physicalWidth * 0.5625);
            
            int statusBarHeight = 0;
            int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (resourceId > 0) statusBarHeight = getResources().getDimensionPixelSize(resourceId);
            
            final int finalStatusBarHeight = statusBarHeight;
            decorView.post(() -> {
                View videoRoot = findViewById(R.id.video_root_container);
                View portraitBottom = findViewById(R.id.portrait_bottom_container);
                View statusBarFiller = findViewById(R.id.status_bar_filler);
                View topBar = findViewById(R.id.top_bar);
                View topCenterBar = findViewById(R.id.top_center_button_bar);
                
                if (videoRoot != null) {
                    ViewGroup.LayoutParams lp = videoRoot.getLayoutParams();
                    lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                    lp.height = videoHeight + finalStatusBarHeight;
                    videoRoot.setLayoutParams(lp);
                }
                if (portraitBottom != null) portraitBottom.setVisibility(View.VISIBLE);
                if (topCenterBar != null) topCenterBar.setVisibility(View.GONE);
                if (statusBarFiller != null) {
                    statusBarFiller.setVisibility(View.VISIBLE);
                    ViewGroup.LayoutParams lp = statusBarFiller.getLayoutParams();
                    lp.height = finalStatusBarHeight;
                    statusBarFiller.setLayoutParams(lp);
                }
                if (topBar != null) {
                    topBar.setVisibility(View.VISIBLE);
                    int padTop = (int) (10 * getResources().getDisplayMetrics().density);
                    topBar.setPadding(topBar.getPaddingLeft(), padTop, topBar.getPaddingRight(), topBar.getPaddingBottom());
                }
            });
        } else {
            // PORTRAIT STREAMING: Top Video Overlay sitting above the web WatchView page
            NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

            window.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            findViewById(android.R.id.content).setBackgroundColor(Color.TRANSPARENT);
            window.addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH);

            int physicalWidth = getPhysicalScreenWidth();
            int videoHeight = (int) (physicalWidth * 0.5625);
            
            int statusBarHeight = 0;
            int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (resourceId > 0) statusBarHeight = getResources().getDimensionPixelSize(resourceId);

            params.width = WindowManager.LayoutParams.MATCH_PARENT;
            params.height = videoHeight + statusBarHeight;
            params.gravity = Gravity.TOP | Gravity.START;
            params.x = 0;
            params.y = 0;

            final int finalStatusBarHeight = statusBarHeight;
            decorView.post(() -> {
                int curWidth = getPhysicalScreenWidth();
                int curVideoHeight = (int) (curWidth * 0.5625);

                View videoRoot = findViewById(R.id.video_root_container);
                View portraitBottom = findViewById(R.id.portrait_bottom_container);
                View statusBarFiller = findViewById(R.id.status_bar_filler);
                View topBar = findViewById(R.id.top_bar);
                View topCenterBar = findViewById(R.id.top_center_button_bar);
                
                if (videoRoot != null) {
                    ViewGroup.LayoutParams lp = videoRoot.getLayoutParams();
                    lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                    lp.height = curVideoHeight + finalStatusBarHeight;
                    videoRoot.setLayoutParams(lp);
                }
                if (portraitBottom != null) portraitBottom.setVisibility(View.GONE);
                if (topCenterBar != null) topCenterBar.setVisibility(View.GONE);
                if (statusBarFiller != null) {
                    statusBarFiller.setVisibility(View.VISIBLE);
                    ViewGroup.LayoutParams lp = statusBarFiller.getLayoutParams();
                    lp.height = finalStatusBarHeight;
                    statusBarFiller.setLayoutParams(lp);
                }
                if (topBar != null) {
                    topBar.setVisibility(View.VISIBLE);
                    int padTop = (int) (10 * getResources().getDisplayMetrics().density);
                    topBar.setPadding(topBar.getPaddingLeft(), padTop, topBar.getPaddingRight(), topBar.getPaddingBottom());
                }
            });
        }
        
        window.setAttributes(params);
    }

    public void toggleFullscreenInPlace() {
        new Handler(Looper.getMainLooper()).post(() -> {
            isFullscreenMode = !isFullscreenMode;
            Log.i("AniLove_Fullscreen", "toggleFullscreenInPlace | isFullscreen: " + isFullscreenMode);

            int targetOrientation = isFullscreenMode 
                ? ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE 
                : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
            NativePlayerPlugin.setScreenOrientation(targetOrientation);
            setRequestedOrientation(targetOrientation);

            Intent intent = getIntent();
            if (intent != null) intent.putExtra("startFullscreen", isFullscreenMode);
            applyWindowSettings(intent);
        });
    }

    @UnstableApi
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentInstance = this;
        supportRequestWindowFeature(Window.FEATURE_NO_TITLE);
        loadCaptionSettingsFromPrefs();
        loadEpisodeSubOffset();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (isFullscreenMode) {
                    toggleFullscreenInPlace();
                    return;
                }
                NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                MainActivity.pendingBackToDetails = true;
                if (navigationListener != null) {
                    navigationListener.onBack();
                }
                finish();
            }
        });

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        isOfflineMode = getIntent().getBooleanExtra("offlineMode", false);
        if (isOfflineMode) {
            getWindow().setBackgroundDrawable(new ColorDrawable(Color.BLACK));
        } else {
            getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        }
        
        setContentView(R.layout.activity_native_player);
        applyCaptionStyle();
        
        overridePendingTransition(0, 0);

        // UI Initialization
        exoPlayerView = findViewById(R.id.player_exoplayer);
        if (exoPlayerView != null) {
            exoPlayerView.setVisibility(View.VISIBLE);
        }

        TextView btnEngineToggle = findViewById(R.id.btn_engine_toggle);
        if (btnEngineToggle != null) {
            btnEngineToggle.setVisibility(View.GONE);
        }

        View btnLandscapeToggle = findViewById(R.id.btn_landscape_toggle);
        if (btnLandscapeToggle != null) {
            btnLandscapeToggle.setVisibility(View.GONE);
        }

        TextView btnHome18Plus = findViewById(R.id.btn_home_18plus);
        if (btnHome18Plus != null) {
            if (is18PlusActive()) {
                btnHome18Plus.setVisibility(View.VISIBLE);
                btnHome18Plus.setOnClickListener(v -> {
                    NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                    if (navigationListener != null) {
                        navigationListener.onHome();
                    }
                    finish();
                });
            } else {
                btnHome18Plus.setVisibility(View.GONE);
            }
        }

        loadingProgress = findViewById(R.id.loading_progress);
        controlsOverlay = findViewById(R.id.controls_overlay);
        
        btnPlayPause = findViewById(R.id.btn_play_pause);
        seekBar = findViewById(R.id.video_seekbar);
        if (seekBar != null) {
            seekBar.setProgressTintList(null);
            seekBar.setProgressBackgroundTintList(null);
        }
        opEdSeekBarDrawable = new OpEdSeekBarDrawable();
        seekBar.setProgressDrawable(opEdSeekBarDrawable);
        textCurrentTime = findViewById(R.id.text_current_time);
        textTotalTime = findViewById(R.id.text_total_time);
        textTimeLeft = findViewById(R.id.text_time_left);
        
        ImageButton btnNextEpisode = findViewById(R.id.btn_next_episode);
        ImageButton btnPrevEpisode = findViewById(R.id.btn_prev_episode);
        
        scrubberContainer = findViewById(R.id.scrubber_preview_container);
        scrubberTime = findViewById(R.id.scrubber_time);
        
        indicator2x = findViewById(R.id.indicator_2x);
        indicatorRewind = findViewById(R.id.indicator_rewind);
        indicatorForward = findViewById(R.id.indicator_forward);
        
        // Volume / Brightness Init
        isAdvancePlayerEnabled = getIntent().getBooleanExtra("advancePlayer", false);
        indicatorVolume = findViewById(R.id.indicator_volume);
        indicatorBrightness = findViewById(R.id.indicator_brightness);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        
        btnPlayPause.setOnClickListener(v -> togglePlayPause());
        findViewById(R.id.btn_settings).setOnClickListener(v -> showSettingsMenu());

        layoutAutoNextToast = findViewById(R.id.layout_auto_next_toast);
        textAutoNextCountdown = findViewById(R.id.text_auto_next_countdown);
        View btnAutoNextPlayNow = findViewById(R.id.btn_auto_next_play_now);
        View btnAutoNextCancel = findViewById(R.id.btn_auto_next_cancel);

        if (btnAutoNextPlayNow != null) {
            btnAutoNextPlayNow.setOnClickListener(v -> {
                if (layoutAutoNextToast != null) layoutAutoNextToast.setVisibility(View.GONE);
                navigateEpisode(true);
            });
        }

        if (btnAutoNextCancel != null) {
            btnAutoNextCancel.setOnClickListener(v -> {
                isAutoNextCanceled = true;
                if (layoutAutoNextToast != null) layoutAutoNextToast.setVisibility(View.GONE);
            });
        }

        ImageButton btnCaptions = findViewById(R.id.btn_captions);
        if (btnCaptions != null) {
            btnCaptions.setOnClickListener(v -> showCaptionMenu());
        }
        
        ImageButton btnPip = findViewById(R.id.btn_pip);
        if (btnPip != null) {
            btnPip.setOnClickListener(v -> enterPipMode());
        }
        
        View btnFullscreenToggle = findViewById(R.id.btn_fullscreen_toggle);
        if (btnFullscreenToggle != null) {
            btnFullscreenToggle.setOnClickListener(v -> toggleFullscreenInPlace());
        }
        
        findViewById(R.id.btn_rewind).setOnClickListener(v -> seekVideo(-10));
        findViewById(R.id.btn_forward).setOnClickListener(v -> seekVideo(10));
        btnNextEpisode.setOnClickListener(v -> navigateEpisode(true));
        btnPrevEpisode.setOnClickListener(v -> navigateEpisode(false));

        btnNextEpisode.setVisibility(View.VISIBLE);
        btnPrevEpisode.setVisibility(View.VISIBLE);

        TextView btnSkipIntro = findViewById(R.id.btn_skip_intro);
        if (btnSkipIntro != null) {
            btnSkipIntro.setOnClickListener(v -> {
                Object tag = btnSkipIntro.getTag();
                int targetSec = 85;
                if (tag instanceof Double) {
                    targetSec = ((Double) tag).intValue();
                } else if (tag instanceof Integer) {
                    targetSec = (Integer) tag;
                }
                if (tag instanceof Double || tag instanceof Integer) {
                    seekVideoToAbsolute(targetSec);
                } else {
                    seekVideo(85);
                }
            });

            GradientDrawable border = new GradientDrawable();
            border.setColor(Color.parseColor("#CC000000"));
            border.setStroke(2, Color.parseColor("#88FFFFFF"));
            border.setCornerRadius(16);
            btnSkipIntro.setBackground(border);
        }

        gestureDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onSingleTapConfirmed(MotionEvent e) { toggleControlsVisibility(); return true; }
            @Override public boolean onDoubleTap(MotionEvent e) {
                float screenWidthPx = getResources().getDisplayMetrics().widthPixels;
                if (e.getX() < screenWidthPx / 2) { seekVideo(-10); showSeekIndicator(false); }
                else { seekVideo(10); showSeekIndicator(true); }
                if (isControlsVisible) resetHideTimer();
                return true;
            }
            @Override public void onLongPress(MotionEvent e) { setPlaybackSpeed(2.0f, false); hideControlsQuietly(); }
            
            @Override
            public boolean onScroll(MotionEvent e1, MotionEvent e2, float distanceX, float distanceY) {
                if (!isAdvancePlayerEnabled || e1 == null || e2 == null) return false;
                
                if (Math.abs(distanceY) > Math.abs(distanceX)) {
                    float screenWidth = getResources().getDisplayMetrics().widthPixels;
                    float screenHeight = getResources().getDisplayMetrics().heightPixels;
                    
                    if (initialVolume == -1) {
                        initialVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
                        initialBrightness = getWindow().getAttributes().screenBrightness;
                        if (initialBrightness < 0) initialBrightness = 0.5f;
                    }

                    float deltaY = e1.getY() - e2.getY(); // Drag UP is positive
                    float percent = deltaY / screenHeight;

                    if (e1.getX() < screenWidth / 2) {
                        updateBrightness(percent);
                    } else {
                        updateVolume(percent);
                    }
                    return true;
                }
                return false;
            }
        });

        View.OnTouchListener touchListener = (v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
                if (is2xSpeed) setPlaybackSpeed(currentPermanentSpeed, true);
                if (indicatorVolume != null) indicatorVolume.setVisibility(View.GONE);
                if (indicatorBrightness != null) indicatorBrightness.setVisibility(View.GONE);
                initialVolume = -1;
                initialBrightness = -1.0f;
                if (event.getAction() == MotionEvent.ACTION_UP) {
                    v.performClick();
                }
            }
            return gestureDetector.onTouchEvent(event);
        };

        View.OnTouchListener overlayTouchListener = (v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
                if (is2xSpeed) setPlaybackSpeed(currentPermanentSpeed, true);
                if (indicatorVolume != null) indicatorVolume.setVisibility(View.GONE);
                if (indicatorBrightness != null) indicatorBrightness.setVisibility(View.GONE);
                initialVolume = -1;
                initialBrightness = -1.0f;
                if (event.getAction() == MotionEvent.ACTION_UP) {
                    v.performClick();
                }
            }
            gestureDetector.onTouchEvent(event);
            return true;
        };

        findViewById(R.id.touch_wall).setOnTouchListener(touchListener);
        controlsOverlay.setOnTouchListener(overlayTouchListener);

        seekBar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar s, int p, boolean u) { 
                if (u) {
                    updateScrubberPosition(s, p);
                }
            }
            @Override public void onStartTrackingTouch(SeekBar s) { 
                isDragging = true; 
                stopHideTimer(); 
                scrubberContainer.setVisibility(View.VISIBLE);
            }
            @Override public void onStopTrackingTouch(SeekBar s) { 
                isDragging = false; 
                if (exoPlayer != null) {
                    long duration = exoPlayer.getDuration();
                    if (duration > 0) {
                        long targetMs = s.getProgress() * 1000L;
                        exoPlayer.seekTo(Math.min(targetMs, duration));
                        currentVideoTime = targetMs / 1000.0;
                        updateNativeSubtitleOverlay(currentVideoTime);
                    }
                }
                resetHideTimer(); 
                scrubberContainer.setVisibility(View.GONE);
            }
        });

        processIncomingIntent(getIntent());

        startUpdateLoop();
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        if (!isFullscreenMode && !isOfflineMode && event != null) {
            View videoRoot = findViewById(R.id.video_root_container);
            int videoHeight = (videoRoot != null && videoRoot.getHeight() > 0)
                    ? videoRoot.getHeight()
                    : (int) (getPhysicalScreenWidth() * 0.5625);

            float translationY = videoRoot != null ? videoRoot.getTranslationY() : 0;
            float effectiveY = event.getY() - translationY;

            if (effectiveY > videoHeight) {
                if (MainActivity.instance != null && MainActivity.instance.getBridge() != null) {
                    WebView webView = MainActivity.instance.getBridge().getWebView();
                    if (webView != null) {
                        final MotionEvent copyEvent = MotionEvent.obtain(event);
                        webView.post(() -> {
                            try {
                                webView.dispatchTouchEvent(copyEvent);
                            } catch (Exception ignored) {
                            } finally {
                                copyEvent.recycle();
                            }
                        });
                    }
                }
                return true;
            }
        }
        return super.dispatchTouchEvent(event);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_OUTSIDE) {
            return false;
        }
        return super.onTouchEvent(event);
    }

    @UnstableApi
    private void setupExoPlayer(String videoPath, String subPath) {
        if (videoPath == null || videoPath.isEmpty()) return;
        try {
            if (exoPlayer != null) {
                exoPlayer.stop();
                exoPlayer.release();
                exoPlayer = null;
            }
            exoPlayer = new ExoPlayer.Builder(this).build();
            exoPlayerView.setPlayer(exoPlayer);

            MediaItem.Builder mediaBuilder = new MediaItem.Builder()
                    .setUri(Uri.fromFile(new File(videoPath)));

            String effectiveSubPath = (subPath != null && !subPath.isEmpty()) ? subPath : subtitleUrl;
            if ((effectiveSubPath == null || effectiveSubPath.isEmpty()) && videoPath != null) {
                File vFile = new File(videoPath);
                int ep = getIntent().getIntExtra("episodeNumber", 1);
                File candidate1 = new File(vFile.getParent(), "ep_" + ep + ".vtt");
                File candidate2 = new File(vFile.getParent(), vFile.getName().replace(".mp4", ".vtt"));
                if (candidate1.exists()) {
                    effectiveSubPath = candidate1.getAbsolutePath();
                } else if (candidate2.exists()) {
                    effectiveSubPath = candidate2.getAbsolutePath();
                }
            }

            String effectiveSubPath2 = getIntent().getStringExtra("localSubPath2");
            if (effectiveSubPath2 == null || effectiveSubPath2.isEmpty()) {
                effectiveSubPath2 = getIntent().getStringExtra("subtitleUrl2");
            }
            if ((effectiveSubPath2 == null || effectiveSubPath2.isEmpty()) && videoPath != null) {
                File vFile = new File(videoPath);
                int ep = getIntent().getIntExtra("episodeNumber", 1);
                File candidate2A = new File(vFile.getParent(), "ep_" + ep + "_2.vtt");
                if (candidate2A.exists()) {
                    effectiveSubPath2 = candidate2A.getAbsolutePath();
                }
            }

            if (effectiveSubPath2 != null && !effectiveSubPath2.isEmpty()) {
                capturedServer2BSubtitles.put("English 2", effectiveSubPath2);
                if (!detectedSubtitles.contains("English 2")) {
                    detectedSubtitles.add("English 2");
                }
            }

            if (effectiveSubPath != null && !effectiveSubPath.isEmpty()) {
                subtitleUrl = effectiveSubPath;
                subtitleLang = "English";
                currentSelectedSubtitle = "English";
                capturedServer2BSubtitles.put("English", effectiveSubPath);
                if (!detectedSubtitles.contains("English")) {
                    detectedSubtitles.add("English");
                }
                downloadAndParseVttFile(effectiveSubPath);

                Uri subUri;
                if (effectiveSubPath.startsWith("http")) {
                    subUri = Uri.parse(effectiveSubPath);
                } else {
                    File subFile = new File(effectiveSubPath);
                    if (subFile.exists()) {
                        subUri = Uri.fromFile(subFile);
                    } else {
                        subUri = null;
                    }
                }
                
                if (subUri != null) {
                    MediaItem.SubtitleConfiguration subtitle = new MediaItem.SubtitleConfiguration.Builder(subUri)
                            .setMimeType(MimeTypes.TEXT_VTT)
                            .setLanguage("en")
                            .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                            .build();
                    mediaBuilder.setSubtitleConfigurations(Collections.singletonList(subtitle));
                }
            }

            DefaultExtractorsFactory extractorsFactory = new DefaultExtractorsFactory()
                    .setConstantBitrateSeekingEnabled(true)
                    .setTsExtractorFlags(DefaultTsPayloadReaderFactory.FLAG_ALLOW_NON_IDR_KEYFRAMES | DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS);

            DataSource.Factory dataSourceFactory = new FileDataSource.Factory();
            ProgressiveMediaSource mediaSource = new ProgressiveMediaSource.Factory(dataSourceFactory, extractorsFactory)
                    .createMediaSource(mediaBuilder.build());

            exoPlayer.setMediaSource(mediaSource);
            if (startTime > 0) {
                exoPlayer.seekTo(startTime * 1000L);
            }
            exoPlayer.prepare();
            exoPlayer.setPlayWhenReady(true);
            loadingProgress.setVisibility(View.GONE);

            exoPlayer.addListener(new Player.Listener() {
                @Override
                public void onIsPlayingChanged(boolean playing) {
                    isPlaying = playing;
                    btnPlayPause.setImageResource(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
                    if (isPlaying) resetHideTimer(); else stopHideTimer();
                }

                @Override
                public void onPlaybackStateChanged(int playbackState) {
                    if (playbackState == Player.STATE_BUFFERING) {
                        loadingProgress.setVisibility(View.VISIBLE);
                    } else if (playbackState == Player.STATE_READY) {
                        loadingProgress.setVisibility(View.GONE);
                    } else if (playbackState == Player.STATE_ENDED) {
                        isPlaying = false;
                        btnPlayPause.setImageResource(android.R.drawable.ic_media_play);
                    }
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    Log.e("AniLove", "ExoPlayer error: " + error.getMessage());
                    loadingProgress.setVisibility(View.GONE);
                }
            });
        } catch (Exception e) {
            Log.e("AniLove", "Error setting up ExoPlayer", e);
        }
    }

    public static String sanitizeStreamUrl(String url) {
        if (url == null || url.trim().isEmpty()) return url;
        String trimmed = url.trim();

        if (trimmed.contains("#")) {
            String[] parts = trimmed.split("#", 2);
            String baseUrl = parts[0];
            String fragment = parts[1];

            if (fragment.contains("?")) {
                String[] fragParts = fragment.split("\\?", 2);
                String query = fragParts[1];
                if (baseUrl.contains("?")) {
                    trimmed = baseUrl + "&" + query;
                } else {
                    trimmed = baseUrl + "?" + query;
                }
            } else {
                trimmed = baseUrl;
            }
        }
        return trimmed;
    }

    private String getBestRefererForUrl(String videoUrl, String embedUrl) {
        String sName = (currentActiveSourceName != null ? currentActiveSourceName : "") + " " + (currentActiveServerName != null ? currentActiveServerName : "");
        String sLower = sName.toLowerCase();
        if (sLower.contains("moviebox") || sLower.contains("multi-lang") || sLower.contains("multilang")) {
            return "https://netfilm.world/";
        }

        String primary = (embedUrl != null && !embedUrl.isEmpty()) ? embedUrl : videoUrl;
        if (primary == null || primary.trim().isEmpty()) {
            return "https://google.com/";
        }

        String pLower = primary.toLowerCase();
        if (pLower.contains("moviebox") || pLower.contains("netfilm") || pLower.contains("hakunaymatata") || pLower.contains("bcdnxw")) {
            return "https://netfilm.world/";
        }

        if (videoUrl != null) {
            String vLower = videoUrl.toLowerCase();
            if (vLower.contains("moviebox") || vLower.contains("netfilm") || vLower.contains("hakunaymatata") || vLower.contains("bcdnxw")) {
                return "https://netfilm.world/";
            }
        }

        try {
            if (videoUrl != null) {
                String vHost = new URL(videoUrl).getHost().toLowerCase();
                if (vHost.contains("netfilm") || vHost.contains("moviebox") || vHost.contains("hakunaymatata") || vHost.contains("bcdnxw")) {
                    return "https://netfilm.world/";
                }
                if (vHost.contains("rumble.cloud") || vHost.contains("rumble")) return "https://blakiteapi.xyz/";
                if (vHost.contains("googleapis.com") || vHost.contains("googleusercontent.com")) {
                    if (primary.contains("animesalt")) return "https://animesalt.me/";
                    return "https://abyssplayer.com/";
                }
            }
            URL parsed = new URL(primary);
            String host = parsed.getHost().toLowerCase();
            if (host.contains("moviebox") || host.contains("netfilm") || host.contains("hakunaymatata") || host.contains("bcdnxw")) return "https://netfilm.world/";
            if (host.contains("animesalt")) return "https://animesalt.me/";
            if (host.contains("abyssplayer") || host.contains("abyss") || host.contains("short.icu")) return "https://abyssplayer.com/";
            if (host.contains("vidmoly")) return "https://vidmoly.biz/";
            if (host.contains("blakiteapi")) return "https://blakiteapi.xyz/";
            if (host.contains("piratexplay")) return "https://piratexplay.cc/";
            if (host.contains("watchanimeworld")) return "https://watchanimeworld.one/";
            if (host.contains("megaplay")) return "https://megaplay.buzz/";
            if (host.contains("justanime")) return "https://justanime.to/";
            return parsed.getProtocol() + "://" + host + "/";
        } catch (Exception e) {
            return "https://google.com/";
        }
    }

    private boolean isDirectMediaStream(String url) {
        if (url == null || url.trim().isEmpty()) return false;
        String lower = url.toLowerCase().trim();

        if (lower.contains("tryembed.us.cc/s/") || lower.contains("vidnest.fun/s/")) {
            return false;
        }

        if (lower.contains(".js") || lower.contains(".css") || lower.contains(".html") || lower.contains(".htm") || lower.contains(".vtt") || lower.contains(".srt")) {
            return false;
        }

        if ((lower.contains(".ts") || lower.contains(".m4s")) && !lower.contains(".m3u8")) {
            return false;
        }

        return lower.contains(".m3u8") || lower.contains(".mp4") || lower.contains(".m3u") ||
               lower.contains(".mpd") || lower.contains("/cdn/") || lower.contains("netfilm") ||
               lower.contains("moviebox") || lower.contains("/hls/") || lower.contains("manifest.m3u8") ||
               lower.contains("master.m3u8") || lower.contains("index.m3u8") || lower.contains("googlevideo.com") ||
               lower.contains("/proxy?");
    }

    @UnstableApi
    private void runSnifferFallback(String url, String originalReferer, Map<String, String> headers) {
        if (url != null && (url.contains("hentaiocean") || is18PlusActive())) {
            Log.i("AniLove_Sniffer", "Bypassing VideoSniffer for HentaiOcean 18+ stream -> WebPlayer mode: " + url);
            currentEmbedUrl = url;
            switchPlayerEngine(true);
            return;
        }

        runOnUiThread(() -> {
            if (loadingProgress != null) loadingProgress.setVisibility(View.VISIBLE);
            VideoSniffer sniffer = new VideoSniffer(getApplicationContext());
            sniffer.sniff(url, new VideoSniffer.OnVideoFoundListener() {
                @Override
                public void onVideoFound(String videoUrl) {
                    runOnUiThread(() -> {
                        String bestReferer = getBestRefererForUrl(videoUrl, url);
                        Log.i("AniLove_Sniffer", "Sniffed direct stream: " + videoUrl + " | Referer: " + bestReferer);
                        setupExoPlayerOnlineDirect(videoUrl, bestReferer, headers);
                    });
                }

                @Override
                public void onVideoFound(String videoUrl, String sniffedSubUrl) {
                    runOnUiThread(() -> {
                        if (sniffedSubUrl != null && !sniffedSubUrl.isEmpty()) {
                            subtitleUrl = sniffedSubUrl;
                        }
                        String bestReferer = getBestRefererForUrl(videoUrl, url);
                        Log.i("AniLove_Sniffer", "Sniffed direct stream: " + videoUrl + " | Sub: " + sniffedSubUrl + " | Referer: " + bestReferer);
                        setupExoPlayerOnlineDirect(videoUrl, bestReferer, headers);
                    });
                }

                @Override
                public void onError(String message) {
                    runOnUiThread(() -> {
                        if (loadingProgress != null) loadingProgress.setVisibility(View.GONE);
                        Toast.makeText(NativePlayerActivity.this, "Stream error: Please select another server option (Server 2-A / 2-B).", Toast.LENGTH_LONG).show();
                    });
                }
            });
        });
    }

    @UnstableApi
    private boolean attemptServer2DirectExtract(String embedUrl, String referer, Map<String, String> headers) {
        if (embedUrl == null || (!embedUrl.contains("tryembed.us.cc") && !embedUrl.contains("vidnest.fun"))) {
            return false;
        }
        try {
            boolean isTryEmbed = embedUrl.contains("tryembed.us.cc");
            String baseHost = isTryEmbed ? "https://tryembed.us.cc" : "https://vidnest.fun";

            Matcher matcher = SERVER2_EXTRACT_PATTERN.matcher(embedUrl);
            if (!matcher.find()) return false;

            String routeType = matcher.group(1);
            if ("embed/anime".equals(routeType) || "v".equals(routeType) || "e".equals(routeType)) routeType = "anime";
            String animeId = matcher.group(2);
            String epNum = matcher.group(3);
            String audioType = matcher.group(4);

            String apiUrl = baseHost + "/api/stream_data?id=" + animeId + "&episode=" + epNum + "&audio=" + audioType + "&route=" + routeType + "&player=jw";

            Executors.newSingleThreadExecutor().execute(() -> {
                try {
                    URL u = new URL(apiUrl);
                    HttpURLConnection conn = (HttpURLConnection) u.openConnection();
                    conn.setConnectTimeout(6000);
                    conn.setReadTimeout(6000);
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
                    conn.setRequestProperty("Referer", baseHost + "/");

                    if (conn.getResponseCode() == 200) {
                        BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = in.readLine()) != null) sb.append(line);
                        in.close();

                        JSONObject json = new JSONObject(sb.toString());
                        String streamFile = json.optString("file", "");
                        if (streamFile.isEmpty()) streamFile = json.optString("url", "");
                        if (streamFile.isEmpty()) {
                            JSONArray sources = json.optJSONArray("sources");
                            if (sources != null && sources.length() > 0) {
                                streamFile = sources.getJSONObject(0).optString("file", "");
                            }
                        }

                        if (!streamFile.isEmpty() && isDirectMediaStream(streamFile)) {
                            final String finalStream = streamFile;
                            Log.i("AniLove_DirectExtract", "Successfully extracted direct Server 2 stream: " + finalStream);
                            runOnUiThread(() -> setupExoPlayerOnlineDirect(finalStream, baseHost + "/", headers));
                            return;
                        }
                    }
                } catch (Exception e) {
                    Log.d("AniLove_DirectExtract", "Direct extract failed, falling back to VideoSniffer: " + e.getMessage());
                }
                runSnifferFallback(embedUrl, referer, headers);
            });
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @UnstableApi
    private boolean attemptVidLinkDirectExtract(String embedUrl, String referer, Map<String, String> headers) {
        if (embedUrl == null || !embedUrl.contains("vidlink.pro")) return false;
        try {
            Matcher matcher = VIDLINK_EXTRACT_PATTERN.matcher(embedUrl);
            if (!matcher.find()) return false;

            String animeId = matcher.group(1);
            String epNum = matcher.group(2);
            boolean isDub = embedUrl.contains("dub=true");

            String apiUrl = "https://vidlink.pro/api/b/anime/" + animeId + "/" + epNum + "?dub=" + isDub;

            Executors.newSingleThreadExecutor().execute(() -> {
                try {
                    URL u = new URL(apiUrl);
                    HttpURLConnection conn = (HttpURLConnection) u.openConnection();
                    conn.setConnectTimeout(6000);
                    conn.setReadTimeout(6000);
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
                    conn.setRequestProperty("Referer", "https://vidlink.pro/");

                    if (conn.getResponseCode() == 200) {
                        BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = in.readLine()) != null) sb.append(line);
                        in.close();

                        JSONObject json = new JSONObject(sb.toString());
                        String streamFile = json.optString("stream", "");
                        if (streamFile.isEmpty()) streamFile = json.optString("url", "");
                        if (streamFile.isEmpty()) {
                            JSONArray sources = json.optJSONArray("sources");
                            if (sources != null && sources.length() > 0) {
                                streamFile = sources.getJSONObject(0).optString("url", "");
                            }
                        }

                        if (!streamFile.isEmpty() && isDirectMediaStream(streamFile)) {
                            final String finalStream = streamFile;
                            Log.i("AniLove_VidLinkExtract", "Successfully extracted direct Server 1 stream: " + finalStream);
                            runOnUiThread(() -> setupExoPlayerOnlineDirect(finalStream, "https://vidlink.pro/", headers));
                            return;
                        }
                    }
                } catch (Exception e) {
                    Log.d("AniLove_VidLinkExtract", "VidLink direct extract failed, falling back to VideoSniffer: " + e.getMessage());
                }
                runSnifferFallback(embedUrl, referer, headers);
            });
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @UnstableApi
    public void setupExoPlayerOnline(String hlsUrl, String referer, Map<String, String> headers) {
        if (hlsUrl == null || hlsUrl.isEmpty()) return;
        hasRetriedSniffer = false;

        if (!isDirectMediaStream(hlsUrl)) {
            Log.i("AniLove", "Embed page detected — attempting direct extract for: " + hlsUrl);
            if (hlsUrl.contains("vidlink.pro")) {
                if (attemptVidLinkDirectExtract(hlsUrl, referer, headers)) return;
            } else if (hlsUrl.contains("tryembed.us.cc") || hlsUrl.contains("vidnest.fun")) {
                if (attemptServer2DirectExtract(hlsUrl, referer, headers)) return;
            }
            runSnifferFallback(hlsUrl, referer, headers);
            return;
        }

        setupExoPlayerOnlineDirect(hlsUrl, referer, headers);
    }

    private String getUnwrappedProxyUrl(String url) {
        if (url == null) return null;
        if (url.contains("proxy") && url.contains("url=")) {
            try {
                int urlIdx = url.indexOf("url=");
                if (urlIdx != -1) {
                    String target = url.substring(urlIdx + 4);
                    int ampIdx = target.indexOf('&');
                    if (ampIdx != -1) target = target.substring(0, ampIdx);
                    String decoded = URLDecoder.decode(target, StandardCharsets.UTF_8.name());
                    if (decoded != null && decoded.contains(".m3u8")) {
                        Log.i("AniLove", "Unwrapped proxy stream target: " + decoded);
                        return decoded;
                    }
                }
            } catch (Exception ignored) {}
        }
        return url;
    }

    @UnstableApi
    private void setupExoPlayerOnlineDirect(String hlsUrlInput, String referer, Map<String, String> headers) {
        if (hlsUrlInput == null || hlsUrlInput.isEmpty()) return;
        cleanupPlaybackEngines();
        final String hlsUrl = sanitizeStreamUrl(hlsUrlInput);
        currentLoadedStreamUrl = hlsUrl;
        try {
            String effectiveReferer = getBestRefererForUrl(hlsUrl, referer);

            // Set desktop User-Agent to match VideoSniffer so proxy signature (sig) validation passes
            DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                    .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                    .setConnectTimeoutMs(25000)
                    .setReadTimeoutMs(25000)
                    .setAllowCrossProtocolRedirects(true);

            Map<String, String> requestHeaders = new HashMap<>();
            if (!effectiveReferer.trim().isEmpty()) {
                requestHeaders.put("Referer", effectiveReferer);
                if (!hlsUrl.contains(".mp4") && !hlsUrl.contains("hakunaymatata.com") && !hlsUrl.contains("moviebox")) {
                    try {
                        URL refUrl = new URL(effectiveReferer);
                        requestHeaders.put("Origin", refUrl.getProtocol() + "://" + refUrl.getHost());
                    } catch (Exception ignored) {}
                }
            }

            if (!hlsUrl.contains(".mp4") && !hlsUrl.contains("hakunaymatata.com") && !hlsUrl.contains("moviebox")) {
                requestHeaders.put("Accept", "*/*");
                requestHeaders.put("Sec-Fetch-Dest", "empty");
                requestHeaders.put("Sec-Fetch-Mode", "cors");
                requestHeaders.put("Sec-Fetch-Site", "cross-site");
            }

            try {
                String cookieStr = CookieManager.getInstance().getCookie(hlsUrl);
                if (cookieStr != null && !cookieStr.isEmpty()) {
                    requestHeaders.put("Cookie", cookieStr);
                }
            } catch (Exception ignored) {}

            if (headers != null && !headers.isEmpty()) {
                requestHeaders.putAll(headers);
            }
            httpDataSourceFactory.setDefaultRequestProperties(requestHeaders);

            DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                    .setBufferDurationsMs(
                            15000, // Min buffer: 15s
                            50000, // Max buffer: 50s
                            1200,  // Buffer for playback: 1.2s
                            2500   // Buffer for playback after rebuffer: 2.5s
                    )
                    .setPrioritizeTimeOverSizeThresholds(true)
                    .build();

            if (exoPlayer == null) {
                exoPlayer = new ExoPlayer.Builder(this)
                        .setLoadControl(loadControl)
                        .build();
                exoPlayerView.setPlayer(exoPlayer);

                exoPlayer.addListener(new Player.Listener() {
                    @Override
                    public void onIsPlayingChanged(boolean playing) {
                        isPlaying = playing;
                        btnPlayPause.setImageResource(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
                        if (isPlaying) resetHideTimer(); else stopHideTimer();
                    }

                    @Override
                    public void onPlaybackStateChanged(int playbackState) {
                        if (playbackState == Player.STATE_BUFFERING) {
                            if (loadingProgress != null) loadingProgress.setVisibility(View.VISIBLE);
                        } else if (playbackState == Player.STATE_READY) {
                            if (loadingProgress != null) loadingProgress.setVisibility(View.GONE);
                            populateTracksFromExoPlayer();
                            // Ensure player is always interactive once video is ready
                            showControlsExplicitly();
                        } else if (playbackState == Player.STATE_ENDED) {
                            isPlaying = false;
                            btnPlayPause.setImageResource(android.R.drawable.ic_media_play);
                            if (hasNextEpisode && isAdvancePlayerEnabled) {
                                navigateEpisode(true);
                            }
                        }
                    }

                    @Override
                    public void onPlayerError(PlaybackException error) {
                        Log.e("AniLove", "ExoPlayer error (code " + error.errorCode + "): " + error.getMessage(), error);
                        if (loadingProgress != null) loadingProgress.setVisibility(View.GONE);

                        boolean isSourceOrNetworkError = (error.getCause() instanceof IOException) ||
                                                         (error.getCause() instanceof HttpDataSource.HttpDataSourceException) ||
                                                         (error.getCause() instanceof UnrecognizedInputFormatException) ||
                                                         (error.errorCode >= 2000 && error.errorCode <= 2008);

                        boolean isDirect = isDirectMediaStream(currentLoadedStreamUrl) || isDirectMediaStream(currentEmbedUrl) || (currentLoadedStreamUrl != null && currentLoadedStreamUrl.contains(".mp4"));

                        if (isSourceOrNetworkError && !hasRetriedSniffer) {
                            hasRetriedSniffer = true;
                            if (isDirect) {
                                setupExoPlayerOnlineDirect(currentLoadedStreamUrl, getBestRefererForUrl(currentLoadedStreamUrl, null), null);
                            } else if (currentEmbedUrl != null && !currentEmbedUrl.isEmpty()) {
                                runSnifferFallback(currentEmbedUrl, getBestRefererForUrl(currentEmbedUrl, null), null);
                            }
                        }
                    }
                });
            } else {
                exoPlayer.stop();
                exoPlayer.clearMediaItems();
            }

            MediaItem.Builder mediaBuilder = new MediaItem.Builder()
                    .setUri(Uri.parse(hlsUrl))
                    .setMediaId(hlsUrl + "_" + System.currentTimeMillis());

            if (subtitleUrl != null && !subtitleUrl.isEmpty()) {
                MediaItem.SubtitleConfiguration subtitle = new MediaItem.SubtitleConfiguration.Builder(Uri.parse(subtitleUrl))
                        .setMimeType(MimeTypes.TEXT_VTT)
                        .setLanguage("en")
                        .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                        .build();
                mediaBuilder.setSubtitleConfigurations(Collections.singletonList(subtitle));
            }

            MediaSource mediaSource;
            if (hlsUrl.contains(".mp4") || hlsUrl.contains("hakunaymatata.com")) {
                mediaBuilder.setMimeType(MimeTypes.VIDEO_MP4);
                mediaSource = new ProgressiveMediaSource.Factory(httpDataSourceFactory).createMediaSource(mediaBuilder.build());
            } else if (hlsUrl.contains(".m3u8") || hlsUrl.contains("hls") || hlsUrl.contains("m3u")) {
                mediaBuilder.setMimeType(MimeTypes.APPLICATION_M3U8);
                mediaSource = new HlsMediaSource.Factory(httpDataSourceFactory).createMediaSource(mediaBuilder.build());
            } else {
                mediaSource = new DefaultMediaSourceFactory(httpDataSourceFactory).createMediaSource(mediaBuilder.build());
            }

            exoPlayer.setMediaSource(mediaSource, true);
            if (startTime > 0) {
                exoPlayer.seekTo(startTime * 1000L);
            } else {
                exoPlayer.seekTo(0L);
            }
            exoPlayer.prepare();
            exoPlayer.setPlayWhenReady(true);
            if (loadingProgress != null) loadingProgress.setVisibility(View.GONE);
        } catch (Exception e) {
            Log.e("AniLove", "Error setting up Online ExoPlayer", e);
            runSnifferFallback(hlsUrl, referer, headers);
        }
    }



    private void checkAutoNextEpisodeTrigger(long currentMs, long durationMs) {
        if (durationMs <= 0 || isAutoNextCanceled || isAutoNextTriggered) return;
        long remainingMs = durationMs - currentMs;
        if (remainingMs <= 10000 && remainingMs > 0) {
            int remainingSec = (int) Math.ceil(remainingMs / 1000.0);
            runOnUiThread(() -> {
                if (layoutAutoNextToast != null) {
                    if (layoutAutoNextToast.getVisibility() != View.VISIBLE) {
                        layoutAutoNextToast.setAlpha(0f);
                        layoutAutoNextToast.setVisibility(View.VISIBLE);
                        layoutAutoNextToast.animate().alpha(1f).setDuration(250).start();
                    }
                    if (textAutoNextCountdown != null) {
                        textAutoNextCountdown.setText("Next in " + remainingSec + "s");
                    }
                }
            });
            if (remainingMs <= 1200) {
                isAutoNextTriggered = true;
                runOnUiThread(() -> {
                    if (layoutAutoNextToast != null) layoutAutoNextToast.setVisibility(View.GONE);
                    navigateEpisode(true);
                });
            }
        } else if (remainingMs > 10000) {
            runOnUiThread(() -> {
                if (layoutAutoNextToast != null && layoutAutoNextToast.getVisibility() == View.VISIBLE) {
                    layoutAutoNextToast.setVisibility(View.GONE);
                }
            });
        }
    }

    public void updatePosition(int y) {
        if (isFullscreenMode || isOfflineMode) return;
        runOnUiThread(() -> {
            try {
                Window window = getWindow();
                if (window != null) {
                    View decorView = window.getDecorView();
                    if (y < 0) {
                        // Hide native player overlay window when y < 0 (e.g., scrolled off screen)
                        decorView.setVisibility(View.GONE);
                    } else {
                        if (decorView.getVisibility() != View.VISIBLE) {
                            decorView.setVisibility(View.VISIBLE);
                        }
                        View videoRoot = findViewById(R.id.video_root_container);
                        if (videoRoot != null) {
                            videoRoot.setTranslationY(y);
                        }
                    }
                }
            } catch (Exception ignored) {}
        });
    }

    private void updateScrubberPosition(SeekBar s, int progress) {
        scrubberTime.setText(formatTime(progress));
        int width = s.getWidth() - s.getPaddingLeft() - s.getPaddingRight();
        int thumbPos = s.getPaddingLeft() + (width * progress / Math.max(1, s.getMax()));
        float finalX = s.getX() + thumbPos - (scrubberContainer.getWidth() / 2f);
        float screenWidth = getResources().getDisplayMetrics().widthPixels;
        if (finalX < 10) finalX = 10;
        if (finalX > screenWidth - scrubberContainer.getWidth() - 10) finalX = screenWidth - scrubberContainer.getWidth() - 10;
        scrubberContainer.setX(finalX);
        scrubberContainer.setTranslationY(0);
    }

    private boolean isNextEpisodePreFetched = false;

    private void triggerNextEpisodePreFetch() {
        if (isNextEpisodePreFetched) return;
        
        int anilistId = getIntent().getIntExtra("anilistId", 0);
        int currentEp = getIntent().getIntExtra("episodeNumber", 0);
        boolean hasNext = getIntent().getBooleanExtra("hasNext", false);
        String audio = getIntent().getStringExtra("audio");
        String animeTitle = getIntent().getStringExtra("animeTitle");
        
        if (!hasNext || anilistId <= 0 || currentEp <= 0) return;
        
        int nextEp = currentEp + 1;
        if (StreamCache.has(anilistId, nextEp, audio)) {
            isNextEpisodePreFetched = true;
            return;
        }

        isNextEpisodePreFetched = true;
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                // Pre-fetch next episode via MovieBox with AniZip mapping
                AniZipHelper.Mapping mapping = AniZipHelper.getMapping(anilistId);
                String searchTitle = AniZipHelper.getMappedTitle(mapping, animeTitle);
                int searchEp = AniZipHelper.getMappedEpisode(mapping, nextEp);

                String audioParam = audio != null ? audio : "English";
                if ("SUB".equalsIgnoreCase(audioParam)) audioParam = "Japanese";
                else if ("DUB".equalsIgnoreCase(audioParam)) audioParam = "English";

                String apiUrl = "https://moviebox-api-mklm.onrender.com/api/anime/batch-download?title="
                        + URLEncoder.encode(searchTitle, "UTF-8")
                        + "&episodes=" + searchEp
                        + "&se=1&audio=" + URLEncoder.encode(audioParam, "UTF-8")
                        + "&quality=1080p";

                Log.i("AniLove_PreFetch", "Pre-fetching next episode stream for " + searchTitle + " Ep " + searchEp);
                URL url = new URL(apiUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(15000);
                conn.setRequestProperty("Accept", "application/json");
                conn.setRequestProperty("User-Agent", "Mozilla/5.0");

                if (conn.getResponseCode() == 200) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                    br.close();

                    JSONObject resObj = new JSONObject(sb.toString());
                    JSONArray eps = resObj.optJSONArray("episodes");
                    if (eps != null && eps.length() > 0) {
                        JSONObject first = eps.optJSONObject(0);
                        if (first != null) {
                            String mainLink = first.optString("direct_download_url", "");
                            if (!mainLink.isEmpty()) {
                                StreamCache.put(anilistId, nextEp, audio, mainLink);
                                Log.i("AniLove_PreFetch", "Successfully pre-fetched next episode stream for Ep " + nextEp + ": " + mainLink);
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.w("AniLove_PreFetch", "Pre-fetch next episode failed: " + e.getMessage());
            }
        });
    }

    private boolean isAudioLanguageMatch(String lang, String target) {
        if (lang == null || target == null) return false;
        String l = lang.toLowerCase();
        String t = target.toLowerCase();
        if (t.contains("hin") && l.contains("hin")) return true;
        if (t.contains("tam") && l.contains("tam")) return true;
        if (t.contains("tel") && l.contains("tel")) return true;
        if (t.contains("mal") && l.contains("mal")) return true;
        if (t.contains("kan") && l.contains("kan")) return true;
        if (t.contains("ben") && l.contains("ben")) return true;
        if ((t.contains("eng") || t.contains("dub")) && (l.contains("eng") || l.contains("dub") || l.contains("english"))) return true;
        if ((t.contains("jap") || t.contains("sub")) && (l.contains("jap") || l.contains("sub") || l.contains("japanese"))) return true;
        return false;
    }

    @UnstableApi
    private void changeVideoQuality(String quality) {
        currentSelectedQuality = quality;
        NativePlayerPlugin.notifyQualityChange(quality);

        if (!activeLanguageQualityMap.isEmpty()) {
            Map<String, String> qualitiesForLang = activeLanguageQualityMap.get(currentSelectedAudio);
            if (qualitiesForLang == null) {
                for (String k : activeLanguageQualityMap.keySet()) {
                    if (isAudioLanguageMatch(k, currentSelectedAudio)) {
                        qualitiesForLang = activeLanguageQualityMap.get(k);
                        break;
                    }
                }
            }

            if (qualitiesForLang != null) {
                String newUrl = qualitiesForLang.get(quality);
                if (newUrl != null && !newUrl.isEmpty() && !newUrl.equalsIgnoreCase(currentLoadedStreamUrl)) {
                    long currentPosMs = (exoPlayer != null) ? exoPlayer.getCurrentPosition() : 0;
                    Toast.makeText(this, "Quality: " + quality, Toast.LENGTH_SHORT).show();

                    currentEmbedUrl = newUrl;

                    setupExoPlayerOnlineDirect(newUrl, "https://netfilm.world/", null);
                    if (exoPlayer != null && currentPosMs > 0) {
                        exoPlayer.seekTo(currentPosMs);
                    }
                    return;
                }
            }
        }

        if (exoPlayer == null) return;
        try {
            int targetHeight = -1;
            String lower = quality.toLowerCase();
            if (lower.contains("1080")) targetHeight = 1080;
            else if (lower.contains("720")) targetHeight = 720;
            else if (lower.contains("480")) targetHeight = 480;
            else if (lower.contains("360")) targetHeight = 360;

            TrackSelectionParameters builder = exoPlayer.getTrackSelectionParameters()
                    .buildUpon()
                    .setMaxVideoSize(1920, targetHeight > 0 ? targetHeight : 4000)
                    .build();
            exoPlayer.setTrackSelectionParameters(builder);
            Toast.makeText(this, "Quality: " + quality, Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Log.e("AniLove", "Error changing video quality", e);
        }
    }

    @UnstableApi
    private void changeAudioLanguage(String audioLang) {
        currentSelectedAudio = audioLang;
        updateAudioBadge(audioLang);
        NativePlayerPlugin.notifyLanguageChange(audioLang);

        String embedUrl = currentEmbedUrl != null ? currentEmbedUrl : "";
        String srv = (currentActiveServerName != null ? currentActiveServerName : "") + " " + (currentActiveSourceName != null ? currentActiveSourceName : "");
        String srvLower = srv.toLowerCase();
        String embedLower = embedUrl.toLowerCase();
        String combined = srvLower + " " + embedLower;

        // 1. Multi-Lang (MovieBox) direct URL quality/language map switching
        if (!activeLanguageQualityMap.isEmpty()) {
            Map<String, String> qualitiesForLang = activeLanguageQualityMap.get(audioLang);
            if (qualitiesForLang == null) {
                for (String k : activeLanguageQualityMap.keySet()) {
                    if (isAudioLanguageMatch(k, audioLang)) {
                        qualitiesForLang = activeLanguageQualityMap.get(k);
                        break;
                    }
                }
            }

            if (qualitiesForLang != null && !qualitiesForLang.isEmpty()) {
                detectedQualities = new ArrayList<>(qualitiesForLang.keySet());

                String newUrl = qualitiesForLang.get(currentSelectedQuality);
                if (newUrl == null || newUrl.isEmpty()) {
                    String[] order = {"1080p", "720p", "480p", "360p"};
                    for (String r : order) {
                        if (qualitiesForLang.containsKey(r)) {
                            newUrl = qualitiesForLang.get(r);
                            currentSelectedQuality = r;
                            break;
                        }
                    }
                    if (newUrl == null) {
                        newUrl = qualitiesForLang.values().iterator().next();
                    }
                }

                if (newUrl != null && !newUrl.isEmpty()) {
                    long currentPosMs = (exoPlayer != null) ? exoPlayer.getCurrentPosition() : 0;
                    Toast.makeText(this, "Switching audio to " + audioLang + "...", Toast.LENGTH_SHORT).show();

                    currentEmbedUrl = newUrl;

                    setupExoPlayerOnlineDirect(newUrl, "https://netfilm.world/", null);
                    if (exoPlayer != null && currentPosMs > 0) {
                        exoPlayer.seekTo(currentPosMs);
                    }
                    return;
                }
            }
        }

        // 2. HiAnime / TryEmbed / VidNest dynamic URL audio switching (sub vs dub)
        if (combined.contains("hianime") || combined.contains("vidnest") || combined.contains("tryembed")) {
            String lower = audioLang.toLowerCase();
            boolean wantsSub = lower.contains("jap") || lower.contains("sub") || lower.contains("japanese");
            boolean wantsDub = lower.contains("eng") || lower.contains("dub") || lower.contains("english");

            if (!embedUrl.isEmpty()) {
                String newEmbedUrl = embedUrl;
                if (wantsSub && newEmbedUrl.contains("/dub")) {
                    newEmbedUrl = newEmbedUrl.replace("/dub", "/sub");
                } else if (wantsDub && newEmbedUrl.contains("/sub")) {
                    newEmbedUrl = newEmbedUrl.replace("/sub", "/dub");
                }

                if (!newEmbedUrl.equalsIgnoreCase(embedUrl)) {
                    currentEmbedUrl = newEmbedUrl;
                    Toast.makeText(this, "Switching audio to " + (wantsSub ? "Japanese Sub" : "English Dub") + "...", Toast.LENGTH_SHORT).show();
                    setupExoPlayerOnline(newEmbedUrl, getBestRefererForUrl(newEmbedUrl, null), null);
                    return;
                }
            }
        }

        // 3. PirateXPlay Multi-Audio Proxy switching
        if (combined.contains("multi.php?data=") || combined.contains("piratexplay")) {
            if (embedUrl.contains("data=")) {
                try {
                    int dataIdx = embedUrl.indexOf("data=");
                    String encoded = embedUrl.substring(dataIdx + 5);
                    int amp = encoded.indexOf('&');
                    if (amp != -1) encoded = encoded.substring(0, amp);
                    String jsonStr = new String(Base64.decode(encoded, Base64.DEFAULT), "UTF-8");
                    JSONArray arr = new JSONArray(jsonStr);

                    String targetLangReq = audioLang.toLowerCase();
                    for (int i = 0; i < arr.length(); i++) {
                        JSONObject item = arr.getJSONObject(i);
                        String lang = item.optString("language", "").toLowerCase();
                        if (isAudioLanguageMatch(lang, targetLangReq)) {
                            String targetLink = item.optString("link", "");
                            if (targetLink.contains("short.icu/")) {
                                targetLink = targetLink.replace("short.icu/", "abyssplayer.com/");
                            }
                            if (!targetLink.isEmpty()) {
                                Toast.makeText(this, "Switching audio stream to " + audioLang + "...", Toast.LENGTH_SHORT).show();
                                setupExoPlayerOnline(targetLink, getBestRefererForUrl(targetLink, null), null);
                                return;
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.w("AniLove", "Error unpacking multi-audio link: " + e.getMessage());
                }
            }
        }

        // 4. Standard ExoPlayer Track Selection
        if (exoPlayer == null) return;
        try {
            String targetLangCode = "en";
            String lower = audioLang.toLowerCase();
            if (lower.contains("jap") || lower.contains("sub") || lower.contains("japanese")) targetLangCode = "ja";
            else if (lower.contains("hin") || lower.contains("hindi")) targetLangCode = "hi";
            else if (lower.contains("tam") || lower.contains("tamil")) targetLangCode = "ta";
            else if (lower.contains("tel") || lower.contains("telugu")) targetLangCode = "te";
            else if (lower.contains("mal") || lower.contains("malayalam")) targetLangCode = "ml";
            else if (lower.contains("kan") || lower.contains("kannada")) targetLangCode = "kn";
            else if (lower.contains("ben") || lower.contains("bengali")) targetLangCode = "bn";

            TrackSelectionParameters builder = exoPlayer.getTrackSelectionParameters()
                    .buildUpon()
                    .setPreferredAudioLanguage(targetLangCode)
                    .build();
            exoPlayer.setTrackSelectionParameters(builder);

            NativePlayerPlugin.notifyLanguageChange(audioLang);
            Toast.makeText(this, "Audio: " + audioLang, Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Log.e("AniLove", "Error changing audio language", e);
        }
    }

    @UnstableApi
    private void populateTracksFromExoPlayer() {
        if (exoPlayer == null) return;
        try {
            Tracks tracks = exoPlayer.getCurrentTracks();
            List<String> qualities = new ArrayList<>();
            List<String> audios = new ArrayList<>();

            for (Tracks.Group group : tracks.getGroups()) {
                int trackType = group.getType();
                for (int i = 0; i < group.length; i++) {
                    Format format = group.getTrackFormat(i);
                    if (trackType == C.TRACK_TYPE_VIDEO) {
                        if (format.height > 0) {
                            String q = format.height + "p";
                            if (!qualities.contains(q)) qualities.add(q);
                        }
                    } else if (trackType == C.TRACK_TYPE_AUDIO) {
                        String lang = format.language;
                        String label = format.label;
                        String name = (label != null && !label.isEmpty()) ? label : (lang != null && !lang.equalsIgnoreCase("und") ? lang : "");
                        if (!name.isEmpty() && !name.equalsIgnoreCase("und") && !audios.contains(name)) {
                            audios.add(name);
                        }
                    }
                }
            }

            if (!qualities.isEmpty() && detectedQualities.isEmpty()) {
                if (!qualities.contains("Auto")) qualities.add(0, "Auto");
                detectedQualities = qualities;
            }
            if (!audios.isEmpty() && (detectedAudios.isEmpty() || (detectedAudios.size() == 1 && detectedAudios.get(0).equalsIgnoreCase("und")))) {
                detectedAudios = audios;
            }
        } catch (Exception ignored) {}
    }

    private void changeSubtitleTrack(String subTrack) {
        if (subTrack == null || subTrack.equalsIgnoreCase("Off")) {
            parsedVttCues.clear();
            currentSelectedSubtitle = "Off";
            saveCaptionSettingsToPrefs();
            runOnUiThread(() -> {
                TextView textOverlay = findViewById(R.id.text_native_subtitle_overlay);
                if (textOverlay != null) textOverlay.setVisibility(View.GONE);
            });
            return;
        }

        String targetVttUrl = capturedServer2BSubtitles.get(subTrack);
        if (targetVttUrl != null && !targetVttUrl.isEmpty()) {
            subtitleUrl = targetVttUrl;
            subtitleLang = subTrack;
            currentSelectedSubtitle = subTrack;
            saveCaptionSettingsToPrefs();
            downloadAndParseVttFile(targetVttUrl);
            Log.i("CaptionSwitch", "Switched native subtitle track to: " + subTrack + " (" + targetVttUrl + ")");
        }
    }

    private boolean isAudioMatch(String opt, String target) {
        if (opt == null || target == null) return false;
        String o = opt.toLowerCase();
        String t = target.toLowerCase();
        if (Objects.equals(o, t)) return true;
        if (t.contains("hin") && o.contains("hin")) return true;
        if ((t.contains("eng") || t.contains("dub")) && (o.contains("eng") || o.contains("dub"))) return true;
        if ((t.contains("jpn") || t.contains("sub") || t.contains("jap")) && (o.contains("jpn") || o.contains("sub") || o.contains("jap"))) return true;
        if (t.contains("tam") && o.contains("tam")) return true;
        if (t.contains("tel") && o.contains("tel")) return true;
        if (t.contains("mal") && o.contains("mal")) return true;
        if (t.contains("kan") && o.contains("kan")) return true;
        return t.contains("ben") && o.contains("ben");
    }

    private void updateAudioBadge(String audioText) {
        runOnUiThread(() -> {
            TextView portraitBadge = findViewById(R.id.portrait_badge_audio);
            if (portraitBadge != null) {
                portraitBadge.setText(audioText.toUpperCase());
            }
        });
    }

    private void showSeekIndicator(boolean forward) {
        final TextView indicator = forward ? indicatorForward : indicatorRewind;
        if (indicator == null) return;
        indicator.setText(forward ? "10s ►►" : "◄◄ 10s");
        indicator.animate().cancel();
        indicator.setAlpha(0f);
        indicator.setScaleX(0.7f);
        indicator.setScaleY(0.7f);
        indicator.setVisibility(View.VISIBLE);
        indicator.animate()
                .alpha(1f)
                .scaleX(1.05f)
                .scaleY(1.05f)
                .setDuration(120)
                .withEndAction(() -> indicator.animate()
                        .scaleX(1.0f)
                        .scaleY(1.0f)
                        .setDuration(80)
                        .withEndAction(() -> new Handler(Looper.getMainLooper()).postDelayed(() -> indicator.animate()
                                .alpha(0f)
                                .scaleX(0.7f)
                                .scaleY(0.7f)
                                .setDuration(180)
                                .withEndAction(() -> indicator.setVisibility(View.GONE))
                                .start(), 450)).start()).start();
    }

    private void togglePlayPause() {
        if (exoPlayer != null) {
            if (exoPlayer.isPlaying()) {
                exoPlayer.pause();
                isPlaying = false;
                if (btnPlayPause != null) btnPlayPause.setImageResource(android.R.drawable.ic_media_play);
                stopHideTimer();
            } else {
                exoPlayer.play();
                isPlaying = true;
                if (btnPlayPause != null) btnPlayPause.setImageResource(android.R.drawable.ic_media_pause);
                resetHideTimer();
            }
        }
    }

    private void toggleControlsVisibility() { isControlsVisible = !isControlsVisible; controlsOverlay.setVisibility(isControlsVisible ? View.VISIBLE : View.GONE); if (isControlsVisible) resetHideTimer(); }
    private void showControlsExplicitly() { isControlsVisible = true; if (controlsOverlay != null) controlsOverlay.setVisibility(View.VISIBLE); resetHideTimer(); }
    private void hideControlsQuietly() { isControlsVisible = false; controlsOverlay.setVisibility(View.GONE); stopHideTimer(); }
    private void resetHideTimer() { stopHideTimer(); if (isPlaying && isControlsVisible && !isDragging) { hideHandler.postDelayed(() -> { if (isControlsVisible && isPlaying) { isControlsVisible = false; controlsOverlay.setVisibility(View.GONE); } }, 5000); } }
    private void stopHideTimer() { hideHandler.removeCallbacksAndMessages(null); }

    private void enterPipMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                hideControlsQuietly();

                // Explicitly reset window layout parameters to full window to avoid PiP offset clipping
                Window window = getWindow();
                if (window != null) {
                    WindowManager.LayoutParams lp = window.getAttributes();
                    lp.width = WindowManager.LayoutParams.MATCH_PARENT;
                    lp.height = WindowManager.LayoutParams.MATCH_PARENT;
                    lp.gravity = Gravity.FILL;
                    lp.x = 0;
                    lp.y = 0;
                    window.setAttributes(lp);
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        unregisterReceiver(pipReceiver);
                    } catch (Exception ignored) {}
                    
                    ContextCompat.registerReceiver(this, pipReceiver, new IntentFilter("ACTION_PIP_CONTROL"), ContextCompat.RECEIVER_EXPORTED);
                    updatePipParams();

                    PictureInPictureParams.Builder pipBuilder = new PictureInPictureParams.Builder()
                            .setAspectRatio(new Rational(16, 9));

                    enterPictureInPictureMode(pipBuilder.build());
                } else {
                    enterPictureInPictureMode();
                }
            } catch (Exception e) {
                Log.e("AniLove", "Failed to enter PiP mode", e);
            }
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        
        final View statusBarFiller = findViewById(R.id.status_bar_filler);
        final View bottomGapFiller = findViewById(R.id.bottom_gap_filler);
        final View portraitBottom = findViewById(R.id.portrait_bottom_container);
        final View videoRoot = findViewById(R.id.video_root_container);
        final View topBar = findViewById(R.id.top_bar);
        final View touchWall = findViewById(R.id.touch_wall);

        if (isInPictureInPictureMode) {
            hideControlsQuietly();
            if (touchWall != null) touchWall.setVisibility(View.GONE);

            Window window = getWindow();
            if (window != null) {
                WindowManager.LayoutParams lp = window.getAttributes();
                lp.width = WindowManager.LayoutParams.MATCH_PARENT;
                lp.height = WindowManager.LayoutParams.MATCH_PARENT;
                lp.gravity = Gravity.FILL;
                lp.x = 0;
                lp.y = 0;
                window.setAttributes(lp);
            }
            
            if (statusBarFiller != null) statusBarFiller.setVisibility(View.GONE);
            if (bottomGapFiller != null) bottomGapFiller.setVisibility(View.GONE);
            if (portraitBottom != null) portraitBottom.setVisibility(View.GONE);
            if (videoRoot != null) {
                ViewGroup.LayoutParams lp = videoRoot.getLayoutParams();
                lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
                videoRoot.setLayoutParams(lp);
            }
        } else {
            if (touchWall != null) touchWall.setVisibility(View.VISIBLE);
            if (topBar != null) topBar.setVisibility(View.VISIBLE);
            try {
                unregisterReceiver(pipReceiver);
            } catch (Exception ignored) {}

            applyWindowSettings(getIntent());
            hideControlsQuietly();
        }
    }

    @UnstableApi
    private void showSettingsMenu() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        View view = getLayoutInflater().inflate(R.layout.settings_bottom_sheet, findViewById(android.R.id.content), false);
        dialog.setContentView(view);
        BottomSheetBehavior<?> behavior = BottomSheetBehavior.from((View) view.getParent());
        behavior.setState(BottomSheetBehavior.STATE_EXPANDED);

        String srvLower = (currentActiveServerName != null ? currentActiveServerName : "").toLowerCase();
        String srcLower = (currentActiveSourceName != null ? currentActiveSourceName : "").toLowerCase();
        String embedLower = (currentEmbedUrl != null ? currentEmbedUrl : "").toLowerCase();
        String loadedLower = (currentLoadedStreamUrl != null ? currentLoadedStreamUrl : "").toLowerCase();
        String combinedCheck = srcLower + " " + srvLower + " " + embedLower + " " + loadedLower;

        boolean isHiAnime = combinedCheck.contains("hianime") || combinedCheck.contains("vidnest") || combinedCheck.contains("tryembed");
        boolean isAnimeSalt = combinedCheck.contains("animesalt");
        boolean isMultiLang = combinedCheck.contains("multi-lang") || combinedCheck.contains("multilang") || combinedCheck.contains("moviebox") || combinedCheck.contains("hakunaymatata") || combinedCheck.contains("netfilm");

        // 1. Dynamic Video Quality Buttons
        LinearLayout qualityContainer = view.findViewById(R.id.quality_container);
        if (qualityContainer != null) {
            qualityContainer.removeAllViews();
            List<String> qList = new ArrayList<>();
            if (isHiAnime || isAnimeSalt) {
                qList.add("1080p");
            } else if (isMultiLang) {
                if (!detectedQualities.isEmpty()) {
                    qList.addAll(detectedQualities);
                } else {
                    qList.add("1080p");
                    qList.add("720p");
                    qList.add("480p");
                    qList.add("360p");
                }
            } else {
                if (!detectedQualities.isEmpty()) {
                    qList.addAll(detectedQualities);
                } else {
                    qList.add("Auto");
                    qList.add("1080p");
                    qList.add("720p");
                    qList.add("480p");
                    qList.add("360p");
                }
            }

            for (String q : qList) {
                TextView btn = new TextView(this);
                btn.setText(q);
                btn.setPadding(32, 12, 32, 12);
                btn.setTextSize(12);
                btn.setGravity(Gravity.CENTER);
                btn.setMinWidth(110);
                highlightButton(btn, q.equalsIgnoreCase(currentSelectedQuality));
                btn.setOnClickListener(v -> {
                    currentSelectedQuality = q;
                    changeVideoQuality(q);
                    for (int i = 0; i < qualityContainer.getChildCount(); i++) {
                        View child = qualityContainer.getChildAt(i);
                        if (child instanceof TextView) {
                            highlightButton((TextView) child, ((TextView) child).getText().toString().equalsIgnoreCase(q));
                        }
                    }
                });
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lp.setMargins(0, 0, 16, 0);
                qualityContainer.addView(btn, lp);
            }
        }

        // 2. Dynamic Audio Language Buttons
        LinearLayout audioContainer = view.findViewById(R.id.audio_container);
        if (audioContainer != null) {
            audioContainer.removeAllViews();
            List<String> aList = new ArrayList<>();
            if (isHiAnime) {
                aList.add("JAP (Sub)");
                aList.add("ENG (Dub)");
            } else if (isAnimeSalt) {
                aList.add("JAP (Sub)");
            } else if (isMultiLang) {
                if (!detectedAudios.isEmpty()) {
                    aList.addAll(detectedAudios);
                } else {
                    aList.add("JAP (Sub)");
                    aList.add("ENG (Dub)");
                }
            } else {
                if (!detectedAudios.isEmpty()) {
                    aList.addAll(detectedAudios);
                } else {
                    aList.add("ENG (Dub)");
                    aList.add("JAP (Sub)");
                    aList.add("Hindi");
                    aList.add("Tamil");
                    aList.add("Telugu");
                }
            }

            for (String a : aList) {
                TextView btn = new TextView(this);
                btn.setText(a);
                btn.setPadding(32, 12, 32, 12);
                btn.setTextSize(12);
                btn.setGravity(Gravity.CENTER);
                btn.setMinWidth(110);
                highlightButton(btn, isAudioMatch(a, currentSelectedAudio));
                btn.setOnClickListener(v -> {
                    currentSelectedAudio = a;
                    changeAudioLanguage(a);
                    updateAudioBadge(a);
                    for (int i = 0; i < audioContainer.getChildCount(); i++) {
                        View child = audioContainer.getChildAt(i);
                        if (child instanceof TextView) {
                            highlightButton((TextView) child, ((TextView) child).getText().toString().equalsIgnoreCase(a));
                        }
                    }
                });
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lp.setMargins(0, 0, 16, 0);
                audioContainer.addView(btn, lp);
            }
        }

        // 3. Playback Speed Buttons
        TextView[] speedBtns = { view.findViewById(R.id.speed_btn_05), view.findViewById(R.id.speed_btn_1), view.findViewById(R.id.speed_btn_125), view.findViewById(R.id.speed_btn_15), view.findViewById(R.id.speed_btn_2) };
        float[] speeds = {0.5f, 1.0f, 1.25f, 1.5f, 2.0f};
        for (int i = 0; i < speedBtns.length; i++) { 
            final float speedVal = speeds[i]; 
            final TextView btn = speedBtns[i]; 
            highlightButton(btn, currentPermanentSpeed == speedVal); 
            btn.setOnClickListener(v -> { 
                currentPermanentSpeed = speedVal; 
                setPlaybackSpeed(speedVal, true); 
                for (TextView b : speedBtns) highlightButton(b, b == btn); 
            }); 
        }

        // 4. Subtitles Customizer Link
        View btnOpenCaptions = view.findViewById(R.id.btn_open_captions_sheet);
        if (btnOpenCaptions != null) {
            btnOpenCaptions.setOnClickListener(v -> {
                dialog.dismiss();
                showCaptionMenu();
            });
        }

        // 5. Volume Booster
        SwitchCompat switchBoost = view.findViewById(R.id.switch_volume_boost); 
        if (switchBoost != null) {
            switchBoost.setChecked(isVolumeBoosted); 
            switchBoost.setOnCheckedChangeListener((b, checked) -> { isVolumeBoosted = checked; applyVolumeBoost(checked); });
        }

        // 6. Player Engine Switch (ExoPlayer <-> Web Player)
        SwitchCompat switchEngine = view.findViewById(R.id.switch_player_engine);
        if (switchEngine != null) {
            switchEngine.setChecked(isWebViewPlayerMode);
            switchEngine.setOnCheckedChangeListener((b, checked) -> {
                dialog.dismiss();
                switchPlayerEngine(checked);
            });
        }

        dialog.show();
    }

    public void switchPlayerEngine(boolean useWebView) {
        isWebViewPlayerMode = useWebView;
        VideoSniffer.cancelActiveSniffers();
        if (useWebView) {
            ensureWebViewInitialized();
        }
        runOnUiThread(() -> {
            View touchWall = findViewById(R.id.touch_wall);
            View topBar = findViewById(R.id.top_center_button_bar);
            if (topBar != null) topBar.bringToFront();

            TextView btnEngine = findViewById(R.id.btn_engine_toggle);
            if (btnEngine != null) {
                btnEngine.setText(useWebView ? "🌐 Web" : "⚡ Exo");
                btnEngine.setTextColor(useWebView ? Color.parseColor("#38BDF8") : Color.parseColor("#34D399"));
            }

            if (useWebView) {
                if (exoPlayer != null) {
                    try {
                        exoPlayer.pause();
                        exoPlayer.setPlayWhenReady(false);
                    } catch (Exception ignored) {}
                }
                if (exoPlayerView != null) exoPlayerView.setVisibility(View.GONE);
                if (playerWebView != null) {
                    playerWebView.setVisibility(View.VISIBLE);
                    playerWebView.bringToFront();
                    if (topBar != null) topBar.bringToFront();
                    TextView textOverlay = findViewById(R.id.text_native_subtitle_overlay);
                    if (textOverlay != null) textOverlay.bringToFront();

                    String targetUrl = (currentEmbedUrl != null && !currentEmbedUrl.trim().isEmpty()) ? currentEmbedUrl : currentLoadedStreamUrl;
                    if (targetUrl != null && !targetUrl.trim().isEmpty()) {
                        Log.i("AniLove_Engine", "Switching to Embedded Web View Player -> " + targetUrl);
                        if (isDirectMediaStream(targetUrl) || targetUrl.toLowerCase().contains(".mp4")) {
                            String videoHtml = "<!DOCTYPE html>" +
                                    "<html><head><meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                                    "<style>html,body{margin:0;padding:0;width:100%;height:100%;background:#000;}video{width:100%;height:100vh;object-fit:contain;}</style>" +
                                    "</head><body>" +
                                    "<video src='" + targetUrl.replace("'", "\\'") + "' controls autoplay playsinline style='width:100%;height:100vh;'></video>" +
                                    "</body></html>";
                            playerWebView.loadDataWithBaseURL(targetUrl, videoHtml, "text/html", "UTF-8", null);
                        } else {
                            playerWebView.loadUrl(targetUrl);
                        }
                    }
                }
                if (touchWall != null) {
                    touchWall.setVisibility(View.GONE);
                    touchWall.setClickable(false);
                }
                if (controlsOverlay != null) {
                    controlsOverlay.setVisibility(View.GONE);
                }
                if (loadingProgress != null) loadingProgress.setVisibility(View.GONE);
                Toast.makeText(this, "Switched to Web Player Mode", Toast.LENGTH_SHORT).show();
            } else {
                if (playerWebView != null) {
                    playerWebView.setVisibility(View.GONE);
                    playerWebView.loadUrl("about:blank");
                }
                if (exoPlayerView != null) exoPlayerView.setVisibility(View.VISIBLE);
                if (touchWall != null) {
                    touchWall.setVisibility(View.VISIBLE);
                    touchWall.setClickable(true);
                }
                if (controlsOverlay != null) {
                    controlsOverlay.setVisibility(View.VISIBLE);
                }
                if (exoPlayer != null) {
                    try {
                        exoPlayer.play();
                        exoPlayer.setPlayWhenReady(true);
                    } catch (Exception ignored) {}
                }
                showControlsExplicitly();
                Toast.makeText(this, "Switched to Media3 ExoPlayer Mode", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void injectAdEraserScript(WebView view) {
        if (view == null) return;
        String js =
            "(function() {" +
            "  try {" +
            "    window.open = function() { console.log('Blocked popup window.open'); return null; };" +
            "    var bads = document.querySelectorAll('a[target=\"_blank\"], a[href*=\"pemsrv\"], a[href*=\"exoclick\"], a[href*=\"pop\"], div[style*=\"z-index: 2147483647\"], iframe[src*=\"ad\"]');" +
            "    for (var i = 0; i < bads.length; i++) { bads[i].remove(); }" +
            "  } catch(e) {}" +
            "  function autoTrigger(win) {" +
            "    try {" +
            "      if (!win.document) return;" +
            "      var vids = win.document.querySelectorAll('video');" +
            "      for (var i = 0; i < vids.length; i++) {" +
            "        var v = vids[i];" +
            "        v.muted = false;" +
            "        v.autoplay = true;" +
            "        v.play().catch(function(){});" +
            "        if (!v.__anilove_tracked) {" +
            "          v.__anilove_tracked = true;" +
            "          v.addEventListener('timeupdate', function() {" +
            "            try {" +
            "              if (window.AniLoveWebPlayerBridge) {" +
            "                window.AniLoveWebPlayerBridge.onTimeUpdate(this.currentTime);" +
            "              }" +
            "            } catch(e) {}" +
            "          });" +
            "        }" +
            "      }" +
            "      var btns = win.document.querySelectorAll('button, .play-btn, .play, #playback, .vjs-big-play-button, .jw-display-icon, div[class*=\"play\"]');" +
            "      for (var j = 0; j < btns.length; j++) {" +
            "        try { btns[j].click(); } catch(e){}" +
            "      }" +
            "    } catch(e) {}" +
            "    try {" +
            "      for (var k = 0; k < win.frames.length; k++) {" +
            "        autoTrigger(win.frames[k]);" +
            "      }" +
            "    } catch(e) {}" +
            "  }" +
            "  autoTrigger(window);" +
            "  setTimeout(function(){ autoTrigger(window); }, 300);" +
            "  setTimeout(function(){ autoTrigger(window); }, 800);" +
            "  setTimeout(function(){ autoTrigger(window); }, 1500);" +
            "})();";
        view.evaluateJavascript(js, null);
    }

    private void showCaptionMenu() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        View view = getLayoutInflater().inflate(R.layout.layout_caption_customization, findViewById(android.R.id.content), false);
        dialog.setContentView(view);
        
        final View[] groups = {
            view.findViewById(R.id.preview_container),
            (View) view.findViewById(R.id.group_bg_opacity).getParent(),
            (View) view.findViewById(R.id.group_bg_color).getParent(),
            (View) view.findViewById(R.id.group_text_size).getParent(),
            (View) view.findViewById(R.id.group_text_weight).getParent(),
            (View) view.findViewById(R.id.group_position).getParent(),
            (View) view.findViewById(R.id.group_margin).getParent(),
            (View) view.findViewById(R.id.group_text_color).getParent(),
            (View) view.findViewById(R.id.group_edge_style).getParent()
        };
        
        final LinearLayout mainLayout = (LinearLayout) view.findViewById(R.id.group_bg_opacity).getParent().getParent();

        Runnable updateVisibility = () -> {
            int vis = isSubtitlesEnabled ? View.VISIBLE : View.GONE;
            for (View g : groups) if (g != null) g.setVisibility(vis);
            for (int i = 0; i < mainLayout.getChildCount(); i++) {
                View child = mainLayout.getChildAt(i);
                if (child instanceof TextView) {
                    String text = ((TextView)child).getText().toString();
                    if (text.matches(".*[A-Z]{3,}.*") && !"SHOW SUBTITLES".equals(text)) {
                        child.setVisibility(vis);
                    }
                }
            }
        };

        SwitchCompat switchSubs = view.findViewById(R.id.switch_subtitles); 
        if (switchSubs != null) {
            switchSubs.setChecked(isSubtitlesEnabled); 
            switchSubs.setOnCheckedChangeListener((b, checked) -> { 
                isSubtitlesEnabled = checked; 
                toggleWebSubtitles(checked); 
                updateVisibility.run();
            });
        }

        // Setup Subtitle Track group if multiple detected
        LinearLayout groupTrack = view.findViewById(R.id.group_caption_track);
        TextView labelTrack = view.findViewById(R.id.label_caption_track);
        View scrollTrack = view.findViewById(R.id.scroll_caption_track);

        if (groupTrack != null && labelTrack != null && scrollTrack != null) {
            Set<String> subSet = new LinkedHashSet<>();
            subSet.add("Off");

            // Always put English at front (#1), then English 2 second (#2) if available
            if (capturedServer2BSubtitles.containsKey("English")) {
                subSet.add("English");
            }
            if (capturedServer2BSubtitles.containsKey("English 2")) {
                subSet.add("English 2");
            }

            for (String lang : capturedServer2BSubtitles.keySet()) {
                if (lang != null && !lang.trim().isEmpty() && !lang.equalsIgnoreCase("Off") && !lang.equalsIgnoreCase("ID3 Metadata")) {
                    subSet.add(lang);
                }
            }

            for (String s : detectedSubtitles) {
                if (s != null && !s.equalsIgnoreCase("ID3 Metadata") && !s.equalsIgnoreCase("Off") && !s.trim().isEmpty()) {
                    subSet.add(s);
                }
            }

            List<String> subList = new ArrayList<>(subSet);
            if (subList.size() > 1) {
                labelTrack.setVisibility(View.VISIBLE);
                scrollTrack.setVisibility(View.VISIBLE);
                setupCaptionGroup(groupTrack, subList.toArray(new String[0]), currentSelectedSubtitle, val -> {
                    currentSelectedSubtitle = val;
                    if (val.equalsIgnoreCase("Off")) {
                        toggleWebSubtitles(false);
                    } else {
                        toggleWebSubtitles(true);
                        changeSubtitleTrack(val);
                    }
                });
            } else {
                labelTrack.setVisibility(View.GONE);
                scrollTrack.setVisibility(View.GONE);
            }
        }

        // Setup Subtitle Appearance Timing Stepper Control
        TextView textSubTimingCenter = view.findViewById(R.id.text_sub_timing_center);
        TextView btnSubMinus1 = view.findViewById(R.id.btn_sub_minus_1);
        TextView btnSubMinus01 = view.findViewById(R.id.btn_sub_minus_01);
        TextView btnSubPlus01 = view.findViewById(R.id.btn_sub_plus_01);
        TextView btnSubPlus1 = view.findViewById(R.id.btn_sub_plus_1);

        Runnable updateTimingBadge = () -> {
            if (textSubTimingCenter != null) {
                String str = (subtitleTimingOffset >= 0 ? "+" : "") + String.format(Locale.US, "%.1fs", subtitleTimingOffset);
                if (Math.abs(subtitleTimingOffset) < 0.05) str = "0.0s";
                textSubTimingCenter.setText(str);
            }
        };

        updateTimingBadge.run();

        if (btnSubMinus1 != null) {
            btnSubMinus1.setOnClickListener(v -> {
                saveEpisodeSubOffset(subtitleTimingOffset - 1.0);
                updateTimingBadge.run();
            });
        }
        if (btnSubMinus01 != null) {
            btnSubMinus01.setOnClickListener(v -> {
                saveEpisodeSubOffset(subtitleTimingOffset - 0.1);
                updateTimingBadge.run();
            });
        }
        if (btnSubPlus01 != null) {
            btnSubPlus01.setOnClickListener(v -> {
                saveEpisodeSubOffset(subtitleTimingOffset + 0.1);
                updateTimingBadge.run();
            });
        }
        if (btnSubPlus1 != null) {
            btnSubPlus1.setOnClickListener(v -> {
                saveEpisodeSubOffset(subtitleTimingOffset + 1.0);
                updateTimingBadge.run();
            });
        }

        captionPreview = view.findViewById(R.id.caption_preview);
        setupCaptionGroup(view.findViewById(R.id.group_bg_opacity), new String[]{"Off", "25%", "40%", "60%", "80%", "100%"}, bgOpacity, val -> { bgOpacity = val; updatePreviewSet(); applyCaptionStyle(); saveCaptionSettingsToPrefs(); });
        setupCaptionGroup(view.findViewById(R.id.group_bg_color), new String[]{"Black", "Gray", "Navy", "White"}, bgColor, val -> { bgColor = val; updatePreviewSet(); applyCaptionStyle(); saveCaptionSettingsToPrefs(); });
        setupCaptionGroup(view.findViewById(R.id.group_text_size), new String[]{"50%", "75%", "90%", "100%", "115%", "150%", "200%"}, captionFontSize + "%", val -> { captionFontSize = Integer.parseInt(val.replace("%", "")); updatePreviewSet(); applyCaptionStyle(); saveCaptionSettingsToPrefs(); });
        setupCaptionGroup(view.findViewById(R.id.group_text_weight), new String[]{"Regular", "Bold"}, captionWeight, val -> { captionWeight = val; updatePreviewSet(); applyCaptionStyle(); saveCaptionSettingsToPrefs(); });
        setupCaptionGroup(view.findViewById(R.id.group_position), new String[]{"Bottom", "Top"}, captionPosition, val -> { captionPosition = val; updatePreviewSet(); applyCaptionStyle(); saveCaptionSettingsToPrefs(); });
        setupCaptionGroup(view.findViewById(R.id.group_margin), new String[]{"0%", "4%", "8%", "12%", "16%", "20%", "25%"}, bottomMargin + "%", val -> { bottomMargin = Integer.parseInt(val.replace("%", "")); updatePreviewSet(); applyCaptionStyle(); saveCaptionSettingsToPrefs(); });
        setupCaptionGroup(view.findViewById(R.id.group_text_color), new String[]{"White", "Yellow", "Cyan", "Green", "Magenta"}, captionColorName, val -> { captionColorName = val; captionColorHex = getHexForColorName(val); updatePreviewSet(); applyCaptionStyle(); saveCaptionSettingsToPrefs(); });
        setupCaptionGroup(view.findViewById(R.id.group_edge_style), new String[]{"None", "Outline", "Shadow"}, edgeStyle, val -> { edgeStyle = val; updatePreviewSet(); applyCaptionStyle(); saveCaptionSettingsToPrefs(); });
        
        updateVisibility.run();
        updatePreviewSet();
        
        view.findViewById(R.id.btn_close_captions).setOnClickListener(v -> dialog.dismiss());
        view.findViewById(R.id.btn_final_close_captions).setOnClickListener(v -> dialog.dismiss());
        view.findViewById(R.id.btn_reset_captions).setOnClickListener(v -> {
             bgOpacity = "Off"; bgColor = "Black"; captionFontSize = 90; captionWeight = "Bold"; captionPosition = "Bottom"; bottomMargin = 12; captionColorName = "White"; captionColorHex = "#FFFFFF"; edgeStyle = "Shadow"; isSubtitlesEnabled = true; currentSelectedSubtitle = "English";
             saveCaptionSettingsToPrefs();
             updatePreviewSet(); applyCaptionStyle(); toggleWebSubtitles(true); dialog.dismiss(); showCaptionMenu();
        });
        dialog.show();
    }

    private void updatePreviewSet() {
        if (captionPreview == null) return;
        updateIndividualPreview(captionPreview);
    }

    private void updateIndividualPreview(TextView preview) {
        preview.setText("Preview your subtitle appearance.");
        preview.setTextSize(captionFontSize * 0.2f);
        preview.setTextColor(Color.parseColor(captionColorHex));
        
        float opacityVal = 0f; 
        if (!"Off".equals(bgOpacity)) opacityVal = Integer.parseInt(bgOpacity.replace("%", "")) / 100f;
        int bgColorInt = bgColor.equalsIgnoreCase("Gray") ? Color.GRAY : (bgColor.equalsIgnoreCase("Navy") ? Color.BLUE : (bgColor.equalsIgnoreCase("White") ? Color.WHITE : Color.BLACK));
        preview.setBackgroundColor(Color.argb((int)(opacityVal * 255), Color.red(bgColorInt), Color.green(bgColorInt), Color.blue(bgColorInt)));

        if (captionWeight.equalsIgnoreCase("Bold")) {
            preview.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            preview.getPaint().setFakeBoldText(true);
        } else {
            preview.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
            preview.getPaint().setFakeBoldText(false);
            preview.getPaint().setStrokeWidth(0);
        }

        if (edgeStyle.equalsIgnoreCase("Outline")) {
            preview.setShadowLayer(2f, 0, 0, Color.BLACK); 
        } else if (edgeStyle.equalsIgnoreCase("Shadow")) {
            preview.setShadowLayer(4f, 4f, 4f, Color.BLACK); 
        } else {
            preview.getPaint().clearShadowLayer();
            preview.setShadowLayer(0, 0, 0, 0);
        }
        
        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) preview.getLayoutParams();
        if (captionPosition.equalsIgnoreCase("Top")) { 
            lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL; 
            lp.topMargin = (int) (bottomMargin * 3.5); 
            lp.bottomMargin = 0; 
        } else { 
            lp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL; 
            lp.bottomMargin = (int) (bottomMargin * 3.5); 
            lp.topMargin = 0; 
        }
        preview.setLayoutParams(lp);
        
        preview.setEnabled(false);
        preview.setEnabled(true);
        preview.requestLayout();
        preview.invalidate();
    }

    private void setupCaptionGroup(LinearLayout container, String[] options, String currentVal, OnOptionSelected listener) {
        container.removeAllViews();
        for (String opt : options) {
            TextView btn = new TextView(this); 
            btn.setText(opt); 
            btn.setPadding(32, 16, 32, 16); 
            btn.setTextSize(13); 
            btn.setGravity(Gravity.CENTER); 
            btn.setMinWidth(130);
            highlightButton(btn, opt.equalsIgnoreCase(currentVal));
            btn.setOnClickListener(v -> { 
                listener.onSelected(opt); 
                for (int i = 0; i < container.getChildCount(); i++) { 
                    highlightButton((TextView) container.getChildAt(i), ((TextView) container.getChildAt(i)).getText().toString().equalsIgnoreCase(opt)); 
                } 
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT); 
            lp.setMargins(0, 0, 16, 0); 
            container.addView(btn, lp);
        }
    }

    interface OnOptionSelected { void onSelected(String val); }
    private String getHexForColorName(String name) { if (name.equalsIgnoreCase("Yellow")) return "#FFFF00"; if (name.equalsIgnoreCase("Cyan")) return "#00FFFF"; if (name.equalsIgnoreCase("Green")) return "#00FF00"; if (name.equalsIgnoreCase("Magenta")) return "#FF00FF"; return "#FFFFFF"; }
    private void highlightButton(TextView btn, boolean selected) { GradientDrawable shape = new GradientDrawable(); shape.setCornerRadius(18f); if (selected) { shape.setColor(Color.WHITE); btn.setTextColor(Color.BLACK); } else { shape.setColor(Color.parseColor("#222222")); btn.setTextColor(Color.WHITE); } btn.setBackground(shape); }
    private void applyVolumeBoost(boolean boosted) {
        isVolumeBoosted = boosted;
        if (exoPlayer != null) {
            exoPlayer.setVolume(1.0f);
        }
    }
    
    private void toggleWebSubtitles(boolean enabled) { 
        isSubtitlesEnabled = enabled;
        if (enabled) {
            applyCaptionStyle();
        } else {
            runOnUiThread(() -> {
                TextView textOverlay = findViewById(R.id.text_native_subtitle_overlay);
                if (textOverlay != null) textOverlay.setVisibility(View.GONE);
            });
        }
    }

    private void applyCaptionStyle() {
        runOnUiThread(() -> {
            TextView textOverlay = findViewById(R.id.text_native_subtitle_overlay);
            if (textOverlay == null) return;

            if (!isSubtitlesEnabled) {
                textOverlay.setVisibility(View.GONE);
                return;
            }

            // 1. Text Color
            int textColor = Color.WHITE;
            try {
                if (captionColorHex != null && !captionColorHex.isEmpty()) {
                    textColor = Color.parseColor(captionColorHex);
                }
            } catch (Exception ignored) {}
            textOverlay.setTextColor(textColor);

            // 2. Text Weight (Regular / Bold)
            if ("Bold".equalsIgnoreCase(captionWeight)) {
                textOverlay.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
                textOverlay.getPaint().setFakeBoldText(true);
            } else {
                textOverlay.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
                textOverlay.getPaint().setFakeBoldText(false);
            }

            // 3. Text Size
            float baseSizeSp = 18f;
            float scaledSizeSp = baseSizeSp * (captionFontSize / 100f);
            if (scaledSizeSp < 12f) scaledSizeSp = 12f;
            if (scaledSizeSp > 36f) scaledSizeSp = 36f;
            textOverlay.setTextSize(TypedValue.COMPLEX_UNIT_SP, scaledSizeSp);

            // 4. Outline / Shadow (edgeStyle)
            if ("Shadow".equalsIgnoreCase(edgeStyle)) {
                textOverlay.setShadowLayer(8f, 3f, 3f, Color.BLACK);
            } else if ("Outline".equalsIgnoreCase(edgeStyle)) {
                textOverlay.setShadowLayer(6f, 0f, 0f, Color.BLACK);
            } else {
                textOverlay.setShadowLayer(0f, 0f, 0f, Color.TRANSPARENT);
            }

            // 5. Background Color & Opacity
            float bgAlpha = 0f;
            if (bgOpacity != null && !"Off".equalsIgnoreCase(bgOpacity) && !"0".equals(bgOpacity)) {
                try {
                    bgAlpha = Integer.parseInt(bgOpacity.replace("%", "").trim()) / 100f;
                } catch (Exception ignored) {}
            }

            if (bgAlpha > 0f) {
                int baseBgColor = Color.BLACK;
                if ("Gray".equalsIgnoreCase(bgColor)) baseBgColor = Color.GRAY;
                else if ("Navy".equalsIgnoreCase(bgColor)) baseBgColor = Color.parseColor("#000080");
                else if ("White".equalsIgnoreCase(bgColor)) baseBgColor = Color.WHITE;

                int alphaInt = Math.round(bgAlpha * 255);
                int finalBgColor = Color.argb(alphaInt, Color.red(baseBgColor), Color.green(baseBgColor), Color.blue(baseBgColor));

                GradientDrawable shape = new GradientDrawable();
                shape.setColor(finalBgColor);
                shape.setCornerRadius(12f);
                textOverlay.setBackground(shape);
            } else {
                textOverlay.setBackground(null);
            }

            // 6. Bottom Margin & Position (Top vs Bottom)
            int bmPercentage = bottomMargin;
            int marginDp = (int) (12 + (bmPercentage * 2.2f));

            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) textOverlay.getLayoutParams();
            if (lp != null) {
                if ("Top".equalsIgnoreCase(captionPosition)) {
                    lp.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                    lp.topMargin = (int) ((40 + marginDp) * getResources().getDisplayMetrics().density);
                    lp.bottomMargin = 0;
                } else {
                    lp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
                    lp.bottomMargin = (int) (marginDp * getResources().getDisplayMetrics().density);
                    lp.topMargin = 0;
                }
                textOverlay.setLayoutParams(lp);
            }

            textOverlay.requestLayout();
            textOverlay.invalidate();
        });
    }

    private void setPlaybackSpeed(float speed, boolean permanent) { 
        if (!permanent) { 
            is2xSpeed = true; 
            if (indicator2x != null) {
                indicator2x.setText("2.0x SPEED ⏩");
                indicator2x.animate().cancel();
                indicator2x.setAlpha(0f);
                indicator2x.setScaleX(0.8f);
                indicator2x.setScaleY(0.8f);
                indicator2x.setVisibility(View.VISIBLE);
                indicator2x.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(120).start();
            }
        } else { 
            is2xSpeed = false; 
            if (indicator2x != null) {
                indicator2x.animate().cancel();
                indicator2x.animate().alpha(0f).scaleX(0.8f).scaleY(0.8f).setDuration(120)
                        .withEndAction(() -> indicator2x.setVisibility(View.GONE)).start();
            }
        } 
        if (exoPlayer != null) {
            exoPlayer.setPlaybackParameters(new PlaybackParameters(speed));
            if (permanent) currentPermanentSpeed = speed;
        }
    }

    private void navigateEpisode(boolean next) {
        long now = System.currentTimeMillis();
        if (now - lastNavigationTimestamp < 3000) {
            Log.w("AniLove", "Blocked rapid episode navigation loop!");
            return;
        }

        if (next && !hasNextEpisode) {
            Log.i("AniLove", "Cannot navigate next: hasNext is false.");
            return;
        }

        if (!next && !hasPrevEpisode) {
            Log.i("AniLove", "Cannot navigate prev: hasPrev is false.");
            return;
        }

        lastNavigationTimestamp = now;

        if (navigationListener != null) {
            if (loadingProgress != null) loadingProgress.setVisibility(View.VISIBLE);
            navigationListener.onNavigate(next);
        }
    }

    private void seekVideo(int delta) {
        if (exoPlayer != null) {
            long duration = exoPlayer.getDuration();
            if (duration <= 0) {
                duration = Long.MAX_VALUE;
            }
            long current = exoPlayer.getCurrentPosition();
            if (current == C.TIME_UNSET) {
                current = 0;
            }
            long newPos = Math.max(0, Math.min(duration, current + (delta * 1000L)));
            exoPlayer.seekTo(newPos);
            currentVideoTime = newPos / 1000.0;
            updateNativeSubtitleOverlay(currentVideoTime);
        }
    }

    private void startUpdateLoop() { 
        updateHandler.postDelayed(new Runnable() { 
            @Override public void run() { 
                syncPlayerState();
                updateHandler.postDelayed(this, 200); 
            } 
        }, 200); 
    }

    private void syncPlayerState() {
        if (exoPlayer != null) {
            long currentMs = exoPlayer.getCurrentPosition();
            long durationMs = exoPlayer.getDuration();
            if (currentMs >= 0) {
                currentVideoTime = currentMs / 1000.0;
                updateNativeSubtitleOverlay(currentVideoTime);
            }
            if (durationMs > 0) {
                int current = (int) (currentMs / 1000);
                int duration = (int) (durationMs / 1000);
                videoDuration = duration;

                textCurrentTime.setText(formatTime(current));
                textTotalTime.setText(formatTime(duration));
                int timeLeft = Math.max(0, duration - current);
                textTimeLeft.setText("-" + formatTime(timeLeft));

                if (!isDragging) {
                    seekBar.setMax(duration);
                    seekBar.setProgress(current);
                }
                if (opEdSeekBarDrawable != null) {
                    opEdSeekBarDrawable.invalidateSelf();
                }
                updateNativeSubtitleOverlay(currentMs / 1000.0);
                checkAutoNextEpisodeTrigger(currentMs, durationMs);

                // Auto-Skip Intro & Outro (AniSkip) in ExoPlayer
                boolean autoSkip = getIntent().getBooleanExtra("autoSkipIntro", false);
                if (autoSkip && isPlaying) {
                    if (aniSkipOpStart >= 0 && aniSkipOpEnd > aniSkipOpStart && current >= aniSkipOpStart && current < aniSkipOpEnd) {
                        double targetPos = aniSkipOpEnd;
                        aniSkipOpStart = -1; // Clear trigger to prevent repeat loops
                        exoPlayer.seekTo((long) (targetPos * 1000L));
                        Toast.makeText(NativePlayerActivity.this, "Auto-skipped Opening Theme ⏭️", Toast.LENGTH_SHORT).show();
                    } else if (aniSkipEdStart >= 0 && aniSkipEdEnd > aniSkipEdStart && current >= aniSkipEdStart && current < aniSkipEdEnd) {
                        double targetPos = aniSkipEdEnd;
                        aniSkipEdStart = -1; // Clear trigger to prevent repeat loops
                        exoPlayer.seekTo((long) (targetPos * 1000L));
                        Toast.makeText(NativePlayerActivity.this, "Auto-skipped Ending Theme ⏭️", Toast.LENGTH_SHORT).show();
                    }
                }

                // Show / Hide Skip Intro Button during OP / ED
                TextView btnSkipIntro = findViewById(R.id.btn_skip_intro);
                if (btnSkipIntro != null) {
                    if (aniSkipOpStart >= 0 && aniSkipOpEnd > aniSkipOpStart && current >= aniSkipOpStart && current < aniSkipOpEnd) {
                        btnSkipIntro.setText("⏭️ Skip Intro");
                        btnSkipIntro.setVisibility(View.VISIBLE);
                        btnSkipIntro.setTag(aniSkipOpEnd);
                    } else if (aniSkipEdStart >= 0 && aniSkipEdEnd > aniSkipEdStart && current >= aniSkipEdStart && current < aniSkipEdEnd) {
                        btnSkipIntro.setText("⏭️ Skip Ending");
                        btnSkipIntro.setVisibility(View.VISIBLE);
                        btnSkipIntro.setTag(aniSkipEdEnd);
                    } else {
                        if (!isControlsVisible) {
                            btnSkipIntro.setVisibility(View.GONE);
                        } else {
                            btnSkipIntro.setText("+85s Skip");
                            btnSkipIntro.setTag(null);
                        }
                    }
                }

                if (isPlaying && current > 0) {
                    broadcastProgress(current, duration);
                }
            }
        }
    }

    private void broadcastProgress(double current, double duration) {
        if (duration > 0 && current >= duration * 0.85) {
            deleteEpisodeSubOffset();
        }
        if (MainActivity.instance == null || MainActivity.instance.getBridge() == null) return;
        
        final int anilistId = getIntent().getIntExtra("anilistId", 0);
        final int episodeNumber = getIntent().getIntExtra("episodeNumber", 0);
        
        if (anilistId <= 0) return;

        MainActivity.instance.runOnUiThread(() -> {
            try {
                WebView mainWebView = MainActivity.instance.getBridge().getWebView();
                if (mainWebView != null) {
                    String js = "window.dispatchEvent(new CustomEvent('nativeVideoProgress', { " +
                            "detail: { " +
                            "anilistId: " + anilistId + ", " +
                            "episodeNumber: " + episodeNumber + ", " +
                            "currentTime: " + current + ", " +
                            "duration: " + duration + " " +
                            "} " +
                            "}));";
                    mainWebView.evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                Log.e("NativePlayer", "Failed to broadcast progress to bridge", e);
            }
        });
    }



    private String formatTime(int seconds) { return String.format(Locale.getDefault(), "%02d:%02d", Math.max(0, seconds) / 60, Math.max(0, seconds) % 60); }
    private boolean isDirectHls = false;

    private double aniSkipOpStart = -1, aniSkipOpEnd = -1;
    private double aniSkipEdStart = -1, aniSkipEdEnd = -1;

    private void seekVideoToAbsolute(int targetSeconds) {
        if (exoPlayer != null) {
            exoPlayer.seekTo(targetSeconds * 1000L);
        }
    }

    private void fetchAniSkipIntervals(int idMal, int anilistId, int episodeNumber) {
        if (episodeNumber <= 0) return;
        aniSkipOpStart = -1; aniSkipOpEnd = -1;
        aniSkipEdStart = -1; aniSkipEdEnd = -1;

        Executors.newSingleThreadExecutor().execute(() -> {
            int targetMalId = idMal;

            // 1. Resolve MAL ID via AniZip API if idMal <= 0
            if (targetMalId <= 0 && anilistId > 0) {
                try {
                    AniZipHelper.Mapping m = AniZipHelper.getMapping(anilistId);
                    if (m != null && m.malId > 0) {
                        targetMalId = m.malId;
                    }
                } catch (Exception ignored) {}
            }

            // 2. Fallback to AniList GraphQL API if MAL ID is still 0
            if (targetMalId <= 0 && anilistId > 0) {
                try {
                    URL gqlUrl = new URL("https://graphql.anilist.co");
                    HttpURLConnection gqlConn = (HttpURLConnection) gqlUrl.openConnection();
                    gqlConn.setRequestMethod("POST");
                    gqlConn.setRequestProperty("Content-Type", "application/json");
                    gqlConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36");
                    gqlConn.setConnectTimeout(5000);
                    gqlConn.setReadTimeout(5000);
                    gqlConn.setDoOutput(true);

                    JSONObject body = new JSONObject();
                    body.put("query", "query ($id: Int) { Media (id: $id) { idMal } }");
                    JSONObject vars = new JSONObject();
                    vars.put("id", anilistId);
                    body.put("variables", vars);

                    OutputStream os = gqlConn.getOutputStream();
                    os.write(body.toString().getBytes("UTF-8"));
                    os.flush();
                    os.close();

                    if (gqlConn.getResponseCode() == 200) {
                        BufferedReader in = new BufferedReader(new InputStreamReader(gqlConn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = in.readLine()) != null) sb.append(line);
                        in.close();

                        JSONObject jsonRes = new JSONObject(sb.toString());
                        JSONObject data = jsonRes.optJSONObject("data");
                        if (data != null) {
                            JSONObject media = data.optJSONObject("Media");
                            if (media != null) {
                                targetMalId = media.optInt("idMal", 0);
                            }
                        }
                    }
                } catch (Exception ignored) {}
            }

            if (targetMalId <= 0) return;

            try {
                String reqUrl = "https://api.aniskip.com/v2/skip-times/" + targetMalId + "/" + episodeNumber + "?types=op&types=ed&types=mixed-op&types=mixed-ed&types=recap&episodeLength=0";
                URL url = new URL(reqUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36");
                conn.setRequestProperty("Accept", "application/json");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);

                if (conn.getResponseCode() == 200) {
                    BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder content = new StringBuilder();
                    String line;
                    while ((line = in.readLine()) != null) content.append(line);
                    in.close();

                    JSONObject json = new JSONObject(content.toString());
                    if (json.optBoolean("found", false)) {
                        JSONArray results = json.optJSONArray("results");
                        if (results != null) {
                            for (int i = 0; i < results.length(); i++) {
                                JSONObject item = results.optJSONObject(i);
                                if (item == null) continue;
                                String skipType = item.optString("skipType", item.optString("skip_type", item.optString("type", "")));
                                JSONObject interval = item.optJSONObject("interval");
                                if (interval != null) {
                                    double start = interval.optDouble("startTime", -1);
                                    double end = interval.optDouble("endTime", -1);
                                    if (start >= 0 && end > start) {
                                        if ("op".equalsIgnoreCase(skipType) || "mixed-op".equalsIgnoreCase(skipType)) {
                                            aniSkipOpStart = start;
                                            aniSkipOpEnd = end;
                                        } else if ("ed".equalsIgnoreCase(skipType) || "mixed-ed".equalsIgnoreCase(skipType)) {
                                            aniSkipEdStart = start;
                                            aniSkipEdEnd = end;
                                        }
                                    }
                                }
                            }
                            Log.i("AniSkip", "Loaded OP: [" + aniSkipOpStart + "s - " + aniSkipOpEnd + "s] | ED: [" + aniSkipEdStart + "s - " + aniSkipEdEnd + "s]");
                            runOnUiThread(() -> {
                                if (opEdSeekBarDrawable != null) opEdSeekBarDrawable.invalidateSelf();
                                if (seekBar != null) seekBar.invalidate();
                            });
                        }
                    }
                }
            } catch (Exception e) {
                Log.d("AniSkip", "AniSkip skip times fetch failed or non-existent: " + e.getMessage());
            }
        });
    }

    public static class VttCue {
        public long startMs;
        public long endMs;
        public String text;

        public VttCue(long startMs, long endMs, String text) {
            this.startMs = startMs;
            this.endMs = endMs;
            this.text = text;
        }
    }

    private List<VttCue> parsedVttCues = new CopyOnWriteArrayList<>();

    private long parseVttTimestampToMs(String timeStr) {
        if (timeStr == null) return 0;
        timeStr = timeStr.trim().replace(',', '.');
        try {
            String[] parts = timeStr.split(":");
            if (parts.length == 3) {
                long hours = Long.parseLong(parts[0]);
                long minutes = Long.parseLong(parts[1]);
                double seconds = Double.parseDouble(parts[2]);
                return (hours * 3600000L) + (minutes * 60000L) + (long) (seconds * 1000L);
            } else if (parts.length == 2) {
                long minutes = Long.parseLong(parts[0]);
                double seconds = Double.parseDouble(parts[1]);
                return (minutes * 60000L) + (long) (seconds * 1000L);
            } else if (parts.length == 1) {
                double seconds = Double.parseDouble(parts[0]);
                return (long) (seconds * 1000L);
            }
        } catch (Exception ignored) {}
        return 0;
    }

    private void parseVttContent(String vttContent) {
        if (vttContent == null || vttContent.trim().isEmpty()) return;
        if (vttContent.startsWith("\uFEFF")) {
            vttContent = vttContent.substring(1);
        }
        List<VttCue> newCues = new ArrayList<>();
        String[] lines = vttContent.split("\\r?\\n");
        long currentStart = -1;
        long currentEnd = -1;
        StringBuilder currentText = new StringBuilder();

        for (String rawLine : lines) {
            String line = rawLine.trim();
            if (line.matches("^\\d+$")) continue; // Filter out SRT sequence numbers

            if (line.contains("-->")) {
                if (currentStart >= 0 && currentEnd > currentStart && currentText.length() > 0) {
                    String cleanText = currentText.toString()
                            .replaceAll("<[^>]*>", "")
                            .replaceAll("\\{[^}]*\\}", "")
                            .trim();
                    if (!cleanText.isEmpty()) {
                        newCues.add(new VttCue(currentStart, currentEnd, cleanText));
                    }
                }
                currentText.setLength(0);
                String[] times = line.split("-->");
                if (times.length == 2) {
                    String startStr = times[0].trim().split("\\s+")[0];
                    String endStr = times[1].trim().split("\\s+")[0];
                    currentStart = parseVttTimestampToMs(startStr);
                    currentEnd = parseVttTimestampToMs(endStr);
                }
            } else if (currentStart >= 0 && !line.isEmpty() && !line.startsWith("WEBVTT") && !line.startsWith("NOTE") && !line.startsWith("STYLE")) {
                if (currentText.length() > 0) currentText.append("\n");
                currentText.append(line);
            }
        }

        if (currentStart >= 0 && currentEnd > currentStart && currentText.length() > 0) {
            String cleanText = currentText.toString()
                    .replaceAll("<[^>]*>", "")
                    .replaceAll("\\{[^}]*\\}", "")
                    .trim();
            if (!cleanText.isEmpty()) {
                newCues.add(new VttCue(currentStart, currentEnd, cleanText));
            }
        }

        if (!newCues.isEmpty()) {
            parsedVttCues.clear();
            parsedVttCues.addAll(newCues);
            Log.i("VttParser", "Successfully parsed " + newCues.size() + " WebVTT cues!");
            runOnUiThread(() -> updateNativeSubtitleOverlay(currentVideoTime));
        }
    }

    private void downloadAndParseVttFile(String vttUrl) {
        if (vttUrl == null || vttUrl.trim().isEmpty()) return;
        final String finalVttUrl = vttUrl.trim();
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                // 1. Check if this is a local disk file (starts with "/" or "file://")
                if (finalVttUrl.startsWith("/") || finalVttUrl.startsWith("file://")) {
                    String localPath = finalVttUrl.startsWith("file://") ? finalVttUrl.substring(7) : finalVttUrl;
                    File file = new File(localPath);
                    if (file.exists() && file.isFile()) {
                        Log.i("VttParser", "Reading local VTT file: " + file.getAbsolutePath());
                        BufferedReader in = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = in.readLine()) != null) {
                            sb.append(line).append("\n");
                        }
                        in.close();
                        parseVttContent(sb.toString());
                        return;
                    } else {
                        Log.w("VttParser", "Local VTT file not found on disk: " + localPath);
                    }
                }

                // 2. Remote HTTP/HTTPS URL
                String currentUrl = finalVttUrl;
                int redirects = 0;
                HttpURLConnection conn = null;

                while (redirects < 5) {
                    URL url = new URL(currentUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(20000);
                    conn.setInstanceFollowRedirects(false);
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
                    conn.setRequestProperty("Accept", "*/*");
                    conn.setRequestProperty("Accept-Encoding", "gzip, deflate");

                    int status = conn.getResponseCode();
                    if (status >= 300 && status < 400) {
                        String loc = conn.getHeaderField("Location");
                        if (loc != null && !loc.isEmpty()) {
                            if (!loc.startsWith("http")) {
                                URL base = new URL(currentUrl);
                                loc = new URL(base, loc).toString();
                            }
                            currentUrl = loc;
                            conn.disconnect();
                            redirects++;
                            continue;
                        }
                    }
                    break;
                }

                if (conn != null && conn.getResponseCode() == 200) {
                    InputStream is = conn.getInputStream();
                    String encoding = conn.getHeaderField("Content-Encoding");
                    if ("gzip".equalsIgnoreCase(encoding)) {
                        is = new GZIPInputStream(is);
                    }
                    BufferedReader in = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = in.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                    in.close();
                    parseVttContent(sb.toString());
                } else {
                    Log.w("VttParser", "VTT request failed code: " + (conn != null ? conn.getResponseCode() : -1));
                }
            } catch (Exception e) {
                Log.e("VttParser", "Failed to download/parse VTT file: " + e.getMessage(), e);
            }
        });
    }

    private void updateNativeSubtitleOverlay(double currentSec) {
        runOnUiThread(() -> {
            TextView textOverlay = findViewById(R.id.text_native_subtitle_overlay);
            if (textOverlay == null) return;

            if (!isSubtitlesEnabled || parsedVttCues.isEmpty()) {
                textOverlay.setVisibility(View.GONE);
                return;
            }

            long currentMs = (long) ((currentSec - subtitleTimingOffset) * 1000L);
            VttCue activeCue = null;
            for (VttCue cue : parsedVttCues) {
                if (currentMs >= cue.startMs && currentMs <= cue.endMs) {
                    activeCue = cue;
                    break;
                }
            }

            if (activeCue != null && activeCue.text != null && !activeCue.text.isEmpty()) {
                textOverlay.setText(activeCue.text);
                textOverlay.setVisibility(View.VISIBLE);
                textOverlay.bringToFront();
            } else {
                textOverlay.setVisibility(View.GONE);
            }
        });
    }

    private void fetchUnifiedSubtitlesJava(int anilistId, int episodeNumber) {
        if (anilistId <= 0 || episodeNumber <= 0) return;

        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                String reqUrl = "https://subtitles-l8cm.onrender.com/subtitles.php?anilistId=" + anilistId + "&ep=" + episodeNumber;
                String currentUrl = reqUrl;
                int redirects = 0;
                HttpURLConnection conn = null;

                while (redirects < 5) {
                    URL url = new URL(currentUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(20000);
                    conn.setInstanceFollowRedirects(false);
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
                    conn.setRequestProperty("Accept", "application/json, */*");
                    conn.setRequestProperty("Accept-Encoding", "gzip, deflate");

                    int status = conn.getResponseCode();
                    if (status >= 300 && status < 400) {
                        String loc = conn.getHeaderField("Location");
                        if (loc != null && !loc.isEmpty()) {
                            if (!loc.startsWith("http")) {
                                URL base = new URL(currentUrl);
                                loc = new URL(base, loc).toString();
                            }
                            currentUrl = loc;
                            conn.disconnect();
                            redirects++;
                            continue;
                        }
                    }
                    break;
                }

                if (conn != null && conn.getResponseCode() == 200) {
                    InputStream is = conn.getInputStream();
                    String encoding = conn.getHeaderField("Content-Encoding");
                    if ("gzip".equalsIgnoreCase(encoding)) {
                        is = new GZIPInputStream(is);
                    }
                    BufferedReader in = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = in.readLine()) != null) sb.append(line);
                    in.close();

                    JSONObject json = new JSONObject(sb.toString());
                    if (json.optBoolean("success", false)) {
                        JSONArray tracks = json.optJSONArray("subtitles");
                        if (tracks != null && tracks.length() > 0) {
                            Map<String, Integer> langCounts = new HashMap<>();
                            String primaryUrl = null;
                            String primaryLabel = null;

                            for (int i = 0; i < tracks.length(); i++) {
                                JSONObject t = tracks.optJSONObject(i);
                                if (t == null) continue;
                                String baseLang = t.optString("language", "English");
                                if (baseLang.isEmpty()) baseLang = "English";

                                Integer prevCount = langCounts.get(baseLang);
                                int count = (prevCount != null ? prevCount : 0) + 1;
                                langCounts.put(baseLang, count);

                                String displayLabel = count == 1 ? baseLang : baseLang + " " + count;
                                String subUrl = t.optString("url", "");

                                if (!subUrl.isEmpty()) {
                                    capturedServer2BSubtitles.put(displayLabel, subUrl);
                                    if (!detectedSubtitles.contains(displayLabel)) {
                                        detectedSubtitles.add(displayLabel);
                                    }
                                    if (primaryUrl == null || t.optBoolean("isDefault", false)) {
                                        primaryUrl = subUrl;
                                        primaryLabel = displayLabel;
                                    }
                                }
                            }

                            if (parsedVttCues.isEmpty() && primaryUrl != null) {
                                subtitleUrl = primaryUrl;
                                subtitleLang = primaryLabel;
                                currentSelectedSubtitle = primaryLabel;
                                downloadAndParseVttFile(primaryUrl);
                                Log.i("SubServiceJava", "Loaded primary subtitle track: " + primaryLabel + " (" + primaryUrl + ")");
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.d("SubServiceJava", "Java subtitle fetch exception: " + e.getMessage());
            }
        });
    }



    private boolean isAdUrl(String lower) {
        if (lower == null) return false;
        // Explicit exemption for media manifests, segments, and stream keys
        if (lower.contains(".m3u8") || lower.contains(".mp4") || lower.contains(".ts") ||
            lower.contains(".m4s") || lower.contains(".mpd") || lower.contains(".key") ||
            lower.contains("/hls/") || lower.contains("master") || lower.contains("index")) {
            return false;
        }
        // Allow Cloudflare challenge & Turnstile verification
        if (lower.contains("turnstile") || lower.contains("challenge-platform") || lower.contains("cloudflare")) {
            return false;
        }
        // Specific ad networks and popunder domains ONLY
        return lower.contains("adsterra") || lower.contains("monetag") || lower.contains("highperformancegate") ||
               lower.contains("morphify.net") || lower.contains("popads") || lower.contains("popcash") ||
               lower.contains("exosrv") || lower.contains("clocid") || lower.contains("pemsrv") ||
               lower.contains("ad-provider") || lower.contains("clickadu") || lower.contains("hilltopads") ||
               lower.contains("highrevenuegate") || lower.contains("probationthimbledespite") || lower.contains("alwingulla") ||
               lower.contains("cpmgate") || lower.contains("trafficjunky") || lower.contains("exoclick") ||
               lower.contains("juicyads") || lower.contains("propellerads") || lower.contains("bet365") ||
               lower.contains("1xbet") || lower.contains("stake") || lower.contains("doubleclick") ||
               lower.contains("googlesyndication") || lower.contains("adservice") || lower.contains("popunder") ||
               lower.contains("onclick") || lower.contains("outbrain") || lower.contains("taboola");
    }

    @UnstableApi
    private void setupHybridEngine(String url) {
        if (url == null || url.isEmpty()) return;

        int anilistId = getIntent().getIntExtra("anilistId", 0);
        int idMal = getIntent().getIntExtra("idMal", 0);
        int episodeNumber = getIntent().getIntExtra("episodeNumber", 0);

        if (anilistId > 0 && episodeNumber > 0) {
            detectedSubtitles.clear();
            capturedServer2BSubtitles.clear();
            fetchUnifiedSubtitlesJava(anilistId, episodeNumber);
        }
        if ((idMal > 0 || anilistId > 0) && episodeNumber > 0) {
            fetchAniSkipIntervals(idMal, anilistId, episodeNumber);
        }

        String referer = getIntent().getStringExtra("referer");
        setupExoPlayerOnline(url, referer, null);
    }

    @UnstableApi
    private void loadResolvedUrl(String url) {
        if (url == null || url.isEmpty()) return;
        String referer;
        if (url.contains("watchanimeworld")) {
            referer = "https://watchanimeworld.one/";
        } else if (url.contains("megaplay")) {
            referer = "https://megaplay.buzz/";
        } else if (url.contains("justanime")) {
            referer = "https://justanime.to/";
        } else if (url.contains("anikoto")) {
            referer = "https://anikototv.to/";
        } else if (url.contains("blakiteapi")) {
            referer = "https://blakiteapi.xyz/";
        } else if (url.contains("iqsmart")) {
            referer = "https://pro.iqsmartgames.com/";
        } else if (url.contains("piratexplay") || url.contains("abyssplayer")) {
            referer = "https://piratexplay.cc/";
        } else if (url.contains("rubystm")) {
            referer = "https://rubystm.com/";
        } else {
            try {
                referer = new URL(url).getProtocol() + "://" + new URL(url).getHost() + "/";
            } catch (Exception ignored) {
                referer = "https://www.google.com/";
            }
        }
        setupExoPlayerOnline(url, referer, null);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        isFullscreenMode = (newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE);
        Intent intent = getIntent();
        if (intent != null) intent.putExtra("startFullscreen", isFullscreenMode);
        applyWindowSettings(intent);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (controller != null) {
                if (isFullscreenMode || !isOfflineMode) {
                    // Fullscreen streaming AND portrait streaming: hide both bars
                    controller.hide(WindowInsetsCompat.Type.statusBars());
                    controller.hide(WindowInsetsCompat.Type.navigationBars());
                } else {
                    // Offline mode only: show status bar + nav bar (full-activity layout)
                    controller.show(WindowInsetsCompat.Type.statusBars());
                    controller.setAppearanceLightStatusBars(false);
                    getWindow().setStatusBarColor(Color.BLACK);
                    controller.show(WindowInsetsCompat.Type.navigationBars());
                }
                controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        }
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (exoPlayer != null && !isInPictureInPictureMode()) {
            try {
                if (exoPlayer.getPlaybackState() == Player.STATE_IDLE) {
                    exoPlayer.prepare();
                }
                exoPlayer.setPlayWhenReady(true);
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH);
        if (exoPlayerView != null && exoPlayer != null) {
            try {
                exoPlayerView.setPlayer(exoPlayer);
                if (exoPlayer.getPlaybackState() == Player.STATE_IDLE) {
                    exoPlayer.prepare();
                }
                exoPlayer.setPlayWhenReady(true);
                isPlaying = true;
                if (btnPlayPause != null) {
                    btnPlayPause.setImageResource(android.R.drawable.ic_media_pause);
                }
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (exoPlayer != null && !isInPictureInPictureMode()) {
            try {
                exoPlayer.setPlayWhenReady(false);
                exoPlayer.pause();
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        VideoSniffer.cancelActiveSniffers();
        if (exoPlayer != null && !isInPictureInPictureMode()) {
            try {
                exoPlayer.setPlayWhenReady(false);
                exoPlayer.pause();
            } catch (Exception ignored) {}
        }
    }

    private void updateVolume(float percent) {
        if (audioManager == null || indicatorVolume == null || initialVolume == -1) return;
        int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        
        int newVol = initialVolume + (int) (percent * maxVol * 1.2f);
        if (newVol < 0) newVol = 0;
        if (newVol > maxVol) newVol = maxVol;
        
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, newVol, 0);
        
        int displayPercent = (int) (((float)newVol / maxVol) * 100);
        indicatorVolume.setText("🔊 " + displayPercent + "%");
        if (indicatorVolume.getVisibility() != View.VISIBLE) {
            indicatorVolume.setAlpha(0f);
            indicatorVolume.setScaleX(0.85f);
            indicatorVolume.setScaleY(0.85f);
            indicatorVolume.setVisibility(View.VISIBLE);
            indicatorVolume.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(100).start();
        }
        if (indicatorBrightness != null) indicatorBrightness.setVisibility(View.GONE);
    }

    private void updateBrightness(float percent) {
        if (indicatorBrightness == null || initialBrightness == -1.0f) return;
        Window window = getWindow();
        WindowManager.LayoutParams lp = window.getAttributes();
        
        float newBrightness = initialBrightness + percent;
        if (newBrightness < 0.01f) newBrightness = 0.01f;
        if (newBrightness > 1.0f) newBrightness = 1.0f;
        
        lp.screenBrightness = newBrightness;
        window.setAttributes(lp);
        
        int displayPercent = (int) (newBrightness * 100);
        indicatorBrightness.setText("☀️ " + displayPercent + "%");
        if (indicatorBrightness.getVisibility() != View.VISIBLE) {
            indicatorBrightness.setAlpha(0f);
            indicatorBrightness.setScaleX(0.85f);
            indicatorBrightness.setScaleY(0.85f);
            indicatorBrightness.setVisibility(View.VISIBLE);
            indicatorBrightness.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(100).start();
        }
        if (indicatorVolume != null) indicatorVolume.setVisibility(View.GONE);
    }

    @Override 
    protected void onDestroy() { 
        if (currentInstance == this) currentInstance = null;
        navigationListener = null;
        
        cleanupPlaybackEngines();
        NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        updateHandler.removeCallbacksAndMessages(null); 
        hideHandler.removeCallbacksAndMessages(null); 
        
        try {
            unregisterReceiver(pipReceiver);
        } catch (Exception ignored) {}

        super.onDestroy(); 
        overridePendingTransition(0, 0);
    }
}