import React, { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2,
  Dice5,
  EyeOff,
  Swords,
  ShoppingBag,
  Coins,
  Calendar,
  ZoomIn,
} from 'lucide-react';
import { Anime } from '../types';
import { fetchVastArcadeAnimePool } from '../services/anilist';
import { soundEffects } from '../services/soundEffects';
import { getStoredArcadeCoins } from '../services/storage';
import { BlurGuesser } from './BlurGuesser';
import { HigherLowerGame } from './HigherLowerGame';
import { YearBattleGame } from './YearBattleGame';
import { ZoomGuesserGame } from './ZoomGuesserGame';
import { CharacterGacha } from './CharacterGacha';
import { ArcadeShop } from './ArcadeShop';

interface ArcadeViewProps {
  onOpenDetails?: (anime: Anime) => void;
  onNavigateToLibrary?: () => void;
  onNavigateToCards?: () => void;
}

export type ArcadeSubTab =
  | 'blur'
  | 'higherlower'
  | 'year_battle'
  | 'zoom_guesser'
  | 'gacha'
  | 'shop';

export const ArcadeView: React.FC<ArcadeViewProps> = ({
  onOpenDetails,
  onNavigateToLibrary,
  onNavigateToCards,
}) => {
  const [subTab, setSubTab] = useState<ArcadeSubTab>('blur');
  const [animePool, setAnimePool] = useState<Anime[]>([]);
  const [isLoadingPool, setIsLoadingPool] = useState<boolean>(true);
  const [coins, setCoins] = useState<number>(() => getStoredArcadeCoins());

  // Sync coins
  useEffect(() => {
    const handleCoinUpdate = (e: CustomEvent<number>) => {
      setCoins(e.detail);
    };
    const handleStorage = () => {
      setCoins(getStoredArcadeCoins());
    };
    window.addEventListener('arcade_coins_updated' as any, handleCoinUpdate as any);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('arcade_coins_updated' as any, handleCoinUpdate as any);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Load vast high-diversity anime pool spanning random pages, genres, and popularity
  const loadGamePool = useCallback(async () => {
    setIsLoadingPool(true);
    try {
      const vastPool = await fetchVastArcadeAnimePool();
      setAnimePool(vastPool);
    } catch (err) {
      console.error('Failed to load vast anime pool for arcade:', err);
    } finally {
      setIsLoadingPool(false);
    }
  }, []);

  useEffect(() => {
    loadGamePool();
  }, [loadGamePool]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-6 select-none">
      {/* Top Header Row (No enclosing box, clean and mobile-optimized) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="w-6 h-6 text-pink-500" />
            <h1 className="text-2xl font-black text-white tracking-tight">
              Anime <span className="text-pink-400">Arcade & Games</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-pink-500/20 text-pink-300 border border-pink-500/30">
              GACHA & QUIZZES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Play 4 fast automated anime mini-games, earn Arcade Coins, pull character cards, and collect awakenings!
          </p>
        </div>

        {/* Quick Balance Header Pill */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 shrink-0 self-start sm:self-auto">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-black text-amber-300">{coins} Arcade Coins</span>
        </div>
      </div>

      {/* Scrollable Game Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 custom-scrollbar border-b border-white/10">
        {/* Tab 1: Guess the Anime (Blur) */}
        <button
          onClick={() => {
            soundEffects.playClick();
            setSubTab('blur');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
            subTab === 'blur'
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
          }`}
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span>Guess Anime (Blur)</span>
        </button>

        {/* Tab 2: Higher or Lower (Rating Battle) */}
        <button
          onClick={() => {
            soundEffects.playClick();
            setSubTab('higherlower');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
            subTab === 'higherlower'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>Higher or Lower</span>
        </button>

        {/* Tab 3: Release Year Battle */}
        <button
          onClick={() => {
            soundEffects.playClick();
            setSubTab('year_battle');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
            subTab === 'year_battle'
              ? 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Year Battle</span>
        </button>

        {/* Tab 4: Zoom Crop Guesser */}
        <button
          onClick={() => {
            soundEffects.playClick();
            setSubTab('zoom_guesser');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
            subTab === 'zoom_guesser'
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10'
          }`}
        >
          <ZoomIn className="w-3.5 h-3.5" />
          <span>Zoom Crop</span>
        </button>

        {/* Tab 5: Character Gacha */}
        <button
          onClick={() => {
            soundEffects.playClick();
            setSubTab('gacha');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
            subTab === 'gacha'
              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30'
              : 'bg-white/5 hover:bg-white/10 text-violet-300 hover:text-white border border-white/10'
          }`}
        >
          <Dice5 className="w-3.5 h-3.5 text-pink-400" />
          <span>Character Gacha</span>
        </button>

        {/* Tab 6: Card Shop */}
        <button
          onClick={() => {
            soundEffects.playClick();
            setSubTab('shop');
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
            subTab === 'shop'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'bg-white/5 hover:bg-white/10 text-amber-300 hover:text-white border border-white/10'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Card Shop</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/30 text-amber-300">
            {coins}
          </span>
        </button>
      </div>

      {/* ===================== SUBTAB 1: GUESS THE ANIME (BLUR MCQ) ===================== */}
      {subTab === 'blur' && (
        <BlurGuesser
          animePool={animePool}
          onOpenDetails={onOpenDetails}
          onNavigateToShop={() => setSubTab('shop')}
          onRefreshPool={loadGamePool}
        />
      )}

      {/* ===================== SUBTAB 2: HIGHER OR LOWER (RATING BATTLE) ===================== */}
      {subTab === 'higherlower' && (
        <HigherLowerGame
          animePool={animePool}
          onOpenDetails={onOpenDetails}
          onNavigateToShop={() => setSubTab('shop')}
          onRefreshPool={loadGamePool}
        />
      )}

      {/* ===================== SUBTAB 3: RELEASE YEAR BATTLE ===================== */}
      {subTab === 'year_battle' && (
        <YearBattleGame
          animePool={animePool}
          onOpenDetails={onOpenDetails}
          onNavigateToShop={() => setSubTab('shop')}
          onRefreshPool={loadGamePool}
        />
      )}

      {/* ===================== SUBTAB 4: ZOOM CROP GUESSER ===================== */}
      {subTab === 'zoom_guesser' && (
        <ZoomGuesserGame
          animePool={animePool}
          onOpenDetails={onOpenDetails}
          onNavigateToShop={() => setSubTab('shop')}
          onRefreshPool={loadGamePool}
        />
      )}

      {/* ===================== SUBTAB 5: CHARACTER GACHA (COMPLETED ANIME SPINS) ===================== */}
      {subTab === 'gacha' && (
        <CharacterGacha
          onOpenDetails={onOpenDetails}
          onNavigateToLibrary={onNavigateToLibrary}
          onNavigateToShop={() => setSubTab('shop')}
          onNavigateToCards={onNavigateToCards}
        />
      )}

      {/* ===================== SUBTAB 6: CARD SHOP ===================== */}
      {subTab === 'shop' && (
        <ArcadeShop
          onOpenDetails={onOpenDetails}
          onNavigateToGame={(gameTab) => setSubTab(gameTab as ArcadeSubTab)}
        />
      )}
    </div>
  );
};
