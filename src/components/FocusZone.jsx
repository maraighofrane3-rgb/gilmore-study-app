import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, BookOpen, Loader2, Link2, X } from 'lucide-react';

// 🎵 VERIFIED stable streams (user-tested working links)
const VERIFIED_STREAMS = {
  'lofi': { name: 'Lo-Fi Beats', icon: '☕', videoId: 'l-2hOKIrIyI' },
  'dark-academia': { name: 'Dark Academia', icon: '📜', videoId: 'Nt68FPL8evk' },
  '40hz-beats': { name: '40Hz Binary Beats', icon: '🧠', videoId: 'lkkGlVWvkLk' },
  'jazz': { name: 'Jazz', icon: '🎷', videoId: 'GBLcMvTFGyg' },
  'rain': { name: 'Rain Sounds', icon: '🌧️', videoId: 'F2w4BMKc3pw' },
};

// 🔗 Extract YouTube video ID or playlist ID from any URL format
function extractYouTubeId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return { type: 'video', id: trimmed };
  const playlistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] };
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return { type: 'video', id: match[1] };
  }
  return null;
}

// ✅ Race-free loader using the documented YT.ready() primitive (no global callback overwrite)
let ytLoadPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytLoadPromise) return ytLoadPromise;
  ytLoadPromise = new Promise((resolve) => {
    if (!document.querySelector('script[data-yt-iframe-api]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.setAttribute('data-yt-iframe-api', '1');
      document.head.appendChild(tag);
    }
    const tryReady = () => {
      if (window.YT && typeof window.YT.ready === 'function') {
        window.YT.ready(() => resolve(window.YT)); // fires only when Player is truly ready
      } else {
        setTimeout(tryReady, 50);
      }
    };
    tryReady();
  });
  return ytLoadPromise;
}

