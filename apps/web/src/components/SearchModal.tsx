import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Code2, ChevronRight, X, Sparkles, Loader2 } from 'lucide-react';
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
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      className="flex items-start justify-center pt-20 px-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-[var(--border)] gap-3 bg-white">
          <Search className="w-5 h-5 text-[var(--accent-text)] shrink-0" />
          <input
            type="text"
            autoFocus
            aria-label="Tìm kiếm bài tập"
            placeholder="Gõ tên bài tập, slug, hoặc mã số..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {isSearching ? (
            <div className="py-8 text-center text-xs text-[var(--text-secondary)] font-bold flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-text)]" /> Đang tìm kiếm...
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
                className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors text-xs font-code border ${
                  selectedIndex === idx ? 'bg-[var(--accent)]/10 text-[var(--text-primary)] border-[var(--accent)]/20' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Code2 className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                  <div>
                    <div className="font-bold font-sans text-sm text-[var(--text-primary)]">{prob.title}</div>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-bold">/{prob.slug}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                          prob.difficulty === 'Easy'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : prob.difficulty === 'Medium'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {prob.difficulty === 'Easy' ? 'Dễ' : prob.difficulty === 'Medium' ? 'Trung bình' : 'Khó'}
                      </span>
                      {(prob.tags || []).map((t) => (
                        <span key={t} className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded font-medium border border-[var(--border)]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            ))
          ) : searchError ? (
            <div className="py-8 text-center text-xs text-red-600 font-semibold flex items-center justify-center gap-2">
              <span>Đã xảy ra lỗi khi tìm kiếm, vui lòng thử lại.</span>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
              {query.trim()
                ? `Không tìm thấy bài tập phù hợp với từ khóa "${query}"`
                : 'Gõ từ khóa để tìm kiếm bài tập trên hệ thống'}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-4 py-2.5 bg-[var(--bg-secondary)] border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-medium">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-[var(--border)] text-[var(--text-primary)] font-bold font-code">↑↓</kbd> Chọn</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-[var(--border)] text-[var(--text-primary)] font-bold font-code">Enter</kbd> Làm bài</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-[var(--border)] text-[var(--text-primary)] font-bold font-code">Esc</kbd> Đóng</span>
          </div>
          <span className="flex items-center gap-1 font-bold text-[var(--accent-text)] font-code">
            <Sparkles className="w-3 h-3" /> Supabase Quick Search
          </span>
        </div>
      </div>
    </div>
  );
}
