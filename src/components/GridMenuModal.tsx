import React, { useState, useEffect } from 'react';
import {
  X,
  Home,
  Search,
  Film,
  Bookmark,
  Rotate3d,
  User,
  Gamepad2,
  Calendar,
  Download,
  Dices,
  Bot,
  Sparkles,
  Lock,
  RefreshCw,
  Eye,
  HelpCircle,
  TrendingUp,
  Zap,
  ArrowRight,
  Layers,
  BarChart3,
  Flame,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TabType } from './Navbar';
import { UserSettings, Anime } from '../types';

interface GridMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  settings: UserSettings;
  libraryCount: number;
  isPinLocked?: boolean;
  onOpenGacha?: () => void;
  onOpenAiSensei?: () => void;
}

export const GridMenuModal: React.FC<GridMenuModalProps> = ({
  isOpen,
  onClose,
  currentTab,
  onSelectTab,
  settings,
  libraryCount,
  isPinLocked = false,
  onOpenGacha,
  onOpenAiSensei,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const isTwoWayConnected = Boolean(settings.twoWaySyncEnabled && settings.anilistToken);
  const isPinConfigured = Boolean(settings.profilePinEnabled && settings.profilePin);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleNavigate = (tab: TabType) => {
    onSelectTab(tab);
    onClose();
  };

  // Sub-parts under Home Navigation
  const homeSubParts = [
    {
      id: 'home' as TabType,
      title: 'Home Hub',
      desc: 'Featured anime, recommendations & continue watching',
      icon: Home,
      color: 'from-pink-500 to-rose-600',
      badge: null,
    },
    {
      id: 'discover' as TabType,
      title: 'Search & Explore',
      desc: 'Browse genres, search database & filter top rated',
      icon: Search,
      color: 'from-sky-500 to-blue-600',
      badge: null,
    },
    {
      id: 'reels' as TabType,
      title: 'Anime Reels',
      desc: 'Short video edits, trending clips & community reels',
      icon: Film,
      color: 'from-purple-500 to-pink-600',
      badge: 'HOT',
    },
    {
      id: 'library' as TabType,
      title: 'My Library',
      desc: 'Watchlist, favorites & custom bookmark lists',
      icon: isPinConfigured && isPinLocked ? Lock : Bookmark,
      color: 'from-amber-500 to-orange-600',
      badge: isPinConfigured && isPinLocked ? 'LOCKED' : libraryCount > 0 ? `${libraryCount}` : null,
    },
    {
      id: 'cards' as TabType,
      title: 'Collectible Cards',
      desc: '3D Anime cards inventory & gacha card showcase',
      icon: isPinConfigured && isPinLocked ? Lock : Rotate3d,
      color: 'from-indigo-500 to-purple-600',
      badge: '3D',
    },
    {
      id: 'account' as TabType,
      title: 'Account & Sync',
      desc: 'AniList cloud sync, user settings & profile stats',
      icon: User,
      color: 'from-emerald-500 to-teal-600',
      badge: isTwoWayConnected ? 'SYNCED' : null,
    },
  ];

  // Filter items if searching in grid
  const query = searchQuery.toLowerCase().trim();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto">
        {/* Backdrop Blur Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-2xl transition-opacity"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-5xl bg-slate-900/95 border border-white/15 rounded-3xl shadow-2xl shadow-pink-500/10 overflow-hidden z-10 my-auto flex flex-col max-h-[90vh]"
        >
          {/* Header Bar */}
          <div className="p-4 sm:p-6 border-b border-white/10 bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/25 border border-white/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white tracking-tight">
                    AniLove <span className="text-pink-400">Grid Menu</span>
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500/20 text-pink-300 border border-pink-500/30">
                    PRO NAVIGATION
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Quick access to all features, games, schedule & tabs
                </p>
              </div>
            </div>

            {/* Quick Search Input & Close Button */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search options..."
                  className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-pink-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 flex items-center justify-center border border-white/15 transition cursor-pointer shrink-0"
                title="Close Menu (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Grid Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            {/* 1. HOME & SUB-PARTS SECTION */}
            {(!query || 'home search discover reels library cards account'.includes(query)) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-pink-400" />
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                      Home & Primary Tabs
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    6 Sub-Sections Available
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {homeSubParts
                    .filter(
                      (item) =>
                        !query ||
                        item.title.toLowerCase().includes(query) ||
                        item.desc.toLowerCase().includes(query)
                    )
                    .map((item) => {
                      const IconComponent = item.icon;
                      const isActive = currentTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavigate(item.id)}
                          className={`group relative p-4 rounded-2xl text-left border transition-all duration-300 cursor-pointer overflow-hidden ${
                            isActive
                              ? 'bg-gradient-to-br from-pink-500/20 via-purple-500/15 to-slate-900 border-pink-500/50 shadow-lg shadow-pink-500/10'
                              : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/25'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform`}
                              >
                                <IconComponent className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors">
                                  {item.title}
                                </h4>
                                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                                  {item.desc}
                                </p>
                              </div>
                            </div>

                            {item.badge && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider ${
                                  item.badge === 'LOCKED'
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>

                          {/* Hover Arrow */}
                          <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-400 group-hover:text-white transition-colors">
                            <span>{isActive ? 'Currently Active' : 'Open Tab'}</span>
                            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform text-pink-400" />
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* 2. MAIN ARCADE SECTION */}
            {(!query || 'arcade game gacha Shop blur shadow higher lower year battle'.includes(query)) && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                      Arcade Gaming Zone
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    GAMES & SHOP
                  </span>
                </div>

                <div
                  onClick={() => handleNavigate('arcade')}
                  className={`group relative p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                    currentTab === 'arcade'
                      ? 'bg-gradient-to-r from-purple-900/40 via-pink-900/30 to-slate-900 border-purple-400/60 shadow-xl shadow-purple-500/20'
                      : 'bg-gradient-to-r from-purple-950/30 via-slate-900 to-pink-950/30 hover:from-purple-900/40 hover:to-pink-900/40 border-purple-500/30 hover:border-purple-400/50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/30 border border-white/20 shrink-0 group-hover:scale-105 transition-transform">
                        <Gamepad2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-extrabold text-white group-hover:text-purple-300 transition-colors">
                            AniLove Arcade Center
                          </h4>
                          <span className="px-2 py-0.5 rounded-md bg-pink-500/30 text-pink-200 text-[10px] font-black border border-pink-400/40">
                            MINI-GAMES
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          Play Blur Guesser, Anime Shadow Guesser, Higher or Lower, Year Battle & Gacha Shop to earn coins!
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigate('arcade');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 shrink-0 transition active:scale-95 cursor-pointer"
                    >
                      <span>Enter Arcade</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SCHEDULE & DOWNLOADS SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SCHEDULE CARD */}
              {(!query || 'schedule calendar release airing episodes dates'.includes(query)) && (
                <div
                  onClick={() => handleNavigate('schedule')}
                  className={`group relative p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                    currentTab === 'schedule'
                      ? 'bg-gradient-to-br from-blue-900/40 via-sky-950/30 to-slate-900 border-sky-400/60 shadow-lg'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-sky-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                          Airing Schedule
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Weekly anime release calendar & episode countdowns
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      LIVE
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-sky-400 group-hover:text-sky-300">
                    <span>View Calendar</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )}

              {/* DOWNLOADS CARD */}
              {(!query || 'downloads offline storage episodes video'.includes(query)) && (
                <div
                  onClick={() => handleNavigate('downloads')}
                  className={`group relative p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                    currentTab === 'downloads'
                      ? 'bg-gradient-to-br from-violet-900/40 via-purple-950/30 to-slate-900 border-violet-400/60 shadow-lg'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-violet-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
                        <Download className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">
                          Offline Downloads
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Watch downloaded episodes anytime without internet
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      OFFLINE
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-violet-400 group-hover:text-violet-300">
                    <span>Manage Offline Media</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              )}
            </div>

            {/* 4. EXTRA COOL TOOLS & SENSEI SECTION */}
            {(!query || 'gacha randomizer sensei ai companion helper'.includes(query)) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                    Interactive Anime AI & Utilities
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Anime Gacha Spin */}
                  {onOpenGacha && (
                    <div
                      onClick={() => {
                        onClose();
                        onOpenGacha();
                      }}
                      className="group p-4 rounded-2xl bg-gradient-to-br from-amber-950/30 via-slate-900 to-rose-950/30 hover:from-amber-900/40 hover:to-rose-900/40 border border-amber-500/30 hover:border-amber-400/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 shadow-md group-hover:rotate-12 transition-transform">
                          <Dices className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                            Anime Gacha Wheel
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Spin randomizer for instant anime recommendations
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ai Sensei Assistant */}
                  {onOpenAiSensei && (
                    <div
                      onClick={() => {
                        onClose();
                        onOpenAiSensei();
                      }}
                      className="group p-4 rounded-2xl bg-gradient-to-br from-pink-950/30 via-slate-900 to-violet-950/30 hover:from-pink-900/40 hover:to-violet-900/40 border border-pink-500/30 hover:border-pink-400/50 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform">
                          <Bot className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors">
                            Ask Ai Sensei
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Get smart personalized anime recommendations & analysis
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-semibold">
                <RefreshCw className={`w-3.5 h-3.5 ${isTwoWayConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
                {isTwoWayConnected ? (
                  <span className="text-emerald-400">AniList Cloud Synced</span>
                ) : (
                  <span>AniList Disconnected</span>
                )}
              </span>

              {isPinConfigured && (
                <span className="flex items-center gap-1 font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                  <Lock className="w-3 h-3" /> PIN Security Active
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500">
              AniLove2 Pro Navigation System • Tap outside or press ESC to dismiss
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
