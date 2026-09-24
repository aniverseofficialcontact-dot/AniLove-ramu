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
import android.graphics.Rect;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.Icon;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.DisplayMetrics;
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
import android.webkit.CookieManager;
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

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
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
    
    // Volume / Brightness
    private boolean isAdvancePlayerEnabled = false;
    private TextView indicatorVolume, indicatorBrightness;
    private AudioManager audioManager;
    private int initialVolume = -1;
    private float initialBrightness = -1.0f;
    
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

    // Real-Time Dynamic Media Track States
    private List<String> detectedQualities = new ArrayList<>();
    private List<String> detectedAudios = new ArrayList<>();
    private List<String> detectedSubtitles = new ArrayList<>();
    private String currentSelectedQuality = "Auto";
    private String currentSelectedAudio = "Hindi";
    private String currentSelectedSubtitle = "Off";
    
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
    private String subtitleUrl = null;
    private String subtitleLang = "English";
    
    private Handler updateHandler = new Handler(Looper.getMainLooper());
    private Handler hideHandler = new Handler(Looper.getMainLooper());
    private GestureDetector gestureDetector;

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
        overridePendingTransition(0, 0);
        setIntent(intent);
        updateMetadataFromIntent(intent);
        applyWindowSettings(intent);

        isPlaying = true;
        if (loadingProgress != null) loadingProgress.setVisibility(View.VISIBLE);

        if (playerWebView != null) {
            playerWebView.stopLoading();
        }
        if (exoPlayer != null) {
            exoPlayer.stop();
        }

        isOfflineMode = intent.getBooleanExtra("offlineMode", false);
        if (isOfflineMode) {
            if (playerWebView != null) playerWebView.setVisibility(View.GONE);
            if (exoPlayerView != null) exoPlayerView.setVisibility(View.VISIBLE);
            setupExoPlayer(intent.getStringExtra("localFilePath"), intent.getStringExtra("localSubPath"));
        } else {
            if (exoPlayerView != null) exoPlayerView.setVisibility(View.GONE);
            if (playerWebView != null) {
                playerWebView.setVisibility(View.VISIBLE);
                String url = intent.getStringExtra("url");
                if (url != null && !url.isEmpty()) {
                    setupHybridEngine(url);
                }
            }
        }
        resetHideTimer();
    }

    private int getPhysicalScreenWidth() {
        DisplayMetrics dm = new DisplayMetrics();
        getWindowManager().getDefaultDisplay().getRealMetrics(dm);
        return Math.min(dm.widthPixels, dm.heightPixels);
    }

    private void updateMetadataFromIntent(Intent intent) {
        if (intent == null) return;
        String animeTitle = intent.getStringExtra("animeTitle");
        if (animeTitle == null || animeTitle.isEmpty()) {
            animeTitle = intent.getStringExtra("title");
        }
        if (animeTitle == null || animeTitle.isEmpty()) {
            animeTitle = "Now Playing";
        }
        int epNum = intent.getIntExtra("episodeNumber", 1);
        startTime = intent.getIntExtra("startTime", 0);
        subtitleUrl = intent.getStringExtra("subtitleUrl");
        subtitleLang = intent.getStringExtra("subtitleLang");
        if (subtitleLang == null || subtitleLang.isEmpty()) subtitleLang = "English";
        String audio = intent.getStringExtra("audio");
        if (audio == null || audio.isEmpty()) audio = "DUB";

        TextView videoTitleView = findViewById(R.id.video_title);
        TextView portraitAnimeTitle = findViewById(R.id.portrait_anime_title);
        TextView portraitEpSubtitle = findViewById(R.id.portrait_episode_subtitle);
        TextView portraitBadgeAudio = findViewById(R.id.portrait_badge_audio);

        if (videoTitleView != null) videoTitleView.setText(animeTitle + " - EP " + epNum);
        if (portraitAnimeTitle != null) portraitAnimeTitle.setText(animeTitle);
        if (portraitEpSubtitle != null) portraitEpSubtitle.setText("Episode " + epNum);
        if (portraitBadgeAudio != null) portraitBadgeAudio.setText(audio.toUpperCase());
    }

    private int currentY = 0;
    private int startTime = 0;

    private void applyWindowSettings(Intent intent) {
        if (intent == null) intent = getIntent();
        isFullscreenMode = intent.getBooleanExtra("startFullscreen", false);
        isOfflineMode = intent.getBooleanExtra("offlineMode", isOfflineMode);
        if (intent.hasExtra("yOffset")) {
            currentY = intent.getIntExtra("yOffset", 0);
        }
        Log.i("AniLove", "applyWindowSettings | isFullscreen: " + isFullscreenMode + " | isOffline: " + isOfflineMode);
        
        final Window window = getWindow();
        final View decorView = window.getDecorView();
        
        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        
        decorView.post(() -> {
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
            if (controller != null) {
                if (isFullscreenMode) {
                    controller.hide(WindowInsetsCompat.Type.statusBars());
                    controller.hide(WindowInsetsCompat.Type.navigationBars());
                    window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
                } else {
                    controller.show(WindowInsetsCompat.Type.statusBars());
                    controller.setAppearanceLightStatusBars(false);
                    window.setStatusBarColor(Color.BLACK);
                    controller.show(WindowInsetsCompat.Type.navigationBars());
                    window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
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
            NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);

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
                
                if (videoRoot != null) {
                    ViewGroup.LayoutParams lp = videoRoot.getLayoutParams();
                    lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                    lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
                    videoRoot.setLayoutParams(lp);
                }
                if (portraitBottom != null) portraitBottom.setVisibility(View.GONE);
                if (statusBarFiller != null) statusBarFiller.setVisibility(View.GONE);
                if (topBar != null) {
                    topBar.setPadding(topBar.getPaddingLeft(), 0, topBar.getPaddingRight(), topBar.getPaddingBottom());
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
                
                if (videoRoot != null) {
                    ViewGroup.LayoutParams lp = videoRoot.getLayoutParams();
                    lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                    lp.height = videoHeight + finalStatusBarHeight;
                    videoRoot.setLayoutParams(lp);
                }
                if (portraitBottom != null) portraitBottom.setVisibility(View.VISIBLE);
                if (statusBarFiller != null) {
                    statusBarFiller.setVisibility(View.VISIBLE);
                    ViewGroup.LayoutParams lp = statusBarFiller.getLayoutParams();
                    lp.height = finalStatusBarHeight;
                    statusBarFiller.setLayoutParams(lp);
                }
                if (topBar != null) {
                    topBar.setPadding(topBar.getPaddingLeft(), finalStatusBarHeight, topBar.getPaddingRight(), topBar.getPaddingBottom());
                }
            });
        } else {
            // PORTRAIT STREAMING: Floating Top Overlay over web view
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
            params.y = currentY;

            final int finalStatusBarHeight = statusBarHeight;
            decorView.post(() -> {
                View videoRoot = findViewById(R.id.video_root_container);
                View portraitBottom = findViewById(R.id.portrait_bottom_container);
                View statusBarFiller = findViewById(R.id.status_bar_filler);
                View topBar = findViewById(R.id.top_bar);
                
                if (videoRoot != null) {
                    ViewGroup.LayoutParams lp = videoRoot.getLayoutParams();
                    lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                    lp.height = videoHeight + finalStatusBarHeight;
                    videoRoot.setLayoutParams(lp);
                }
                if (portraitBottom != null) portraitBottom.setVisibility(View.GONE);
                if (statusBarFiller != null) {
                    statusBarFiller.setVisibility(View.VISIBLE);
                    ViewGroup.LayoutParams lp = statusBarFiller.getLayoutParams();
                    lp.height = finalStatusBarHeight;
                    statusBarFiller.setLayoutParams(lp);
                }
                if (topBar != null) {
                    topBar.setPadding(topBar.getPaddingLeft(), finalStatusBarHeight, topBar.getPaddingRight(), topBar.getPaddingBottom());
                }
            });
        }
        
        window.setAttributes(params);
    }

    private void toggleFullscreenInPlace() {
        new Handler(Looper.getMainLooper()).post(() -> {
            isFullscreenMode = !isFullscreenMode;
            Log.i("AniLove", "toggleFullscreenInPlace | now: " + isFullscreenMode);
            
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
        
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        isOfflineMode = getIntent().getBooleanExtra("offlineMode", false);
        if (isOfflineMode) {
            getWindow().setBackgroundDrawable(new ColorDrawable(Color.BLACK));
        } else {
            getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        }
        
        setContentView(R.layout.activity_native_player);
        updateMetadataFromIntent(getIntent());
        applyWindowSettings(getIntent());
        
        overridePendingTransition(0, 0);

        // UI Initialization
        playerWebView = findViewById(R.id.player_webview);
        playerWebView.setBackgroundColor(Color.BLACK);

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
        
        // Volume / Brightness Init
        isAdvancePlayerEnabled = getIntent().getBooleanExtra("advancePlayer", false);
        indicatorVolume = findViewById(R.id.indicator_volume);
        indicatorBrightness = findViewById(R.id.indicator_brightness);
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        
        findViewById(R.id.close_button).setOnClickListener(v -> {
            if (navigationListener != null) {
                navigationListener.onBack();
            }
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

        View btnSkipIntro = findViewById(R.id.btn_skip_intro);
        btnSkipIntro.setOnClickListener(v -> seekVideo(85));
        
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
            }
            @Override public void onStopTrackingTouch(SeekBar s) { 
                isDragging = false; 
                if (isOfflineMode && exoPlayer != null) {
                    long duration = exoPlayer.getDuration();
                    if (duration > 0 && duration != C.TIME_UNSET) {
                        long targetMs = s.getProgress() * 1000L;
                        exoPlayer.seekTo(Math.min(targetMs, duration));
                    }
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
            playerWebView.addJavascriptInterface(new ScrubberInterface(), "AndroidScrubber");
            setupHybridEngine(getIntent().getStringExtra("url") != null ? getIntent().getStringExtra("url") : "");
        }
        startUpdateLoop();
        resetHideTimer();
    }

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
            if (effectiveSubPath != null && !effectiveSubPath.isEmpty()) {
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

    public void updatePosition(int y) {
        if (isFullscreenMode || isOfflineMode) return;
        currentY = y;
        runOnUiThread(() -> {
            try {
                Window window = getWindow();
                if (window != null) {
                    WindowManager.LayoutParams params = window.getAttributes();
                    params.y = y;
                    window.setAttributes(params);
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
        scrubberContainer.setTranslationY(40);
    }

    public class ScrubberInterface {
        @JavascriptInterface
        public void processFrame(String base64) {}

        @JavascriptInterface
        public void onMediaOptions(String json) {
            if (json == null || json.isEmpty()) return;
            try {
                JSONObject obj = new JSONObject(json);
                JSONArray qArr = obj.optJSONArray("qualities");
                if (qArr != null && qArr.length() > 0) {
                    List<String> list = new ArrayList<>();
                    for (int i = 0; i < qArr.length(); i++) {
                        String q = qArr.getString(i);
                        if (q != null && !q.isEmpty() && !list.contains(q)) list.add(q);
                    }
                    if (!list.isEmpty()) detectedQualities = list;
                }
                JSONArray aArr = obj.optJSONArray("audios");
                if (aArr != null && aArr.length() > 0) {
                    List<String> list = new ArrayList<>();
                    for (int i = 0; i < aArr.length(); i++) {
                        String a = aArr.getString(i);
                        if (a != null && !a.isEmpty() && !list.contains(a)) list.add(a);
                    }
                    if (!list.isEmpty()) detectedAudios = list;
                }
                JSONArray sArr = obj.optJSONArray("subtitles");
                if (sArr != null && sArr.length() > 0) {
                    List<String> list = new ArrayList<>();
                    for (int i = 0; i < sArr.length(); i++) {
                        String s = sArr.getString(i);
                        if (s != null && !s.isEmpty() && !list.contains(s)) list.add(s);
                    }
                    if (!list.isEmpty()) detectedSubtitles = list;
                }
                String cQ = obj.optString("currentQuality");
                if (cQ != null && !cQ.isEmpty() && !cQ.equals("null")) currentSelectedQuality = cQ;
                String cA = obj.optString("currentAudio");
                if (cA != null && !cA.isEmpty() && !cA.equals("null")) {
                    currentSelectedAudio = cA;
                    updateAudioBadge(cA);
                }
                String cS = obj.optString("currentSub");
                if (cS != null && !cS.isEmpty() && !cS.equals("null")) currentSelectedSubtitle = cS;
            } catch (Exception ignored) {}
        }
    }

    private void changeVideoQuality(String quality) {
        if (playerWebView == null) return;
        String js = "(function() { " +
                "  var q = '" + quality.replace("'", "\\'") + "'; " +
                "  function setQ(w) { try { " +
                "    if (w.hls && w.hls.levels) { " +
                "      if (q.toLowerCase() === 'auto') { w.hls.currentLevel = -1; return true; } " +
                "      for (var i = 0; i < w.hls.levels.length; i++) { " +
                "        var lvl = w.hls.levels[i]; " +
                "        var lbl = (lvl.name || (lvl.height ? lvl.height + 'p' : '')).toLowerCase(); " +
                "        if (lbl.indexOf(q.toLowerCase()) !== -1) { w.hls.currentLevel = i; return true; } " +
                "      } " +
                "    } " +
                "    if (typeof w.jwplayer === 'function') { " +
                "      var p = w.jwplayer(); " +
                "      if (p && typeof p.getQualityLevels === 'function') { " +
                "        var qList = p.getQualityLevels(); " +
                "        for (var j = 0; j < qList.length; j++) { " +
                "          var jLbl = (qList[j].label || (qList[j].height ? qList[j].height + 'p' : '')).toLowerCase(); " +
                "          if (jLbl.indexOf(q.toLowerCase()) !== -1) { p.setCurrentQuality(j); return true; } " +
                "        } " +
                "      } " +
                "    } " +
                "  } catch(e) {} " +
                "  for (var f = 0; f < w.frames.length; f++) { try { if (setQ(w.frames[f])) return true; } catch(e) {} } " +
                "  return false; } " +
                "  setQ(window); " +
                "})();";
        playerWebView.evaluateJavascript(js, null);
    }

    private void changeAudioLanguage(String audioLang) {
        if (playerWebView == null) return;
        String js = "(function() { " +
                "  var target = '" + audioLang.replace("'", "\\'").toLowerCase() + "'; " +
                "  function match(name) { " +
                "    if (!name) return false; " +
                "    var n = name.toLowerCase(); " +
                "    if (target.indexOf('hin') !== -1) return n.indexOf('hin') !== -1 || n.indexOf('hi') !== -1; " +
                "    if (target.indexOf('eng') !== -1 || target.indexOf('dub') !== -1) return n.indexOf('eng') !== -1 || n.indexOf('en') !== -1 || n.indexOf('dub') !== -1; " +
                "    if (target.indexOf('jpn') !== -1 || target.indexOf('sub') !== -1 || target.indexOf('jap') !== -1) return n.indexOf('jpn') !== -1 || n.indexOf('ja') !== -1 || n.indexOf('sub') !== -1 || n.indexOf('orig') !== -1; " +
                "    if (target.indexOf('tam') !== -1) return n.indexOf('tam') !== -1 || n.indexOf('ta') !== -1; " +
                "    if (target.indexOf('tel') !== -1) return n.indexOf('tel') !== -1 || n.indexOf('te') !== -1; " +
                "    if (target.indexOf('mal') !== -1) return n.indexOf('mal') !== -1 || n.indexOf('ml') !== -1; " +
                "    if (target.indexOf('kan') !== -1) return n.indexOf('kan') !== -1 || n.indexOf('kn') !== -1; " +
                "    if (target.indexOf('ben') !== -1) return n.indexOf('ben') !== -1 || n.indexOf('bn') !== -1; " +
                "    return n.indexOf(target) !== -1; " +
                "  } " +
                "  function setA(w) { try { " +
                "    if (w.hls && w.hls.audioTracks) { " +
                "      for (var i = 0; i < w.hls.audioTracks.length; i++) { " +
                "        var at = w.hls.audioTracks[i]; " +
                "        var all = ((at.name || '') + ' ' + (at.label || '') + ' ' + (at.lang || '')).toLowerCase(); " +
                "        if (match(all)) { w.hls.audioTrack = i; return true; } " +
                "      } " +
                "    } " +
                "    if (typeof w.jwplayer === 'function') { " +
                "      var p = w.jwplayer(); " +
                "      if (p && typeof p.getAudioTracks === 'function') { " +
                "        var tracks = p.getAudioTracks(); " +
                "        for (var j = 0; j < tracks.length; j++) { " +
                "          var jAll = ((tracks[j].name || '') + ' ' + (tracks[j].label || '') + ' ' + (tracks[j].language || '')).toLowerCase(); " +
                "          if (match(jAll)) { p.setCurrentAudioTrack(j); return true; } " +
                "        } " +
                "      } " +
                "    } " +
                "    var vids = w.document.querySelectorAll('video'); " +
                "    for (var v = 0; v < vids.length; v++) { " +
                "      var vid = vids[v]; " +
                "      if (vid.audioTracks && vid.audioTracks.length > 0) { " +
                "        for (var a = 0; a < vid.audioTracks.length; a++) { " +
                "          var tr = vid.audioTracks[a]; " +
                "          var trAll = ((tr.label || '') + ' ' + (tr.language || '')).toLowerCase(); " +
                "          if (match(trAll)) { " +
                "            for (var o = 0; o < vid.audioTracks.length; o++) vid.audioTracks[o].enabled = (o === a); " +
                "            return true; " +
                "          } " +
                "        } " +
                "      } " +
                "    } " +
                "    var langBtns = w.document.querySelectorAll('.server-item, .language-item, .lang-btn, [data-lang], [data-audio]'); " +
                "    for (var b = 0; b < langBtns.length; b++) { " +
                "      var bTxt = (langBtns[b].innerText || langBtns[b].getAttribute('data-lang') || '').toLowerCase(); " +
                "      if (match(bTxt)) { langBtns[b].click(); return true; } " +
                "    } " +
                "  } catch(e) {} " +
                "  for (var f = 0; f < w.frames.length; f++) { try { if (setA(w.frames[f])) return true; } catch(e) {} } " +
                "  return false; } " +
                "  setA(window); " +
                "})();";
        playerWebView.evaluateJavascript(js, null);
    }

    private void changeSubtitleTrack(String subTrack) {
        if (playerWebView == null) return;
        String js = "(function() { " +
                "  var target = '" + subTrack.replace("'", "\\'").toLowerCase() + "'; " +
                "  function setS(w) { try { " +
                "    if (w.hls && w.hls.subtitleTracks) { " +
                "      if (target === 'off') { w.hls.subtitleTrack = -1; return true; } " +
                "      for (var i = 0; i < w.hls.subtitleTracks.length; i++) { " +
                "        var st = w.hls.subtitleTracks[i]; " +
                "        var sAll = ((st.name || '') + ' ' + (st.label || '') + ' ' + (st.lang || '')).toLowerCase(); " +
                "        if (sAll.indexOf(target) !== -1) { w.hls.subtitleTrack = i; return true; } " +
                "      } " +
                "    } " +
                "    if (typeof w.jwplayer === 'function') { " +
                "      var p = w.jwplayer(); " +
                "      if (p && typeof p.getCaptionsList === 'function') { " +
                "        var cList = p.getCaptionsList(); " +
                "        for (var j = 0; j < cList.length; j++) { " +
                "          var cAll = ((cList[j].label || '') + ' ' + (cList[j].language || '')).toLowerCase(); " +
                "          if (target === 'off' && cList[j].id === 'off') { p.setCurrentCaptions(j); return true; } " +
                "          if (cAll.indexOf(target) !== -1) { p.setCurrentCaptions(j); return true; } " +
                "        } " +
                "      } " +
                "    } " +
                "    var vids = w.document.querySelectorAll('video'); " +
                "    for (var v = 0; v < vids.length; v++) { " +
                "      var vid = vids[v]; " +
                "      if (vid.textTracks) { " +
                "        for (var t = 0; t < vid.textTracks.length; t++) { " +
                "          var tt = vid.textTracks[t]; " +
                "          var ttAll = ((tt.label || '') + ' ' + (tt.language || '')).toLowerCase(); " +
                "          if (target === 'off') { tt.mode = 'disabled'; } " +
                "          else if (ttAll.indexOf(target) !== -1) { tt.mode = 'showing'; } " +
                "          else { tt.mode = 'hidden'; } " +
                "        } " +
                "      } " +
                "    } " +
                "  } catch(e) {} " +
                "  for (var f = 0; f < w.frames.length; f++) { try { if (setS(w.frames[f])) return true; } catch(e) {} } " +
                "  return false; } " +
                "  setS(window); " +
                "})();";
        playerWebView.evaluateJavascript(js, null);
    }

    private boolean isAudioMatch(String opt, String target) {
        if (opt == null || target == null) return false;
        String o = opt.toLowerCase();
        String t = target.toLowerCase();
        if (o.equals(t)) return true;
        if (t.contains("hin") && o.contains("hin")) return true;
        if ((t.contains("eng") || t.contains("dub")) && (o.contains("eng") || o.contains("dub"))) return true;
        if ((t.contains("jpn") || t.contains("sub") || t.contains("jap")) && (o.contains("jpn") || o.contains("sub") || o.contains("jap"))) return true;
        if (t.contains("tam") && o.contains("tam")) return true;
        if (t.contains("tel") && o.contains("tel")) return true;
        if (t.contains("mal") && o.contains("mal")) return true;
        if (t.contains("kan") && o.contains("kan")) return true;
        if (t.contains("ben") && o.contains("ben")) return true;
        return false;
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
            isPlaying = false;
            // Pause: set data-manual-pause on video AND _aniloveManualPause flag across all frames
            sendVideoCommand("v.pause(); v.setAttribute('data-manual-pause', 'true');");
            if (playerWebView != null) {
                playerWebView.evaluateJavascript(
                    "(function(){ " +
                    "  function setP(w){ " +
                    "    try { " +
                    "      w._aniloveManualPause = true; " +
                    "      var v = w.document.querySelector('video'); " +
                    "      if (v) { v.pause(); v.setAttribute('data-manual-pause', 'true'); } " +
                    "      if (typeof w.jwplayer === 'function') { try { w.jwplayer().pause(); } catch(e){} } " +
                    "    } catch(e){} " +
                    "    for(var i=0; i<w.frames.length; i++){ try{ setP(w.frames[i]); }catch(e){} } " +
                    "  } " +
                    "  setP(window); " +
                    "})();", null);
            }
            btnPlayPause.setImageResource(android.R.drawable.ic_media_play);
            stopHideTimer();
        } else {
            isPlaying = true;
            // Play: clear flags and play
            sendVideoCommand("v.removeAttribute('data-manual-pause'); v.play().catch(function(){});");
            if (playerWebView != null) {
                playerWebView.evaluateJavascript(
                    "(function(){ " +
                    "  function setP(w){ " +
                    "    try { " +
                    "      w._aniloveManualPause = false; " +
                    "      var v = w.document.querySelector('video'); " +
                    "      if (v) { v.removeAttribute('data-manual-pause'); v.play().catch(function(){}); } " +
                    "      if (typeof w.jwplayer === 'function') { try { w.jwplayer().play(); } catch(e){} } " +
                    "    } catch(e){} " +
                    "    for(var i=0; i<w.frames.length; i++){ try{ setP(w.frames[i]); }catch(e){} } " +
                    "  } " +
                    "  setP(window); " +
                    "})();", null);
            }
            btnPlayPause.setImageResource(android.R.drawable.ic_media_pause);
            resetHideTimer();
        }
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
                    
                    ContextCompat.registerReceiver(this, pipReceiver, new IntentFilter("ACTION_PIP_CONTROL"), ContextCompat.RECEIVER_EXPORTED);
                    updatePipParams();

                    PictureInPictureParams.Builder pipBuilder = new PictureInPictureParams.Builder()
                            .setAspectRatio(new Rational(16, 9));

                    if (playerWebView != null) {
                        Rect visibleRect = new Rect();
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
        final View portraitBottom = findViewById(R.id.portrait_bottom_container);
        final View videoRoot = findViewById(R.id.video_root_container);
        final View topBar = findViewById(R.id.top_bar);

        if (isInPictureInPictureMode) {
            hideControlsQuietly();
            findViewById(R.id.touch_wall).setVisibility(View.GONE);
            
            if (statusBarFiller != null) statusBarFiller.setVisibility(View.GONE);
            if (bottomGapFiller != null) bottomGapFiller.setVisibility(View.GONE);
            if (portraitBottom != null) portraitBottom.setVisibility(View.GONE);
            if (topBar != null) topBar.setVisibility(View.GONE);
            if (videoRoot != null) {
                ViewGroup.LayoutParams lp = videoRoot.getLayoutParams();
                lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
                videoRoot.setLayoutParams(lp);
            }
        } else {
            findViewById(R.id.touch_wall).setVisibility(View.VISIBLE);
            try {
                unregisterReceiver(pipReceiver);
            } catch (Exception e) {}

            applyWindowSettings(getIntent());
            if (isControlsVisible) toggleControlsVisibility();
        }
    }

    private void showSettingsMenu() {
        BottomSheetDialog dialog = new BottomSheetDialog(this);
        View view = getLayoutInflater().inflate(R.layout.settings_bottom_sheet, null);
        dialog.setContentView(view);
        BottomSheetBehavior behavior = BottomSheetBehavior.from((View) view.getParent());
        behavior.setState(BottomSheetBehavior.STATE_EXPANDED);

        // 1. Dynamic Video Quality Buttons
        LinearLayout qualityContainer = view.findViewById(R.id.quality_container);
        if (qualityContainer != null) {
            qualityContainer.removeAllViews();
            List<String> qList = new ArrayList<>(detectedQualities);
            if (qList.isEmpty()) {
                qList.add("Auto");
                qList.add("1080p");
                qList.add("720p");
                qList.add("480p");
                qList.add("360p");
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
            List<String> aList = new ArrayList<>(detectedAudios);
            if (aList.isEmpty()) {
                aList.add("Hindi");
                aList.add("ENG (Dub)");
                aList.add("JAP (Sub)");
                aList.add("Tamil");
                aList.add("Telugu");
                aList.add("Malayalam");
                aList.add("Kannada");
                aList.add("Bengali");
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

        // Setup Subtitle Track group if multiple detected
        LinearLayout groupTrack = view.findViewById(R.id.group_caption_track);
        TextView labelTrack = view.findViewById(R.id.label_caption_track);
        View scrollTrack = view.findViewById(R.id.scroll_caption_track);

        if (groupTrack != null && labelTrack != null && scrollTrack != null) {
            List<String> subList = new ArrayList<>(detectedSubtitles);
            if (!subList.contains("Off")) subList.add(0, "Off");
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
    private void applyVolumeBoost(boolean boosted) { playerWebView.evaluateJavascript("(function() { if (!window.audioCtx) { try { window.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); var v = document.querySelector('video'); if (v) { window.source = window.audioCtx.createMediaElementSource(v); window.gainNode = window.audioCtx.createGain(); window.source.connect(window.gainNode); window.gainNode.connect(window.audioCtx.destination); } } catch(e) {} } if (window.gainNode) window.gainNode.gain.value = " + (boosted ? "2.5" : "1.0") + "; })();", null); }
    
    private void toggleWebSubtitles(boolean enabled) { 
        isSubtitlesEnabled = enabled;
        String visibility = enabled ? "visible" : "hidden";
        String opacity = enabled ? "1" : "0";

        // Powerful selector that catches almost all player subtitles
        String selectors = ".jw-captions, .vjs-text-track-display, .ytp-caption-window-container, .caption-window, " +
                     ".subtitles, .captions, .art-subtitle, .artplayer-subtitles, .art-subtitles, .plyr__captions, " +
                     ".shaka-text-container, .fluid_subtitles, .bitmovin-player-subtitle-overlay, " +
                     "[class*='subtitle'], [class*='caption'], [id*='subtitle'], [id*='caption']";

        String css = selectors + " { visibility: " + visibility + " !important; opacity: " + opacity + " !important; display: block !important; } " +
                     selectors + " * { visibility: " + visibility + " !important; opacity: " + opacity + " !important; }";

        String js = "(function() { " +
                "  var remoteSubUrl = '" + (subtitleUrl != null ? subtitleUrl : "") + "'; " +
                "  var remoteSubLang = '" + (subtitleLang != null ? subtitleLang : "English") + "'; " +
                "  function toggle(win) { try { " +
                "    var doc = win.document; " +
                "    var style = doc.getElementById('anilove-caption-toggle-style') || doc.createElement('style'); " +
                "    style.id = 'anilove-caption-toggle-style'; " +
                "    style.innerHTML = '" + css + "'; " +
                "    if(!style.parentNode) doc.head.appendChild(style); " +
                "    var videos = doc.querySelectorAll('video'); " +
                "    videos.forEach(function(v) { " +
                "      if (remoteSubUrl && !doc.querySelector('track[src=\"' + remoteSubUrl + '\"]')) { " +
                "        var t = doc.createElement('track'); " +
                "        t.src = remoteSubUrl; t.kind = 'subtitles'; t.label = remoteSubLang; t.srclang = 'en'; t.default = true; " +
                "        v.appendChild(t); " +
                "      } " +
                "      if (v.textTracks) { " +
                "        var hasCustom = doc.querySelector('" + selectors + "'); " +
                "        var customVisible = hasCustom && (hasCustom.offsetHeight > 0 || hasCustom.innerText.trim().length > 0); " +
                "        for (var i = 0; i < v.textTracks.length; i++) { " +
                "          var tr = v.textTracks[i]; " +
                "          if (!" + enabled + ") { tr.mode = 'disabled'; } " +
                "          else if (tr.label === remoteSubLang) { tr.mode = 'showing'; } " +
                "          else { tr.mode = customVisible ? 'hidden' : 'showing'; } " +
                "        } " +
                "      } " +
                "    }); " +
                "  } catch(e) {} " +
                "  for (var i = 0; i < win.frames.length; i++) { try { toggle(win.frames[i]); } catch(e) {} } } " +
                "  toggle(window); " +
                "})();";

        playerWebView.evaluateJavascript(js, null);

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

        String containerSelectors = ".art-subtitle, .artplayer-subtitles, .art-subtitles, " +
                ".jw-captions, .jw-text-track-container, .vjs-text-track-display, " +
                ".ytp-caption-window-container, .caption-window, .subtitles, .captions, .plyr__captions, " +
                ".shaka-text-container, .fluid_subtitles, .bitmovin-player-subtitle-overlay";

        String containerSelectorsJs = containerSelectors.replace("'", "\\'");

        String textSelectors = ".art-subtitle p, .art-subtitle span, .art-subtitle-item, " +
                ".artplayer-subtitles p, .artplayer-subtitles span, " +
                ".art-subtitles p, .art-subtitles span, " +
                ".jw-text-track-cue, .jw-caption-content, .jw-captions span, " +
                ".vjs-text-track-cue, .vjs-text-track-cue *, " +
                ".ytp-caption-segment, .plyr__caption, " +
                ".shaka-text-container span, .fluid_subtitles span, " +
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
                containerSelectors + ", " + containerSelectors + " * { " +
                "  color: " + captionColorHex + " !important; " +
                "  -webkit-text-fill-color: " + captionColorHex + " !important; " +
                "  font-size: " + (captionFontSize * 0.02) + "vw !important; " +
                "  font-weight: " + captionWeight.toLowerCase() + " !important; " +
                "  text-shadow: " + shadowCss + " !important; " +
                "} " +
                textSelectors + " { " +
                "  background: " + bgRgba + " !important; " +
                "  background-color: " + bgRgba + " !important; " +
                "  padding: " + padding + " " +
                "  border-radius: " + borderRadius + " " +
                "  display: inline-block !important; " +
                "} ";

        // Escape single quotes in CSS so it's safe to embed inside JS single-quoted string
        String cssEscaped = css.replace("\\", "\\\\").replace("'", "\\'");

        String js = "(function() { " +
                "  function apply(win) { try { " +
                "    var doc = win.document; " +
                "    var style = doc.getElementById('anilove-caption-style') || doc.createElement('style'); " +
                "    style.id = 'anilove-caption-style'; " +
                "    style.textContent = '" + cssEscaped + "'; " +
                "    if(!style.parentNode && doc.head) doc.head.appendChild(style); " +
                "    var artSubs = doc.querySelectorAll('.art-subtitle'); " +
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
                "    var v = doc.querySelector('video'); " +
                "    if (v && v.textTracks) { " +
                "      var hasCustom = doc.querySelector('" + containerSelectorsJs + "'); " +
                "      var customVisible = hasCustom && (hasCustom.offsetHeight > 0 || hasCustom.innerText.trim().length > 0); " +
                "      if (customVisible) { " +
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
            if (loadingProgress != null) loadingProgress.setVisibility(View.VISIBLE);
            navigationListener.onNavigate(next);
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
            long duration = exoPlayer.getDuration();
            if (duration <= 0 || duration == C.TIME_UNSET) {
                duration = Long.MAX_VALUE;
            }
            long current = exoPlayer.getCurrentPosition();
            if (current == C.TIME_UNSET) {
                current = 0;
            }
            long newPos = Math.max(0, Math.min(duration, current + (delta * 1000L)));
            exoPlayer.seekTo(newPos);
            return;
        }
        sendVideoCommand("v.currentTime += " + delta + ";");
    }

    private void startUpdateLoop() { 
        updateHandler.postDelayed(new Runnable() { 
            @Override public void run() { 
                syncPlayerState(); 
                updateHandler.postDelayed(this, 1000); 
            } 
        }, 1000); 
    }

    private void syncPlayerState() {
        if (isOfflineMode && exoPlayer != null) {
            long currentMs = exoPlayer.getCurrentPosition();
            long durationMs = exoPlayer.getDuration();
            if (durationMs > 0 && durationMs != C.TIME_UNSET) {
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

        if (playerWebView == null) return;

        // Run continuous ad eraser sweep & auto-cleanse
        injectAdEraser();

        playerWebView.evaluateJavascript("(function() { " +
                "function scan(w) { " +
                "  var qualities = []; var audios = []; var subtitles = []; " +
                "  var currentQuality = ''; var currentAudio = ''; var currentSub = ''; " +
                "  function probe(win) { " +
                "    try { " +
                "      var d = win.document; " +
                "      if (typeof win.jwplayer === 'function') { " +
                "        var p = win.jwplayer(); " +
                "        if (p && typeof p.getQualityLevels === 'function') { " +
                "          var qList = p.getQualityLevels(); " +
                "          if (qList && qList.length > 0) { " +
                "            var curQ = p.getCurrentQuality(); " +
                "            for (var i = 0; i < qList.length; i++) { " +
                "              var lbl = qList[i].label || (qList[i].height ? qList[i].height + 'p' : 'Auto'); " +
                "              if (qualities.indexOf(lbl) === -1) qualities.push(lbl); " +
                "              if (curQ === i) currentQuality = lbl; " +
                "            } " +
                "          } " +
                "        } " +
                "        if (p && typeof p.getAudioTracks === 'function') { " +
                "          var aList = p.getAudioTracks(); " +
                "          if (aList && aList.length > 0) { " +
                "            var curA = p.getCurrentAudioTrack(); " +
                "            for (var j = 0; j < aList.length; j++) { " +
                "              var aLbl = aList[j].name || aList[j].label || aList[j].language || ('Audio ' + (j + 1)); " +
                "              if (audios.indexOf(aLbl) === -1) audios.push(aLbl); " +
                "              if (curA === j) currentAudio = aLbl; " +
                "            } " +
                "          } " +
                "        } " +
                "        if (p && typeof p.getCaptionsList === 'function') { " +
                "          var cList = p.getCaptionsList(); " +
                "          if (cList && cList.length > 0) { " +
                "            var curC = p.getCurrentCaptions(); " +
                "            for (var k = 0; k < cList.length; k++) { " +
                "              var cLbl = cList[k].label || cList[k].language || ('Caption ' + (k + 1)); " +
                "              if (subtitles.indexOf(cLbl) === -1) subtitles.push(cLbl); " +
                "              if (curC === k) currentSub = cLbl; " +
                "            } " +
                "          } " +
                "        } " +
                "      } " +
                "      if (win.hls) { " +
                "        if (win.hls.levels && win.hls.levels.length > 0) { " +
                "          if (qualities.indexOf('Auto') === -1) qualities.push('Auto'); " +
                "          for (var l = 0; l < win.hls.levels.length; l++) { " +
                "            var lvl = win.hls.levels[l]; " +
                "            var hLbl = lvl.name || (lvl.height ? lvl.height + 'p' : ('Level ' + l)); " +
                "            if (qualities.indexOf(hLbl) === -1) qualities.push(hLbl); " +
                "            if (win.hls.currentLevel === l) currentQuality = hLbl; " +
                "          } " +
                "          if (win.hls.currentLevel === -1) currentQuality = 'Auto'; " +
                "        } " +
                "        if (win.hls.audioTracks && win.hls.audioTracks.length > 0) { " +
                "          for (var m = 0; m < win.hls.audioTracks.length; m++) { " +
                "            var at = win.hls.audioTracks[m]; " +
                "            var atLbl = at.name || at.label || at.lang || ('Audio ' + (m + 1)); " +
                "            if (audios.indexOf(atLbl) === -1) audios.push(atLbl); " +
                "            if (win.hls.audioTrack === m) currentAudio = atLbl; " +
                "          } " +
                "        } " +
                "        if (win.hls.subtitleTracks && win.hls.subtitleTracks.length > 0) { " +
                "          for (var n = 0; n < win.hls.subtitleTracks.length; n++) { " +
                "            var st = win.hls.subtitleTracks[n]; " +
                "            var stLbl = st.name || st.label || st.lang || ('Sub ' + (n + 1)); " +
                "            if (subtitles.indexOf(stLbl) === -1) subtitles.push(stLbl); " +
                "            if (win.hls.subtitleTrack === n) currentSub = stLbl; " +
                "          } " +
                "        } " +
                "      } " +
                "      var vids = d.querySelectorAll('video'); " +
                "      for (var v = 0; v < vids.length; v++) { " +
                "        var vid = vids[v]; " +
                "        if (vid.audioTracks && vid.audioTracks.length > 0) { " +
                "          for (var a = 0; a < vid.audioTracks.length; a++) { " +
                "            var tr = vid.audioTracks[a]; " +
                "            var trLbl = tr.label || tr.language || ('Audio ' + (a + 1)); " +
                "            if (audios.indexOf(trLbl) === -1) audios.push(trLbl); " +
                "            if (tr.enabled) currentAudio = trLbl; " +
                "          } " +
                "        } " +
                "        if (vid.textTracks && vid.textTracks.length > 0) { " +
                "          for (var t = 0; t < vid.textTracks.length; t++) { " +
                "            var tt = vid.textTracks[t]; " +
                "            var ttLbl = tt.label || tt.language || ('Subtitle ' + (t + 1)); " +
                "            if (subtitles.indexOf(ttLbl) === -1) subtitles.push(ttLbl); " +
                "            if (tt.mode === 'showing') currentSub = ttLbl; " +
                "          } " +
                "        } " +
                "      } " +
                "      var langBtns = d.querySelectorAll('.server-item, .language-item, .lang-btn, [data-lang], [data-audio]'); " +
                "      langBtns.forEach(function(b) { " +
                "        var bTxt = (b.innerText || b.getAttribute('data-lang') || '').trim(); " +
                "        if (bTxt && audios.indexOf(bTxt) === -1) audios.push(bTxt); " +
                "      }); " +
                "    } catch(e) {} " +
                "    for (var f = 0; f < win.frames.length; f++) { try { probe(win.frames[f]); } catch(e) {} } " +
                "  } " +
                "  probe(w); " +
                "  return { qualities: qualities, audios: audios, subtitles: subtitles, currentQuality: currentQuality, currentAudio: currentAudio, currentSub: currentSub }; " +
                "} " +
                "var primaryVideo = null; " +
                "function penetrateAndPlay(win) { " +
                "  try { " +
                "    var form = win.document.querySelector('form#F1, form#f1, form[action*=\"/dl\"], form[name=\"F1\"]'); " +
                "    if (form && !form.hasAttribute('data-auto-sub')) { " +
                "      form.setAttribute('data-auto-sub', 'true'); " +
                "      form.submit(); " +
                "      return; " +
                "    } " +
                "    if (!primaryVideo) { " +
                "      var vids = win.document.querySelectorAll('video'); " +
                "      for (var vi = 0; vi < vids.length; vi++) { " +
                "        if (vids[vi].readyState >= 1 || vids[vi].src || vids[vi].currentSrc) { primaryVideo = vids[vi]; break; } " +
                "      } " +
                "      if (!primaryVideo && vids.length > 0) primaryVideo = vids[0]; " +
                "    } " +
                "    var globalPause = (typeof window._aniloveManualPause !== 'undefined' && window._aniloveManualPause === true) || " +
                "                      (typeof win._aniloveManualPause !== 'undefined' && win._aniloveManualPause === true); " +
                "    if (primaryVideo) { " +
                "      var manualPause = primaryVideo.hasAttribute('data-manual-pause') || globalPause; " +
                "      if (primaryVideo.muted) { primaryVideo.muted = false; } " +
                "      if (primaryVideo.volume < 1.0) { primaryVideo.volume = 1.0; } " +
                "      if (primaryVideo.paused && !manualPause) { " +
                "        primaryVideo.play().catch(function(){}); " +
                "      } " +
                "    } else if (!globalPause) { " +
                "      var bigPlay = win.document.querySelector('#overlay, #playback, #vid_play, #play_btn, .jw-display-icon-container, .vjs-big-play-button, .art-icon-play'); " +
                "      if (bigPlay && !bigPlay.hasAttribute('data-auto-clicked')) { bigPlay.setAttribute('data-auto-clicked','1'); try { bigPlay.click(); } catch(e){} } " +
                "      if (typeof win.jwplayer === 'function') { " +
                "        try { " +
                "          var jp = win.jwplayer(); " +
                "          if (jp && jp.getMute && jp.getMute()) jp.setMute(false); " +
                "          if (jp && jp.setVolume && jp.getVolume && jp.getVolume() < 100) jp.setVolume(100); " +
                "          if (jp && jp.getState && jp.getState() === 'idle') jp.play(); " +
                "        } catch(e){} " +
                "      } " +
                "    } " +
                "  } catch(e) {} " +
                "  for (var i = 0; i < win.frames.length; i++) { try { penetrateAndPlay(win.frames[i]); } catch(e) {} } " +
                "} " +
                "penetrateAndPlay(window); " +
                "var mediaOpts = scan(window); " +
                "if (window.AndroidScrubber && typeof window.AndroidScrubber.onMediaOptions === 'function') { " +
                "  try { window.AndroidScrubber.onMediaOptions(JSON.stringify(mediaOpts)); } catch(e) {} " +
                "} " +
                "return primaryVideo ? [primaryVideo.currentTime, primaryVideo.duration, primaryVideo.paused] : null; " +
                "})();", value -> { 
            if (value != null && !value.equals("null") && !value.isEmpty()) { 
                try { 
                    String[] parts = value.replace("[", "").replace("]", "").replace("\"", "").split(","); 
                    if (parts.length >= 3) { 
                        double current = Double.parseDouble(parts[0].trim()); 
                        double duration = Double.parseDouble(parts[1].trim()); 
                        boolean pausedInWeb = Boolean.parseBoolean(parts[2].trim()); 
                        
                        if (loadingProgress != null && (duration > 0 || current > 0 || !pausedInWeb)) {
                            loadingProgress.setVisibility(View.GONE);
                        }

                        textCurrentTime.setText(formatTime((int) current)); 
                        textTotalTime.setText(formatTime((int) duration)); 
                        
                        int timeLeft = (int) (duration - current);
                        textTimeLeft.setText("-" + formatTime(timeLeft));

                        if (!isDragging && duration > 0) { 
                            seekBar.setMax((int) duration); 
                            seekBar.setProgress((int) current); 
                        } 
                        if (pausedInWeb == isPlaying) { 
                            isPlaying = !pausedInWeb; 
                            btnPlayPause.setImageResource(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play); 
                            if (isPlaying) resetHideTimer(); else stopHideTimer(); 
                        }

                        // Broadcast progress to main app for "Continue Watching" sync
                        if (isPlaying && current > 0) {
                            broadcastProgress(current, duration);
                        }
                    } 
                } catch (Exception e) {} 
            } 
        }); 
    }

    private void broadcastProgress(double current, double duration) {
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

    private void sendVideoCommand(String jsAction) {
        if (playerWebView == null) return;
        // Determine JW command from Java side to avoid broken JS string embedding
        final String jwAction;
        if (jsAction.contains(".pause()") && !jsAction.contains(".play()")) {
            jwAction = "if (typeof win.jwplayer === 'function') { try { win.jwplayer().pause(); } catch(e) {} }";
        } else if (jsAction.contains(".play()")) {
            jwAction = "if (typeof win.jwplayer === 'function') { try { win.jwplayer().play(); } catch(e) {} }";
        } else if (jsAction.contains("playbackRate")) {
            String speedStr = jsAction.replaceAll(".*playbackRate\\s*=\\s*([0-9.]+).*", "$1");
            jwAction = "if (typeof win.jwplayer === 'function') { try { win.jwplayer().setPlaybackRate(" + speedStr + "); } catch(e) {} }";
        } else {
            jwAction = "";
        }
        playerWebView.evaluateJavascript("(function() { " +
                "function findAndExec(win) { " +
                "  try { " +
                "    var v = win.document.querySelector('video'); " +
                "    if (v) { " + jsAction + " } " +
                "    " + jwAction + " " +
                "  } catch(e) {} " +
                "  for (var i = 0; i < win.frames.length; i++) { " +
                "    try { findAndExec(win.frames[i]); } catch(e) {} " +
                "  } " +
                "} " +
                "findAndExec(window); " +
                "})();", null);
    }

    private String formatTime(int seconds) { return String.format(Locale.getDefault(), "%02d:%02d", (seconds < 0 ? 0 : seconds) / 60, (seconds < 0 ? 0 : seconds) % 60); }
    private boolean isDirectHls = false;

    private void setupHybridEngine(String url) {
        if (url == null || url.isEmpty() || playerWebView == null) return;
        
        WebSettings settings = playerWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

        try {
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(playerWebView, true);
        } catch (Exception ignored) {}
        
        playerWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                return false; // Block popup ads
            }

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
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String reqUrl = request.getUrl().toString();
                String lower = reqUrl.toLowerCase();
                if (lower.contains("abyss.to") || lower.contains("decafeligiblyhad") || lower.contains("adsterra") || 
                    lower.contains("popads") || lower.contains("monetag") || lower.contains("highperformancegate") ||
                    lower.contains("morphify.net") || lower.contains("doubleclick") || lower.contains("google-analytics") ||
                    lower.contains("googlesyndication") || lower.contains("adservice") || lower.contains("turnstile") ||
                    lower.contains("challenge-platform")) {
                    return true;
                }
                if (reqUrl.startsWith("http://") || reqUrl.startsWith("https://")) {
                    return false;
                }
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String reqUrl = request.getUrl().toString();
                String lower = reqUrl.toLowerCase();

                // Block known ad networks, trackers, popup scripts, and verification captchas
                if (lower.contains("decafeligiblyhad") || lower.contains("morphify.net") || 
                    lower.contains("doubleclick") || lower.contains("google-analytics") ||
                    lower.contains("adservice") || lower.contains("fuckadblock") ||
                    lower.contains("popads") || lower.contains("adsterra") ||
                    lower.contains("alwingulla") || lower.contains("monetag") ||
                    lower.contains("challenge-platform") || lower.contains("turnstile") ||
                    lower.contains("cloudflareinsights") || lower.contains("googlesyndication") ||
                    lower.contains("pagead") || lower.contains("adsystem") ||
                    lower.contains("propeller") || lower.contains("adnxs") ||
                    lower.contains("adform") || lower.contains("outbrain") ||
                    lower.contains("taboola") || lower.contains("trafficjunky") ||
                    lower.contains("exozoic") || lower.contains("zergnet") ||
                    lower.contains("vignette") || lower.contains("yadro.ru") ||
                    lower.contains("histats") || lower.contains("/ads.") ||
                    lower.contains("/ads/") || lower.contains("ads.js") ||
                    lower.contains("popunder")) {
                    return new WebResourceResponse("text/plain", "UTF-8", new java.io.ByteArrayInputStream("".getBytes()));
                }

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
                    injectAdEraser(); 
                }
            } 
            @Override public void onPageFinished(WebView view, String url) { 
                super.onPageFinished(view, url); 
                loadingProgress.setVisibility(View.GONE); 
                if (!isDirectHls) {
                    injectAdEraser(); 
                    
                    if (startTime > 0) {
                        String resumeScript = "(function() {" +
                                "  var startT = " + startTime + ";" +
                                "  var seeked = false;" +
                                "  function trySeek(win) {" +
                                "    try {" +
                                "      var videos = win.document.querySelectorAll('video');" +
                                "      for (var i = 0; i < videos.length; i++) {" +
                                "        var v = videos[i];" +
                                "        if (v && v.duration > 0 && !seeked) {" +
                                "          v.currentTime = startT;" +
                                "          seeked = true;" +
                                "          return true;" +
                                "        } else if (v && !seeked) {" +
                                "          v.addEventListener('loadedmetadata', function() {" +
                                "            if (!seeked) { this.currentTime = startT; seeked = true; }" +
                                "          }, {once: true});" +
                                "        }" +
                                "      }" +
                                "    } catch(e) {}" +
                                "    for (var j = 0; j < win.frames.length; j++) {" +
                                "      try { if (trySeek(win.frames[j])) return true; } catch(e) {}" +
                                "    }" +
                                "    return false;" +
                                "  }" +
                                "  trySeek(window);" +
                                "  var interval = setInterval(function() {" +
                                "    if (trySeek(window) || seeked) clearInterval(interval);" +
                                "  }, 500);" +
                                "  setTimeout(function() { clearInterval(interval); }, 10000);" +
                                "})();";
                        view.evaluateJavascript(resumeScript, null);
                    }
                }
                applyCaptionStyle(); 
                toggleWebSubtitles(true); 

                String audio = getIntent().getStringExtra("audio");
                final String targetAudio = audio != null ? audio.toLowerCase() : "dub";
                changeAudioLanguage(targetAudio);
            } 
        }); 

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
                    "<video id='player' playsinline autoplay controlsList='nodownload'>" +
                    (subtitleUrl != null && !subtitleUrl.isEmpty() ? "<track label='" + subtitleLang + "' kind='subtitles' srclang='en' src='" + subtitleUrl + "' default>" : "") +
                    "</video>" +
                    "<script>" +
                    "  var v = document.getElementById('player');" +
                    "  var streamUrl = '" + url.replace("'", "\\'") + "';" +
                    "  var targetAudio = '" + targetAudio + "';" +
                    "  var startT = " + startTime + ";" +
                    "  var remoteSubUrl = '" + (subtitleUrl != null ? subtitleUrl : "") + "';" +
                    "  var hasSeeked = false;" +
                    "  function matchHlsTrack(t) {" +
                    "    var all = ((t.lang || '') + ' ' + (t.name || '') + ' ' + (t.label || '') + ' ' + (t.url || '')).toLowerCase();" +
                    "    if (targetAudio === 'dub' || targetAudio === 'eng' || targetAudio === 'english') return all.indexOf('eng') !== -1 || all.indexOf('en') !== -1 || all.indexOf('dub') !== -1;" +
                    "    if (targetAudio === 'sub' || targetAudio === 'jpn' || targetAudio === 'japanese') return all.indexOf('jpn') !== -1 || all.indexOf('jap') !== -1 || all.indexOf('ja') !== -1 || all.indexOf('sub') !== -1 || all.indexOf('orig') !== -1;" +
                    "    if (targetAudio === 'hin' || targetAudio === 'hindi') return all.indexOf('hin') !== -1 || all.indexOf('hi') !== -1;" +
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
                    "    hls.on(Hls.Events.MANIFEST_PARSED, function() { " +
                    "      selectAudioTrack(); " +
                    "      if (hls.subtitleTracks && hls.subtitleTracks.length > 0) { hls.subtitleTrack = 0; } " +
                    "      if (startT > 0 && !hasSeeked) { v.currentTime = startT; hasSeeked = true; } " +
                    "      v.play().catch(function(){}); " +
                    "    });" +
                    "    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, function() { selectAudioTrack(); });" +
                    "    hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, function() { if (hls.subtitleTrack === -1 && hls.subtitleTracks.length > 0) { hls.subtitleTrack = 0; } });" +
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
                    baseUrl = new URL(url).getProtocol() + "://" + new URL(url).getHost() + "/";
                } catch (Exception ignored) {}
            }

            playerWebView.loadDataWithBaseURL(baseUrl, hlsHtml, "text/html", "UTF-8", null);
            return;
        }

        isDirectHls = false;
        String referer = "https://www.google.com/";
        if (url.contains("zephyrix") || url.contains("watchanimeworld") || url.contains("short.icu") || url.contains("animesalt")) {
            referer = "https://watchanimeworld.one/";
        } else if (url.contains("nexabloom.top") || url.contains("megaplay.buzz")) {
            referer = "https://megaplay.buzz/";
        } else if (url.contains("justanime.to")) {
            referer = "https://justanime.to/";
        } else if (url.contains("anikototv")) {
            referer = "https://anikototv.to/";
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
        Map<String, String> headers = new HashMap<>(); 
        headers.put("Referer", referer); 
        playerWebView.loadUrl(url, headers); 
    }
    
    private void injectAdEraser() { 
        if (isDirectHls || playerWebView == null) return;
        playerWebView.evaluateJavascript("(function() { " +
                "  function autoTrigger(win) { " +
                "    try { " +
                "      var doc = win.document; " +
                "      var form = doc.querySelector('form#F1, form#f1, form[action*=\"/dl\"], form[name=\"F1\"]'); " +
                "      if (form && !form.hasAttribute('data-auto-sub')) { " +
                "        form.setAttribute('data-auto-sub', 'true'); " +
                "        form.submit(); " +
                "        return; " +
                "      } " +
                "      var countdown = doc.querySelector('#countdownOverlay, .countdown-overlay, #loadingIndicator'); " +
                "      if (countdown) { try { countdown.style.setProperty('display', 'none', 'important'); } catch(e){} } " +
                "      var vf = doc.querySelector('iframe#videoFrame, iframe[src*=\"abyss\"], iframe[src*=\"short.icu\"]'); " +
                "      if (vf) { " +
                "        try { " +
                "          vf.style.setProperty('opacity', '1', 'important'); " +
                "          vf.style.setProperty('pointer-events', 'auto', 'important'); " +
                "          vf.style.setProperty('visibility', 'visible', 'important'); " +
                "        } catch(e){} " +
                "      } " +
                "      var btn = doc.querySelector('#overlay, #playback, #vid_play, #play_btn, #play, .play-btn, #desk, .jw-display-icon-container, .vjs-big-play-button, .art-icon-play, .plyr__control--overlaid'); " +
                "      if (btn && !btn.hasAttribute('data-auto-clicked')) { " +
                "        btn.setAttribute('data-auto-clicked', 'true'); " +
                "        try { btn.click(); } catch(e){} " +
                "      } " +
                "      var v = doc.querySelector('video'); " +
                "      if (v) { " +
                "        if (v.muted) v.muted = false; " +
                "        if (v.volume < 1.0) v.volume = 1.0; " +
                "      } " +
                "      if (typeof win.jwplayer === 'function') { " +
                "        try { " +
                "          var jp = win.jwplayer(); " +
                "          if (jp && jp.getMute && jp.getMute()) jp.setMute(false); " +
                "          if (jp && jp.setVolume && jp.getVolume && jp.getVolume() < 100) jp.setVolume(100); " +
                "        } catch(e) {} " +
                "      } " +
                "    } catch(e) {} " +
                "    for (var i = 0; i < win.frames.length; i++) { try { autoTrigger(win.frames[i]); } catch(e) {} } " +
                "  } " +
                "  autoTrigger(window); " +
                "  function absoluteCleanse(win) { " +
                "    try { " +
                "      var doc = win.document; " +
                "      var style = doc.getElementById('anilove-hybrid-base-style') || doc.createElement('style'); " +
                "      style.id = 'anilove-hybrid-base-style'; " +
                "      style.innerHTML = 'html, body { background: #000 !important; background-color: #000 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; width: 100vw !important; height: 100vh !important; } ' + " +
                "        'video, .jw-video, .vjs-tech, .art-video, .art-video-player { position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; object-fit: contain !important; z-index: 1000 !important; visibility: visible !important; opacity: 1 !important; display: block !important; background: #000 !important; } ' + " +
                "        '.art-subtitle, .artplayer-subtitles, .art-subtitles, .jw-captions, .jw-text-track-container, .vjs-text-track-display, .ytp-caption-window-container, .plyr__captions, .caption-window, .subtitles, .captions, .shaka-text-container, .fluid_subtitles, .bitmovin-player-subtitle-overlay, .jw-captions-text, .vjs-caption-content, .art-subtitle p, [class*=\"subtitle\"], [class*=\"caption\"], [id*=\"subtitle\"], [id*=\"caption\"] { visibility: visible !important; opacity: 1 !important; display: block !important; z-index: 2147483647 !important; } ' + " +
                "        'iframe:not(#videoFrame):not([src*=\"abyss\"]):not([src*=\"blob\"]):not([src*=\"stream\"]), div[class*=\"popup\"], div[id*=\"popup\"], div[class*=\"modal\"]:not(#audioModal), div[id*=\"modal\"]:not(#audioModal), div[class*=\"banner\"], div[id*=\"banner\"], div[class*=\"overlay\"]:not(#overlay):not(#playback), div[class*=\"countdown\"], .countdown-overlay, #countdownOverlay, #loadingIndicator, .adsbygoogle, div[class*=\"turnstile\"], div[class*=\"cf-turnstile\"], div[class*=\"human\"], div[id*=\"human\"], div[class*=\"verify\"], div[id*=\"verify\"], div[class*=\"step\"], div[class*=\"access\"], div[class*=\"confirm\"] { display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; width: 0 !important; height: 0 !important; }'; " +
                "      if (!style.parentNode && doc.head) doc.head.appendChild(style); " +
                "      var popups = doc.querySelectorAll('.countdown-overlay, #countdownOverlay, #loadingIndicator, div[class*=\"popup\"], div[id*=\"popup\"], .adsbygoogle, div[class*=\"turnstile\"], div[class*=\"cf-turnstile\"], div[class*=\"human\"], div[id*=\"human\"], div[class*=\"verify\"], div[id*=\"verify\"], div[class*=\"step\"], iframe[src*=\"challenge\"], iframe[src*=\"turnstile\"]'); " +
                "      popups.forEach(function(p) { try { p.remove(); } catch(e){} }); " +
                "    } catch(e) {} " +
                "    for (var j = 0; j < win.frames.length; j++) { try { absoluteCleanse(win.frames[j]); } catch(e) {} } " +
                "  } " +
                "  absoluteCleanse(window); " +
                "})();", null); 
    }


    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            if (controller != null) {
                if (isFullscreenMode) {
                    controller.hide(WindowInsetsCompat.Type.statusBars());
                    controller.hide(WindowInsetsCompat.Type.navigationBars());
                } else {
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

    @Override
    protected void onPause() {
        super.onPause();
        if (exoPlayer != null && !isInPictureInPictureMode()) {
            exoPlayer.pause();
        }
        // Mute any background WebView audio immediately
        if (playerWebView != null) {
            playerWebView.evaluateJavascript(
                "(function(){" +
                "  var els=document.querySelectorAll('video,audio');" +
                "  for(var i=0;i<els.length;i++){els[i].muted=true;els[i].pause();}" +
                "  if(window.frames){for(var j=0;j<window.frames.length;j++){" +
                "    try{var fe=window.frames[j].document.querySelectorAll('video,audio');" +
                "    for(var k=0;k<fe.length;k++){fe[k].muted=true;fe[k].pause();}}catch(e){}" +
                "  }}" +
                "})();", null);
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (exoPlayer != null && !isInPictureInPictureMode()) {
            exoPlayer.stop();
        }
    }

    private void updateVolume(float percent) {
        if (audioManager == null || indicatorVolume == null || initialVolume == -1) return;
        int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        
        // Calculate new hardware volume step
        // We use 1.2f sensitivity for a good drag feel
        int newVol = initialVolume + (int) (percent * maxVol * 1.2f);
        if (newVol < 0) newVol = 0;
        if (newVol > maxVol) newVol = maxVol;
        
        // Set hardware volume without showing system UI (flag 0)
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, newVol, 0);
        
        int displayPercent = (int) (((float)newVol / maxVol) * 100);
        indicatorVolume.setText("Vol: " + displayPercent + "%");
        indicatorVolume.setVisibility(View.VISIBLE);
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
        indicatorBrightness.setText("Bri: " + displayPercent + "%");
        indicatorBrightness.setVisibility(View.VISIBLE);
        if (indicatorVolume != null) indicatorVolume.setVisibility(View.GONE);
    }

    @Override 
    protected void onDestroy() { 
        if (currentInstance == this) currentInstance = null;
        
        NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        updateHandler.removeCallbacksAndMessages(null); 
        hideHandler.removeCallbacksAndMessages(null); 
        
        try {
            unregisterReceiver(pipReceiver);
        } catch (Exception ignored) {}

        if (exoPlayer != null) {
            try {
                exoPlayer.stop();
                exoPlayer.clearMediaItems();
                exoPlayer.release();
            } catch (Exception ignored) {}
            exoPlayer = null;
        }
        if (playerWebView != null) { 
            try {
                playerWebView.evaluateJavascript(
                    "(function(){var e=document.querySelectorAll('video,audio');" +
                    "for(var i=0;i<e.length;i++){e[i].src='';e[i].load();}})();", null);
                playerWebView.stopLoading();
                playerWebView.loadUrl("about:blank");
                playerWebView.destroy(); 
            } catch (Exception ignored) {}
            playerWebView = null;
        } 
        super.onDestroy(); 
        overridePendingTransition(0, 0);
    }
}