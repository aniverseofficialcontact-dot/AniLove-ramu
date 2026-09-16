package com.anilove.app;

import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.util.Rational;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.SeekBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.SwitchCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.google.android.material.bottomsheet.BottomSheetBehavior;
import com.google.android.material.bottomsheet.BottomSheetDialog;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.Player;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.FileDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.extractor.DefaultExtractorsFactory;
import androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory;
import androidx.media3.ui.PlayerView;

public class NativePlayerActivity extends AppCompatActivity {
    public interface PlayerNavigationListener {
        void onNavigate(boolean next);
        void onBack();
    }
    public static PlayerNavigationListener navigationListener;

    private WebView playerWebView;
    private PlayerView exoPlayerView;
    private ExoPlayer exoPlayer;
    private boolean isOfflineMode = false;
    private ProgressBar loadingProgress;
    private View controlsOverlay;
    private ImageButton btnPlayPause, btnNextEpisode, btnPrevEpisode, btnCaptions, btnPip;
    private SeekBar seekBar;
    private TextView textCurrentTime, textTotalTime, textTimeLeft, indicator2x;
    private TextView indicatorRewind, indicatorForward;
    
    // Scrubber Preview
    private View scrubberContainer;
    private TextView scrubberTime;
    
    // Caption Preview
    private TextView captionPreview;
    
    private boolean isPlaying = true;
    private boolean isControlsVisible = true;
    private boolean isDragging = false;
    private boolean is2xSpeed = false;
    private float currentPermanentSpeed = 1.0f;
    private boolean isVolumeBoosted = false;
    private boolean isSubtitlesEnabled = true;
    
    // Caption State
    private String bgOpacity = "0";
    private String bgColor = "Black";
    private int captionFontSize = 100;
    private String captionWeight = "Regular";
    private String captionPosition = "Bottom";
    private int bottomMargin = 12;
    private String captionColorName = "White";
    private String captionColorHex = "#FFFFFF";
    private String edgeStyle = "Outline";
    
    private Handler updateHandler = new Handler(Looper.getMainLooper());
    private Handler hideHandler = new Handler(Looper.getMainLooper());
    private GestureDetector gestureDetector;
    private long lastScrubberTime = 0;

