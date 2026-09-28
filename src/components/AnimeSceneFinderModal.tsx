import React, { useState, useRef } from 'react';

interface TraceMoeResult {
  filename: string;
  episode: number | string;
  similarity: number;
  from: number;
  to: number;
  video: string;
  image: string;
  anilist: {
    id: number;
    title: {
      native: string;
      romaji: string;
      english: string;
    };
    isAdult: boolean;
  };
}

interface AnimeSceneFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAnime?: (animeId: number) => void;
  onShowToast?: (type: 'info' | 'success' | 'warning' | 'sync', msg: string, title?: string) => void;
}

export const AnimeSceneFinderModal: React.FC<AnimeSceneFinderModalProps> = ({
  isOpen,
  onClose,
  onSelectAnime,
  onShowToast,
}) => {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TraceMoeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSearchTraceMoe = async () => {
    if (!selectedImage) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const res = await fetch('https://api.trace.moe/search?anilistInfo', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`trace.moe error (${res.status})`);
      }

      const data = await res.json();
      if (data && Array.isArray(data.result) && data.result.length > 0) {
        setResult(data.result[0]);
        if (onShowToast) {
          onShowToast('success', 'Anime Scene Identified!', 'trace.moe Match');
        }
      } else {
        setError('No anime match found for this screenshot.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search trace.moe. Check your network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setResult(null);
    setError(null);
  };

  const title = result?.anilist?.title?.english || result?.anilist?.title?.romaji || result?.anilist?.title?.native || 'Unknown Anime';
  const similarityPct = result ? (result.similarity * 100).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-lg">
              🔍
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">Anime Scene Finder</h3>
              <p className="text-xs text-slate-400">Powered by trace.moe AI Scene Recognition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {!imagePreview ? (
            <div className="border-2 border-dashed border-slate-700/80 rounded-xl p-8 text-center flex flex-col items-center justify-center bg-slate-950/30 gap-4">
              <div className="w-16 h-16 rounded-full bg-pink-500/10 text-pink-400 flex items-center justify-center text-3xl">
                📷
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Upload or Capture Screenshot</p>
                <p className="text-xs text-slate-400 mt-1">Select an anime scene image from social media or take a picture</p>
              </div>

              <div className="flex flex-wrap gap-3 justify-center w-full mt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
                >
                  🖼️ Pick from Gallery
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-medium text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
                >
                  📸 Take Photo
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview Card */}
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black/60 max-h-56 flex items-center justify-center">
                <img src={imagePreview} alt="Selected Frame" className="max-h-56 object-contain" />
                <button
                  onClick={handleReset}
                  className="absolute top-2 right-2 bg-black/70 text-slate-200 hover:text-white px-2.5 py-1 rounded-lg text-xs backdrop-blur-md border border-slate-700/50"
                >
                  Change Photo
                </button>
              </div>

              {!result && !isLoading && (
                <button
                  onClick={handleSearchTraceMoe}
                  className="w-full py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all"
                >
                  ✨ Search Scene with trace.moe
                </button>
              )}

              {isLoading && (
                <div className="p-6 bg-slate-950/50 rounded-xl border border-slate-800 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium text-pink-300 animate-pulse">Scanning 30,000+ anime episodes...</p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs text-center">
                  ⚠️ {error}
                </div>
              )}

              {/* Match Result Card */}
              {result && (
                <div className="bg-slate-950/80 border border-pink-500/30 rounded-xl p-4 space-y-3 animate-fadeIn shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-[10px] border border-emerald-500/30 mb-1">
                        {similarityPct}% Match
                      </span>
                      <h4 className="text-white font-bold text-base leading-snug">{title}</h4>
                      {result.anilist?.title?.romaji && result.anilist.title.romaji !== title && (
                        <p className="text-xs text-slate-400">{result.anilist.title.romaji}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-2 px-3 bg-slate-900/60 rounded-lg text-xs border border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Episode</span>
                      <span className="text-white font-semibold">Episode {result.episode}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Timestamp</span>
                      <span className="text-white font-semibold">{formatTimestamp(result.from)} - {formatTimestamp(result.to)}</span>
                    </div>
                  </div>

                  {result.video && (
                    <div className="rounded-lg overflow-hidden border border-slate-800 bg-black">
                      <video
                        src={result.video}
                        controls
                        autoPlay
                        loop
                        muted
                        className="w-full h-36 object-contain"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {result.anilist?.id && (
                      <button
                        onClick={() => {
                          if (onSelectAnime) onSelectAnime(result.anilist.id);
                          onClose();
                        }}
                        className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-1.5 transition-all"
                      >
                        🎬 Watch Scene Now
                      </button>
                    )}
                    <button
                      onClick={handleReset}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
                    >
                      🔄 Search Another Photo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
