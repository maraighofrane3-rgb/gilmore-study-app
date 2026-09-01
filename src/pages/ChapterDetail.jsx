import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useParams, Link } from 'react-router-dom';
import { extractTextFromPDF, renderPDFAsImages } from '../utils/pdfWorker';
import {
  ArrowLeft, Loader2, Sparkles, FileText, Lightbulb, List, X,
  Save, CheckCircle, ChevronDown, Upload, FileText as FileIcon,
  MessageCircle, Send, Trash2, Pencil, Plus, StickyNote, HelpCircle
} from 'lucide-react';

export default function ChapterDetail() {
  const { materialId, chapterId } = useParams();
  const { user } = useAuth();

  const [material, setMaterial] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);

  const [uploadingPDF, setUploadingPDF] = useState(false);
  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [fromPage, setFromPage] = useState('');
  const [toPage, setToPage] = useState('');
  const [activeAction, setActiveAction] = useState(null);
  const [chapterResult, setChapterResult] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');

  const [savedNotes, setSavedNotes] = useState([]);
  const [expandedNote, setExpandedNote] = useState(null);
  const notesSectionRef = useRef(null);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteFormTitle, setNoteFormTitle] = useState('');
  const [noteFormText, setNoteFormText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [questionInput, setQuestionInput] = useState('');
  const [chatFromPage, setChatFromPage] = useState('');
  const [chatToPage, setChatToPage] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef(null);

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  // ============================================
  // 🛠️ HELPER FUNCTIONS
  // ============================================

  const getReadableText = () => {
    if (!chapter) return '';
    if (chapter.ai_text_content && chapter.ai_text_content.trim()) return chapter.ai_text_content;
    const c = chapter.content || '';
    if (c.includes('<img') || c.includes('pdf-pages') || c.includes('pdf-divider')) return '';
    return c.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  // Try several marker formats, return the first split that works (or null)
  const splitByPages = (content) => {
    const patterns = [
      /[-_=*•–—]{2,}\s*page\s+(\d+)\s*[-_=*•–—]{2,}/i,
      /[-_=*•–—]\s*page\s+(\d+)\s*[-_=*•–—]/i,
      /\*\*\s*page\s+(\d+)\s*\*\*/i,
      /(?:^|\n)\s*page\s+(\d+)\s*(?=\n)/i,
    ];
    for (const pattern of patterns) {
      const parts = content.split(pattern);
      if (parts.length >= 3) return parts;
    }
    return null;
  };

  // Returns: text of the range | '' (range empty) | null (no markers)
  const getPageRangeText = (from, to) => {
    const content = getReadableText();
    if (!content) return '';

    const parts = splitByPages(content);
    if (!parts) return null;

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

  // ============================================
  // 📐 COMPUTED CONSTANTS
  // ============================================

  const rangeFrom = Math.max(1, parseInt(fromPage, 10) || 1);
  const rangeTo = Math.max(rangeFrom, parseInt(toPage, 10) || rangeFrom);
  const hasRange = fromPage !== '' || toPage !== '';

  const chatRangeFrom = Math.max(1, parseInt(chatFromPage, 10) || 1);
  const chatRangeTo = Math.max(chatRangeFrom, parseInt(chatToPage, 10) || chatRangeFrom);
  const chatHasRange = chatFromPage !== '' || chatToPage !== '';

  // ============================================
  // 📖 MEMOIZED: text bounds
  // ============================================

  const textBounds = useMemo(() => {
    const content = chapter?.ai_text_content || '';
    if (!content) return null;
    const parts = splitByPages(content);
    if (!parts) return null;
    let first = null, last = null;
    for (let i = 1; i < parts.length; i += 2) {
      const num = parseInt(parts[i], 10);
      if ((parts[i + 1] || '').trim()) {
        if (first === null) first = num;
        last = num;
      }
    }
    return first ? { first, last } : null;
  }, [chapter]);

  // ============================================
  // 🔄 EFFECTS
  // ============================================

  useEffect(() => {
    if (materialId && chapterId) {
      fetchAll();
    }
  }, [materialId, chapterId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  useEffect(() => {
    if (chapter) {
      localStorage.setItem('rgw-last-chapter', JSON.stringify({
        materialId,
        chapterId,
        title: chapter.title,
        at: Date.now(),
      }));
    }
  }, [chapter, materialId, chapterId]);

  // ============================================
  // 🔧 HANDLERS
  // ============================================

  const showNotification = (message, type = 'success') => setNotification({ show: true, message, type });

  const fetchAll = async () => {
    setLoading(true);
    const [matRes, chapRes, notesRes] = await Promise.all([
      supabase.from('materials').select('*').eq('id', materialId).maybeSingle(),
      supabase.from('chapters').select('*').eq('id', chapterId).maybeSingle(),
      supabase.from('chapter_notes').select('*').eq('chapter_id', chapterId).order('created_at', { ascending: false }),
    ]);
    setMaterial(matRes.data);
    setChapter(chapRes.data);
    setSavedNotes(notesRes.data || []);
    setLoading(false);
  };

  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    setUploadingPDF(true);
    try {
      const extractedText = await extractTextFromPDF(file);
      const htmlContent = await renderPDFAsImages(file);

      const divider = `\n\n<div class="pdf-divider" style="text-align: center; margin: 2rem 0; color: #8b5e3c; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; border-top: 1px solid #d4c5b5; border-bottom: 1px solid #d4c5b5; padding: 1rem 0;">📄 ${file.name} · added on ${new Date().toLocaleDateString()}</div>\n\n`;

      const isExistingHtml = chapter.content && (chapter.content.includes('<img') || chapter.content.includes('<div class="pdf-pages"'));

      const newContent = isExistingHtml
        ? chapter.content + divider + htmlContent
        : (chapter.content ? `<div style="white-space: pre-wrap;">${chapter.content}</div>` + divider : '') + htmlContent;

      const { error } = await supabase
        .from('chapters')
        .update({
          content: newContent,
          ai_text_content: (chapter.ai_text_content ? chapter.ai_text_content + '\n\n' : '') + extractedText,
          is_from_pdf: true
        })
        .eq('id', chapterId);

      if (error) throw error;
      setChapter({
        ...chapter,
        content: newContent,
        ai_text_content: (chapter.ai_text_content ? chapter.ai_text_content + '\n\n' : '') + extractedText,
        is_from_pdf: true
      });
      showNotification(`PDF added! Text extracted for AI.`);
    } catch (err) {
      console.error('PDF upload error:', err);
      showNotification(`Failed to process PDF: ${err.message}`, 'error');
    }
    setUploadingPDF(false);
    e.target.value = '';
  };

  const startEdit = () => {
    setEditTitle(chapter.title);
    const plainText = chapter.content && chapter.content.includes('<img')
      ? '[PDF content with images - Direct editing may remove the images. Use "Add PDF" to add pages.]'
      : (chapter.content || '');
    setEditContent(plainText);
    setEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    const { error } = await supabase
      .from('chapters')
      .update({ title: editTitle.trim() || 'Untitled', content: editContent })
      .eq('id', chapterId);
    setSavingEdit(false);

    if (error) {
      showNotification('Save failed.', 'error');
      return;
    }
    setChapter({ ...chapter, title: editTitle.trim() || 'Untitled', content: editContent });
    setEditing(false);
    showNotification('Chapter updated!');
  };

  const handleAnalyze = async (action) => {
    const rawText = getReadableText();

    if (!rawText) {
      showNotification('This chapter has no readable text yet. Click "Add PDF" to extract it.', 'error');
      return;
    }

    const f = Math.max(1, parseInt(fromPage, 10) || 1);
    const t = Math.max(f, parseInt(toPage, 10) || f);
    const hasRangeLocal = fromPage !== '' || toPage !== '';

    let sourceText = rawText;
    let scope = 'this chapter';

    if (hasRangeLocal) {
      const ranged = getPageRangeText(f, t);
      if (ranged === null) {
        sourceText = rawText;
        scope = 'this chapter';
      } else if (ranged === '') {
        showNotification(
          textBounds
            ? `Pages ${f}–${t} have no readable text (cover/contents). Readable pages: ${textBounds.first}–${textBounds.last}.`
            : 'No text found in that page range. Check the page numbers.',
          'error'
        );
        return;
      } else {
        sourceText = ranged;
        scope = `pages ${f} to ${t}`;
      }
    }

    sourceText = sourceText.replace(/\s+/g, ' ').trim();
    if (!sourceText) {
      showNotification('This chapter has no readable text yet. Click "Add PDF" to extract it.', 'error');
      return;
    }

    setAnalyzing(true);
    setActiveAction(action);
    setChapterResult('');
    setJustSaved(false);
    setNoteTitle('');

    try {
      let systemPrompt = '';
      let charLimit = 5000;

      if (action === 'summarize') {
        systemPrompt = `Provide a concise, clear summary of ${scope} from "${chapter.title}". Focus on the main ideas and key takeaways in 2-3 paragraphs.`;
        charLimit = 5000;
      } else if (action === 'explain') {
        systemPrompt = `Explain ${scope} from "${chapter.title}" in simple, clear terms. Break down any complex concepts or jargon.`;
        charLimit = 5000;
      } else if (action === 'keypoints') {
        systemPrompt = `Extract the 5-7 most important key points from ${scope} of "${chapter.title}". Present them as a bulleted list.`;
        charLimit = 4000;
      } else if (action === 'quiz') {
        systemPrompt = `Create a multiple-choice quiz (QCM) of 5 questions about ${scope} of "${chapter.title}". Format it EXACTLY like this:

1. Question text
A) option
B) option
C) option
D) option

(after the 5 questions, add a line "Answers:" then list the correct letters, e.g. 1-B, 2-A, 3-C, 4-D, 5-A). Keep questions clear and focused on the key ideas.`;
        charLimit = 4000;
      }

      const { data, error } = await supabase.functions.invoke('summarize-text', {
        body: {
          text: sourceText.substring(0, charLimit),
          action,
          custom_prompt: systemPrompt
        },
      });

      if (error) {
        let details = error.message || 'Failed to analyze';
        try {
          if (error.context) {
            const errorBody = await error.context.json();
            details = errorBody.error || errorBody.message || JSON.stringify(errorBody);
          }
        } catch {
          // Keep default error message
        }
        throw new Error(details);
      }

      if (!data?.result) {
        throw new Error('The AI returned an empty response.');
      }

      setChapterResult(data.result);
      showNotification(`Analysis of ${scope} complete!`);
    } catch (err) {
      console.error('Analysis error:', err);
      showNotification(`Failed to analyze: ${err.message}`, 'error');
    }
    setAnalyzing(false);
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!questionInput.trim() || !chapter) return;

    const userQuestion = questionInput.trim();
    setQuestionInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userQuestion }]);
    setIsAsking(true);

    try {
      const baseText = getReadableText();
      if (!baseText) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: "This chapter only contains scanned page images — there's no readable text yet. Click 'Add PDF' and select the PDF again to extract its text, then ask me anything!"
        }]);
        setIsAsking(false);
        return;
      }

      let context = baseText;
      let scopeNote = '';

      if (chatHasRange) {
        const ranged = getPageRangeText(chatRangeFrom, chatRangeTo);

        if (ranged === null) {
          context = baseText;
          scopeNote = '';
        } else if (ranged === '') {
          setChatMessages(prev => [...prev, {
            role: 'assistant',
            content: textBounds
              ? `Pages ${chatRangeFrom}–${chatRangeTo} contain no readable text (usually the cover & contents). The readable text runs from page ${textBounds.first} to ${textBounds.last} — try a range inside that!`
              : "I can't find readable text for that page range. Try different page numbers."
          }]);
          setIsAsking(false);
          return;
        } else {
          context = ranged;
          scopeNote = ` (Answer using ONLY pages ${chatRangeFrom} to ${chatRangeTo} of the chapter.)`;
        }
      }

      context = context.replace(/\s+/g, ' ').trim();

      if (!context) {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: "This chapter has no readable text yet. Click 'Add PDF' and select the PDF again to extract its text, then ask me anything!"
        }]);
        setIsAsking(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('ask-chapter', {
        body: {
          question: userQuestion + scopeNote,
          context: context.substring(0, 8000),
        },
      });

      if (error) {
        let details = error.message || "Sorry, I couldn't process that question.";
        try {
          if (error.context) {
            const errorBody = await error.context.json();
            details = errorBody.error || errorBody.message || details;
          }
        } catch {
          // Keep default
        }
        throw new Error(details);
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      console.error('Q&A error:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Sorry: ${err.message}` }]);
    }
    setIsAsking(false);
  };

  const handleSaveNote = async () => {
    if (!chapterResult || !chapter || !activeAction) return;

    const finalTitle = noteTitle.trim() || `${activeAction.charAt(0).toUpperCase() + activeAction.slice(1)} - ${new Date().toLocaleDateString()}`;

    try {
      const noteData = {
        user_id: user.id,
        chapter_id: chapter.id,
        title: finalTitle,
        original_text: '',
      };
      if (activeAction === 'summarize') noteData.ai_summary = chapterResult;
      else if (activeAction === 'explain') noteData.ai_explanation = chapterResult;
      else if (activeAction === 'keypoints') noteData.ai_key_points = chapterResult.split('\n').filter(line => line.trim());
      else if (activeAction === 'quiz') noteData.ai_summary = `📝 QUIZ (QCM)\n\n${chapterResult}`;

      const { error } = await supabase.from('chapter_notes').insert([noteData]);
      if (error) throw error;

      setJustSaved(true);
      const { data } = await supabase.from('chapter_notes').select('*').eq('chapter_id', chapter.id).order('created_at', { ascending: false });
      setSavedNotes(data || []);
      showNotification('Note saved successfully!');

      setTimeout(() => {
        notesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setJustSaved(false);
        setChapterResult('');
        setNoteTitle('');
        setActiveAction(null);
      }, 1500);
    } catch (err) {
      console.error('Save error:', err);
      showNotification('Failed to save note.', 'error');
    }
  };

  const handleAddManualNote = async (e) => {
    e.preventDefault();
    if (!noteFormText.trim() || !chapter) return;

    setSavingNote(true);
    const { error } = await supabase.from('chapter_notes').insert([{
      user_id: user.id,
      chapter_id: chapter.id,
      title: noteFormTitle.trim() || 'My Note',
      manual_note: noteFormText.trim(),
      original_text: '',
    }]);
    setSavingNote(false);

    if (error) {
      showNotification('Failed to add note.', 'error');
      return;
    }
    const { data } = await supabase.from('chapter_notes').select('*').eq('chapter_id', chapter.id).order('created_at', { ascending: false });
    setSavedNotes(data || []);
    setShowNoteForm(false);
    setNoteFormTitle('');
    setNoteFormText('');
    showNotification('Note added!');
  };

  const deleteNote = async (id) => {
    await supabase.from('chapter_notes').delete().eq('id', id);
    setSavedNotes(savedNotes.filter(n => n.id !== id));
    showNotification('Note deleted.');
  };

  const renderContent = (content) => {
    if (!content) return 'No content yet. Import a PDF or click Edit to write something.';

    if (content.includes('<img') || content.includes('<div class="pdf-pages"') || content.includes('<div class="pdf-divider"')) {
      return (
        <div
          dangerouslySetInnerHTML={{ __html: content }}
          className="font-body text-library-ink leading-relaxed text-sm max-h-[80vh] overflow-y-auto pr-2 space-y-4"
        />
      );
    }

    return <div className="font-body text-library-ink whitespace-pre-wrap leading-relaxed text-sm max-h-96 overflow-y-auto">{content}</div>;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center">
        <Loader2 size={32} className="animate-spin mx-auto text-coffee-cream mb-4" />
        <p className="font-body text-coffee-cream italic">Opening your chapter...</p>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center">
        <p className="font-body text-coffee-cream italic">Chapter not found.</p>
        <Link to={`/study-materials/${materialId}`} className="inline-block mt-4 text-maple-rust hover:underline font-label text-xs uppercase tracking-wider">
          ← Back to material
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {notification.show && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-cozy border animate-fade-in-up flex items-center gap-3 ${
          notification.type === 'error' ? 'bg-maple-rust text-page-cream border-maple-rust' : 'bg-porch-sage text-page-cream border-porch-sage'
        }`}>
          {notification.type === 'error' ? <X size={18} /> : <CheckCircle size={18} />}
          <span className="font-body text-sm">{notification.message}</span>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Link to={`/study-materials/${materialId}`} className="flex items-center gap-2 text-coffee-cream hover:text-maple-rust transition-colors">
          <ArrowLeft size={20} /> Back to {material?.title || 'Material'}
        </Link>
      </div>

      <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {chapter.is_from_pdf && <FileIcon size={16} className="text-maple-rust" />}
            <h1 className="font-display text-2xl text-yale-blue">{chapter.title}</h1>
          </div>
          <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">
            {new Date(chapter.created_at).toLocaleDateString()}
            {chapter.is_from_pdf && ' · PDF Chapter'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startEdit}
            className="flex items-center gap-2 border border-yale-blue text-yale-blue px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue hover:text-page-cream transition-all"
          >
            <Pencil size={14} /> Edit
          </button>
          <input type="file" accept=".pdf,application/pdf" ref={fileInputRef} className="hidden" onChange={handlePDFUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPDF}
            className="flex items-center gap-2 bg-maple-rust text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50"
          >
            {uploadingPDF ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadingPDF ? 'Extracting...' : 'Add PDF'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="bg-parchment p-6 rounded-sm border border-maple-rust/40 shadow-cozy space-y-4">
          <h3 className="font-display text-lg text-yale-blue flex items-center gap-2">
            <Pencil size={16} className="text-maple-rust" /> Edit Chapter
          </h3>
          <div>
            <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
            />
          </div>
          <div>
            <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Content</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm h-72 resize-y"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2.5 text-coffee-cream hover:text-maple-rust font-label text-xs uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="flex items-center gap-2 bg-porch-sage text-page-cream px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50"
            >
              {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
          {chapter.pdf_url ? (
            <div className="w-full h-[800px] rounded-sm overflow-hidden border border-coffee-cream/20 bg-white">
              <iframe
                src={chapter.pdf_url}
                className="w-full h-full"
                title={chapter.title}
              />
            </div>
          ) : (
            <div className="font-body text-library-ink leading-relaxed text-sm max-h-[80vh] overflow-y-auto pr-2">
              {renderContent(chapter.content)}
            </div>
          )}
        </div>
      )}

      {/* AI Study Assistant */}
      <div className="bg-page-cream p-6 rounded-sm border-l-4 border-gilmore-gold shadow-cozy space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-gilmore-gold" />
          <h3 className="font-display text-lg text-yale-blue">AI Study Assistant</h3>
        </div>

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
          <span className="font-body text-xs text-coffee-cream italic">Leave empty to analyze the whole chapter.</span>
          {textBounds && (
            <span className="font-body text-xs text-porch-sage italic">
              Readable text: pages {textBounds.first}–{textBounds.last}.
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleAnalyze('summarize')} disabled={analyzing || !getReadableText()} className="flex items-center gap-2 bg-yale-blue text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50">
            {analyzing && activeAction === 'summarize' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Summarize
          </button>
          <button onClick={() => handleAnalyze('explain')} disabled={analyzing || !getReadableText()} className="flex items-center gap-2 bg-porch-sage text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50">
            {analyzing && activeAction === 'explain' ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />} Explain Simply
          </button>
          <button onClick={() => handleAnalyze('keypoints')} disabled={analyzing || !getReadableText()} className="flex items-center gap-2 bg-gilmore-gold text-yale-blue px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all disabled:opacity-50">
            {analyzing && activeAction === 'keypoints' ? <Loader2 size={14} className="animate-spin" /> : <List size={14} />} Key Points
          </button>
          <button onClick={() => handleAnalyze('quiz')} disabled={analyzing || !getReadableText()} className="flex items-center gap-2 bg-maple-rust text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50">
            {analyzing && activeAction === 'quiz' ? <Loader2 size={14} className="animate-spin" /> : <HelpCircle size={14} />} Quiz (QCM)
          </button>
        </div>

        {chapterResult && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 relative">
              <button onClick={() => { setChapterResult(''); setActiveAction(null); setNoteTitle(''); }} className="absolute top-2 right-2 text-coffee-cream/50 hover:text-maple-rust transition-colors"><X size={16} /></button>
              <p className="font-body text-sm text-library-ink whitespace-pre-wrap leading-relaxed pr-6">{chapterResult}</p>
            </div>
            <div>
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Note title (optional)</label>
              <input type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="e.g. Chapter 1 Summary..." className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm" />
            </div>
            <div className="flex justify-end">
              <button onClick={handleSaveNote} disabled={justSaved} className={`flex items-center gap-2 px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider transition-all duration-300 ${justSaved ? 'bg-porch-sage text-page-cream cursor-default' : 'bg-maple-rust text-page-cream hover:bg-yale-blue'}`}>
                {justSaved ? <><CheckCircle size={14} /> Saved!</> : <><Save size={14} /> Save to notes</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Q&A Chat */}
      <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-maple-rust" />
            <h3 className="font-display text-lg text-yale-blue">Ask questions about this chapter</h3>
          </div>
          <span className="font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream bg-page-cream border border-coffee-cream/20 px-2 py-1 rounded-sm">
            {chatHasRange ? `📖 Pages ${chatRangeFrom}–${chatRangeTo}` : '📖 Whole chapter'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-label text-xs uppercase tracking-wider text-coffee-cream">Answer from pages:</span>
          <input
            type="number"
            min="1"
            value={chatFromPage}
            onChange={(e) => setChatFromPage(e.target.value)}
            placeholder="From (1)"
            className="w-24 p-2.5 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
          />
          <span className="text-coffee-cream font-body">→</span>
          <input
            type="number"
            min="1"
            value={chatToPage}
            onChange={(e) => setChatToPage(e.target.value)}
            placeholder="To (10)"
            className="w-24 p-2.5 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
          />
          <span className="font-body text-xs text-coffee-cream italic">Leave empty to use the whole chapter.</span>
          {textBounds && (
            <span className="font-body text-xs text-porch-sage italic">
              Readable text: pages {textBounds.first}–{textBounds.last}.
            </span>
          )}
        </div>

        <div className="bg-page-cream/50 rounded-sm border border-coffee-cream/20 h-64 overflow-y-auto p-4 space-y-3">
          {chatMessages.length === 0 ? (
            <p className="text-center text-coffee-cream italic text-sm py-8">Ask me anything about this chapter's content!</p>
          ) : (
            chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-sm text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-yale-blue text-page-cream rounded-br-none'
                    : 'bg-parchment border border-coffee-cream/20 text-library-ink rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {isAsking && (
            <div className="flex justify-start">
              <div className="bg-parchment border border-coffee-cream/20 p-3 rounded-sm rounded-bl-none flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-coffee-cream" />
                <span className="text-sm text-coffee-cream italic">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleAskQuestion} className="flex gap-2">
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            placeholder="e.g. What is the main cause of...?"
            disabled={isAsking}
            className="flex-1 p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm disabled:opacity-50"
          />
          <button type="submit" disabled={isAsking || !questionInput.trim()} className="bg-maple-rust text-page-cream px-4 py-3 rounded-sm hover:bg-yale-blue transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Notes */}
      <div ref={notesSectionRef} className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-lg text-yale-blue flex items-center gap-2">
            <FileText size={18} /> Notes for "{chapter.title}"
          </h4>
          <button
            onClick={() => setShowNoteForm(!showNoteForm)}
            className="flex items-center gap-1 bg-porch-sage text-page-cream px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all"
          >
            <Plus size={14} /> Add a note
          </button>
        </div>

        {showNoteForm && (
          <form onSubmit={handleAddManualNote} className="space-y-3 bg-page-cream p-4 rounded-sm border border-coffee-cream/20 animate-fade-in-up">
            <input
              type="text"
              value={noteFormTitle}
              onChange={(e) => setNoteFormTitle(e.target.value)}
              placeholder="Note title (optional)"
              className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
            />
            <textarea
              required
              value={noteFormText}
              onChange={(e) => setNoteFormText(e.target.value)}
              placeholder="Write your note here..."
              className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm h-32 resize-y"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNoteForm(false)} className="px-4 py-2 text-coffee-cream hover:text-maple-rust font-label text-xs uppercase tracking-wider">
                Cancel
              </button>
              <button type="submit" disabled={savingNote} className="flex items-center gap-2 bg-maple-rust text-page-cream px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50">
                {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            </div>
          </form>
        )}

        {savedNotes.length === 0 && !showNoteForm ? (
          <p className="text-center text-coffee-cream italic text-sm py-4">
            No notes yet. Save an AI analysis or add your own note!
          </p>
        ) : (
          <div className="space-y-3">
            {savedNotes.map((note, idx) => (
              <div key={note.id} className="bg-page-cream border border-coffee-cream/20 rounded-sm overflow-hidden">
                <div
                  onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-coffee-cream/10 transition-colors text-left cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedNote(expandedNote === note.id ? null : note.id); }}
                >
                  <div className="flex-1">
                    <span className="font-body text-sm font-medium text-library-ink">{note.title || `Note ${idx + 1}`}</span>
                    <span className="font-label text-xs text-coffee-cream ml-2">• {new Date(note.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="text-coffee-cream/40 hover:text-maple-rust transition-colors">
                      <Trash2 size={14} />
                    </button>
                    <ChevronDown size={16} className={`text-coffee-cream transition-transform ${expandedNote === note.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {expandedNote === note.id && (
                  <div className="p-4 border-t border-coffee-cream/20 space-y-4 animate-fade-in-up">
                    {note.manual_note && (
                      <div>
                        <h5 className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2 flex items-center gap-1">
                          <StickyNote size={12} /> Your Note
                        </h5>
                        <p className="font-body text-sm text-library-ink leading-relaxed whitespace-pre-wrap">{note.manual_note}</p>
                      </div>
                    )}
                    {note.ai_summary && (
                      <div>
                        <h5 className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2 flex items-center gap-1"><FileText size={12} /> Summary</h5>
                        <p className="font-body text-sm text-library-ink leading-relaxed whitespace-pre-wrap">{note.ai_summary}</p>
                      </div>
                    )}
                    {note.ai_explanation && (
                      <div>
                        <h5 className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2 flex items-center gap-1"><Lightbulb size={12} /> Simple Explanation</h5>
                        <p className="font-body text-sm text-library-ink leading-relaxed whitespace-pre-wrap">{note.ai_explanation}</p>
                      </div>
                    )}
                    {note.ai_key_points && note.ai_key_points.length > 0 && (
                      <div>
                        <h5 className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2 flex items-center gap-1"><List size={12} /> Key Points</h5>
                        <ul className="space-y-2">
                          {note.ai_key_points.map((point, pIdx) => (
                            <li key={pIdx} className="font-body text-sm text-library-ink flex items-start gap-2">
                              <span className="text-maple-rust mt-1.5">•</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}