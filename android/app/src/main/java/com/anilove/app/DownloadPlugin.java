package com.anilove.app;

import android.content.Intent;
import android.media.MediaScannerConnection;
import android.os.Build;
import android.os.Environment;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.channels.FileChannel;
import java.util.List;

@CapacitorPlugin(name = "DownloadPlugin")
public class DownloadPlugin extends Plugin {
    private static final String TAG = "DownloadPlugin";

    @Override
    public void load() {
        super.load();
        EpisodeDownloadService.progressListener = new EpisodeDownloadService.DownloadProgressListener() {
            @Override
            public void onProgress(String downloadId, int progressPercent, long bytesDownloaded, long totalBytes, String speed) {
                JSObject data = new JSObject();
                data.put("downloadId", downloadId);
                data.put("progress", progressPercent);
                data.put("bytesDownloaded", bytesDownloaded);
                data.put("totalBytes", totalBytes);
                data.put("speed", speed);
                notifyListeners("onDownloadProgress", data);
            }

            @Override
            public void onStatusChange(EpisodeDownloadService.DownloadItem item, String status, String error) {
                JSObject data = new JSObject();
                data.put("downloadId", item.id);
                data.put("status", status);
                data.put("error", error != null ? error : "");
                data.put("localFilePath", item.localFilePath != null ? item.localFilePath : "");
                data.put("localSubPath", item.localSubPath != null ? item.localSubPath : "");
                notifyListeners("onDownloadStatusChange", data);
            }
        };
    }

