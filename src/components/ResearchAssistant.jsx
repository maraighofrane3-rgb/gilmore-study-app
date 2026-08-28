import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, Loader2, FileText, Lightbulb, Quote, ChevronDown, Save, CheckCircle, X } from 'lucide-react';

export default function ResearchAssistant({ books }) {
  const [inputText, setInputText] = useState('');
  const [selectedBook, setSelectedBook] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState(null);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [savedNotes, setSavedNotes] = useState([]);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (selectedBook) {
      fetchNotes();
    }
  }, [selectedBook]);

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('book_notes')
      .select('*')
      .eq('book_id', selectedBook)
      .order('created_at', { ascending: false });
    
    if (!error) setSavedNotes(data || []);
  };

  const handleAction = async (action) => {
    if (!inputText.trim()) {
      setError('Please paste some text first.');
      return;
    }
    if (!selectedBook) {
      setError('Please select a book first.');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult('');
    setJustSaved(false);
    setCurrentAction(action);

    try {
      let systemPrompt = "";
      if (action === 'summarize') {
        systemPrompt = "Provide a concise, clear summary of the provided text, capturing the main arguments and themes in 2-3 paragraphs.";
      } else if (action === 'explain') {
        systemPrompt = "Explain the following text in simple, clear terms, breaking down any complex jargon.";
      } else if (action === 'quotes') {
        systemPrompt = "Extract the 3 to 5 most profound or important quotes from the following text. Format as a bulleted list.";
      }

      const { data, error } = await supabase.functions.invoke('summarize-text', {
        body: { 
          text: inputText, 
          action: action,
          custom_prompt: systemPrompt
        }
      });

      if (error) throw error;
      setResult(data.result);
    } catch (err) {
      console.error(err);
      setError('The librarian encountered an error. Please try again.');
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    if (!result || !selectedBook || !currentAction) {
      console.error('Missing required fields:', { result: !!result, selectedBook: !!selectedBook, currentAction });
      setError('Cannot save: missing data.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const noteData = {
        user_id: user.id,
        book_id: selectedBook,
        original_text: inputText,
      };

      // Save to the correct column based on the action
      if (currentAction === 'summarize') {
        noteData.ai_summary = result;
      } else if (currentAction === 'explain') {
        noteData.ai_explanation = result;
      } else if (currentAction === 'quotes') {
        noteData.ai_quotes = result;
      }

      console.log('Saving note:', noteData);

      const { data, error } = await supabase
        .from('book_notes')
        .insert([noteData])
        .select();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Saved successfully:', data);
      setJustSaved(true);
      await fetchNotes();
      
      setTimeout(() => {
        setJustSaved(false);
        setResult(''); // Clear the result after saving
        setCurrentAction(null);
      }, 2000);
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save note: ' + err.message);
    }
  };

  const clearResult = () => {
    setResult('');
    setCurrentAction(null);
    setJustSaved(false);
  };

  return (
    <div className="bg-parchment border border-coffee-cream/20 rounded-sm shadow-cozy p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen size={24} className="text-yale-blue" />
        <h2 className="font-display text-2xl text-yale-blue">The Librarian</h2>
      </div>
      <p className="font-body text-sm text-coffee-cream -mt-4">
        Select a book, paste an excerpt, and I'll create organized notes for you.
      </p>

      {/* Book Selector */}
      <div className="relative">
        <label className="block font-label text-xs uppercase tracking-wider-label text-coffee-cream mb-1">
          Select Book
        </label>
        <div className="relative">
          <select
            value={selectedBook}
            onChange={(e) => setSelectedBook(e.target.value)}
            className="w-full p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body appearance-none cursor-pointer transition-colors"
          >
            <option value="">Choose a book...</option>
            {books.map(book => (
              <option key={book.id} value={book.id}>
                {book.title} by {book.author}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-coffee-cream pointer-events-none" />
        </div>
      </div>

      {/* Text Input */}
      <div>
        <label className="block font-label text-xs uppercase tracking-wider-label text-coffee-cream mb-1">
          Paste Text Excerpt
        </label>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste a paragraph or passage from your selected book..."
          className="w-full p-4 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-library-ink h-40 resize-none transition-colors"
        />
      </div>

      {error && <p className="text-maple-rust font-body text-sm italic">{error}</p>}

      {/* Three Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => handleAction('summarize')}
          disabled={loading || !inputText.trim() || !selectedBook}
          className="flex items-center gap-2 bg-yale-blue text-page-cream px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && currentAction === 'summarize' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          Summarize
        </button>
        
        <button
          onClick={() => handleAction('explain')}
          disabled={loading || !inputText.trim() || !selectedBook}
          className="flex items-center gap-2 bg-porch-sage text-page-cream px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && currentAction === 'explain' ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
          Explain Simply
        </button>

        <button
          onClick={() => handleAction('quotes')}
          disabled={loading || !inputText.trim() || !selectedBook}
          className="flex items-center gap-2 bg-gilmore-gold text-yale-blue px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust hover:text-page-cream transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading && currentAction === 'quotes' ? <Loader2 size={14} className="animate-spin" /> : <Quote size={14} />}
          Extract Quotes
        </button>
      </div>

      {/* Result Display with Save Button */}
      {result && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="bg-page-cream/50 p-5 rounded-sm border-l-4 border-gilmore-gold relative">
            <button
              onClick={clearResult}
              className="absolute top-2 right-2 text-coffee-cream/50 hover:text-maple-rust transition-colors"
            >
              <X size={16} />
            </button>
            <p className="font-body text-library-ink leading-relaxed whitespace-pre-wrap pr-6">{result}</p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={justSaved || loading}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider-label transition-all duration-300 ${
                justSaved
                  ? 'bg-porch-sage text-page-cream cursor-default'
                  : 'bg-maple-rust text-page-cream hover:bg-yale-blue'
              }`}
            >
              {justSaved ? (
                <>
                  <CheckCircle size={14} />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save to Notes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Saved Notes Preview */}
      {savedNotes.length > 0 && (
        <div className="border-t border-coffee-cream/20 pt-6">
          <h3 className="font-display text-lg text-yale-blue mb-3">Recent Notes</h3>
          <p className="font-body text-sm text-coffee-cream italic">
            You have {savedNotes.length} saved note{savedNotes.length !== 1 ? 's' : ''}. 
            Click on the book card to view all notes.
          </p>
        </div>
      )}
    </div>
  );
}