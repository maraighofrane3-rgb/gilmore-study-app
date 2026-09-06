import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft, FileText, Lightbulb, Quote, BookOpen, Trash2, Upload, Loader2,
  Sparkles, X, Save, CheckCircle, Image as ImageIcon
} from 'lucide-react';
import { extractTextFromPDF, extractCoverFromPDF } from '../utils/pdfWorker';

export default function BookDetail({ book, onBack }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [currentBook, setCurrentBook] = useState(book);
  const fileInputRef = useRef(null);

  // 🤖 The Librarian states
  const [inputText, setInputText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [result, setResult] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [usePdfText, setUsePdfText] = useState(false);
  const [fromPage, setFromPage] = useState('');
  const [toPage, setToPage] = useState('');
  const [retryMessage, setRetryMessage] = useState('');
  const [cacheHit, setCacheHit] = useState(false);

  // 📖 Reading Progress states
  const [progressPage, setProgressPage] = useState('');
  const [totalInput, setTotalInput] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);

  // 💭 Personal Reflection states
  const [personalReflection, setPersonalReflection] = useState(currentBook?.personal_reflection || '');
  const [editingReflection, setEditingReflection] = useState(false);
  const [savingReflection, setSavingReflection] = useState(false);

  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef(null);

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  // ✅ NEW: Global request queue and cooldown to prevent rate limiting
  const requestQueue = useRef([]);
  const isProcessing = useRef(false);
  const lastRequestTime = useRef(0);
  const MIN_REQUEST_INTERVAL_MS = 10000; // 5 seconds between ANY two Groq calls

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

  // 📕 Upload the book's PDF
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

      const updates = { pdf_url: publicUrl, file_path: fileName, ai_text_content: extractedText };

      if (!currentBook.cover_url) {
        try {
          const coverBlob = await extractCoverFromPDF(file);
          const coverPath = `${user.id}/covers/${Date.now()}.jpg`;
          const { error: coverErr } = await supabase.storage
            .from('pdf-documents')
            .upload(coverPath, coverBlob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });

          if (!coverErr) {
            updates.cover_url = supabase.storage
              .from('pdf-documents')
              .getPublicUrl(coverPath).data.publicUrl;
          }
        } catch (coverErr) {
          console.warn('Auto-cover failed (non-blocking):', coverErr);
        }
      }

      const { error } = await supabase.from('books').update(updates).eq('id', currentBook.id);
      if (error) throw error;

      setCurrentBook({ ...currentBook, ...updates });
      setUsePdfText(true);
      showNotification(
        updates.cover_url
          ? 'PDF attached! Cover generated from page 1. 📕'
          : 'PDF attached! The Librarian can now read your book.'
      );
    } catch (err) {
      console.error('Book PDF upload error:', err);
      showNotification(`Failed to upload PDF: ${err.message}`, 'error');
    }
    setUploadingPDF(false);
    e.target.value = '';
  };

  // 🗑️ Remove the uploaded PDF
  const handleDeletePDF = async () => {
    if (!currentBook.file_path) return;
    if (!window.confirm("Are you sure you want to remove the PDF? The Librarian will no longer be able to read this book, but the book itself will remain in your library.")) return;

    setUploadingPDF(true);
    try {
      const { error: storageError } = await supabase.storage
        .from('pdf-documents')
        .remove([currentBook.file_path]);
      
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('books')
        .update({ 
          pdf_url: null, 
          file_path: null, 
          ai_text_content: null 
        })
        .eq('id', currentBook.id);
        
      if (dbError) throw dbError;

      setCurrentBook(prev => ({ 
        ...prev, 
        pdf_url: null, 
        file_path: null, 
        ai_text_content: null 
      }));
      setUsePdfText(false);
      showNotification("PDF removed successfully. The book remains in your library.");
    } catch (err) {
      console.error('Delete PDF error:', err);
      showNotification(`Failed to remove PDF: ${err.message}`, 'error');
    } finally {
      setUploadingPDF(false);
    }
  };

  // 🖼️ Upload / change the book cover
  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    setUploadingCover(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/covers/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('pdf-documents')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;

      const publicUrl = supabase.storage.from('pdf-documents').getPublicUrl(path).data.publicUrl;

      const { error } = await supabase.from('books').update({ cover_url: publicUrl }).eq('id', currentBook.id);
      if (error) throw error;

      setCurrentBook({ ...currentBook, cover_url: publicUrl });
      showNotification('Cover updated!');
    } catch (err) {
      showNotification(`Failed to upload cover: ${err.message}`, 'error');
    }
    setUploadingCover(false);
    e.target.value = '';
  };

  // 📖 Save reading progress
  const updateProgress = async (page, total) => {
    const totalPages = total !== undefined && total !== ''
      ? (parseInt(total, 10) || null)
      : (currentBook.total_pages || null);

    let currentPage = Math.max(0, parseInt(page, 10) || 0);
    if (totalPages && currentPage > totalPages) currentPage = totalPages;

    const updates = { current_page: currentPage };
    if (totalPages) updates.total_pages = totalPages;
    if (totalPages && currentPage >= totalPages) updates.status = 'read';

    setSavingProgress(true);
    const { error } = await supabase.from('books').update(updates).eq('id', currentBook.id);
    setSavingProgress(false);

    if (error) {
      showNotification('Failed to update progress.', 'error');
      return;
    }
    setCurrentBook({ ...currentBook, ...updates });
    setProgressPage('');
    showNotification(updates.status === 'read' ? 'Book completed! 🎉' : 'Progress saved!');
  };

  const markFinished = async () => {
    const updates = { status: 'read' };
    if (currentBook.total_pages) updates.current_page = currentBook.total_pages;

    setSavingProgress(true);
    const { error } = await supabase.from('books').update(updates).eq('id', currentBook.id);
    setSavingProgress(false);

    if (error) return showNotification('Failed to update.', 'error');
    setCurrentBook({ ...currentBook, ...updates });
    showNotification('Book completed! 🎉');
  };

  // 💭 Save personal reflection
  const savePersonalReflection = async () => {
    setSavingReflection(true);
    const { error } = await supabase
      .from('books')
      .update({ personal_reflection: personalReflection })
      .eq('id', currentBook.id);
    setSavingReflection(false);

    if (error) {
      showNotification('Failed to save reflection.', 'error');
      return;
    }
    setCurrentBook({ ...currentBook, personal_reflection: personalReflection });
    setEditingReflection(false);
    showNotification('Reflection saved!');
  };

  // 📄 Extract text between page X and page Y
  const getPageRangeText = (from, to) => {
    const content = currentBook.ai_text_content || '';
    if (!content) return '';

    const parts = content.split(/---\s*Page\s+(\d+)\s*---/);
    if (parts.length < 3) return content;

    const pages = {};
    for (let i = 1; i < parts.length; i += 2) {
      pages[parseInt(parts[i], 10)] = (parts[i + 1] || '').trim();
    }

    let result = '';
    for (let p = from; p <= to; p++) {
      if (pages[p]) result += pages[p] + '\n\n';
    }
    return result.trim();
  };

  // ✅ Generate cache key
  const generateCacheKey = (action, from, to, text) => {
    const source = usePdfText ? `pages-${from}-${to}` : text.substring(0, 100);
    return `${currentBook.id}_${action}_${source}`;
  };

  // ✅ Check cache
  const checkCache = (action, from, to, text) => {
    const cacheKey = generateCacheKey(action, from, to, text);
    const fieldName = action === 'summarize' ? 'ai_summary' : action === 'explain' ? 'ai_explanation' : 'ai_quotes';
    
    const cached = notes.find(note => note.original_text === cacheKey && note[fieldName]);
    return cached ? cached[fieldName] : null;
  };

  // ✅ Auto-save to cache
  const saveToCache = async (action, from, to, text, aiResult) => {
    const cacheKey = generateCacheKey(action, from, to, text);
    const noteData = {
      user_id: user.id,
      book_id: currentBook.id,
      original_text: cacheKey,
    };
    
    if (action === 'summarize') noteData.ai_summary = aiResult;
    else if (action === 'explain') noteData.ai_explanation = aiResult;
    else if (action === 'quotes') noteData.ai_quotes = aiResult;

    const { error } = await supabase.from('book_notes').insert([noteData]);
    if (!error) {
      await fetchNotes();
    }
  };

 // ✅ Retry wrapper with exponential backoff
