import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, FileText, Lightbulb, Quote, BookOpen, Trash2, Upload, Loader2,
  Sparkles, X, Save, CheckCircle
} from 'lucide-react';
import { extractTextFromPDF } from '../utils/pdfWorker';

export default function BookDetail({ book, onBack }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [currentBook, setCurrentBook] = useState(book);
  const fileInputRef = useRef(null);

  // 🤖 The Librarian (now lives inside the book)
  const [inputText, setInputText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [result, setResult] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (currentBook) fetchNotes();
  }, [currentBook]);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  const showNotification = (message, type = 'success') => setNotification({ show: true, message, type });

  const fetchNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('book_notes')
      .select('*')
      .eq('book_id', currentBook.id)
      .order('created_at', { ascending: false });

    if (!error) setNotes(data || []);
    setLoading(false);
  };

  // 📕 Upload the book's PDF (viewer + AI text)
  const handleBookPDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    setUploadingPDF(true);
    try {
      const extractedText = await extractTextFromPDF(file);

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/books/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('pdf-documents')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pdf-documents')
        .getPublicUrl(fileName);

      const { error } = await supabase
        .from('books')
        .update({ pdf_url: publicUrl, file_path: fileName, ai_text_content: extractedText })
        .eq('id', currentBook.id);

      if (error) throw error;

      setCurrentBook({ ...currentBook, pdf_url: publicUrl, ai_text_content: extractedText });
      showNotification('PDF attached! The Librarian can now read your book.');
    } catch (err) {
      console.error('Book PDF upload error:', err);
      showNotification(`Failed to upload PDF: ${err.message}`, 'error');
    }
    setUploadingPDF(false);
    e.target.value = '';
  };

  // 🤖 Analyze — uses the pasted excerpt, or the uploaded PDF text automatically
  const handleAnalyze = async (action) => {
    const sourceText = inputText.trim() || (currentBook.ai_text_content || '');
    if (!sourceText) {
      showNotification('Paste an excerpt or upload the book PDF first.', 'error');
      return;
    }

    setAnalyzing(true);
    setActiveAction(action);
    setResult('');
    setJustSaved(false);

    try {
      let systemPrompt = '';
      if (action === 'summarize') systemPrompt = `Provide a concise, clear summary of this excerpt from "${currentBook.title}". Focus on the main ideas and key takeaways in 2-3 paragraphs.`;
      else if (action === 'explain') systemPrompt = `Explain this excerpt from "${currentBook.title}" in simple, clear terms. Break down any complex concepts or jargon.`;
      else if (action === 'quotes') systemPrompt = 'Extract the most beautiful, meaningful or powerful quotes from this text. Return each quote on its own line, wrapped in quotation marks.';

      const { data, error } = await supabase.functions.invoke('summarize-text', {
        body: { text: sourceText.substring(0, 4000), action, custom_prompt: systemPrompt },
      });

      if (error) throw new Error(error.message || 'Failed to analyze');
      setResult(data.result);
      showNotification('Analysis complete!');
    } catch (err) {
      console.error('Analysis error:', err);
      showNotification(`Failed to analyze: ${err.message}`, 'error');
    }
    setAnalyzing(false);
  };

  // 💾 Save the AI result as a note for THIS book
  const handleSaveNote = async () => {
    if (!result || !activeAction) return;

    const noteData = {
      user_id: user.id,
      book_id: currentBook.id,
      original_text: inputText.trim() ? inputText.trim().substring(0, 600) : '',
    };
    if (activeAction === 'summarize') noteData.ai_summary = result;
    else if (activeAction === 'explain') noteData.ai_explanation = result;
    else if (activeAction === 'quotes') noteData.ai_quotes = result;

    const { error } = await supabase.from('book_notes').insert([noteData]);
    if (error) {
      showNotification('Failed to save note.', 'error');
      return;
    }

    setJustSaved(true);
    await fetchNotes();
    showNotification('Note saved to this book!');

    setTimeout(() => {
      setJustSaved(false);
      setResult('');
      setActiveAction(null);
      setInputText('');
    }, 1500);
  };

  const deleteNote = async (id) => {
    const { error } = await supabase.from('book_notes').delete().eq('id', id);
    if (!error) setNotes(notes.filter(n => n.id !== id));
  };

  const categories = [
    { id: 'all', label: 'All Notes', icon: BookOpen },
    { id: 'summary', label: 'Summaries', icon: FileText },
    { id: 'explanation', label: 'Explanations', icon: Lightbulb },
    { id: 'quotes', label: 'Quotes', icon: Quote },
  ];

  const filteredNotes = notes.filter(note => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'summary') return note.ai_summary;
    if (activeCategory === 'explanation') return note.ai_explanation;
    if (activeCategory === 'quotes') return note.ai_quotes;
    return true;
  });

  const getNoteContent = (note) => {
    if (activeCategory === 'summary') return note.ai_summary ? { type: 'summary', content: note.ai_summary, icon: FileText, label: 'Summary' } : null;
    if (activeCategory === 'explanation') return note.ai_explanation ? { type: 'explanation', content: note.ai_explanation, icon: Lightbulb, label: 'Explanation' } : null;
    if (activeCategory === 'quotes') return note.ai_quotes ? { type: 'quotes', content: note.ai_quotes, icon: Quote, label: 'Quotes' } : null;
    if (note.ai_summary) return { type: 'summary', content: note.ai_summary, icon: FileText, label: 'Summary' };
    if (note.ai_explanation) return { type: 'explanation', content: note.ai_explanation, icon: Lightbulb, label: 'Explanation' };
    if (note.ai_quotes) return { type: 'quotes', content: note.ai_quotes, icon: Quote, label: 'Quotes' };
    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      {/* 🔔 Notification */}
      {notification.show && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-cozy border animate-fade-in-up flex items-center gap-3 ${
          notification.type === 'error' ? 'bg-maple-rust text-page-cream border-maple-rust' : 'bg-porch-sage text-page-cream border-porch-sage'
        }`}>
          {notification.type === 'error' ? <X size={18} /> : <CheckCircle size={18} />}
          <span className="font-body text-sm">{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-sm hover:bg-coffee-cream/10 transition-colors">
            <ArrowLeft size={20} className="text-coffee-cream" />
          </button>
          <div>
            <h1 className="font-display text-3xl text-yale-blue">{currentBook.title}</h1>
            <p className="font-body text-sm text-coffee-cream italic">by {currentBook.author}</p>
          </div>
        </div>

        <input type="file" accept=".pdf,application/pdf" ref={fileInputRef} className="hidden" onChange={handleBookPDFUpload} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPDF}
          className="flex items-center gap-2 bg-maple-rust text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50"
        >
          {uploadingPDF ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploadingPDF ? 'Uploading...' : 'Upload PDF'}
        </button>
      </div>

      {/* 🤖 The Librarian — AI assistant for THIS book */}
      <div className="bg-page-cream p-6 rounded-sm border-l-4 border-gilmore-gold shadow-cozy space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-gilmore-gold" />
          <h3 className="font-display text-lg text-yale-blue">The Librarian</h3>
        </div>
        <p className="font-body text-sm text-coffee-cream italic">
          {currentBook.ai_text_content
            ? `Your PDF is ready — I can analyze "${currentBook.title}" directly, or paste a specific passage below.`
            : `Paste a passage from "${currentBook.title}", or upload the PDF so I can read it for you.`}
        </p>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste a paragraph or passage from this book (optional if PDF uploaded)..."
          className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm h-32 resize-y"
        />

        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleAnalyze('summarize')} disabled={analyzing} className="flex items-center gap-2 bg-yale-blue text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50">
            {analyzing && activeAction === 'summarize' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Summarize
          </button>
          <button onClick={() => handleAnalyze('explain')} disabled={analyzing} className="flex items-center gap-2 bg-porch-sage text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50">
            {analyzing && activeAction === 'explain' ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />} Explain Simply
          </button>
          <button onClick={() => handleAnalyze('quotes')} disabled={analyzing} className="flex items-center gap-2 bg-gilmore-gold text-yale-blue px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all disabled:opacity-50">
            {analyzing && activeAction === 'quotes' ? <Loader2 size={14} className="animate-spin" /> : <Quote size={14} />} Extract Quotes
          </button>
        </div>

        {result && (
          <div className="space-y-3 animate-fade-in-up">
            <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 relative">
              <button onClick={() => { setResult(''); setActiveAction(null); }} className="absolute top-2 right-2 text-coffee-cream/50 hover:text-maple-rust transition-colors">
                <X size={16} />
              </button>
              <p className="font-body text-sm text-library-ink whitespace-pre-wrap leading-relaxed pr-6">{result}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSaveNote}
                disabled={justSaved}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider transition-all duration-300 ${
                  justSaved ? 'bg-porch-sage text-page-cream cursor-default' : 'bg-maple-rust text-page-cream hover:bg-yale-blue'
                }`}
              >
                {justSaved ? <><CheckCircle size={14} /> Saved!</> : <><Save size={14} /> Save to Notes</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 📖 PDF Reader */}
      {currentBook.pdf_url && (
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="w-full h-[700px] rounded-sm overflow-hidden border border-coffee-cream/20 bg-white">
            <iframe src={currentBook.pdf_url} className="w-full h-full" title={currentBook.title} />
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-coffee-cream/20 pb-2">
        {categories.map(cat => {
          const Icon = cat.icon;
          const count = cat.id === 'all'
            ? notes.length
            : notes.filter(n => n[`ai_${cat.id}`]).length;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider transition-all ${
                activeCategory === cat.id
                  ? 'bg-yale-blue text-page-cream'
                  : 'text-coffee-cream hover:bg-page-cream hover:text-yale-blue'
              }`}
            >
              <Icon size={14} />
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Notes Display */}
      {loading ? (
        <p className="text-center text-coffee-cream italic py-10 font-body">Loading notes...</p>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="mx-auto text-coffee-cream/30 mb-4" size={48} />
          <p className="font-body text-coffee-cream italic">No notes in this category yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotes.map((note, idx) => {
            const noteData = getNoteContent(note);
            if (!noteData) return null;

            const Icon = noteData.icon;

            return (
              <div
                key={note.id}
                className="bg-parchment border border-coffee-cream/20 rounded-sm shadow-cozy p-5 animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-gilmore-gold" />
                    <span className="font-label text-xs uppercase tracking-wider text-coffee-cream">
                      {noteData.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-body text-xs text-coffee-cream/60">
                      {new Date(note.created_at).toLocaleDateString()}
                    </span>
                    <button onClick={() => deleteNote(note.id)} className="text-coffee-cream/40 hover:text-maple-rust transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {note.original_text && (
                  <div className="mb-4 p-3 bg-page-cream/50 border-l-2 border-coffee-cream/30 rounded-sm">
                    <p className="font-body text-xs text-coffee-cream italic line-clamp-3">
                      "{note.original_text}"
                    </p>
                  </div>
                )}

                <div className={`p-4 rounded-sm ${
                  noteData.type === 'quotes'
                    ? 'bg-gilmore-gold/10 border-l-4 border-gilmore-gold'
                    : noteData.type === 'explanation'
                    ? 'bg-porch-sage/10 border-l-4 border-porch-sage'
                    : 'bg-yale-blue/5 border-l-4 border-yale-blue'
                }`}>
                  <p className={`font-body text-sm leading-relaxed whitespace-pre-wrap ${
                    noteData.type === 'quotes' ? 'italic text-coffee-cream' : 'text-library-ink'
                  }`}>
                    {noteData.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}