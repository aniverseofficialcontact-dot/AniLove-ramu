import React, { useState, useMemo } from 'react';
import { Download, Check, X, Film, CheckSquare, Square, HardDrive, AlertCircle } from 'lucide-react';
import { Anime, Episode } from '../types';
import { StreamLanguage, STREAM_PROVIDERS, SUPPORTED_LANGUAGES } from '../services/streamingProviders';
import { queueBatchEpisodeDownloads, isEpisodeDownloaded } from '../services/downloadManager';

interface BatchDownloadModalProps {
  anime: Anime;
  episodes: Episode[];
  currentEpisodeNumber: number;
  initialAudio?: StreamLanguage;
  initialServer?: string;
  onClose: () => void;
  onOpenDownloadsView?: () => void;
}

export const BatchDownloadModal: React.FC<BatchDownloadModalProps> = ({
  anime,
  episodes,
  currentEpisodeNumber,
  initialAudio = 'DUB',
  initialServer = 'Anikoto HD-1',
  onClose,
  onOpenDownloadsView,
}) => {
  const [selectedAudio, setSelectedAudio] = useState<StreamLanguage>(initialAudio);
  const [selectedServer, setSelectedServer] = useState<string>(initialServer);
  const [selectedEpNumbers, setSelectedEpNumbers] = useState<Set<number>>(() => {
    return new Set([currentEpisodeNumber]);
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const displayTitle =
    anime.title?.english || anime.title?.romaji || anime.title?.userPreferred || 'Anime';

  const toggleEpisode = (epNum: number) => {
    setSelectedEpNumbers(prev => {
      const next = new Set(prev);
      if (next.has(epNum)) {
        next.delete(epNum);
      } else {
        next.add(epNum);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedEpNumbers.size === episodes.length) {
      setSelectedEpNumbers(new Set());
    } else {
      setSelectedEpNumbers(new Set(episodes.map(e => e.number)));
    }
  };

  const handleSelectRange = (count: number) => {
    const sorted = [...episodes].sort((a, b) => a.number - b.number);
    const startIdx = sorted.findIndex(e => e.number === currentEpisodeNumber);
    const fromIdx = startIdx >= 0 ? startIdx : 0;
    const slice = sorted.slice(fromIdx, fromIdx + count);
    setSelectedEpNumbers(new Set(slice.map(e => e.number)));
  };

  const handleStartDownloads = async () => {
    if (selectedEpNumbers.size === 0) return;
    setIsSubmitting(true);
    setResultMessage(null);

    const targetEpisodes = episodes.filter(e => selectedEpNumbers.has(e.number));

    const res = await queueBatchEpisodeDownloads(
      anime,
      targetEpisodes,
      selectedAudio,
      selectedServer,
      '1080p'
    );

    setIsSubmitting(false);

    if (res.queuedCount > 0) {
      setResultMessage(
        `Successfully queued ${res.queuedCount} episode(s) for background download!`
      );
      setTimeout(() => {
        onClose();
        if (onOpenDownloadsView) onOpenDownloadsView();
      }, 1200);
    } else {
      setResultMessage(`Could not start download: ${res.errors[0] || 'Unknown error'}`);
    }
  };

  // Estimated storage (approx 220MB per 1080p episode)
  const estimatedMB = selectedEpNumbers.size * 220;
  const estimatedStr =
    estimatedMB >= 1024 ? `${(estimatedMB / 1024).toFixed(1)} GB` : `${estimatedMB} MB`;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0d1017] border border-neutral-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Download Episodes</h3>
              <p className="text-xs text-neutral-400 truncate max-w-[240px] sm:max-w-xs">
                {displayTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audio & Server Selectors */}
        <div className="p-4 bg-[#121622] border-b border-neutral-800/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-neutral-300">Audio Language</span>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {SUPPORTED_LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedAudio(lang.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1 ${
                    selectedAudio === lang.code
                      ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                      : 'bg-[#090b10] border border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300">Server Source</span>
            <select
              value={selectedServer}
              onChange={e => setSelectedServer(e.target.value)}
              className="bg-[#090b10] border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {STREAM_PROVIDERS.map(p => (
                <option key={p.id} value={p.serverMatch || p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Batch Selection Helpers */}
        <div className="px-4 py-2.5 bg-[#0e111a] border-b border-neutral-800/60 flex items-center justify-between text-xs">
          <button
            onClick={handleSelectAll}
            className="flex items-center gap-1.5 text-neutral-300 hover:text-white font-semibold transition cursor-pointer"
          >
            {selectedEpNumbers.size === episodes.length ? (
              <CheckSquare className="w-4 h-4 text-indigo-400" />
            ) : (
              <Square className="w-4 h-4 text-neutral-500" />
            )}
            <span>Select All ({episodes.length})</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500 text-[11px]">Quick:</span>
            {[3, 5, 10].map(cnt => (
              <button
                key={cnt}
                onClick={() => handleSelectRange(cnt)}
                className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold transition"
              >
                Next {cnt}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Episode List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 divide-y divide-neutral-800/40">
          {episodes.map(ep => {
            const isSelected = selectedEpNumbers.has(ep.number);
            const isDownloaded = isEpisodeDownloaded(anime.id, ep.number);

            return (
              <div
                key={ep.number}
                onClick={() => !isDownloaded && toggleEpisode(ep.number)}
                className={`pt-2 flex items-center justify-between p-2 rounded-xl transition cursor-pointer select-none ${
                  isSelected
                    ? 'bg-indigo-950/30 border border-indigo-500/40'
                    : 'hover:bg-neutral-800/40'
                } ${isDownloaded ? 'opacity-60 cursor-default' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-5 h-5 flex items-center justify-center">
                    {isDownloaded ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : isSelected ? (
                      <CheckSquare className="w-5 h-5 text-indigo-400" />
                    ) : (
                      <Square className="w-5 h-5 text-neutral-600" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">EP {ep.number}</span>
                      {ep.filler && (
                        <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[9px] font-black">
                          FILLER
                        </span>
                      )}
                      {isDownloaded && (
                        <span className="text-[10px] text-emerald-400 font-bold">Downloaded</span>
                      )}
                    </div>
                    {ep.title && (
                      <p className="text-[11px] text-neutral-400 truncate max-w-[260px] sm:max-w-sm">
                        {ep.title}
                      </p>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-neutral-500 font-mono shrink-0">~220 MB</span>
              </div>
            );
          })}
        </div>

        {/* Footer & Action Button */}
        <div className="p-4 bg-[#111420] border-t border-neutral-800/80 space-y-2.5">
          {resultMessage && (
            <div className="p-2.5 rounded-xl bg-indigo-900/40 border border-indigo-500/40 text-indigo-200 text-xs text-center font-semibold animate-fadeIn">
              {resultMessage}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-neutral-500" />
              Est. space: <strong className="text-neutral-200">{estimatedStr}</strong>
            </span>
            <span>
              Selected: <strong className="text-white">{selectedEpNumbers.size}</strong> episodes
            </span>
          </div>

          <button
            onClick={handleStartDownloads}
            disabled={selectedEpNumbers.size === 0 || isSubmitting}
            className={`w-full py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg ${
              selectedEpNumbers.size === 0 || isSubmitting
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 cursor-pointer active:scale-[0.98]'
            }`}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>
              {isSubmitting
                ? 'Queueing Episodes...'
                : `Download ${selectedEpNumbers.size} Episode${selectedEpNumbers.size === 1 ? '' : 's'}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
