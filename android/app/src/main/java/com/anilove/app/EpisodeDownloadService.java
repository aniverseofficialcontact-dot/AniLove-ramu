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
import android.util.Base64;
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
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

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
        void onStatusChange(DownloadItem item, String status, String error);
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
        public boolean isOngoing;
        public volatile boolean isPaused = false;
        public volatile boolean isCancelled = false;
        public Future<?> taskFuture;
    }

    private static final Map<String, DownloadItem> allDownloads = new ConcurrentHashMap<>();
    private static final Semaphore snifferSemaphore = new Semaphore(1, true);
    private final ExecutorService threadPool = Executors.newFixedThreadPool(2); // 2 simultaneous downloads
    private NotificationManager notificationManager;

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        Log.i(TAG, "onTaskRemoved: App removed from recent tasks - cleaning up player instances");
        try {
            if (NativePlayerActivity.currentInstance != null) {
                NativePlayerActivity.currentInstance.finish();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        loadSavedDownloadsFromDisk();

        // Android 14 requirement: Immediately start foreground in onCreate()
        Notification initialNotification = buildNotification("AniLove Downloader", "Background download service active", -1, false, null);
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

    private static DownloadItem parseDownloadItem(JSONObject obj) {
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
            // Check if streamUrl is an embed link already unpacked for the target audio language
            boolean isAlreadyUnpackedEmbed = item.streamUrl.contains("abyssplayer.com") ||
                                              item.streamUrl.contains("iqsmart") ||
                                              item.streamUrl.contains("rubystm") ||
                                              item.streamUrl.contains("vidsrc") ||
                                              item.streamUrl.contains("vidlink") ||
                                              item.streamUrl.contains("autoembed");

            if (!isAlreadyUnpackedEmbed) {
                Log.i(TAG, "Resolving stream via backend for: " + item.animeTitle + " EP" + item.episodeNumber + " [" + item.audio + "]");
                String[] serverResult = tryServerSideExtractFull(item);

                if (serverResult != null && serverResult[0] != null && !serverResult[0].isEmpty()) {
                    String resolvedUrl = serverResult[0];
                    Log.i(TAG, "Backend returned URL: " + resolvedUrl);
                    item.pageUrl = item.streamUrl;
                    item.streamUrl = resolvedUrl;
                    if (serverResult[1] != null && !serverResult[1].isEmpty()
                            && (item.subtitleUrl == null || item.subtitleUrl.isEmpty())) {
                        item.subtitleUrl = serverResult[1];
                    }
                }
            }

            boolean isDirect = item.streamUrl.contains(".m3u8") || item.streamUrl.contains(".mp4")
                    || item.streamUrl.contains(".m4s") || item.streamUrl.contains(".m3u")
                    || item.streamUrl.contains(".txt");
            if (isDirect) {
                item.isHls = item.streamUrl.contains(".m3u8") || item.streamUrl.contains(".m3u") || item.streamUrl.contains(".txt");
                Log.i(TAG, "Direct stream URL — skipping VideoSniffer");
            } else {
                // Embed URL — run VideoSniffer on device to capture .m3u8 / .mp4 for the exact audio language
                Log.i(TAG, "Running on-device VideoSniffer for embed URL [" + item.audio + "]: " + item.streamUrl);
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

        boolean acquired = false;
        try {
            acquired = snifferSemaphore.tryAcquire(30, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            throw new Exception("Sniffer queue interrupted for " + item.id);
        }

        if (!acquired) {
            throw new Exception("Sniffer busy. Skipping " + item.id);
        }

        try {
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
        } finally {
            snifferSemaphore.release();
        }
    }

    private String unpackServerUrlInJava(String rawUrl, String audio) {
        if (rawUrl == null || rawUrl.isEmpty()) return rawUrl;
        if (rawUrl.contains("short.icu/")) {
            return rawUrl.replace("short.icu/", "abyssplayer.com/");
        }
        if (rawUrl.contains("/public/player/") && rawUrl.contains("id=")) {
            try {
                int idIdx = rawUrl.indexOf("id=");
                if (idIdx != -1) {
                    String id = rawUrl.substring(idIdx + 3);
                    int ampIdx = id.indexOf("&");
                    if (ampIdx != -1) id = id.substring(0, ampIdx);
                    return "https://pro.iqsmartgames.com/embed/" + id;
                }
            } catch (Exception ignored) {}
        }
        if (rawUrl.contains("multi.php?data=") || rawUrl.contains("data=")) {
            try {
                int dataIdx = rawUrl.indexOf("data=");
                if (dataIdx != -1) {
                    String dataStr = rawUrl.substring(dataIdx + 5);
                    int ampIdx = dataStr.indexOf("&");
                    if (ampIdx != -1) dataStr = dataStr.substring(0, ampIdx);
                    dataStr = URLDecoder.decode(dataStr, "UTF-8");
                    byte[] decodedBytes = Base64.decode(dataStr, Base64.DEFAULT);
                    String jsonStr = new String(decodedBytes, "UTF-8");
                    JSONArray arr = new JSONArray(jsonStr);
                    if (arr.length() > 0) {
                        String reqAud = audio != null ? audio.toLowerCase() : "dub";
                        JSONObject target = arr.optJSONObject(0);
                        for (int i = 0; i < arr.length(); i++) {
                            JSONObject obj = arr.optJSONObject(i);
                            if (obj != null) {
                                String lang = obj.optString("language", "").toLowerCase();
                                if (reqAud.contains("hin") && lang.contains("hin")) { target = obj; break; }
                                else if (reqAud.contains("tam") && lang.contains("tam")) { target = obj; break; }
                                else if (reqAud.contains("tel") && lang.contains("tel")) { target = obj; break; }
                                else if (reqAud.contains("sub") && (lang.contains("jap") || lang.contains("sub"))) { target = obj; break; }
                                else if (reqAud.contains("dub") && (lang.contains("eng") || lang.contains("dub"))) { target = obj; break; }
                            }
                        }
                        if (target != null && target.has("link")) {
                            String link = target.optString("link", "");
                            if (link.contains("short.icu/")) {
                                return link.replace("short.icu/", "abyssplayer.com/");
                            }
                            return link;
                        }
                    }
                }
            } catch (Exception ignored) {}
        }
        return rawUrl;
    }

    /**
     * Calls the AnimeWorld India v1 PHP Stream API's /stream.php endpoint
     * to get direct stream links/embeds for downloading.
     */
    private String[] tryServerSideExtractFull(DownloadItem item) {
        try {
            StringBuilder urlBuilder = new StringBuilder("https://animeworld-india-api-njtl.onrender.com/api/anime-world-india/v1/stream.php?");
            if (item.anilistId > 0) {
                urlBuilder.append("anilistId=").append(item.anilistId).append("&ep=").append(item.episodeNumber);
            } else {
                String safeSlug = item.animeTitle != null
                    ? item.animeTitle.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "")
                    : "anime";
                String episodeSlug = safeSlug + "-season-1-1x" + item.episodeNumber;
                urlBuilder.append("id=").append(URLEncoder.encode(episodeSlug, "UTF-8"));
            }

            if (item.isOngoing) {
                urlBuilder.append("&ongoing=true");
            }

            Log.i(TAG, "[ServerExtract] Querying AnimeWorld v1 API: " + urlBuilder.toString());

            URL url = new URL(urlBuilder.toString());
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(35000);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36");

            int responseCode = conn.getResponseCode();
            Log.i(TAG, "[ServerExtract] AnimeWorld response code: " + responseCode);

            if (responseCode == 200) {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                br.close();

                JSONObject resObj = new JSONObject(sb.toString());
                if (resObj.optBoolean("success", false)) {
                    JSONObject streamObj = resObj.optJSONObject("stream");
                    if (streamObj != null) {
                        JSONArray serversArr = streamObj.optJSONArray("servers");
                        String rawUrl = null;

                        if (serversArr != null && serversArr.length() > 0) {
                            String reqServer = item.serverName != null ? item.serverName.toLowerCase() : "server 1";
                            for (int i = 0; i < serversArr.length(); i++) {
                                JSONObject s = serversArr.optJSONObject(i);
                                if (s != null) {
                                    String sName = s.optString("name", "");
                                    if (sName.toLowerCase().equals(reqServer)) {
                                        rawUrl = s.optString("url", "");
                                        break;
                                    }
                                }
                            }
                            if (rawUrl == null || rawUrl.isEmpty()) {
                                JSONObject s0 = serversArr.optJSONObject(0);
                                if (s0 != null) rawUrl = s0.optString("url", "");
                            }
                        }

                        if (rawUrl == null || rawUrl.isEmpty()) {
                            rawUrl = streamObj.optString("streamLink", streamObj.optString("file", ""));
                        }

                        if (rawUrl != null && !rawUrl.isEmpty()) {
                            String unpacked = unpackServerUrlInJava(rawUrl, item.audio);
                            Log.i(TAG, "[ServerExtract] Selected raw server URL: " + rawUrl + " -> unpacked: " + unpacked);
                            return new String[]{unpacked, ""};
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "[ServerExtract] Exception: " + e.getMessage());
        }
        return null;
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

    private String getRefererForUrl(String streamUrl, String pageUrl) {
        if (streamUrl != null) {
            String lower = streamUrl.toLowerCase();
            if (lower.contains("justanime.to")) {
                return "https://justanime.to/";
            }
            if (lower.contains("vidlink.pro")) {
                return "https://vidlink.pro/";
            }
            if (lower.contains("autoembed.co")) {
                return "https://autoembed.co/";
            }
            if (lower.contains("smashystream.com")) {
                return "https://player.smashystream.com/";
            }
        }
        String ref = (pageUrl != null && !pageUrl.isEmpty()) ? pageUrl : streamUrl;
        try {
            URL u = new URL(ref);
            return u.getProtocol() + "://" + u.getHost() + "/";
        } catch (Exception e) {
            return "https://vidlink.pro/";
        }
    }

    private HttpURLConnection openConnectionWithHeaders(String urlStr, String referer) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
        conn.setRequestProperty("Accept", "*/*");
        conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");

        String effectiveReferer = referer;
        if (effectiveReferer == null || effectiveReferer.isEmpty() || "https://google.com/".equals(effectiveReferer)) {
            effectiveReferer = getRefererForUrl(urlStr, null);
        }

        conn.setRequestProperty("Referer", effectiveReferer);
        try {
            URL u = new URL(effectiveReferer);
            conn.setRequestProperty("Origin", u.getProtocol() + "://" + u.getHost());
        } catch (Exception ignored) {}

        conn.setConnectTimeout(15000);
        conn.setReadTimeout(25000);
        return conn;
    }

    private HttpURLConnection openHlsConnectionWithRedirects(String urlStr, String referer) throws Exception {
        String currentUrl = urlStr;
        HttpURLConnection conn = null;
        for (int hop = 0; hop < 5; hop++) {
            conn = openConnectionWithHeaders(currentUrl, referer);
            conn.connect();
            int code = conn.getResponseCode();
            if (code == HttpURLConnection.HTTP_MOVED_PERM || code == HttpURLConnection.HTTP_MOVED_TEMP || code == 307 || code == 308) {
                String loc = conn.getHeaderField("Location");
                conn.disconnect();
                if (loc != null && !loc.isEmpty()) {
                    currentUrl = resolveHlsUrl(currentUrl, loc);
                    continue;
                }
            }
            break;
        }
        return conn;
    }

    private static class HlsVariant {
        String url;
        int bandwidth;
        String resolution;
        int height;
    }

    private void downloadHlsStream(DownloadItem item, File downloadDir, File targetFile) throws Exception {
        String referer = getRefererForUrl(item.streamUrl, item.pageUrl);
        String currentPlaylistUrl = item.streamUrl;

        // Fetch Master / Media playlist with redirect resolution
        HttpURLConnection conn = openHlsConnectionWithRedirects(currentPlaylistUrl, referer);

        int resCode = conn.getResponseCode();
        if (resCode != 200) {
            throw new Exception("HTTP " + resCode + " when connecting to stream playlist: " + currentPlaylistUrl);
        }

        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        List<String> segmentUrls = new ArrayList<>();
        List<HlsVariant> variantObjects = new ArrayList<>();
        HlsVariant pendingVariant = null;
        String initMapUrl = null;
        String line;
        boolean isMasterPlaylist = false;

        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (line.contains("#EXT-X-MEDIA:TYPE=SUBTITLES") && (item.subtitleUrl == null || item.subtitleUrl.isEmpty())) {
                int uriIdx = line.indexOf("URI=\"");
                if (uriIdx != -1) {
                    int endIdx = line.indexOf("\"", uriIdx + 5);
                    if (endIdx != -1) {
                        item.subtitleUrl = resolveHlsUrl(currentPlaylistUrl, line.substring(uriIdx + 5, endIdx));
                        Log.i(TAG, "Extracted subtitle URL from HLS master playlist: " + item.subtitleUrl);
                    }
                }
            } else if (line.contains("#EXT-X-STREAM-INF")) {
                isMasterPlaylist = true;
                pendingVariant = new HlsVariant();
                int bwIdx = line.indexOf("BANDWIDTH=");
                if (bwIdx != -1) {
                    try {
                        String bwStr = line.substring(bwIdx + 10).split("[,\\s]")[0];
                        pendingVariant.bandwidth = Integer.parseInt(bwStr);
                    } catch (Exception ignored) {}
                }
                int resIdx = line.indexOf("RESOLUTION=");
                if (resIdx != -1) {
                    try {
                        String resStr = line.substring(resIdx + 11).split("[,\\s]")[0];
                        pendingVariant.resolution = resStr;
                        if (resStr.contains("x")) {
                            pendingVariant.height = Integer.parseInt(resStr.split("x")[1]);
                        }
                    } catch (Exception ignored) {}
                }
            } else if (isMasterPlaylist && !line.startsWith("#") && !line.isEmpty()) {
                if (pendingVariant != null) {
                    pendingVariant.url = resolveHlsUrl(currentPlaylistUrl, line);
                    variantObjects.add(pendingVariant);
                    pendingVariant = null;
                } else {
                    HlsVariant v = new HlsVariant();
                    v.url = resolveHlsUrl(currentPlaylistUrl, line);
                    variantObjects.add(v);
                }
            } else if (!isMasterPlaylist) {
                if (line.contains("#EXT-X-MAP:")) {
                    int uriIdx = line.indexOf("URI=\"");
                    if (uriIdx != -1) {
                        int endIdx = line.indexOf("\"", uriIdx + 5);
                        if (endIdx != -1) {
                            initMapUrl = resolveHlsUrl(currentPlaylistUrl, line.substring(uriIdx + 5, endIdx));
                        }
                    }
                } else if (!line.startsWith("#") && !line.isEmpty()) {
                    segmentUrls.add(resolveHlsUrl(currentPlaylistUrl, line));
                }
            }
        }
        reader.close();
        conn.disconnect();

        // If it was a master playlist, select variant matching requested quality or highest available
        if (isMasterPlaylist && !variantObjects.isEmpty()) {
            Collections.sort(variantObjects, (a, b) -> {
                if (a.height != b.height) return Integer.compare(a.height, b.height);
                return Integer.compare(a.bandwidth, b.bandwidth);
            });

            HlsVariant selectedVariant = null;
            String reqQuality = item.quality != null ? item.quality.toLowerCase() : "1080p";

            if (reqQuality.contains("720")) {
                for (HlsVariant v : variantObjects) {
                    if (v.height == 720 || (v.resolution != null && v.resolution.contains("720"))) {
                        selectedVariant = v;
                        break;
                    }
                }
            } else if (reqQuality.contains("480") || reqQuality.contains("360")) {
                for (HlsVariant v : variantObjects) {
                    if (v.height == 480 || v.height == 360 || (v.resolution != null && (v.resolution.contains("480") || v.resolution.contains("360")))) {
                        selectedVariant = v;
                        break;
                    }
                }
            } else if (reqQuality.contains("1080")) {
                for (HlsVariant v : variantObjects) {
                    if (v.height == 1080 || (v.resolution != null && v.resolution.contains("1080"))) {
                        selectedVariant = v;
                        break;
                    }
                }
            }

            if (selectedVariant == null) {
                selectedVariant = variantObjects.get(variantObjects.size() - 1);
            }

            Log.i(TAG, "Selected HLS variant for quality [" + reqQuality + "]: " + selectedVariant.url + " (res: " + selectedVariant.resolution + ")");

            conn = openHlsConnectionWithRedirects(selectedVariant.url, referer);
            if (conn.getResponseCode() == 200) {
                currentPlaylistUrl = selectedVariant.url;
                reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                segmentUrls.clear();
                initMapUrl = null;

                while ((line = reader.readLine()) != null) {
                    line = line.trim();
                    if (line.contains("#EXT-X-MAP:")) {
                        int uriIdx = line.indexOf("URI=\"");
                        if (uriIdx != -1) {
                            int endIdx = line.indexOf("\"", uriIdx + 5);
                            if (endIdx != -1) {
                                initMapUrl = resolveHlsUrl(currentPlaylistUrl, line.substring(uriIdx + 5, endIdx));
                            }
                        }
                    } else if (!line.startsWith("#") && !line.isEmpty()) {
                        segmentUrls.add(resolveHlsUrl(currentPlaylistUrl, line));
                    }
                }
                reader.close();
                conn.disconnect();
            }
        }

        if (segmentUrls.isEmpty()) {
            throw new Exception("No downloadable video segments found in playlist");
        }

        int totalSegments = segmentUrls.size();
        File partsDir = new File(downloadDir, "segments_ep_" + item.episodeNumber);
        if (!partsDir.exists()) partsDir.mkdirs();

        // If starting fresh (progress == 0), clear any previous broken partial file
        if (targetFile.exists() && item.progress == 0) {
            targetFile.delete();
        }

        FileOutputStream mergedOut = new FileOutputStream(targetFile, item.progress > 0);

        // If initialization segment (fMP4 CMAF init.mp4) exists, write it first
        if (initMapUrl != null && !initMapUrl.isEmpty()) {
            File initFile = new File(partsDir, "init.mp4");
            if (!initFile.exists() || initFile.length() == 0) {
                downloadFileDirect(initMapUrl, initFile, referer);
            }
            if (initFile.exists() && initFile.length() > 0 && targetFile.length() == 0) {
                FileInputStream initIn = new FileInputStream(initFile);
                byte[] buf = new byte[32 * 1024];
                int r;
                while ((r = initIn.read(buf)) != -1) {
                    mergedOut.write(buf, 0, r);
                    item.bytesDownloaded += r;
                }
                initIn.close();
            }
        }

        // Multi-threaded 10-worker parallel segment downloader for 5G full speed
        int workerCount = Math.min(10, Math.max(4, Runtime.getRuntime().availableProcessors() * 2));
        ExecutorService segmentPool = Executors.newFixedThreadPool(workerCount);

        AtomicInteger completedCount = new AtomicInteger(0);
        AtomicLong bytesCounter = new AtomicLong(item.bytesDownloaded);
        AtomicLong deltaBytesCounter = new AtomicLong(0);

        long lastSpeedTime = System.currentTimeMillis();

        for (int i = 0; i < totalSegments; i++) {
            final int index = i;
            final String segUrl = segmentUrls.get(i);
            final File segFile = new File(partsDir, "seg_" + index + ".ts");

            segmentPool.submit(() -> {
                if (item.isPaused || item.isCancelled) return;
                try {
                    if (!segFile.exists() || segFile.length() == 0) {
                        downloadFileDirect(segUrl, segFile, referer);
                    }
                    long len = segFile.length();
                    bytesCounter.addAndGet(len);
                    deltaBytesCounter.addAndGet(len);
                    completedCount.incrementAndGet();
                } catch (Exception e) {
                    Log.w(TAG, "Segment " + index + " download error: " + e.getMessage());
                }
            });
        }

        segmentPool.shutdown();

        while (!segmentPool.isTerminated()) {
            if (item.isPaused || item.isCancelled) {
                segmentPool.shutdownNow();
                break;
            }
            try {
                Thread.sleep(600);
            } catch (InterruptedException ignored) {}

            long now = System.currentTimeMillis();
            long delta = deltaBytesCounter.getAndSet(0);
            double seconds = (now - lastSpeedTime) / 1000.0;
            if (seconds > 0.4) {
                double speedKBps = (delta / 1024.0) / seconds;
                String speedStr = speedKBps > 1024 
                        ? String.format(Locale.US, "%.1f MB/s", speedKBps / 1024.0) 
                        : String.format(Locale.US, "%.0f KB/s", speedKBps);
                item.speed = speedStr;
                item.bytesDownloaded = bytesCounter.get();
                item.progress = Math.min(95, (int) (((double) completedCount.get() / totalSegments) * 95.0));
                notifyProgress(item, speedStr);
                lastSpeedTime = now;
            }
        }

        if (item.isPaused || item.isCancelled) {
            mergedOut.close();
            return;
        }

        // Merge all segments sequentially into final MP4 file
        notifyProgress(item, "Merging episode...");
        for (int i = 0; i < totalSegments; i++) {
            File segFile = new File(partsDir, "seg_" + i + ".ts");
            if (segFile.exists() && segFile.length() > 0) {
                FileInputStream segIn = new FileInputStream(segFile);
                byte[] buf = new byte[64 * 1024];
                int r;
                while ((r = segIn.read(buf)) != -1) {
                    mergedOut.write(buf, 0, r);
                }
                segIn.close();
            }
        }

        mergedOut.close();

        // Clean up temporary ts parts once merged
        if (!item.isPaused && !item.isCancelled) {
            deleteRecursive(partsDir);
        }
    }

    private void downloadFileDirect(String urlStr, File destFile, String referer) throws Exception {
        Exception lastErr = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            HttpURLConnection c = null;
            try {
                c = openConnectionWithHeaders(urlStr, referer);
                c.connect();
                int code = c.getResponseCode();
                if (code != 200 && code != 206) {
                    throw new Exception("HTTP " + code + " downloading segment: " + urlStr);
                }
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
                return; // Success!
            } catch (Exception e) {
                lastErr = e;
                if (c != null) try { c.disconnect(); } catch (Exception ignored) {}
                if (attempt < 3) {
                    try { Thread.sleep(800L * attempt); } catch (InterruptedException ignored) {}
                }
            }
        }
        throw lastErr != null ? lastErr : new Exception("Failed to download " + urlStr);
    }

    private void notifyProgress(DownloadItem item, String speed) {
        if (progressListener != null) {
            progressListener.onProgress(item.id, item.progress, item.bytesDownloaded, item.totalBytes, speed);
        }
        updateForegroundNotification();
    }

    private void notifyStatus(DownloadItem item, String status, String error) {
        if (progressListener != null) {
            progressListener.onStatusChange(item, status, error);
        }
        saveDownloadMetadata(item);
    }

    private Notification buildNotification(String title, String content, int progress, boolean ongoing, DownloadItem activeItem) {
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

        if (activeItem != null && activeItem.id != null) {
            int notifReqCode = Math.abs(activeItem.id.hashCode() % 10000);
            if ("DOWNLOADING".equals(activeItem.status)) {
                Intent pauseIntent = new Intent(this, EpisodeDownloadService.class);
                pauseIntent.setAction(ACTION_PAUSE);
                pauseIntent.putExtra("downloadId", activeItem.id);
                PendingIntent pPause = PendingIntent.getService(this, notifReqCode + 1, pauseIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                builder.addAction(android.R.drawable.ic_media_pause, "Pause", pPause);
            } else if ("PAUSED".equals(activeItem.status)) {
                Intent resumeIntent = new Intent(this, EpisodeDownloadService.class);
                resumeIntent.setAction(ACTION_RESUME);
                resumeIntent.putExtra("downloadId", activeItem.id);
                PendingIntent pResume = PendingIntent.getService(this, notifReqCode + 2, resumeIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                builder.addAction(android.R.drawable.ic_media_play, "Resume", pResume);
            }

            Intent cancelIntent = new Intent(this, EpisodeDownloadService.class);
            cancelIntent.setAction(ACTION_CANCEL);
            cancelIntent.putExtra("downloadId", activeItem.id);
            PendingIntent pCancel = PendingIntent.getService(this, notifReqCode + 3, cancelIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Cancel", pCancel);
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
                Notification n = buildNotification(title, msg, -1, false, null);
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

        Notification notification = buildNotification(title, statusText, activeItem.progress, true, activeItem);
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

            if (item.localFilePath == null || item.localFilePath.isEmpty()) {
                File vFile = new File(dir, "ep_" + item.episodeNumber + ".mp4");
                if (vFile.exists()) {
                    item.localFilePath = vFile.getAbsolutePath();
                }
            }
            if (item.localSubPath == null || item.localSubPath.isEmpty()) {
                File sFile = new File(dir, "ep_" + item.episodeNumber + ".vtt");
                if (sFile.exists()) {
                    item.localSubPath = sFile.getAbsolutePath();
                }
            }

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

    public static void ensureDownloadsLoaded(Context context) {
        if (allDownloads.isEmpty() && context != null) {
            try {
                File baseDir = context.getExternalFilesDir("downloads");
                if (baseDir != null && baseDir.exists()) {
                    scanDirForMeta(baseDir);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error ensuring downloads loaded", e);
            }
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

    private static void scanDirForMeta(File dir) {
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

                    // Auto-recovery if localFilePath is empty or file moved
                    if (item.localFilePath == null || item.localFilePath.isEmpty() || !new File(item.localFilePath).exists()) {
                        File fallbackVideo = new File(dir, "ep_" + item.episodeNumber + ".mp4");
                        if (fallbackVideo.exists()) {
                            item.localFilePath = fallbackVideo.getAbsolutePath();
                        }
                    }
                    if (item.localSubPath == null || item.localSubPath.isEmpty() || !new File(item.localSubPath).exists()) {
                        File fallbackSub = new File(dir, "ep_" + item.episodeNumber + ".vtt");
                        if (fallbackSub.exists()) {
                            item.localSubPath = fallbackSub.getAbsolutePath();
                        }
                    }

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