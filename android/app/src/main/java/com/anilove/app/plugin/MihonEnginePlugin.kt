package com.anilove.app.plugin

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import eu.kanade.tachiyomi.extension.ExtensionManager
import eu.kanade.tachiyomi.extension.model.Extension
import eu.kanade.tachiyomi.source.SourceManager
import eu.kanade.tachiyomi.source.model.SChapter
import eu.kanade.tachiyomi.source.model.SManga
import eu.kanade.tachiyomi.source.online.HttpSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import logcat.LogPriority
import tachiyomi.core.common.util.system.logcat

@CapacitorPlugin(name = "MihonEngine")
class MihonEnginePlugin : Plugin() {

    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @PluginMethod
    fun getSources(call: PluginCall) {
        pluginScope.launch {
            try {
                val context = context ?: return@launch call.reject("Context is null")
                val extensionManager = bridge.activity.applicationContext as? eu.kanade.tachiyomi.App
                val sources = eu.kanade.tachiyomi.source.SourceManager(context, extensionManager?.sourcePreferences ?: return@launch call.reject("SourcePreferences unavailable"))

                val result = JSArray()
                for (source in sources.getOnlineSources()) {
                    val item = JSObject().apply {
                        put("id", source.id.toString())
                        put("name", source.name)
                        put("lang", source.lang)
                        put("supportsLatest", source.supportsLatest)
                        put("baseUrl", (source as? HttpSource)?.baseUrl ?: "")
                    }
                    result.put(item)
                }

                val ret = JSObject().apply {
                    put("sources", result)
                }
                call.resolve(ret)
            } catch (e: Exception) {
                logcat(LogPriority.ERROR, e) { "Error fetching sources in MihonEnginePlugin" }
                call.reject(e.message ?: "Failed to fetch sources")
            }
        }
    }

    @PluginMethod
    fun searchManga(call: PluginCall) {
        val sourceId = call.getString("sourceId")?.toLongOrNull()
            ?: return call.reject("sourceId is required")
        val query = call.getString("query") ?: ""
        val page = call.getInt("page") ?: 1

        pluginScope.launch {
            try {
                val source = getHttpSource(sourceId)
                    ?: return@launch call.reject("Source with ID $sourceId not found or not active")

                val mangaPage = if (query.isBlank()) {
                    source.getPopularManga(page)
                } else {
                    source.getSearchManga(page, query, source.getFilterList())
                }

                val mangaList = JSArray()
                for (manga in mangaPage.mangas) {
                    val item = JSObject().apply {
                        put("url", manga.url)
                        put("title", manga.title)
                        put("thumbnailUrl", manga.thumbnail_url)
                        put("sourceId", sourceId.toString())
                    }
                    mangaList.put(item)
                }

                val res = JSObject().apply {
                    put("mangas", mangaList)
                    put("hasNextPage", mangaPage.hasNextPage)
                }
                call.resolve(res)
            } catch (e: Exception) {
                logcat(LogPriority.ERROR, e) { "Error searching manga for source $sourceId" }
                call.reject(e.message ?: "Search failed")
            }
        }
    }

    @PluginMethod
    fun getMangaDetails(call: PluginCall) {
        val sourceId = call.getString("sourceId")?.toLongOrNull()
            ?: return call.reject("sourceId is required")
        val mangaUrl = call.getString("mangaUrl")
            ?: return call.reject("mangaUrl is required")

        pluginScope.launch {
            try {
                val source = getHttpSource(sourceId)
                    ?: return@launch call.reject("Source with ID $sourceId not found")

                val sManga = SManga.create().apply { url = mangaUrl }
                val details = source.getMangaDetails(sManga)
                val chapters = source.getChapterList(sManga)

                val chapterArray = JSArray()
                for (chapter in chapters) {
                    val chapObj = JSObject().apply {
                        put("url", chapter.url)
                        put("name", chapter.name)
                        put("chapterNumber", chapter.chapter_number)
                        put("dateUpload", chapter.date_upload)
                        put("scanlator", chapter.scanlator)
                    }
                    chapterArray.put(chapObj)
                }

                val res = JSObject().apply {
                    put("title", details.title)
                    put("author", details.author)
                    put("artist", details.artist)
                    put("description", details.description)
                    put("genre", details.genre)
                    put("status", details.status)
                    put("thumbnailUrl", details.thumbnail_url)
                    put("chapters", chapterArray)
                }
                call.resolve(res)
            } catch (e: Exception) {
                logcat(LogPriority.ERROR, e) { "Error fetching manga details for $mangaUrl" }
                call.reject(e.message ?: "Failed to get manga details")
            }
        }
    }

    @PluginMethod
    fun getChapterPages(call: PluginCall) {
        val sourceId = call.getString("sourceId")?.toLongOrNull()
            ?: return call.reject("sourceId is required")
        val chapterUrl = call.getString("chapterUrl")
            ?: return call.reject("chapterUrl is required")

        pluginScope.launch {
            try {
                val source = getHttpSource(sourceId)
                    ?: return@launch call.reject("Source with ID $sourceId not found")

                val sChapter = SChapter.create().apply { url = chapterUrl }
                val pages = source.getPageList(sChapter)

                val pageArray = JSArray()
                for (page in pages) {
                    pageArray.put(page.imageUrl)
                }

                val res = JSObject().apply {
                    put("pages", pageArray)
                }
                call.resolve(res)
            } catch (e: Exception) {
                logcat(LogPriority.ERROR, e) { "Error fetching chapter pages for $chapterUrl" }
                call.reject(e.message ?: "Failed to get chapter pages")
            }
        }
    }

    private fun getHttpSource(sourceId: Long): HttpSource? {
        val context = context ?: return null
        val app = context.applicationContext as? eu.kanade.tachiyomi.App ?: return null
        return app.sourceManager.get(sourceId) as? HttpSource
    }
}
