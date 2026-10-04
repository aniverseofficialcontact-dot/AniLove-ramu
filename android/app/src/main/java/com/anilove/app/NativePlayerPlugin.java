package com.anilove.app;

import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.util.Log;

import androidx.media3.common.util.UnstableApi;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativePlayer")
public class NativePlayerPlugin extends Plugin {

    public static NativePlayerPlugin currentInstance;

    @Override
    public void load() {
        super.load();
        currentInstance = this;
    }

    public static void setScreenOrientation(int orientation) {
        if (currentInstance != null && currentInstance.getActivity() != null) {
            currentInstance.getActivity().runOnUiThread(() -> {
                try {
                    currentInstance.getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                } catch (Exception ignored) {}
            });
        }
    }

    public static void notifyLanguageChange(String lang) {
        if (currentInstance != null) {
            JSObject ret = new JSObject();
            ret.put("language", lang);
            currentInstance.notifyListeners("onLanguageChange", ret);
        }
    }

    public static void notifyQualityChange(String quality) {
        if (currentInstance != null) {
            JSObject ret = new JSObject();
            ret.put("quality", quality);
            currentInstance.notifyListeners("onQualityChange", ret);
        }
    }

    private static String lastPlayUrl = null;
    private static long lastPlayTime = 0;

    @PluginMethod
    public void play(PluginCall call) {
        currentInstance = this;
        String url = call.getString("url");
        long now = System.currentTimeMillis();

        lastPlayUrl = url;
        lastPlayTime = now;

        Log.e("AniLove_Diagnostic", ">>> RECEIVED URL FROM WEB: " + url);
        
        if (url == null) {
            call.reject("Must provide a URL");
            return;
        }

        try {
            NativePlayerActivity.navigationListener = new NativePlayerActivity.PlayerNavigationListener() {
                @Override
                public void onNavigate(boolean next) {
                    JSObject ret = new JSObject();
                    ret.put("direction", next ? "next" : "prev");
                    notifyListeners("onEpisodeNavigation", ret);
                }

                @Override
                public void onBack() {
                    // Send signal to Web App to navigate to Anime Details
                    notifyListeners("onBackButtonPressed", new JSObject(), true);
                    if (getActivity() != null) {
                        getActivity().runOnUiThread(() -> {
                            try {
                                if (getBridge() != null && getBridge().getWebView() != null) {
                                    getBridge().getWebView().evaluateJavascript(
                                        "window.dispatchEvent(new CustomEvent('nativePlayerBackButtonPressed'));", 
                                        null
                                    );
                                }
                            } catch (Exception e) {
                                Log.e("NativePlayerPlugin", "Error dispatching back event", e);
                            }
                        });
                    }
                }
            };

            Intent intent = new Intent(getActivity(), NativePlayerActivity.class);
            intent.putExtra("url", url);
            intent.putExtra("serverName", call.getString("serverName"));
            intent.putExtra("sourceName", call.getString("sourceName"));
            intent.putExtra("targetUrl", call.getString("targetUrl"));
            intent.putExtra("availableLanguages", call.getString("availableLanguages"));
            intent.putExtra("availableResolutions", call.getString("availableResolutions"));
            intent.putExtra("languageQualityMap", call.getString("languageQualityMap"));
            intent.putExtra("title", call.getString("title", "Now Playing"));
            
            Boolean hasNext = call.getBoolean("hasNext");
            Boolean hasPrev = call.getBoolean("hasPrev");
            Boolean startFullscreen = call.getBoolean("startFullscreen");
            Boolean advancePlayer = call.getBoolean("advancePlayer", false);
            Log.i("NativePlayerPlugin", ">>> hasNext: " + hasNext + ", hasPrev: " + hasPrev + ", startFullscreen: " + startFullscreen + ", advancePlayer: " + advancePlayer);
            
            intent.putExtra("hasNext", hasNext != null ? hasNext : false);
            intent.putExtra("hasPrev", hasPrev != null ? hasPrev : false);
            intent.putExtra("startFullscreen", startFullscreen != null ? startFullscreen : false);
            intent.putExtra("advancePlayer", advancePlayer != null ? advancePlayer : false);
            intent.putExtra("yOffset", call.getInt("yOffset", 320));
            intent.putExtra("anilistId", call.getInt("anilistId", 0));
            intent.putExtra("idMal", call.getInt("idMal", 0));
            intent.putExtra("episodeNumber", call.getInt("episodeNumber", 0));
            intent.putExtra("audio", call.getString("audio", "DUB"));
            intent.putExtra("subtitleUrl", call.getString("subtitleUrl"));
            intent.putExtra("subtitleLang", call.getString("subtitleLang", "English"));
            Boolean autoSkipIntro = call.getBoolean("autoSkipIntro", false);
            intent.putExtra("autoSkipIntro", autoSkipIntro != null ? autoSkipIntro : false);
            intent.putExtra("allSubtitles", call.getString("allSubtitles"));
            intent.putExtra("startTime", call.getInt("startTime", 0));
            intent.putExtra("engineMode", call.getString("engineMode", "exo"));
            intent.setFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            Log.e("NativePlayerPlugin", "Failed to start NativePlayerActivity", e);
            call.reject("Failed to start player: " + e.getMessage());
        }
    }

    @PluginMethod
    public void updatePosition(PluginCall call) {
        Integer y = call.getInt("y");
        if (y != null && NativePlayerActivity.currentInstance != null) {
            NativePlayerActivity.currentInstance.updatePosition(y);
            call.resolve();
        } else {
            call.resolve(); // Silent fail if not active
        }
    }

    @PluginMethod
    public void switchEngine(PluginCall call) {
        String mode = call.getString("mode", "exo");
        if (NativePlayerActivity.currentInstance != null) {
            boolean useWeb = "web".equalsIgnoreCase(mode);
            NativePlayerActivity.currentInstance.switchPlayerEngine(useWeb);
        }
        call.resolve();
    }

    @PluginMethod
    public void toggleLandscape(PluginCall call) {
        if (NativePlayerActivity.currentInstance != null) {
            NativePlayerActivity.currentInstance.runOnUiThread(() -> {
                try {
                    NativePlayerActivity.currentInstance.toggleFullscreenInPlace();
                } catch (Exception ignored) {}
            });
        }
        call.resolve();
    }

    @PluginMethod
    public void close(PluginCall call) {
        lastPlayUrl = null;
        lastPlayTime = 0;
        if (NativePlayerActivity.currentInstance != null) {
            NativePlayerActivity.currentInstance.runOnUiThread(() -> {
                try {
                    NativePlayerActivity.currentInstance.finish();
                    NativePlayerActivity.currentInstance.overridePendingTransition(0, 0);
                } catch (Exception ignored) {}
            });
        }
        call.resolve();
    }
}
