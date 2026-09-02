import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, CheckCircle, Circle, ChevronRight, ChevronLeft, 
  Sparkles, Loader2, MessageCircle, Send, Target, BookOpen,
  Save, Trash2, Lightbulb, List, AlertTriangle, RotateCcw,
  Calendar, Clock, X
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
// 🏠 MAIN COMPONENT
// ============================================

export default function ProjectDetail({ project, onBack, onUpdateProject }) {
  const [currentStep, setCurrentStep] = useState(project.current_step || 0);
  const [guidance, setGuidance] = useState('');
  const [guidanceHistory, setGuidanceHistory] = useState([]);
  const [loadingGuidance, setLoadingGuidance] = useState(false);
  const [question, setQuestion] = useState('');
  const [updating, setUpdating] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const milestones = project.milestones || [];
  const resources = project.resources || [];
  const totalSteps = milestones.length;
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  // Notifications
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
          current_step: currentStep,
          milestones: milestones,
          user_question: userQuestion
        }
      });

      if (error) throw error;
      
      setGuidance(data.guidance);
      setGuidanceHistory(prev => [{
        id: Date.now(),
        question: userQuestion,
        answer: data.guidance,
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
        onUpdateProject();
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
        onUpdateProject();
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
            <h1 className="font-display text-3xl text-yale-blue">{project.title}</h1>
            <p className="font-body text-sm text-coffee-cream italic">{project.objective}</p>
          </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Milestones Timeline */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 shadow-cozy">
            <h2 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
              <Target size={18} className="text-maple-rust" />
              Your Path
            </h2>
            
            <div className="space-y-3">
              {milestones.map((milestone, idx) => {
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
                        <p className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream mb-1">
                          Step {idx + 1}
                        </p>
                        <p className={`font-body text-sm ${
                          isCurrent ? 'text-library-ink font-medium' : 'text-coffee-cream'
                        }`}>
                          {milestone}
                        </p>
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
              <ul className="space-y-2">
                {resources.map((resource, idx) => {
                  const isUrl = resource.startsWith('http');
                  return (
                    <li key={idx} className="font-body text-sm text-library-ink flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-porch-sage shrink-0 mt-1.5" />
                      {isUrl ? (
                        <a
                          href={resource}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-yale-blue hover:text-maple-rust underline transition-colors break-all"
                        >
                          {resource}
                        </a>
                      ) : (
                        <span>{resource}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Right: AI Mentor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy">
            <h2 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-gilmore-gold" />
              AI Mentor
            </h2>

            {/* Current Step Context */}
            <div className="mb-6">
              <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream mb-2">
                Current Focus: Step {currentStep + 1}
              </label>
              <div className="bg-parchment p-3 rounded-sm border border-coffee-cream/20">
                <p className="font-body text-sm text-library-ink italic">
                  {milestones[currentStep] || 'No milestone defined'}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
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

            {/* Custom Question */}
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

            {/* Current Guidance Display */}
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

          {/* Guidance History */}
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