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
import androidx.media3.common.TrackSelectionParameters;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.FileDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.hls.HlsMediaSource;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.extractor.DefaultExtractorsFactory;
import androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory;
import androidx.media3.ui.CaptionStyleCompat;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.SubtitleView;

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

    // Quality & Audio state
    private String currentSelectedQuality = "Auto";
    private String currentSelectedAudio = "DUB";
    
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
        currentSelectedAudio = audio.toUpperCase();

        TextView videoTitleView = findViewById(R.id.video_title);
        TextView portraitAnimeTitle = findViewById(R.id.portrait_anime_title);
        TextView portraitEpSubtitle = findViewById(R.id.portrait_episode_subtitle);
        TextView portraitBadgeAudio = findViewById(R.id.portrait_badge_audio);

        if (videoTitleView != null) videoTitleView.setText(animeTitle + " - EP " + epNum);
        if (portraitAnimeTitle != null) portraitAnimeTitle.setText(animeTitle);
        if (portraitEpSubtitle != null) portraitEpSubtitle.setText("Episode " + epNum);
        if (portraitBadgeAudio != null) portraitBadgeAudio.setText(currentSelectedAudio);
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
        
        final View statusBarFiller = findViewById(R.id.status_bar_filler);
        final View bottomGapFiller = findViewById(R.id.bottom_gap_filler);
        final View portraitBottom = findViewById(R.id.portrait_bottom_container);
        final View videoRoot = findViewById(R.id.video_root_container);
        final View topBar = findViewById(R.id.top_bar);

        if (isFullscreenMode) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
            
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);

            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.gravity = Gravity.FILL;
            params.x = 0;
            params.y = 0;
            params.width = WindowManager.LayoutParams.MATCH_PARENT;
            params.height = WindowManager.LayoutParams.MATCH_PARENT;
            params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;
            params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
            getWindow().setAttributes(params);

            if (statusBarFiller != null) statusBarFiller.setVisibility(View.GONE);
            if (bottomGapFiller != null) bottomGapFiller.setVisibility(View.GONE);
            if (portraitBottom != null) portraitBottom.setVisibility(View.GONE);
            if (topBar != null) topBar.setVisibility(View.VISIBLE);
            
            if (videoRoot != null) {
                ViewGroup.LayoutParams lp = videoRoot.getLayoutParams();
                lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                lp.height = ViewGroup.LayoutParams.MATCH_PARENT;
                videoRoot.setLayoutParams(lp);
            }
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
            controller.show(WindowInsetsCompat.Type.systemBars());

            WindowManager.LayoutParams params = getWindow().getAttributes();
            params.gravity = Gravity.FILL;
            params.x = 0;
            params.y = 0;
            params.width = WindowManager.LayoutParams.MATCH_PARENT;
            params.height = WindowManager.LayoutParams.MATCH_PARENT;
            params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;
            params.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
            getWindow().setAttributes(params);

            if (statusBarFiller != null) statusBarFiller.setVisibility(View.VISIBLE);
            if (bottomGapFiller != null) bottomGapFiller.setVisibility(View.GONE);
            if (portraitBottom != null) portraitBottom.setVisibility(View.VISIBLE);
            if (topBar != null) topBar.setVisibility(View.VISIBLE);
            
            if (videoRoot != null) {
                ViewGroup.LayoutParams lp = videoRoot.getLayoutParams();
                lp.width = ViewGroup.LayoutParams.MATCH_PARENT;
                int screenW = getPhysicalScreenWidth();
                lp.height = (int) (screenW * 9.0f / 16.0f);
                videoRoot.setLayoutParams(lp);
            }
        }
    }

    private void toggleFullscreenInPlace() {
        isFullscreenMode = !isFullscreenMode;
        getIntent().putExtra("startFullscreen", isFullscreenMode);
        applyWindowSettings(getIntent());
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
        playerWebView.setVisibility(View.GONE); // ALWAYS GONE - Background extractor only

        exoPlayerView = findViewById(R.id.player_exoplayer);
        exoPlayerView.setVisibility(View.VISIBLE); // ALWAYS VISIBLE - Pure native video playback
        
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
            @Override public boolean onSingleTapConfirmed(MotionEvent e) { 
                toggleControlsVisibility(); 
                return true; 
            }
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

        // Set touch listener on entire background canvas & views so single tap ALWAYS toggles controls
        View touchWall = findViewById(R.id.touch_wall);
        if (touchWall != null) {
            touchWall.setVisibility(View.VISIBLE);
            touchWall.setBackgroundColor(Color.TRANSPARENT);
            touchWall.setOnTouchListener(touchListener);
        }
        
        View videoRoot = findViewById(R.id.video_root_container);
        if (videoRoot != null) {
            videoRoot.setOnTouchListener(touchListener);
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
                if (exoPlayer != null) {
                    long duration = exoPlayer.getDuration();
                    if (duration > 0 && duration != C.TIME_UNSET) {
                        long targetMs = s.getProgress() * 1000L;
                        exoPlayer.seekTo(Math.min(targetMs, duration));
                    }
                }
                resetHideTimer(); 
                scrubberContainer.setVisibility(View.GONE);
            }
        });

        if (isOfflineMode) {
            setupExoPlayerLocal(getIntent().getStringExtra("localFilePath"), getIntent().getStringExtra("localSubPath"));
        } else {
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

    private void setupExoPlayerLocal(String videoPath, String subPath) {
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
            applyCaptionStyle();
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
                        isPlaying = exoPlayer.isPlaying();
                        btnPlayPause.setImageResource(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
                    } else if (playbackState == Player.STATE_ENDED) {
                        isPlaying = false;
                        btnPlayPause.setImageResource(android.R.drawable.ic_media_play);
                        navigateEpisode(true);
                    }
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    Log.e("AniLove", "ExoPlayer local error: " + error.getMessage(), error);
                    loadingProgress.setVisibility(View.GONE);
                }
            });
        } catch (Exception e) {
            Log.e("AniLove", "Error setting up ExoPlayer local", e);
        }
    }

    private void setupExoPlayerOnline(String streamUrl, String subUrl, String audioLang, Map<String, String> requestHeaders) {
        if (streamUrl == null || streamUrl.isEmpty()) return;
        try {
            if (exoPlayer != null) {
                exoPlayer.stop();
                exoPlayer.release();
                exoPlayer = null;
            }

            exoPlayer = new ExoPlayer.Builder(this).build();
            exoPlayerView.setPlayer(exoPlayer);

            DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                    .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
                    .setAllowCrossProtocolRedirects(true)
                    .setConnectTimeoutMs(15000)
                    .setReadTimeoutMs(15000);

            if (requestHeaders != null && !requestHeaders.isEmpty()) {
                httpDataSourceFactory.setDefaultRequestProperties(requestHeaders);
            }

            DataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(this, httpDataSourceFactory);

            MediaItem.Builder mediaBuilder = new MediaItem.Builder()
                    .setUri(Uri.parse(streamUrl));

            String effectiveSub = (subUrl != null && !subUrl.isEmpty()) ? subUrl : subtitleUrl;
            if (effectiveSub != null && !effectiveSub.isEmpty()) {
                MediaItem.SubtitleConfiguration subtitle = new MediaItem.SubtitleConfiguration.Builder(Uri.parse(effectiveSub))
                        .setMimeType(MimeTypes.TEXT_VTT)
                        .setLanguage("en")
                        .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                        .build();
                mediaBuilder.setSubtitleConfigurations(Collections.singletonList(subtitle));
            }

            if (streamUrl.contains(".m3u8") || streamUrl.contains("/hls/") || streamUrl.contains("m3u8")) {
                mediaBuilder.setMimeType(MimeTypes.APPLICATION_M3U8);
                HlsMediaSource hlsSource = new HlsMediaSource.Factory(dataSourceFactory)
                        .setAllowChunklessPreparation(true)
                        .createMediaSource(mediaBuilder.build());
                exoPlayer.setMediaSource(hlsSource);
            } else {
                ProgressiveMediaSource progSource = new ProgressiveMediaSource.Factory(dataSourceFactory)
                        .createMediaSource(mediaBuilder.build());
                exoPlayer.setMediaSource(progSource);
            }

            // Quality & Audio track preference
            setVideoQuality(currentSelectedQuality);
            setAudioLanguage(audioLang != null ? audioLang : currentSelectedAudio);

            if (startTime > 0) {
                exoPlayer.seekTo(startTime * 1000L);
            }

            applyCaptionStyle();
            applyVolumeBoost(isVolumeBoosted);
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
                        isPlaying = exoPlayer.isPlaying();
                        btnPlayPause.setImageResource(isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
                    } else if (playbackState == Player.STATE_ENDED) {
                        isPlaying = false;
                        btnPlayPause.setImageResource(android.R.drawable.ic_media_play);
                        navigateEpisode(true);
                    }
                }

                @Override
                public void onPlayerError(PlaybackException error) {
                    Log.e("AniLove", "ExoPlayer online error: " + error.getMessage(), error);
                    loadingProgress.setVisibility(View.GONE);
                }
            });
        } catch (Exception e) {
            Log.e("AniLove", "Error setting up ExoPlayer online", e);
        }
    }

    private void setVideoQuality(String quality) {
        currentSelectedQuality = quality;
        if (exoPlayer != null) {
            TrackSelectionParameters.Builder builder = exoPlayer.getTrackSelectionParameters().buildUpon();
            if (quality.equalsIgnoreCase("Auto")) {
                builder.clearVideoSizeConstraints();
                builder.setMaxVideoBitrate(Integer.MAX_VALUE);
            } else if (quality.equalsIgnoreCase("1080p")) {
                builder.setMaxVideoSize(1920, 1080).setMinVideoSize(1920, 1080);
            } else if (quality.equalsIgnoreCase("720p")) {
                builder.setMaxVideoSize(1280, 720).setMinVideoSize(1280, 720);
            } else if (quality.equalsIgnoreCase("480p")) {
                builder.setMaxVideoSize(854, 480).setMinVideoSize(854, 480);
            } else if (quality.equalsIgnoreCase("360p")) {
                builder.setMaxVideoSize(640, 360).setMinVideoSize(640, 360);
            }
            exoPlayer.setTrackSelectionParameters(builder.build());
        }
    }

    private void setAudioLanguage(String langCode) {
        currentSelectedAudio = langCode;
        getIntent().putExtra("audio", langCode);
        if (exoPlayer != null) {
            TrackSelectionParameters.Builder builder = exoPlayer.getTrackSelectionParameters().buildUpon();
            if (langCode.equalsIgnoreCase("DUB") || langCode.equalsIgnoreCase("ENG") || langCode.equalsIgnoreCase("English")) {
                builder.setPreferredAudioLanguage("en");
            } else if (langCode.equalsIgnoreCase("SUB") || langCode.equalsIgnoreCase("JAP") || langCode.equalsIgnoreCase("JPN") || langCode.equalsIgnoreCase("Japanese")) {
                builder.setPreferredAudioLanguage("ja");
            } else if (langCode.equalsIgnoreCase("HIN") || langCode.equalsIgnoreCase("Hindi")) {
                builder.setPreferredAudioLanguage("hi");
            } else if (langCode.equalsIgnoreCase("TAM") || langCode.equalsIgnoreCase("Tamil")) {
                builder.setPreferredAudioLanguage("ta");
            } else if (langCode.equalsIgnoreCase("TEL") || langCode.equalsIgnoreCase("Telugu")) {
                builder.setPreferredAudioLanguage("te");
            } else if (langCode.equalsIgnoreCase("MAL") || langCode.equalsIgnoreCase("Malayalam")) {
                builder.setPreferredAudioLanguage("ml");
            } else if (langCode.equalsIgnoreCase("KAN") || langCode.equalsIgnoreCase("Kannada")) {
                builder.setPreferredAudioLanguage("kn");
            } else if (langCode.equalsIgnoreCase("BEN") || langCode.equalsIgnoreCase("Bengali")) {
                builder.setPreferredAudioLanguage("bn");
            }
            exoPlayer.setTrackSelectionParameters(builder.build());
        }
        TextView portraitBadgeAudio = findViewById(R.id.portrait_badge_audio);
        if (portraitBadgeAudio != null) portraitBadgeAudio.setText(langCode.toUpperCase());
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
        if (exoPlayer != null) {
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
        }
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

                    if (exoPlayerView != null) {
                        Rect visibleRect = new Rect();
                        exoPlayerView.getGlobalVisibleRect(visibleRect);
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

        // 1. Video Quality Selection
        TextView[] qualityBtns = {
            view.findViewById(R.id.quality_btn_auto),
            view.findViewById(R.id.quality_btn_1080),
            view.findViewById(R.id.quality_btn_720),
            view.findViewById(R.id.quality_btn_480),
            view.findViewById(R.id.quality_btn_360)
        };
        String[] qualities = {"Auto", "1080p", "720p", "480p", "360p"};
        for (int i = 0; i < qualityBtns.length; i++) {
            final String qVal = qualities[i];
            final TextView btn = qualityBtns[i];
            if (btn != null) {
                highlightButton(btn, currentSelectedQuality.equalsIgnoreCase(qVal));
                btn.setOnClickListener(v -> {
                    setVideoQuality(qVal);
                    for (TextView b : qualityBtns) if (b != null) highlightButton(b, b == btn);
                });
            }
        }

        // 2. Audio Language Selection
        TextView[] audioBtns = {
            view.findViewById(R.id.audio_btn_sub),
            view.findViewById(R.id.audio_btn_dub),
            view.findViewById(R.id.audio_btn_hin),
            view.findViewById(R.id.audio_btn_tam),
            view.findViewById(R.id.audio_btn_tel),
            view.findViewById(R.id.audio_btn_mal),
            view.findViewById(R.id.audio_btn_kan),
            view.findViewById(R.id.audio_btn_ben)
        };
        String[] audioCodes = {"SUB", "DUB", "HIN", "TAM", "TEL", "MAL", "KAN", "BEN"};
        for (int i = 0; i < audioBtns.length; i++) {
            final String aCode = audioCodes[i];
            final TextView btn = audioBtns[i];
            if (btn != null) {
                highlightButton(btn, currentSelectedAudio.equalsIgnoreCase(aCode));
                btn.setOnClickListener(v -> {
                    setAudioLanguage(aCode);
                    for (TextView b : audioBtns) if (b != null) highlightButton(b, b == btn);
                });
            }
        }

        // 3. Playback Speed Selection
        TextView[] speedBtns = {
            view.findViewById(R.id.speed_btn_05),
            view.findViewById(R.id.speed_btn_1),
            view.findViewById(R.id.speed_btn_125),
            view.findViewById(R.id.speed_btn_15),
            view.findViewById(R.id.speed_btn_2)
        };
        float[] speeds = {0.5f, 1.0f, 1.25f, 1.5f, 2.0f};
        for (int i = 0; i < speedBtns.length; i++) { 
            final float speedVal = speeds[i]; 
            final TextView btn = speedBtns[i]; 
            if (btn != null) {
                highlightButton(btn, currentPermanentSpeed == speedVal); 
                btn.setOnClickListener(v -> { 
                    currentPermanentSpeed = speedVal; 
                    setPlaybackSpeed(speedVal, true); 
                    for (TextView b : speedBtns) if (b != null) highlightButton(b, b == btn); 
                });
            }
        }

        // 4. Captions Customizer Button
        View btnOpenCaptions = view.findViewById(R.id.btn_open_captions_sheet);
        if (btnOpenCaptions != null) {
            btnOpenCaptions.setOnClickListener(v -> {
                dialog.dismiss();
                showCaptionMenu();
            });
        }

        // 5. Volume Boost Switch
        SwitchCompat switchBoost = view.findViewById(R.id.switch_volume_boost); 
        if (switchBoost != null) {
            switchBoost.setChecked(isVolumeBoosted); 
            switchBoost.setOnCheckedChangeListener((b, checked) -> {
                isVolumeBoosted = checked;
                applyVolumeBoost(checked);
            });
        }

        dialog.show();
    }

    private void applyVolumeBoost(boolean boost) {
        if (exoPlayer != null) {
            exoPlayer.setVolume(boost ? 2.5f : 1.0f);
        }
    }

    private void toggleWebSubtitles(boolean show) {
        isSubtitlesEnabled = show;
        if (exoPlayer != null) {
            TrackSelectionParameters.Builder trackParams = exoPlayer.getTrackSelectionParameters().buildUpon();
            if (!show) {
                trackParams.setIgnoredTextSelectionFlags(C.SELECTION_FLAG_DEFAULT | C.SELECTION_FLAG_FORCED);
                trackParams.setPreferredTextLanguage(null);
            } else {
                trackParams.setPreferredTextLanguage("en");
            }
            exoPlayer.setTrackSelectionParameters(trackParams.build());
        }
        if (exoPlayerView != null && exoPlayerView.getSubtitleView() != null) {
            exoPlayerView.getSubtitleView().setVisibility(show ? View.VISIBLE : View.GONE);
        }
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
        if (exoPlayerView == null) return;
        SubtitleView subtitleView = exoPlayerView.getSubtitleView();
        if (subtitleView == null) return;

        float opacityVal = 0f;
        if (!bgOpacity.equals("Off")) {
            opacityVal = Integer.parseInt(bgOpacity.replace("%", "")) / 100f;
        }

        int bgColorInt = bgColor.equalsIgnoreCase("Gray") ? Color.GRAY
                : (bgColor.equalsIgnoreCase("Navy") ? Color.BLUE
                : (bgColor.equalsIgnoreCase("White") ? Color.WHITE : Color.BLACK));

        int bgArgb = Color.argb((int)(opacityVal * 255), Color.red(bgColorInt), Color.green(bgColorInt), Color.blue(bgColorInt));
        int fgColor = Color.parseColor(captionColorHex);

        int edgeType = CaptionStyleCompat.EDGE_TYPE_NONE;
        if (edgeStyle.equalsIgnoreCase("Outline")) {
            edgeType = CaptionStyleCompat.EDGE_TYPE_OUTLINE;
        } else if (edgeStyle.equalsIgnoreCase("Shadow")) {
            edgeType = CaptionStyleCompat.EDGE_TYPE_DROP_SHADOW;
        }

        CaptionStyleCompat style = new CaptionStyleCompat(
                fgColor,
                bgArgb,
                Color.TRANSPARENT,
                edgeType,
                Color.BLACK,
                captionWeight.equalsIgnoreCase("Bold") ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT
        );

        subtitleView.setStyle(style);
        subtitleView.setFractionalTextSize(0.0533f * (captionFontSize / 100.0f));
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
        if (exoPlayer != null) {
            exoPlayer.setPlaybackParameters(new PlaybackParameters(speed));
        }
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
        if (exoPlayer != null) {
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
        }
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
        if (exoPlayer != null) {
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

                if (exoPlayer.isPlaying() && current > 0) {
                    broadcastProgress(current, duration);
                }
            }
        }
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

    private String formatTime(int seconds) { return String.format(Locale.getDefault(), "%02d:%02d", (seconds < 0 ? 0 : seconds) / 60, (seconds < 0 ? 0 : seconds) % 60); }

    private void setupHybridEngine(String url) {
        if (url == null || url.isEmpty()) return;
        
        loadingProgress.setVisibility(View.VISIBLE);
        exoPlayerView.setVisibility(View.VISIBLE);
        playerWebView.setVisibility(View.GONE);

        String audio = getIntent().getStringExtra("audio");
        if (audio != null && !audio.isEmpty()) currentSelectedAudio = audio.toUpperCase();

        // 1. If direct stream URL, play directly in ExoPlayer without loading WebView
        if (url.contains(".m3u8") || url.contains(".mp4") || url.contains("/cdn/hls/") || url.contains("/hls/")) {
            Map<String, String> headers = new HashMap<>();
            try {
                headers.put("Referer", new URL(url).getProtocol() + "://" + new URL(url).getHost() + "/");
                headers.put("Origin", new URL(url).getProtocol() + "://" + new URL(url).getHost());
            } catch (Exception ignored) {}
            setupExoPlayerOnline(url, subtitleUrl, currentSelectedAudio, headers);
            return;
        }

        // 2. If embed webpage, use invisible background sniffer to resolve stream for ExoPlayer
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

        playerWebView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void onStreamExtracted(String streamUrl, String subUrl) {
                if (streamUrl != null && !streamUrl.isEmpty()) {
                    runOnUiThread(() -> {
                        try {
                            playerWebView.evaluateJavascript("try { document.querySelectorAll('video, audio').forEach(function(el){ el.muted = true; el.volume = 0; el.pause(); el.src = ''; }); } catch(e){}", null);
                            playerWebView.stopLoading();
                            playerWebView.loadUrl("about:blank");
                        } catch (Exception ignored) {}

                        Map<String, String> headers = new HashMap<>();
                        try {
                            headers.put("Referer", new URL(url).getProtocol() + "://" + new URL(url).getHost() + "/");
                            headers.put("Origin", new URL(url).getProtocol() + "://" + new URL(url).getHost());
                        } catch (Exception ignored) {}
                        setupExoPlayerOnline(streamUrl, (subUrl != null && !subUrl.isEmpty()) ? subUrl : subtitleUrl, currentSelectedAudio, headers);
                    });
                }
            }
        }, "NativeBridge");

        playerWebView.setWebViewClient(new WebViewClient() {
            private boolean streamCaptured = false;

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String reqUrl = request.getUrl().toString();
                String lower = reqUrl.toLowerCase();
                int anilistId = getIntent().getIntExtra("anilistId", 0);
                int episodeNumber = getIntent().getIntExtra("episodeNumber", 0);
                String audioIntent = getIntent().getStringExtra("audio");

                if ((lower.contains(".vtt") || lower.contains(".srt")) && !lower.contains("thumb")) {
                    if (anilistId > 0 && episodeNumber > 0) {
                        StreamCache.putSubtitle(anilistId, episodeNumber, audioIntent, reqUrl);
                    }
                    subtitleUrl = reqUrl;
                }

                if (!streamCaptured && (lower.contains(".m3u8") || lower.contains(".mp4") || lower.contains(".m4s") || lower.contains("/hls/")) &&
                    !lower.contains("/ads/") && !lower.contains("google-analytics") && !lower.contains("doubleclick") && !lower.contains("facebook")) {
                    
                    streamCaptured = true;
                    if (anilistId > 0 && episodeNumber > 0) {
                        StreamCache.put(anilistId, episodeNumber, audioIntent, reqUrl);
                    }
                    
                    runOnUiThread(() -> {
                        try {
                            playerWebView.evaluateJavascript("try { document.querySelectorAll('video, audio').forEach(function(el){ el.muted = true; el.volume = 0; el.pause(); el.src = ''; }); } catch(e){}", null);
                            playerWebView.stopLoading();
                            playerWebView.loadUrl("about:blank");
                        } catch (Exception ignored) {}

                        Map<String, String> headers = new HashMap<>();
                        try {
                            headers.put("Referer", new URL(url).getProtocol() + "://" + new URL(url).getHost() + "/");
                            headers.put("Origin", new URL(url).getProtocol() + "://" + new URL(url).getHost());
                        } catch (Exception ignored) {}
                        setupExoPlayerOnline(reqUrl, subtitleUrl, currentSelectedAudio, headers);
                    });
                }

                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageFinished(WebView view, String finishedUrl) {
                super.onPageFinished(view, finishedUrl);
                String snifferJs = "(function() { " +
                        "  function muteAllMedia() { " +
                        "    try { " +
                        "      var media = document.querySelectorAll('video, audio'); " +
                        "      for (var i = 0; i < media.length; i++) { " +
                        "        media[i].muted = true; " +
                        "        media[i].volume = 0; " +
                        "      } " +
                        "    } catch(e) {} " +
                        "  } " +
                        "  muteAllMedia(); " +
                        "  setInterval(muteAllMedia, 400); " +
                        "  function findMedia() { " +
                        "    try { " +
                        "      var v = document.querySelector('video'); " +
                        "      if (v) { v.muted = true; v.volume = 0; } " +
                        "      if (v && v.src && v.src.indexOf('http') === 0 && v.src.indexOf('blob:') === -1) { " +
                        "        window.NativeBridge.onStreamExtracted(v.src, ''); " +
                        "        return true; " +
                        "      } " +
                        "      if (window.jwplayer && typeof window.jwplayer === 'function') { " +
                        "        var jw = window.jwplayer(); " +
                        "        try { jw.setMute(true); jw.setVolume(0); } catch(e){} " +
                        "        var item = jw.getPlaylistItem ? jw.getPlaylistItem() : null; " +
                        "        if (item && item.file) { " +
                        "          window.NativeBridge.onStreamExtracted(item.file, ''); " +
                        "          return true; " +
                        "        } " +
                        "      } " +
                        "      if (window.art && window.art.url) { " +
                        "        try { window.art.muted = true; } catch(e){} " +
                        "        window.NativeBridge.onStreamExtracted(window.art.url, ''); " +
                        "        return true; " +
                        "      } " +
                        "    } catch(e) {} " +
                        "    return false; " +
                        "  } " +
                        "  if (!findMedia()) { " +
                        "    try { " +
                        "      var btn = document.getElementById('vid_play') || document.querySelector('.play-button') || document.querySelector('button'); " +
                        "      if (btn) btn.click(); " +
                        "      var v = document.querySelector('video'); " +
                        "      if (v) { v.muted = true; v.volume = 0; if (v.paused) v.play().catch(function(){}); } " +
                        "    } catch(e) {} " +
                        "    setTimeout(findMedia, 1000); " +
                        "    setTimeout(findMedia, 2500); " +
                        "  } " +
                        "})();";
                view.evaluateJavascript(snifferJs, null);
            }
        });

        String referer = "https://www.google.com/";
        try {
            referer = new URL(url).getProtocol() + "://" + new URL(url).getHost() + "/";
        } catch (Exception ignored) {}
        Map<String, String> headers = new HashMap<>();
        headers.put("Referer", referer);
        playerWebView.loadUrl(url, headers);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (exoPlayer != null && !isInPictureInPictureMode()) {
            exoPlayer.pause();
        }
        if (playerWebView != null) {
            try {
                playerWebView.evaluateJavascript("try { document.querySelectorAll('video, audio').forEach(function(el){ el.muted = true; el.volume = 0; el.pause(); }); } catch(e){}", null);
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        currentInstance = null;
        updateHandler.removeCallbacksAndMessages(null);
        hideHandler.removeCallbacksAndMessages(null);
        try {
            unregisterReceiver(pipReceiver);
        } catch (Exception ignored) {}
        if (exoPlayer != null) {
            exoPlayer.stop();
            exoPlayer.release();
            exoPlayer = null;
        }
        if (playerWebView != null) {
            try {
                playerWebView.evaluateJavascript("try { document.querySelectorAll('video, audio').forEach(function(el){ el.muted = true; el.volume = 0; el.pause(); el.src = ''; }); } catch(e){}", null);
                playerWebView.stopLoading();
                playerWebView.loadUrl("about:blank");
                playerWebView.destroy();
            } catch (Exception ignored) {}
        }
    }
}
