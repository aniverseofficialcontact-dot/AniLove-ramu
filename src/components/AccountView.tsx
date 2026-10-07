import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  ShieldCheck,
  ShieldAlert,
  Bell,
  Sliders,
  ChevronRight,
  ChevronDown,
  LogOut,
  Sparkles,
  Lock,
  Unlock,
  Volume2,
  Subtitles,
  Database,
  CheckCircle2,
  RefreshCw,
  Edit3,
  Mail,
  Smartphone,
  Flame,
  Award,
  Crown,
  KeyRound,
  Download,
  Upload,
  Globe,
  Check,
  Plus,
  Trash2,
  X,
  Eye,
  EyeOff,
  Radio,
  Image as ImageIcon,
  UserCheck,
  Snowflake,
  Palette,
  HelpCircle,
  RotateCcw,
  Film,
  Play,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserSettings, UserMediaListItem, UserProfile, GachaCard, StreamServerId } from '../types';
import { fetchUserMediaList, fetchAniListUserProfile, fetchViewerProfile, getAniListAuthUrl } from '../services/anilist';
import { getStoredGachaVault, getCardAwakeningLevel } from '../services/storage';
import { getSafeCharacterImage, getFallbackAvatarSvg } from '../services/characterPool';
import { STREAM_PROVIDERS } from '../services/streamingProviders';

interface AccountViewProps {
  settings: UserSettings;
  onSaveSettings: (newSettings: UserSettings) => void;
  onImportList: (items: UserMediaListItem[], username: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'sync', message: string, title?: string) => void;
  onExportBackup: () => void;
  onImportBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  libraryCount: number;
  isPinUnlocked?: boolean;
  onLockSession?: () => void;
  onUnlockSession?: () => void;
  onNavigateToReels?: (reelId?: string) => void;
}

// Preset High-Resolution Anime Avatars
const PRESET_AVATARS = [
  {
    name: 'Tanjiro',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Gojo / Cyber',
    url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Sakura / Blade',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Shadow Sorcerer',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Neon Shinobi',
    url: 'https://images.unsplash.com/photo-1569705460033-cfaa4bf9f822?w=400&auto=format&fit=crop&q=80',
  },
  {
    name: 'Aether Wanderer',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80',
  },
];

