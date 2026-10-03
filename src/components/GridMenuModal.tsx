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
  Settings,
  Lock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TabType } from './Navbar';
import { UserSettings } from '../types';

interface GridMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  settings: UserSettings;
  libraryCount: number;
  isPinLocked?: boolean;
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
  onOpenAiSensei,
}) => {
  const [isHomeExpanded, setIsHomeExpanded] = useState(false);

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

  // Sub-items that belong to the lower navigation bar, shown when Home is expanded
  const lowerNavSubItems = [
    {
      id: 'home' as TabType,
      label: 'Home Feed',
      icon: Home,
    },
    {
      id: 'discover' as TabType,
      label: 'Search & Discover',
      icon: Search,
    },
    {
      id: 'reels' as TabType,
      label: 'Reels Clips',
      icon: Film,
    },
    {
      id: 'downloads' as TabType,
      label: 'Offline Downloads',
      icon: Download,
    },
    {
      id: 'library' as TabType,
      label: isPinConfigured && isPinLocked ? 'Library (Locked)' : 'Library',
      icon: isPinConfigured && isPinLocked ? Lock : Bookmark,
      badge: libraryCount > 0 && !isPinLocked ? `${libraryCount}` : null,
    },
    {
      id: 'account' as TabType,
      label: 'Account & Settings',
      icon: User,
    },
  ];

  // Top-level standalone menu items (other than Home)
  const standaloneMenuItems = [
    {
      id: 'schedule' as TabType,
      label: 'Schedule',
      icon: Calendar,
    },
    {
      id: 'arcade' as TabType,
      label: 'Arcade Center',
      icon: Gamepad2,
    },
    {
      id: 'cards' as TabType,
      label: 'Cards Inventory',
      icon: Rotate3d,
    },
  ];

  // Check if any sub-item under Home is currently active
  const isHomeSubActive = lowerNavSubItems.some((item) => item.id === currentTab);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex">
        {/* Dark Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm"
        />

        {/* Side Navigation Drawer */}
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-72 sm:w-80 h-full max-w-[85vw] bg-neutral-950/98 border-r border-white/10 shadow-2xl flex flex-col justify-between z-10 select-none overflow-hidden"
        >
          {/* Top Header */}
          <div className="p-5 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="font-black text-xl text-white tracking-wider">
                ANILOVE<span className="text-pink-500 text-sm font-extrabold ml-0.5">2</span>
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links List */}
          <div className="px-3 py-4 space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
            {/* 1. Collapsible Home Group (Contains all lower navigation bar options) */}
            <div className="rounded-2xl overflow-hidden border border-white/5 bg-white/[0.02]">
              <button
                onClick={() => setIsHomeExpanded((prev) => !prev)}
                className={`w-full flex items-center justify-between px-4 py-3 font-semibold text-sm transition-all duration-200 cursor-pointer ${
                  isHomeSubActive
                    ? 'bg-white/10 text-white font-bold border-b border-white/10'
                    : 'text-slate-200 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Home className={`w-4.5 h-4.5 ${isHomeSubActive ? 'text-pink-400' : 'text-slate-400'}`} />
                  <span>Home</span>
                </div>

                {/* Small indicator sign for expansion */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="text-[10px] font-medium text-slate-500">
                    {isHomeExpanded ? 'Hide Tabs' : 'View Tabs'}
                  </span>
                  {isHomeExpanded ? (
                    <ChevronDown className="w-4 h-4 text-pink-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Sub-menu options under Home */}
              <AnimatePresence>
                {isHomeExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden bg-black/40 border-t border-white/5 pl-3 py-1 space-y-1"
                  >
                    {lowerNavSubItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = currentTab === subItem.id;

                      return (
                        <button
                          key={subItem.id}
                          onClick={() => handleNavigate(subItem.id)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                            isSubActive
                              ? 'bg-pink-500/20 text-pink-300 font-bold border border-pink-500/30'
                              : 'text-slate-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <SubIcon className={`w-4 h-4 ${isSubActive ? 'text-pink-400' : 'text-slate-500'}`} />
                            <span>{subItem.label}</span>
                          </div>

                          {subItem.badge && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-pink-500/30 text-pink-300 border border-pink-500/40">
                              {subItem.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 2. Other Standalone Menu Items */}
            {standaloneMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white/10 text-white font-bold border border-white/15 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon
                      className={`w-4.5 h-4.5 ${
                        isActive ? 'text-pink-400' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}

            {/* 3. Ask AI Sensei Button */}
            {onOpenAiSensei && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAiSensei();
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl font-semibold text-sm text-purple-300 hover:text-white hover:bg-purple-500/10 transition cursor-pointer border border-transparent hover:border-purple-500/20 mt-2"
              >
                <Bot className="w-4.5 h-4.5 text-purple-400" />
                <span>Ask Ai Sensei</span>
              </button>
            )}
          </div>

          {/* Bottom Profile / Sync Footer */}
          <div className="p-4 border-t border-white/5 bg-neutral-900/40 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-medium">
              <span className="flex items-center gap-1.5">
                <RefreshCw className={`w-3 h-3 ${isTwoWayConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
                {isTwoWayConnected ? 'AniList Synced' : 'Offline'}
              </span>
              <span>v2.5.0</span>
            </div>

            <div
              onClick={() => handleNavigate('account')}
              className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-md">
                  {settings.anilistUser?.name
                    ? settings.anilistUser.name.charAt(0).toUpperCase()
                    : 'U'}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white leading-none">
                    {settings.anilistUser?.name || 'Account & Settings'}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {isTwoWayConnected ? 'Cloud Linked' : 'Manage Profile'}
                  </p>
                </div>
              </div>

              <Settings className="w-4 h-4 text-slate-400 hover:text-white" />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
