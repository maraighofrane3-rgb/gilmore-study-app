import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  BookOpen, Plus, Trash2, ArrowLeft, Loader2, 
  Sparkles, FileText, Lightbulb, List, X, ChevronRight,
  Save, CheckCircle, ChevronDown, Upload, FileText as FileIcon,
  MessageCircle, Send, PenTool, Image as ImageIcon
} from 'lucide-react';

export default function StudyMaterials() {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  
  // Separate forms for chapters vs exercises
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  
  // Scan states
  const [showChapterScan, setShowChapterScan] = useState(false);
  const [showExerciseScan, setShowExerciseScan] = useState(false);
  const [scanFiles, setScanFiles] = useState([]);
  const [scanTitle, setScanTitle] = useState('');
  const [uploadingScans, setUploadingScans] = useState(false);
  
  const [showPDFUpload, setShowPDFUpload] = useState(false);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfCategory, setPdfCategory] = useState('chapter'); // Track which category the PDF belongs to
  
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const [newMaterial, setNewMaterial] = useState({ title: '', description: '' });
  const [newChapter, setNewChapter] = useState({ title: '', content: '' });
  const [newExercise, setNewExercise] = useState({ title: '', content: '' });

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
    }
  }, [materialId, materials]);

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

  const handleScanFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    setScanFiles(files);
    if (files.length > 0 && !scanTitle) {
      setScanTitle(`Scanned Notes ${new Date().toLocaleDateString()}`);
    }
  };

  const handlePDFSubmit = async (e) => {
    e.preventDefault();
    if (!pdfFile) return;

    setUploadingPDF(true);
    try {
      const { extractTextFromPDF } = await import('../utils/pdfWorker');
      const extractedText = await extractTextFromPDF(pdfFile);
      
      const fileExt = pdfFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pdf-documents')
        .upload(fileName, pdfFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pdf-documents')
        .getPublicUrl(fileName);

      const { data, error } = await supabase
        .from('chapters')
        .insert([{ 
          user_id: user.id, 
          material_id: selectedMaterial.id, 
          title: pdfTitle.trim() || 'Untitled',
          content: extractedText,
          pdf_url: publicUrl,
          file_path: fileName,
          is_from_pdf: true,
          has_images: true,
          category: pdfCategory
        }])
        .select()
        .single();

      if (error) throw error;
      
      setChapters([data, ...chapters]);
      setShowPDFUpload(false);
      setPdfFile(null);
      setPdfTitle('');
      
      showNotification(`PDF uploaded successfully! Text extracted for AI analysis.`);
      
      const route = pdfCategory === 'exercise' ? 'exercise' : 'chapter';
      navigate(`/study-materials/${selectedMaterial.id}/${route}/${data.id}`);
    } catch (err) {
      console.error('PDF upload error:', err);
      showNotification(`Failed to upload PDF: ${err.message}`, 'error');
    }
    setUploadingPDF(false);
  };

  const handleScanUpload = async (category, e) => {
    e.preventDefault();
    if (scanFiles.length === 0) return;

    setUploadingScans(true);
    try {
      // 1. Create a new chapter/exercise entry for these scans
      const { data: docData, error: docError } = await supabase
        .from('chapters')
        .insert([{
          user_id: user.id,
          material_id: selectedMaterial.id,
          title: scanTitle.trim() || `Scanned ${category}`,
          content: '',
          category: category,
          is_from_pdf: false
        }])
        .select()
        .single();

      if (docError) throw docError;

      // 2. Upload each image and link it to the new document
      for (let i = 0; i < scanFiles.length; i++) {
        const file = scanFiles[i];
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `${user.id}/scans/${Date.now()}-${i}.${ext}`;
        
        const { error: upErr } = await supabase.storage
          .from('scan-notes')
          .upload(path, file);
        
        if (upErr) throw upErr;
        
        const { data: { publicUrl } } = supabase.storage
          .from('scan-notes')
          .getPublicUrl(path);
        
        await supabase.from('doc_scans').insert([{
          user_id: user.id,
          doc_id: docData.id,
          file_path: path,
          public_url: publicUrl,
          label: `Page ${i + 1}`,
          position: i,
        }]);
      }
      
      showNotification(`${scanFiles.length} scan${scanFiles.length > 1 ? 's' : ''} uploaded successfully!`);
      
      // Reset state
      setShowChapterScan(false);
      setShowExerciseScan(false);
      setScanFiles([]);
      setScanTitle('');
      
      // Navigate to the newly created document
      navigate(`/study-materials/${selectedMaterial.id}/${category}/${docData.id}`);
      
    } catch (err) {
      console.error('Scan upload error:', err);
      showNotification(`Failed to upload scans: ${err.message}`, 'error');
    }
    setUploadingScans(false);
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
        ...newChapter,
        category: 'chapter'
      }])
      .select()
      .single();
    
    if (!error) {
      setChapters([data, ...chapters]);
      setNewChapter({ title: '', content: '' });
      setShowChapterForm(false);
      showNotification('Chapter added successfully!');
      navigate(`/study-materials/${selectedMaterial.id}/chapter/${data.id}`);
    } else {
      showNotification('Failed to add chapter.', 'error');
    }
  };

  const handleAddExercise = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('chapters')
      .insert([{ 
        user_id: user.id, 
        material_id: selectedMaterial.id, 
        ...newExercise,
        category: 'exercise'
      }])
      .select()
      .single();
    
    if (!error) {
      setChapters([data, ...chapters]);
      setNewExercise({ title: '', content: '' });
      setShowExerciseForm(false);
      showNotification('Exercise added successfully!');
      navigate(`/study-materials/${selectedMaterial.id}/exercise/${data.id}`);
    } else {
      showNotification('Failed to add exercise.', 'error');
    }
  };

  const deleteMaterial = async (id) => {
    await supabase.from('materials').delete().eq('id', id);
    setMaterials(materials.filter(m => m.id !== id));
    if (selectedMaterial?.id === id) {
      navigate('/study-materials');
      setSelectedMaterial(null);
      setChapters([]);
    }
    showNotification('Material deleted.');
  };

  const deleteChapter = async (id) => {
    await supabase.from('chapters').delete().eq('id', id);
    setChapters(chapters.filter(c => c.id !== id));
    showNotification('Item deleted.');
  };

  const handleBack = () => {
    navigate('/study-materials');
    setSelectedMaterial(null);
    setChapters([]);
  };

  // 🆕 Split chapters into two lists
  const chaptersList = chapters.filter(c => (c.category || 'chapter') === 'chapter');
  const exercisesList = chapters.filter(c => c.category === 'exercise');

  // 📄 Shared PDF import form
  const renderPdfForm = () => (
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
          <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-1">2. Title (Editable)</label>
          <input
            type="text"
            value={pdfTitle}
            onChange={(e) => setPdfTitle(e.target.value)}
            placeholder="Enter title"
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
  );

  // 📷 Shared Scan form
  const renderScanForm = (category) => (
    <form onSubmit={(e) => handleScanUpload(category, e)} className="bg-page-cream p-4 rounded-sm border border-coffee-cream/20 space-y-3 animate-fade-in-up">
      <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream">1. Select Images (photos of notes, exercises, etc.)</label>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleScanFileSelect}
        disabled={uploadingScans}
        className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
      />
      {scanFiles.length > 0 && (
        <div className="animate-fade-in-up space-y-2">
          <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream">2. Title (Optional)</label>
          <input
            type="text"
            value={scanTitle}
            onChange={(e) => setScanTitle(e.target.value)}
            placeholder="e.g., TD 3 Solutions, Lecture Notes"
            disabled={uploadingScans}
            className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm"
          />
          <p className="font-body text-xs text-coffee-cream italic">
            {scanFiles.length} file{scanFiles.length > 1 ? 's' : ''} selected. A new {category} will be created for these scans.
          </p>
        </div>
      )}
      {uploadingScans && (
        <div className="flex items-center gap-2 text-coffee-cream text-sm">
          <Loader2 size={14} className="animate-spin" />
          Uploading scans...
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={scanFiles.length === 0 || uploadingScans}
          className={`flex-1 text-page-cream px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            category === 'chapter' ? 'bg-maple-rust hover:bg-yale-blue' : 'bg-porch-sage hover:bg-maple-rust'
          }`}
        >
          {uploadingScans ? 'Uploading...' : 'Upload Scans'}
        </button>
        <button
          type="button"
          onClick={() => { 
            if (category === 'chapter') setShowChapterScan(false); 
            else setShowExerciseScan(false); 
            setScanFiles([]); 
            setScanTitle(''); 
          }}
          className="px-3 py-2 text-coffee-cream hover:text-maple-rust text-sm"
        >
          <X size={16} />
        </button>
      </div>
    </form>
  );

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

        {/* 📚 Two shelves, full width */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

          {/* ── 📖 CHAPTERS & LECTURES ── */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-display text-lg text-yale-blue flex items-center gap-2">
                <BookOpen size={20} className="text-maple-rust" />
                Chapters & Lectures
                <span className="font-label text-[0.6rem] text-coffee-cream bg-page-cream border border-coffee-cream/20 px-2 py-0.5 rounded-full">
                  {chaptersList.length}
                </span>
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setShowPDFUpload(!showPDFUpload); setPdfCategory('chapter'); setShowChapterForm(false); setShowChapterScan(false); }} 
                  className="text-maple-rust hover:text-yale-blue font-label text-xs uppercase tracking-wider flex items-center gap-1"
                >
                  <Upload size={14} /> Import PDF
                </button>
                <button 
                  onClick={() => { setShowChapterScan(!showChapterScan); setShowPDFUpload(false); setShowChapterForm(false); }} 
                  className="text-maple-rust hover:text-yale-blue font-label text-xs uppercase tracking-wider flex items-center gap-1"
                >
                  <ImageIcon size={14} /> Scan
                </button>
                <button 
                  onClick={() => { setShowChapterForm(!showChapterForm); setShowPDFUpload(false); setShowChapterScan(false); }} 
                  className="text-maple-rust hover:text-yale-blue font-label text-xs uppercase tracking-wider flex items-center gap-1"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {showPDFUpload && pdfCategory === 'chapter' && renderPdfForm()}
            {showChapterScan && renderScanForm('chapter')}

            {showChapterForm && (
              <form onSubmit={handleAddChapter} className="bg-page-cream p-4 rounded-sm border border-coffee-cream/20 space-y-3 animate-fade-in-up">
                <input 
                  type="text" required value={newChapter.title} 
                  onChange={(e) => setNewChapter({...newChapter, title: e.target.value})} 
                  placeholder="Chapter Title" 
                  className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm" 
                />
                <textarea 
                  value={newChapter.content} 
                  onChange={(e) => setNewChapter({...newChapter, content: e.target.value})} 
                  placeholder="Chapter Content..." 
                  className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm h-32 resize-none" 
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-maple-rust text-page-cream px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all">Save Chapter</button>
                  <button type="button" onClick={() => setShowChapterForm(false)} className="px-3 py-2 text-coffee-cream hover:text-maple-rust"><X size={16} /></button>
                </div>
              </form>
            )}

            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-2">
              {chaptersList.length === 0 ? (
                <div className="border border-dashed border-coffee-cream/30 rounded-sm p-8 text-center">
                  <BookOpen size={28} className="mx-auto mb-3 text-coffee-cream/40" />
                  <p className="text-coffee-cream italic text-sm">No chapters yet — import a PDF, scan notes, or add one by hand.</p>
                </div>
              ) : (
                chaptersList.map((chapter) => (
                  <div 
                    key={chapter.id} 
                    onClick={() => navigate(`/study-materials/${selectedMaterial.id}/chapter/${chapter.id}`)} 
                    className="p-4 rounded-sm border cursor-pointer transition-all group bg-parchment border-coffee-cream/20 hover:border-maple-rust/60 hover:shadow-cozy"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {chapter.is_from_pdf && <FileIcon size={14} className="text-maple-rust" />}
                          <h4 className="font-body text-sm font-medium text-library-ink group-hover:text-maple-rust transition-colors">{chapter.title}</h4>
                          <span className="font-label text-[0.55rem] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-maple-rust/30 text-maple-rust">Chapter</span>
                        </div>
                        <p className="font-label text-[0.6rem] text-coffee-cream">{new Date(chapter.created_at).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteChapter(chapter.id); }} 
                        className="text-coffee-cream/40 hover:text-maple-rust opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ── ✍️ EXERCISES & TESTS ── */}
          <section className="space-y-4 lg:border-l lg:border-coffee-cream/20 lg:pl-8">
            <div className="flex justify-between items-center">
              <h2 className="font-display text-lg text-yale-blue flex items-center gap-2">
                <PenTool size={20} className="text-porch-sage" />
                Exercises & Tests
                <span className="font-label text-[0.6rem] text-coffee-cream bg-page-cream border border-coffee-cream/20 px-2 py-0.5 rounded-full">
                  {exercisesList.length}
                </span>
              </h2>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setShowPDFUpload(!showPDFUpload); setPdfCategory('exercise'); setShowExerciseForm(false); setShowExerciseScan(false); }} 
                  className="text-porch-sage hover:text-yale-blue font-label text-xs uppercase tracking-wider flex items-center gap-1"
                >
                  <Upload size={14} /> Import PDF
                </button>
                <button 
                  onClick={() => { setShowExerciseScan(!showExerciseScan); setShowPDFUpload(false); setShowExerciseForm(false); }} 
                  className="text-porch-sage hover:text-yale-blue font-label text-xs uppercase tracking-wider flex items-center gap-1"
                >
                  <ImageIcon size={14} /> Scan
                </button>
                <button 
                  onClick={() => { setShowExerciseForm(!showExerciseForm); setShowPDFUpload(false); setShowExerciseScan(false); }} 
                  className="text-porch-sage hover:text-yale-blue font-label text-xs uppercase tracking-wider flex items-center gap-1"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {showPDFUpload && pdfCategory === 'exercise' && renderPdfForm()}
            {showExerciseScan && renderScanForm('exercise')}

            {showExerciseForm && (
              <form onSubmit={handleAddExercise} className="bg-page-cream p-4 rounded-sm border border-coffee-cream/20 space-y-3 animate-fade-in-up">
                <input 
                  type="text" required value={newExercise.title} 
                  onChange={(e) => setNewExercise({...newExercise, title: e.target.value})} 
                  placeholder="Exercise Title (e.g., TD 3, Exam 2024)" 
                  className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm" 
                />
                <textarea 
                  value={newExercise.content} 
                  onChange={(e) => setNewExercise({...newExercise, content: e.target.value})} 
                  placeholder="Exercise instructions or content..." 
                  className="w-full p-2 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm h-32 resize-none" 
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-porch-sage text-page-cream px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all">Save Exercise</button>
                  <button type="button" onClick={() => setShowExerciseForm(false)} className="px-3 py-2 text-coffee-cream hover:text-maple-rust"><X size={16} /></button>
                </div>
              </form>
            )}

            <div className="space-y-2 max-h-[560px] overflow-y-auto pr-2">
              {exercisesList.length === 0 ? (
                <div className="border border-dashed border-coffee-cream/30 rounded-sm p-8 text-center">
                  <PenTool size={28} className="mx-auto mb-3 text-coffee-cream/40" />
                  <p className="text-coffee-cream italic text-sm">No exercises yet — import a TD/exam PDF, scan your paper sheets, or add one by hand.</p>
                </div>
              ) : (
                exercisesList.map((exercise) => (
                  <div 
                    key={exercise.id} 
                    onClick={() => navigate(`/study-materials/${selectedMaterial.id}/exercise/${exercise.id}`)} 
                    className="p-4 rounded-sm border cursor-pointer transition-all group bg-parchment border-coffee-cream/20 hover:border-porch-sage/60 hover:shadow-cozy"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {exercise.is_from_pdf && <FileIcon size={14} className="text-porch-sage" />}
                          <h4 className="font-body text-sm font-medium text-library-ink group-hover:text-porch-sage transition-colors">{exercise.title}</h4>
                          <span className="font-label text-[0.55rem] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border border-porch-sage/30 text-porch-sage">Exercise</span>
                        </div>
                        <p className="font-label text-[0.6rem] text-coffee-cream">{new Date(exercise.created_at).toLocaleDateString()}</p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteChapter(exercise.id); }} 
                        className="text-coffee-cream/40 hover:text-maple-rust opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
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