package com.anilove.app;

import android.util.Log;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * AniZipHelper provides automated mapping between AniList IDs and TVDB/TMDB/Western
 * season & episode numbers and clean titles (e.g., converting "Mushoku Tensei Cour 2 Ep 1" to "Mushoku Tensei Ep 12").
 */
public class AniZipHelper {
    private static final String TAG = "AniZipHelper";

    public static class Mapping {
        public int anilistId;
        public int malId;
        public String titleEn;
        public String titleRj;
        public String titleJp;
        public int episodeOffset = 0;
        public int season = 1;
        public Map<Integer, Integer> episodeMap = new ConcurrentHashMap<>();
    }

    private static final Map<Integer, Mapping> cache = new ConcurrentHashMap<>();

    /**
     * Cleans anime title by removing release tags, years like (2021), (Cour 1, Cour 2, Part 1, Part 2, etc.)
     */
    public static String cleanTitle(String title) {
        if (title == null) return "";
        return title
            .replaceAll("\\s*\\(\\d{4}\\)", "")
            .replaceAll("\\s*\\(.*?\\)", "")
            .replaceAll("\\s*\\[.*?\\]", "")
            .replaceAll("(?i)\\b(Cour|Part|Season|S)\\s*\\d+\\b", "")
            .replaceAll("(?i)\\b(2nd|3rd|4th|5th|6th|7th|8th|9th)\\s*Season\\b", "")
            .replaceAll(":\\s*$", "")
            .replaceAll("\\s+", " ")
            .trim();
    }

    /**
     * Fetches AniZip mappings for a given AniList ID (cached thread-safely)
     */
    public static Mapping getMapping(int anilistId) {
        if (anilistId <= 0) return null;

        if (cache.containsKey(anilistId)) {
            return cache.get(anilistId);
        }

        try {
            URL zipUrl = new URL("https://api.ani.zip/mappings?anilist_id=" + anilistId);
            HttpURLConnection zipConn = (HttpURLConnection) zipUrl.openConnection();
            zipConn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36");
            zipConn.setConnectTimeout(5000);
            zipConn.setReadTimeout(5000);

            if (zipConn.getResponseCode() == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(zipConn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = in.readLine()) != null) sb.append(line);
                in.close();

                JSONObject obj = new JSONObject(sb.toString());
                Mapping m = new Mapping();
                m.anilistId = anilistId;

                JSONObject mappings = obj.optJSONObject("mappings");
                if (mappings != null) {
                    m.malId = mappings.optInt("mal_id", mappings.optInt("mal", 0));
                }

                JSONObject titles = obj.optJSONObject("titles");
                if (titles != null) {
                    m.titleEn = titles.has("en") ? cleanTitle(titles.optString("en")) : null;
                    m.titleRj = titles.has("rj") ? cleanTitle(titles.optString("rj")) : null;
                    m.titleJp = titles.has("jp") ? cleanTitle(titles.optString("jp")) : null;
                }

                m.episodeOffset = obj.optInt("episodeOffset", 0);
                m.season = obj.optInt("season", 1);

                JSONObject episodes = obj.optJSONObject("episodes");
                if (episodes != null) {
                    for (Iterator<String> it = episodes.keys(); it.hasNext(); ) {
                        String epKey = it.next();
                        try {
                            int appEp = Integer.parseInt(epKey);
                            JSONObject epObj = episodes.optJSONObject(epKey);
                            if (epObj != null) {
                                int tvdbEp = epObj.optInt("episodeNumber", epObj.optInt("absoluteEpisodeNumber", epObj.optInt("tvdbEpisode", epObj.optInt("absolute", appEp))));
                                m.episodeMap.put(appEp, tvdbEp);
                            }
                        } catch (NumberFormatException ignored) {}
                    }
                }

                Log.i(TAG, "Fetched AniZip mapping for AniList ID " + anilistId +
                        " -> Title: " + m.titleEn + ", Offset: " + m.episodeOffset + ", MAL ID: " + m.malId);
                cache.put(anilistId, m);
                return m;
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to fetch AniZip mapping for AniList ID " + anilistId + ": " + e.getMessage());
        }

        return null;
    }

    /**
     * Resolves the target episode number for Western providers (TVDB/MovieBox).
     */
    public static int getMappedEpisode(Mapping mapping, int originalEp) {
        if (mapping == null) return originalEp;
        if (mapping.episodeMap.containsKey(originalEp)) {
            Integer mapped = mapping.episodeMap.get(originalEp);
            if (mapped != null && mapped > 0 && mapped != originalEp) return mapped;
        }
        if (mapping.episodeOffset > 0) {
            return originalEp + mapping.episodeOffset;
        }
        if (mapping.episodeMap.containsKey(originalEp)) {
            Integer mapped = mapping.episodeMap.get(originalEp);
            if (mapped != null && mapped > 0) return mapped;
        }
        return originalEp;
    }

    /**
     * Resolves the target title for MovieBox search query.
     */
    public static String getMappedTitle(Mapping mapping, String fallbackTitle) {
        if (mapping != null && mapping.titleEn != null && !mapping.titleEn.isEmpty()) {
            return cleanTitle(mapping.titleEn);
        }
        if (mapping != null && mapping.titleRj != null && !mapping.titleRj.isEmpty()) {
            return cleanTitle(mapping.titleRj);
        }
        return cleanTitle(fallbackTitle);
    }
}
