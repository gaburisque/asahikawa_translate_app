// History and Bookmark display panel
import React, { useState, useEffect } from 'react';
import { X, Trash2, Star, Clock, Bookmark, Volume2 } from 'lucide-react';
import { getHistory, getBookmarks, deleteHistoryItem, clearHistory, type TranslationItem } from '@/lib/storage';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (item: TranslationItem) => void;
  onPlayTTS: (text: string, lang: 'ja' | 'en', speed: number) => void;
  currentView: 'history' | 'bookmarks';
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  onSelectItem,
  onPlayTTS,
  currentView,
}) => {
  const [items, setItems] = useState<TranslationItem[]>([]);
  const [view, setView] = useState<'history' | 'bookmarks'>(currentView);
  const [mounted, setMounted] = useState(false);
  const isInteractingRef = React.useRef(false);
  const firstFocusableRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setView(currentView);
  }, [currentView]);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, view]);

  // Mount flag for animation
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Focus first focusable element
      setTimeout(() => {
        firstFocusableRef.current?.focus();
      }, 200);
    } else {
      // Delay unmount to allow animation
      const timer = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Esc key to close
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadItems = () => {
    const data = view === 'history' ? getHistory() : getBookmarks();
    setItems(data);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('この項目を削除しますか？')) {
      deleteHistoryItem(id);
      loadItems();
    }
  };

  const handleClearAll = () => {
    if (confirm('すべての履歴を削除しますか？')) {
      clearHistory();
      loadItems();
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'たった今';
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  // Handle overlay click - only close if clicking the overlay itself
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isInteractingRef.current) {
      onClose();
    }
  };

  // Prevent closing when interacting with panel content
  const handlePanelMouseDown = () => {
    isInteractingRef.current = true;
  };

  const handlePanelMouseUp = () => {
    // Delay reset to allow click event to complete
    setTimeout(() => {
      isInteractingRef.current = false;
    }, 50);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black z-40"
        onClick={handleOverlayClick}
        role="presentation"
        style={{
          opacity: isOpen ? 0.5 : 0,
          transition: 'opacity 200ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          willChange: 'opacity',
        }}
      />

      {/* Panel */}
      <div 
        className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col"
        onMouseDown={handlePanelMouseDown}
        onMouseUp={handlePanelMouseUp}
        role="dialog"
        aria-modal="true"
        aria-label={view === 'history' ? '履歴' : 'ブックマーク'}
        data-mounted={mounted}
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          willChange: 'transform, opacity',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-500 to-purple-500 text-white">
          <div className="flex items-center gap-2">
            {view === 'history' ? <Clock size={20} /> : <Bookmark size={20} />}
            <h2 className="text-lg font-semibold">
              {view === 'history' ? '履歴' : 'ブックマーク'}
            </h2>
          </div>
          <button
            ref={firstFocusableRef}
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b">
          <button
            onClick={() => setView('history')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              view === 'history'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock size={16} className="inline mr-1" />
            履歴
          </button>
          <button
            onClick={() => setView('bookmarks')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              view === 'bookmarks'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bookmark size={16} className="inline mr-1" />
            ブックマーク
          </button>
        </div>

        {/* Items list */}
        <div 
          className="flex-1 p-4 space-y-3"
          onClick={(e) => e.stopPropagation()}
          style={{
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
          }}
        >
          {items.length === 0 ? (
            <div className="text-center text-gray-400 mt-12">
              <p className="text-sm">
                {view === 'history' ? '履歴がありません' : 'ブックマークがありません'}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 cursor-pointer transition-colors relative group"
                onClick={() => {
                  onSelectItem(item);
                  onClose();
                }}
              >
                {/* Timestamp */}
                <div className="text-xs text-gray-400 mb-2 flex items-center justify-between">
                  <span>{formatTimestamp(item.timestamp)}</span>
                  <div className="flex items-center gap-1">
                    {item.isBookmarked && (
                      <Star size={12} className="text-yellow-500" fill="currentColor" />
                    )}
                  </div>
                </div>

                {/* Original text */}
                <div className="text-sm text-gray-700 mb-1">
                  <span className="text-xs text-gray-500 uppercase mr-1">
                    {item.originalLang}:
                  </span>
                  {item.originalText}
                </div>

                {/* Translated text */}
                <div className="text-sm text-blue-600 font-medium">
                  <span className="text-xs text-gray-500 uppercase mr-1">
                    {item.targetLang}:
                  </span>
                  {item.translatedText}
                </div>

                {/* Actions (shown on hover) */}
                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayTTS(item.translatedText, item.targetLang, 1.0);
                    }}
                    className="p-1 bg-white rounded-full shadow hover:bg-blue-50 transition-colors"
                    aria-label="再生"
                  >
                    <Volume2 size={14} />
                  </button>
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="p-1 bg-white rounded-full shadow hover:bg-red-50 transition-colors"
                    aria-label="削除"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {view === 'history' && items.length > 0 && (
          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={handleClearAll}
              className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              すべての履歴を削除
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default HistoryPanel;

