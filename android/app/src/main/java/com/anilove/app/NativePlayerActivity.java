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
import android.graphics.Color;
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
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ImageButton;
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

        String url = intent.getStringExtra("url");
        if (url != null && !url.isEmpty()) {
            runOnUiThread(() -> {
                if (loadingProgress != null) loadingProgress.setVisibility(View.VISIBLE);
                setupHybridEngine(url);
            });
        }
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
        } else {
            NativePlayerPlugin.setScreenOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

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
                if (portraitBottom != null) portraitBottom.setVisibility(isOfflineMode ? View.VISIBLE : View.GONE);
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
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.BLACK));
        
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

        View touchWall = findViewById(R.id.touch_wall);
        if (touchWall != null) {
            touchWall.setVisibility(View.GONE);
            touchWall.setClickable(false);
            touchWall.setFocusable(false);
        }

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
                    sendVideoCommand("action: 'seekTo', value: " + s.getProgress()); 
                }
                resetHideTimer(); 
                scrubberContainer.setVisibility(View.GONE);
            }
        });

        if (isOfflineMode) {
            playerWebView.setVisibility(View.GONE);
            exoPlayerView.setVisibility(View.VISIBLE);
            setupExoPlayer(getIntent().getStringExtra("localFilePath"), getIntent().getStringExtra("localSubPath"));
        } else {
            exoPlayerView.setVisibility(View.GONE);
            playerWebView.setVisibility(View.VISIBLE);
            setupHybridEngine(getIntent().getStringExtra("url") != null ? getIntent().getStringExtra("url") : "");
        }
        startUpdateLoop();
        resetHideTimer();
    }

    private void updateVolume(float percent) {
        if (audioManager == null) return;
        int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        int deltaVol = (int) (percent * maxVol);
        int targetVol = Math.max(0, Math.min(maxVol, initialVolume + deltaVol));
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, targetVol, 0);

        if (indicatorVolume != null) {
            int displayPct = (int) (((float) targetVol / maxVol) * 100);
            indicatorVolume.setText("Vol: " + displayPct + "%");
            indicatorVolume.setVisibility(View.VISIBLE);
        }
    }

    private void updateBrightness(float percent) {
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        float targetBrightness = Math.max(0.01f, Math.min(1.0f, initialBrightness + percent));
        lp.screenBrightness = targetBrightness;
        getWindow().setAttributes(lp);

        if (indicatorBrightness != null) {
            int displayPct = (int) (targetBrightness * 100);
            indicatorBrightness.setText("Bri: " + displayPct + "%");
            indicatorBrightness.setVisibility(View.VISIBLE);
        }
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
            sendVideoCommand("action: 'pause'");
            btnPlayPause.setImageResource(android.R.drawable.ic_media_play);
            stopHideTimer();
        } else {
            sendVideoCommand("action: 'play'");
            btnPlayPause.setImageResource(android.R.drawable.ic_media_pause);
            resetHideTimer();
        }
        isPlaying = !isPlaying;
    }

    private void toggleControlsVisibility() {
        isControlsVisible = !isControlsVisible;
        controlsOverlay.setVisibility(isControlsVisible ? View.VISIBLE : View.GONE);
        if (isControlsVisible) resetHideTimer();
    }
    
    private void hideControlsQuietly() {
        isControlsVisible = false;
        controlsOverlay.setVisibility(View.GONE);
        stopHideTimer();
    }

    private void resetHideTimer() {
        stopHideTimer();
        if (isPlaying && isControlsVisible && !isDragging) {
            hideHandler.postDelayed(() -> {
                if (isControlsVisible && isPlaying) {
                    isControlsVisible = false;
                    controlsOverlay.setVisibility(View.GONE);
                }
            }, 5000);
        }
    }

    private void stopHideTimer() {
        hideHandler.removeCallbacksAndMessages(null);
    }

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
        SwitchCompat switchBoost = view.findViewById(R.id.switch_volume_boost); 
        switchBoost.setChecked(isVolumeBoosted); 
        switchBoost.setOnCheckedChangeListener((b, checked) -> {
            isVolumeBoosted = checked;
            applyVolumeBoost(checked);
        });
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
        dialog.show();
    }

    private void applyVolumeBoost(boolean boost) {
        sendVideoCommand("action: 'volumeBoost', value: " + (boost ? "true" : "false"));
    }

    private void toggleWebSubtitles(boolean show) {
        sendVideoCommand("action: 'toggleSubtitles', value: " + (show ? "true" : "false"));
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

    private void setupCaptionGroup(LinearLayout container, String[] options, String selectedVal, CaptionSelectListener listener) {
        if (container == null) return;
        for (int i = 0; i < container.getChildCount(); i++) {
            View child = container.getChildAt(i);
            if (child instanceof TextView) {
                TextView tv = (TextView) child;
                String txt = tv.getText().toString();
                highlightButton(tv, txt.equalsIgnoreCase(selectedVal));
                tv.setOnClickListener(v -> {
                    for (int j = 0; j < container.getChildCount(); j++) {
                        View c = container.getChildAt(j);
                        if (c instanceof TextView) highlightButton((TextView) c, false);
                    }
                    highlightButton(tv, true);
                    listener.onSelect(txt);
                });
            }
        }
    }

    private interface CaptionSelectListener {
        void onSelect(String value);
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
            preview.setShadowLayer(4f, 2, 2, Color.BLACK);
        } else {
            preview.setShadowLayer(0, 0, 0, Color.TRANSPARENT);
        }
    }

    private String getHexForColorName(String name) {
        switch (name.toLowerCase()) {
            case "yellow": return "#FFFF00";
            case "cyan": return "#00FFFF";
            case "green": return "#00FF00";
            case "magenta": return "#FF00FF";
            default: return "#FFFFFF";
        }
    }

    private void applyCaptionStyle() {
        if (playerWebView == null) return;

        float opacityVal = 0f;
        if (!bgOpacity.equals("Off")) {
            opacityVal = Integer.parseInt(bgOpacity.replace("%", "")) / 100f;
        }

        int bgColorInt = bgColor.equalsIgnoreCase("Gray") ? Color.GRAY
                : (bgColor.equalsIgnoreCase("Navy") ? Color.BLUE
                : (bgColor.equalsIgnoreCase("White") ? Color.WHITE : Color.BLACK));

        String bgRgba = String.format(Locale.US, "rgba(%d,%d,%d,%.2f)",
                Color.red(bgColorInt), Color.green(bgColorInt), Color.blue(bgColorInt), opacityVal);

        boolean isTop = captionPosition.equalsIgnoreCase("Top");
        String posCss = isTop ? "top: " + bottomMargin + "% !important; bottom: auto !important;"
                : "bottom: " + bottomMargin + "% !important; top: auto !important;";

        String padding = opacityVal > 0 ? "2px 8px !important;" : "0 !important;";
        String borderRadius = opacityVal > 0 ? "4px !important;" : "0 !important;";

        String shadowCss = "0 0 2px #000";
        if (edgeStyle.equalsIgnoreCase("Outline")) shadowCss = "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000";
        else if (edgeStyle.equalsIgnoreCase("Shadow")) shadowCss = "2px 2px 4px #000";
        else if (edgeStyle.equalsIgnoreCase("None")) shadowCss = "none";

        String containerSelectors = ".art-subtitle, .artplayer-subtitles, .art-subtitles, .jw-captions, .jw-text-track-container, .vjs-text-track-display, .ytp-caption-window-container, .plyr__captions, .caption-window, .subtitles, .captions, .shaka-text-container, .fluid_subtitles, .bitmovin-player-subtitle-overlay";
        String textSelectors = ".jw-captions-text, .vjs-caption-content, .art-subtitle p, [class*=\"subtitle\"], [class*=\"caption\"]";

        String css = "::cue { " +
                "  background-color: " + bgRgba + " !important; " +
                "  color: " + captionColorHex + " !important; " +
                "  font-size: " + (captionFontSize * 0.01) + "em !important; " +
                "  font-weight: " + captionWeight.toLowerCase() + " !important; " +
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

        sendVideoCommand("action: 'applyCss', value: '" + css.replace("'", "\\'") + "'");
    }

    private void highlightButton(TextView tv, boolean selected) {
        if (tv == null) return;
        tv.setSelected(selected);
        if (selected) {
            tv.setTextColor(Color.WHITE);
            tv.setBackgroundResource(R.drawable.speed_btn_bg);
        } else {
            tv.setTextColor(Color.parseColor("#888888"));
            tv.setBackground(null);
        }
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
        sendVideoCommand("action: 'speed', value: " + speed); 
    }
    
    private void navigateEpisode(boolean next) {
        if (navigationListener != null) {
            navigationListener.onNavigate(next);
            finish();
            return;
        }

        if (MainActivity.instance != null && MainActivity.instance.getBridge() != null) {
            MainActivity.instance.runOnUiThread(() -> {
                WebView mainWebView = MainActivity.instance.getBridge().getWebView();
                if (mainWebView != null) {
                    String eventName = next ? "next" : "prev";
                    String js = "window.dispatchEvent(new CustomEvent('nativeEpisodeNavigation', { detail: { direction: '" + eventName + "' } }));";
                    mainWebView.evaluateJavascript(js, null);
                }
            });
        }
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
        sendVideoCommand("action: 'seekDelta', value: " + delta);
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

        String checkScript = "(function() { " +
                "  function probe(win) { " +
                "    try { " +
                "      var v = win.document.querySelector('video'); " +
                "      if (v && !isNaN(v.duration) && v.duration > 0) { " +
                "        return [v.currentTime, v.duration, v.paused]; " +
                "      } " +
                "    } catch(e) {} " +
                "    for (var i = 0; i < win.frames.length; i++) { " +
                "      try { " +
                "        var r = probe(win.frames[i]); " +
                "        if (r) return r; " +
                "      } catch(e) {} " +
                "    } " +
                "    return null; " +
                "  } " +
                "  return probe(window); " +
                "})();";

        playerWebView.evaluateJavascript(checkScript, value -> { 
            if (value != null && !value.equals("null") && !value.isEmpty()) { 
                try { 
                    String[] parts = value.replace("[", "").replace("]", "").replace("\"", "").split(","); 
                    if (parts.length >= 3) { 
                        double current = Double.parseDouble(parts[0]); 
                        double duration = Double.parseDouble(parts[1]); 
                        boolean pausedInWeb = Boolean.parseBoolean(parts[2]); 
                        
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

    private void sendVideoCommand(String jsCommand) { 
        if (playerWebView != null) {
            String script = "(function() { " +
                    "  function setupFrameListener(win) { " +
                    "    try { " +
                    "      if (!win._aniCmdHooked) { " +
                    "        win._aniCmdHooked = true; " +
                    "        win.addEventListener('message', function(e) { " +
                    "          if (!e.data || e.data.type !== 'ANILOVE_CMD') return; " +
                    "          var v = win.document.querySelector('video'); " +
                    "          if (!v) return; " +
                    "          var act = e.data.action; " +
                    "          var val = e.data.value; " +
                    "          if (act === 'play') { v.play(); } " +
                    "          else if (act === 'pause') { v.pause(); } " +
                    "          else if (act === 'toggle') { if (v.paused) v.play(); else v.pause(); } " +
                    "          else if (act === 'seekDelta') { v.currentTime += val; } " +
                    "          else if (act === 'seekTo') { v.currentTime = val; } " +
                    "          else if (act === 'speed') { v.playbackRate = val; } " +
                    "          else if (act === 'applyCss') { " +
                    "            var doc = win.document; " +
                    "            var st = doc.getElementById('anilove-caption-style') || doc.createElement('style'); " +
                    "            st.id = 'anilove-caption-style'; " +
                    "            st.innerHTML = val; " +
                    "            if (!st.parentNode && doc.head) doc.head.appendChild(st); " +
                    "          } " +
                    "          else if (act === 'toggleSubtitles') { " +
                    "            if (v.textTracks) { " +
                    "              for (var i = 0; i < v.textTracks.length; i++) { " +
                    "                v.textTracks[i].mode = (val === 'true' || val === true) ? 'showing' : 'disabled'; " +
                    "              } " +
                    "            } " +
                    "          } " +
                    "          else if (act === 'volumeBoost') { " +
                    "            try { " +
                    "              if (!win._aniAudioCtx) { " +
                    "                var AC = win.AudioContext || win.webkitAudioContext; " +
                    "                if (AC) { " +
                    "                  var ctx = new AC(); " +
                    "                  var src = ctx.createMediaElementSource(v); " +
                    "                  var gain = ctx.createGain(); " +
                    "                  gain.gain.value = (val === 'true' || val === true) ? 2.5 : 1.0; " +
                    "                  src.connect(gain); " +
                    "                  gain.connect(ctx.destination); " +
                    "                  win._aniAudioCtx = ctx; " +
                    "                  win._aniGain = gain; " +
                    "                } " +
                    "              } else if (win._aniGain) { " +
                    "                win._aniGain.gain.value = (val === 'true' || val === true) ? 2.5 : 1.0; " +
                    "              } " +
                    "            } catch(err) {} " +
                    "          } " +
                    "        }); " +
                    "      } " +
                    "    } catch(e) {} " +
                    "    for (var i = 0; i < win.frames.length; i++) { " +
                    "      try { setupFrameListener(win.frames[i]); } catch(e) {} " +
                    "    } " +
                    "  } " +
                    "  setupFrameListener(window); " +
                    "  function broadcast(win, msg) { " +
                    "    try { win.postMessage(msg, '*'); } catch(e) {} " +
                    "    for (var i = 0; i < win.frames.length; i++) { " +
                    "      try { broadcast(win.frames[i], msg); } catch(e) {} " +
                    "    } " +
                    "  } " +
                    "  var cmdObj = { type: 'ANILOVE_CMD', " + jsCommand + " }; " +
                    "  broadcast(window, cmdObj); " +
                    "  var v = document.querySelector('video'); " +
                    "  if (v) { " +
                    "    var act = cmdObj.action; var val = cmdObj.value; " +
                    "    if (act === 'play') v.play(); " +
                    "    else if (act === 'pause') v.pause(); " +
                    "    else if (act === 'seekDelta') v.currentTime += val; " +
                    "    else if (act === 'seekTo') v.currentTime = val; " +
                    "    else if (act === 'speed') v.playbackRate = val; " +
                    "  } " +
                    "})();";
            playerWebView.evaluateJavascript(script, null); 
        }
    }

    private String formatTime(int seconds) { return String.format(Locale.getDefault(), "%02d:%02d", (seconds < 0 ? 0 : seconds) / 60, (seconds < 0 ? 0 : seconds) % 60); }
    private boolean isDirectHls = false;

    private void setupHybridEngine(String url) {
        if (url == null || url.isEmpty() || playerWebView == null) return;
        
        WebSettings settings = playerWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
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
                    injectHybridCSS(view);
                    injectAdEraser(); 
                }
            } 
            @Override public void onPageFinished(WebView view, String url) { 
                super.onPageFinished(view, url); 
                loadingProgress.setVisibility(View.GONE); 
                if (!isDirectHls) {
                    injectHybridCSS(view);
                    injectAdEraser(); 
                }
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

            String baseUrl = "https://vidlink.pro/";
            if (url.contains("justanime.to")) {
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
        if (url.contains("justanime.to")) {
            referer = "https://justanime.to/";
        } else {
            try {
                referer = new URL(url).getProtocol() + "://" + new URL(url).getHost() + "/";
            } catch (Exception ignored) {}
        }
        Map<String, String> headers = new HashMap<>(); 
        headers.put("Referer", referer); 
        playerWebView.loadUrl(url, headers); 
    }

    private void injectHybridCSS(WebView view) {
        if (isDirectHls || view == null) return;
        String cssScript = "(function() { " +
                "  function applyCss(win) { " +
                "    try { " +
                "      var doc = win.document; " +
                "      var style = doc.getElementById('anilove-hybrid-engine-css') || doc.createElement('style'); " +
                "      style.id = 'anilove-hybrid-engine-css'; " +
                "      style.innerHTML = 'body, html { background: black !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; width: 100% !important; height: 100% !important; } " +
                "      * { visibility: hidden !important; } " +
                "      video, .jw-video, .vjs-tech, .art-video, .art-video-player, video * { " +
                "        visibility: visible !important; opacity: 1 !important; display: block !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; object-fit: contain !important; z-index: 1000 !important; pointer-events: auto !important; " +
                "      } " +
                "      .art-subtitle, .artplayer-subtitles, .art-subtitles, .jw-captions, .jw-text-track-container, .vjs-text-track-display, .ytp-caption-window-container, .plyr__captions, .caption-window, .subtitles, .captions, .shaka-text-container, .fluid_subtitles, .bitmovin-player-subtitle-overlay, .jw-captions-text, .vjs-caption-content, .art-subtitle p, [class*=\"subtitle\"], [class*=\"caption\"], [id*=\"subtitle\"], [id*=\"caption\"] { " +
                "        visibility: visible !important; opacity: 1 !important; display: block !important; z-index: 2147483647 !important; " +
                "      }'; " +
                "      if (!style.parentNode && doc.head) doc.head.appendChild(style); " +
                "    } catch(e) {} " +
                "    for (var i = 0; i < win.frames.length; i++) { " +
                "      try { applyCss(win.frames[i]); } catch(e) {} " +
                "    } " +
                "  } " +
                "  applyCss(window); " +
                "})();";
        view.evaluateJavascript(cssScript, null);
    }
    
    private void injectAdEraser() { 
        if (isDirectHls || playerWebView == null) return;
        playerWebView.evaluateJavascript("(function() { " +
                "  function sweep(win) { " +
                "    try { " +
                "      var doc = win.document; " +
                "      var all = doc.querySelectorAll('body *'); " +
                "      var whitelist = 'video, .jw-video, .vjs-tech, .art-video, .art-video-player, .art-subtitle, .artplayer-subtitles, .art-subtitles, .jw-captions, .jw-text-track-container, .vjs-text-track-display, .ytp-caption-window-container, .plyr__captions, .caption-window, .subtitles, .captions, .shaka-text-container, .fluid_subtitles, .bitmovin-player-subtitle-overlay, .jw-captions-text, .vjs-caption-content, .art-subtitle p, [class*=\"subtitle\"], [class*=\"caption\"]'; " +
                "      all.forEach(function(el) { " +
                "        try { " +
                "          if (el.tagName === 'VIDEO' || el.querySelector('video') || (el.matches && el.matches(whitelist))) { " +
                "            el.style.setProperty('visibility', 'visible', 'important'); " +
                "            el.style.setProperty('opacity', '1', 'important'); " +
                "          } else { " +
                "            el.style.setProperty('pointer-events', 'none', 'important'); " +
                "            if (el.tagName === 'IFRAME' || el.tagName === 'A' || el.id.indexOf('pop') !== -1 || el.className.indexOf('ad') !== -1) { " +
                "              el.style.setProperty('visibility', 'hidden', 'important'); " +
                "              el.style.setProperty('display', 'none', 'important'); " +
                "            } " +
                "          } " +
                "        } catch(err) {} " +
                "      }); " +
                "      var v = doc.querySelector('video'); " +
                "      if (v) { " +
                "        v.style.setProperty('position', 'fixed', 'important'); " +
                "        v.style.setProperty('top', '0px', 'important'); " +
                "        v.style.setProperty('left', '0px', 'important'); " +
                "        v.style.setProperty('width', '100%', 'important'); " +
                "        v.style.setProperty('height', '100%', 'important'); " +
                "        v.style.setProperty('z-index', '1000', 'important'); " +
                "        v.style.setProperty('pointer-events', 'auto', 'important'); " +
                "        if (v.paused && !v.getAttribute('data-manual-pause')) { v.play().catch(function(){}); } " +
                "      } " +
                "    } catch(e) {} " +
                "    for (var i = 0; i < win.frames.length; i++) { try { sweep(win.frames[i]); } catch(e) {} } " +
                "  } " +
                "  sweep(window); " +
                "})();", null); 
    }
}
