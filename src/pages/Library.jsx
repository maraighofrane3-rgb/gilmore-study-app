import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Plus, BookOpen, Trash2, AlertCircle, Search, FileText,
  CheckCircle, Clock, X, BookMarked, TrendingUp
} from 'lucide-react';
// ❌ Removed ResearchAssistant (it now lives inside BookDetail)
import BookDetail from '../components/BookDetail';
import ConfirmDialog from '../components/ConfirmDialog';

const TABS = [
  { id: 'currently_reading', label: 'Currently Reading', icon: Clock },
  { id: 'want_to_read', label: 'Want to Read', icon: BookMarked },
  { id: 'read', label: 'Read', icon: CheckCircle },
  { id: 'abandoned', label: 'Abandoned', icon: X },
];

const GENRES = [
  'Fiction', 'Non-Fiction', 'Classic', 'Philosophy', 'History',
  'Science', 'Biography', 'Poetry', 'Self-Help', 'Other'
];

const EMPTY_NEW_BOOK = {
  title: '',
  author: '',
  genre: 'Fiction',
  total_pages: '',
  current_page: '',
  cover_color: '#132A44'
};

// Extracted and memoized so a status/search change on one card
// doesn't force every other card in the grid to re-render.
const BookCard = memo(function BookCard({ book, index, onSelect, onStatusChange, onDelete }) {
  const progress = book.total_pages && book.current_page
    ? Math.round((book.current_page / book.total_pages) * 100)
    : null;

  return (
    <div
      className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 shadow-cozy flex flex-col justify-between animate-fade-in-up group hover:border-maple-rust/50 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 20) * 0.05}s` }}
      onClick={() => onSelect(book)}
    >
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: book.cover_color || '#132A44' }}
      />

      {book.pdf_url && (
        <div className="absolute top-3 right-3 bg-maple-rust text-page-cream px-2 py-1 rounded-sm flex items-center gap-1">
          <FileText size={10} />
          <span className="font-label text-[0.6rem] uppercase tracking-wider">PDF</span>
        </div>
      )}

      <div className="pt-2">
        {book.genre && (
          <span className="inline-block mb-2 px-2 py-0.5 bg-yale-blue/10 text-yale-blue font-label text-[0.6rem] uppercase tracking-wider rounded-sm">
            {book.genre}
          </span>
        )}
        <h3 className="font-display text-xl text-yale-blue leading-tight mb-1 group-hover:text-maple-rust transition-colors line-clamp-2">
          {book.title}
        </h3>
        <p className="font-body text-sm text-coffee-cream italic mb-4">by {book.author}</p>
      </div>

      {progress !== null && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">
              Progress
            </span>
            <span className="font-body text-xs text-maple-rust font-medium">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-page-cream rounded-full overflow-hidden">
            <div
              className="h-full bg-maple-rust transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="font-body text-[0.65rem] text-coffee-cream/70 mt-1">
            {book.current_page} / {book.total_pages} pages
          </p>
        </div>
      )}

      <div className="flex justify-between items-center mt-auto pt-4 border-t border-coffee-cream/10" onClick={(e) => e.stopPropagation()}>
        <select
          value={book.status}
          onChange={(e) => onStatusChange(book, e.target.value)}
          aria-label={`Change status for ${book.title}`}
          className="bg-page-cream border border-coffee-cream/20 rounded-sm text-xs font-label text-library-ink p-1 focus:outline-none cursor-pointer"
        >
          {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button
          onClick={() => onDelete(book)} // ✅ Pass the whole book object
          aria-label={`Remove ${book.title} from library`}
          className="text-coffee-cream/40 hover:text-maple-rust transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
});

export default function Library() {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [activeTab, setActiveTab] = useState('currently_reading');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const notificationTimer = useRef(null);

  const [newBook, setNewBook] = useState(EMPTY_NEW_BOOK);
  const [deleteTarget, setDeleteTarget] = useState(null); // book waiting for confirmation

  const showNotification = useCallback((message, type = 'success') => {
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    setNotification({ show: true, message, type });
    notificationTimer.current = setTimeout(
      () => setNotification({ show: false, message: '', type: 'success' }),
      3000
    );
  }, []);

  useEffect(() => {
    return () => {
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    };
  }, []);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) setError('Could not load your library. Please refresh.');
    else setBooks(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchBooks();
  }, [user, fetchBooks]);

  const handleAddBook = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    const totalPages = newBook.total_pages ? parseInt(newBook.total_pages, 10) : null;
    let currentPage = newBook.current_page ? parseInt(newBook.current_page, 10) : 0;
    if (totalPages && currentPage > totalPages) currentPage = totalPages;

    const { data, error } = await supabase
      .from('books')
      .insert([{
        user_id: user.id,
        title: newBook.title,
        author: newBook.author,
        genre: newBook.genre,
        total_pages: totalPages,
        current_page: currentPage,
        cover_color: newBook.cover_color,
        status: activeTab
      }])
      .select()
      .single();

    if (error) {
      setError('Could not add this book. Please try again.');
      showNotification('Failed to add book.', 'error');
    } else {
      setBooks(prev => [data, ...prev]);
      setIsAdding(false);
      setNewBook(EMPTY_NEW_BOOK);
      showNotification(`"${data.title}" added to your library!`);
    }
  }, [newBook, activeTab, user, showNotification]);

  const updateStatus = useCallback(async (book, newStatus) => {
    setBooks(prev => prev.map(b => b.id === book.id ? { ...b, status: newStatus } : b));

    const { error } = await supabase
      .from('books')
      .update({ status: newStatus })
      .eq('id', book.id);

    if (error) {
      setBooks(prev => prev.map(b => b.id === book.id ? { ...b, status: book.status } : b));
      showNotification('Failed to update status.', 'error');
    } else {
      showNotification(`"${book.title}" moved to ${newStatus.replace('_', ' ')}!`);
    }
  }, [showNotification]);

  // ✅ Open the custom modal instead of the browser popup
  const requestDelete = useCallback((book) => {
    setDeleteTarget(book);
  }, []);

  // ✅ Only runs when the user confirms inside the modal
  const confirmDelete = useCallback(async () => {
    const book = deleteTarget;
    setDeleteTarget(null);
    if (!book) return;

    setBooks(prev => prev.filter(b => b.id !== book.id));

    const { error } = await supabase.from('books').delete().eq('id', book.id);
    if (error) {
      // Rollback
      fetchBooks(); 
      showNotification('Failed to remove book.', 'error');
    } else {
      showNotification(`"${book.title}" removed from your library.`);
    }
  }, [deleteTarget, showNotification, fetchBooks]);

  const stats = useMemo(() => {
    const totalPagesRead = books.reduce((sum, b) => sum + (b.current_page || 0), 0);
    const totalBooksRead = books.filter(b => b.status === 'read').length;
    const currentlyReading = books.filter(b => b.status === 'currently_reading').length;

    return {
      total: books.length,
      currentlyReading,
      read: totalBooksRead,
      pagesRead: totalPagesRead,
    };
  }, [books]);

  const tabCounts = useMemo(() => {
    const counts = {};
    for (const tab of TABS) counts[tab.id] = 0;
    for (const book of books) {
      if (counts[book.status] !== undefined) counts[book.status]++;
    }
    return counts;
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter(b => {
      const matchesTab = b.status === activeTab;
      const matchesSearch = q === '' ||
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [books, activeTab, searchQuery]);

  if (selectedBook) {
    return <BookDetail book={selectedBook} onBack={() => setSelectedBook(null)} />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {notification.show && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-cozy border animate-fade-in-up flex items-center gap-3 ${
          notification.type === 'error'
            ? 'bg-maple-rust text-page-cream border-maple-rust'
            : 'bg-porch-sage text-page-cream border-porch-sage'
        }`}>
          {notification.type === 'error' ? <X size={18} /> : <CheckCircle size={18} />}
          <span className="font-body text-sm">{notification.message}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 animate-fade-in-up">
        <div>
          <p className="eyebrow mb-2">The Collection</p>
          <h1 className="font-display text-4xl text-yale-blue">
            My <span className="italic text-maple-rust">Library</span>.
          </h1>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-yale-blue text-page-cream px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all"
        >
          <Plus size={16} /> {isAdding ? 'Cancel' : 'Add Book'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={16} className="text-yale-blue" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Total Books</p>
          </div>
          <p className="font-display text-2xl text-yale-blue">{stats.total}</p>
        </div>
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-maple-rust" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Reading Now</p>
          </div>
          <p className="font-display text-2xl text-maple-rust">{stats.currentlyReading}</p>
        </div>
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={16} className="text-porch-sage" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Completed</p>
          </div>
          <p className="font-display text-2xl text-porch-sage">{stats.read}</p>
        </div>
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-gilmore-gold" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Pages Read</p>
          </div>
          <p className="font-display text-2xl text-gilmore-gold">{stats.pagesRead.toLocaleString()}</p>
        </div>
      </div>

      {/* ❌ Removed <ResearchAssistant /> because the AI Librarian now lives inside BookDetail.jsx */}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-maple-rust/10 border border-maple-rust/30 rounded-sm text-maple-rust text-sm font-body animate-fade-in-up">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAddBook} className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text" required value={newBook.title}
              onChange={e => setNewBook(prev => ({ ...prev, title: e.target.value }))}
              className="p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
              placeholder="Book Title"
            />
            <input
              type="text" required value={newBook.author}
              onChange={e => setNewBook(prev => ({ ...prev, author: e.target.value }))}
              className="p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
              placeholder="Author"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select
              value={newBook.genre}
              onChange={e => setNewBook(prev => ({ ...prev, genre: e.target.value }))}
              className="p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body text-sm"
            >
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input
              type="number" min="1" value={newBook.total_pages}
              onChange={e => setNewBook(prev => ({ ...prev, total_pages: e.target.value }))}
              className="p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body text-sm"
              placeholder="Total Pages"
            />
            <input
              type="number" min="0" value={newBook.current_page}
              onChange={e => setNewBook(prev => ({ ...prev, current_page: e.target.value }))}
              className="p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body text-sm"
              placeholder="Current Page"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="font-label text-xs uppercase tracking-wider text-coffee-cream">Cover Color:</label>
            <input
              type="color"
              value={newBook.cover_color}
              onChange={e => setNewBook(prev => ({ ...prev, cover_color: e.target.value }))}
              className="w-10 h-10 rounded-sm border border-coffee-cream/20 cursor-pointer"
            />
            <span className="font-body text-xs text-coffee-cream italic">{newBook.cover_color}</span>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-maple-rust text-page-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-colors">
              Add to Shelf
            </button>
          </div>
        </form>
      )}

      <div className="relative animate-fade-in-up">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-coffee-cream/50" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by title or author..."
          aria-label="Search your library"
          className="w-full pl-11 pr-4 py-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm transition-colors"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-coffee-cream/20 pb-2 animate-fade-in-up">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'bg-yale-blue text-page-cream'
                  : 'text-coffee-cream hover:bg-page-cream hover:text-yale-blue'
              }`}
            >
              <Icon size={14} />
              {tab.label} ({tabCounts[tab.id]})
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-center text-coffee-cream italic py-10 font-body">Browsing the shelves...</p>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-16 animate-fade-in-up">
          <BookOpen className="mx-auto text-coffee-cream/30 mb-4" size={48} />
          <p className="font-body text-coffee-cream italic">
            {searchQuery ? 'No books match your search.' : 'No books in this section yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredBooks.map((book, i) => (
            <BookCard
              key={book.id}
              book={book}
              index={i}
              onSelect={setSelectedBook}
              onStatusChange={updateStatus}
              onDelete={requestDelete} // ✅ FIXED: Was passing undefined `deleteBook`
            />
          ))}
        </div>
      )}

      {/* ✅ Added the Custom Confirmation Modal */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this book?"
        message={
          <>
            “<span className="italic text-library-ink">{deleteTarget?.title}</span>” will be
            removed from your library along with its notes. This cannot be undone.
          </>
        }
        confirmLabel="Remove Book"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}