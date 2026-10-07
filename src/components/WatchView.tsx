import React from 'react';
import { Anime, UserMediaListItem, MediaListStatus, UserSettings } from '../types';
import { ReaderView } from './ReaderView';

interface WatchViewProps {
  anime: Anime;
  episodeNumber: number;
  initialTime?: number;
  onBack: () => void;
  onEpisodeChange: (episodeNumber: number) => void;
  onUpdateStatus: (anime: Anime, status: MediaListStatus) => void;
  onUpdateProgress: (anime: Anime, newProgress: number) => void;
  onOpenDetails: (anime: Anime) => void;
  onNavigateToAnime?: (anime: Anime) => void;
  userItem?: UserMediaListItem;
  isTwoWaySyncActive?: boolean;
  settings?: UserSettings;
  onOpenDownloadsView?: () => void;
}

export const WatchView: React.FC<WatchViewProps> = ({
  anime,
  episodeNumber,
  onBack,
  onEpisodeChange,
  onUpdateStatus,
  onUpdateProgress,
  settings,
}) => {
  return (
    <ReaderView
      manga={anime}
      initialChapterNumber={episodeNumber}
      onBack={onBack}
      onChapterChange={onEpisodeChange}
      onUpdateProgress={onUpdateProgress}
      onUpdateStatus={onUpdateStatus}
      settings={settings}
    />
  );
};