export default function FocusZone() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(30);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customUrl, setCustomUrl] = useState('');
  const [customSelection, setCustomSelection] = useState(null);

  const playerRef = useRef(null);
  const readyRef = useRef(false);     // ✅ gate: true only between onReady and destroy
  const hostRef = useRef(null);       // ✅ React-owned stable wrapper (no body leaks)
  const volumeRef = useRef(volume);
  const mutedRef = useRef(isMuted);

  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { mutedRef.current = isMuted; }, [isMuted]);

  // Restore last used selection
  useEffect(() => {
    const savedKey = localStorage.getItem('focus-zone-key');
    const savedCustom = localStorage.getItem('focus-zone-custom');
    const savedVolume = localStorage.getItem('focus-zone-volume');
    if (savedVolume) setVolume(parseInt(savedVolume));
    if (savedCustom) {
      try { setCustomSelection(JSON.parse(savedCustom)); } catch {}
    } else if (savedKey && VERIFIED_STREAMS[savedKey]) {
      setSelectedKey(savedKey);
    }
  }, []);

  const getCurrentSelection = () => {
    if (customSelection) return customSelection;
    if (selectedKey && VERIFIED_STREAMS[selectedKey]) {
      return { type: 'video', id: VERIFIED_STREAMS[selectedKey].videoId };
    }
    return null;
  };

  // ✅ Single source of truth for (re)building the player; destroys cleanly on null/switch
  useEffect(() => {
    let cancelled = false;
    const selection = getCurrentSelection();

    // Tear down whatever exists first (synchronously mark not-ready so no in-flight cmd hits a dying iframe)
    readyRef.current = false;
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }
    if (hostRef.current) hostRef.current.innerHTML = ''; // remove orphaned iframe/node

    if (!selection) {
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;

      // Unmanaged child node the API will swap for its iframe — React never reconciles it
      const child = document.createElement('div');
      hostRef.current.appendChild(child);

      const config = {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          loop: 1,
          enablejsapi: 1,
          origin: window.location.origin, // ✅ tells the widget API the real parent origin (kills localhost mismatch)
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            readyRef.current = true;                 // ✅ commands now allowed
            const t = event.target;
            try {
              t.setVolume(mutedRef.current ? 0 : volumeRef.current);
              if (mutedRef.current) t.mute();
              t.playVideo();
            } catch {}
            setIsLoading(false);
            setIsPlaying(true);
          },
          onStateChange: (event) => {
            // ✅ ignore events from a player we already replaced/destroyed
            if (event.target !== playerRef.current || !readyRef.current) return;
            const PS = window.YT?.PlayerState;
            if (!PS) return;
            if (event.data === PS.ENDED && selection.type === 'video') {
              try { event.target.seekTo(0); event.target.playVideo(); } catch {}
            } else if (event.data === PS.BUFFERING) {
              setIsLoading(true);
            } else if (event.data === PS.PLAYING) {
              setIsLoading(false);
              setIsPlaying(true);
            } else if (event.data === PS.PAUSED) {
              setIsPlaying(false);
            }
          },
          onError: (event) => {
            console.error('YouTube player error:', event.data);
            readyRef.current = false;
            setIsLoading(false);
            setError('Could not load this track. It may be private, region-locked, or have embedding disabled. Try another.');
            setIsPlaying(false);
          },
        },
      };

      if (selection.type === 'playlist') {
        config.playerVars.listType = 'playlist';
        config.playerVars.list = selection.id;
      } else {
        config.videoId = selection.id;
        config.playerVars.playlist = selection.id; // loop trick
      }

      playerRef.current = new YT.Player(child, config);
    });

    return () => { cancelled = true; };
  }, [selectedKey, customSelection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      readyRef.current = false;
      if (playerRef.current) { try { playerRef.current.destroy(); } catch {} }
      playerRef.current = null;
    };
  }, []);

  // ✅ Every external command goes through this gate — no more postMessage-to-wrong-origin
  const cmd = (fn) => {
    if (!readyRef.current || !playerRef.current) return;
    try { fn(playerRef.current); } catch (e) { console.warn('YT cmd skipped:', e?.message); }
  };

  const selectVerified = (key) => {
    setError(null);
    if (selectedKey === key) {
      setSelectedKey(null);
      setCustomSelection(null);
      localStorage.removeItem('focus-zone-key');
      localStorage.removeItem('focus-zone-custom');
    } else {
      setSelectedKey(key);
      setCustomSelection(null);
      localStorage.setItem('focus-zone-key', key);
      localStorage.removeItem('focus-zone-custom');
    }
  };

  const submitCustomUrl = (e) => {
    e?.preventDefault();
    const extracted = extractYouTubeId(customUrl);
    if (!extracted) { setError('Invalid YouTube URL. Paste a video or playlist link.'); return; }
    setError(null);
    const newSelection = {
      type: extracted.type,
      id: extracted.id,
      name: extracted.type === 'playlist' ? 'Your Playlist' : 'Your Track',
    };
    setCustomSelection(newSelection);
    setSelectedKey(null);
    localStorage.setItem('focus-zone-custom', JSON.stringify(newSelection));
    localStorage.removeItem('focus-zone-key');
    setCustomUrl('');
  };

  const clearCustom = () => {
    setCustomSelection(null);
    localStorage.removeItem('focus-zone-custom');
  };

  const togglePlay = () => cmd((p) => {
    if (isPlaying) { p.pauseVideo(); setIsPlaying(false); }
    else { p.playVideo(); setIsPlaying(true); }
  });

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    localStorage.setItem('focus-zone-volume', String(newVolume));
    cmd((p) => {
      p.setVolume(newVolume);
      if (newVolume > 0 && isMuted) { p.unMute(); setIsMuted(false); }
    });
  };

  const toggleMute = () => cmd((p) => {
    if (isMuted) { p.unMute(); p.setVolume(volume); setIsMuted(false); }
    else { p.mute(); setIsMuted(true); }
  });

  const currentSelection = getCurrentSelection();
  const currentName = currentSelection
    ? (customSelection?.name || (selectedKey ? VERIFIED_STREAMS[selectedKey].name : 'Custom'))
    : null;

  return (
    <>
      {/* ✅ Hidden, React-owned player host — persists across expand/collapse; no body leaks */}
      <div
        ref={hostRef}
        aria-hidden="true"
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' }}
      />

      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="fixed bottom-6 right-6 z-40 bg-yale-blue text-page-cream px-4 py-3 rounded-full shadow-cozy hover:bg-maple-rust transition-all flex items-center gap-2 group"
        >
          <Music size={20} className={currentSelection && isPlaying ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'} />
          <span className="font-label text-xs uppercase tracking-wider">
            {currentSelection && isPlaying ? 'Playing' : 'Focus Zone'}
          </span>
        </button>
      ) : (
        <div className="fixed bottom-6 right-6 z-40 w-80 bg-parchment border border-coffee-cream/30 rounded-sm shadow-cozy animate-fade-in-up max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-coffee-cream/20 sticky top-0 bg-parchment z-10">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-maple-rust" />
              <h3 className="font-display text-lg text-yale-blue">Focus Zone</h3>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-coffee-cream hover:text-maple-rust transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Curated Streams */}
          <div className="p-4 space-y-2">
            <p className="font-body text-xs text-coffee-cream mb-3 font-semibold uppercase tracking-wider">
              Curated streams
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(VERIFIED_STREAMS).map(([key, stream]) => (
                <button
                  key={key}
                  onClick={() => selectVerified(key)}
                  className={`p-3 rounded-sm border transition-all ${
                    selectedKey === key
                      ? 'bg-maple-rust text-page-cream border-maple-rust'
                      : 'bg-page-cream border-coffee-cream/20 hover:border-maple-rust text-library-ink'
                  }`}
                >
                  <div className="text-2xl mb-1">{stream.icon}</div>
                  <div className="font-label text-[0.65rem] uppercase tracking-wider">{stream.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom YouTube URL */}
          <div className="p-4 border-t border-coffee-cream/20 space-y-2">
            <p className="font-body text-xs text-coffee-cream font-semibold uppercase tracking-wider flex items-center gap-1">
              <Link2 size={12} /> Your YouTube link
            </p>
            {customSelection ? (
              <div className="bg-page-cream p-3 rounded-sm border border-maple-rust/30 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs text-library-ink truncate">
                    {customSelection.type === 'playlist' ? '🎵 Playlist' : '🎶 Track'}
                  </p>
                  <p className="font-body text-[0.6rem] text-coffee-cream truncate font-mono">{customSelection.id}</p>
                </div>
                <button onClick={clearCustom} className="text-coffee-cream hover:text-maple-rust transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <form onSubmit={submitCustomUrl} className="space-y-2">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Paste YouTube URL or playlist..."
                  className="w-full p-2.5 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-xs"
                />
                <button
                  type="submit"
                  disabled={!customUrl.trim()}
                  className="w-full bg-yale-blue text-page-cream px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Load
                </button>
              </form>
            )}
            <p className="font-body text-[0.6rem] text-coffee-cream italic">
              Works with videos, live streams, and playlists (PL...)
            </p>
          </div>

          {/* Player Controls */}
          {currentSelection && (
            <div className="p-4 border-t border-coffee-cream/20 space-y-3 bg-page-cream/30">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-library-ink truncate">{currentName}</p>
                  <p className="font-body text-xs text-coffee-cream">
                    {isPlaying ? '▶ Playing (looping)' : isLoading ? 'Loading...' : 'Paused'}
                  </p>
                </div>
                {isLoading && <Loader2 size={16} className="animate-spin text-coffee-cream" />}
              </div>

              {error && (
                <div className="bg-maple-rust/10 border border-maple-rust/30 p-2 rounded-sm">
                  <p className="font-body text-xs text-maple-rust">{error}</p>
                </div>
              )}

              <button
                onClick={togglePlay}
                disabled={isLoading || !readyRef.current}
                className="w-full flex items-center justify-center gap-2 bg-yale-blue text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50"
              >
                {isPlaying ? (<><Pause size={16} /> Pause</>) : (<><Play size={16} /> Play</>)}
              </button>

              <div className="flex items-center gap-2">
                <button onClick={toggleMute} className="text-coffee-cream hover:text-maple-rust transition-colors">
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="flex-1 h-1 bg-coffee-cream/30 rounded-full appearance-none cursor-pointer accent-maple-rust"
                />
                <span className="font-body text-xs text-coffee-cream w-8 text-right">{isMuted ? 0 : volume}%</span>
              </div>
            </div>
          )}

          <div className="p-3 bg-page-cream/50 border-t border-coffee-cream/20 rounded-b-sm">
            <p className="font-body text-[0.65rem] text-coffee-cream text-center italic">
              Audio only • Video hidden • Loops automatically
            </p>
          </div>
        </div>
      )}
    </>
  );
}