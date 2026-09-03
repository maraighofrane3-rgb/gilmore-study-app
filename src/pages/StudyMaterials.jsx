import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
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
  const [loading, setLoading] = useState(true);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showChapterForm, setShowChapterForm] = useState(false);
  
  const [showPDFUpload, setShowPDFUpload] = useState(false);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfTitle, setPdfTitle] = useState('');
  
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const [newMaterial, setNewMaterial] = useState({ title: '', description: '' });
  const [newChapter, setNewChapter] = useState({ title: '', content: '' });

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

  const handlePDFSubmit = async (e) => {
    e.preventDefault();
    if (!pdfFile) return;

    setUploadingPDF(true);
    try {
      // ⚡ DYNAMIC IMPORT — pdfWorker loads ONLY when user clicks Import PDF
      const { extractTextFromPDF } = await import('../utils/pdfWorker');

      // 1. Extract text for AI analysis
      const extractedText = await extractTextFromPDF(pdfFile);
      
      // 2. Upload PDF to Supabase Storage for viewing
      const fileExt = pdfFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pdf-documents')
        .upload(fileName, pdfFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 3. Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pdf-documents')
        .getPublicUrl(fileName);

      // 4. Save BOTH the PDF viewer AND the extracted text
      const { data, error } = await supabase
        .from('chapters')
        .insert([{ 
          user_id: user.id, 
          material_id: selectedMaterial.id, 
          title: pdfTitle.trim() || 'Untitled Chapter',
          content: extractedText,
          pdf_url: publicUrl,
          file_path: fileName,
          is_from_pdf: true,
          has_images: true
        }])
        .select()
        .single();

      if (error) throw error;
      
      setChapters([data, ...chapters]);
      setShowPDFUpload(false);
      setPdfFile(null);
      setPdfTitle('');
      
      showNotification(`PDF uploaded successfully! Text extracted for AI analysis.`);
      navigate(`/study-materials/${selectedMaterial.id}/chapter/${data.id}`);
    } catch (err) {
      console.error('PDF upload error:', err);
      showNotification(`Failed to upload PDF: ${err.message}`, 'error');
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
      navigate(`/study-materials/${selectedMaterial.id}/chapter/${data.id}`);
    } else {
      showNotification('Failed to add chapter.', 'error');
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
    showNotification('Chapter deleted.');
  };

  const handleBack = () => {
    navigate('/study-materials');
    setSelectedMaterial(null);
    setChapters([]);
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
                  <div key={chapter.id} onClick={() => navigate(`/study-materials/${selectedMaterial.id}/chapter/${chapter.id}`)} className={`p-4 rounded-sm border cursor-pointer transition-all group ${selectedMaterial?.id === chapter.id ? 'bg-page-cream border-maple-rust shadow-cozy' : 'bg-parchment border-coffee-cream/20 hover:border-coffee-cream/50'}`}>
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

          <div className="lg:col-span-2">
            <div className="text-center text-coffee-cream italic py-20 bg-parchment/50 rounded-sm border border-coffee-cream/20 h-full flex flex-col items-center justify-center">
              <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
              <p>Select a chapter to open it in the detailed view.</p>
            </div>
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