export const AccountView: React.FC<AccountViewProps> = ({
  settings,
  onSaveSettings,
  onImportList,
  onShowToast,
  onExportBackup,
  onImportBackup,
  libraryCount,
  isPinUnlocked = true,
  onLockSession,
  onUnlockSession,
  onNavigateToReels,
  onReplayIntro,
}) => {

  // Modals state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isSwitchProfileOpen, setIsSwitchProfileOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isNewProfileModalOpen, setIsNewProfileModalOpen] = useState(false);

  // Owned Gacha Cards for profile avatars (sorted by awakening level descending)
  const [vaultCards, setVaultCards] = useState<GachaCard[]>(() => {
    const raw = getStoredGachaVault();
    return [...raw].sort((a, b) => getCardAwakeningLevel(b.id) - getCardAwakeningLevel(a.id));
  });
  const [avatarTab, setAvatarTab] = useState<'presets' | 'owned'>('presets');

  // Edit Profile Form State
  const [editName, setEditName] = useState(settings.customDisplayName || 'Anime Explorer');
  const [editAvatar, setEditAvatar] = useState(settings.customAvatar || PRESET_AVATARS[0].url);

  // Refresh vault cards when opening modal
  useEffect(() => {
    if (isEditProfileOpen || isNewProfileModalOpen) {
      const raw = getStoredGachaVault();
      setVaultCards([...raw].sort((a, b) => getCardAwakeningLevel(b.id) - getCardAwakeningLevel(a.id)));
    }
  }, [isEditProfileOpen, isNewProfileModalOpen]);

  // New Profile Form State
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileAvatar, setNewProfileAvatar] = useState(PRESET_AVATARS[1].url);

  // PIN Form State
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [pinBackupAnswerInput, setPinBackupAnswerInput] = useState('');
  const [pinRecoveryAnswerInput, setPinRecoveryAnswerInput] = useState('');
  const [pinStep, setPinStep] = useState<'create' | 'verify' | 'remove' | 'recovery'>('create');
  const [pinError, setPinError] = useState('');

  // AniList username & token sync state
  const [anilistUsernameInput, setAnilistUsernameInput] = useState(settings.importUsername || '');
  const [anilistTokenInput, setAnilistTokenInput] = useState(settings.anilistToken || '');
  const [isSyncingAniList, setIsSyncingAniList] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);

  // Profiles list fallback
  const profiles: UserProfile[] = settings.profiles && settings.profiles.length > 0
    ? settings.profiles
    : [
        {
          id: 'profile-main',
          name: settings.customDisplayName || 'Anime Explorer',
          avatar: settings.customAvatar || PRESET_AVATARS[0].url,
          email: settings.customEmail || '',
          createdAt: Date.now(),
        },
      ];

  const currentProfile = profiles.find(p => p.id === settings.currentProfileId) || profiles[0];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = editName.trim() || 'Anime Explorer';
    const finalAvatar = editAvatar;
    const masterEmail = settings.customEmail || currentProfile.email || '';

    // Update active profile in profiles array
    const updatedProfiles = profiles.map(p => {
      if (p.id === currentProfile.id) {
        return {
          ...p,
          name: finalName,
          email: masterEmail,
          avatar: finalAvatar,
        };
      }
      return p;
    });

    const newSettings: UserSettings = {
      ...settings,
      customDisplayName: finalName,
      customEmail: masterEmail,
      customAvatar: finalAvatar,
      profiles: updatedProfiles,
    };

    onSaveSettings(newSettings);
    setIsEditProfileOpen(false);
    onShowToast('success', 'Profile details updated successfully!', 'Profile Saved');
  };

  // Switch Active Profile
  const handleSwitchProfile = (profile: UserProfile) => {
    const masterEmail = settings.customEmail || profile.email || '';
    const newSettings: UserSettings = {
      ...settings,
      currentProfileId: profile.id,
      customDisplayName: profile.name,
      customEmail: masterEmail,
      customAvatar: profile.avatar,
    };
    onSaveSettings(newSettings);
    setIsSwitchProfileOpen(false);
    onShowToast('info', `Switched active profile to "${profile.name}".`, 'Profile Switched');
  };

  // Create New Profile
  const handleCreateNewProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) {
      onShowToast('error', 'Please enter a name for the new profile.', 'Name Required');
      return;
    }

    const masterEmail = settings.customEmail || '';
    const newProf: UserProfile = {
      id: `profile-${Date.now()}`,
      name: newProfileName.trim(),
      avatar: newProfileAvatar,
      email: masterEmail,
      createdAt: Date.now(),
    };

    const updatedProfiles = [...profiles, newProf];
    const newSettings: UserSettings = {
      ...settings,
      profiles: updatedProfiles,
      currentProfileId: newProf.id,
      customDisplayName: newProf.name,
      customEmail: masterEmail,
      customAvatar: newProf.avatar,
    };

    onSaveSettings(newSettings);
    setNewProfileName('');
    setIsNewProfileModalOpen(false);
    setIsSwitchProfileOpen(false);
    onShowToast('success', `Created & switched to profile "${newProf.name}"!`, 'Profile Created');
  };

  // Delete Profile
  const handleDeleteProfile = (profileId: string, profileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (profiles.length <= 1) {
      onShowToast('error', 'You must have at least one active profile.', 'Cannot Delete');
      return;
    }

    const remaining = profiles.filter(p => p.id !== profileId);
    const nextCurrent = remaining[0];
    const newSettings: UserSettings = {
      ...settings,
      profiles: remaining,
      currentProfileId: settings.currentProfileId === profileId ? nextCurrent.id : settings.currentProfileId,
      customDisplayName: settings.currentProfileId === profileId ? nextCurrent.name : settings.customDisplayName,
      customAvatar: settings.currentProfileId === profileId ? nextCurrent.avatar : settings.customAvatar,
    };

    onSaveSettings(newSettings);
    onShowToast('info', `Profile "${profileName}" was removed.`, 'Profile Deleted');
  };

  // PIN Setup / Save / Recovery
  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (pinStep === 'create') {
      if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
        setPinError('PIN must be exactly 4 numeric digits.');
        return;
      }
      if (pinInput !== pinConfirmInput) {
        setPinError('PINs do not match. Please re-enter.');
        return;
      }
      if (!pinBackupAnswerInput.trim()) {
        setPinError('Please enter an answer for the security backup question.');
        return;
      }

      const newSettings: UserSettings = {
        ...settings,
        profilePin: pinInput,
        profilePinEnabled: true,
        profilePinBackupQuestion: 'what/who do you like most?',
        profilePinBackupAnswer: pinBackupAnswerInput.trim(),
      };
      onSaveSettings(newSettings);
      setIsPinModalOpen(false);
      setPinInput('');
      setPinConfirmInput('');
      setPinBackupAnswerInput('');
      onShowToast('success', 'Profile PIN and backup question activated!', 'PIN Enabled');
    } else if (pinStep === 'remove') {
      if (pinInput !== settings.profilePin) {
        setPinError('Incorrect PIN. Please enter your current 4-digit PIN or use the backup question.');
        return;
      }

      const newSettings: UserSettings = {
        ...settings,
        profilePin: null,
        profilePinEnabled: false,
        profilePinBackupAnswer: null,
      };
      onSaveSettings(newSettings);
      setIsPinModalOpen(false);
      setPinInput('');
      onShowToast('info', 'Profile PIN has been removed.', 'PIN Disabled');
    } else if (pinStep === 'recovery') {
      const cleanEntered = pinRecoveryAnswerInput.trim().toLowerCase();
      const cleanExpected = (settings.profilePinBackupAnswer || '').trim().toLowerCase();

      if (!settings.profilePinBackupAnswer || (cleanEntered && cleanEntered === cleanExpected)) {
        const newSettings: UserSettings = {
          ...settings,
          profilePin: null,
          profilePinEnabled: false,
          profilePinBackupAnswer: null,
        };
        onSaveSettings(newSettings);
        setIsPinModalOpen(false);
        setPinRecoveryAnswerInput('');
        setPinInput('');
        onShowToast('info', 'Profile PIN has been reset using backup question.', 'PIN Reset');
      } else {
        setPinError('Incorrect answer to security question. Please check spelling and try again.');
      }
    }
  };

  // Connect AniList Access Token for 2-Way Live Sync
  const handleConnectAniListToken = async (tokenToUse?: string) => {
    const token = (tokenToUse || anilistTokenInput).trim();
    if (!token) {
      onShowToast('error', 'Please paste a valid AniList OAuth Access Token.', 'Token Required');
      return;
    }

    setIsSyncingAniList(true);
    try {
      // 1. Fetch authenticated viewer
      const viewer = await fetchViewerProfile(token);
      if (!viewer || !viewer.name) {
        throw new Error('Could not retrieve AniList profile with this token.');
      }

      // 2. Fetch user's media list
      const items = await fetchUserMediaList(viewer.name);
      if (items && items.length > 0) {
        onImportList(items, viewer.name);
      }

      // 3. Save to settings with Two-Way Sync Active
      const updated: UserSettings = {
        ...settings,
        anilistToken: token,
        importUsername: viewer.name,
        anilistUser: viewer,
        twoWaySyncEnabled: true,
        syncWatchStatus: true,
        syncEpisodeProgress: true,
        syncScores: true,
        lastSyncTimestamp: Date.now(),
      };

      onSaveSettings(updated);
      setShowTokenInput(false);
      onShowToast(
        'success',
        `Live Two-Way Sync enabled for "${viewer.name}"! Changes made here will update your AniList profile.`,
        'Two-Way Live Sync Active'
      );
    } catch (err: any) {
      console.error('AniList Token Connection Error:', err);
      onShowToast('error', err.message || 'Invalid AniList token. Please verify and retry.', 'Token Invalid');
    } finally {
      setIsSyncingAniList(false);
    }
  };

  // One-Click AniList Username Sync (Public Watchlist Import)
  const handleSyncAniListUsername = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const username = anilistUsernameInput.trim();
    if (!username) {
      onShowToast('error', 'Please enter your AniList username.', 'Username Required');
      return;
    }

    setIsSyncingAniList(true);
    try {
      // 1. Fetch user watchlist
      const items = await fetchUserMediaList(username);
      if (!items || items.length === 0) {
        onShowToast('info', `No anime records found under AniList username "${username}".`, 'List Empty');
        setIsSyncingAniList(false);
        return;
      }

      // 2. Fetch user profile stats & avatar
      let aniUser = null;
      try {
        aniUser = await fetchAniListUserProfile(username);
      } catch (profileErr) {
        console.warn('Could not fetch AniList user profile metadata:', profileErr);
      }

      // 3. Save to library & settings (Username-only is 1-way sync)
      onImportList(items, username);
      const updated: UserSettings = {
        ...settings,
        importUsername: username,
        anilistUser: aniUser || {
          id: 0,
          name: username,
          avatar: { large: PRESET_AVATARS[0].url },
        },
        lastSyncTimestamp: Date.now(),
      };

      onSaveSettings(updated);
      onShowToast(
        'sync',
        `Successfully synced ${items.length} anime entries from "${username}"!`,
        'AniList Synced'
      );
    } catch (err: any) {
      console.error('AniList Sync Error:', err);
      onShowToast('error', err.message || 'Failed to sync with AniList. Check username spelling.', 'Sync Failed');
    } finally {
      setIsSyncingAniList(false);
    }
  };

  // Disconnect AniList
  const handleDisconnectAniList = () => {
    onSaveSettings({
      ...settings,
      importUsername: null,
      anilistToken: null,
      anilistUser: null,
      twoWaySyncEnabled: false,
      lastSyncTimestamp: null,
    });
    setAnilistUsernameInput('');
    setAnilistTokenInput('');
    onShowToast('info', 'AniList account disconnected.', 'Disconnected');
  };

  // Toggle 18+ Secret Profile Mode (Two Profiles in One Device)
  const handleToggle18PlusMode = () => {
    const nextVal = !settings.is18PlusMode;

    if (settings.profilePinEnabled && settings.profilePin && !isPinUnlocked) {
      if (onLockSession) onLockSession();
      setIsPinModalOpen(true);
      return;
    }

    onSaveSettings({
      ...settings,
      is18PlusMode: nextVal,
    });

    onShowToast(
      nextVal ? 'warning' : 'success',
      nextVal
        ? 'Switched to 18+ Secret Profile. Only 18+ content, 18+ library & history active.'
        : 'Switched back to Normal Anime Profile. Main anime library & history restored.',
      nextVal ? '18+ Secret Profile Active' : 'Normal Profile Active'
    );
  };

  const handleToggleAllowNsfwContent = () => {
    const updatedVal = !settings.allowNsfwContent;
    onSaveSettings({
      ...settings,
      allowNsfwContent: updatedVal,
    });
    onShowToast(
      updatedVal ? 'warning' : 'info',
      updatedVal
        ? '18+ Unfiltered Mode ON: Safe filters disabled for Fan Arts & Wallpapers.'
        : '18+ Filter Mode OFF: Explicit 18+ content filtered across Fan Arts & Wallpapers.',
      '18+ Content Filter'
    );
  };

  const displayName = currentProfile.name || settings.customDisplayName || 'Anime Explorer';
  const email = settings.customEmail || currentProfile.email || 'Guest User (Not Signed In)';
  const avatarUrl = currentProfile.avatar || settings.customAvatar || PRESET_AVATARS[0].url;

  return (
    <div className="w-full pb-10 space-y-6">
      {/* PROFILE HEADER CARD - BOUNDARYLESS */}
      <div className="relative overflow-hidden pt-4 pb-8 px-6 sm:px-12 bg-gradient-to-b from-pink-950/60 via-slate-900/95 to-slate-900 border-b border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center space-y-5">
          {/* Avatar Circle with Neon Ring & Edit Pencil */}
          <div className="relative group">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-violet-600 p-1.5 shadow-2xl shadow-pink-500/30">
              <div className="w-full h-full rounded-full bg-slate-950 overflow-hidden flex items-center justify-center relative border-2 border-white/5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-600 to-violet-800 text-white text-4xl font-black">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Click to Edit Avatar / Profile */}
            <button
              onClick={() => {
                setEditName(displayName);
                setEditAvatar(avatarUrl);
                setIsEditProfileOpen(true);
              }}
              className="absolute bottom-1 right-1 p-3 rounded-full bg-pink-500 text-white shadow-lg border-2 border-slate-900 cursor-pointer hover:bg-pink-600 transition active:scale-90"
              title="Change Name or Avatar"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* User Display Info */}
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span>{displayName}</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 font-bold tracking-wide">
              {email}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => {
                setEditName(displayName);
                setEditAvatar(avatarUrl);
                setIsEditProfileOpen(true);
              }}
              className="px-6 py-2.5 rounded-2xl bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/40 text-pink-300 text-xs font-black uppercase tracking-widest transition flex items-center gap-2.5 cursor-pointer backdrop-blur-md active:scale-95"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>

            <button
              onClick={() => setIsSwitchProfileOpen(true)}
              className="px-6 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white text-xs font-black uppercase tracking-widest transition flex items-center gap-2.5 cursor-pointer backdrop-blur-md active:scale-95"
            >
              <User className="w-4 h-4 text-violet-400" />
              <span>Switch Profile</span>
            </button>

            {/* Reels History & Bookmarks Button */}
            {onNavigateToReels && (
              <button
                onClick={() => onNavigateToReels()}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 border border-pink-500/30 text-pink-300 text-xs font-black uppercase tracking-widest transition flex items-center gap-2 cursor-pointer backdrop-blur-md active:scale-95"
                title="View last 50 watched reels history and saved bookmarks (~15 KB)"
              >
                <Sparkles className="w-4 h-4 text-pink-400" />
                <span>Reels History</span>
              </button>
            )}

            <div className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 backdrop-blur-md flex items-center gap-2">
              <Database className="w-4 h-4 text-pink-400" />
              <span>{libraryCount} in Watchlist</span>
            </div>
          </div>
        </div>
      </div>

      {/* CONTAINER FOR ACCOUNT SECTIONS */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* SECTION 2: THEME / UI PREFERENCES */}
        <div id="theme-and-ui-preferences" className="rounded-3xl border backdrop-blur-xl shadow-lg overflow-hidden bg-slate-900/50 border-white/10">
          <div className="p-5 sm:p-6 pb-3 border-b border-white/5 bg-slate-900/40">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Theme/Ui</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Atmosphere & UI FX
              </span>
            </div>
          </div>

          <div className="px-6 pb-6 pt-4 space-y-4">
            <div className="divide-y divide-white/5">
              {/* Ambient Particle Overlay (Snow, Sakura, Fireflies) */}
              <div className="py-3.5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-sm">
                      <Snowflake className="w-4 h-4 animate-spin" style={{ animationDuration: '8s' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Ambient Particle Atmosphere</span>
                        <span className="px-2 py-0.2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[9px] font-black uppercase">
                          Visual FX
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        Floating ambient snow, falling cherry blossoms, or glowing firefly sparks across the screen.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                        settings.ambientParticlesEnabled
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-white/5 text-slate-400 border-white/10'
                      }`}
                    >
                      {settings.ambientParticlesEnabled ? 'Enabled' : 'Disabled'}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !settings.ambientParticlesEnabled;
                        onSaveSettings({ ...settings, ambientParticlesEnabled: nextVal });
                      }}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        settings.ambientParticlesEnabled ? 'bg-cyan-500 shadow-md shadow-cyan-500/30' : 'bg-white/10'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          settings.ambientParticlesEnabled ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Style Chooser when enabled */}
                {settings.ambientParticlesEnabled && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      {
                        id: 'snow' as const,
                        label: 'Snow Theme',
                        desc: 'Crystal flakes & winter snow',
                        icon: '❄️',
                        border: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200',
                      },
                      {
                        id: 'sakura' as const,
                        label: 'Sakura Petals',
                        desc: '3D drifting cherry blossoms',
                        icon: '🌸',
                        border: 'border-pink-500/50 bg-pink-500/10 text-pink-200',
                      },
                      {
                        id: 'fireflies' as const,
                        label: 'Fireflies',
                        desc: 'Pulsing bioluminescent sparks',
                        icon: '✨',
                        border: 'border-amber-500/50 bg-amber-500/10 text-amber-200',
                      },
                    ].map(opt => {
                      const isSelected = (settings.ambientParticleStyle || 'sakura') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            onSaveSettings({ ...settings, ambientParticleStyle: opt.id, ambientParticlesEnabled: true });
                          }}
                          className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-1 cursor-pointer ${
                            isSelected
                              ? `${opt.border} ring-1 ring-white/30 shadow-md`
                              : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base">{opt.icon}</span>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className="text-xs font-bold leading-tight">{opt.label}</span>
                          <span className="text-[10px] text-slate-400 leading-none">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Profile PIN Row - MOVED HERE */}
              <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${settings.profilePinEnabled ? (isPinUnlocked ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30') : 'bg-white/5 text-slate-400'}`}>
                    {settings.profilePinEnabled ? (
                      isPinUnlocked ? <Unlock className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Unlock className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">Profile PIN Lock</p>
                      {settings.profilePinEnabled && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          isPinUnlocked
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {isPinUnlocked ? 'Unlocked' : 'Locked'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {settings.profilePinEnabled
                        ? '4-digit PIN lock with security question recovery ("what/who do you like most?").'
                        : 'Set a 4-digit PIN to lock and protect your app'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end sm:self-auto">
                  {settings.profilePinEnabled && (
                    <>
                      {isPinUnlocked && onLockSession && (
                        <button
                          type="button"
                          onClick={onLockSession}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Lock Now</span>
                        </button>
                      )}
                      {!isPinUnlocked && onUnlockSession && (
                        <button
                          type="button"
                          onClick={onUnlockSession}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Unlock</span>
                        </button>
                      )}
                    </>
                  )}

                  {settings.profilePinEnabled ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPinStep('remove');
                        setPinInput('');
                        setPinError('');
                        setIsPinModalOpen(true);
                      }}
                      className="text-xs font-bold text-pink-400 hover:text-pink-300 underline cursor-pointer"
                    >
                      Change / Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPinStep('create');
                        setPinInput('');
                        setPinConfirmInput('');
                        setPinError('');
                        setIsPinModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 text-xs font-bold transition cursor-pointer"
                    >
                      Set PIN
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (settings.profilePinEnabled) {
                        setPinStep('remove');
                        setPinInput('');
                        setPinError('');
                        setIsPinModalOpen(true);
                      } else {
                        setPinStep('create');
                        setPinInput('');
                        setPinConfirmInput('');
                        setPinError('');
                        setIsPinModalOpen(true);
                      }
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      settings.profilePinEnabled ? 'bg-pink-500' : 'bg-white/10'
                    }`}
                    title={settings.profilePinEnabled ? 'Click to change or remove PIN' : 'Click to setup PIN'}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        settings.profilePinEnabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: PLAYER & STREAMING PREFERENCES */}
        <div id="player-and-streaming-preferences" className="rounded-3xl border backdrop-blur-xl shadow-lg overflow-hidden bg-slate-900/50 border-white/10">
          <div className="p-5 sm:p-6 pb-3 border-b border-white/5 bg-slate-900/40">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Player & Streaming Preferences</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Playback & Audio
              </span>
            </div>
          </div>

          <div className="px-6 pb-6 pt-4 space-y-4">
            <div className="divide-y divide-white/5">

              {/* Advance Player Toggle */}
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 text-indigo-400 border border-indigo-500/30 shadow-sm">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Advance Player</span>
                      <span className="px-2 py-0.2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-white text-[9px] font-black uppercase">
                        Gestures
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      Enable vertical drag gestures for Volume (right) and Brightness (left) in the native player.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                      settings.advancePlayerEnabled
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-white/5 text-slate-400 border-white/10'
                    }`}
                  >
                    {settings.advancePlayerEnabled ? 'Enabled' : 'Disabled'}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !settings.advancePlayerEnabled;
                      onSaveSettings({ ...settings, advancePlayerEnabled: nextVal });
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                      settings.advancePlayerEnabled ? 'bg-indigo-500 shadow-md shadow-indigo-500/30' : 'bg-white/10'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        settings.advancePlayerEnabled ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Preferred Audio Languages (Top 3 Priority) */}
              <div className="py-3.5 space-y-3 border-b border-white/10">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 text-pink-300">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">Preferred Audio Languages (Top 3 Priority)</p>
                      <p className="text-xs text-slate-400">Audio language sequence used for video playback stream selection</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSaveSettings({
                        ...settings,
                        preferredPrimaryLanguage: 'DUB',
                        preferredSecondaryLanguage: 'SUB',
                        preferredLanguages: ['DUB', 'SUB', 'HIN'],
                        preferredAudio: 'dub',
                      });
                      onShowToast('success', 'Reset Audio Languages to Default (DUB -> SUB -> HIN).', 'Defaults Restored');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-slate-300 transition cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {/* Priority 1 */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
                      <span>#1 Primary Language</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[9px]">Priority 1</span>
                    </div>
                    <select
                      value={String(settings.preferredPrimaryLanguage || settings.preferredLanguages?.[0] || 'DUB').toUpperCase()}
                      onChange={e => {
                        const newP1 = e.target.value as any;
                        const p2 = String(settings.preferredSecondaryLanguage || settings.preferredLanguages?.[1] || 'SUB').toUpperCase();
                        const p3 = String(settings.preferredLanguages?.[2] || 'HIN').toUpperCase();
                        onSaveSettings({
                          ...settings,
                          preferredPrimaryLanguage: newP1,
                          preferredLanguages: [newP1, p2 as any, p3 as any],
                          preferredAudio: (newP1 === 'SUB' ? 'sub' : 'dub') as 'sub' | 'dub',
                        });
                        onShowToast('success', `Primary audio set to ${newP1}.`, 'Audio Updated');
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="DUB">🇺🇸 English Dub (Default)</option>
                      <option value="SUB">🇯🇵 Japanese Sub</option>
                      <option value="HIN">🇮🇳 Hindi Dub</option>
                      <option value="TAM">🇮🇳 Tamil Dub</option>
                      <option value="TEL">🇮🇳 Telugu Dub</option>
                      <option value="MAL">🇮🇳 Malayalam Dub</option>
                      <option value="KAN">🇮🇳 Kannada Dub</option>
                      <option value="BEN">🇮🇳 Bengali Dub</option>
                    </select>
                  </div>

                  {/* Priority 2 */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-indigo-500/30 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300">
                      <span>#2 Secondary Language</span>
                      <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-[9px]">Priority 2</span>
                    </div>
                    <select
                      value={String(settings.preferredSecondaryLanguage || settings.preferredLanguages?.[1] || 'SUB').toUpperCase()}
                      onChange={e => {
                        const newP2 = e.target.value as any;
                        const p1 = String(settings.preferredPrimaryLanguage || settings.preferredLanguages?.[0] || 'DUB').toUpperCase();
                        const p3 = String(settings.preferredLanguages?.[2] || 'HIN').toUpperCase();
                        onSaveSettings({
                          ...settings,
                          preferredSecondaryLanguage: newP2,
                          preferredLanguages: [p1 as any, newP2, p3 as any],
                        });
                        onShowToast('success', `Secondary audio set to ${newP2}.`, 'Audio Updated');
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-indigo-400 cursor-pointer"
                    >
                      <option value="SUB">🇯🇵 Japanese Sub (Default)</option>
                      <option value="DUB">🇺🇸 English Dub</option>
                      <option value="HIN">🇮🇳 Hindi Dub</option>
                      <option value="TAM">🇮🇳 Tamil Dub</option>
                      <option value="TEL">🇮🇳 Telugu Dub</option>
                      <option value="MAL">🇮🇳 Malayalam Dub</option>
                      <option value="KAN">🇮🇳 Kannada Dub</option>
                      <option value="BEN">🇮🇳 Bengali Dub</option>
                    </select>
                  </div>

                  {/* Priority 3 */}
                  <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300">
                      <span>#3 Tertiary Language</span>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-[9px]">Priority 3</span>
                    </div>
                    <select
                      value={String(settings.preferredLanguages?.[2] || 'HIN').toUpperCase()}
                      onChange={e => {
                        const newP3 = e.target.value as any;
                        const p1 = String(settings.preferredPrimaryLanguage || settings.preferredLanguages?.[0] || 'DUB').toUpperCase();
                        const p2 = String(settings.preferredSecondaryLanguage || settings.preferredLanguages?.[1] || 'SUB').toUpperCase();
                        onSaveSettings({
                          ...settings,
                          preferredLanguages: [p1 as any, p2 as any, newP3],
                        });
                        onShowToast('success', `Tertiary audio set to ${newP3}.`, 'Audio Updated');
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="HIN">🇮🇳 Hindi Dub (Default)</option>
                      <option value="SUB">🇯🇵 Japanese Sub</option>
                      <option value="DUB">🇺🇸 English Dub</option>
                      <option value="TAM">🇮🇳 Tamil Dub</option>
                      <option value="TEL">🇮🇳 Telugu Dub</option>
                      <option value="MAL">🇮🇳 Malayalam Dub</option>
                      <option value="KAN">🇮🇳 Kannada Dub</option>
                      <option value="BEN">🇮🇳 Bengali Dub</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Preferred Default Streaming Source */}
              <div className="py-3.5 flex items-center justify-between gap-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/5 text-pink-300">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Preferred Default Streaming Source</p>
                    <p className="text-xs text-slate-400">Default provider source (Default: Multi-Lang)</p>
                  </div>
                </div>
                <select
                  value={settings.preferredSource || 'Multi-Lang'}
                  onChange={e => {
                    const src = e.target.value as any;
                    onSaveSettings({
                      ...settings,
                      preferredSource: src,
                    });
                    onShowToast('success', `Default source set to ${src}.`, 'Source Updated');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/15 text-xs font-bold text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer max-w-[180px] sm:max-w-xs"
                >
                  <option value="Multi-Lang">🌐 Multi-Lang (Default)</option>
                  <option value="AnimeDekho">⚡ AnimeDekho</option>
                  <option value="HiAnime">🌸 HiAnime</option>
                  <option value="AnimeSalt">🧂 AnimeSalt</option>
                </select>
              </div>

              {/* Default Episodes Grid/Layout Option */}
              <div className="py-3.5 flex items-center justify-between gap-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/5 text-pink-300">
                    <LayoutGrid className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Default Episodes Grid/Layout</p>
                    <p className="text-xs text-slate-400">Default layout format for episode list in watch page</p>
                  </div>
                </div>
                <select
                  value={settings.preferredEpisodeLayout || 'grid'}
                  onChange={e => {
                    const layout = e.target.value as any;
                    onSaveSettings({
                      ...settings,
                      preferredEpisodeLayout: layout,
                    });
                    onShowToast('success', `Default episode layout set to ${layout === 'grid' ? 'Card Grid' : layout === 'list' ? 'List View' : 'Compact Number Tiles'}.`, 'Layout Updated');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/15 text-xs font-bold text-slate-200 focus:outline-none focus:border-pink-500 cursor-pointer max-w-[180px] sm:max-w-xs"
                >
                  <option value="grid">🖼️ Card Grid (Thumbnails)</option>
                  <option value="list">📄 List View (Detailed)</option>
                  <option value="compact">🔢 Compact Number Tiles</option>
                </select>
              </div>

              {/* Auto-Skip Intros & Outros (AniSkip) */}
              <div className="flex items-center justify-between py-3.5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/5 text-amber-300">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Auto-Skip Intros & Outros (AniSkip)</p>
                    <p className="text-xs text-slate-400">Automatically skip opening and ending theme songs during video playback</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(settings.autoSkipIntro)}
                  onChange={e => {
                    const enabled = e.target.checked;
                    onSaveSettings({
                      ...settings,
                      autoSkipIntro: enabled,
                    });
                    onShowToast('success', `Auto-skip intro/outro ${enabled ? 'enabled' : 'disabled'}.`, 'Settings Updated');
                  }}
                  className="w-4 h-4 text-pink-500 rounded bg-slate-900 border-white/20 cursor-pointer"
                />
              </div>

              {/* 18+ Secret Vault Profile Switch Card */}
              <div className="p-4 my-3 rounded-2xl bg-gradient-to-r from-red-950/40 via-purple-950/30 to-slate-900/50 border border-red-500/20 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-xl ${settings.is18PlusMode ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/5 text-purple-300'}`}>
                      <Flame className="w-5 h-5 text-red-400 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-white">18+ Secret Profile Mode</p>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${settings.is18PlusMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                          {settings.is18PlusMode ? '18+ VAULT ACTIVE' : 'NORMAL MODE'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {settings.is18PlusMode
                          ? '18+ Mode Active: Showing isolated 18+ vault library & watch history.'
                          : 'Acts as two separate profiles. Switch ON to access private 18+ catalog & library.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleToggle18PlusMode}
                    className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 ${
                      settings.is18PlusMode
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-900/30'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{settings.is18PlusMode ? 'Switch to Normal Profile' : 'Switch to 18+ Profile'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: DATA BACKUP & TRANSFER */}
        <div className="rounded-3xl border backdrop-blur-xl shadow-lg overflow-hidden bg-slate-900/50 border-white/10">
          <div className="p-5 sm:p-6 pb-3 border-b border-white/5 bg-slate-900/40">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Data Backup & Transfer</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-slate-400">
                JSON Archive
              </span>
            </div>
          </div>

          <div className="px-6 pb-6 pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={onExportBackup}
                className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 group-hover:bg-pink-500/20 transition">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-pink-300 transition">Export Watchlist JSON</p>
                    <p className="text-xs text-slate-400">Download offline backup file</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-pink-400 transition" />
              </button>

              <label className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left transition flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20 transition">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-violet-300 transition">Import Backup File</p>
                    <p className="text-xs text-slate-400">Restore library from JSON</p>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".json"
                  onChange={onImportBackup}
                  className="hidden"
                />
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 transition" />
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 4: ANILIST TWO-WAY LIVE SYNC */}
        <div className="rounded-3xl border backdrop-blur-xl shadow-lg overflow-hidden bg-slate-900/50 border-white/10">
          <div className="p-5 sm:p-6 pb-3 border-b border-white/5 bg-slate-900/40">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">AniList Two-Way Live Sync</h2>
                {settings.twoWaySyncEnabled && settings.anilistToken ? (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    2-Way Live Active
                  </span>
                ) : settings.importUsername ? (
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                    1-Way Import
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-400">
                    Not Linked
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 pt-4 space-y-4">
            {/* CONNECTED STATE: TWO-WAY LIVE SYNC OR USERNAME */}
            {settings.importUsername || settings.anilistToken ? (
              <div className="space-y-4">
                {/* Account Card */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {settings.anilistUser?.avatar?.large ? (
                      <img
                        src={settings.anilistUser.avatar.large}
                        alt={settings.importUsername || 'AniList User'}
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-sky-500/40 shadow-md"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-black text-lg">
                        {(settings.importUsername || 'A').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-white">{settings.importUsername || settings.anilistUser?.name}</p>
                        <span className="text-[10px] font-bold text-sky-400 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                          AniList Account
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {settings.twoWaySyncEnabled && settings.anilistToken
                          ? 'Live 2-Way Sync Active: Actions on this site automatically push updates to AniList in real-time.'
                          : '1-Way Sync: Public watchlist imported. Link your AniList token to enable live bidirectional synchronization.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      disabled={isSyncingAniList}
                      onClick={() => {
                        if (settings.importUsername) handleSyncAniListUsername();
                        else if (settings.anilistToken) handleConnectAniListToken(settings.anilistToken);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-pink-500/20 active:scale-95 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAniList ? 'animate-spin' : ''}`} />
                      <span>{isSyncingAniList ? 'Syncing...' : 'Sync Now'}</span>
                    </button>
                    <button
                      onClick={handleDisconnectAniList}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
                    >
                      Unlink
                    </button>
                  </div>
                </div>

                {/* LIVE TWO-WAY SYNC PREFERENCES (If Token Connected) */}
                {settings.twoWaySyncEnabled && settings.anilistToken ? (
                  <div className="p-4 rounded-2xl bg-sky-950/20 border border-sky-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Two-Way Live Sync Automation
                      </span>
                      <span className="text-[11px] text-sky-300 font-semibold">Real-time mutation push</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      {/* Sync Watch Status */}
                      <div
                        onClick={() =>
                          onSaveSettings({
                            ...settings,
                            syncWatchStatus: !settings.syncWatchStatus,
                          })
                        }
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          settings.syncWatchStatus
                            ? 'bg-sky-500/15 border-sky-500/40 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">Watch Status</p>
                          <p className="text-[10px] text-slate-400">Watching, Completed, Dropped</p>
                        </div>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${settings.syncWatchStatus ? 'bg-sky-500 border-sky-400' : 'border-slate-600'}`}>
                          {settings.syncWatchStatus && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                      </div>

                      {/* Sync Episode Progress */}
                      <div
                        onClick={() =>
                          onSaveSettings({
                            ...settings,
                            syncEpisodeProgress: !settings.syncEpisodeProgress,
                          })
                        }
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          settings.syncEpisodeProgress
                            ? 'bg-sky-500/15 border-sky-500/40 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">Episode Progress</p>
                          <p className="text-[10px] text-slate-400">Updates live when watching</p>
                        </div>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${settings.syncEpisodeProgress ? 'bg-sky-500 border-sky-400' : 'border-slate-600'}`}>
                          {settings.syncEpisodeProgress && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                      </div>

                      {/* Sync Scores */}
                      <div
                        onClick={() =>
                          onSaveSettings({
                            ...settings,
                            syncScores: !settings.syncScores,
                          })
                        }
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          settings.syncScores
                            ? 'bg-sky-500/15 border-sky-500/40 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold">Ratings & Scores</p>
                          <p className="text-[10px] text-slate-400">Syncs 1-10 scores to AniList</p>
                        </div>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${settings.syncScores ? 'bg-sky-500 border-sky-400' : 'border-slate-600'}`}>
                          {settings.syncScores && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Upgrade to 2-way live sync prompt */
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/40 to-violet-950/40 border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        Enable Live Two-Way Sync (Web ➔ AniList)
                      </p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Authorize or paste your AniList access token so changes made here automatically update your real AniList account in real-time.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowTokenInput(true)}
                      className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-extrabold shadow-lg shadow-sky-500/25 transition cursor-pointer whitespace-nowrap active:scale-95"
                    >
                      Activate 2-Way Sync
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Upgrade to 2-way live sync prompt if not connected at all */
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/40 to-violet-950/40 border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    Enable Live Two-Way Sync (Web ➔ AniList)
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Authorize or paste your AniList access token so changes made here automatically update your real AniList account in real-time.
                  </p>
                </div>
                <button
                  onClick={() => setShowTokenInput(true)}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-extrabold shadow-lg shadow-sky-500/25 transition cursor-pointer whitespace-nowrap active:scale-95"
                >
                  Activate 2-Way Sync
                </button>
              </div>
            )}

            {/* Token Input for connecting */}
            {showTokenInput && (
              <div className="mt-4 p-4 rounded-2xl bg-slate-950/50 border border-sky-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider">Connect AniList Token</h5>
                  <a
                    href="https://anilist.co/settings/developer"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-sky-400 hover:underline"
                  >
                    Get token from AniList Developer Settings &rarr;
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={anilistTokenInput}
                    onChange={e => setAnilistTokenInput(e.target.value)}
                    placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIs..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={() => handleConnectAniListToken()}
                    disabled={isSyncingAniList}
                    className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
                  >
                    {isSyncingAniList ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: EDIT PROFILE (Name, Gmail, Logo/Avatar) */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg rounded-3xl bg-slate-900 border border-white/15 p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Edit Profile Details</h3>
                    <p className="text-xs text-slate-400">Customize your display name, email, and avatar</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditProfileOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Avatar Selection with 6 Default Presets & Owned Character Cards */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Profile Avatar / Logo
                    </label>
                    <span className="text-[10px] font-bold text-pink-400">
                      6 Presets or Owned Cards Only
                    </span>
                  </div>

                  {/* Avatar Tabs */}
                  <div className="flex rounded-xl bg-slate-950 p-1 border border-white/10 mb-3">
                    <button
                      type="button"
                      onClick={() => setAvatarTab('presets')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        avatarTab === 'presets'
                          ? 'bg-pink-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Default Presets (6)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarTab('owned')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        avatarTab === 'owned'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Owned Cards ({vaultCards.length})</span>
                    </button>
                  </div>

                  {/* Tab 1: 6 Default Presets */}
                  {avatarTab === 'presets' && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                      {PRESET_AVATARS.map((av, idx) => {
                        const isSelected = editAvatar === av.url;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setEditAvatar(av.url)}
                            className={`group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-pink-500 ring-2 ring-pink-500/50 scale-105 shadow-lg shadow-pink-500/20'
                                : 'border-white/10 hover:border-white/30 opacity-75 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={av.url}
                              alt={av.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 text-center">
                              <span className="text-[9px] font-bold text-white truncate block">
                                {av.name}
                              </span>
                            </div>
                            {isSelected && (
                              <div className="absolute inset-0 bg-pink-500/25 flex items-center justify-center">
                                <Check className="w-5 h-5 text-white filter drop-shadow-md" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Tab 2: Owned Character Cards */}
                  {avatarTab === 'owned' && (
                    <div>
                      {vaultCards.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-slate-950/80 border border-white/10 text-center space-y-2">
                          <p className="text-xs font-bold text-slate-300">No Character Cards Owned Yet</p>
                          <p className="text-[11px] text-slate-500">
                            Play the Character Gacha or visit the Arcade Card Shop to summon character cards and unlock them as your profile picture!
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
                          {vaultCards.map(card => {
                            const cardImg = getSafeCharacterImage(card.characterName, card.characterImage);
                            const isSelected = editAvatar === cardImg || editAvatar === card.characterImage;
                            return (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => setEditAvatar(cardImg)}
                                className={`group relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all cursor-pointer text-left ${
                                  isSelected
                                    ? 'border-purple-500 ring-2 ring-purple-500/50 scale-105 shadow-lg shadow-purple-500/20'
                                    : 'border-white/10 hover:border-white/30 opacity-80 hover:opacity-100'
                                }`}
                              >
                                <img
                                  src={cardImg}
                                  alt={card.characterName}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-1.5">
                                  <p className="text-[10px] font-black text-white truncate">
                                    {card.characterName}
                                  </p>
                                  <p className="text-[8px] text-purple-300 font-bold truncate">
                                    {card.rarity}
                                  </p>
                                </div>
                                {isSelected && (
                                  <div className="absolute inset-0 bg-purple-500/25 flex items-center justify-center">
                                    <Check className="w-5 h-5 text-white filter drop-shadow-md" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Display Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Enter your name..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                {/* Save Button */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-slate-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 text-white text-xs font-extrabold shadow-lg shadow-pink-500/25 transition cursor-pointer active:scale-95"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: SWITCH PROFILE */}
      <AnimatePresence>
        {isSwitchProfileOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-violet-500/20 text-violet-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Switch Profile</h3>
                    <p className="text-xs text-slate-400">Select an account profile or add a new one</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSwitchProfileOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Profiles List */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {profiles.map(prof => {
                  const isActive = prof.id === currentProfile.id;
                  return (
                    <div
                      key={prof.id}
                      onClick={() => handleSwitchProfile(prof)}
                      className={`p-3.5 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-pink-500/20 border-pink-500/50 shadow-md shadow-pink-500/10'
                          : 'bg-white/5 hover:bg-white/10 border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={prof.avatar}
                          alt={prof.name}
                          className="w-10 h-10 rounded-full object-cover border border-white/20"
                        />
                        <div>
                          <p className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{prof.name}</span>
                            {isActive && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-500 text-white">
                                Active
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">{prof.email || 'Local User'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {profiles.length > 1 && !isActive && (
                          <button
                            onClick={e => handleDeleteProfile(prof.id, prof.name, e)}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {isActive && <Check className="w-5 h-5 text-pink-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add New Profile Button */}
              <div className="pt-2">
                <button
                  onClick={() => setIsNewProfileModalOpen(true)}
                  className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-dashed border-white/20 hover:border-pink-500 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-pink-400" />
                  <span>Create New Profile</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: CREATE NEW PROFILE */}
      <AnimatePresence>
        {isNewProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white">Create New Profile</h3>
                <button
                  onClick={() => setIsNewProfileModalOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateNewProfile} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Pick Profile Avatar
                    </label>
                    <span className="text-[10px] font-bold text-pink-400">
                      6 Presets or Owned Cards
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                    {PRESET_AVATARS.slice(0, 6).map((av, idx) => (
                      <button
                        key={`preset-${idx}`}
                        type="button"
                        onClick={() => setNewProfileAvatar(av.url)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition cursor-pointer relative ${
                          newProfileAvatar === av.url ? 'border-pink-500 ring-2 ring-pink-500/50 scale-105' : 'border-white/10 opacity-70'
                        }`}
                      >
                        <img src={av.url} alt={av.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        {newProfileAvatar === av.url && (
                          <div className="absolute inset-0 bg-pink-500/25 flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                    {vaultCards.map(card => {
                      const cardImg = getSafeCharacterImage(card.characterName, card.characterImage);
                      const isSelected = newProfileAvatar === cardImg;
                      return (
                        <button
                          key={`card-${card.id}`}
                          type="button"
                          onClick={() => setNewProfileAvatar(cardImg)}
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition cursor-pointer relative ${
                            isSelected ? 'border-purple-500 ring-2 ring-purple-500/50 scale-105' : 'border-white/10 opacity-70'
                          }`}
                        >
                          <img
                            src={cardImg}
                            alt={card.characterName}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-purple-500/25 flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newProfileName}
                    onChange={e => setNewProfileName(e.target.value)}
                    placeholder="e.g. Otaku Night Mode, Guest..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewProfileModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold cursor-pointer active:scale-95"
                  >
                    Create Profile
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: PROFILE PIN SETUP / REMOVE / RECOVERY */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-slate-900 border border-white/15 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                    {pinStep === 'recovery' ? <HelpCircle className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {pinStep === 'create'
                        ? 'Set Profile 4-Digit PIN'
                        : pinStep === 'recovery'
                        ? 'Reset PIN via Security Question'
                        : 'Verify & Remove PIN'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {pinStep === 'create'
                        ? 'Protect your library with a 4-digit code & backup question'
                        : pinStep === 'recovery'
                        ? 'Answer your backup question to clear profile lock'
                        : 'Enter your current PIN to turn off lock'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSavePin} className="space-y-4">
                {pinError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                    {pinError}
                  </div>
                )}

                {pinStep !== 'recovery' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        {pinStep === 'create' ? 'Enter 4-Digit PIN' : 'Current 4-Digit PIN'}
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        required
                        value={pinInput}
                        onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-center text-2xl tracking-widest text-pink-400 font-black focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    {pinStep === 'create' && (
                      <>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                            Confirm 4-Digit PIN
                          </label>
                          <input
                            type="password"
                            maxLength={4}
                            required
                            value={pinConfirmInput}
                            onChange={e => setPinConfirmInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="••••"
                            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-center text-2xl tracking-widest text-pink-400 font-black focus:outline-none focus:border-pink-500"
                          />
                        </div>

                        {/* Backup Security Question */}
                        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-pink-500/20 space-y-2 text-left">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-pink-400">
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Backup Security Question</span>
                          </div>
                          <p className="text-xs text-white font-medium">
                            "what/who do you like most?"
                          </p>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                              Your Secret Answer
                            </label>
                            <input
                              type="text"
                              required
                              value={pinBackupAnswerInput}
                              onChange={e => setPinBackupAnswerInput(e.target.value)}
                              placeholder="e.g. Zoro, Luffy, Mom, Violet Evergarden..."
                              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-pink-500"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                              Used to reset your PIN if you ever forget it.
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {pinStep === 'remove' && (
                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPinStep('recovery');
                            setPinError('');
                            setPinRecoveryAnswerInput('');
                          }}
                          className="text-xs font-semibold text-pink-400 hover:text-pink-300 transition underline cursor-pointer"
                        >
                          Forgot PIN? Reset with Security Question
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  /* RECOVERY VIEW */
                  <div className="space-y-3.5 text-left">
                    <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-amber-500/20 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Security Question</span>
                      </div>
                      <p className="text-sm font-semibold text-white">
                        "{settings.profilePinBackupQuestion || 'what/who do you like most?'}"
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Your Answer
                      </label>
                      <input
                        type="text"
                        required
                        value={pinRecoveryAnswerInput}
                        onChange={e => {
                          setPinRecoveryAnswerInput(e.target.value);
                          setPinError('');
                        }}
                        placeholder="Enter the answer you set..."
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-white/15 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (pinStep === 'recovery') {
                        setPinStep('remove');
                        setPinError('');
                      } else {
                        setIsPinModalOpen(false);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-white/10 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    {pinStep === 'recovery' ? 'Back' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 rounded-xl text-white text-xs font-bold cursor-pointer active:scale-95 shadow-lg ${
                      pinStep === 'recovery'
                        ? 'bg-gradient-to-r from-amber-500 to-pink-600 shadow-amber-500/25'
                        : 'bg-gradient-to-r from-pink-500 to-violet-600 shadow-pink-500/25'
                    }`}
                  >
                    {pinStep === 'create'
                      ? 'Activate PIN'
                      : pinStep === 'recovery'
                      ? 'Verify & Reset PIN'
                      : 'Confirm & Disable'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
