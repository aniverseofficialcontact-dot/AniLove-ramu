package com.anilove.app;

import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class VideoSniffer {
    private static final String TAG = "VideoSniffer";
    private WebView webView;
    private OnVideoFoundListener listener;
    private boolean found = false;
    private String capturedSubtitleUrl = "";
    private Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private Runnable timeoutRunnable;

    // Notice: .ts is purposely excluded so we capture .m3u8 playlists or .mp4 files, not individual 2-second transport chunks
    private static final List<String> VIDEO_EXTENSIONS = Arrays.asList(
            ".m3u8", ".mp4", ".m4s", ".mpd", ".m4v", "googlevideo.com",
            "manifest.m3u8", "playlist.m3u8", "master.m3u8", "index.m3u8", ".m3u"
    );

    public interface OnVideoFoundListener {
        void onVideoFound(String url);
        default void onVideoFound(String videoUrl, String subtitleUrl) {
            onVideoFound(videoUrl);
        }
        void onError(String message);
    }

    public VideoSniffer(Context context) {
        webView = new WebView(context);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setLoadsImagesAutomatically(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setUserAgentString("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

        // Set realistic viewport so responsive players layout properly instead of 0x0
        webView.layout(0, 0, 1280, 720);
        webView.onResume();
        webView.resumeTimers();

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                Log.d(TAG, "Intercepted request: " + url);

                String lower = url.toLowerCase();
                if ((lower.contains(".vtt") || lower.contains(".srt")) && !lower.contains("thumb")) {
                    capturedSubtitleUrl = url;
                    Log.i(TAG, "Found Subtitle URL: " + url);
                }

                if (isVideoUrl(url)) {
                    if (!found) {
                        found = true;
                        Log.i(TAG, "SUCCESS! Caught Video URL: " + url);
                        cleanup();
                        new Handler(Looper.getMainLooper()).post(() -> {
                            if (listener != null) listener.onVideoFound(url, capturedSubtitleUrl);
                        });
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    Log.w(TAG, "Main frame warning/error: " + error.getDescription());
                }
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                injectRequestSniffer(view);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectRequestSniffer(view);
            }
        });

        webView.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void onUrlFound(String url) {
                if (url == null) return;
                String lower = url.toLowerCase();
                if ((lower.contains(".vtt") || lower.contains(".srt")) && !lower.contains("thumb")) {
                    capturedSubtitleUrl = url;
                }
                if (isVideoUrl(url) && !found) {
                    found = true;
                    Log.i(TAG, "Script found Video URL: " + url);
                    cleanup();
                    new Handler(Looper.getMainLooper()).post(() -> {
                        if (listener != null) listener.onVideoFound(url, capturedSubtitleUrl);
                    });
                }
            }
        }, "VideoBridge");
    }

    private void injectRequestSniffer(WebView view) {
        String script =
            "(function() {" +
            "  try {" +
            "    var originalXHR = window.XMLHttpRequest.prototype.open;" +
            "    window.XMLHttpRequest.prototype.open = function(method, url) {" +
            "      if (url && typeof url === 'string') VideoBridge.onUrlFound(url);" +
            "      return originalXHR.apply(this, arguments);" +
            "    };" +
            "    var originalFetch = window.fetch;" +
            "    window.fetch = function(input, init) {" +
            "      var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');" +
            "      if (url) VideoBridge.onUrlFound(url);" +
            "      return originalFetch.apply(this, arguments);" +
            "    };" +
            "  } catch(e) {}" +
            "  function deepAutoClick(win) {" +
            "    try {" +
            "      var selectors = ['#player', '.play-button', '.vjs-big-play-button', '.jw-display-icon-container', 'button', 'video', '.art-state', '.art-control-playAndPause', '.play', '[aria-label*=\"Play\"]', '[title*=\"Play\"]'];" +
            "      selectors.forEach(function(sel) {" +
            "        var els = win.document.querySelectorAll(sel);" +
            "        els.forEach(function(el) { try { el.click(); } catch(e){} });" +
            "      });" +
            "    } catch(e) {}" +
            "    for (var i = 0; i < win.frames.length; i++) {" +
            "      try { deepAutoClick(win.frames[i]); } catch(e){}" +
            "    }" +
            "  }" +
            "  function deepScan(win) {" +
            "    try {" +
            "      if (win.hls && win.hls.url) VideoBridge.onUrlFound(win.hls.url);" +
            "      if (typeof win.jwplayer === 'function') {" +
            "        try { var jp = win.jwplayer(); if (jp && jp.getPlaylist) { var pl = jp.getPlaylist(); if (pl && pl[0] && pl[0].file) VideoBridge.onUrlFound(pl[0].file); } } catch(e){}" +
            "      }" +
            "      if (win.art && win.art.option && win.art.option.url) VideoBridge.onUrlFound(win.art.option.url);" +
            "      var vids = win.document.querySelectorAll('video');" +
            "      for (var i = 0; i < vids.length; i++) {" +
            "        var src = vids[i].currentSrc || vids[i].src;" +
            "        if (src && src.indexOf('blob:') !== 0) VideoBridge.onUrlFound(src);" +
            "        var sources = vids[i].querySelectorAll('source');" +
            "        for (var j = 0; j < sources.length; j++) {" +
            "          if (sources[j].src) VideoBridge.onUrlFound(sources[j].src);" +
            "        }" +
            "      }" +
            "      var tracks = win.document.querySelectorAll('track');" +
            "      for (var t = 0; t < tracks.length; t++) {" +
            "        if (tracks[t].src) VideoBridge.onUrlFound(tracks[t].src);" +
            "      }" +
            "    } catch(e) {}" +
            "    for (var k = 0; k < win.frames.length; k++) {" +
            "      try { deepScan(win.frames[k]); } catch(e){}" +
            "    }" +
            "  }" +
            "  deepAutoClick(window); setTimeout(function(){ deepAutoClick(window); }, 1200);" +
            "  deepScan(window); setTimeout(function(){ deepScan(window); }, 800); setTimeout(function(){ deepScan(window); }, 2000);" +
            "})();";
        view.evaluateJavascript(script, null);
    }

    private boolean isVideoUrl(String url) {
        if (url == null || url.trim().isEmpty()) return false;
        String lowerUrl = url.toLowerCase().trim();

        // 1. Block analytics, telemetry, and tracking domains / paths
        if (lowerUrl.contains("jwpltx.com") || lowerUrl.contains("ping.gif") ||
            lowerUrl.contains("google-analytics") || lowerUrl.contains("googletagmanager") ||
            lowerUrl.contains("doubleclick") || lowerUrl.contains("analytics") ||
            lowerUrl.contains("/ads/") || lowerUrl.contains("adservice") ||
            lowerUrl.contains("/beacon") || lowerUrl.contains("/events") ||
            lowerUrl.contains("/ping") || lowerUrl.contains("/track") ||
            lowerUrl.contains("/telemetry") || lowerUrl.contains("/log") ||
            lowerUrl.contains("/stats") || lowerUrl.contains("socket.io") ||
            lowerUrl.contains("clarity.ms") || lowerUrl.contains("hotjar") ||
            lowerUrl.contains("mixpanel") || lowerUrl.contains("sentry")) {
            return false;
        }

        // 2. Strip query params and hash to check the clean URL path extension
        String cleanPath = lowerUrl;
        int qIdx = cleanPath.indexOf('?');
        if (qIdx != -1) cleanPath = cleanPath.substring(0, qIdx);
        int hIdx = cleanPath.indexOf('#');
        if (hIdx != -1) cleanPath = cleanPath.substring(0, hIdx);

        // Block static web resources based on clean file extension
        if (cleanPath.endsWith(".js") || cleanPath.endsWith(".css") ||
            cleanPath.endsWith(".png") || cleanPath.endsWith(".jpg") ||
            cleanPath.endsWith(".jpeg") || cleanPath.endsWith(".webp") ||
            cleanPath.endsWith(".svg") || cleanPath.endsWith(".gif") ||
            cleanPath.endsWith(".ico") || cleanPath.endsWith(".woff") ||
            cleanPath.endsWith(".woff2") || cleanPath.endsWith(".ttf") ||
            cleanPath.endsWith(".html") || cleanPath.endsWith(".htm") ||
            cleanPath.endsWith(".php") || cleanPath.endsWith(".json")) {
            return false;
        }

        // Must not be an individual 2-second .ts segment (we want playlist or full video)
        if (cleanPath.endsWith(".ts") && !cleanPath.contains(".m3u8")) {
            return false;
        }

        // 3. Must have valid video or playlist extension in the clean path or query
        for (String ext : VIDEO_EXTENSIONS) {
            if (cleanPath.contains(ext)) {
                return true;
            }
        }
        if (cleanPath.endsWith(".mp4") || cleanPath.endsWith(".m4s") || cleanPath.endsWith(".mpd") || cleanPath.endsWith(".m3u8")) {
            return true;
        }
        return false;
    }

    public void sniff(String pageUrl, OnVideoFoundListener listener) {
        this.listener = listener;
        this.found = false;

        // Immediate check: if pageUrl itself is already a video link
        if (isVideoUrl(pageUrl)) {
            Log.i(TAG, "Initial URL is already a video link: " + pageUrl);
            this.found = true;
            listener.onVideoFound(pageUrl, "");
            return;
        }

        Log.d(TAG, "Sniffing started for: " + pageUrl);
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (pageUrl.contains("abyssplayer") || pageUrl.contains("short.icu") ||
                    pageUrl.contains("piratexplay") || pageUrl.contains("iqsmart") ||
                    pageUrl.contains("rubystm") || pageUrl.contains("vidsrc") ||
                    pageUrl.contains("vidlink") || pageUrl.contains("autoembed") ||
                    pageUrl.contains("embed") || pageUrl.contains("public")) {

                    String iframeHtml = "<!DOCTYPE html>" +
                            "<html><head>" +
                            "<meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                            "<style>html,body{margin:0;padding:0;width:100%;height:100%;background:#000;}iframe{width:100%;height:100%;border:none;}</style>" +
                            "</head><body>" +
                            "<iframe id='videoFrame' src='" + pageUrl.replace("'", "\\'") + "' allow='autoplay; fullscreen; encrypted-media' allowfullscreen referrerpolicy='no-referrer'></iframe>" +
                            "</body></html>";

                    String baseUrl = "https://piratexplay.cc/";
                    if (pageUrl.contains("vidlink")) baseUrl = "https://vidlink.pro/";
                    else if (pageUrl.contains("vidsrc")) baseUrl = "https://vidsrc.cc/";
                    else if (pageUrl.contains("autoembed")) baseUrl = "https://autoembed.co/";
                    else if (pageUrl.contains("rubystm")) baseUrl = "https://rubystm.com/";
                    else if (pageUrl.contains("iqsmart")) baseUrl = "https://pro.iqsmartgames.com/";

                    Log.i(TAG, "Loading embed in sniffer iframe via loadDataWithBaseURL: " + baseUrl);
                    webView.loadDataWithBaseURL(baseUrl, iframeHtml, "text/html", "UTF-8", null);
                } else {
                    Map<String, String> headers = new HashMap<>();
                    String referer = "https://piratexplay.cc/";
                    if (pageUrl.contains("justanime.to")) {
                        referer = "https://justanime.to/";
                    } else if (pageUrl.contains("vidlink.pro")) {
                        referer = "https://vidlink.pro/";
                    } else if (pageUrl.contains("rubystm")) {
                        referer = "https://rubystm.com/";
                    } else if (pageUrl.contains("iqsmart")) {
                        referer = "https://pro.iqsmartgames.com/";
                    }
                    headers.put("Referer", referer);
                    headers.put("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
                    webView.loadUrl(pageUrl, headers);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error loading URL in sniffer", e);
            }
        });

        // 35 second timeout — embed players need time to pass Cloudflare + initialize
        timeoutRunnable = () -> {
            if (!found) {
                Log.e(TAG, "Sniffing timed out for " + pageUrl);
                cleanup();
                if (listener != null) {
                    listener.onError("Stream extraction timed out. Please try selecting another server (HD-2, StreamTape, etc.)");
                }
            }
        };
        timeoutHandler.postDelayed(timeoutRunnable, 35000);
    }

    private void cleanup() {
        timeoutHandler.removeCallbacks(timeoutRunnable);
        new Handler(Looper.getMainLooper()).post(() -> {
            if (webView != null) {
                try {
                    webView.evaluateJavascript(
                        "(function(){" +
                        "  var e=document.querySelectorAll('video,audio');" +
                        "  for(var i=0;i<e.length;i++){try{e[i].pause();e[i].src='';}catch(err){}}" +
                        "  if(window.frames){for(var j=0;j<window.frames.length;j++){" +
                        "    try{var fe=window.frames[j].document.querySelectorAll('video,audio');" +
                        "    for(var k=0;k<fe.length;k++){fe[k].pause();fe[k].src='';}}catch(err){}" +
                        "  }}" +
                        "})();", null);
                    webView.stopLoading();
                    webView.loadUrl("about:blank");
                    webView.onPause();
                    webView.destroy();
                } catch (Exception ignored) {}
                webView = null;
            }
        });
    }
}
