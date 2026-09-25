package com.anilove.app;

import android.util.Log;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class StreamCache {
    private static final String TAG = "StreamCache";
    private static final Map<String, String> videoCache = new ConcurrentHashMap<>();
    private static final Map<String, String> subCache = new ConcurrentHashMap<>();

    private static String makeKey(int anilistId, int episodeNumber, String audio) {
        String aud = (audio != null && !audio.isEmpty()) ? audio.trim().toUpperCase() : "DUB";
        return anilistId + "_ep" + episodeNumber + "_" + aud;
    }

    public static void put(int anilistId, int episodeNumber, String audio, String streamUrl) {
        if (streamUrl != null && !streamUrl.isEmpty()) {
            String key = makeKey(anilistId, episodeNumber, audio);
            videoCache.put(key, streamUrl);
            Log.i(TAG, "Cached video stream for " + key + ": " + streamUrl);
        }
    }

    public static void putSubtitle(int anilistId, int episodeNumber, String audio, String subUrl) {
        if (subUrl != null && !subUrl.isEmpty()) {
            String key = makeKey(anilistId, episodeNumber, audio);
            subCache.put(key, subUrl);
            Log.i(TAG, "Cached subtitle for " + key + ": " + subUrl);
        }
    }

    public static String get(int anilistId, int episodeNumber, String audio) {
        String key = makeKey(anilistId, episodeNumber, audio);
        return videoCache.get(key);
    }

    public static String getSubtitle(int anilistId, int episodeNumber, String audio) {
        String key = makeKey(anilistId, episodeNumber, audio);
        return subCache.get(key);
    }

    public static boolean has(int anilistId, int episodeNumber, String audio) {
        String key = makeKey(anilistId, episodeNumber, audio);
        return videoCache.containsKey(key);
    }
}
