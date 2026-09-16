package com.anilove.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * High-performance Android Foreground Service for multi-episode background downloading.
 * Supports:
 * - Simultaneous parallel downloading (up to 2 active downloads, remaining queued)
 * - Automatic background stream sniffing for embed servers via VideoSniffer
 * - Pause / Resume ("Continue downloading" without restarting)
 * - Direct MP4 byte-range downloads & HLS (.m3u8) chunked stream downloads
 * - Subtitle (.vtt) download
 * - Android system notification progress updates with Pause/Resume/Cancel actions
 */
public class EpisodeDownloadService extends Service {
    private static final String TAG = "AniLoveDownloader";
    private static final String CHANNEL_ID = "anilove_downloads_channel";
    private static final int NOTIFICATION_ID = 9901;

    public static final String ACTION_START = "com.anilove.app.action.START_DOWNLOAD";
    public static final String ACTION_PAUSE = "com.anilove.app.action.PAUSE_DOWNLOAD";
    public static final String ACTION_RESUME = "com.anilove.app.action.RESUME_DOWNLOAD";
    public static final String ACTION_CANCEL = "com.anilove.app.action.CANCEL_DOWNLOAD";

    public interface DownloadProgressListener {
        void onProgress(String downloadId, int progressPercent, long bytesDownloaded, long totalBytes, String speed);
        void onStatusChange(String downloadId, String status, String error);
    }
    public static DownloadProgressListener progressListener;

    public static class DownloadItem {
        public String id;
        public int anilistId;
        public String animeTitle;
        public int episodeNumber;
        public String pageUrl;
        public String streamUrl;
        public String subtitleUrl;
        public String audio; // SUB or DUB
        public String serverName;
        public String quality;
        public String thumbnail;
        public String status; // QUEUED, DOWNLOADING, PAUSED, COMPLETED, ERROR
        public int progress;
        public long bytesDownloaded;
        public long totalBytes;
        public String localFilePath;
        public String localSubPath;
        public String speed;
        public String error;
        public boolean isHls;
        public volatile boolean isPaused = false;
        public volatile boolean isCancelled = false;
        public Future<?> taskFuture;
    }

    private static final Map<String, DownloadItem> allDownloads = new ConcurrentHashMap<>();
    private final ExecutorService threadPool = Executors.newFixedThreadPool(2); // 2 simultaneous downloads
    private NotificationManager notificationManager;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        loadSavedDownloadsFromDisk();