const invokeWithRetry = async (functionName, body, maxRetries = 2) => {
  let delay = 15000; // Start with 15 second delay
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    
    if (error && error.message && error.message.includes('429')) {
      if (attempt <= maxRetries) {
        setRetryMessage(`Groq is busy. Waiting ${Math.round(delay / 1000)}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // Slower exponential backoff
        continue;
      } else {
        // Final failure - give up and show friendly message
        return { 
          data: null, 
          error: new Error('The librarian is overwhelmed. Please wait 60 seconds and try again.') 
        };
      }
    }
    
    setRetryMessage('');
    return { data, error };
  }
  
  return { data: null, error: new Error('Max retries exceeded') };
};

  // ✅ Process the request queue, always respecting the global cooldown
  const processQueue = async () => {
    if (isProcessing.current || requestQueue.current.length === 0) return;

    isProcessing.current = true;

    while (requestQueue.current.length > 0) {
      const { action, resolve } = requestQueue.current.shift();

      // Wait out whatever's left of the cooldown since the last Groq call
      const elapsed = Date.now() - lastRequestTime.current;
      if (elapsed < MIN_REQUEST_INTERVAL_MS && lastRequestTime.current > 0) {
        const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;
        setRetryMessage(`The librarian is catching her breath... waiting ${Math.ceil(waitTime / 1000)}s`);
        await new Promise(r => setTimeout(r, waitTime));
        setRetryMessage('');
      }

      try {
        const result = await executeAnalysis(action);
        resolve(result);
      } catch (error) {
        resolve({ error });
      } finally {
        // Update the timestamp after the request completes (success or failure)
        lastRequestTime.current = Date.now();
      }
    }

    isProcessing.current = false;
  };

  // 🤖 Analyze with queue system and PRE-QUEUE cache check
  const handleAnalyze = (action) => {
    return new Promise((resolve) => {
      const f = Math.max(1, parseInt(fromPage, 10) || 1);
      const t = Math.max(f, parseInt(toPage, 10) || f);
      const sourceText = usePdfText
        ? getPageRangeText(f, t)
        : (inputText.trim() || (currentBook.ai_text_content || ''));

      // ✅ PRE-QUEUE CACHE CHECK: If cached, resolve immediately without touching the queue or cooldown
      const cachedResult = checkCache(action, f, t, sourceText);
      if (cachedResult) {
        resolve({ result: cachedResult, cacheHit: true });
        return;
      }

      // Not cached? Add to queue and process.
      requestQueue.current.push({ action, resolve });
      processQueue();
    });
  };

  // ✅ Execute a single analysis (Network call only)
  const executeAnalysis = async (action) => {
    const f = Math.max(1, parseInt(fromPage, 10) || 1);
    const t = Math.max(f, parseInt(toPage, 10) || f);
    const scope = usePdfText ? `pages ${f} to ${t}` : 'this excerpt';

    const sourceText = usePdfText
      ? getPageRangeText(f, t)
      : (inputText.trim() || (currentBook.ai_text_content || ''));

    if (!sourceText) {
      throw new Error(usePdfText
        ? 'No text found in that page range. Check the page numbers.'
        : 'Paste an excerpt or upload the book PDF first.');
    }

    let systemPrompt = '';
    let charLimit = 12000;
    
    if (action === 'summarize') {
      systemPrompt = `Provide a concise, clear summary of ${scope} from "${currentBook.title}". Focus on the main ideas and key takeaways in 2-3 paragraphs.`;
    } else if (action === 'explain') {
      systemPrompt = `Explain ${scope} from "${currentBook.title}" in simple, clear terms. Break down any complex concepts or jargon.`;
    } else if (action === 'quotes') {
      systemPrompt = `Extract exactly 3 to 5 of the most beautiful, meaningful or powerful quotes from ${scope} of "${currentBook.title}". Return each quote on its own line, wrapped in quotation marks, followed by a brief one-line interpretation. Do NOT exceed 5 quotes.`;
      charLimit = 8000;
    }

    const { data, error } = await invokeWithRetry('summarize-text', {
      text: sourceText.substring(0, charLimit),
      action,
      custom_prompt: systemPrompt
    });

    if (error) throw new Error(error.message || 'Failed to analyze');
    
    await saveToCache(action, f, t, sourceText, data.result);
    
    return { result: data.result, cacheHit: false };
  };

  // ✅ Updated button handlers that use the queue
  const handleSummarize = async () => {
    setAnalyzing(true);
    setActiveAction('summarize');
    setResult('');
    setJustSaved(false);
    setRetryMessage('');
    setCacheHit(false);

    try {
      const { result, cacheHit: hit } = await handleAnalyze('summarize');
      setResult(result);
      setCacheHit(hit);
      showNotification(hit ? 'Loaded from cache! (Instant ⚡)' : 'Summary complete!');
    } catch (err) {
      console.error('Analysis error:', err);
      showNotification(`Failed to analyze: ${err.message}`, 'error');
    }
    setAnalyzing(false);
    setRetryMessage('');
  };

  const handleExplain = async () => {
    setAnalyzing(true);
    setActiveAction('explain');
    setResult('');
    setJustSaved(false);
    setRetryMessage('');
    setCacheHit(false);

    try {
      const { result, cacheHit: hit } = await handleAnalyze('explain');
      setResult(result);
      setCacheHit(hit);
      showNotification(hit ? 'Loaded from cache! (Instant ⚡)' : 'Explanation complete!');
    } catch (err) {
      console.error('Analysis error:', err);
      showNotification(`Failed to analyze: ${err.message}`, 'error');
    }
    setAnalyzing(false);
    setRetryMessage('');
  };

  const handleQuotes = async () => {
    setAnalyzing(true);
    setActiveAction('quotes');
    setResult('');
    setJustSaved(false);
    setRetryMessage('');
    setCacheHit(false);

    try {
      const { result, cacheHit: hit } = await handleAnalyze('quotes');
      setResult(result);
      setCacheHit(hit);
      showNotification(hit ? 'Loaded from cache! (Instant ⚡)' : 'Quotes extracted!');
    } catch (err) {
      console.error('Analysis error:', err);
      showNotification(`Failed to analyze: ${err.message}`, 'error');
    }
    setAnalyzing(false);
    setRetryMessage('');
  };

  // 💾 Save AI result as note
  const handleSaveNote = async () => {
    if (!result || !activeAction) return;

    const noteData = {
      user_id: user.id,
      book_id: currentBook.id,
      original_text: inputText.trim() 
        ? inputText.trim().substring(0, 600) 
        : (usePdfText ? `Pages ${fromPage || 1}-${toPage || 'end'}` : ''),
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
      setCacheHit(false);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-sm hover:bg-coffee-cream/10 transition-colors">
            <ArrowLeft size={20} className="text-coffee-cream" />
          </button>
          {currentBook.cover_url && (
            <img
              src={currentBook.cover_url}
              alt={`${currentBook.title} cover`}
              className="w-14 h-20 object-cover rounded-sm border border-coffee-cream/20 shadow-cozy"
            />
          )}
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-yale-blue">{currentBook.title}</h1>
            <p className="font-body text-sm text-coffee-cream italic">by {currentBook.author}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" accept="image/*" ref={coverInputRef} className="hidden" onChange={handleCoverUpload} />
          <button
            onClick={() => coverInputRef.current?.click()}
            disabled={uploadingCover}
            className="flex items-center gap-2 border border-yale-blue text-yale-blue px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue hover:text-page-cream transition-all disabled:opacity-50"
          >
            {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
            {uploadingCover ? 'Uploading...' : 'Cover'}
          </button>

          <input type="file" accept=".pdf,application/pdf" ref={fileInputRef} className="hidden" onChange={handleBookPDFUpload} />
          
          {currentBook.file_path ? (
            <button
              onClick={handleDeletePDF}
              disabled={uploadingPDF}
              className="flex items-center gap-2 bg-maple-rust/10 border border-maple-rust/30 text-maple-rust px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all disabled:opacity-50"
            >
              {uploadingPDF ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {uploadingPDF ? 'Processing...' : 'Remove PDF'}
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPDF}
              className="flex items-center gap-2 bg-maple-rust text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50"
            >
              {uploadingPDF ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploadingPDF ? 'Uploading...' : 'Upload PDF'}
            </button>
          )}
        </div>
      </div>

      {/* 📖 Reading Progress Tracker */}
      <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-display text-lg text-yale-blue flex items-center gap-2">
            <BookOpen size={18} className="text-maple-rust" /> Reading Progress
          </h3>
          {currentBook.total_pages > 0 && (
            <span className="font-body text-sm text-coffee-cream italic">
              {currentBook.current_page || 0} / {currentBook.total_pages} pages
            </span>
          )}
        </div>

        {currentBook.total_pages > 0 && (
          <div className="flex items-center gap-4">
            <div className="flex-1 h-2 bg-page-cream rounded-full overflow-hidden">
              <div
                className="h-full bg-maple-rust transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.round(((currentBook.current_page || 0) / currentBook.total_pages) * 100))}%`
                }}
              />
            </div>
            <span className="font-display text-2xl text-maple-rust">
              {Math.min(100, Math.round(((currentBook.current_page || 0) / currentBook.total_pages) * 100))}%
            </span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateProgress(
              progressPage !== '' ? progressPage : currentBook.current_page,
              totalInput
            );
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="number"
            min="0"
            max={currentBook.total_pages || undefined}
            value={progressPage}
            onChange={(e) => setProgressPage(e.target.value)}
            placeholder={`Pages read (I'm on page ${currentBook.current_page || 0})...`}
            className="flex-1 min-w-[160px] p-2.5 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
          />
          <input
            type="number"
            min="1"
            value={totalInput}
            onChange={(e) => setTotalInput(e.target.value)}
            placeholder={currentBook.total_pages ? `Total: ${currentBook.total_pages}` : 'Total pages...'}
            className="w-36 p-2.5 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
          />
          <button
            type="submit"
            disabled={savingProgress}
            className="bg-yale-blue text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => updateProgress((currentBook.current_page || 0) + 10)}
            className="px-3 py-2.5 border border-coffee-cream/30 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:bg-coffee-cream/10 transition-colors"
          >
            +10
          </button>
          <button
            type="button"
            onClick={markFinished}
            className="px-3 py-2.5 bg-porch-sage text-page-cream rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-colors"
          >
            Finished 🎉
          </button>
        </form>
      </div>

      {/* 💭 Personal Reflection */}
      <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-display text-lg text-yale-blue flex items-center gap-2">
            <Sparkles size={18} className="text-gilmore-gold" /> My Reflection
          </h3>
          {!editingReflection && (
            <button
              onClick={() => setEditingReflection(true)}
              className="flex items-center gap-2 text-maple-rust hover:text-yale-blue transition-colors font-label text-xs uppercase tracking-wider"
            >
              {personalReflection ? 'Edit' : 'Write'}
            </button>
          )}
        </div>

        {editingReflection ? (
          <div className="space-y-3">
            <textarea
              value={personalReflection}
              onChange={(e) => setPersonalReflection(e.target.value)}
              placeholder="Write your thoughts, insights, or feelings about this book..."
              className="w-full p-4 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm h-48 resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingReflection(false);
                  setPersonalReflection(currentBook.personal_reflection || '');
                }}
                className="px-4 py-2 border border-coffee-cream/30 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:bg-coffee-cream/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePersonalReflection}
                disabled={savingReflection}
                className="flex items-center gap-2 bg-maple-rust text-page-cream px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50"
              >
                {savingReflection ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="min-h-[100px]">
            {personalReflection ? (
              <p className="font-body text-sm text-library-ink leading-relaxed whitespace-pre-wrap">
                {personalReflection}
              </p>
            ) : (
              <p className="font-body text-sm text-coffee-cream/60 italic">
                No reflection yet. Click "Write" to share your thoughts about this book.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 🤖 The Librarian */}
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!currentBook.ai_text_content) {
                showNotification('Upload the book PDF first.', 'error');
                return;
              }
              setUsePdfText(true);
              setInputText('');
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider border transition-all ${
              usePdfText
                ? 'bg-maple-rust text-page-cream border-maple-rust'
                : 'border-coffee-cream/30 text-coffee-cream hover:bg-coffee-cream/10'
            }`}
          >
            <FileText size={14} /> Analyze the full PDF directly
          </button>
          {usePdfText && (
            <button
              type="button"
              onClick={() => setUsePdfText(false)}
              className="font-label text-xs uppercase tracking-wider text-coffee-cream hover:text-maple-rust transition-colors underline"
            >
              Use a pasted passage instead
            </button>
          )}
        </div>

        {usePdfText && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-label text-xs uppercase tracking-wider text-coffee-cream">Analyze pages:</span>
            <input
              type="number"
              min="1"
              value={fromPage}
              onChange={(e) => setFromPage(e.target.value)}
              placeholder="From (1)"
              className="w-24 p-2.5 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
            />
            <span className="text-coffee-cream font-body">→</span>
            <input
              type="number"
              min="1"
              value={toPage}
              onChange={(e) => setToPage(e.target.value)}
              placeholder="To (10)"
              className="w-24 p-2.5 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
            />
            <span className="font-body text-xs text-coffee-cream italic">Tip: 5–15 pages at a time gives the best results.</span>
          </div>
        )}

        <textarea
          value={inputText}
          onChange={(e) => { setInputText(e.target.value); setUsePdfText(false); }}
          disabled={usePdfText}
          placeholder={
            usePdfText
              ? 'Full-PDF mode enabled — just click Summarize, Explain Simply or Extract Quotes below.'
              : 'Paste a paragraph or passage from this book (optional if PDF uploaded)...'
          }
          className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm h-32 resize-y disabled:opacity-50"
        />

        {retryMessage && (
          <div className="flex items-center gap-2 p-3 bg-gilmore-gold/10 border border-gilmore-gold/30 rounded-sm animate-fade-in-up">
            <Loader2 size={16} className="animate-spin text-gilmore-gold" />
            <span className="font-body text-sm text-gilmore-gold italic">{retryMessage}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleSummarize} 
            disabled={analyzing} 
            className="flex items-center gap-2 bg-yale-blue text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50"
          >
            {analyzing && activeAction === 'summarize' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} 
            {analyzing && activeAction !== 'summarize' ? 'Waiting...' : 'Summarize'}
          </button>
          <button 
            onClick={handleExplain} 
            disabled={analyzing} 
            className="flex items-center gap-2 bg-porch-sage text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50"
          >
            {analyzing && activeAction === 'explain' ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />} 
            {analyzing && activeAction !== 'explain' ? 'Waiting...' : 'Explain Simply'}
          </button>
          <button 
            onClick={handleQuotes} 
            disabled={analyzing} 
            className="flex items-center gap-2 bg-gilmore-gold text-yale-blue px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all disabled:opacity-50"
          >
            {analyzing && activeAction === 'quotes' ? <Loader2 size={14} className="animate-spin" /> : <Quote size={14} />} 
            {analyzing && activeAction !== 'quotes' ? 'Waiting...' : 'Extract Quotes'}
          </button>
        </div>

        {result && (
          <div className="space-y-3 animate-fade-in-up">
            <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 relative">
              <button onClick={() => { setResult(''); setActiveAction(null); setCacheHit(false); }} className="absolute top-2 right-2 text-coffee-cream/50 hover:text-maple-rust transition-colors">
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

                {note.original_text && !note.original_text.startsWith(currentBook.id + '_') && (
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