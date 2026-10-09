import { registerPlugin } from '@capacitor/core';

export interface MihonSource {
  id: string;
  name: string;
  lang: string;
  supportsLatest: boolean;
  baseUrl: string;
}

export interface MihonExtension {
  pkgName: string;
  name: string;
  versionName: string;
  lang: string;
  iconUrl?: string;
  isInstalled: boolean;
  hasUpdate: boolean;
}

export interface MihonMangaItem {
  url: string;
  title: string;
  thumbnailUrl?: string;
  sourceId: string;
}

export interface MihonSearchResult {
  mangas: MihonMangaItem[];
  hasNextPage: boolean;
}

export interface MihonChapter {
  url: string;
  name: string;
  chapterNumber: number;
  dateUpload: number;
  scanlator?: string;
}

export interface MihonMangaDetails {
  title: string;
  author?: string;
  artist?: string;
  description?: string;
  genre?: string;
  status: number;
  thumbnailUrl?: string;
  chapters: MihonChapter[];
}

export interface MihonEnginePluginInterface {
  getSources(): Promise<{ sources: MihonSource[] }>;
  getAvailableExtensions(): Promise<{ extensions: MihonExtension[] }>;
  installExtension(options: { pkgName: string }): Promise<{ success: boolean; pkgName: string }>;
  uninstallExtension(options: { pkgName: string }): Promise<{ success: boolean; pkgName: string }>;
  searchManga(options: { sourceId: string; query?: string; page?: number }): Promise<MihonSearchResult>;
  getMangaDetails(options: { sourceId: string; mangaUrl: string }): Promise<MihonMangaDetails>;
  getChapterPages(options: { sourceId: string; chapterUrl: string }): Promise<{ pages: string[] }>;
}

const MihonEngine = registerPlugin<MihonEnginePluginInterface>('MihonEngine');

export const mihonService = {
  /**
   * Fetch all installed extension sources from Mihon engine
   */
  async getSources(): Promise<MihonSource[]> {
    try {
      let res = await MihonEngine.getSources();
      let list = res?.sources || [];

      // Auto-retry up to 5 times if sources are still initializing on fresh app boot
      let attempts = 0;
      while (list.length === 0 && attempts < 5) {
        await new Promise(r => setTimeout(r, 1500));
        res = await MihonEngine.getSources();
        list = res?.sources || [];
        attempts++;
      }
      return list;
    } catch (e) {
      console.warn('[MihonService] getSources failed or not running in Capacitor Android:', e);
      return [];
    }
  },

  /**
   * Get all extensions available from Keiyoushi store along with installation status
   */
  async getAvailableExtensions(): Promise<MihonExtension[]> {
    try {
      const res = await MihonEngine.getAvailableExtensions();
      return res?.extensions || [];
    } catch (e) {
      console.warn('[MihonService] getAvailableExtensions failed:', e);
      return [];
    }
  },

  /**
   * Install or update an extension by package name
   */
  async installExtension(pkgName: string): Promise<boolean> {
    try {
      const res = await MihonEngine.installExtension({ pkgName });
      return res?.success || false;
    } catch (e) {
      console.error(`[MihonService] installExtension failed for ${pkgName}:`, e);
      return false;
    }
  },

  /**
   * Uninstall an extension by package name
   */
  async uninstallExtension(pkgName: string): Promise<boolean> {
    try {
      const res = await MihonEngine.uninstallExtension({ pkgName });
      return res?.success || false;
    } catch (e) {
      console.error(`[MihonService] uninstallExtension failed for ${pkgName}:`, e);
      return false;
    }
  },

  /**
   * Search manga or fetch popular items from a Mihon extension source
   */
  async searchManga(sourceId: string, query = '', page = 1): Promise<MihonSearchResult> {
    try {
      return await MihonEngine.searchManga({ sourceId, query, page });
    } catch (e) {
      console.error(`[MihonService] searchManga failed for source ${sourceId}:`, e);
      return { mangas: [], hasNextPage: false };
    }
  },

  /**
   * Fetch details and chapters for a manga
   */
  async getMangaDetails(sourceId: string, mangaUrl: string): Promise<MihonMangaDetails | null> {
    try {
      return await MihonEngine.getMangaDetails({ sourceId, mangaUrl });
    } catch (e) {
      console.error(`[MihonService] getMangaDetails failed for ${mangaUrl}:`, e);
      return null;
    }
  },

  /**
   * Fetch image page URLs for a chapter
   */
  async getChapterPages(sourceId: string, chapterUrl: string): Promise<string[]> {
    try {
      const res = await MihonEngine.getChapterPages({ sourceId, chapterUrl });
      return res?.pages || [];
    } catch (e) {
      console.error(`[MihonService] getChapterPages failed for ${chapterUrl}:`, e);
      return [];
    }
  }
};
