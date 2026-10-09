import React, { useState, useEffect } from 'react';
import { mihonService, MihonSource, MihonExtension } from '../services/mihonService';
import { Puzzle, CheckCircle2, RefreshCw, Globe2, ShieldCheck, Sparkles, Download, Trash2, Search, Store } from 'lucide-react';

export const ExtensionsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'installed' | 'store'>('installed');
  const [sources, setSources] = useState<MihonSource[]>([]);
  const [availableExts, setAvailableExts] = useState<MihonExtension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState<string>('all');
  const [installingPkgs, setInstallingPkgs] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sourceList, extList] = await Promise.all([
        mihonService.getSources(),
        mihonService.getAvailableExtensions(),
      ]);
      setSources(sourceList);
      setAvailableExts(extList);
    } catch (e) {
      console.warn('Failed to load extensions data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInstall = async (pkgName: string) => {
    setInstallingPkgs(prev => new Set(prev).add(pkgName));
    try {
      const success = await mihonService.installExtension(pkgName);
      if (success) {
        await loadData();
      }
    } catch (e) {
      console.error('Failed to install extension:', e);
    } finally {
      setInstallingPkgs(prev => {
        const next = new Set(prev);
        next.delete(pkgName);
        return next;
      });
    }
  };

  const handleUninstall = async (pkgName: string) => {
    setInstallingPkgs(prev => new Set(prev).add(pkgName));
    try {
      const success = await mihonService.uninstallExtension(pkgName);
      if (success) {
        await loadData();
      }
    } catch (e) {
      console.error('Failed to uninstall extension:', e);
    } finally {
      setInstallingPkgs(prev => {
        const next = new Set(prev);
        next.delete(pkgName);
        return next;
      });
    }
  };

  const languages = Array.from(new Set(availableExts.map(e => e.lang))).filter(Boolean);

  const filteredStoreExtensions = availableExts.filter(ext => {
    if (selectedLang !== 'all' && ext.lang !== selectedLang) return false;
    if (searchQuery.trim()) {
      return ext.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
             ext.pkgName.toLowerCase().includes(searchQuery.toLowerCase().trim());
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30 text-indigo-400">
              <Puzzle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Extensions & Sources
                <span className="px-2.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-medium">
                  Mihon Core Engine
                </span>
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Manage installed manga scrapers or download new extension sources from Keiyoushi Store
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/30"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Extensions
        </button>
      </div>

      {/* Primary Navigation Tabs (Installed vs Extension Store) */}
      <div className="flex items-center gap-3 mb-6 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 w-fit">
        <button
          onClick={() => setActiveTab('installed')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'installed'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Installed ({sources.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('store')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'store'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Store className="w-4 h-4 text-amber-400" />
          <span>Extension Store ({availableExts.length})</span>
        </button>
      </div>

      {/* TAB 1: INSTALLED SOURCES */}
      {activeTab === 'installed' && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="h-32 bg-slate-900/50 border border-white/5 rounded-2xl animate-pulse p-5" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-white/5">
              <Puzzle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-300">No Installed Extension Sources Found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Switch to the "Extension Store" tab to download and install new extension sources!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sources.map(source => (
                <div
                  key={source.id}
                  className="group relative bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-indigo-500/50 rounded-2xl p-5 transition-all shadow-lg hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-base">
                          {source.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-base group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                            {source.name}
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-slate-800 text-slate-300 rounded-md border border-white/5">
                              {source.lang}
                            </span>
                            {source.supportsLatest && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 rounded-md border border-indigo-500/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> Latest
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {source.baseUrl && (
                      <p className="text-xs text-slate-400 font-mono truncate flex items-center gap-1.5 mt-2">
                        <Globe2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {source.baseUrl}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Installed & Active
                    </span>
                    <span className="text-slate-500">ID: {source.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: KEIYOUSHI EXTENSION STORE (BROWSE & DOWNLOAD) */}
      {activeTab === 'store' && (
        <div className="space-y-6">
          {/* Search & Language Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-white/10">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search extension by name or package..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {languages.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedLang('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedLang === 'all'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  All ({availableExts.length})
                </button>
                {languages.map(lang => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLang(lang)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase whitespace-nowrap transition-all ${
                      selectedLang === lang
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Extension Store List */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="h-28 bg-slate-900/50 border border-white/5 rounded-2xl animate-pulse p-4" />
              ))}
            </div>
          ) : filteredStoreExtensions.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-white/5">
              <Store className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-300">No Extensions Found</h3>
              <p className="text-sm text-slate-500 mt-1">Try adjusting your search query or language filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStoreExtensions.map(ext => {
                const isBusy = installingPkgs.has(ext.pkgName);

                return (
                  <div
                    key={ext.pkgName}
                    className="bg-slate-900/80 border border-white/10 hover:border-indigo-500/40 rounded-2xl p-4 transition-all shadow-md flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {ext.iconUrl ? (
                        <img
                          src={ext.iconUrl}
                          alt={ext.name}
                          className="w-10 h-10 rounded-xl object-cover bg-slate-800 shrink-0 border border-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 shrink-0">
                          {ext.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-sm truncate">{ext.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold bg-slate-800 text-slate-300 rounded border border-white/5">
                            {ext.lang}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">v{ext.versionName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {ext.isInstalled ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 text-xs bg-emerald-500/20 text-emerald-400 font-bold rounded-xl border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Installed
                          </span>
                          <button
                            onClick={() => handleUninstall(ext.pkgName)}
                            disabled={isBusy}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                            title="Uninstall Extension"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleInstall(ext.pkgName)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 transition"
                        >
                          {isBusy ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{isBusy ? 'Installing...' : 'Install'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