        // Android 14 requirement: Immediately start foreground in onCreate()
        Notification initialNotification = buildNotification("AniLove Downloader", "Background download service active", -1, false);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, initialNotification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICATION_ID, initialNotification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting foreground in onCreate", e);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "AniLove Downloads",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows active anime episode download progress");
            channel.enableVibration(false);
            channel.setSound(null, null);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            String downloadId = intent.getStringExtra("downloadId");

            if (ACTION_START.equals(action)) {
                String jsonStr = intent.getStringExtra("itemJson");
                if (jsonStr != null) {
                    try {
                        JSONObject obj = new JSONObject(jsonStr);
                        DownloadItem item = parseDownloadItem(obj);
                        allDownloads.put(item.id, item);
                        saveDownloadMetadata(item);
                        queueDownload(item);
                    } catch (Exception e) {
                        Log.e(TAG, "Error parsing start download payload", e);
                    }
                }
            } else if (ACTION_PAUSE.equals(action) && downloadId != null) {
                pauseDownload(downloadId);
            } else if (ACTION_RESUME.equals(action) && downloadId != null) {
                resumeDownload(downloadId);
            } else if (ACTION_CANCEL.equals(action) && downloadId != null) {
                cancelDownload(downloadId);
            }
        }

        updateForegroundNotification();
        return START_STICKY;
    }

    private DownloadItem parseDownloadItem(JSONObject obj) {
        DownloadItem item = new DownloadItem();
        item.id = obj.optString("id", System.currentTimeMillis() + "");
        item.anilistId = obj.optInt("anilistId", 0);
        item.animeTitle = obj.optString("animeTitle", "Anime");
        item.episodeNumber = obj.optInt("episodeNumber", 1);
        item.streamUrl = obj.optString("streamUrl", "");
        item.pageUrl = obj.optString("pageUrl", item.streamUrl);
        item.subtitleUrl = obj.optString("subtitleUrl", "");
        item.audio = obj.optString("audio", "DUB");
        item.serverName = obj.optString("serverName", "Standard");
        item.quality = obj.optString("quality", "1080p");
        item.thumbnail = obj.optString("thumbnail", "");
        item.status = "QUEUED";
        item.progress = 0;
        item.bytesDownloaded = 0;
        item.totalBytes = 0;
        item.isHls = item.streamUrl.contains(".m3u8") || item.streamUrl.contains("hls") || item.streamUrl.contains(".m3u");
        return item;
    }

    public static List<DownloadItem> getAllDownloads() {
        return new ArrayList<>(allDownloads.values());
    }

    public static DownloadItem getDownload(String id) {
        return allDownloads.get(id);
    }

    public void queueDownload(DownloadItem item) {
        item.isPaused = false;
        item.isCancelled = false;
        item.status = "QUEUED";
        notifyStatus(item, "QUEUED", null);

        item.taskFuture = threadPool.submit(() -> {
            try {
                executeDownload(item);
            } catch (Exception e) {
                Log.e(TAG, "Download failed for " + item.animeTitle + " EP " + item.episodeNumber, e);
                if (!item.isPaused && !item.isCancelled) {
                    item.status = "ERROR";
                    item.error = e.getMessage() != null ? e.getMessage() : "Download error";
                    notifyStatus(item, "ERROR", item.error);
                    showErrorNotification(item);
                }
            } finally {
                updateForegroundNotification();
            }
        });
    }

    public void pauseDownload(String downloadId) {
        DownloadItem item = allDownloads.get(downloadId);
        if (item != null && "DOWNLOADING".equals(item.status)) {
            item.isPaused = true;
            item.status = "PAUSED";
            if (item.taskFuture != null) {
                item.taskFuture.cancel(true);
            }
            saveDownloadMetadata(item);
            notifyStatus(item, "PAUSED", null);
            updateForegroundNotification();
        }
    }

    public void resumeDownload(String downloadId) {
        DownloadItem item = allDownloads.get(downloadId);
        if (item != null && ("PAUSED".equals(item.status) || "ERROR".equals(item.status))) {
            item.error = null;
            queueDownload(item);
            updateForegroundNotification();
        }
    }

    public void cancelDownload(String downloadId) {
        DownloadItem item = allDownloads.get(downloadId);
        if (item != null) {
            item.isCancelled = true;
            if (item.taskFuture != null) {
                item.taskFuture.cancel(true);
            }
            allDownloads.remove(downloadId);
            deleteLocalFiles(item);
            notifyStatus(item, "CANCELLED", null);
            updateForegroundNotification();
        }
    }

    private void executeDownload(DownloadItem item) throws Exception {
        item.status = "DOWNLOADING";
        notifyStatus(item, "DOWNLOADING", null);
        updateForegroundNotification();

        // 0. Check if this stream was already captured by active player or recent sniff
        String cached = StreamCache.get(item.anilistId, item.episodeNumber, item.audio);
        if (cached != null && !cached.isEmpty()) {
            Log.i(TAG, "Found pre-cached stream from active player: " + cached);
            item.pageUrl = item.streamUrl;
            item.streamUrl = cached;
            item.isHls = item.streamUrl.contains(".m3u8") || item.streamUrl.contains("hls") || item.streamUrl.contains(".m3u");
            String cachedSub = StreamCache.getSubtitle(item.anilistId, item.episodeNumber, item.audio);
            if (cachedSub != null && !cachedSub.isEmpty() && (item.subtitleUrl == null || item.subtitleUrl.isEmpty())) {
                item.subtitleUrl = cachedSub;
            }
        } else if (!item.streamUrl.contains(".m3u8") && !item.streamUrl.contains(".mp4") && !item.streamUrl.contains(".m4s")) {
            // Step 1: Try server-side extraction via Render backend (same as player — if player works, this works)
            Log.i(TAG, "URL is embed page. Trying Render backend extraction for: "
                + item.animeTitle + " EP" + item.episodeNumber);
            String[] serverResult = tryServerSideExtractFull(item);
            if (serverResult != null && serverResult[0] != null && !serverResult[0].isEmpty()) {
                String resolvedUrl = serverResult[0];
                Log.i(TAG, "Render returned URL: " + resolvedUrl.substring(0, Math.min(80, resolvedUrl.length())));
                item.pageUrl = item.streamUrl;
                item.streamUrl = resolvedUrl;
                // Update subtitle if provided
                if (serverResult[1] != null && !serverResult[1].isEmpty()
                        && (item.subtitleUrl == null || item.subtitleUrl.isEmpty())) {
                    item.subtitleUrl = serverResult[1];
                }
                // If Render returned a direct .m3u8/.mp4 — we're done, skip VideoSniffer
                boolean isDirect = resolvedUrl.contains(".m3u8") || resolvedUrl.contains(".mp4")
                        || resolvedUrl.contains(".m4s") || resolvedUrl.contains(".m3u");
                if (isDirect) {
                    item.isHls = resolvedUrl.contains(".m3u8") || resolvedUrl.contains(".m3u");
                    Log.i(TAG, "Direct stream from Render — skipping VideoSniffer");
                } else {
                    // Render returned an embed URL — still need VideoSniffer, but now we have the RIGHT embed URL
                    Log.i(TAG, "Render returned embed URL, running VideoSniffer on it with correct referer");
                    sniffVideoStream(item);
                }
            } else {
                // Step 2: Fall back to VideoSniffer on the original embed URL
                Log.i(TAG, "Render backend failed, falling back to VideoSniffer for: " + item.streamUrl);
                sniffVideoStream(item);
            }
        }

        File downloadDir = getDownloadDirectory(item.animeTitle, item.anilistId);
        if (!downloadDir.exists()) downloadDir.mkdirs();

        String referer = getRefererForUrl(item.streamUrl, item.pageUrl);

        // 2. Download Subtitle if present
        if (item.subtitleUrl != null && !item.subtitleUrl.isEmpty()) {
            try {
                File subFile = new File(downloadDir, "ep_" + item.episodeNumber + ".vtt");
                downloadFileDirect(item.subtitleUrl, subFile, referer);
                item.localSubPath = subFile.getAbsolutePath();
            } catch (Exception subErr) {
                Log.w(TAG, "Non-critical: Subtitle download failed: " + subErr.getMessage());
            }
        }

        // 3. Download Video (HLS or Direct MP4)
        File videoFile = new File(downloadDir, "ep_" + item.episodeNumber + ".mp4");
        item.localFilePath = videoFile.getAbsolutePath();

        if (item.isHls) {
            downloadHlsStream(item, downloadDir, videoFile);
        } else {
            downloadDirectVideo(item, videoFile);
        }

        if (!item.isPaused && !item.isCancelled) {
            item.status = "COMPLETED";
            item.progress = 100;
            saveDownloadMetadata(item);
            notifyStatus(item, "COMPLETED", null);
            Log.i(TAG, "Successfully completed download: " + item.animeTitle + " EP " + item.episodeNumber);
        }
    }

    /**
     * Uses background invisible WebView to sniff out real .m3u8 or .mp4 stream URL from embed player
     */
    private void sniffVideoStream(DownloadItem item) throws Exception {
        notifyProgress(item, "Finding stream...");

        final String[] foundStream = new String[2]; // [0] = videoUrl, [1] = subtitleUrl
        final CountDownLatch latch = new CountDownLatch(1);

        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                VideoSniffer sniffer = new VideoSniffer(getApplicationContext());
                sniffer.sniff(item.streamUrl, new VideoSniffer.OnVideoFoundListener() {
                    @Override
                    public void onVideoFound(String videoUrl, String subtitleUrl) {
                        foundStream[0] = videoUrl;
                        foundStream[1] = subtitleUrl;
                        latch.countDown();
                    }

                    @Override
                    public void onVideoFound(String url) {
                        foundStream[0] = url;
                        latch.countDown();
                    }

                    @Override
                    public void onError(String message) {
                        Log.w(TAG, "Sniffer message for " + item.id + ": " + message);
                        latch.countDown();
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Error launching VideoSniffer", e);
                latch.countDown();
            }
        });

        // Wait up to 25 seconds for stream capture
        latch.await(25, TimeUnit.SECONDS);

        if (foundStream[0] != null && !foundStream[0].isEmpty()) {
            item.pageUrl = item.streamUrl;
            item.streamUrl = foundStream[0];
            if (foundStream[1] != null && !foundStream[1].isEmpty() && (item.subtitleUrl == null || item.subtitleUrl.isEmpty())) {
                item.subtitleUrl = foundStream[1];
            }
            item.isHls = item.streamUrl.contains(".m3u8") || item.streamUrl.contains("hls") || item.streamUrl.contains(".m3u");
            Log.i(TAG, "Captured stream for EP " + item.episodeNumber + ": " + item.streamUrl);
        } else {
            throw new Exception("Could not extract stream from " + item.serverName + ". Try selecting another server.");
        }
    }

    /**
     * Calls the Render-hosted backend's /api/anikoto/resolve endpoint to get
     * a direct stream URL for downloading, without needing VideoSniffer at all.
     * This is the same endpoint the player uses — if the player works, this will too.
     *
     * @param item The DownloadItem containing anilistId, animeTitle, episodeNumber, audio
     * @return String[2] = { streamUrl, subtitleUrl }, or null if resolution failed
     */
    private String[] tryServerSideExtractFull(DownloadItem item) {
        try {
            // Render.com cloud backend master multi-language endpoint
            String apiUrl = "https://anilove-backend.onrender.com/api/stream/resolve";

            // Preserve full audio language code (HIN, TAM, TEL, MAL, BEN, DUB, SUB)
            String lang = item.audio != null && !item.audio.isEmpty() ? item.audio.toUpperCase() : "DUB";
            String safeTitle = item.animeTitle != null
                ? item.animeTitle.replace("\\", "\\\\").replace("\"", "\\\"")
                : "Anime";
            String safeServer = item.serverName != null
                ? item.serverName.replace("\\", "\\\\").replace("\"", "\\\"")
                : "";

            String safeProviderId = "anikoto-hd1";
            if (safeServer.toLowerCase().contains("animeworld") || safeServer.toLowerCase().contains("indian") || safeServer.toLowerCase().contains("zephyrix")) {
                safeProviderId = "animeworld-india";
            } else if (safeServer.toLowerCase().contains("tatakai")) {
                safeProviderId = "tatakai-multi";
            }

            String jsonBody = "{"
                + "\"anilistId\":" + item.anilistId + ","
                + "\"animeTitle\":\"" + safeTitle + "\","
                + "\"englishTitle\":\"" + safeTitle + "\","
                + "\"episodeNumber\":" + item.episodeNumber + ","
                + "\"language\":\"" + lang + "\","
                + "\"serverName\":\"" + safeServer + "\","
                + "\"providerId\":\"" + safeProviderId + "\","
                + "\"format\":\"TV\""
                + "}";

            Log.i(TAG, "[ServerExtract] Calling Render /api/stream/resolve for: "
                + item.animeTitle + " EP" + item.episodeNumber + " [" + lang + "] on " + item.serverName + " (" + safeProviderId + ")");

            URL url = new URL(apiUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(25000); // Render cold-start can take up to 30s
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("User-Agent", "AniLove-Android/1.0");

            byte[] bodyBytes = jsonBody.getBytes("UTF-8");
            conn.setRequestProperty("Content-Length", String.valueOf(bodyBytes.length));
            java.io.OutputStream os = conn.getOutputStream();
            os.write(bodyBytes);
            os.close();

            int responseCode = conn.getResponseCode();
            Log.i(TAG, "[ServerExtract] Render response code: " + responseCode);

            if (responseCode == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();

                String json = sb.toString();
                // Check success field
                if (!json.contains("\"success\":true")) {
                    Log.w(TAG, "[ServerExtract] Render returned success:false");
                    return null;
                }

                // Try directStreamUrl first (actual .m3u8), then streamUrl (may be embed or m3u8)
                String streamUrl = extractJsonString(json, "directStreamUrl");
                if (streamUrl == null || streamUrl.isEmpty()) {
                    streamUrl = extractJsonString(json, "streamUrl");
                }
                String subtitleUrl = extractJsonString(json, "subtitleUrl");

                if (streamUrl != null && !streamUrl.isEmpty()) {
                    Log.i(TAG, "[ServerExtract] Got stream URL: "
                        + streamUrl.substring(0, Math.min(80, streamUrl.length())));
                    return new String[]{ streamUrl, subtitleUrl != null ? subtitleUrl : "" };
                }
                Log.w(TAG, "[ServerExtract] No streamUrl in response JSON");
            } else {
                // Read error body
                try {
                    BufferedReader errBr = new BufferedReader(new InputStreamReader(conn.getErrorStream(), "UTF-8"));
                    StringBuilder errSb = new StringBuilder();
                    String errLine;
                    while ((errLine = errBr.readLine()) != null) errSb.append(errLine);
                    errBr.close();
                    Log.w(TAG, "[ServerExtract] Error body: " + errSb.toString().substring(0, Math.min(200, errSb.length())));
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            Log.w(TAG, "[ServerExtract] Exception: " + e.getMessage());
        }
        return null;
    }

    /** Minimal JSON string field extractor (avoids needing org.json in this method) */
    private String extractJsonString(String json, String key) {
        try {
            String search = "\"" + key + "\":\"";
            int start = json.indexOf(search);
            if (start == -1) return null;
            start += search.length();
            int end = json.indexOf("\"", start);
            if (end == -1) return null;
            return json.substring(start, end).replace("\\/", "/");
        } catch (Exception e) {
            return null;
        }
    }

    private void downloadDirectVideo(DownloadItem item, File targetFile) throws Exception {
        long existingLength = targetFile.exists() ? targetFile.length() : 0;
        item.bytesDownloaded = existingLength;

        String referer = getRefererForUrl(item.streamUrl, item.pageUrl);
        HttpURLConnection conn = openConnectionWithHeaders(item.streamUrl, referer);

        if (existingLength > 0) {
            conn.setRequestProperty("Range", "bytes=" + existingLength + "-");
        }
        conn.connect();

        int responseCode = conn.getResponseCode();
        boolean isPartial = (responseCode == HttpURLConnection.HTTP_PARTIAL);

        long contentLength = conn.getContentLength();
        if (contentLength > 0) {
            item.totalBytes = isPartial ? (existingLength + contentLength) : contentLength;
        }

        InputStream in = conn.getInputStream();
        RandomAccessFile out = new RandomAccessFile(targetFile, "rw");
        if (isPartial) {
            out.seek(existingLength);
        } else {
            out.setLength(0);
            item.bytesDownloaded = 0;
        }

        byte[] buffer = new byte[64 * 1024]; // 64KB buffer
        int bytesRead;
        long lastProgressUpdate = System.currentTimeMillis();
        long bytesSinceLastUpdate = 0;

        while ((bytesRead = in.read(buffer)) != -1) {
            if (item.isPaused || item.isCancelled) {
                break;
            }
            out.write(buffer, 0, bytesRead);
            item.bytesDownloaded += bytesRead;
            bytesSinceLastUpdate += bytesRead;

            long now = System.currentTimeMillis();
            if (now - lastProgressUpdate > 600) {
                double seconds = (now - lastProgressUpdate) / 1000.0;
                double speedKBps = (bytesSinceLastUpdate / 1024.0) / Math.max(0.1, seconds);
                String speedStr = speedKBps > 1024 ? String.format("%.1f MB/s", speedKBps / 1024.0) : String.format("%.0f KB/s", speedKBps);
                item.speed = speedStr;

                if (item.totalBytes > 0) {
                    item.progress = (int) ((item.bytesDownloaded * 100) / item.totalBytes);
                }

                notifyProgress(item, speedStr);
                lastProgressUpdate = now;
                bytesSinceLastUpdate = 0;
            }
        }

        out.close();
        in.close();
        conn.disconnect();
    }

    private String resolveHlsUrl(String currentUrl, String line) {
        try {
            return new URL(new URL(currentUrl), line).toString();
        } catch (Exception e) {
            return line;
        }
    }

    private void downloadHlsStream(DownloadItem item, File downloadDir, File targetFile) throws Exception {
        String referer = getRefererForUrl(item.streamUrl, item.pageUrl);
        String currentPlaylistUrl = item.streamUrl;

        // Fetch Master / Media playlist
        HttpURLConnection conn = openConnectionWithHeaders(currentPlaylistUrl, referer);
        conn.connect();

        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        List<String> segmentUrls = new ArrayList<>();
        List<String> variantStreams = new ArrayList<>();
        String line;
        boolean isMasterPlaylist = false;

        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (line.contains("#EXT-X-STREAM-INF")) {
                isMasterPlaylist = true;
            } else if (isMasterPlaylist && !line.startsWith("#") && !line.isEmpty()) {
                variantStreams.add(resolveHlsUrl(currentPlaylistUrl, line));
            } else if (!isMasterPlaylist && !line.startsWith("#") && !line.isEmpty()) {
                segmentUrls.add(resolveHlsUrl(currentPlaylistUrl, line));
            }
        }
        reader.close();
        conn.disconnect();

        // If it was a master playlist, follow the highest quality sub-playlist (last entry or 1080p)
        if (isMasterPlaylist && !variantStreams.isEmpty()) {
            String highestQualitySubPlaylist = variantStreams.get(variantStreams.size() - 1);
            Log.i(TAG, "Resolving master playlist to highest quality stream: " + highestQualitySubPlaylist);
            currentPlaylistUrl = highestQualitySubPlaylist;

            conn = openConnectionWithHeaders(currentPlaylistUrl, referer);
            conn.connect();
            reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            segmentUrls.clear();

            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (!line.startsWith("#") && !line.isEmpty()) {
                    segmentUrls.add(resolveHlsUrl(currentPlaylistUrl, line));
                }
            }
            reader.close();
            conn.disconnect();
        }

        if (segmentUrls.isEmpty()) {
            throw new Exception("No downloadable video segments found in playlist");
        }

        int totalSegments = segmentUrls.size();
        File partsDir = new File(downloadDir, "segments_ep_" + item.episodeNumber);
        if (!partsDir.exists()) partsDir.mkdirs();

        FileOutputStream mergedOut = new FileOutputStream(targetFile, targetFile.exists());
        long lastSpeedTime = System.currentTimeMillis();
        long chunkBytesDownloaded = 0;

        for (int i = 0; i < totalSegments; i++) {
            if (item.isPaused || item.isCancelled) {
                break;
            }

            File segFile = new File(partsDir, "seg_" + i + ".ts");
            if (!segFile.exists() || segFile.length() == 0) {
                downloadFileDirect(segmentUrls.get(i), segFile, referer);
            }

            // Append chunk to destination video
            FileInputStream segIn = new FileInputStream(segFile);
            byte[] buf = new byte[32 * 1024];
            int r;
            while ((r = segIn.read(buf)) != -1) {
                mergedOut.write(buf, 0, r);
                item.bytesDownloaded += r;
                chunkBytesDownloaded += r;
            }
            segIn.close();

            long now = System.currentTimeMillis();
            if (now - lastSpeedTime > 800) {
                double seconds = (now - lastSpeedTime) / 1000.0;
                double speedKBps = (chunkBytesDownloaded / 1024.0) / Math.max(0.1, seconds);
                String speedStr = speedKBps > 1024 ? String.format("%.1f MB/s", speedKBps / 1024.0) : String.format("%.0f KB/s", speedKBps);
                item.speed = speedStr;

                item.progress = (int) (((i + 1) * 100.0) / totalSegments);
                notifyProgress(item, speedStr);
                lastSpeedTime = now;
                chunkBytesDownloaded = 0;
            } else {
                item.progress = (int) (((i + 1) * 100.0) / totalSegments);
            }
        }

        mergedOut.close();

        // Clean up temporary ts parts once merged
        if (!item.isPaused && !item.isCancelled) {
            deleteRecursive(partsDir);
        }
    }

    private String getRefererForUrl(String streamUrl, String pageUrl) {
        if (streamUrl != null && (streamUrl.contains("zephyrix") || streamUrl.contains("zn-grid"))) {
            return "https://play.zephyrix.org/";
        }
        String ref = (pageUrl != null && !pageUrl.isEmpty()) ? pageUrl : streamUrl;
        try {
            URL u = new URL(ref);
            return u.getProtocol() + "://" + u.getHost() + "/";
        } catch (Exception e) {
            return "https://google.com/";
        }
    }

    private HttpURLConnection openConnectionWithHeaders(String urlStr, String referer) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        conn.setRequestProperty("Accept", "*/*");
        if (urlStr.contains("zephyrix") || urlStr.contains("zn-grid")) {
            conn.setRequestProperty("Referer", "https://play.zephyrix.org/");
            conn.setRequestProperty("Origin", "https://play.zephyrix.org");
        } else if (referer != null && !referer.isEmpty()) {
            conn.setRequestProperty("Referer", referer);
            conn.setRequestProperty("Origin", referer);
        }
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        return conn;
    }

    private void downloadFileDirect(String urlStr, File destFile, String referer) throws Exception {
        HttpURLConnection c = openConnectionWithHeaders(urlStr, referer);
        c.connect();
        InputStream is = c.getInputStream();
        FileOutputStream fos = new FileOutputStream(destFile);
        byte[] buffer = new byte[32 * 1024];
        int len;
        while ((len = is.read(buffer)) != -1) {
            fos.write(buffer, 0, len);
        }
        fos.close();
        is.close();
        c.disconnect();
    }

    private void notifyProgress(DownloadItem item, String speed) {
        if (progressListener != null) {
            progressListener.onProgress(item.id, item.progress, item.bytesDownloaded, item.totalBytes, speed);
        }
        updateForegroundNotification();
    }

    private void notifyStatus(DownloadItem item, String status, String error) {
        if (progressListener != null) {
            progressListener.onStatusChange(item.id, status, error);
        }
        saveDownloadMetadata(item);
    }

    private Notification buildNotification(String title, String content, int progress, boolean ongoing) {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingOpen = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setContentTitle(title)
                .setContentText(content)
                .setContentIntent(pendingOpen)
                .setOngoing(ongoing)
                .setOnlyAlertOnce(true);

        if (progress >= 0) {
            builder.setProgress(100, progress, progress == 0 && ongoing);
        }

        return builder.build();
    }

    private void showErrorNotification(DownloadItem item) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                int errorNotifId = NOTIFICATION_ID + 1000 + Math.abs((item.id != null ? item.id.hashCode() : item.episodeNumber) % 5000);
                String title = item.animeTitle + " EP " + item.episodeNumber + " - Download Failed";
                String msg = (item.error != null && !item.error.isEmpty())
                        ? item.error
                        : "Download failed. Tap to retry or choose another server.";
                Notification n = buildNotification(title, msg, -1, false);
                nm.notify(errorNotifId, n);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to post error notification", e);
        }
    }

    private synchronized void updateForegroundNotification() {
        DownloadItem activeItem = null;
        int activeCount = 0;

        for (DownloadItem item : allDownloads.values()) {
            if ("DOWNLOADING".equals(item.status)) {
                activeCount++;
                if (activeItem == null) activeItem = item;
            }
        }

        if (activeItem == null) {
            for (DownloadItem item : allDownloads.values()) {
                if ("QUEUED".equals(item.status)) {
                    activeItem = item;
                    break;
                }
            }
        }

        if (activeItem == null) {
            stopForeground(false);
            return;
        }

        String title = activeItem.animeTitle + " - EP " + activeItem.episodeNumber + " (" + activeItem.audio + ")";
        String statusText = "QUEUED".equals(activeItem.status)
                ? "Waiting in queue..."
                : "Downloading (" + activeItem.progress + "%)" + (activeItem.speed != null ? " • " + activeItem.speed : "");
        if (activeCount > 1) {
            statusText += " (+" + (activeCount - 1) + " more)";
        }

        Notification notification = buildNotification(title, statusText, activeItem.progress, true);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "startForeground error in updateForegroundNotification", e);
        }
    }

    private File getDownloadDirectory(String animeTitle, int anilistId) {
        String safeName = animeTitle.replaceAll("[^a-zA-Z0-9_-]", "_").toLowerCase();
        File baseDir = getExternalFilesDir("downloads");
        return new File(baseDir, safeName + "_" + anilistId);
    }

    private void saveDownloadMetadata(DownloadItem item) {
        try {
            File dir = getDownloadDirectory(item.animeTitle, item.anilistId);
            if (!dir.exists()) dir.mkdirs();
            File metaFile = new File(dir, "meta_" + item.episodeNumber + ".json");

            JSONObject obj = new JSONObject();
            obj.put("id", item.id);
            obj.put("anilistId", item.anilistId);
            obj.put("animeTitle", item.animeTitle);
            obj.put("episodeNumber", item.episodeNumber);
            obj.put("audio", item.audio);
            obj.put("quality", item.quality);
            obj.put("serverName", item.serverName);
            obj.put("status", item.status);
            obj.put("progress", item.progress);
            obj.put("bytesDownloaded", item.bytesDownloaded);
            obj.put("totalBytes", item.totalBytes);
            obj.put("localFilePath", item.localFilePath != null ? item.localFilePath : "");
            obj.put("localSubPath", item.localSubPath != null ? item.localSubPath : "");
            obj.put("thumbnail", item.thumbnail);
            obj.put("completedAt", System.currentTimeMillis());

            FileOutputStream fos = new FileOutputStream(metaFile);
            fos.write(obj.toString(2).getBytes());
            fos.close();
        } catch (Exception e) {
            Log.e(TAG, "Error saving meta", e);
        }
    }

    private void loadSavedDownloadsFromDisk() {
        try {
            File baseDir = getExternalFilesDir("downloads");
            if (baseDir != null && baseDir.exists()) {
                scanDirForMeta(baseDir);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error loading saved downloads", e);
        }
    }

    private void scanDirForMeta(File dir) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (f.isDirectory()) {
                scanDirForMeta(f);
            } else if (f.getName().startsWith("meta_") && f.getName().endsWith(".json")) {
                try {
                    FileInputStream fis = new FileInputStream(f);
                    byte[] data = new byte[(int) f.length()];
                    fis.read(data);
                    fis.close();
                    JSONObject obj = new JSONObject(new String(data, "UTF-8"));
                    DownloadItem item = parseDownloadItem(obj);
                    item.status = obj.optString("status", "COMPLETED");
                    item.progress = obj.optInt("progress", 100);
                    item.bytesDownloaded = obj.optLong("bytesDownloaded", 0);
                    item.totalBytes = obj.optLong("totalBytes", 0);
                    item.localFilePath = obj.optString("localFilePath", "");
                    item.localSubPath = obj.optString("localSubPath", "");
                    if (item.localFilePath != null && new File(item.localFilePath).exists()) {
                        allDownloads.put(item.id, item);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Failed reading meta file: " + f.getAbsolutePath(), e);
                }
            }
        }
    }

    private void deleteLocalFiles(DownloadItem item) {
        try {
            File dir = getDownloadDirectory(item.animeTitle, item.anilistId);
            File metaFile = new File(dir, "meta_" + item.episodeNumber + ".json");
            if (metaFile.exists()) metaFile.delete();

            if (item.localFilePath != null && !item.localFilePath.isEmpty()) {
                File v = new File(item.localFilePath);
                if (v.exists()) v.delete();
            }

            if (item.localSubPath != null && !item.localSubPath.isEmpty()) {
                File s = new File(item.localSubPath);
                if (s.exists()) s.delete();
            }

            File parts = new File(dir, "segments_ep_" + item.episodeNumber);
            if (parts.exists()) deleteRecursive(parts);
        } catch (Exception e) {
            Log.e(TAG, "Error deleting local files", e);
        }
    }

    private void deleteRecursive(File fileOrDir) {
        if (fileOrDir.isDirectory()) {
            File[] list = fileOrDir.listFiles();
            if (list != null) {
                for (File f : list) deleteRecursive(f);
            }
        }
        fileOrDir.delete();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        threadPool.shutdownNow();
    }
}