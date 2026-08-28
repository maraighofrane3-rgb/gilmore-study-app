import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Plus, BookOpen, Trash2, AlertCircle } from 'lucide-react';
import ResearchAssistant from '../components/ResearchAssistant';
import BookDetail from '../components/BookDetail';

const TABS = [
  { id: 'currently_reading', label: 'Currently Reading' },
  { id: 'want_to_read', label: 'Want to Read' },
  { id: 'read', label: 'Read' },
  { id: 'abandoned', label: 'Abandoned' },
];

export default function Library() {
  const { user } = useAuth();
  const [books, setBooks] = useState([]);
  const [activeTab, setActiveTab] = useState('currently_reading');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);

  const [newBook, setNewBook] = useState({ title: '', author: '' });

  useEffect(() => {
    if (user) fetchBooks();
  }, [user]);

  const fetchBooks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) setError('Could not load your library. Please refresh.');
    else setBooks(data || []);
    setLoading(false);
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    setError('');
    const { data, error } = await supabase
      .from('books')
      .insert([{ user_id: user.id, ...newBook, status: activeTab }])
      .select()
      .single();

    if (error) {
      setError('Could not add this book. Please try again.');
    } else {
      setBooks([data, ...books]);
      setIsAdding(false);
      setNewBook({ title: '', author: '' });
    }
  };

  const updateStatus = async (book, newStatus) => {
    const previous = books;
    setBooks(books.map(b => b.id === book.id ? { ...b, status: newStatus } : b));

    const { error } = await supabase
      .from('books')
      .update({ status: newStatus })
      .eq('id', book.id);

    if (error) {
      setBooks(previous);
      setError('Could not update this book\'s status.');
    }
  };

  const deleteBook = async (id) => {
    const previous = books;
    setBooks(books.filter(b => b.id !== id));

    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) {
      setBooks(previous);
      setError('Could not remove this book.');
    }
  };

  const filteredBooks = books.filter(b => b.status === activeTab);

  // If a book is selected, show the detail view
  if (selectedBook) {
    return <BookDetail book={selectedBook} onBack={() => setSelectedBook(null)} />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 animate-fade-in-up">
        <div>
          <p className="eyebrow mb-2">The Collection</p>
          <h1 className="font-display text-4xl text-yale-blue">
            My <span className="italic text-maple-rust">Library</span>.
          </h1>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-yale-blue text-page-cream px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust transition-colors"
        >
          <Plus size={16} /> {isAdding ? 'Cancel' : 'Add Book'}
        </button>
      </div>

      <ResearchAssistant books={books} onSelectBook={setSelectedBook} />

      {error && (
        <div className="flex items-center gap-2 p-3 bg-maple-rust/10 border border-maple-rust/30 rounded-sm text-maple-rust text-sm font-body animate-fade-in-up">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Add Book Form */}
      {isAdding && (
        <form onSubmit={handleAddBook} className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy animate-fade-in-up flex flex-col sm:flex-row gap-4">
          <input
            type="text" required value={newBook.title}
            onChange={e => setNewBook({...newBook, title: e.target.value})}
            className="flex-1 p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
            placeholder="Book Title"
          />
          <input
            type="text" required value={newBook.author}
            onChange={e => setNewBook({...newBook, author: e.target.value})}
            className="flex-1 p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:ring-2 focus:ring-maple-rust/25 focus:border-maple-rust font-body transition-colors"
            placeholder="Author"
          />
          <button type="submit" className="bg-maple-rust text-page-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-yale-blue transition-colors">
            Add to Shelf
          </button>
        </form>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-coffee-cream/20 pb-2 animate-fade-in-up">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label transition-all ${
              activeTab === tab.id
                ? 'bg-yale-blue text-page-cream'
                : 'text-coffee-cream hover:bg-page-cream hover:text-yale-blue'
            }`}
          >
            {tab.label} ({books.filter(b => b.status === tab.id).length})
          </button>
        ))}
      </div>

      {/* Books Grid */}
      {loading ? (
        <p className="text-center text-coffee-cream italic py-10 font-body">Browsing the shelves...</p>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-16 animate-fade-in-up">
          <BookOpen className="mx-auto text-coffee-cream/30 mb-4" size={48} />
          <p className="font-body text-coffee-cream italic">No books in this section yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredBooks.map((book, i) => (
            <div
              key={book.id}
              className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 shadow-cozy flex flex-col justify-between animate-fade-in-up group hover:border-maple-rust/50 transition-all cursor-pointer"
              style={{ animationDelay: `${i * 0.05}s` }}
              onClick={() => setSelectedBook(book)}
            >
              <div>
                <h3 className="font-display text-xl text-yale-blue leading-tight mb-1 group-hover:text-maple-rust transition-colors">{book.title}</h3>
                <p className="font-body text-sm text-coffee-cream italic mb-4">by {book.author}</p>
              </div>

              <div className="flex justify-between items-center mt-auto pt-4 border-t border-coffee-cream/10" onClick={(e) => e.stopPropagation()}>
                <select
                  value={book.status}
                  onChange={(e) => updateStatus(book, e.target.value)}
                  className="bg-page-cream border border-coffee-cream/20 rounded-sm text-xs font-label text-library-ink p-1 focus:outline-none cursor-pointer"
                >
                  {TABS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <button onClick={() => deleteBook(book.id)} className="text-coffee-cream/40 hover:text-maple-rust transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}