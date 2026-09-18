import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, CheckCircle, Circle, ChevronRight, ChevronLeft, 
  Sparkles, Loader2, MessageCircle, Send, Target, BookOpen,
  Save, Trash2, Lightbulb, List, AlertTriangle, RotateCcw,
  Calendar, Clock, X, Link2, ListChecks
} from 'lucide-react';

// ============================================
// 🎨 CONSTANTS
// ============================================

const QUICK_ACTIONS = [
  { id: 'tips', label: 'Tips', icon: Lightbulb, prompt: 'Give me practical tips for this step.' },
  { id: 'examples', label: 'Examples', icon: List, prompt: 'Show me concrete examples of how to do this.' },
  { id: 'checklist', label: 'Checklist', icon: CheckCircle, prompt: 'Create a detailed checklist for this step.' },
  { id: 'troubleshoot', label: 'Troubleshoot', icon: AlertTriangle, prompt: 'What common mistakes should I avoid?' },
];

// ============================================
// 🛡️ SHAPE-PROOF NORMALIZERS
// ============================================

const normMilestone = (m, i) => {
  if (!m) return { name: `Step ${i + 1}`, description: '', duration: '', tasks: [], success_criteria: [], risks: [] };
  if (typeof m === 'string') return { name: m, description: '', duration: '', tasks: [], success_criteria: [], risks: [] };
  if (typeof m !== 'object') return { name: String(m), description: '', duration: '', tasks: [], success_criteria: [], risks: [] };
  return {
    name: m.name || m.title || `Step ${i + 1}`,
    description: m.description || '',
    duration: m.duration || '',
    tasks: Array.isArray(m.tasks) ? m.tasks : Array.isArray(m.steps) ? m.steps : [],
    success_criteria: Array.isArray(m.success_criteria) ? m.success_criteria : Array.isArray(m.criteria) ? m.criteria : [],
    risks: Array.isArray(m.risks) ? m.risks : [],
  };
};

const normResource = (r) => {
  if (!r) return { name: 'Resource', type: 'resource', description: '', url: '' };
  if (typeof r === 'string') return { name: r, type: 'resource', description: '', url: r.startsWith('http') ? r : '' };
  if (typeof r !== 'object') return { name: String(r), type: 'resource', description: '', url: '' };
  return {
    name: r.name || 'Resource',
    type: r.type || 'resource',
    description: r.description || '',
    url: r.url || '',
  };
};

// 🛡️ CRITICAL: Safe stringify for ANY value that might be an object
const safeText = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(safeText).join(', ');
  if (typeof v === 'object') {
    // If it's a milestone-like object, extract the name
    if (v.name) return v.name;
    if (v.title) return v.title;
    // Otherwise stringify it safely
    try { return JSON.stringify(v); } catch { return ''; }
  }
  return String(v);
};

// ============================================
// 🏠 ERROR BOUNDARY WRAPPER
// ============================================

export default function ProjectDetail(props) {
  if (!props.project) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center animate-fade-in-up">
        <Loader2 size={32} className="animate-spin mx-auto text-coffee-cream mb-4" />
        <p className="font-body text-coffee-cream italic">Loading project...</p>
        <button
          onClick={props.onBack}
          className="mt-6 inline-flex items-center gap-2 text-coffee-cream hover:text-maple-rust transition-colors"
        >
          <ArrowLeft size={16} /> Back to Lab
        </button>
      </div>
    );
  }

  try {
    return <ProjectDetailInner {...props} />;
  } catch (err) {
    console.error('ProjectDetail render error:', err);
    return (
      <div className="max-w-4xl mx-auto p-6 bg-maple-rust/10 border border-maple-rust rounded-sm animate-fade-in-up">
        <h2 className="font-display text-xl text-maple-rust mb-2">Render Error</h2>
        <p className="font-body text-sm text-library-ink mb-4">{err.message}</p>
        <pre className="bg-parchment p-4 rounded-sm text-xs overflow-auto max-h-64 font-mono text-coffee-cream">
          {err.stack}
        </pre>
        <button
          onClick={props.onBack}
          className="mt-4 px-4 py-2 bg-yale-blue text-page-cream rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-colors"
        >
          ← Back to Lab
        </button>
      </div>
    );
  }
}

