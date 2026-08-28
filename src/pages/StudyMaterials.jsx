import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { extractTextFromPDF } from '../utils/pdfWorker';
import { 
  BookOpen, Plus, Trash2, ArrowLeft, Loader2, 
  Sparkles, FileText, Lightbulb, List, X, ChevronRight,
  Save, CheckCircle, ChevronDown, Upload, FileText as FileIcon,
  MessageCircle, Send
} from 'lucide-react';

export default function StudyMaterials() {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showChapterForm, setShowChapterForm] = useState(false);
  
  const [showPDFUpload, setShowPDFUpload] = useState(false);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfTitle, setPdfTitle] = useState('');
  
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const [analyzing, setAnalyzing] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [chapterResult, setChapterResult] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [savedNotes, setSavedNotes] = useState([]);
  const [expandedNote, setExpandedNote] = useState(null);
  const [noteTitle, setNoteTitle] = useState('');

  const [chatMessages, setChatMessages] = useState([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef(null);
  const notesSectionRef = useRef(null);

  const [newMaterial, setNewMaterial] = useState({ title: '', description: '' });
  const [newChapter, setNewChapter] = useState({ title: '', content: '' });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, message: '', type: 'success' });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  useEffect(() => {
    if (user) fetchMaterials();
  }, [user]);

  useEffect(() => {
    if (materialId && materials.length > 0) {
      const material = materials.find(m => m.id === materialId);
      if (material) {
        setSelectedMaterial(material);
        fetchChapters(materialId);
      }
    } else if (!materialId) {
      setSelectedMaterial(null);
      setChapters([]);
      setSelectedChapter(null);
    }
  }, [materialId, materials]);

  useEffect(() => {
    if (selectedChapter) {
      fetchChapterNotes();
      setChatMessages([]);
      setQuestionInput('');
    }
  }, [selectedChapter]);

  const fetchMaterials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!error) setMaterials(data || []);
    setLoading(false);
  };

  const fetchChapters = async (matId) => {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('material_id', matId)
      .order('created_at', { ascending: false });
    
    if (!error) setChapters(data || []);
  };

  const fetchChapterNotes = async () => {
    if (!selectedChapter) return;
    const { data, error } = await supabase
      .from('chapter_notes')
      .select('*')
      .eq('chapter_id', selectedChapter.id)
      .order('created_at', { ascending: false });
    
    if (!error) setSavedNotes(data || []);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setPdfTitle(file.name.replace(/\.pdf$/i, ''));
    }
  };

  const handlePDFSubmit = async (e) => {
    e.preventDefault();
    if (!pdfFile) return;

    setUploadingPDF(true);
    try {
      const extractedText = await extractTextFromPDF(pdfFile);
      
      const { data, error } = await supabase
        .from('chapters')
        .insert([{ 
          user_id: user.id, 
          material_id: selectedMaterial.id, 
          title: pdfTitle.trim() || 'Untitled Chapter',
          content: extractedText,
          is_from_pdf: true
        }])
        .select()
        .single();

      if (error) throw error;
      
      setChapters([data, ...chapters]);
      setShowPDFUpload(false);
      setPdfFile(null);
      setPdfTitle('');
      
      showNotification(`PDF imported successfully! Extracted ${extractedText.length} characters.`);
    } catch (err) {
      console.error('PDF upload error:', err);
      showNotification(`Failed to process PDF: ${err.message}`, 'error');
    }
    setUploadingPDF(false);
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('materials')
      .insert([{ user_id: user.id, ...newMaterial }])
      .select()
      .single();
    
    if (!error) {
      setMaterials([data, ...materials]);
      setNewMaterial({ title: '', description: '' });
      setShowMaterialForm(false);
      navigate(`/study-materials/${data.id}`);
      showNotification('Material created successfully!');
    } else {
      showNotification('Failed to create material.', 'error');
    }
  };

  const handleAddChapter = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('chapters')
      .insert([{ 
        user_id: user.id, 
        material_id: selectedMaterial.id, 
        ...newChapter 
      }])
      .select()
      .single();
    
    if (!error) {
      setChapters([data, ...chapters]);
      setNewChapter({ title: '', content: '' });
      setShowChapterForm(false);
      showNotification('Chapter added successfully!');
    } else {
      showNotification('Failed to add chapter.', 'error');
    }
  };

  const handleAnalyze = async (action) => {
    if (!selectedChapter || !selectedChapter.content) return;
    
    setAnalyzing(true);
    setActiveAction(action);
    setChapterResult('');
    setJustSaved(false);
    setNoteTitle('');

    try {
      const textToSend = selectedChapter.content.substring(0, 2500);

      let systemPrompt = "";
      if (action === 'summarize') {
        systemPrompt = "Provide a concise, clear summary of this study material. Focus on the main concepts and key takeaways in 2-3 paragraphs.";
      } else if (action === 'explain') {
        systemPrompt = "Explain this content in simple, clear terms, breaking down any complex concepts or jargon.";
      } else if (action === 'keypoints') {
        systemPrompt = "Extract the 5-7 most important key points. Return as a bulleted list.";
      }

      const { data, error } = await supabase.functions.invoke('summarize-text', {
        body: { 
          text: textToSend, 
          action: action,
          custom_prompt: systemPrompt
        }
      });

      if (error) throw new Error(error.message || 'Failed to analyze');

      setChapterResult(data.result);
      showNotification('Analysis complete!');
    } catch (err) {
      console.error('Analysis error:', err);
      showNotification(`Failed to analyze: ${err.message}`, 'error');
    }
    setAnalyzing(false);
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!questionInput.trim() || !selectedChapter) return;

    const userQuestion = questionInput.trim();
    setQuestionInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userQuestion }]);
    setIsAsking(true);

    try {
      const context = selectedChapter.content.substring(0, 6000);
      
      const { data, error } = await supabase.functions.invoke('ask-chapter', {
        body: { question: userQuestion, context: context }
      });

      if (error) throw error;

      setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      console.error('Q&A Error:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that question. Please try again." }]);
      showNotification('Failed to get answer.', 'error');
    }
    setIsAsking(false);
  };

  const handleSaveNote = async () => {
    if (!chapterResult || !selectedChapter || !activeAction) return;

    const finalTitle = noteTitle.trim() || `${activeAction.charAt(0).toUpperCase() + activeAction.slice(1)} - ${new Date().toLocaleDateString()}`;

    try {
      const noteData = {
        user_id: user.id,
        chapter_id: selectedChapter.id,
        title: finalTitle,
        original_text: selectedChapter.content,
      };

      if (activeAction === 'summarize') noteData.ai_summary = chapterResult;
      else if (activeAction === 'explain') noteData.ai_explanation = chapterResult;
      else if (activeAction === 'keypoints') noteData.ai_key_points = chapterResult.split('\n').filter(line => line.trim());

      const { error } = await supabase.from('chapter_notes').insert([noteData]);
      if (error) throw error;

      setJustSaved(true);
      await fetchChapterNotes();
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

  const deleteMaterial = async (id) => {
    await supabase.from('materials').delete().eq('id', id);
    setMaterials(materials.filter(m => m.id !== id));
    if (selectedMaterial?.id === id) {
      navigate('/study-materials');
      setSelectedMaterial(null);
      setChapters([]);
      setSelectedChapter(null);
    }
    showNotification('Material deleted.');
  };

  const deleteChapter = async (id) => {
    await supabase.from('chapters').delete().eq('id', id);
    setChapters(chapters.filter(c => c.id !== id));
    if (selectedChapter?.id === id) setSelectedChapter(null);
    showNotification('Chapter deleted.');
  };

  const deleteNote = async (id) => {
    await supabase.from('chapter_notes').delete().eq('id', id);
    setSavedNotes(savedNotes.filter(n => n.id !== id));
    showNotification('Note deleted.');
  };

  const handleBack = () => {
    navigate('/study-materials');
    setSelectedMaterial(null);
    setChapters([]);
    setSelectedChapter(null);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-20 text-center">
        <Loader2 size={32} className="animate-spin mx-auto text-coffee-cream mb-4" />
        <p className="font-body text-coffee-cream italic">Loading your materials...</p>
      </div>
    );
  }

  if (selectedMaterial) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
        {notification.show && (
          <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-cozy border animate-fade-in-up flex items-center gap-3 ${
            notification.type === 'error' 
              ? 'bg-maple-rust text-page-cream border-maple-rust' 
              : 'bg-porch-sage text-page-cream border-porch-sage'
          }`}>
            {notification.type === 'error' ? <X size={18} /> : <CheckCircle size={18} />}
            <span className="font-body text-sm">{notification.message}</span>
            <button 
              onClick={() => setNotification({ show: false, message: '', type: 'success' })}
              className="ml-2 text-page-cream/70 hover:text-page-cream"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="flex items-center gap-2 text-coffee-cream hover:text-maple-rust transition-colors">
            <ArrowLeft size={20} /> Back to Materials
          </button>
        </div>

        <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <h1 className="font-display text-3xl text-yale-blue mb-2">{selectedMaterial.title}</h1>
          {selectedMaterial.description && <p className="font-body text-coffee-cream">{selectedMaterial.description}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-display text-lg text-yale-blue flex items-center gap-2">
                <BookOpen size={20} /> Chapters
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setShowPDFUpload(!showPDFUpload)} className="text-maple-rust hover:text-yale-blue font-label text-xs uppercase tracking-wider flex items-center gap-1">
                  <Upload size={14} /> Import PDF
                </button>
                <button onClick={() => setShowChapterForm(!showChapterForm)} className="text-maple-rust hover:text-yale-blue font-label text-xs uppercase tracking-wider flex items-center gap-1">
                  <Plus size={14} /> Add Chapter
                </button>
              </div>
            </div>

            {showPDFUpload && (
              <form onSubmit={handlePDFSubmit} className="bg-page-cream p-4 rounded-sm border border-coffee-cream/20 space-y-3 animate-fade-in-up">
                <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream">1. Select PDF Document</label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileSelect}
                  disabled={uploadingPDF}
                  className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
                />
                
                {pdfFile && (
                  <div className="animate-fade-in-up">
                    <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">2. Chapter Title (Editable)</label>
                    <input
                      type="text"
                      value={pdfTitle}
                      onChange={(e) => setPdfTitle(e.target.value)}
                      placeholder="Enter chapter title"
                      disabled={uploadingPDF}
                      className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
                    />
                  </div>
                )}

                {uploadingPDF && (
                  <div className="flex items-center gap-2 text-coffee-cream text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    Extracting text from PDF...
                  </div>
                )}
                
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={!pdfFile || uploadingPDF}
                    className="flex-1 bg-maple-rust text-page-cream px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploadingPDF ? 'Processing...' : 'Import PDF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPDFUpload(false); setPdfFile(null); setPdfTitle(''); }}
                    className="px-3 py-2 text-coffee-cream hover:text-maple-rust text-sm"
                  >
                    <X size={16} />
                  </button>
                </div>
              </form>
            )}

            {showChapterForm && (
              <form onSubmit={handleAddChapter} className="bg-page-cream p-4 rounded-sm border border-coffee-cream/20 space-y-3 animate-fade-in-up">
                <input type="text" required value={newChapter.title} onChange={(e) => setNewChapter({...newChapter, title: e.target.value})} placeholder="Chapter Title" className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm" />
                <textarea value={newChapter.content} onChange={(e) => setNewChapter({...newChapter, content: e.target.value})} placeholder="Chapter Content..." className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm h-32 resize-none" />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-maple-rust text-page-cream px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all">Save Chapter</button>
                  <button type="button" onClick={() => setShowChapterForm(false)} className="px-3 py-2 text-coffee-cream hover:text-maple-rust"><X size={16} /></button>
                </div>
              </form>
            )}

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {chapters.length === 0 ? (
                <p className="text-center text-coffee-cream italic py-4 text-sm">No chapters yet.</p>
              ) : (
                chapters.map((chapter) => (
                  <div key={chapter.id} onClick={() => setSelectedChapter(chapter)} className={`p-4 rounded-sm border cursor-pointer transition-all group ${selectedChapter?.id === chapter.id ? 'bg-page-cream border-maple-rust shadow-cozy' : 'bg-parchment border-coffee-cream/20 hover:border-coffee-cream/50'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          {chapter.is_from_pdf && <FileIcon size={14} className="text-maple-rust" />}
                          <h4 className="font-body text-sm font-medium text-library-ink group-hover:text-maple-rust transition-colors">{chapter.title}</h4>
                        </div>
                        <p className="font-label text-[0.6rem] text-coffee-cream mt-1">{new Date(chapter.created_at).toLocaleDateString()}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteChapter(chapter.id); }} className="text-coffee-cream/40 hover:text-maple-rust opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {selectedChapter ? (
              <>
                {/* Chapter Content */}
                <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="font-display text-xl text-yale-blue">{selectedChapter.title}</h2>
                    {selectedChapter.is_from_pdf && <span className="text-[0.6rem] bg-maple-rust/20 text-maple-rust px-2 py-1 rounded-sm font-label uppercase">PDF Import</span>}
                  </div>
                  <div className="font-body text-library-ink whitespace-pre-wrap leading-relaxed text-sm max-h-96 overflow-y-auto">
                    {selectedChapter.content}
                  </div>
                </div>

                {/* AI Study Assistant */}
                <div className="bg-page-cream p-6 rounded-sm border-l-4 border-gilmore-gold shadow-cozy space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={18} className="text-gilmore-gold" />
                    <h3 className="font-display text-lg text-yale-blue">AI Study Assistant</h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleAnalyze('summarize')} disabled={analyzing || !selectedChapter.content} className="flex items-center gap-2 bg-yale-blue text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50">
                      {analyzing && activeAction === 'summarize' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Summarize
                    </button>
                    <button onClick={() => handleAnalyze('explain')} disabled={analyzing || !selectedChapter.content} className="flex items-center gap-2 bg-porch-sage text-page-cream px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all disabled:opacity-50">
                      {analyzing && activeAction === 'explain' ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />} Explain Simply
                    </button>
                    <button onClick={() => handleAnalyze('keypoints')} disabled={analyzing || !selectedChapter.content} className="flex items-center gap-2 bg-gilmore-gold text-yale-blue px-4 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all disabled:opacity-50">
                      {analyzing && activeAction === 'keypoints' ? <Loader2 size={14} className="animate-spin" /> : <List size={14} />} Key Points
                    </button>
                  </div>

                  {chapterResult && (
                    <div className="space-y-4 animate-fade-in-up">
                      <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 relative">
                        <button onClick={() => { setChapterResult(''); setActiveAction(null); setNoteTitle(''); }} className="absolute top-2 right-2 text-coffee-cream/50 hover:text-maple-rust transition-colors"><X size={16} /></button>
                        <p className="font-body text-sm text-library-ink whitespace-pre-wrap leading-relaxed pr-6">{chapterResult}</p>
                      </div>
                      <div>
                        <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">Note Title (optional)</label>
                        <input type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="e.g., Chapter 1 Summary..." className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm" />
                      </div>
                      <div className="flex justify-end">
                        <button onClick={handleSaveNote} disabled={justSaved} className={`flex items-center gap-2 px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider transition-all duration-300 ${justSaved ? 'bg-porch-sage text-page-cream cursor-default' : 'bg-maple-rust text-page-cream hover:bg-yale-blue'}`}>
                          {justSaved ? <><CheckCircle size={14} /> Saved!</> : <><Save size={14} /> Save to Notes</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ✅ AI Q&A Chat — correctement placé APRÈS l'AI Assistant */}
                <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle size={18} className="text-maple-rust" />
                    <h3 className="font-display text-lg text-yale-blue">Ask Questions About This Chapter</h3>
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
                      placeholder="e.g., What is the main cause of...?"
                      disabled={isAsking}
                      className="flex-1 p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isAsking || !questionInput.trim()}
                      className="bg-maple-rust text-page-cream px-4 py-3 rounded-sm hover:bg-yale-blue transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send size={18} />
                    </button>
                  </form>
                </div>

                {/* ✅ Saved Notes — avec la correction <div> au lieu de <button> */}
                {savedNotes.length > 0 && (
                  <div ref={notesSectionRef} className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-4">
                    <h4 className="font-display text-lg text-yale-blue flex items-center gap-2">
                      <FileText size={18} />
                      Notes for "{selectedChapter.title}"
                    </h4>
                    
                    <div className="space-y-3">
                      {savedNotes.map((note, idx) => (
                        <div key={note.id} className="bg-page-cream border border-coffee-cream/20 rounded-sm overflow-hidden">
                          {/* ✅ CORRECTION : <div> au lieu de <button> pour éviter le bouton imbriqué */}
                          <div
                            onClick={() => setExpandedNote(expandedNote === note.id ? null : note.id)}
                            className="w-full flex items-center justify-between p-3 hover:bg-coffee-cream/10 transition-colors text-left cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedNote(expandedNote === note.id ? null : note.id); }}
                          >
                            <div className="flex-1">
                              <span className="font-body text-sm font-medium text-library-ink">
                                {note.title || `Note ${idx + 1}`}
                              </span>
                              <span className="font-label text-xs text-coffee-cream ml-2">
                                • {new Date(note.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                                className="text-coffee-cream/40 hover:text-maple-rust transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                              <ChevronDown 
                                size={16} 
                                className={`text-coffee-cream transition-transform ${expandedNote === note.id ? 'rotate-180' : ''}`}
                              />
                            </div>
                          </div>

                          {expandedNote === note.id && (
                            <div className="p-4 border-t border-coffee-cream/20 space-y-4 animate-fade-in-up">
                              {note.ai_summary && (
                                <div>
                                  <h5 className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2 flex items-center gap-1">
                                    <FileText size={12} /> Summary
                                  </h5>
                                  <p className="font-body text-sm text-library-ink leading-relaxed whitespace-pre-wrap">
                                    {note.ai_summary}
                                  </p>
                                </div>
                              )}
                              
                              {note.ai_explanation && (
                                <div>
                                  <h5 className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2 flex items-center gap-1">
                                    <Lightbulb size={12} /> Simple Explanation
                                  </h5>
                                  <p className="font-body text-sm text-library-ink leading-relaxed whitespace-pre-wrap">
                                    {note.ai_explanation}
                                  </p>
                                </div>
                              )}
                              
                              {note.ai_key_points && note.ai_key_points.length > 0 && (
                                <div>
                                  <h5 className="font-label text-xs uppercase tracking-wider text-coffee-cream mb-2 flex items-center gap-1">
                                    <List size={12} /> Key Points
                                  </h5>
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
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-coffee-cream italic py-20 bg-parchment/50 rounded-sm border border-coffee-cream/20">
                <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
                <p>Select a chapter to view content and use AI tools</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      {notification.show && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-sm shadow-cozy border animate-fade-in-up flex items-center gap-3 ${
          notification.type === 'error' 
            ? 'bg-maple-rust text-page-cream border-maple-rust' 
            : 'bg-porch-sage text-page-cream border-porch-sage'
        }`}>
          {notification.type === 'error' ? <X size={18} /> : <CheckCircle size={18} />}
          <span className="font-body text-sm">{notification.message}</span>
          <button 
            onClick={() => setNotification({ show: false, message: '', type: 'success' })}
            className="ml-2 text-page-cream/70 hover:text-page-cream"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div>
          <p className="eyebrow mb-2">Academic Resources</p>
          <h1 className="font-display text-4xl text-yale-blue">Study <span className="italic text-maple-rust">Materials</span>.</h1>
        </div>
        <button onClick={() => setShowMaterialForm(!showMaterialForm)} className="flex items-center gap-2 bg-yale-blue text-page-cream px-5 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all">
          <Plus size={16} /> {showMaterialForm ? 'Cancel' : 'New Material'}
        </button>
      </div>

      {showMaterialForm && (
        <form onSubmit={handleAddMaterial} className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-4 animate-fade-in-up">
          <input type="text" required value={newMaterial.title} onChange={(e) => setNewMaterial({...newMaterial, title: e.target.value})} placeholder="Material Title (e.g., Mathematics 101)" className="w-full p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body" />
          <textarea value={newMaterial.description} onChange={(e) => setNewMaterial({...newMaterial, description: e.target.value})} placeholder="Description (optional)" className="w-full p-3 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body h-24 resize-none" />
          <button type="submit" className="bg-maple-rust text-page-cream px-6 py-2.5 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all">Create Material</button>
        </form>
      )}

      {materials.length === 0 ? (
        <div className="text-center py-20 bg-parchment/50 rounded-sm border border-coffee-cream/20">
          <BookOpen size={64} className="mx-auto mb-4 text-coffee-cream/30" />
          <p className="font-body text-coffee-cream italic mb-4">No study materials yet.</p>
          <button onClick={() => setShowMaterialForm(true)} className="inline-flex items-center gap-2 bg-yale-blue text-page-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all">
            <Plus size={16} /> Create Your First Material
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {materials.map((material, idx) => (
            <div key={material.id} onClick={() => navigate(`/study-materials/${material.id}`)} className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy hover:border-maple-rust/50 transition-all cursor-pointer group animate-fade-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 bg-yale-blue/10 rounded-sm">
                  <BookOpen size={24} className="text-yale-blue group-hover:text-maple-rust transition-colors" />
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteMaterial(material.id); }} className="text-coffee-cream/40 hover:text-maple-rust opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
              </div>
              <h3 className="font-display text-xl text-yale-blue mb-2 group-hover:text-maple-rust transition-colors">{material.title}</h3>
              {material.description && <p className="font-body text-sm text-coffee-cream line-clamp-2 mb-4">{material.description}</p>}
              <div className="flex items-center justify-between pt-4 border-t border-coffee-cream/10">
                <span className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">Click to view chapters</span>
                <ChevronRight size={16} className="text-coffee-cream/50 group-hover:text-maple-rust group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}