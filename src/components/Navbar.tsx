import React, { useState, useEffect } from 'react';
import { Home, Search, Calendar, Bookmark, User, RefreshCw, Rotate3d, Lock, Film } from 'lucide-react';
import { UserSettings, AppNotification, Anime } from '../types';
import { NotificationCenter } from './NotificationCenter';
import { GridMenuModal } from './GridMenuModal';

export type TabType =
  | 'home'
  | 'discover'
  | 'reels'
  | 'arcade'
  | 'schedule'
  | 'library'
  | 'cards'
  | 'account'
  | 'downloads'
  | 'news';

interface NavbarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  settings: UserSettings;
  libraryCount: number;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onOpenDetails: (anime: Anime) => void;
  onPlayStream: (anime: Anime) => void;
  onOpenGacha?: () => void;
  onOpenAiSensei?: () => void;
  isPlaying?: boolean;
  isPinLocked?: boolean;
  onLockSession?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  settings,
  libraryCount,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onOpenDetails,
  onPlayStream,
  onOpenAiSensei,
  isPlaying = false,
  isPinLocked = false,
  onLockSession,
}) => {
  const isTwoWayConnected = Boolean(settings.twoWaySyncEnabled && settings.anilistToken);
  const isPinConfigured = Boolean(settings.profilePinEnabled && settings.profilePin);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        id="main-app-header"
        className={`w-full transition-all duration-300 ${
          isScrolled || currentTab !== 'home'
            ? 'bg-slate-950/90 backdrop-blur-xl border-b border-white/10 shadow-xl shadow-black/60 py-1'
            : 'bg-transparent border-b border-transparent shadow-none py-1'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Top-Left: Three-Line Menu Trigger Button & Optional 18+ Profile Badge */}
          <div className="flex items-center gap-3">
            <button
              id="nav-grid-menu-btn"
              onClick={() => setIsGridMenuOpen(true)}
              className="group relative flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 transition-all active:scale-95 cursor-pointer"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              {/* Minimal Three Horizontal Lines Icon */}
              <div className="relative flex flex-col justify-center gap-1 w-4.5 h-3.5">
                <span className="w-4.5 h-0.5 bg-white/90 rounded-full group-hover:bg-pink-400 transition-colors" />
                <span className="w-4.5 h-0.5 bg-white/90 rounded-full group-hover:bg-purple-400 transition-colors" />
                <span className="w-3.5 h-0.5 bg-white/90 rounded-full group-hover:w-4.5 group-hover:bg-indigo-400 transition-all" />
              </div>

              <span className="font-bold text-xs tracking-tight text-slate-200 group-hover:text-white">
                Menu
              </span>
            </button>

            {settings.is18PlusMode && (
              <button
                onClick={() => onSelectTab('account')}
                className="px-2.5 py-1.5 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] sm:text-xs font-black tracking-wider flex items-center gap-1.5 animate-pulse hover:bg-red-600/30 transition cursor-pointer"
                title="18+ Secret Profile Mode Active. Click to manage in Account."
              >
                <span>🔥</span>
                <span className="hidden xs:inline">18+ SECRET PROFILE</span>
                <span className="xs:hidden">18+ VAULT</span>
              </button>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 p-1 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 transition">
            <button
              id="nav-tab-home"
              onClick={() => onSelectTab('home')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'home'
                  ? 'bg-white/15 text-white border border-white/20 shadow-md backdrop-blur-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Home className="w-4 h-4 opacity-80" />
              <span>Home</span>
            </button>

            <button
              id="nav-tab-discover"
              onClick={() => onSelectTab('discover')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'discover'
                  ? 'bg-white/15 text-white border border-white/20 shadow-md backdrop-blur-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Search className="w-4 h-4 opacity-80" />
              <span>Search</span>
            </button>

            {/* Reels Tab */}
            <button
              id="nav-tab-reels"
              onClick={() => onSelectTab('reels')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'reels'
                  ? 'bg-white/15 text-white border border-white/20 shadow-md backdrop-blur-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Film className="w-4 h-4 opacity-80" />
              <span>Reels</span>
            </button>

            <button
              id="nav-tab-schedule"
              onClick={() => onSelectTab('schedule')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'schedule'
                  ? 'bg-white/15 text-white border border-white/20 shadow-md backdrop-blur-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Calendar className="w-4 h-4 opacity-80" />
              <span>Schedule</span>
            </button>

            <button
              id="nav-tab-library"
              onClick={() => onSelectTab('library')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer relative ${
                currentTab === 'library'
                  ? 'bg-white/15 text-white border border-white/20 shadow-md backdrop-blur-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {isPinConfigured && isPinLocked ? (
                <Lock className="w-3.5 h-3.5 text-amber-400 opacity-90" />
              ) : (
                <Bookmark className="w-4 h-4 opacity-80" />
              )}
              <span>Library</span>
              {isPinConfigured && isPinLocked ? (
                <span className="px-1.5 py-0.2 rounded-md bg-amber-500/30 text-amber-300 text-[9px] font-extrabold border border-amber-500/40">
                  PIN
                </span>
              ) : libraryCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-pink-500/40 text-pink-300 text-[10px] font-bold border border-pink-500/50">
                  {libraryCount}
                </span>
              ) : null}
            </button>

            {/* Cards Tab */}
            <button
              id="nav-tab-cards"
              onClick={() => onSelectTab('cards')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer relative ${
                currentTab === 'cards'
                  ? 'bg-white/15 text-white border border-white/20 shadow-md backdrop-blur-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {isPinConfigured && isPinLocked ? (
                <Lock className="w-3.5 h-3.5 text-amber-400 opacity-90" />
              ) : (
                <Rotate3d className="w-4 h-4 text-pink-400 opacity-90" />
              )}
              <span>Cards</span>
            </button>

            <button
              id="nav-tab-account"
              onClick={() => onSelectTab('account')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                currentTab === 'account'
                  ? 'bg-white/15 text-white border border-white/20 shadow-md backdrop-blur-sm'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <User className="w-4 h-4 opacity-80" />
              <span>Account</span>
              {isTwoWayConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
              )}
            </button>
          </nav>

          {/* Right Section: Cloud Sync + Session Lock + Notifications */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Quick Lock Session Button */}
            {isPinConfigured && !isPinLocked && onLockSession && (
              <button
                id="nav-lock-session-btn"
                onClick={onLockSession}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-bold border border-white/10 hover:border-rose-500/30 backdrop-blur-md transition active:scale-95 cursor-pointer"
                title="Lock Library & Cards with PIN Now"
              >
                <Lock className="w-3.5 h-3.5 text-pink-400" />
                <span className="text-[11px]">Lock</span>
              </button>
            )}

            {/* Cloud Sync State Chip */}
            <div
              onClick={() => onSelectTab('account')}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md cursor-pointer text-xs transition"
              title={
                isTwoWayConnected
                  ? `AniList 2-Way Sync Active (${settings.anilistUser?.name || 'Connected'})`
                  : 'AniList Account Not Linked'
              }
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isTwoWayConnected ? 'text-emerald-400' : 'text-slate-500'
                }`}
              />
              <span
                className={`font-semibold ${
                  isTwoWayConnected ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                {isTwoWayConnected ? 'Synced' : 'Offline'}
              </span>
            </div>

            {/* Real-time Notification Center Bell */}
            <NotificationCenter
              notifications={notifications}
              onMarkAsRead={onMarkAsRead}
              onMarkAllAsRead={onMarkAllAsRead}
              onClearAll={onClearAll}
              onOpenDetails={onOpenDetails}
              onPlayStream={onPlayStream}
              onNavigateToSettings={() => onSelectTab('account')}
            />
          </div>
        </div>
      </header>

      {/* Modern Sleek Navigation Drawer Modal */}
      <GridMenuModal
        isOpen={isGridMenuOpen}
        onClose={() => setIsGridMenuOpen(false)}
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        settings={settings}
        libraryCount={libraryCount}
        isPinLocked={isPinLocked}
      />
    </>
  );
};
