import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useParams, Link, useNavigate } from 'react-router-dom';
import MarkdownLite from '../components/MarkdownLite';
import { extractTextFromPDF, renderPDFAsImages, renderPagesBase64, renderUrlPagesBase64 } from '../utils/pdfWorker';
import {
  ArrowLeft, Loader2, Sparkles, FileText, Lightbulb, List, X,
  Save, CheckCircle, ChevronDown, Upload, FileText as FileIcon,
  MessageCircle, Send, Trash2, Pencil, Plus, StickyNote, HelpCircle, Zap,
  Image as ImageIcon
} from 'lucide-react';
import heic2any from 'heic2any';

export default function ExerciseDetail() {
  const { materialId, chapterId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [material, setMaterial] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);

  const [uploadingPDF, setUploadingPDF] = useState(false);
  const fileInputRef = useRef(null);

  const [scans, setScans] = useState([]);
  const [uploadingScans, setUploadingScans] = useState(false);
  const scanInputRef = useRef(null);

  const [analysisSource, setAnalysisSource] = useState('pdf');

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
  const [retryMessage, setRetryMessage] = useState('');
  const [cacheHit, setCacheHit] = useState(false);

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
  const [chatRetryMessage, setChatRetryMessage] = useState('');
  const [scanThumbUrls, setScanThumbUrls] = useState({});
  const thumbCacheRef = useRef({});

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

    useEffect(() => {
    let cancelled = false;
    const buildThumbs = async () => {
      const map = {};
      for (const s of scans) {
        if (thumbCacheRef.current[s.id]) continue;
        try {
          const { data, error } = await supabase.storage.from('scan-notes').download(s.file_path);
          if (error || !data) { thumbCacheRef.current[s.id] = 'fallback'; continue; }
          const normalized = await normalizeToJpegBlob(data, s.file_path);
          const url = URL.createObjectURL(normalized);
          thumbCacheRef.current[s.id] = url;
          map[s.id] = url;
        } catch (e) {
          console.warn('Thumbnail prep failed for scan', s.id, e);
          thumbCacheRef.current[s.id] = 'fallback';
        }
      }
      if (!cancelled && Object.keys(map).length) {
        setScanThumbUrls(prev => ({ ...prev, ...map }));
      }
    };
    if (scans.length) buildThumbs();
    return () => { cancelled = true; };
  }, [scans]);

  // ============================================
  // 🔧 HANDLERS
  // ============================================

  const showNotification = (message, type = 'success') => setNotification({ show: true, message, type });

  const fetchAll = async () => {
    setLoading(true);
    const [matRes, chapRes, notesRes, scansRes] = await Promise.all([
      supabase.from('materials').select('*').eq('id', materialId).maybeSingle(),
      supabase.from('chapters').select('*').eq('id', chapterId).maybeSingle(),
      supabase.from('chapter_notes').select('*').eq('chapter_id', chapterId).order('created_at', { ascending: false }),
      supabase.from('doc_scans').select('*').eq('doc_id', chapterId).order('position'),
    ]);

    if (chapRes.data && (chapRes.data.category || 'chapter') !== 'exercise') {
      showNotification('This is a chapter — opening the chapter page.');
      navigate(`/study-materials/${materialId}/chapter/${chapterId}`, { replace: true });
      return;
    }

    setMaterial(matRes.data);
    setChapter(chapRes.data);
    setSavedNotes(notesRes.data || []);
    setScans(scansRes.data || []);
    setLoading(false);
  };

  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;

    setUploadingPDF(true);
    try {
      let extractedText = '';
      try {
        extractedText = await extractTextFromPDF(file);
      } catch (textErr) {
        console.warn('⚠️ Standard extraction failed (scanned PDF?):', textErr.message);
        extractedText = '';
      }

      const cidCount = (extractedText.match(/\(cid:\d+\)/g) || []).length;
      const isGarbage =
        extractedText.trim().length < 100 ||
        cidCount > 20 ||
        /[\uFFFD?]{6,}/.test(extractedText.substring(0, 300));

      if (isGarbage) {
        showNotification('Weak text layer — reading pages with Vision AI…');
        try {
          const pages = await renderPagesBase64(file, 3, 1.2);
          const { data: vision, error: vErr } = await supabase.functions.invoke('extract-text-vision', {
            body: { images: pages },
          });
          if (!vErr && vision?.text) {
            extractedText = vision.text;
            showNotification('Vision AI read the pages successfully!');
          } else {
            console.error('❌ Vision function error:', vErr?.message || vErr);
            showNotification('Vision AI could not read the pages.', 'error');
          }
        } catch (visionErr) {
          console.error('❌ Vision extraction exception:', visionErr);
          showNotification(`Vision AI failed: ${visionErr.message}`, 'error');
        }
      }

      const htmlContent = await renderPDFAsImages(file);
      const divider = `\n\n<div class="pdf-divider" style="text-align: center; margin: 2rem 0; color: #8b5e3c; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; border-top: 1px solid #d4c5b5; border-bottom: 1px solid #d4c5b5; padding: 1rem 0;">📄 ${file.name} · added on ${new Date().toLocaleDateString()}</div>\n\n`;
      const isExistingHtml = chapter.content && (chapter.content.includes('<img') || chapter.content.includes('<div class="pdf-pages"'));
      const newContent = isExistingHtml
        ? chapter.content + divider + htmlContent
        : (chapter.content ? `<div style="white-space: pre-wrap;">${chapter.content}</div>` + divider : '') + htmlContent;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/chapters/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('pdf-documents').upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('pdf-documents').getPublicUrl(fileName);

      const updates = {
        content: newContent,
        ai_text_content: (chapter.ai_text_content ? chapter.ai_text_content + '\n\n' : '') + extractedText,
        is_from_pdf: true,
        pdf_url: publicUrl,
        file_path: fileName,
      };

      const { error } = await supabase.from('chapters').update(updates).eq('id', chapterId);
      if (error) throw error;

      setChapter({ ...chapter, ...updates });
      showNotification('PDF added! Text extracted for AI.');
    } catch (err) {
      console.error('PDF upload error:', err);
      showNotification(`Failed to process PDF: ${err.message}`, 'error');
    }
    setUploadingPDF(false);
    e.target.value = '';
  };

  // ✅ MOBILE FIX: Uses createImageBitmap to automatically fix EXIF rotation on mobile!
   // ============================================
  // 🖼️ IMAGE PIPELINE (HEIC-safe, EXIF-safe, mobile-safe)
  // ============================================

  const looksHeic = (type = '', name = '') => {
    const t = String(type).toLowerCase();
    const n = String(name).toLowerCase();
    return t.includes('heic') || t.includes('heif') || n.endsWith('.heic') || n.endsWith('.heif');
  };

  // HEIC/HEIF → JPEG, even when the browser itself cannot decode HEIC
  const normalizeToJpegBlob = async (blob, name = '') => {
    if (!looksHeic(blob.type, name)) return blob;
    try {
      const result = await heic2any({ blob, toType: 'image/jpeg', quality: 0.9 });
      return Array.isArray(result) ? result[0] : result;
    } catch (e) {
      console.error('HEIC conversion failed:', e);
      throw new Error('This HEIC photo could not be converted. Switch your camera to JPEG / "Most compatible" and retake it.');
    }
  };

  // Decode bytes → drawable source, honoring phone EXIF rotation
  const decodeImage = async (blob) => {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
      catch (e) {
        try { return await createImageBitmap(blob); } catch (e2) { /* fall through */ }
      }
    }
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Your browser could not decode this image format.'));
        i.src = url;
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }
  };

  // Draw → right-side-up, resized JPEG blob
  const drawToJpegBlob = async (blob, maxSize = 1600, quality = 0.85) => {
    const src = await decodeImage(blob);
    const w = src.width || src.naturalWidth;
    const h = src.height || src.naturalHeight;
    if (!w || !h) throw new Error('Image has no dimensions.');
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    if (src.close) src.close();
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encoding failed on this device.'))), 'image/jpeg', quality);
    });
  };

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Could not encode image for the AI.'));
    r.readAsDataURL(blob);
  });

  const convertToJpeg = async (file) => {
    const normalized = await normalizeToJpegBlob(file, file.name);
    return drawToJpegBlob(normalized, 1600, 0.85);
  };

  // Analysis-side: pull bytes via Supabase (no CORS taint), normalize HEIC, resize
  const loadScanImages = async (list) => {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      let blob = null;
      try {
        const { data, error } = await supabase.storage.from('scan-notes').download(s.file_path);
        if (!error && data) blob = data;
      } catch (e) { console.warn('storage.download failed:', e); }
      if (!blob) {
        try {
          const res = await fetch(s.public_url);
          if (res.ok) blob = await res.blob();
        } catch (e) { console.warn('public fetch failed:', e); }
      }
      if (!blob) { console.warn('Could not load scan', s.id); continue; }
      try {
        const normalized = await normalizeToJpegBlob(blob, s.file_path || s.public_url);
        const jpeg = await drawToJpegBlob(normalized, 1280, 0.8);
        out.push({ base64: await blobToBase64(jpeg), pageNum: i + 1 });
      } catch (e) { console.warn('Decode failed for scan', s.id, e); }
    }
    return out.length ? out : null;
  };

  const handleScanUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingScans(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const jpegBlob = await convertToJpeg(file);
        const path = `${user.id}/scans/${Date.now()}-${i}.jpg`;

        const { error: upErr } = await supabase.storage
          .from('scan-notes')
          .upload(path, jpegBlob, { cacheControl: '3600', contentType: 'image/jpeg' });
        if (upErr) throw new Error(upErr.message || 'Storage upload failed');

        const { data: { publicUrl } } = supabase.storage.from('scan-notes').getPublicUrl(path);

        const { error: dbErr } = await supabase.from('doc_scans').insert([{
          user_id: user.id,
          doc_id: chapterId,
          file_path: path,
          public_url: publicUrl,
          position: scans.length + i,
        }]);
        if (dbErr) throw new Error(dbErr.message || 'Database insert failed');
      }
      const { data } = await supabase.from('doc_scans').select('*').eq('doc_id', chapterId).order('position');
      setScans(data || []);
      setAnalysisSource('scans'); // 🎯 AI reads the photos by default now
      showNotification(`${files.length} scan${files.length > 1 ? 's' : ''} added — AI source switched to Scanned Notes!`);
    } catch (err) {
      console.error('Scan upload error:', err);
      showNotification(`Failed to upload scans: ${err?.message || 'Unknown error (see console)'}`, 'error');
    }
    setUploadingScans(false);
    if (e.target) e.target.value = '';
  };

  const deleteScan = async (scan) => {
    await supabase.from('doc_scans').delete().eq('id', scan.id);
    await supabase.storage.from('scan-notes').remove([scan.file_path]);
    setScans(scans.filter(s => s.id !== scan.id));
    showNotification('Scan removed.');
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
    const { error } = await supabase.from('chapters').update({ title: editTitle.trim() || 'Untitled', content: editContent }).eq('id', chapterId);
    setSavingEdit(false);
    if (error) { showNotification('Save failed.', 'error'); return; }
    setChapter({ ...chapter, title: editTitle.trim() || 'Untitled', content: editContent });
    setEditing(false);
    showNotification('Exercise updated!');
  };

  const generateCacheKey = (action, from, to) => {
    const hasRangeLocal = fromPage !== '' || toPage !== '';
    const source = hasRangeLocal ? `pages-${from}-${to}` : 'full-exercise';
    return `${chapter.id}_${action}_${source}`;
  };

  const checkCache = (action, from, to) => {
    const cacheKey = generateCacheKey(action, from, to);
    const fieldName = action === 'summarize' ? 'ai_summary' : action === 'explain' ? 'ai_explanation' : action === 'keypoints' ? 'ai_key_points' : 'ai_summary';
    const cached = savedNotes.find(note => note.original_text === cacheKey && note[fieldName]);
    return cached ? cached[fieldName] : null;
  };

  const saveToCache = async (action, from, to, aiResult) => {
    const cacheKey = generateCacheKey(action, from, to);
    const noteData = {
      user_id: user.id, chapter_id: chapter.id, title: `Cache: ${action} ${from}-${to}`, original_text: cacheKey,
    };
    if (action === 'summarize') noteData.ai_summary = aiResult;
    else if (action === 'explain') noteData.ai_explanation = aiResult;
    else if (action === 'keypoints') noteData.ai_key_points = aiResult.split('\n').filter(line => line.trim());
    else if (action === 'quiz') noteData.ai_summary = `📝 QUIZ (QCM)\n\n${aiResult}`;

    const { error } = await supabase.from('chapter_notes').insert([noteData]);
    if (!error) {
      const { data } = await supabase.from('chapter_notes').select('*').eq('chapter_id', chapter.id).order('created_at', { ascending: false });
      setSavedNotes(data || []);
    }
  };

  const invokeWithRetry = async (functionName, body, maxRetries = 3, setRetryMsg) => {
    let delay = 2500;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error && error.message && error.message.includes('429')) {
        if (attempt <= maxRetries) {
          if (setRetryMsg) setRetryMsg(`The librarian is catching her breath... retry ${attempt}/${maxRetries} in ${Math.round(delay / 1000)}s`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        } else {
          return { data: null, error: new Error('The librarian is overwhelmed. Please wait 60 seconds and try again.') };
        }
      }
      if (setRetryMsg) setRetryMsg('');
      return { data, error };
    }
    return { data: null, error: new Error('Max retries exceeded') };
  };

  const extractErrorDetails = async (error, fallback = 'Operation failed') => {
    let details = error.message || fallback;
    try {
      if (error.context) {
        const errorBody = await error.context.json();
        details = errorBody.error || errorBody.message || JSON.stringify(errorBody);
      }
    } catch {}
    return details;
  };

  const isGarbageText = (t) => !t || t.trim().length < 50 || /\(cid:\d+\)/.test(t);

  const safeRenderPages = async (url, from, to) => {
    try {
      showNotification('Reading the pages as images…');
      return await renderUrlPagesBase64(url, from, to);
    } catch (e) {
      console.warn('Page render failed:', e);
      return null;
    }
  };

  // ============================================
  // 🤖 ANALYZE (Respects analysisSource)
  // ============================================
  const handleAnalyze = async (action) => {
    let sourceText = '';
    let pageImages = null;
    let scope = 'this exercise';
    const f = Math.max(1, parseInt(fromPage, 10) || 1);
    const t = Math.max(f, parseInt(toPage, 10) || f);
    const hasRangeLocal = fromPage !== '' || toPage !== '';

    if (analysisSource === 'scans') {
      if (scans.length === 0) {
        showNotification('No scanned notes available. Please upload scans first.', 'error');
        return;
      }
      showNotification('Analyzing your scanned notes…');
      pageImages = await loadScanImages(scans.slice(0, 6));
      scope = 'your scanned notes';
    } else {
      const rawText = getReadableText();
      if (!rawText && !chapter?.pdf_url) {
        showNotification('This exercise has no readable text or PDF yet. Click "Add PDF" or upload scanned notes.', 'error');
        return;
      }

      if (hasRangeLocal) {
        const ranged = getPageRangeText(f, t);
        if (ranged === null) {
          sourceText = rawText;
        } else if (ranged === '') {
          if (chapter?.pdf_url) {
            pageImages = await safeRenderPages(chapter.pdf_url, f, t);
            scope = `pages ${f} to ${t}`;
          } else {
            showNotification(textBounds ? `Pages ${f}–${t} have no readable text.` : 'No text found in that page range.', 'error');
            return;
          }
        } else {
          sourceText = ranged;
          scope = `pages ${f} to ${t}`;
        }
      } else {
        sourceText = rawText;
      }

      sourceText = (sourceText || '').replace(/\s+/g, ' ').trim();

      if (isGarbageText(sourceText) && !pageImages && chapter?.pdf_url) {
        pageImages = await safeRenderPages(chapter.pdf_url, hasRangeLocal ? f : 1, hasRangeLocal ? t : 4);
        if (hasRangeLocal) scope = `pages ${f} to ${t}`;
      }
    }

    if (!sourceText && !pageImages) {
      showNotification('No readable content found for the selected source.', 'error');
      return;
    }

    setAnalyzing(true);
    setActiveAction(action);
    setChapterResult('');
    setJustSaved(false);
    setNoteTitle('');
    setRetryMessage('');
    setCacheHit(false);

    try {
      const cachedResult = checkCache(action, f, t);
      if (cachedResult) {
        setChapterResult(Array.isArray(cachedResult) ? cachedResult.join('\n') : cachedResult);
        setCacheHit(true);
        setAnalyzing(false);
        showNotification(`Loaded from cache! (Instant ⚡)`);
        return;
      }

      let systemPrompt = '';
      let charLimit = 5000;

      if (action === 'summarize') {
        systemPrompt = `Provide a concise, clear summary of ${scope} from "${chapter.title}". Focus on the main ideas, methods and key takeaways in 2-3 paragraphs.`;
      } else if (action === 'explain') {
        systemPrompt = `Explain ${scope} from "${chapter.title}" in simple, clear terms. Break down any complex concepts, formulas or jargon step by step.`;
      } else if (action === 'keypoints') {
        systemPrompt = `Extract the 5-7 most important key points from ${scope} of "${chapter.title}". Present them as a bulleted list.`;
        charLimit = 4000;
      } else if (action === 'quiz') {
        systemPrompt = `Create a multiple-choice quiz (QCM) of 5 questions about ${scope} of "${chapter.title}". Format it EXACTLY like this:\n\n1. Question text\nA) option\nB) option\nC) option\nD) option\n\n(after the 5 questions, add a line "Answers:" then list the correct letters, e.g. 1-B, 2-A, 3-C, 4-D, 5-A). Keep questions clear and focused on the key ideas.`;
        charLimit = 4000;
      }

      const { data, error } = await invokeWithRetry('summarize-text', {
        text: (sourceText || '').substring(0, charLimit),
        action,
        custom_prompt: systemPrompt,
        pdf_url: analysisSource === 'pdf' ? (chapter?.pdf_url || null) : null,
        page_images: pageImages || undefined,
      }, 3, setRetryMessage);

      if (error) throw new Error(await extractErrorDetails(error, 'Failed to analyze'));
      if (!data?.result) throw new Error('The AI returned an empty response.');

      setChapterResult(data.result);
      showNotification(`Analysis of ${scope} complete!`);
      await saveToCache(action, f, t, data.result);

    } catch (err) {
      console.error('Analysis error:', err);
      showNotification(`Failed to analyze: ${err.message}`, 'error');
    }
    setAnalyzing(false);
    setRetryMessage('');
  };

  // ============================================
  // 💬 Q&A CHAT (Respects analysisSource)
  // ============================================
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!questionInput.trim() || !chapter) return;

    const userQuestion = questionInput.trim();
    setQuestionInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userQuestion }]);
    setIsAsking(true);
    setChatRetryMessage('');

    try {
      let context = '';
      let scopeNote = '';
      let pageImages = null;

      if (analysisSource === 'scans') {
        if (scans.length === 0) {
          setChatMessages(prev => [...prev, { role: 'assistant', content: "No scanned notes available. Please upload scans first!" }]);
          setIsAsking(false);
          return;
        }
        showNotification('Reading your scanned notes to answer…');
        pageImages = await loadScanImages(scans.slice(0, 6));
        scopeNote = ` (Answer using ONLY the attached scanned note images.)`;
      } else {
        const baseText = getReadableText();
        if (chatHasRange) {
          const ranged = getPageRangeText(chatRangeFrom, chatRangeTo);
          if (ranged === null) {
            context = baseText;
          } else if (ranged === '') {
            if (chapter?.pdf_url) {
              pageImages = await safeRenderPages(chapter.pdf_url, chatRangeFrom, chatRangeTo);
              scopeNote = ` (Answer using ONLY the attached page images ${chatRangeFrom}–${chatRangeTo}.)`;
            } else {
              setChatMessages(prev => [...prev, { role: 'assistant', content: textBounds ? `Pages ${chatRangeFrom}–${chatRangeTo} contain no readable text.` : "I can't find readable text for that page range." }]);
              setIsAsking(false);
              return;
            }
          } else {
            context = ranged;
            scopeNote = ` (Answer using ONLY pages ${chatRangeFrom} to ${chatRangeTo} of the exercise.)`;
          }
        } else {
          context = baseText;
        }
        context = (context || '').replace(/\s+/g, ' ').trim();

        if (isGarbageText(context) && !pageImages && chapter?.pdf_url) {
          pageImages = await safeRenderPages(chapter.pdf_url, chatHasRange ? chatRangeFrom : 1, chatHasRange ? chatRangeTo : 4);
        }
      }

      if (!context && !pageImages) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: "No readable content found for the selected source. Try switching the source or adding content!" }]);
        setIsAsking(false);
        return;
      }

      const { data, error } = await invokeWithRetry('ask-chapter', {
        question: userQuestion + scopeNote,
        context: (context || '').substring(0, 8000),
        pdf_url: analysisSource === 'pdf' ? (chapter?.pdf_url || null) : null,
        page_images: pageImages || undefined,
      }, 3, setChatRetryMessage);

      if (error) throw new Error(await extractErrorDetails(error, "Sorry, I couldn't process that question."));
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      console.error('Q&A error:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Sorry: ${err.message}` }]);
    }
    setIsAsking(false);
    setChatRetryMessage('');
  };

  const handleSaveNote = async () => {
    if (!chapterResult || !chapter || !activeAction) return;
    const finalTitle = noteTitle.trim() || `${activeAction.charAt(0).toUpperCase() + activeAction.slice(1)} - ${new Date().toLocaleDateString()}`;
    try {
      const noteData = { user_id: user.id, chapter_id: chapter.id, title: finalTitle, original_text: '' };
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
        setCacheHit(false);
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
    const { error } = await supabase.from('chapter_notes').insert([{ user_id: user.id, chapter_id: chapter.id, title: noteFormTitle.trim() || 'My Note', manual_note: noteFormText.trim(), original_text: '' }]);
    setSavingNote(false);
    if (error) { showNotification('Failed to add note.', 'error'); return; }
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
    if (!content) return 'No content yet. Upload an exercise PDF or scan your paper notes above.';
    if (content.includes('<img') || content.includes('<div class="pdf-pages"') || content.includes('<div class="pdf-divider"')) {
      return <div dangerouslySetInnerHTML={{ __html: content }} className="font-body text-library-ink leading-relaxed text-sm max-h-[80vh] overflow-y-auto pr-2 space-y-4" />;
    }
    return <div className="font-body text-library-ink whitespace-pre-wrap leading-relaxed text-sm max-h-96 overflow-y-auto">{content}</div>;
  };

  if (loading) return <div className="max-w-5xl mx-auto py-20 text-center"><Loader2 size={32} className="animate-spin mx-auto text-coffee-cream mb-4" /><p className="font-body text-coffee-cream italic">Opening your exercise...</p></div>;
  if (!chapter) return <div className="max-w-5xl mx-auto py-20 text-center"><p className="font-body text-coffee-cream italic">Exercise not found.</p><Link to={`/study-materials/${materialId}`} className="inline-block mt-4 text-maple-rust hover:underline font-label text-xs uppercase tracking-wider">← Back to material</Link></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {notification.show && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-cozy border animate-fade-in-up flex items-center gap-3 ${notification.type === 'error' ? 'bg-maple-rust text-page-cream border-maple-rust' : 'bg-porch-sage text-page-cream border-porch-sage'}`}>
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
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {chapter.is_from_pdf && <FileIcon size={16} className="text-maple-rust" />}
            <h1 className="font-display text-2xl text-yale-blue">{chapter.title}</h1>
            <span className="font-label text-[0.6rem] uppercase tracking-wider px-2 py-1 rounded-sm border border-porch-sage/40 text-porch-sage">
              <FileText size={10} className="inline mr-1" />
              Exercise / Test
            </span>
          </div>
          <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">
            {new Date(chapter.created_at).toLocaleDateString()}
            {chapter.is_from_pdf && ' · PDF document'}
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={startEdit} className="flex items-center gap-2 border border-yale-blue text-yale-blue px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue hover:text-page-cream transition-all">
            <Pencil size={14} /> Edit
          </button>
          <input type="file" accept=".pdf,application/pdf" ref={fileInputRef} className="hidden" onChange={handlePDFUpload} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploadingPDF} className="flex items-center gap-2 bg-maple-rust text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50">
            {uploadingPDF ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadingPDF ? 'Extracting...' : 'Add PDF'}
          </button>
          <input type="file" accept="image/*" multiple ref={scanInputRef} className="hidden" onChange={handleScanUpload} />
          <button onClick={() => scanInputRef.current?.click()} disabled={uploadingScans} className="flex items-center gap-2 bg-porch-sage text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50">
            {uploadingScans ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
            {uploadingScans ? 'Uploading...' : 'Scan Notes'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="bg-parchment p-6 rounded-sm border border-maple-rust/40 shadow-cozy space-y-4">
          <h3 className="font-display text-lg text-yale-blue flex items-center gap-2"><Pencil size={16} className="text-maple-rust" /> Edit Exercise</h3>
          <div>
            <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Title</label>
            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm" />
          </div>
          <div>
            <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Content</label>
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm h-72 resize-y" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-4 py-2.5 text-coffee-cream hover:text-maple-rust font-label text-xs uppercase tracking-wider transition-colors">Cancel</button>
            <button onClick={handleSaveEdit} disabled={savingEdit} className="flex items-center gap-2 bg-porch-sage text-page-cream px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50">
              {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
          {chapter.pdf_url ? (
            <div className="w-full h-[800px] rounded-sm overflow-hidden border border-coffee-cream/20 bg-white">
              <iframe src={chapter.pdf_url} className="w-full h-full" title={chapter.title} />
            </div>
          ) : (
            <div className="font-body text-library-ink leading-relaxed text-sm max-h-[80vh] overflow-y-auto pr-2">
              {renderContent(chapter.content)}
            </div>
          )}
        </div>
      )}

      {scans.length > 0 && (
        <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-display text-lg text-yale-blue flex items-center gap-2">
              <ImageIcon size={18} className="text-maple-rust" /> Scanned Notes ({scans.length})
            </h4>
            <button
              onClick={() => setAnalysisSource('scans')}
              className={`px-3 py-1.5 rounded-sm font-label text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                analysisSource === 'scans' ? 'bg-maple-rust text-page-cream' : 'bg-page-cream border border-coffee-cream/20 text-coffee-cream hover:text-maple-rust'
              }`}
            >
              <Sparkles size={12} /> Use for AI Analysis
            </button>
          </div>
          <p className="font-body text-xs text-coffee-cream italic">Select "Scanned Notes" in the AI Assistant below to analyze these images.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {scans.map((s, idx) => (
              <div key={s.id} className="relative group rounded-sm overflow-hidden border border-coffee-cream/20 bg-page-cream">
                <img src={scanThumbUrls[s.id] || s.public_url} alt={`Scan ${idx + 1}`} loading="lazy" className="w-full h-40 object-cover bg-coffee-cream/10" />
                <div className="absolute inset-0 bg-yale-blue/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="font-label text-[0.6rem] uppercase tracking-wider text-page-cream">#{idx + 1}</span>
                  <button onClick={() => deleteScan(s)} className="text-page-cream hover:text-maple-rust"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Study Assistant */}
      <div className="bg-page-cream p-6 rounded-sm border-l-4 border-gilmore-gold shadow-cozy space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={18} className="text-gilmore-gold" />
          <h3 className="font-display text-lg text-yale-blue">AI Study Assistant</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="font-label text-xs uppercase tracking-wider text-coffee-cream">Analyze source:</span>
          <div className="flex bg-parchment border border-coffee-cream/20 rounded-sm p-1">
            <button
              type="button"
              onClick={() => setAnalysisSource('pdf')}
              className={`px-3 py-1.5 rounded-sm font-label text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                analysisSource === 'pdf' ? 'bg-maple-rust text-page-cream' : 'text-coffee-cream hover:text-maple-rust'
              }`}
            >
              <FileIcon size={12} /> PDF Content
            </button>
            {scans.length > 0 && (
              <button
                type="button"
                onClick={() => setAnalysisSource('scans')}
                className={`px-3 py-1.5 rounded-sm font-label text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  analysisSource === 'scans' ? 'bg-maple-rust text-page-cream' : 'text-coffee-cream hover:text-maple-rust'
                }`}
              >
                <ImageIcon size={12} /> Scanned Notes
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-label text-xs uppercase tracking-wider text-coffee-cream">Analyze pages:</span>
          <input
            type="number" min="1" value={fromPage} onChange={(e) => setFromPage(e.target.value)} placeholder="From (1)"
            className="w-24 p-2.5 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm disabled:opacity-50"
            disabled={analysisSource === 'scans'}
          />
          <span className="text-coffee-cream font-body">→</span>
          <input
            type="number" min="1" value={toPage} onChange={(e) => setToPage(e.target.value)} placeholder="To (10)"
            className="w-24 p-2.5 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm disabled:opacity-50"
            disabled={analysisSource === 'scans'}
          />
          <span className="font-body text-xs text-coffee-cream italic">
            {analysisSource === 'scans' ? 'Page ranges apply to PDFs only. Scans are analyzed as a whole.' : 'Leave empty to analyze the whole exercise.'}
          </span>
          {textBounds && analysisSource === 'pdf' && (
            <span className="font-body text-xs text-porch-sage italic">Readable text: pages {textBounds.first}–{textBounds.last}.</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => handleAnalyze('summarize')} disabled={analyzing} className="flex items-center gap-2 bg-yale-blue text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50">
            {analyzing && activeAction === 'summarize' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Summarize
          </button>
          <button onClick={() => handleAnalyze('explain')} disabled={analyzing} className="flex items-center gap-2 bg-porch-sage text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50">
            {analyzing && activeAction === 'explain' ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />} Explain Simply
          </button>
          <button onClick={() => handleAnalyze('keypoints')} disabled={analyzing} className="flex items-center gap-2 bg-gilmore-gold text-yale-blue px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all disabled:opacity-50">
            {analyzing && activeAction === 'keypoints' ? <Loader2 size={14} className="animate-spin" /> : <List size={14} />} Key Points
          </button>
          <button onClick={() => handleAnalyze('quiz')} disabled={analyzing} className="flex items-center gap-2 bg-maple-rust text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50">
            {analyzing && activeAction === 'quiz' ? <Loader2 size={14} className="animate-spin" /> : <HelpCircle size={14} />} Quiz (QCM)
          </button>
        </div>

        {retryMessage && (
          <div className="flex items-center gap-2 p-3 bg-gilmore-gold/10 border border-gilmore-gold/30 rounded-sm animate-fade-in-up">
            <Loader2 size={16} className="animate-spin text-gilmore-gold" />
            <span className="font-body text-sm text-gilmore-gold italic">{retryMessage}</span>
          </div>
        )}

        {chapterResult && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 relative">
              <button onClick={() => { setChapterResult(''); setActiveAction(null); setNoteTitle(''); setCacheHit(false); }} className="absolute top-2 right-2 text-coffee-cream/50 hover:text-maple-rust transition-colors"><X size={16} /></button>
              <MarkdownLite text={chapterResult} />
            </div>
            <div>
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Note title (optional)</label>
              <input type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="e.g. TD 3 corrections..." className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm" />
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
            <h3 className="font-display text-lg text-yale-blue">Ask questions about this exercise</h3>
          </div>
          <span className="font-label text-[0.65rem] uppercase tracking-wider text-coffee-cream bg-page-cream border border-coffee-cream/20 px-2 py-1 rounded-sm">
            {analysisSource === 'scans' ? '📷 Scanned Notes' : (chatHasRange ? `📖 Pages ${chatRangeFrom}–${chatRangeTo}` : '📖 Whole exercise')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-label text-xs uppercase tracking-wider text-coffee-cream">Answer from pages:</span>
          <input
            type="number" min="1" value={chatFromPage} onChange={(e) => setChatFromPage(e.target.value)} placeholder="From (1)"
            className="w-24 p-2.5 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm disabled:opacity-50"
            disabled={analysisSource === 'scans'}
          />
          <span className="text-coffee-cream font-body">→</span>
          <input
            type="number" min="1" value={chatToPage} onChange={(e) => setChatToPage(e.target.value)} placeholder="To (10)"
            className="w-24 p-2.5 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm disabled:opacity-50"
            disabled={analysisSource === 'scans'}
          />
          <span className="font-body text-xs text-coffee-cream italic">
             {analysisSource === 'scans' ? 'Page ranges apply to PDFs only.' : 'Leave empty to use the whole exercise.'}
          </span>
        </div>

        <div className="bg-page-cream/50 rounded-sm border border-coffee-cream/20 h-64 overflow-y-auto p-4 space-y-3">
          {chatMessages.length === 0 ? (
            <p className="text-center text-coffee-cream italic text-sm py-8">Ask me anything about the selected source!</p>
          ) : (
            chatMessages.map((msg, idx) => (
              <div key={idx} className={`max-w-[85%] p-3 rounded-sm text-sm leading-relaxed ${msg.role === 'user' ? 'bg-yale-blue text-page-cream rounded-br-none' : 'bg-parchment border border-coffee-cream/20 text-library-ink rounded-bl-none'}`}>
                {msg.role === 'user' ? msg.content : <MarkdownLite text={msg.content} className="text-[0.85rem]" />}
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
          {chatRetryMessage && (
            <div className="flex justify-start">
              <div className="bg-gilmore-gold/10 border border-gilmore-gold/30 p-3 rounded-sm rounded-bl-none flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-gilmore-gold" />
                <span className="text-sm text-gilmore-gold italic">{chatRetryMessage}</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={handleAskQuestion} className="flex gap-2">
          <input
            type="text" value={questionInput} onChange={(e) => setQuestionInput(e.target.value)} placeholder="e.g. How do I solve exercise 2? / What method is used here?" disabled={isAsking}
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
          <h4 className="font-display text-lg text-yale-blue flex items-center gap-2"><FileText size={18} /> Notes for "{chapter.title}"</h4>
          <button onClick={() => setShowNoteForm(!showNoteForm)} className="flex items-center gap-1 bg-porch-sage text-page-cream px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all">
            <Plus size={14} /> Add a note
          </button>
        </div>

        {showNoteForm && (
          <form onSubmit={handleAddManualNote} className="space-y-3 bg-page-cream p-4 rounded-sm border border-coffee-cream/20 animate-fade-in-up">
            <input type="text" value={noteFormTitle} onChange={(e) => setNoteFormTitle(e.target.value)} placeholder="Note title (optional)" className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm" />
            <textarea required value={noteFormText} onChange={(e) => setNoteFormText(e.target.value)} placeholder="Write your note here..." className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm h-32 resize-y" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNoteForm(false)} className="px-4 py-2 text-coffee-cream hover:text-maple-rust font-label text-xs uppercase tracking-wider">Cancel</button>
              <button type="submit" disabled={savingNote} className="flex items-center gap-2 bg-maple-rust text-page-cream px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50">
                {savingNote ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            </div>
          </form>
        )}

        {savedNotes.length === 0 && !showNoteForm ? (
          <p className="text-center text-coffee-cream italic text-sm py-4">No notes yet. Save an AI analysis or add your own note!</p>
        ) : (
          <div className="space-y-3">
            {savedNotes.filter(note => !note.original_text?.startsWith(chapter.id + '_')).map((note, idx) => (
              <div key={note.id} className="bg-page-cream border border-coffee-cream/20 rounded-sm overflow-hidden">
                <div onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)} className="w-full flex items-center justify-between p-3 hover:bg-coffee-cream/10 transition-colors text-left cursor-pointer" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedNote(expandedNote === note.id ? null : note.id); }}>
                  <div className="flex-1">
                    <span className="font-body text-sm font-medium text-library-ink">{note.title || `Note ${idx + 1}`}</span>
                    <span className="font-label text-xs text-coffee-cream ml-2">• {new Date(note.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} className="text-coffee-cream/40 hover:text-maple-rust transition-colors"><Trash2 size={14} /></button>
                    <ChevronDown size={16} className={`text-coffee-cream transition-transform ${expandedNote === note.id ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {expandedNote === note.id && (
                  <div className="p-4 border-t border-coffee-cream/20 space-y-4 animate-fade-in-up">
                    {note.manual_note && (
                      <div>
                        <h5 className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2 flex items-center gap-1"><StickyNote size={12} /> Your Note</h5>
                        <MarkdownLite text={note.manual_note} />
                      </div>
                    )}
                    {note.ai_summary && (
                      <div>
                        <h5 className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2 flex items-center gap-1"><FileText size={12} /> Summary</h5>
                        <MarkdownLite text={note.ai_summary} />
                      </div>
                    )}
                    {note.ai_explanation && (
                      <div>
                        <h5 className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2 flex items-center gap-1"><Lightbulb size={12} /> Simple Explanation</h5>
                        <MarkdownLite text={note.ai_explanation} />
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