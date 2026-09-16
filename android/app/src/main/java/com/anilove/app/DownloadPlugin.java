package com.anilove.app;

import android.content.Intent;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.File;
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
            public void onStatusChange(String downloadId, String status, String error) {
                JSObject data = new JSObject();
                data.put("downloadId", downloadId);
                data.put("status", status);
                data.put("error", error != null ? error : "");
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
                obj.put("localAudioPath", item.localAudioPath != null ? item.localAudioPath : "");
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
            String localAudioPath = call.getString("localAudioPath", "");
            String title = call.getString("title", "Offline Episode");
            int episodeNumber = call.getInt("episodeNumber", 1);

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
            intent.putExtra("localAudioPath", localAudioPath);
            intent.putExtra("animeTitle", title);
            intent.putExtra("episodeNumber", episodeNumber);
            intent.putExtra("startFullscreen", false);
            getContext().startActivity(intent);

            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error in playOffline", e);
            call.reject(e.getMessage());
        }
    }
}