    @PluginMethod
    public void startDownload(PluginCall call) {
        try {
            JSObject item = call.getObject("item");
            if (item == null) {
                call.reject("Missing download item data");
                return;
            }

            Intent intent = new Intent(getContext(), EpisodeDownloadService.class);
            intent.setAction(EpisodeDownloadService.ACTION_START);
            intent.putExtra("itemJson", item.toString());

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }

            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error in startDownload", e);
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        String downloadId = call.getString("downloadId");
        if (downloadId == null) {
            call.reject("Missing downloadId");
            return;
        }
        Intent intent = new Intent(getContext(), EpisodeDownloadService.class);
        intent.setAction(EpisodeDownloadService.ACTION_PAUSE);
        intent.putExtra("downloadId", downloadId);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void resumeDownload(PluginCall call) {
        String downloadId = call.getString("downloadId");
        if (downloadId == null) {
            call.reject("Missing downloadId");
            return;
        }
        Intent intent = new Intent(getContext(), EpisodeDownloadService.class);
        intent.setAction(EpisodeDownloadService.ACTION_RESUME);
        intent.putExtra("downloadId", downloadId);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        String downloadId = call.getString("downloadId");
        if (downloadId == null) {
            call.reject("Missing downloadId");
            return;
        }
        Intent intent = new Intent(getContext(), EpisodeDownloadService.class);
        intent.setAction(EpisodeDownloadService.ACTION_CANCEL);
        intent.putExtra("downloadId", downloadId);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getDownloads(PluginCall call) {
        try {
            EpisodeDownloadService.ensureDownloadsLoaded(getContext());
            List<EpisodeDownloadService.DownloadItem> list = EpisodeDownloadService.getAllDownloads();
            JSArray arr = new JSArray();

            for (EpisodeDownloadService.DownloadItem item : list) {
                JSObject obj = new JSObject();
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
                arr.put(obj);
            }

            JSObject result = new JSObject();
            result.put("downloads", arr);
            call.resolve(result);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void playOffline(PluginCall call) {
        try {
            String localFilePath = call.getString("localFilePath");
            String localSubPath = call.getString("localSubPath", "");
            String title = call.getString("title", "Offline Episode");
            String animeTitle = call.getString("animeTitle", title);
            int episodeNumber = call.getInt("episodeNumber", 1);
            String audio = call.getString("audio", "DUB");
            String quality = call.getString("quality", "1080p");

            if (localFilePath == null || localFilePath.isEmpty()) {
                call.reject("localFilePath is required");
                return;
            }

            File file = new File(localFilePath);
            if (!file.exists()) {
                call.reject("File does not exist on device: " + localFilePath);
                return;
            }

            Intent intent = new Intent(getContext(), NativePlayerActivity.class);
            intent.putExtra("offlineMode", true);
            intent.putExtra("localFilePath", localFilePath);
            intent.putExtra("localSubPath", localSubPath);
            intent.putExtra("title", title);
            intent.putExtra("animeTitle", animeTitle);
            intent.putExtra("episodeNumber", episodeNumber);
            intent.putExtra("audio", audio);
            intent.putExtra("quality", quality);
            intent.putExtra("startFullscreen", false);
            getContext().startActivity(intent);

            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error in playOffline", e);
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void exportToPublicStorage(PluginCall call) {
        try {
            String localFilePath = call.getString("localFilePath");
            String animeTitle = call.getString("animeTitle", "Anime");
            int episodeNumber = call.getInt("episodeNumber", 1);

            if (localFilePath == null || localFilePath.isEmpty()) {
                call.reject("Missing localFilePath");
                return;
            }

            File srcFile = new File(localFilePath);
            if (!srcFile.exists()) {
                call.reject("File does not exist: " + localFilePath);
                return;
            }

            File publicDir = new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "AniLove"
            );
            if (!publicDir.exists()) {
                publicDir.mkdirs();
            }

            String safeTitle = animeTitle.replaceAll("[^a-zA-Z0-9\\s_-]", "").trim().replaceAll("\\s+", "_");
            String fileName = safeTitle + "_EP" + episodeNumber + ".mp4";
            File destFile = new File(publicDir, fileName);

            try (FileInputStream in = new FileInputStream(srcFile);
                 FileOutputStream out = new FileOutputStream(destFile);
                 FileChannel inChannel = in.getChannel();
                 FileChannel outChannel = out.getChannel()) {
                inChannel.transferTo(0, inChannel.size(), outChannel);
            }

            try {
                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[]{ destFile.getAbsolutePath() },
                    new String[]{ "video/mp4" },
                    null
                );
            } catch (Exception ignored) {}

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("exportPath", destFile.getAbsolutePath());
            res.put("fileName", fileName);
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "Error exporting file to public storage", e);
            call.reject("Export failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadImage(PluginCall call) {
        String imageUrl = call.getString("imageUrl");
        String fileName = call.getString("fileName");

        if (imageUrl == null || imageUrl.isEmpty()) {
            call.reject("Missing imageUrl");
            return;
        }

        if (fileName == null || fileName.isEmpty()) {
            String cleanUrl = imageUrl.split("\\?")[0];
            int lastDot = cleanUrl.lastIndexOf('.');
            String fileExt = (lastDot != -1) ? cleanUrl.substring(lastDot) : ".jpg";
            fileName = "AniLove_FanArt_" + System.currentTimeMillis() + fileExt;
        }

        final String finalFileName = fileName;
        final String finalImageUrl = imageUrl;

        new Thread(() -> {
            try {
                File picturesDir = new File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                    "AniLove"
                );
                if (!picturesDir.exists()) {
                    picturesDir.mkdirs();
                }

                File destFile = new File(picturesDir, finalFileName);

                URL url = new URL(finalImageUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(30000);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                if (finalImageUrl.contains("safebooru.org")) {
                    conn.setRequestProperty("Referer", "https://safebooru.org/");
                } else if (finalImageUrl.contains("gelbooru.com")) {
                    conn.setRequestProperty("Referer", "https://gelbooru.com/");
                } else if (finalImageUrl.contains("donmai.us")) {
                    conn.setRequestProperty("Referer", "https://danbooru.donmai.us/");
                } else if (finalImageUrl.contains("yande.re")) {
                    conn.setRequestProperty("Referer", "https://yande.re/");
                }

                int responseCode = conn.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    Log.e(TAG, "Image HTTP error response code: " + responseCode + " for " + finalImageUrl);
                    call.reject("HTTP error: " + responseCode);
                    return;
                }

                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(destFile)) {
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                    }
                }

                String lowerName = finalFileName.toLowerCase();
                String mimeType = "image/jpeg";
                if (lowerName.endsWith(".png")) mimeType = "image/png";
                else if (lowerName.endsWith(".webp")) mimeType = "image/webp";
                else if (lowerName.endsWith(".gif")) mimeType = "image/gif";

                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[]{ destFile.getAbsolutePath() },
                    new String[]{ mimeType },
                    null
                );

                Log.i(TAG, "Successfully downloaded FanArt image to: " + destFile.getAbsolutePath());

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("filePath", destFile.getAbsolutePath());
                call.resolve(res);

            } catch (Exception e) {
                Log.e(TAG, "Error downloading image: " + finalImageUrl, e);
                call.reject("Image download failed: " + e.getMessage());
            }
        }).start();
    }
}