// ============================================
// 🏠 INNER COMPONENT
// ============================================

function ProjectDetailInner({ project, onBack, onUpdateProject }) {
  const [currentStep, setCurrentStep] = useState(project.current_step || 0);
  const [guidance, setGuidance] = useState('');
  const [guidanceHistory, setGuidanceHistory] = useState([]);
  const [loadingGuidance, setLoadingGuidance] = useState(false);
  const [question, setQuestion] = useState('');
  const [updating, setUpdating] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const milestones = Array.isArray(project.milestones)
    ? project.milestones.map(normMilestone)
    : [];
  const resources = Array.isArray(project.resources)
    ? project.resources.map(normResource)
    : [];
  const totalSteps = milestones.length;
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const currentMilestone = milestones[currentStep] || null;

  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const notifTimer = useRef(null);

  const showNotification = useCallback((message, type = 'success') => {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotification({ show: true, message, type });
    notifTimer.current = setTimeout(
      () => setNotification({ show: false, message: '', type: 'success' }),
      3000
    );
  }, []);

  useEffect(() => {
    return () => { if (notifTimer.current) clearTimeout(notifTimer.current); };
  }, []);

  // ============================================
  // 🤖 AI GUIDANCE
  // ============================================

  const handleGetGuidance = useCallback(async (customPrompt) => {
    setLoadingGuidance(true);
    setGuidance('');

    const userQuestion = customPrompt || question || "What should I focus on for this step?";

    try {
            const { data, error } = await supabase.functions.invoke('get-project-guidance', {
        body: {
          project_title: project.title,
          project_objective: project.objective || '',
          current_step: currentStep,
          total_steps: milestones.length,
          milestones: milestones.map(m => m.name),
          current_milestone: currentMilestone,   // ✅ tasks + criteria + risks travel with the request
          user_question: userQuestion,
        }
      });

      if (error) throw error;
      
      setGuidance(data?.guidance || 'No guidance returned.');
      setGuidanceHistory(prev => [{
        id: Date.now(),
        question: userQuestion,
        answer: data?.guidance || '',
        step: currentStep,
        timestamp: new Date().toISOString()
      }, ...prev]);
      
      showNotification('Guidance generated! ✨');
    } catch (err) {
      console.error(err);
      showNotification('Failed to get guidance. Please try again.', 'error');
    }
    setLoadingGuidance(false);
  }, [project, currentStep, milestones, question, showNotification]);

  const handleQuickAction = useCallback((action) => {
    setQuestion(action.prompt);
    handleGetGuidance(action.prompt);
  }, [handleGetGuidance]);

  const handleSaveGuidance = useCallback(async () => {
    if (!guidance) return;
    
    setSavingNote(true);
    try {
      const { error } = await supabase
        .from('project_notes')
        .insert([{
          project_id: project.id,
          user_id: project.user_id,
          step: currentStep,
          question: question || 'AI Guidance',
          content: guidance,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
      showNotification('Guidance saved to notes! 📝');
    } catch (err) {
      console.error('Save error:', err);
      showNotification('Failed to save guidance.', 'error');
    }
    setSavingNote(false);
  }, [guidance, question, currentStep, project, showNotification]);

  // ============================================
  // 📊 STEP NAVIGATION
  // ============================================

  const markStepComplete = useCallback(async () => {
    setUpdating(true);
    const nextStep = currentStep + 1;
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          current_step: nextStep,
          status: nextStep >= milestones.length ? 'completed' : 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (!error) {
        setCurrentStep(nextStep);
        onUpdateProject?.();
        showNotification(nextStep >= milestones.length 
          ? '🎉 Project completed!' 
          : `Step ${nextStep} completed!`);
      }
    } catch (err) {
      console.error('Update error:', err);
      showNotification('Failed to update step.', 'error');
    }
    setUpdating(false);
  }, [currentStep, milestones, project, onUpdateProject, showNotification]);

  const goToPreviousStep = useCallback(async () => {
    if (currentStep === 0) return;
    
    setUpdating(true);
    const prevStep = currentStep - 1;
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          current_step: prevStep,
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (!error) {
        setCurrentStep(prevStep);
        onUpdateProject?.();
      }
    } catch (err) {
      console.error('Update error:', err);
    }
    setUpdating(false);
  }, [currentStep, project, onUpdateProject]);

  // ============================================
  // 🎨 RENDER
  // ============================================

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
      {/* Notification */}
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

      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-sm hover:bg-coffee-cream/10 transition-colors"
          >
            <ArrowLeft size={20} className="text-coffee-cream" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-3xl text-yale-blue">{safeText(project.title) || 'Untitled Project'}</h1>
            {project.objective && (
              <p className="font-body text-sm text-coffee-cream italic">{safeText(project.objective)}</p>
            )}
          </div>
          {project.total_duration && (
            <span className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-yale-blue/10 text-yale-blue rounded-sm font-label text-[0.65rem] uppercase tracking-wider">
              <Clock size={12} /> {safeText(project.total_duration)}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex justify-between items-center mb-2">
            <span className="font-label text-xs uppercase tracking-wider text-coffee-cream">
              Progress
            </span>
            <span className="font-display text-lg text-maple-rust">
              {currentStep} / {totalSteps} steps
            </span>
          </div>
          <div className="w-full h-2 bg-page-cream rounded-full overflow-hidden">
            <div
              className="h-full bg-maple-rust transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {project.created_at && (
            <div className="flex items-center gap-4 mt-3 text-xs text-coffee-cream/60">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                Started {new Date(project.created_at).toLocaleDateString()}
              </span>
              {project.updated_at && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  Updated {new Date(project.updated_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 📋 Detailed Plan Overview */}
      {project.total_duration && (
        <div className="bg-page-cream p-6 rounded-sm border-l-4 border-gilmore-gold shadow-cozy space-y-4">
          <h2 className="font-display text-lg text-yale-blue flex items-center gap-2">
            <Target size={18} className="text-gilmore-gold" />
            The Detailed Plan
          </h2>

          {Array.isArray(project.key_success_factors) && project.key_success_factors.length > 0 && (
            <div>
              <h3 className="font-label text-[0.65rem] uppercase tracking-wider text-porch-sage mb-2 flex items-center gap-1">
                <Sparkles size={12} /> Keys to Success
              </h3>
              <ul className="space-y-1.5">
                {project.key_success_factors.map((f, i) => (
                  <li key={i} className="font-body text-xs text-library-ink leading-relaxed flex gap-2">
                    <Sparkles size={10} className="text-porch-sage mt-1 shrink-0" />
                    <span>{safeText(f)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(project.common_pitfalls) && project.common_pitfalls.length > 0 && (
            <div>
              <h3 className="font-label text-[0.65rem] uppercase tracking-wider text-maple-rust mb-2 flex items-center gap-1">
                <AlertTriangle size={12} /> Pitfalls to Avoid
              </h3>
              <ul className="space-y-1.5">
                {project.common_pitfalls.map((p, i) => (
                  <li key={i} className="font-body text-xs text-library-ink leading-relaxed flex gap-2">
                    <AlertTriangle size={10} className="text-maple-rust mt-1 shrink-0" />
                    <span>{safeText(p)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Milestones Timeline */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 shadow-cozy">
            <h2 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
              <Target size={18} className="text-maple-rust" />
              Your Path
            </h2>
            
            <div className="space-y-3">
              {milestones.map((ms, idx) => {
                const isCompleted = idx < currentStep;
                const isCurrent = idx === currentStep;
                
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-sm border transition-all ${
                      isCurrent 
                        ? 'bg-maple-rust/10 border-maple-rust shadow-sm' 
                        : isCompleted
                        ? 'bg-porch-sage/10 border-porch-sage/30'
                        : 'bg-page-cream/50 border-coffee-cream/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isCompleted ? (
                        <CheckCircle size={18} className="text-porch-sage shrink-0 mt-0.5" />
                      ) : isCurrent ? (
                        <Circle size={18} className="text-maple-rust shrink-0 mt-0.5 animate-pulse" />
                      ) : (
                        <Circle size={18} className="text-coffee-cream/30 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">
                            Step {idx + 1}
                          </p>
                          {ms.duration && (
                            <span className="font-label text-[0.55rem] uppercase tracking-wider text-coffee-cream/60">
                              {safeText(ms.duration)}
                            </span>
                          )}
                        </div>
                        <p className={`font-body text-sm ${
                          isCurrent ? 'text-library-ink font-medium' : 'text-coffee-cream'
                        }`}>
                          {safeText(ms.name)}
                        </p>
                        {ms.description && (
                          <p className="font-body text-[0.65rem] text-coffee-cream/70 mt-1 leading-relaxed italic line-clamp-2">
                            {safeText(ms.description)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex gap-2 mt-6 pt-4 border-t border-coffee-cream/20">
              <button
                onClick={goToPreviousStep}
                disabled={currentStep === 0 || updating}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:bg-page-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Back
              </button>
              <button
                onClick={markStepComplete}
                disabled={currentStep >= milestones.length || updating}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider bg-maple-rust text-page-cream hover:bg-yale-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {currentStep >= milestones.length - 1 ? 'Complete' : 'Next'}
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Resources */}
          {resources.length > 0 && (
            <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 shadow-cozy">
              <h2 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
                <BookOpen size={18} className="text-porch-sage" />
                Resources
              </h2>
              <div className="space-y-3">
                {resources.map((r, idx) => (
                  <div key={idx} className="bg-page-cream p-3 rounded-sm border border-coffee-cream/20">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-body text-sm font-medium text-library-ink">{safeText(r.name)}</span>
                      <span className="px-1.5 py-0.5 bg-gilmore-gold/10 text-yale-blue rounded-sm font-label text-[0.5rem] uppercase tracking-wider">
                        {safeText(r.type)}
                      </span>
                      {r.url && (
                        <a 
                          href={r.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-maple-rust hover:underline font-label text-[0.6rem] uppercase tracking-wider"
                        >
                          <Link2 size={10} /> Open
                        </a>
                      )}
                    </div>
                    {r.description && (
                      <p className="font-body text-[0.7rem] text-coffee-cream leading-relaxed">
                        {safeText(r.description)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: AI Mentor + Current Step Breakdown */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* 🎯 Current Step Breakdown */}
          {currentMilestone && (
            currentMilestone.tasks.length > 0 || 
            currentMilestone.success_criteria.length > 0 || 
            currentMilestone.risks.length > 0
          ) && (
            <div className="bg-parchment p-6 rounded-sm border border-maple-rust/30 shadow-cozy">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-display text-lg text-maple-rust flex items-center gap-2">
                  <ListChecks size={18} />
                  Step {currentStep + 1} Breakdown
                </h2>
                {currentMilestone.duration && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-coffee-cream/10 text-coffee-cream rounded-sm font-label text-[0.6rem] uppercase tracking-wider">
                    <Clock size={10} /> {safeText(currentMilestone.duration)}
                  </span>
                )}
              </div>

              {currentMilestone.tasks.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-label text-[0.65rem] uppercase tracking-wider text-yale-blue mb-2 flex items-center gap-1">
                    <ListChecks size={12} /> Detailed Steps
                  </h3>
                  <ol className="space-y-2">
                    {currentMilestone.tasks.map((t, i) => (
                      <li key={i} className="flex gap-2 font-body text-sm text-library-ink leading-relaxed">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-yale-blue/10 text-yale-blue flex items-center justify-center font-label text-[0.6rem]">
                          {i + 1}
                        </span>
                        <span>{safeText(t)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {currentMilestone.success_criteria.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-label text-[0.65rem] uppercase tracking-wider text-porch-sage mb-2 flex items-center gap-1">
                    <CheckCircle size={12} /> Done when…
                  </h3>
                  <ul className="space-y-1">
                    {currentMilestone.success_criteria.map((c, i) => (
                      <li key={i} className="flex gap-2 font-body text-xs text-library-ink">
                        <CheckCircle size={12} className="text-porch-sage mt-0.5 shrink-0" />
                        <span>{safeText(c)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {currentMilestone.risks.length > 0 && (
                <div>
                  <h3 className="font-label text-[0.65rem] uppercase tracking-wider text-maple-rust mb-2 flex items-center gap-1">
                    <AlertTriangle size={12} /> Risks & Mitigations
                  </h3>
                  <ul className="space-y-1">
                    {currentMilestone.risks.map((r, i) => (
                      <li key={i} className="flex gap-2 font-body text-xs text-coffee-cream">
                        <AlertTriangle size={12} className="text-maple-rust mt-0.5 shrink-0" />
                        <span>{safeText(r)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* AI Mentor */}
          <div className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
            <h2 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-gilmore-gold" />
              AI Mentor
            </h2>

            <div className="mb-6">
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-2">
                Current Focus: Step {currentStep + 1}
              </label>
              <div className="bg-parchment p-3 rounded-sm border border-coffee-cream/20">
                <p className="font-body text-sm text-library-ink font-medium">
                  {currentMilestone?.name ? safeText(currentMilestone.name) : 'No milestone defined'}
                </p>
                {currentMilestone?.description && (
                  <p className="font-body text-xs text-coffee-cream italic mt-1 leading-relaxed">
                    {safeText(currentMilestone.description)}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-2">
                Quick Actions
              </label>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ACTIONS.map(action => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(action)}
                      disabled={loadingGuidance}
                      className="flex items-center gap-2 p-3 bg-parchment border border-coffee-cream/20 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:border-maple-rust hover:text-maple-rust transition-all disabled:opacity-50"
                    >
                      <Icon size={14} />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleGetGuidance(); }} className="mb-6">
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-2">
                Or ask your own question
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask your AI mentor for help with this step..."
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm text-library-ink h-24 resize-none mb-3"
              />

              <button
                type="submit"
                disabled={loadingGuidance}
                className="flex items-center gap-2 bg-gilmore-gold text-yale-blue px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust hover:text-page-cream transition-all disabled:opacity-50"
              >
                {loadingGuidance ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <MessageCircle size={14} />
                    Get Guidance
                  </>
                )}
              </button>
            </form>

            {guidance && (
              <div className="bg-parchment p-5 rounded-sm border-l-4 border-gilmore-gold animate-fade-in-up space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <p className="font-label text-xs uppercase tracking-wider text-gilmore-gold mb-2">
                      AI Guidance
                    </p>
                    <div className="prose prose-sm max-w-none">
                      <p className="font-body text-library-ink leading-relaxed whitespace-pre-wrap">
                        {guidance}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveGuidance}
                    disabled={savingNote}
                    className="flex items-center gap-1 px-3 py-1.5 bg-maple-rust text-page-cream rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50 shrink-0"
                  >
                    {savingNote ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Save
                  </button>
                </div>
              </div>
            )}

            {!guidance && !loadingGuidance && (
              <div className="text-center py-10 text-coffee-cream italic font-body">
                Ask your AI mentor for step-by-step guidance, tips, or clarification on what to do next.
              </div>
            )}
          </div>

          {guidanceHistory.length > 0 && (
            <div className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
              <h2 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
                <Clock size={18} className="text-coffee-cream" />
                Guidance History
              </h2>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {guidanceHistory.map(item => (
                  <div
                    key={item.id}
                    className="bg-page-cream p-4 rounded-sm border border-coffee-cream/20"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-label text-xs uppercase tracking-wider text-maple-rust">
                        Step {item.step + 1} · {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <p className="font-body text-xs text-coffee-cream italic mb-2">
                      Q: {item.question}
                    </p>
                    <p className="font-body text-sm text-library-ink whitespace-pre-wrap">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}