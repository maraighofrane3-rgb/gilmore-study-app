import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, BookOpen, Loader2, Link2, X } from 'lucide-react';

// 🎵 VERIFIED stable streams (user-tested working links)
const VERIFIED_STREAMS = {
  'lofi': {
    name: 'Lo-Fi Beats',
    icon: '☕',
    videoId: 'l-2hOKIrIyI',
  },
  'dark-academia': {
    name: 'Dark Academia',
    icon: '📜',
    videoId: 'Nt68FPL8evk',
  },
  '40hz-beats': {
    name: '40Hz Binary Beats',
    icon: '🧠',
    videoId: 'lkkGlVWvkLk',
  },
  'jazz': {
    name: 'Jazz',
    icon: '🎷',
    videoId: 'GBLcMvTFGyg',
  },
  'rain': {
    name: 'Rain Sounds',
    icon: '🌧️',
    videoId: 'F2w4BMKc3pw',
  },
};

// 🔗 Extract YouTube video ID or playlist ID from any URL format
function extractYouTubeId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  
  // Direct video ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return { type: 'video', id: trimmed };
  }
  
  // Playlist ID (starts with PL, UU, LL, FL, etc.)
  const playlistMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (playlistMatch) {
    return { type: 'playlist', id: playlistMatch[1] };
  }
  
  // Standard video URL formats
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

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);

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

  // Build player config based on selection
  const getCurrentSelection = () => {
    if (customSelection) return customSelection;
    if (selectedKey && VERIFIED_STREAMS[selectedKey]) {
      return { type: 'video', id: VERIFIED_STREAMS[selectedKey].videoId };
    }
    return null;
  };

  // Initialize YouTube player
  useEffect(() => {
    const selection = getCurrentSelection();
    if (!selection) return;
    
    if (!window.YT || !window.YT.Player) {
      window.onYouTubeIframeAPIReady = () => createPlayer(selection);
      return;
    }
    createPlayer(selection);
  }, [selectedKey, customSelection]);

  const createPlayer = (selection) => {
    if (!window.YT || !window.YT.Player) return;
    setIsLoading(true);
    setError(null);

    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }

    // Create a container div for the player
    const containerId = `yt-player-${Date.now()}`;
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(container);
    }

    const playerConfig = {
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
        showinfo: 0,
        loop: 1,
      },
      events: {
        onReady: (event) => {
          setIsLoading(false);
          event.target.setVolume(isMuted ? 0 : volume);
          if (isMuted) event.target.mute();
          event.target.playVideo();
          setIsPlaying(true);
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            // Fallback loop for single videos
            if (selection.type === 'video') {
              event.target.seekTo(0);
              event.target.playVideo();
            }
          }
          if (event.data === window.YT.PlayerState.BUFFERING) {
            setIsLoading(true);
          } else if (event.data === window.YT.PlayerState.PLAYING) {
            setIsLoading(false);
            setIsPlaying(true);
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          }
        },
        onError: (event) => {
          console.error('YouTube player error:', event.data);
          setIsLoading(false);
          setError('Could not load this track. It may be private, region-locked, or have embedding disabled. Try another.');
          setIsPlaying(false);
        },
      },
    };

    // Add videoId or list based on selection type
    if (selection.type === 'playlist') {
      playerConfig.playerVars.listType = 'playlist';
      playerConfig.playerVars.list = selection.id;
    } else {
      // For single videos, set playlist to the same videoId to enable looping
      playerConfig.videoId = selection.id;
      playerConfig.playerVars.playlist = selection.id;
    }

    playerRef.current = new window.YT.Player(containerId, playerConfig);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
      }
    };
  }, []);

  const stopPlayback = () => {
    if (playerRef.current) {
      try { playerRef.current.stopVideo(); } catch {}
    }
    setIsPlaying(false);
  };

  const selectVerified = (key) => {
    setError(null);
    if (selectedKey === key) {
      setSelectedKey(null);
      setCustomSelection(null);
      stopPlayback();
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
    if (!extracted) {
      setError('Invalid YouTube URL. Paste a video or playlist link.');
      return;
    }
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
    stopPlayback();
    localStorage.removeItem('focus-zone-custom');
  };

  const togglePlay = () => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error('Toggle play error:', e);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    localStorage.setItem('focus-zone-volume', String(newVolume));
    if (playerRef.current) {
      try {
        playerRef.current.setVolume(newVolume);
        if (newVolume > 0 && isMuted) {
          playerRef.current.unMute();
          setIsMuted(false);
        }
      } catch {}
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch {}
  };

  const currentSelection = getCurrentSelection();
  const currentName = currentSelection
    ? (customSelection?.name || (selectedKey ? VERIFIED_STREAMS[selectedKey].name : 'Custom'))
    : null;

  if (!isExpanded) {
    const showMini = currentSelection && isPlaying;
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-6 right-6 z-40 bg-yale-blue text-page-cream px-4 py-3 rounded-full shadow-cozy hover:bg-maple-rust transition-all flex items-center gap-2 group"
      >
        <Music size={20} className={showMini ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'} />
        <span className="font-label text-xs uppercase tracking-wider">
          {showMini ? 'Playing' : 'Focus Zone'}
        </span>
      </button>
    );
  }

  return (
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
              <div className="font-label text-[0.65rem] uppercase tracking-wider">
                {stream.name}
              </div>
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
              <p className="font-body text-[0.6rem] text-coffee-cream truncate font-mono">
                {customSelection.id}
              </p>
            </div>
            <button
              onClick={clearCustom}
              className="text-coffee-cream hover:text-maple-rust transition-colors flex-shrink-0"
            >
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
              <p className="font-body text-sm font-medium text-library-ink truncate">
                {currentName}
              </p>
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
            disabled={isLoading || !playerRef.current}
            className="w-full flex items-center justify-center gap-2 bg-yale-blue text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50"
          >
            {isPlaying ? (
              <><Pause size={16} /> Pause</>
            ) : (
              <><Play size={16} /> Play</>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-coffee-cream hover:text-maple-rust transition-colors"
            >
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
            <span className="font-body text-xs text-coffee-cream w-8 text-right">
              {isMuted ? 0 : volume}%
            </span>
          </div>
        </div>
      )}

      <div className="p-3 bg-page-cream/50 border-t border-coffee-cream/20 rounded-b-sm">
        <p className="font-body text-[0.65rem] text-coffee-cream text-center italic">
          Audio only • Video hidden • Loops automatically
        </p>
      </div>
    </div>
  );
}