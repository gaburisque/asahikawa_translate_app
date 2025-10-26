'use client';

import { Copy, Share2, Star, Volume2, TurtleIcon } from 'lucide-react';

interface TranslationCardProps {
  enText: string;
  jaText: string;
  isBookmarked: boolean;
  onCopy: () => void;
  onShare: () => void;
  onToggleBookmark: () => void;
  onPlay: () => void;
  onPlaySlow: () => void;
}

export default function TranslationCard({
  enText,
  jaText,
  isBookmarked,
  onCopy,
  onShare,
  onToggleBookmark,
  onPlay,
  onPlaySlow,
}: TranslationCardProps) {
  return (
    <div className="text-center space-y-3 px-4 relative">
      {/* Mini action bar (top right) */}
      <div className="absolute -top-2 right-4 flex items-center gap-2">
        <button
          onClick={onCopy}
          aria-label="コピー"
          className="p-2 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
          style={{ 
            color: 'rgba(126, 200, 255, 0.7)',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          <Copy size={18} />
        </button>
        
        <button
          onClick={onShare}
          aria-label="共有"
          className="p-2 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
          style={{ 
            color: 'rgba(126, 200, 255, 0.7)',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          <Share2 size={18} />
        </button>
        
        <button
          onClick={onToggleBookmark}
          aria-label={isBookmarked ? 'ブックマーク解除' : 'ブックマーク'}
          className="p-2 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
          style={{ 
            color: isBookmarked ? 'rgba(167, 139, 250, 1)' : 'rgba(126, 200, 255, 0.7)',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          <Star size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
        </button>
        
        <button
          onClick={onPlay}
          aria-label="再生"
          className="p-2 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
          style={{ 
            color: 'rgba(126, 200, 255, 0.7)',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          <Volume2 size={18} />
        </button>
        
        <button
          onClick={onPlaySlow}
          aria-label="ゆっくり再生"
          className="p-2 rounded-full transition-opacity hover:opacity-70 active:opacity-50"
          style={{ 
            color: 'rgba(126, 200, 255, 0.7)',
            minWidth: '44px',
            minHeight: '44px',
          }}
        >
          <TurtleIcon size={18} />
        </button>
      </div>

      {/* Original translation text (unchanged styles) */}
      <h2 className="text-[40px] sm:text-[48px] md:text-[56px] font-semibold leading-tight bg-gradient-to-r from-[#7EC8FF] to-[#A78BFA] bg-clip-text text-transparent">
        {enText}
      </h2>
      <p className="text-[22px] sm:text-[24px] md:text-[28px] leading-snug bg-gradient-to-r from-[#8ABCF8] to-[#B69CFF] bg-clip-text text-transparent">
        {jaText}
      </p>
    </div>
  );
}

