package com.anilove.app;

import android.util.Log;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class StreamCache {
    private static final String TAG = "StreamCache";
    private static final int MAX_ENTRIES = 50;
    private static final Map<String, String> videoCache = new ConcurrentHashMap<>();
    private static final Map<String, String> subCache = new ConcurrentHashMap<>();

    private static String makeKey(int anilistId, int episodeNumber, String audio, String serverName) {
        String aud = (audio != null && !audio.isEmpty()) ? audio.trim().toUpperCase() : "DUB";
        String srv = (serverName != null && !serverName.isEmpty()) ? serverName.trim().toLowerCase().replaceAll("[^a-z0-9]", "") : "none";
        return anilistId + "_ep" + episodeNumber + "_" + aud + "_" + srv;
    }

    private static void checkEviction(Map<String, String> cache) {
        if (cache.size() >= MAX_ENTRIES) {
            cache.clear();
            Log.i(TAG, "Cache size exceeded max capacity (" + MAX_ENTRIES + "). Cleared cache to free memory.");
        }
    }

    public static void put(int anilistId, int episodeNumber, String audio, String serverName, String streamUrl) {
        if (streamUrl != null && !streamUrl.isEmpty()) {
            checkEviction(videoCache);
            String key = makeKey(anilistId, episodeNumber, audio, serverName);
            videoCache.put(key, streamUrl);
            Log.i(TAG, "Cached video stream for " + key + ": " + streamUrl);
        }
    }

    public static void put(int anilistId, int episodeNumber, String audio, String streamUrl) {
        put(anilistId, episodeNumber, audio, null, streamUrl);
    }

    public static void putSubtitle(int anilistId, int episodeNumber, String audio, String serverName, String subUrl) {
        if (subUrl != null && !subUrl.isEmpty()) {
            checkEviction(subCache);
            String key = makeKey(anilistId, episodeNumber, audio, serverName);
            subCache.put(key, subUrl);
            Log.i(TAG, "Cached subtitle for " + key + ": " + subUrl);
        }
    }

    public static void putSubtitle(int anilistId, int episodeNumber, String audio, String subUrl) {
        putSubtitle(anilistId, episodeNumber, audio, null, subUrl);
    }

    public static String get(int anilistId, int episodeNumber, String audio, String serverName) {
        if (serverName == null || serverName.trim().isEmpty()) return null;
        String key = makeKey(anilistId, episodeNumber, audio, serverName);
        return videoCache.get(key);
    }

    public static String get(int anilistId, int episodeNumber, String audio) {
        return null; // Require explicit serverName to prevent cross-server cache collision
    }

    public static String getSubtitle(int anilistId, int episodeNumber, String audio, String serverName) {
        if (serverName == null || serverName.trim().isEmpty()) return null;
        String key = makeKey(anilistId, episodeNumber, audio, serverName);
        return subCache.get(key);
    }

    public static String getSubtitle(int anilistId, int episodeNumber, String audio) {
        return null; // Require explicit serverName to prevent cross-server cache collision
    }

    public static boolean has(int anilistId, int episodeNumber, String audio, String serverName) {
        if (serverName == null || serverName.trim().isEmpty()) return false;
        String key = makeKey(anilistId, episodeNumber, audio, serverName);
        return videoCache.containsKey(key);
    }

    public static boolean has(int anilistId, int episodeNumber, String audio) {
        return false;
    }

    public static void clear() {
        videoCache.clear();
        subCache.clear();
        Log.i(TAG, "StreamCache cleared manually.");
    }
}
