import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  FlaskConical, Sparkles, Loader2, Target, ListChecks, BookOpen, Save,
  FolderOpen, Trash2, ChevronRight, Search, CheckCircle, Clock, X,
  Compass, Rocket, Wrench, Calendar, Quote
} from 'lucide-react';
import ProjectDetail from '../components/ProjectDetail';
import ConfirmDialog from '../components/ConfirmDialog';

// ============================================
// 🎨 CONSTANTS
// ============================================

const STATUSES = [
  { id: 'all', label: 'All', icon: FolderOpen, color: 'text-coffee-cream' },
  { id: 'planning', label: 'Planning', icon: Compass, color: 'text-yale-blue' },
  { id: 'in_progress', label: 'In Progress', icon: Wrench, color: 'text-maple-rust' },
  { id: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-porch-sage' },
];

// ============================================
// 🧠 MEMOIZED PROJECT CARD
// ============================================

const ProjectCard = memo(function ProjectCard({ project, index, onOpen, onDelete }) {
  const status = STATUSES.find(s => s.id === project.status) || STATUSES[1];
  const StatusIcon = status.icon;

  const totalMilestones = project.milestones?.length || 0;
  const currentStep = project.current_step || 0;
  const progress = totalMilestones > 0 ? (currentStep / totalMilestones) * 100 : 0;

  return (
    <div
      className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 shadow-cozy hover:border-maple-rust/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group animate-fade-in-up flex flex-col cursor-pointer"
      style={{ animationDelay: `${Math.min(index, 12) * 0.04}s` }}
      onClick={() => onOpen(project)}
    >
      {/* Top: status + delete */}
      <div className="flex justify-between items-start mb-3">
        <div className={`flex items-center gap-1.5 font-label text-[0.6rem] uppercase tracking-wider ${status.color}`}>
          <StatusIcon size={11} />
          {project.status.replace('_', ' ')}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(project); }}
          className="text-coffee-cream/40 hover:text-maple-rust transition-colors p-1 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Title */}
      <h3 className="font-display text-xl text-yale-blue mb-2 group-hover:text-maple-rust transition-colors line-clamp-2 leading-tight">
        {project.title}
      </h3>

      {/* Objective */}
      <p className="font-body text-sm text-coffee-cream italic mb-4 line-clamp-2 flex-1">
        <Quote size={10} className="inline mr-1 -mt-1 opacity-40" />
        {project.objective}
      </p>

      {/* Progress bar */}
      {totalMilestones > 0 && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="font-label text-[0.6rem] uppercase tracking-wider text-coffee-cream">
              Progress
            </span>
            <span className="font-body text-xs text-maple-rust font-medium">
              {currentStep} / {totalMilestones}
            </span>
          </div>
          <div className="w-full h-1.5 bg-page-cream rounded-full overflow-hidden">
            <div
              className="h-full bg-maple-rust transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: milestones count + date */}
      <div className="flex items-center justify-between pt-4 border-t border-coffee-cream/10">
        <div className="flex items-center gap-1.5 text-coffee-cream">
          <ListChecks size={12} />
          <span className="font-label text-[0.6rem] uppercase tracking-wider">
            {totalMilestones} {totalMilestones === 1 ? 'milestone' : 'milestones'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-coffee-cream/60">
          <Calendar size={10} />
          <span className="font-label text-[0.6rem] uppercase tracking-wider">
            {new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  );
});

// ============================================
// 🏠 MAIN COMPONENT
// ============================================

export default function Projects() {
  const { user } = useAuth();
  const [idea, setIdea] = useState('');
  const [plan, setPlan] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStatus, setActiveStatus] = useState('all');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  // ============================================
  // 🔄 DATA FETCHING
  // ============================================

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error) setProjects(data || []);
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    return () => { if (notifTimer.current) clearTimeout(notifTimer.current); };
  }, []);

  // ============================================
  // 🧮 MEMOIZED DERIVATIONS
  // ============================================

  const stats = useMemo(() => ({
    total: projects.length,
    planning: projects.filter(p => p.status === 'planning').length,
    inProgress: projects.filter(p => p.status === 'in_progress').length,
    completed: projects.filter(p => p.status === 'completed').length,
  }), [projects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return projects.filter(p => {
      const matchesStatus = activeStatus === 'all' || p.status === activeStatus;
      const matchesSearch = q === '' ||
        p.title.toLowerCase().includes(q) ||
        (p.objective || '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [projects, searchQuery, activeStatus]);

  // ============================================
  // 🧪 AI GENERATION
  // ============================================

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setLoading(true);
    setPlan(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-project-plan', {
        body: { idea }
      });

      if (error) throw error;
      setPlan(data);
      showNotification('Project plan architected! 🧪');
    } catch (err) {
      console.error(err);
      showNotification('The lab equipment is malfunctioning. Please try again.', 'error');
    }
    setLoading(false);
  };

  // ============================================
  // 💾 SAVE / DELETE
  // ============================================

  const handleSaveProject = async () => {
    if (!plan || !idea.trim()) return;

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          user_id: user.id,
          title: plan.title,
          objective: plan.objective,
          original_idea: idea,
          milestones: plan.milestones || [],
          resources: plan.resources || [],
          current_step: 0,
          status: 'planning'
        }])
        .select()
        .single();

      if (error) throw error;

      setProjects(prev => [data, ...prev]);
      setPlan(null);
      setIdea('');
      showNotification('Project saved to the lab! 🧪');
    } catch (err) {
      console.error('Save error:', err);
      showNotification(`Failed to save project: ${err.message}`, 'error');
    }
    setSaving(false);
  };

  const requestDelete = useCallback((project) => {
    setDeleteTarget(project);
  }, []);

  const confirmDelete = useCallback(async () => {
    const project = deleteTarget;
    setDeleteTarget(null);
    if (!project) return;

    setProjects(prev => prev.filter(p => p.id !== project.id));
    const { error } = await supabase.from('projects').delete().eq('id', project.id);
    if (error) {
      fetchProjects();
      showNotification('Failed to remove project.', 'error');
    } else {
      showNotification(`"${project.title}" removed from the lab.`);
    }
  }, [deleteTarget, fetchProjects, showNotification]);

  // ============================================
  // 🎨 RENDER
  // ============================================

  // If viewing a specific project
  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => { setSelectedProject(null); fetchProjects(); }}
        onUpdateProject={fetchProjects}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
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
      <div>
        <p className="eyebrow mb-2">Experimentation Station</p>
        <h1 className="font-display text-4xl text-yale-blue">
          The <span className="italic text-maple-rust">Lab</span>.
        </h1>
        <p className="font-body text-coffee-cream mt-2">
          Have a vague idea? Let AI architect a step-by-step plan to bring it to life.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen size={16} className="text-yale-blue" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Total</p>
          </div>
          <p className="font-display text-2xl text-yale-blue">{stats.total}</p>
        </div>
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <Compass size={16} className="text-yale-blue" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Planning</p>
          </div>
          <p className="font-display text-2xl text-yale-blue">{stats.planning}</p>
        </div>
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <Wrench size={16} className="text-maple-rust" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">In Progress</p>
          </div>
          <p className="font-display text-2xl text-maple-rust">{stats.inProgress}</p>
        </div>
        <div className="bg-parchment p-4 rounded-sm border border-coffee-cream/20 shadow-cozy">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={16} className="text-porch-sage" />
            <p className="font-label text-xs uppercase tracking-wider text-coffee-cream">Completed</p>
          </div>
          <p className="font-display text-2xl text-porch-sage">{stats.completed}</p>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleGenerate} className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-4">
        <label className="block font-label text-xs uppercase tracking-wider text-coffee-cream">
          <FlaskConical size={14} className="inline mr-2 text-maple-rust" />
          What are you working on?
        </label>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g., Start a podcast about 19th-century literature, or Build a personal portfolio..."
          className="w-full p-4 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-library-ink h-32 resize-none transition-colors"
        />

        <button
          type="submit"
          disabled={loading || !idea.trim()}
          className="flex items-center justify-center gap-2 bg-yale-blue text-page-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-maple-rust transition-all w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Architecting Plan...</>
          ) : (
            <><FlaskConical size={16} /> Generate Project Plan</>
          )}
        </button>
      </form>

      {/* Generated Plan */}
      {plan && (
        <div className="bg-page-cream p-8 rounded-sm border-l-4 border-gilmore-gold shadow-cozy space-y-6 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles size={20} className="text-gilmore-gold" />
              <h2 className="font-display text-2xl text-yale-blue">{plan.title}</h2>
            </div>
            <p className="font-body text-library-ink italic mb-2">"{plan.objective}"</p>
            <p className="font-body text-xs text-coffee-cream/70">
              Based on: <span className="italic">"{idea}"</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Milestones as timeline */}
            <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20">
              <h3 className="flex items-center gap-2 font-label text-xs uppercase tracking-wider text-maple-rust mb-4">
                <ListChecks size={16} /> Action Milestones
              </h3>
              <ol className="space-y-3">
                {plan.milestones?.map((milestone, idx) => (
                  <li key={idx} className="flex items-start gap-3 font-body text-sm text-library-ink">
                    <span className="bg-yale-blue text-page-cream rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">
                      {idx + 1}
                    </span>
                    <span>{milestone}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Resources */}
            <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20">
              <h3 className="flex items-center gap-2 font-label text-xs uppercase tracking-wider text-porch-sage mb-4">
                <BookOpen size={16} /> Required Resources
              </h3>
              <ul className="space-y-3">
                {plan.resources?.map((resource, idx) => (
                  <li key={idx} className="flex items-start gap-3 font-body text-sm text-library-ink">
                    <div className="w-1.5 h-1.5 rounded-full bg-porch-sage shrink-0 mt-1.5" />
                    <span>{resource}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-coffee-cream/20">
            <button
              onClick={() => setPlan(null)}
              className="px-4 py-2.5 border border-coffee-cream/30 rounded-sm font-label text-xs uppercase tracking-wider text-coffee-cream hover:bg-coffee-cream/10 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSaveProject}
              disabled={saving}
              className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider hover:bg-yale-blue transition-all disabled:opacity-50"
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> Saving...</>
              ) : (
                <><Save size={16} /> Save Project</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Search + Status filter */}
      {projects.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-coffee-cream/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-11 pr-4 py-3 bg-parchment border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-sm transition-colors"
            />
          </div>

          <div className="flex flex-wrap gap-2 border-b border-coffee-cream/20 pb-2">
            {STATUSES.map(s => {
              const Icon = s.icon;
              const count = s.id === 'all' ? projects.length : projects.filter(p => p.status === s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStatus(s.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider transition-all ${
                    activeStatus === s.id
                      ? 'bg-yale-blue text-page-cream'
                      : 'text-coffee-cream hover:bg-page-cream hover:text-yale-blue'
                  }`}
                >
                  <Icon size={14} />
                  {s.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved Projects */}
      {projects.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-2xl text-yale-blue flex items-center gap-2">
            <FolderOpen size={24} />
            Your Projects
          </h2>

          {filteredProjects.length === 0 ? (
            <div className="text-center py-16 animate-fade-in-up">
              <FlaskConical className="mx-auto text-coffee-cream/30 mb-4" size={48} />
              <p className="font-body text-coffee-cream italic">
                No projects match your filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project, idx) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={idx}
                  onOpen={setSelectedProject}
                  onDelete={requestDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state when no projects at all */}
      {projects.length === 0 && !plan && (
        <div className="text-center py-16 animate-fade-in-up">
          <FlaskConical className="mx-auto text-coffee-cream/30 mb-4" size={48} />
          <p className="font-body text-coffee-cream italic mb-2">
            Your lab is empty. What experiment shall we begin?
          </p>
          <p className="font-body text-xs text-coffee-cream/60">
            Type any idea above and let AI architect the plan.
          </p>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Abandon this project?"
        message={
          <>
            "<span className="italic text-library-ink">{deleteTarget?.title}</span>" will be
            removed from your lab along with all its milestones. This cannot be undone.
          </>
        }
        confirmLabel="Abandon Project"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}