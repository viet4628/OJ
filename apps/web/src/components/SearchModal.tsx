import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MorphIcon from './MorphIcon';
import { Code2 as Code2Data, ChevronRight as ChevronRightData, X as XData, Loader2 as Loader2Data } from 'lucide';
import { searchProblems, type Problem } from '../lib/api';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<Problem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      setSearchError(false);
      try {
        const data = await searchProblems(query.trim());
        setResults(data);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
        setSearchError(true);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (results.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + (results.length || 1)) % (results.length || 1));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        navigate(`/problems/${results[selectedIndex].slug}`);
        onClose();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, navigate, onClose]);

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      className="flex items-start justify-center pt-20 px-4 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-secondary)] border border-[var(--border)] rounded-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-3.5 py-2.5 border-b border-[var(--border)] gap-2.5 bg-[var(--bg-primary)]">

          <input
            type="text"
            autoFocus
            aria-label="Tìm kiếm bài tập"
            placeholder="Gõ tên bài tập, slug, hoặc mã số..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
          >
            <MorphIcon icon={XData} size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5 space-y-0.5">
          {isSearching ? (
            <div className="py-8 text-center text-xs text-[var(--text-secondary)] flex items-center justify-center gap-2">
              <MorphIcon icon={Loader2Data} size={14} className="animate-spin text-[var(--accent-text)]" /> Đang tìm kiếm...
            </div>
          ) : results.length > 0 ? (
            results.map((prob, idx) => (
              <button
                key={prob.id}
                onClick={() => {
                  navigate(`/problems/${prob.slug}`);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between p-2.5 rounded-md text-left transition-colors text-xs border ${
                  selectedIndex === idx ? 'bg-[var(--accent)]/10 text-[var(--text-primary)] border-[var(--accent)]/30' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MorphIcon icon={Code2Data} size={14} className="text-[var(--accent-text)] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-xs text-[var(--text-primary)] truncate">{prob.title}</div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">/{prob.slug}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.2 rounded font-mono border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                      >
                        {prob.difficulty === 'Easy' ? 'Dễ' : prob.difficulty === 'Medium' ? 'Trung bình' : 'Khó'}
                      </span>
                      {(prob.tags || []).slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.2 rounded font-mono border border-[var(--border)]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <MorphIcon icon={ChevronRightData} size={12} className="text-[var(--text-muted)] shrink-0" />
              </button>
            ))
          ) : searchError ? (
            <div className="py-8 text-center text-xs text-[var(--danger)] flex items-center justify-center gap-2">
              <span>Đã xảy ra lỗi khi tìm kiếm, vui lòng thử lại.</span>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              {query.trim()
                ? `Không tìm thấy bài tập phù hợp với từ khóa "${query}"`
                : 'Gõ từ khóa để tìm kiếm bài tập trên hệ thống'}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-3.5 py-2 bg-[var(--bg-tertiary)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
          <div className="flex items-center gap-2.5">
            <span><kbd className="px-1 py-0.2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">↑↓</kbd> Chọn</span>
            <span><kbd className="px-1 py-0.2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">Enter</kbd> Mở</span>
            <span><kbd className="px-1 py-0.2 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)]">Esc</kbd> Đóng</span>
          </div>
        </div>
      </div>
    </div>
  );
}
