import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, CheckCircle, Circle, ChevronRight, ChevronLeft, 
  Sparkles, Loader2, MessageCircle, Send, Target, BookOpen 
} from 'lucide-react';

export default function ProjectDetail({ project, onBack, onUpdateProject }) {
  const [currentStep, setCurrentStep] = useState(project.current_step || 0);
  const [guidance, setGuidance] = useState('');
  const [loadingGuidance, setLoadingGuidance] = useState(false);
  const [question, setQuestion] = useState('');
  const [updating, setUpdating] = useState(false);

  const milestones = project.milestones || [];
  const resources = project.resources || [];

  const handleGetGuidance = async (e) => {
    e.preventDefault();
    setLoadingGuidance(true);
    setGuidance('');

    try {
      const { data, error } = await supabase.functions.invoke('get-project-guidance', {
        body: {
          project_title: project.title,
          current_step: currentStep,
          milestones: milestones,
          user_question: question || "What should I focus on for this step?"
        }
      });

      if (error) throw error;
      setGuidance(data.guidance);
    } catch (err) {
      console.error(err);
      setGuidance('Failed to get guidance. Please try again.');
    }
    setLoadingGuidance(false);
  };

  const markStepComplete = async () => {
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
      }
    } catch (err) {
      console.error('Update error:', err);
    }
    setUpdating(false);
  };

  const goToPreviousStep = async () => {
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
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
      {/* Header */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Milestones */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 shadow-cozy">
            <h2 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
              <Target size={18} />
              Your Path
            </h2>
            
            <div className="space-y-3">
              {milestones.map((milestone, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-sm border transition-all ${
                    idx === currentStep 
                      ? 'bg-maple-rust/10 border-maple-rust' 
                      : idx < currentStep
                      ? 'bg-porch-sage/10 border-porch-sage/30'
                      : 'bg-page-cream/50 border-coffee-cream/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {idx < currentStep ? (
                      <CheckCircle size={18} className="text-porch-sage shrink-0 mt-0.5" />
                    ) : idx === currentStep ? (
                      <Circle size={18} className="text-maple-rust shrink-0 mt-0.5" />
                    ) : (
                      <Circle size={18} className="text-coffee-cream/30 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream mb-1">
                        Step {idx + 1}
                      </p>
                      <p className={`font-body text-sm ${
                        idx === currentStep ? 'text-library-ink font-medium' : 'text-coffee-cream'
                      }`}>
                        {milestone}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex gap-2 mt-6 pt-4 border-t border-coffee-cream/20">
              <button
                onClick={goToPreviousStep}
                disabled={currentStep === 0 || updating}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label text-coffee-cream hover:bg-page-cream disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
                Back
              </button>
              <button
                onClick={markStepComplete}
                disabled={currentStep >= milestones.length || updating}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label bg-maple-rust text-page-cream hover:bg-yale-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                <BookOpen size={18} />
                Resources
              </h2>
              <ul className="space-y-2">
                {resources.map((resource, idx) => (
                  <li key={idx} className="font-body text-sm text-library-ink flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-porch-sage shrink-0" />
                    {resource}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: AI Guidance */}
        <div className="lg:col-span-2">
          <div className="bg-page-cream p-6 rounded-sm border border-coffee-cream/20 shadow-cozy h-full">
            <h2 className="font-display text-lg text-yale-blue mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-gilmore-gold" />
              AI Mentor
            </h2>

            <form onSubmit={handleGetGuidance} className="mb-6">
              <label className="block font-label text-xs uppercase tracking-wider-label text-coffee-cream mb-2">
                Current Focus: Step {currentStep + 1}
              </label>
              <div className="bg-parchment p-3 rounded-sm border border-coffee-cream/20 mb-3">
                <p className="font-body text-sm text-library-ink italic">
                  {milestones[currentStep] || 'No milestone defined'}
                </p>
              </div>

              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask your AI mentor for help with this step..."
                className="w-full p-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm text-library-ink h-24 resize-none mb-3"
              />

              <button
                type="submit"
                disabled={loadingGuidance}
                className="flex items-center gap-2 bg-gilmore-gold text-yale-blue px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust hover:text-page-cream transition-all disabled:opacity-50"
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

            {/* Guidance Display */}
            {guidance && (
              <div className="bg-parchment p-5 rounded-sm border-l-4 border-gilmore-gold animate-fade-in-up">
                <div className="prose prose-sm max-w-none">
                  <p className="font-body text-library-ink leading-relaxed whitespace-pre-wrap">
                    {guidance}
                  </p>
                </div>
              </div>
            )}

            {!guidance && !loadingGuidance && (
              <div className="text-center py-10 text-coffee-cream italic font-body">
                Ask your AI mentor for step-by-step guidance, tips, or clarification on what to do next.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}