    private BroadcastReceiver pipReceiver = new BroadcastReceiver() {
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

            PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9))
                    .setActions(actions)
                    .build();
            setPictureInPictureParams(params);
        }
    }

    private boolean isFullscreenMode = false;
    public static NativePlayerActivity currentInstance;

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // INSTANT EPISODE / SERVER / LANGUAGE SWITCH: No sliding animations
        overridePendingTransition(0, 0);
        setIntent(intent);
        applyWindowSettings(intent);

        String title = intent.getStringExtra("title");
        // Title update handled via webview overlay or custom UI


        String url = intent.getStringExtra("url");
        if (url != null && !url.isEmpty()) {
            runOnUiThread(() -> {
                if (loadingProgress != null) loadingProgress.setVisibility(View.VISIBLE);
                setupHybridEngine(url); // Load with full headers/settings
            });
        }
    }

    private int getPhysicalScreenWidth() {
        android.util.DisplayMetrics dm = new android.util.DisplayMetrics();
        getWindowManager().getDefaultDisplay().getRealMetrics(dm);
        return Math.min(dm.widthPixels, dm.heightPixels);
    }

    private void applyWindowSettings(Intent intent) {
        isFullscreenMode = intent.getBooleanExtra("startFullscreen", false);
        Log.e("AniLove", ">>> applyWindowSettings CALLED | isFullscreen: " + isFullscreenMode);
        
        final Window window = getWindow();
        final View decorView = window.getDecorView();
        
        // Ensure we aren't inheriting global fullscreen from theme
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        
        // SHOW NOTIFICATION BAR ON PLAYER PAGE ON BLACK BACKGROUND
        decorView.post(() -> {
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
            if (controller != null) {
                if (isFullscreenMode) {
                    controller.hide(WindowInsetsCompat.Type.statusBars());
                    controller.hide(WindowInsetsCompat.Type.navigationBars());
                    window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
                } else {
                    // Show status bar in portrait
                    controller.show(WindowInsetsCompat.Type.statusBars());
                    // White icons for status bar
                    controller.setAppearanceLightStatusBars(false);
                    // Force black background for status bar
                    window.setStatusBarColor(Color.BLACK);
                    controller.show(WindowInsetsCompat.Type.navigationBars());
                    window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                }
                controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        });

        WindowManager.LayoutParams params = window.getAttributes();
        
        // Force drawing in the notch area
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        if (isFullscreenMode) {
            NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            
            params.width = WindowManager.LayoutParams.MATCH_PARENT;
            params.height = WindowManager.LayoutParams.MATCH_PARENT;
            params.gravity = Gravity.FILL;
            params.y = 0;
            params.x = 0;
            params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;
            params.flags |= WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
            params.flags |= WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
            
            // Solid black background for fullscreen
            findViewById(android.R.id.content).setBackgroundColor(Color.BLACK);

            decorView.post(() -> {
                View webViewView = findViewById(R.id.player_webview);
                View exoPlayerLayout = findViewById(R.id.player_exoplayer);
                View statusBarFiller = findViewById(R.id.status_bar_filler);
                View bottomGapFiller = findViewById(R.id.bottom_gap_filler);
                View topBar = findViewById(R.id.top_bar);
                
                if (webViewView != null) {
                    ViewGroup.LayoutParams lp = webViewView.getLayoutParams();
                    lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                    lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
                    webViewView.setLayoutParams(lp);
                }
                if (exoPlayerLayout != null) {
                    ViewGroup.LayoutParams lp = exoPlayerLayout.getLayoutParams();
                    lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                    lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
                    exoPlayerLayout.setLayoutParams(lp);
                }
                if (statusBarFiller != null) statusBarFiller.setVisibility(View.GONE);
                if (bottomGapFiller != null) bottomGapFiller.setVisibility(View.GONE);
                if (topBar != null) {
                    topBar.setVisibility(View.VISIBLE);
                    topBar.setPadding(topBar.getPaddingLeft(), 0, topBar.getPaddingRight(), topBar.getPaddingBottom());
                }
            });
        } else {
            // PORTRAIT: Full phone width, height = 16:9 of physical phone width + status bar + gap
            NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            
            int physicalWidth = getPhysicalScreenWidth();
            int videoHeight = (int) (physicalWidth * 0.5625);
            
            int statusBarHeight = 0;
            int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (resourceId > 0) statusBarHeight = getResources().getDimensionPixelSize(resourceId);
            
            final int gap = (int) (20 * getResources().getDisplayMetrics().density); 
            
            params.width = WindowManager.LayoutParams.MATCH_PARENT; 
            // Total height = status bar + video + gap
            params.height = videoHeight + statusBarHeight + gap; 
            params.gravity = Gravity.TOP;
            params.x = 0;
            params.y = 0; 

            params.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;
            params.flags |= WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH;
            params.flags |= WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
            params.flags |= WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;

            // In portrait, keep content background transparent so underlying web app shows through
            findViewById(android.R.id.content).setBackgroundColor(Color.TRANSPARENT);
            
            final int finalStatusBarHeight = statusBarHeight;
            decorView.post(() -> {
                View webViewView = findViewById(R.id.player_webview);
                View exoPlayerLayout = findViewById(R.id.player_exoplayer);
                View statusBarFiller = findViewById(R.id.status_bar_filler);
                View bottomGapFiller = findViewById(R.id.bottom_gap_filler);
                View topBar = findViewById(R.id.top_bar);
                
                if (webViewView != null) {
                    ViewGroup.LayoutParams lp = webViewView.getLayoutParams();
                    lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                    lp.height = videoHeight;
                    webViewView.setLayoutParams(lp);
                }
                if (exoPlayerLayout != null) {
                    ViewGroup.LayoutParams lp = exoPlayerLayout.getLayoutParams();
                    lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                    lp.height = videoHeight;
                    exoPlayerLayout.setLayoutParams(lp);
                }
                if (statusBarFiller != null) {
                    statusBarFiller.setVisibility(View.VISIBLE);
                    ViewGroup.LayoutParams lp = statusBarFiller.getLayoutParams();
                    lp.height = finalStatusBarHeight;
                    statusBarFiller.setLayoutParams(lp);
                }
                if (bottomGapFiller != null) {
                    bottomGapFiller.setVisibility(View.VISIBLE);
                    ViewGroup.LayoutParams lp = bottomGapFiller.getLayoutParams();
                    lp.height = gap;
                    bottomGapFiller.setLayoutParams(lp);
                }
                // SHIFT TOP BAR DOWN so toggles don't mix with status bar
                if (topBar != null) {
                    topBar.setPadding(topBar.getPaddingLeft(), finalStatusBarHeight, topBar.getPaddingRight(), topBar.getPaddingBottom());
                }

                // --- VISIBILITY FIX: HIDE BOX ONLY ---
                if (MainActivity.instance != null && MainActivity.instance.getBridge() != null) {
                    WebView mainWebView = MainActivity.instance.getBridge().getWebView();
                    if (mainWebView != null) {
                        String js = "(function() { " +
                                   "  var css = '.native-player-placeholder, #native-player-active, [class*=\"PlayerPlaceholder\"] { display: none !important; opacity: 0 !important; visibility: hidden !important; height: 0 !important; pointer-events: none !important; }'; " +
                                   "  var style = document.getElementById('anilove-web-fix-style') || document.createElement('style'); " +
                                   "  style.id = 'anilove-web-fix-style'; style.innerHTML = css; document.head.appendChild(style); " +
                                   "})();";
                        mainWebView.evaluateJavascript(js, null);
                    }
                }
            });
        }
        
        window.setAttributes(params);
    }

    private void toggleFullscreenInPlace() {
        new Handler(Looper.getMainLooper()).post(() -> {
            isFullscreenMode = !isFullscreenMode;
            Log.e("AniLove", ">>> toggleFullscreenInPlace CALLED | now: " + isFullscreenMode);
            
            Intent intent = getIntent();
            intent.putExtra("startFullscreen", isFullscreenMode);
            applyWindowSettings(intent);
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentInstance = this;
        supportRequestWindowFeature(Window.FEATURE_NO_TITLE);
        
        // Let the layout flow into the status bar area
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // Ensure activity background doesn't black out the screen
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        getWindow().setFormat(PixelFormat.TRANSLUCENT);
        
        applyWindowSettings(getIntent());
        setContentView(R.layout.activity_native_player);
        
        // INSTANT APPEARANCE: Disable the slide-up animation
        overridePendingTransition(0, 0);

        // UI Initialization
        playerWebView = findViewById(R.id.player_webview);
        playerWebView.setBackgroundColor(Color.BLACK); // Solid background for video rendering

        exoPlayerView = findViewById(R.id.player_exoplayer);
        
        loadingProgress = findViewById(R.id.loading_progress);
        controlsOverlay = findViewById(R.id.controls_overlay);
        
        btnPlayPause = findViewById(R.id.btn_play_pause);
        seekBar = findViewById(R.id.video_seekbar);
        textCurrentTime = findViewById(R.id.text_current_time);
        textTotalTime = findViewById(R.id.text_total_time);
        textTimeLeft = findViewById(R.id.text_time_left);
        
        btnNextEpisode = findViewById(R.id.btn_next_episode);
        btnPrevEpisode = findViewById(R.id.btn_prev_episode);
        
        scrubberContainer = findViewById(R.id.scrubber_preview_container);
        scrubberTime = findViewById(R.id.scrubber_time);
        
        indicator2x = findViewById(R.id.indicator_2x);
        indicatorRewind = findViewById(R.id.indicator_rewind);
        indicatorForward = findViewById(R.id.indicator_forward);
        
        findViewById(R.id.close_button).setOnClickListener(v -> {
            // INSTANT SIGNAL: Tell web app to navigate right now
            if (navigationListener != null) {
                navigationListener.onBack();
            }
            // INSTANT KILL: Close the player immediately with no animations
            finish();
            overridePendingTransition(0, 0);
        });
        btnPlayPause.setOnClickListener(v -> togglePlayPause());
        findViewById(R.id.btn_settings).setOnClickListener(v -> showSettingsMenu());
        btnCaptions = findViewById(R.id.btn_captions);
        btnCaptions.setOnClickListener(v -> showCaptionMenu());
        
        btnPip = findViewById(R.id.btn_pip);
        if (btnPip != null) {
            btnPip.setOnClickListener(v -> enterPipMode());
        }
        
        // Fullscreen Toggle logic
        View btnFullscreenToggle = findViewById(R.id.btn_fullscreen_toggle);
        if (btnFullscreenToggle != null) {
            btnFullscreenToggle.setOnClickListener(v -> {
                toggleFullscreenInPlace();
            });
        }
        
        findViewById(R.id.btn_rewind).setOnClickListener(v -> seekVideo(-10));
        findViewById(R.id.btn_forward).setOnClickListener(v -> seekVideo(10));
        btnNextEpisode.setOnClickListener(v -> navigateEpisode(true));
        btnPrevEpisode.setOnClickListener(v -> navigateEpisode(false));

        // Visibility based on intent (Default to VISIBLE so they are always functional and available)
        boolean hasNext = getIntent().getBooleanExtra("hasNext", true);
        boolean hasPrev = getIntent().getBooleanExtra("hasPrev", true);
        btnNextEpisode.setVisibility(View.VISIBLE);
        btnPrevEpisode.setVisibility(View.VISIBLE);

        View btnSkipIntro = findViewById(R.id.btn_skip_intro);
        btnSkipIntro.setOnClickListener(v -> seekVideo(85));
        
        // Restore original look
        GradientDrawable border = new GradientDrawable();
        border.setColor(Color.TRANSPARENT);
        border.setStroke(2, Color.parseColor("#666666")); 
        border.setCornerRadius(8);
        btnSkipIntro.setBackground(border);

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
        });

        View.OnTouchListener touchListener = (v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP || event.getAction() == MotionEvent.ACTION_CANCEL) {
                if (is2xSpeed) setPlaybackSpeed(currentPermanentSpeed, true);
            }
            return gestureDetector.onTouchEvent(event);
        };
        findViewById(R.id.touch_wall).setOnTouchListener(touchListener);
        controlsOverlay.setOnTouchListener(touchListener);

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
                // Force Mirror Creation with high-priority listeners
                playerWebView.evaluateJavascript("(function() { " +
                        "  var v = document.querySelector('video'); " +
                        "  if(!v){for(var i=0;i<window.frames.length;i++){try{var fv=window.frames[i].document.querySelector('video');if(fv)v=fv;}catch(e){}}} " +
                        "  if(v && !window.aniloveMirror) { " +
                        "    var m = document.createElement('video'); " +
                        "    m.src = v.src; window.aniloveMirror = m; m.muted = true; m.style.display = 'none'; " +
                        "    m.crossOrigin = 'anonymous'; m.preload = 'auto'; " +
                        "    m.onseeked = function() { " +
                        "      var canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90; " +
                        "      var ctx = canvas.getContext('2d'); try { ctx.drawImage(m, 0, 0, 160, 90); " +
                        "      var data = canvas.toDataURL('image/jpeg', 0.5); if(data.length > 500) AndroidScrubber.processFrame(data); } catch(e) {} " +
                        "    }; " +
                        "    document.body.appendChild(m); m.load(); " +
                        "  } " +
                        "})();", null);
            }
            @Override public void onStopTrackingTouch(SeekBar s) { 
                isDragging = false; 
                if (isOfflineMode && exoPlayer != null) {
                    exoPlayer.seekTo(s.getProgress() * 1000L);
                } else {
                    sendVideoCommand("v.currentTime = " + s.getProgress() + ";"); 
                }
                resetHideTimer(); 
                scrubberContainer.setVisibility(View.GONE);
            }
        });

        isOfflineMode = getIntent().getBooleanExtra("offlineMode", false);
        if (isOfflineMode) {
            playerWebView.setVisibility(View.GONE);
            exoPlayerView.setVisibility(View.VISIBLE);
            setupExoPlayer(getIntent().getStringExtra("localFilePath"), getIntent().getStringExtra("localSubPath"));
        } else {
            exoPlayerView.setVisibility(View.GONE);
            playerWebView.setVisibility(View.VISIBLE);
            setupHybridEngine(getIntent().getStringExtra("url") != null ? getIntent().getStringExtra("url") : "");
            playerWebView.addJavascriptInterface(new ScrubberInterface(), "AndroidScrubber");
        }
        startUpdateLoop();
        resetHideTimer();
    }

    private void setupExoPlayer(String videoPath, String subPath) {
        if (videoPath == null || videoPath.isEmpty()) return;
        try {
            exoPlayer = new ExoPlayer.Builder(this).build();
            exoPlayerView.setPlayer(exoPlayer);

            MediaItem.Builder mediaBuilder = new MediaItem.Builder()
                    .setUri(android.net.Uri.fromFile(new java.io.File(videoPath)));

            if (subPath != null && !subPath.isEmpty() && new java.io.File(subPath).exists()) {
                MediaItem.SubtitleConfiguration subtitle = new MediaItem.SubtitleConfiguration.Builder(android.net.Uri.fromFile(new java.io.File(subPath)))
                        .setMimeType(MimeTypes.TEXT_VTT)
                        .setLanguage("en")
                        .setSelectionFlags(androidx.media3.common.C.SELECTION_FLAG_DEFAULT)
                        .build();
                mediaBuilder.setSubtitleConfigurations(Collections.singletonList(subtitle));
            }

            DefaultExtractorsFactory extractorsFactory = new DefaultExtractorsFactory()
                    .setConstantBitrateSeekingEnabled(true)
                    .setTsExtractorFlags(DefaultTsPayloadReaderFactory.FLAG_ALLOW_NON_IDR_KEYFRAMES | DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS);

            DataSource.Factory dataSourceFactory = new FileDataSource.Factory();
            ProgressiveMediaSource mediaSource = new ProgressiveMediaSource.Factory(dataSourceFactory, extractorsFactory)
                    .createMediaSource(mediaBuilder.build());

            exoPlayer.setMediaSource(mediaSource);
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
            });
        } catch (Exception e) {
            Log.e("AniLove", "Error setting up ExoPlayer", e);
        }
    }

    public void updatePosition(int y) {
        // Ignored to keep player fixed at the top (Sticky Header behavior)
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
        
        scrubberContainer.setTranslationY(40); // Move closer to seekbar
    }

    public class ScrubberInterface {
        @JavascriptInterface
        public void processFrame(String base64) {
            // Thumbnails disabled, no-op
        }
    }

    private void showSeekIndicator(boolean forward) {
        final View indicator = forward ? indicatorForward : indicatorRewind;
        indicator.setVisibility(View.VISIBLE);
        new Handler(Looper.getMainLooper()).postDelayed(() -> indicator.setVisibility(View.GONE), 650);
    }

    private void togglePlayPause() {
        if (isOfflineMode && exoPlayer != null) {
            if (exoPlayer.isPlaying()) {
                exoPlayer.pause();
                btnPlayPause.setImageResource(android.R.drawable.ic_media_play);
                stopHideTimer();
            } else {
                exoPlayer.play();
                btnPlayPause.setImageResource(android.R.drawable.ic_media_pause);
                resetHideTimer();
            }
            isPlaying = exoPlayer.isPlaying();
            return;
        }

        if (isPlaying) {
            sendVideoCommand("v.pause(); v.setAttribute('data-manual-pause', 'true');");
            btnPlayPause.setImageResource(android.R.drawable.ic_media_play);
            stopHideTimer();
        } else {
            sendVideoCommand("v.play(); v.removeAttribute('data-manual-pause');");
            btnPlayPause.setImageResource(android.R.drawable.ic_media_pause);
            resetHideTimer();
        }
        isPlaying = !isPlaying;
    }

    private void toggleControlsVisibility() { isControlsVisible = !isControlsVisible; controlsOverlay.setVisibility(isControlsVisible ? View.VISIBLE : View.GONE); if (isControlsVisible) resetHideTimer(); }
    private void hideControlsQuietly() { isControlsVisible = false; controlsOverlay.setVisibility(View.GONE); stopHideTimer(); }
    private void resetHideTimer() { stopHideTimer(); if (isPlaying && isControlsVisible && !isDragging) { hideHandler.postDelayed(() -> { if (isControlsVisible && isPlaying) { isControlsVisible = false; controlsOverlay.setVisibility(View.GONE); } }, 5000); } }
    private void stopHideTimer() { hideHandler.removeCallbacksAndMessages(null); }

    private void enterPipMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                hideControlsQuietly();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        unregisterReceiver(pipReceiver);
                    } catch (Exception e) {}
                    
                    // Register with EXPORTED flag so system can send remote actions
                    ContextCompat.registerReceiver(this, pipReceiver, new IntentFilter("ACTION_PIP_CONTROL"), ContextCompat.RECEIVER_EXPORTED);
                    
                    updatePipParams();

                    PictureInPictureParams.Builder pipBuilder = new PictureInPictureParams.Builder()
                            .setAspectRatio(new Rational(16, 9));

                    if (playerWebView != null) {
                        android.graphics.Rect visibleRect = new android.graphics.Rect();
                        playerWebView.getGlobalVisibleRect(visibleRect);
                        if (visibleRect.width() > 0 && visibleRect.height() > 0) {
                            pipBuilder.setSourceRectHint(visibleRect);
                        }
                    }

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
        final View webViewView = findViewById(R.id.player_webview);
        final View topBar = findViewById(R.id.top_bar);
        final View decorView = getWindow().getDecorView();

        if (isInPictureInPictureMode) {
            hideControlsQuietly();
            findViewById(R.id.touch_wall).setVisibility(View.GONE);
            
            if (statusBarFiller != null) statusBarFiller.setVisibility(View.GONE);
            if (bottomGapFiller != null) bottomGapFiller.setVisibility(View.GONE);
            if (topBar != null) topBar.setVisibility(View.GONE);
            
            // PiP MODE: Activity window must fill the PiP window bounds
            Window window = getWindow();
            WindowManager.LayoutParams params = window.getAttributes();
            params.width = WindowManager.LayoutParams.MATCH_PARENT;
            params.height = WindowManager.LayoutParams.MATCH_PARENT;
            params.gravity = Gravity.FILL;
            window.setAttributes(params);

            if (webViewView instanceof WebView) {
                final WebView webView = (WebView) webViewView;
                ViewGroup.LayoutParams lp = webView.getLayoutParams();
                lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
                webView.setLayoutParams(lp);
                webView.requestLayout();

                // CSS to scale video and iframe to fit PiP window
                webView.evaluateJavascript("(function() { " +
                        "  function setupPip(win) { try { " +
                        "    var st = win.document.getElementById('anilove-pip-style') || win.document.createElement('style'); " +
                        "    st.id = 'anilove-pip-style'; " +
                        "    st.innerHTML = 'html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: black !important; } ' + " +
                        "      'video, .jw-video, .vjs-tech { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; object-fit: contain !important; z-index: 2147483647 !important; } ' + " +
                        "      'iframe { width: 100% !important; height: 100% !important; border: 0 !important; margin: 0 !important; padding: 0 !important; }'; " +
                        "    if(!st.parentNode) win.document.head.appendChild(st); " +
                        "  } catch(e){} " +
                        "  for(var i=0; i<win.frames.length; i++) { try { setupPip(win.frames[i]); } catch(e){} } } " +
                        "  setupPip(window); " +
                        "})();", null);
            }
        } else {
            // BACK TO PORTRAIT/LANDSCAPE: Restore fillers and constraints
            findViewById(R.id.touch_wall).setVisibility(View.VISIBLE);
            
            try {
                unregisterReceiver(pipReceiver);
            } catch (Exception e) {}

            // Remove PiP styles from all frames
            playerWebView.evaluateJavascript("(function() { " +
                    "  function cleanPip(win) { try { " +
                    "    var st = win.document.getElementById('anilove-pip-style'); " +
                    "    if(st && st.parentNode) st.parentNode.removeChild(st); " +
                    "  } catch(e){} " +
                    "  for(var i=0; i<win.frames.length; i++) { try { cleanPip(win.frames[i]); } catch(e){} } } " +
                    "  cleanPip(window); " +
                    "})();", null);

            // Re-apply window settings immediately and after Android exit animation completes
            applyWindowSettings(getIntent());
            decorView.postDelayed(() -> {
                applyWindowSettings(getIntent());
                applyCaptionStyle();
                injectAdEraser();
            }, 250);

            if (isControlsVisible) toggleControlsVisibility();
        }
    }

    private void showSettingsMenu() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        View view = getLayoutInflater().inflate(R.layout.settings_bottom_sheet, null);
        dialog.setContentView(view);
        BottomSheetBehavior behavior = BottomSheetBehavior.from((View) view.getParent());
        behavior.setState(BottomSheetBehavior.STATE_EXPANDED);
        SwitchCompat switchBoost = view.findViewById(R.id.switch_volume_boost); switchBoost.setChecked(isVolumeBoosted); switchBoost.setOnCheckedChangeListener((b, checked) -> { isVolumeBoosted = checked; applyVolumeBoost(checked); });
        TextView[] speedBtns = { view.findViewById(R.id.speed_btn_05), view.findViewById(R.id.speed_btn_1), view.findViewById(R.id.speed_btn_125), view.findViewById(R.id.speed_btn_15), view.findViewById(R.id.speed_btn_2) };
        float[] speeds = {0.5f, 1.0f, 1.25f, 1.5f, 2.0f};
        for (int i = 0; i < speedBtns.length; i++) { final float speedVal = speeds[i]; final TextView btn = speedBtns[i]; highlightButton(btn, currentPermanentSpeed == speedVal); btn.setOnClickListener(v -> { currentPermanentSpeed = speedVal; setPlaybackSpeed(speedVal, true); for (TextView b : speedBtns) highlightButton(b, b == btn); }); }
        dialog.show();
    }

    private void showCaptionMenu() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        View view = getLayoutInflater().inflate(R.layout.layout_caption_customization, null);
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
                    if (text.matches(".*[A-Z]{3,}.*") && !text.equals("SHOW SUBTITLES")) {
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

        captionPreview = view.findViewById(R.id.caption_preview);
        setupCaptionGroup(view.findViewById(R.id.group_bg_opacity), new String[]{"Off", "25%", "40%", "60%", "80%", "100%"}, bgOpacity, val -> { bgOpacity = val; updatePreviewSet(); applyCaptionStyle(); });
        setupCaptionGroup(view.findViewById(R.id.group_bg_color), new String[]{"Black", "Gray", "Navy", "White"}, bgColor, val -> { bgColor = val; updatePreviewSet(); applyCaptionStyle(); });
        setupCaptionGroup(view.findViewById(R.id.group_text_size), new String[]{"50%", "75%", "90%", "100%", "115%", "150%", "200%"}, captionFontSize + "%", val -> { captionFontSize = Integer.parseInt(val.replace("%", "")); updatePreviewSet(); applyCaptionStyle(); });
        setupCaptionGroup(view.findViewById(R.id.group_text_weight), new String[]{"Regular", "Bold"}, captionWeight, val -> { captionWeight = val; updatePreviewSet(); applyCaptionStyle(); });
        setupCaptionGroup(view.findViewById(R.id.group_position), new String[]{"Bottom", "Top"}, captionPosition, val -> { captionPosition = val; updatePreviewSet(); applyCaptionStyle(); });
        setupCaptionGroup(view.findViewById(R.id.group_margin), new String[]{"0%", "4%", "8%", "12%", "16%", "20%", "25%"}, bottomMargin + "%", val -> { bottomMargin = Integer.parseInt(val.replace("%", "")); updatePreviewSet(); applyCaptionStyle(); });
        setupCaptionGroup(view.findViewById(R.id.group_text_color), new String[]{"White", "Yellow", "Cyan", "Green", "Magenta"}, captionColorName, val -> { captionColorName = val; captionColorHex = getHexForColorName(val); updatePreviewSet(); applyCaptionStyle(); });
        setupCaptionGroup(view.findViewById(R.id.group_edge_style), new String[]{"None", "Outline", "Shadow"}, edgeStyle, val -> { edgeStyle = val; updatePreviewSet(); applyCaptionStyle(); });
        
        updateVisibility.run();
        updatePreviewSet();
        
        view.findViewById(R.id.btn_close_captions).setOnClickListener(v -> dialog.dismiss());
        view.findViewById(R.id.btn_final_close_captions).setOnClickListener(v -> dialog.dismiss());
        view.findViewById(R.id.btn_reset_captions).setOnClickListener(v -> {
             bgOpacity = "0"; bgColor = "Black"; captionFontSize = 100; captionWeight = "Regular"; captionPosition = "Bottom"; bottomMargin = 12; captionColorName = "White"; captionColorHex = "#FFFFFF"; edgeStyle = "Outline"; isSubtitlesEnabled = true;
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
        if (!bgOpacity.equals("Off")) opacityVal = Integer.parseInt(bgOpacity.replace("%", "")) / 100f;
        int bgColorInt = bgColor.equalsIgnoreCase("Gray") ? Color.GRAY : (bgColor.equalsIgnoreCase("Navy") ? Color.BLUE : (bgColor.equalsIgnoreCase("White") ? Color.WHITE : Color.BLACK));
        preview.setBackgroundColor(Color.argb((int)(opacityVal * 255), Color.red(bgColorInt), Color.green(bgColorInt), Color.blue(bgColorInt)));

        // --- THE ABSOLUTE FINAL RESET FIX ---
        // We force standard system fonts and disable all extra paint flags
        if (captionWeight.equalsIgnoreCase("Bold")) {
            preview.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            preview.getPaint().setFakeBoldText(true);
        } else {
            preview.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
            preview.getPaint().setFakeBoldText(false);
            preview.getPaint().setStrokeWidth(0);
        }

        // --- Edge Style ---
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
        
        // Force a total View reset
        preview.setEnabled(false);
        preview.setEnabled(true);
        preview.requestLayout();
        preview.invalidate();
    }

    private void setupCaptionGroup(LinearLayout container, String[] options, String currentVal, OnOptionSelected listener) {
        container.removeAllViews();
        for (String opt : options) {
            TextView btn = new TextView(this); btn.setText(opt); btn.setPadding(32, 16, 32, 16); btn.setTextSize(13); btn.setGravity(Gravity.CENTER); btn.setMinWidth(130);
            highlightButton(btn, opt.equalsIgnoreCase(currentVal));
            btn.setOnClickListener(v -> { listener.onSelected(opt); for (int i = 0; i < container.getChildCount(); i++) { highlightButton((TextView) container.getChildAt(i), ((TextView) container.getChildAt(i)).getText().toString().equalsIgnoreCase(opt)); } });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT); lp.setMargins(0, 0, 16, 0); container.addView(btn, lp);
        }
    }

    interface OnOptionSelected { void onSelected(String val); }
    private String getHexForColorName(String name) { if (name.equalsIgnoreCase("Yellow")) return "#FFFF00"; if (name.equalsIgnoreCase("Cyan")) return "#00FFFF"; if (name.equalsIgnoreCase("Green")) return "#00FF00"; if (name.equalsIgnoreCase("Magenta")) return "#FF00FF"; return "#FFFFFF"; }
    private void highlightButton(TextView btn, boolean selected) { GradientDrawable shape = new GradientDrawable(); shape.setCornerRadius(18f); if (selected) { shape.setColor(Color.WHITE); btn.setTextColor(Color.BLACK); } else { shape.setColor(Color.parseColor("#222222")); btn.setTextColor(Color.WHITE); } btn.setBackground(shape); }
    private void applyVolumeBoost(boolean boosted) { playerWebView.evaluateJavascript("(function() { if (!window.audioCtx) { try { window.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); var v = document.querySelector('video'); if (v) { window.source = window.audioCtx.createMediaElementSource(v); window.gainNode = window.audioCtx.createGain(); window.source.connect(window.gainNode); window.gainNode.connect(window.audioCtx.destination); } } catch(e) {} } if (window.gainNode) window.gainNode.gain.value = " + (boosted ? "2.5" : "1.0") + "; })();", null); }
    private void toggleWebSubtitles(boolean enabled) { 
        isSubtitlesEnabled = enabled;
        String display = enabled ? "block" : "none";
        String visibility = enabled ? "visible" : "hidden";
        String opacity = enabled ? "1" : "0";

        String css = ".jw-captions, .vjs-text-track-display, .ytp-caption-window-container, .caption-window, " +
                     ".subtitles, .captions, .art-subtitle, .artplayer-subtitles, .art-subtitles, .plyr__captions, " +
                     ".jw-captions *, .vjs-text-track-display *, .ytp-caption-window-container *, .caption-window *, " +
                     ".subtitles *, .captions *, .art-subtitle *, .artplayer-subtitles *, .art-subtitles *, .plyr__captions * { " +
                     "visibility: " + visibility + " !important; display: " + display + " !important; opacity: " + opacity + " !important; }";

        playerWebView.evaluateJavascript("(function() { " +
                "  function toggle(win) { try { " +
                "    var style = win.document.getElementById('anilove-caption-toggle-style') || win.document.createElement('style'); " +
                "    style.id = 'anilove-caption-toggle-style'; " +
                "    style.innerHTML = '" + css + "'; " +
                "    if(!style.parentNode) win.document.head.appendChild(style); " +
                "    var v = win.document.querySelector('video'); " +
                "    if (v && v.textTracks) { " +
                "      var hasCustom = win.document.querySelector('.art-subtitle, .artplayer-subtitles, .art-subtitles, .jw-captions, .vjs-text-track-display, .subtitles, .captions, .caption-window'); " +
                "      for (var i = 0; i < v.textTracks.length; i++) { " +
                "        if (!" + enabled + ") { " +
                "          v.textTracks[i].mode = 'disabled'; " +
                "        } else { " +
                // If custom DOM captions exist, set to 'hidden' so browser doesn't draw DUPLICATE native cues!
                "          v.textTracks[i].mode = hasCustom ? 'hidden' : 'showing'; " +
                "        } " +
                "      } " +
                "    } " +
                "  } catch(e) {} " +
                "  for (var i = 0; i < win.frames.length; i++) { try { toggle(win.frames[i]); } catch(e) {} } } " +
                "  toggle(window); " +
                "})();", null);

        if (enabled) {
            applyCaptionStyle();
        }
    }

    private void applyCaptionStyle() {
        if (!isSubtitlesEnabled) return;

        float opacityVal = 0f;
        if (!bgOpacity.equals("Off") && !bgOpacity.equals("0")) {
            try { opacityVal = Integer.parseInt(bgOpacity.replace("%", "")) / 100f; } catch (Exception e) {}
        }
        String bgRgb = bgColor.equalsIgnoreCase("Gray") ? "128,128,128" :
                (bgColor.equalsIgnoreCase("Navy") ? "0,0,128" :
                (bgColor.equalsIgnoreCase("White") ? "255,255,255" : "0,0,0"));
        String bgRgba = opacityVal > 0 ? "rgba(" + bgRgb + "," + opacityVal + ")" : "transparent";

        String shadowCss = edgeStyle.equalsIgnoreCase("Outline") ?
                "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 1px 0 #000, 0 -1px 0 #000" :
                (edgeStyle.equalsIgnoreCase("Shadow") ? "2.5px 2.5px 3px rgba(0,0,0,0.8)" : "none");
        boolean isTop = captionPosition.equalsIgnoreCase("Top");

        String posCss = isTop ?
                "top: " + bottomMargin + "% !important; bottom: auto !important;" :
                "bottom: " + bottomMargin + "% !important; top: auto !important;";

        // Containers: Positioned at Top or Bottom with bottomMargin%, centered, full width, transparent container background
        String containerSelectors = ".art-subtitle, .artplayer-subtitles, .art-subtitles, " +
                ".jw-captions, .jw-text-track-container, .vjs-text-track-display, " +
                ".ytp-caption-window-container, .caption-window, .subtitles, .captions, .plyr__captions";

        // Text elements: Color, font size, font weight, text-shadow, and background color pill
        String textSelectors = ".art-subtitle p, .art-subtitle span, .art-subtitle-item, " +
                ".artplayer-subtitles p, .artplayer-subtitles span, " +
                ".art-subtitles p, .art-subtitles span, " +
                ".jw-text-track-cue, .jw-caption-content, .jw-captions span, " +
                ".vjs-text-track-cue, .vjs-text-track-cue *, " +
                ".ytp-caption-segment, .plyr__caption, " +
                ".caption-window span, .subtitles span, .captions span";

        String padding = opacityVal > 0 ? "2px 8px !important;" : "0 !important;";
        String borderRadius = opacityVal > 0 ? "4px !important;" : "0 !important;";

        String css = "::cue { " +
                "  color: " + captionColorHex + " !important; " +
                "  background-color: " + bgRgba + " !important; " +
                "  font-weight: " + captionWeight.toLowerCase() + " !important; " +
                "  font-size: " + (captionFontSize * 0.01) + "em !important; " +
                "  text-shadow: " + shadowCss + " !important; " +
                "} " +
                containerSelectors + " { " +
                "  position: absolute !important; " +
                "  left: 0 !important; " +
                "  right: 0 !important; " +
                "  width: 100% !important; " +
                "  text-align: center !important; " +
                "  margin: 0 !important; " +
                "  pointer-events: none !important; " +
                "  z-index: 2147483647 !important; " +
                "  background: transparent !important; " +
                "  background-color: transparent !important; " +
                "  " + posCss + " " +
                "} " +
                // General text styling for all containers and children
                containerSelectors + ", " + containerSelectors + " * { " +
                "  color: " + captionColorHex + " !important; " +
                "  -webkit-text-fill-color: " + captionColorHex + " !important; " +
                "  font-size: " + (captionFontSize * 0.02) + "vw !important; " +
                "  font-weight: " + captionWeight.toLowerCase() + " !important; " +
                "  text-shadow: " + shadowCss + " !important; " +
                "} " +
                // Background color & opacity on actual text elements
                textSelectors + " { " +
                "  background: " + bgRgba + " !important; " +
                "  background-color: " + bgRgba + " !important; " +
                "  padding: " + padding + " " +
                "  border-radius: " + borderRadius + " " +
                "  display: inline-block !important; " +
                "} ";

        String js = "(function() { " +
                "  function apply(win) { try { " +
                "    var style = win.document.getElementById('anilove-caption-style') || win.document.createElement('style'); " +
                "    style.id = 'anilove-caption-style'; " +
                "    style.innerHTML = '" + css + "'; " +
                "    if(!style.parentNode) win.document.head.appendChild(style); " +
                // Handle cases where .art-subtitle has direct text without child tags
                "    var artSubs = win.document.querySelectorAll('.art-subtitle'); " +
                "    artSubs.forEach(function(sub) { " +
                "      sub.style.setProperty('position', 'absolute', 'important'); " +
                "      " + (isTop ? "sub.style.setProperty('top', '" + bottomMargin + "%', 'important'); sub.style.setProperty('bottom', 'auto', 'important');" : "sub.style.setProperty('bottom', '" + bottomMargin + "%', 'important'); sub.style.setProperty('top', 'auto', 'important');") + " " +
                "      if(sub.children.length === 0 && sub.innerText && sub.innerText.trim().length > 0) { " +
                "        sub.style.setProperty('background', '" + bgRgba + "', 'important'); " +
                "        sub.style.setProperty('background-color', '" + bgRgba + "', 'important'); " +
                "        sub.style.setProperty('display', 'inline-block', 'important'); " +
                "        sub.style.setProperty('padding', '" + (opacityVal > 0 ? "2px 8px" : "0") + "', 'important'); " +
                "        sub.style.setProperty('border-radius', '" + (opacityVal > 0 ? "4px" : "0") + "', 'important'); " +
                "      } " +
                "    }); " +
                // Check video textTracks - if custom captions exist, ensure native tracks remain hidden
                "    var v = win.document.querySelector('video'); " +
                "    if (v && v.textTracks) { " +
                "      var hasCustom = win.document.querySelector('.art-subtitle, .artplayer-subtitles, .art-subtitles, .jw-captions, .vjs-text-track-display'); " +
                "      if (hasCustom) { " +
                "        for(var i=0; i<v.textTracks.length; i++) { " +
                "          if (v.textTracks[i].mode === 'showing') v.textTracks[i].mode = 'hidden'; " +
                "        } " +
                "      } " +
                "    } " +
                "  } catch(e) {} " +
                "  for(var i=0; i<win.frames.length; i++) { try { apply(win.frames[i]); } catch(e) {} } } " +
                "  apply(window); " +
                "})();";

        playerWebView.evaluateJavascript(js, null);
    }
    private void setPlaybackSpeed(float speed, boolean permanent) { 
        if (!permanent) { 
            is2xSpeed = true; 
            indicator2x.setVisibility(View.VISIBLE); 
        } else { 
            is2xSpeed = false; 
            indicator2x.setVisibility(View.GONE); 
        } 
        if (isOfflineMode && exoPlayer != null) {
            exoPlayer.setPlaybackParameters(new PlaybackParameters(speed));
            return;
        }
        sendVideoCommand("v.playbackRate = " + speed + ";"); 
    }
    
    private void navigateEpisode(boolean next) {
        if (navigationListener != null) {
            navigationListener.onNavigate(next);
            finish();
            return;
        }

        String direction = next ? "Next" : "Prev";
        String js = "(function() { " +
                "  function findAndClick() { " +
                "    var selectors = [" +
                "      'a[title*=\"" + direction + "\"]', 'button[title*=\"" + direction + "\"]', " +
                "      'a[aria-label*=\"" + direction + "\"]', 'button[aria-label*=\"" + direction + "\"]', " +
                "      '." + direction.toLowerCase() + "-episode', '." + direction.toLowerCase() + "', " +
                "      '.btn-" + direction.toLowerCase() + "', '.next', '.prev' " +
                "    ]; " +
                "    for (var i = 0; i < selectors.length; i++) { " +
                "      var el = document.querySelector(selectors[i]); " +
                "      if (el) { el.click(); return true; } " +
                "    } " +
                "    var all = document.querySelectorAll('a, button'); " +
                "    for (var i = 0; i < all.length; i++) { " +
                "      var txt = all[i].innerText || all[i].textContent; " +
                "      if (txt && txt.toLowerCase().includes('" + direction.toLowerCase() + "')) { " +
                "        all[i].click(); return true; " +
                "      } " +
                "    } " +
                "    return false; " +
                "  } " +
                "  var found = findAndClick(); " +
                "  if(!found) { " +
                "    for(var i=0; i<window.frames.length; i++) { " +
                "      try { " +
                "        var f = window.frames[i].document.querySelectorAll('a, button'); " +
                "        for(var j=0; j<f.length; j++) { " +
                "           var t = f[j].innerText || f[j].textContent; " +
                "           if(t && t.toLowerCase().includes('" + direction.toLowerCase() + "')) { f[j].click(); break; } " +
                "        } " +
                "      } catch(e) {} " +
                "    } " +
                "  } " +
                "})();";
        playerWebView.evaluateJavascript(js, null);
    }

    private void seekVideo(int delta) {
        if (isOfflineMode && exoPlayer != null) {
            long newPos = Math.max(0, Math.min(exoPlayer.getDuration(), exoPlayer.getCurrentPosition() + (delta * 1000L)));
            exoPlayer.seekTo(newPos);
            return;
        }
        sendVideoCommand("v.currentTime += " + delta + ";");
    }

    private void startUpdateLoop() { updateHandler.postDelayed(new Runnable() { @Override public void run() { syncPlayerState(); updateHandler.postDelayed(this, 1000); } }, 1000); }
    private void syncPlayerState() {
        if (isOfflineMode && exoPlayer != null) {
            long currentMs = exoPlayer.getCurrentPosition();
            long durationMs = exoPlayer.getDuration();
            if (durationMs > 0) {
                int current = (int) (currentMs / 1000);
                int duration = (int) (durationMs / 1000);
                textCurrentTime.setText(formatTime(current));
                textTotalTime.setText(formatTime(duration));
                int timeLeft = Math.max(0, duration - current);
                textTimeLeft.setText("-" + formatTime(timeLeft));

                if (!isDragging) {
                    seekBar.setMax(duration);
                    seekBar.setProgress(current);
                }
            }
            return;
        }

        playerWebView.evaluateJavascript("(function() { " +
                "function penetrate(win, callback) { " +
                "  try { callback(win); } catch(e) {} " +
                "  for (var i = 0; i < win.frames.length; i++) { " +
                "    try { penetrate(win.frames[i], callback); } catch(e) {} " +
                "  } " +
                "} " +
                "var v = null; " +
                "penetrate(window, function(w) { try { if(!v) v = w.document.querySelector('video'); }catch(e){} }); " +
                "return v ? [v.currentTime, v.duration, v.paused] : null; " +
                "})();", value -> { if (value != null && !value.equals("null") && !value.isEmpty()) { try { String[] parts = value.replace("[", "").replace("]", "").replace("\"", "").split(","); if (parts.length >= 3) { 
                    double current = Double.parseDouble(parts[0]); 
                    double duration = Double.parseDouble(parts[1]); 
                    boolean pausedInWeb = Boolean.parseBoolean(parts[2]); 
                    
                    // Always update the left/right time tellers (keep playback sync)
                    textCurrentTime.setText(formatTime((int) current)); 
                    textTotalTime.setText(formatTime((int) duration)); 
                    
                    int timeLeft = (int) (duration - current);
                    textTimeLeft.setText("-" + formatTime(timeLeft));

                    if (!isDragging) { 
                        seekBar.setMax((int) duration); 
                        seekBar.setProgress((int) current); 
                    } 
                    if (pausedInWeb == isPlaying) { 
                        isPlaying = !pausedInWeb; 
                        btnPlayPause.setImageResource(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play); 
                        if (isPlaying) resetHideTimer(); else stopHideTimer(); 
                    } 
                } } catch (Exception e) {} } }); }
    private void sendVideoCommand(String jsAction) { playerWebView.evaluateJavascript("(function() { function findVideo(win) { try { var v = win.document.querySelector('video'); if (v) return v; } catch(e) {} for (var i = 0; i < win.frames.length; i++) { try { var fv = findVideo(win.frames[i]); if (fv) return fv; } catch(e) {} } return null; } var v = findVideo(window); if (v) { " + jsAction + " } })();", null); }
    private String formatTime(int seconds) { return String.format(Locale.getDefault(), "%02d:%02d", (seconds < 0 ? 0 : seconds) / 60, (seconds < 0 ? 0 : seconds) % 60); }
    private boolean isDirectHls = false;

    private void setupHybridEngine(String url) {
        if (url == null || url.isEmpty()) return;
        
        WebSettings settings = playerWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        
        playerWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d("PlayerDiagnostics", consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return true;
            }
        });

        playerWebView.setWebViewClient(new WebViewClient() { 
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String reqUrl = request.getUrl().toString();
                String lower = reqUrl.toLowerCase();
                int anilistId = getIntent().getIntExtra("anilistId", 0);
                int episodeNumber = getIntent().getIntExtra("episodeNumber", 0);
                String audio = getIntent().getStringExtra("audio");

                if (anilistId > 0 && episodeNumber > 0) {
                    if ((lower.contains(".vtt") || lower.contains(".srt")) && !lower.contains("thumb")) {
                        StreamCache.putSubtitle(anilistId, episodeNumber, audio, reqUrl);
                    }
                    if ((lower.contains(".m3u8") || lower.contains(".mp4") || lower.contains(".m4s")) &&
                        !lower.contains("/ads/") && !lower.contains("google-analytics") && !lower.contains("doubleclick")) {
                        StreamCache.put(anilistId, episodeNumber, audio, reqUrl);
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override public void onPageStarted(WebView view, String url, Bitmap favicon) { 
                super.onPageStarted(view, url, favicon); 
                if (!isDirectHls) {
                    view.loadUrl("javascript:(function() { " +
                            "  var style = document.createElement('style'); " +
                            "  style.innerHTML = 'body, html { background: black !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; width: 100% !important; height: 100% !important; } " +
                            "  video, .jw-video, .vjs-tech, .art-subtitle, .artplayer-subtitles, .art-subtitles, .jw-captions, .jw-text-track-container, .vjs-text-track-display, .ytp-caption-window-container, .plyr__captions, .caption-window, .subtitles, .captions { " +
                            "    visibility: visible !important; opacity: 1 !important; display: block !important; " +
                            "  } " +
                            "  video, .jw-video, .vjs-tech { " +
                            "    position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; object-fit: contain !important; z-index: 1000 !important; " +
                            "  }'; " +
                            "  document.head.appendChild(style); " +
                            "})();"); 
                    injectAdEraser(); 
                }
            } 
            @Override public void onPageFinished(WebView view, String url) { 
                super.onPageFinished(view, url); 
                loadingProgress.setVisibility(View.GONE); 
                if (!isDirectHls) {
                    injectAdEraser(); 
                }
                applyCaptionStyle(); 
                toggleWebSubtitles(true); 

                // Automatic Multi-Audio Track Selector (English, Japanese, Hindi, Tamil, Telugu, etc.)
                String audio = getIntent().getStringExtra("audio");
                final String targetAudio = audio != null ? audio.toLowerCase() : "dub";
                String audioScript = "(function() {" +
                        "  var target = '" + targetAudio + "';" +
                        "  function matchTrack(t) {" +
                        "    var all = ((t.language || '') + ' ' + (t.lang || '') + ' ' + (t.name || '') + ' ' + (t.label || '') + ' ' + (t.id || '')).toLowerCase();" +
                        "    if (target === 'dub' || target === 'eng' || target === 'english') return all.indexOf('eng') !== -1 || all.indexOf('en') !== -1 || all.indexOf('dub') !== -1;" +
                        "    if (target === 'sub' || target === 'jpn' || target === 'japanese') return all.indexOf('jpn') !== -1 || all.indexOf('jap') !== -1 || all.indexOf('ja') !== -1 || all.indexOf('sub') !== -1 || all.indexOf('orig') !== -1;" +
                        "    if (target === 'hin' || target === 'hindi') return all.indexOf('hin') !== -1 || all.indexOf('hi') !== -1;" +
                        "    if (target === 'tam' || target === 'tamil') return all.indexOf('tam') !== -1 || all.indexOf('ta') !== -1;" +
                        "    if (target === 'tel' || target === 'telugu') return all.indexOf('tel') !== -1 || all.indexOf('te') !== -1;" +
                        "    if (target === 'mal' || target === 'malayalam') return all.indexOf('mal') !== -1 || all.indexOf('ml') !== -1;" +
                        "    if (target === 'ben' || target === 'bengali') return all.indexOf('ben') !== -1 || all.indexOf('bn') !== -1;" +
                        "    return false;" +
                        "  }" +
                        "  function applyJwTrack(p) {" +
                        "    if (!p || typeof p.getAudioTracks !== 'function') return false;" +
                        "    var tracks = p.getAudioTracks();" +
                        "    if (tracks && tracks.length > 0) {" +
                        "      for (var i = 0; i < tracks.length; i++) {" +
                        "        if (matchTrack(tracks[i])) {" +
                        "          if (p.getCurrentAudioTrack() !== i) p.setCurrentAudioTrack(i);" +
                        "          return true;" +
                        "        }" +
                        "      }" +
                        "    }" +
                        "    return false;" +
                        "  }" +
                        "  function penetrateAudio(win) {" +
                        "    try {" +
                        "      if (typeof win.jwplayer === 'function') {" +
                        "        var p = win.jwplayer();" +
                        "        if (p) {" +
                        "          if (applyJwTrack(p)) return true;" +
                        "          if (!win._jwAudioHooked) {" +
                        "            win._jwAudioHooked = true;" +
                        "            p.on('ready', function() { applyJwTrack(p); });" +
                        "            p.on('audioTracks', function() { applyJwTrack(p); });" +
                        "            p.on('play', function() { applyJwTrack(p); });" +
                        "          }" +
                        "        }" +
                        "      }" +
                        "    } catch(e) {}" +
                        "    for (var j = 0; j < win.frames.length; j++) {" +
                        "      try { if (penetrateAudio(win.frames[j])) return true; } catch(e) {}" +
                        "    }" +
                        "    return false;" +
                        "  }" +
                        "  penetrateAudio(window);" +
                        "  var attempts = 0;" +
                        "  var interval = setInterval(function() {" +
                        "    attempts++;" +
                        "    if (penetrateAudio(window) || attempts > 15) clearInterval(interval);" +
                        "  }, 400);" +
                        "})();";
                view.evaluateJavascript(audioScript, null);
            } 
        }); 

        // If URL is a direct .m3u8 master playlist or video stream
        if (url.contains(".m3u8") || url.contains(".mp4") || url.contains("/cdn/hls/") || url.contains("/hls/")) {
            isDirectHls = true;
            String audio = getIntent().getStringExtra("audio");
            final String targetAudio = audio != null ? audio.toLowerCase() : "dub";

            String hlsHtml = "<!DOCTYPE html>" +
                    "<html><head>" +
                    "<meta name='viewport' content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'>" +
                    "<script src='https://cdn.jsdelivr.net/npm/hls.js@latest'></script>" +
                    "<style>" +
                    "  * { margin: 0; padding: 0; box-sizing: border-box; }" +
                    "  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }" +
                    "  video { width: 100%; height: 100%; object-fit: contain; background: #000; display: block; position: fixed; top: 0; left: 0; }" +
                    "</style>" +
                    "</head><body>" +
                    "<video id='player' playsinline autoplay controlsList='nodownload'></video>" +
                    "<script>" +
                    "  var v = document.getElementById('player');" +
                    "  var streamUrl = '" + url.replace("'", "\\'") + "';" +
                    "  var targetAudio = '" + targetAudio + "';" +
                    "  function matchHlsTrack(t) {" +
                    "    var all = ((t.lang || '') + ' ' + (t.name || '') + ' ' + (t.label || '') + ' ' + (t.url || '')).toLowerCase();" +
                    "    if (targetAudio === 'dub' || targetAudio === 'eng' || targetAudio === 'english') return all.indexOf('eng') !== -1 || all.indexOf('en') !== -1 || all.indexOf('dub') !== -1;" +
                    "    if (targetAudio === 'sub' || targetAudio === 'jpn' || targetAudio === 'japanese') return all.indexOf('jpn') !== -1 || all.indexOf('jap') !== -1 || all.indexOf('ja') !== -1 || all.indexOf('sub') !== -1 || all.indexOf('orig') !== -1;" +
                    "    if (targetAudio === 'hin' || targetAudio === 'hindi') return all.indexOf('hin') !== -1 || all.indexOf('hi') !== -1;" +
                    "    if (targetAudio === 'tam' || targetAudio === 'tamil') return all.indexOf('tam') !== -1 || all.indexOf('ta') !== -1;" +
                    "    if (targetAudio === 'tel' || targetAudio === 'telugu') return all.indexOf('tel') !== -1 || all.indexOf('te') !== -1;" +
                    "    if (targetAudio === 'mal' || targetAudio === 'malayalam') return all.indexOf('mal') !== -1 || all.indexOf('ml') !== -1;" +
                    "    if (targetAudio === 'ben' || targetAudio === 'bengali') return all.indexOf('ben') !== -1 || all.indexOf('bn') !== -1;" +
                    "    return false;" +
                    "  }" +
                    "  if (Hls.isSupported()) {" +
                    "    var hls = new Hls({ enableWorker: true, lowLatencyMode: false });" +
                    "    hls.loadSource(streamUrl);" +
                    "    hls.attachMedia(v);" +
                    "    function selectAudioTrack() {" +
                    "      var tracks = hls.audioTracks;" +
                    "      if (tracks && tracks.length > 0) {" +
                    "        for (var i = 0; i < tracks.length; i++) {" +
                    "          if (matchHlsTrack(tracks[i])) {" +
                    "            hls.audioTrack = i;" +
                    "            break;" +
                    "          }" +
                    "        }" +
                    "      }" +
                    "    }" +
                    "    hls.on(Hls.Events.MANIFEST_PARSED, function() { selectAudioTrack(); v.play().catch(function(){}); });" +
                    "    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, function() { selectAudioTrack(); });" +
                    "  } else if (v.canPlayType('application/vnd.apple.mpegurl')) {" +
                    "    v.src = streamUrl;" +
                    "    v.addEventListener('loadedmetadata', function() { v.play().catch(function(){}); });" +
                    "  } else {" +
                    "    v.src = streamUrl;" +
                    "    v.play().catch(function(){});" +
                    "  }" +
                    "</script></body></html>";

            String baseUrl = "https://play.zephyrix.org/";
            if (url.contains("nexabloom.top") || url.contains("megaplay.buzz")) {
                baseUrl = "https://megaplay.buzz/";
            } else if (url.contains("justanime.to")) {
                baseUrl = "https://justanime.to/";
            } else {
                try {
                    baseUrl = new java.net.URL(url).getProtocol() + "://" + new java.net.URL(url).getHost() + "/";
                } catch (Exception ignored) {}
            }

            playerWebView.loadDataWithBaseURL(baseUrl, hlsHtml, "text/html", "UTF-8", null);
            return;
        }

        isDirectHls = false;
        String referer = "https://anikototv.to/";
        if (url.contains("zephyrix") || url.contains("watchanimeworld") || url.contains("short.icu") || url.contains("animesalt")) {
            referer = "https://watchanimeworld.one/";
        } else if (url.contains("nexabloom.top") || url.contains("megaplay.buzz")) {
            referer = "https://megaplay.buzz/";
        } else if (url.contains("justanime.to")) {
            referer = "https://justanime.to/";
        } else {
            try {
                referer = new java.net.URL(url).getProtocol() + "://" + new java.net.URL(url).getHost() + "/";
            } catch (Exception ignored) {}
        }
        Map<String, String> headers = new HashMap<>(); 
        headers.put("Referer", referer); 
        playerWebView.loadUrl(url, headers); 
    }
    
    private void injectAdEraser() { 
        if (isDirectHls) return;
        playerWebView.evaluateJavascript("(function() { " +
                "  function absoluteCleanse(win) { " +
                "    try { " +
                "      var doc = win.document; " +
                "      var v = doc.querySelector('video'); " +
                "      if (!v) { for (var i = 0; i < win.frames.length; i++) { try { var fv = win.frames[i].document.querySelector('video'); if (fv) { v = fv; break; } } catch(e) {} } } " +
                "      if (v) { " +
                "        doc.body.style.setProperty('background', 'black', 'important'); " +
                "        var all = doc.querySelectorAll('body *'); " +
                "        var subSelectors = '.art-subtitle, .artplayer-subtitles, .art-subtitles, .jw-captions, .jw-text-track-container, .vjs-text-track-display, .ytp-caption-window-container, .plyr__captions, .caption-window, .subtitles, .captions, .jw-video, .vjs-tech'; " +
                "        var whitelist = doc.querySelectorAll(subSelectors); " +
                "        all.forEach(function(el) { " +
                "          if (el === v || el.contains(v)) { " +
                "            el.style.setProperty('visibility', 'visible', 'important'); " +
                "            el.style.setProperty('opacity', '1', 'important'); " +
                "            if (el !== v && !el.contains(v)) el.style.setProperty('background', 'transparent', 'important'); " +
                "            return; " +
                "          } " +
                "          var isWhite = false; whitelist.forEach(w => { if (w === el || w.contains(el) || el.contains(w)) isWhite = true; }); " +
                "          if (isWhite) { " +
                "            el.style.setProperty('visibility', 'visible', 'important'); " +
                "            el.style.setProperty('opacity', '1', 'important'); " +
                "            el.style.setProperty('z-index', '2147483647', 'important'); " +
                "            /* DO NOT TOUCH BACKGROUND OR POSITION HERE - handled by applyCaptionStyle */ " +
                "          } else { " +
                "            el.style.setProperty('visibility', 'hidden', 'important'); " +
                "            el.style.setProperty('pointer-events', 'none', 'important'); " +
                "          } " +
                "        }); " +
                "        v.style.setProperty('visibility', 'visible', 'important'); " +
                "        v.style.setProperty('opacity', '1', 'important'); " +
                "        v.style.setProperty('position', 'fixed', 'important'); " +
                "        v.style.setProperty('top', '0', 'important'); " +
                "        v.style.setProperty('left', '0', 'important'); " +
                "        v.style.setProperty('width', '100%', 'important'); " +
                "        v.style.setProperty('height', '100%', 'important'); " +
                "        v.style.setProperty('object-fit', 'contain', 'important'); " +
                "        v.style.setProperty('z-index', '1000', 'important'); " +
                "      } " +
                "    } catch(e) {} " +
                "  } " +
                "  function penetrate(win) { absoluteCleanse(win); for (var i = 0; i < win.frames.length; i++) { try { penetrate(win.frames[i]); } catch(e) {} } } " +
                "  setInterval(function() { penetrate(window); }, 1000); " +
                "})();", null); 
    }
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (controller != null) {
                // Keep notification bar visible on Player page (per request)
                controller.show(WindowInsetsCompat.Type.statusBars());
                controller.setAppearanceLightStatusBars(false); // White icons
                getWindow().setStatusBarColor(Color.BLACK);
                
                if (isFullscreenMode) {
                    controller.hide(WindowInsetsCompat.Type.navigationBars());
                } else {
                    controller.show(WindowInsetsCompat.Type.navigationBars());
                }
                controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (isFullscreenMode) {
            toggleFullscreenInPlace();
            return;
        }
        NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        MainActivity.pendingBackToDetails = true;
        if (navigationListener != null) {
            navigationListener.onBack();
        }
        super.onBackPressed();
        overridePendingTransition(0, 0);
    }

    @Override protected void onDestroy() { 
        if (currentInstance == this) currentInstance = null;
        
        // --- CLEANUP: REMOVE WEB MARGIN ---
        if (MainActivity.instance != null && MainActivity.instance.getBridge() != null) {
            WebView mainWebView = MainActivity.instance.getBridge().getWebView();
            if (mainWebView != null) {
                mainWebView.evaluateJavascript("document.body.style.marginTop = '0px';", null);
            }
        }

        NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        updateHandler.removeCallbacksAndMessages(null); 
        hideHandler.removeCallbacksAndMessages(null); 
        if (exoPlayer != null) {
            exoPlayer.stop();
            exoPlayer.release();
            exoPlayer = null;
        }
        if (playerWebView != null) { playerWebView.stopLoading(); playerWebView.destroy(); } 
        super.onDestroy(); 
        // INSTANT EXIT: Disable the slide-down animation
        overridePendingTransition(0, 0);
    }
}
