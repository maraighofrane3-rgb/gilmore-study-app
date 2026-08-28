import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { FlaskConical, Sparkles, Loader2, Target, ListChecks, BookOpen, Save, FolderOpen, Trash2, ChevronRight } from 'lucide-react';
import ProjectDetail from '../components/ProjectDetail';

export default function Projects() {
  const { user } = useAuth();
  const [idea, setIdea] = useState('');
  const [plan, setPlan] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    if (user) fetchProjects();
  }, [user]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (!error) setProjects(data || []);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!idea.trim()) return;

    setLoading(true);
    setError('');
    setPlan(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-project-plan', {
        body: { idea }
      });

      if (error) throw error;
      setPlan(data);
    } catch (err) {
      console.error(err);
      setError('The lab equipment is malfunctioning. Please try again.');
    }
    setLoading(false);
  };

  const handleSaveProject = async () => {
    if (!plan || !idea.trim()) {
      setError('No plan to save.');
      return;
    }

    setSaving(true);
    setError('');
    
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

      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      console.log('Project saved:', data);
      setProjects([data, ...projects]);
      setPlan(null);
      setIdea('');
    } catch (err) {
      console.error('Save error:', err);
      setError('Failed to save project: ' + err.message);
    }
    setSaving(false);
  };

  const deleteProject = async (id) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  // If viewing a specific project
  if (selectedProject) {
    return (
      <ProjectDetail 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)}
        onUpdateProject={fetchProjects}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <p className="eyebrow mb-2">Experimentation Station</p>
        <h1 className="font-display text-4xl text-yale-blue">
          The <span className="italic text-maple-rust">Lab</span>.
        </h1>
        <p className="font-body text-coffee-cream mt-2">
          Have a vague idea? Let AI architect a step-by-step plan to bring it to life.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleGenerate} className="bg-parchment p-6 rounded-sm border border-coffee-cream/20 shadow-cozy space-y-4">
        <label className="block font-label text-xs uppercase tracking-wider-label text-coffee-cream">
          What are you working on?
        </label>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g., Start a podcast about 19th-century literature, or Build a personal portfolio..."
          className="w-full p-4 bg-page-cream border border-coffee-cream/20 rounded-sm focus:outline-none focus:border-maple-rust font-body text-library-ink h-32 resize-none transition-colors"
        />
        
        {error && <p className="text-maple-rust font-body text-sm italic">{error}</p>}

        <button
          type="submit"
          disabled={loading || !idea.trim()}
          className="flex items-center justify-center gap-2 bg-yale-blue text-page-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed w-full"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Architecting Plan...
            </>
          ) : (
            <>
              <FlaskConical size={16} />
              Generate Project Plan
            </>
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
            <p className="font-body text-library-ink italic mb-4">"{plan.objective}"</p>
            <p className="font-body text-sm text-coffee-cream mb-6">Based on: "{idea}"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20">
              <h3 className="flex items-center gap-2 font-label text-xs uppercase tracking-wider-label text-maple-rust mb-4">
                <ListChecks size={16} /> Action Milestones
              </h3>
              <ul className="space-y-3">
                {plan.milestones?.map((milestone, idx) => (
                  <li key={idx} className="flex items-start gap-3 font-body text-sm text-library-ink">
                    <span className="bg-yale-blue text-page-cream rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    {milestone}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-parchment p-5 rounded-sm border border-coffee-cream/20">
              <h3 className="flex items-center gap-2 font-label text-xs uppercase tracking-wider-label text-porch-sage mb-4">
                <BookOpen size={16} /> Required Resources
              </h3>
              <ul className="space-y-3">
                {plan.resources?.map((resource, idx) => (
                  <li key={idx} className="flex items-center gap-3 font-body text-sm text-library-ink">
                    <div className="w-1.5 h-1.5 rounded-full bg-porch-sage shrink-0" />
                    {resource}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-coffee-cream/20">
            <button
              onClick={handleSaveProject}
              disabled={saving}
              className="flex items-center gap-2 bg-maple-rust text-page-cream px-6 py-3 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-yale-blue transition-all duration-300 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Project
                </>
              )}
            </button>
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project, idx) => (
              <div
                key={project.id}
                className="bg-parchment p-5 rounded-sm border border-coffee-cream/20 shadow-cozy hover:border-maple-rust/50 transition-all group animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`font-label text-[0.6rem] uppercase tracking-wider-label px-2 py-1 rounded ${
                    project.status === 'completed' ? 'bg-porch-sage/20 text-porch-sage' :
                    project.status === 'in_progress' ? 'bg-maple-rust/20 text-maple-rust' :
                    'bg-yale-blue/10 text-yale-blue'
                  }`}>
                    {project.status.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="text-coffee-cream/40 hover:text-maple-rust transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <h3 className="font-display text-lg text-yale-blue mb-2 group-hover:text-maple-rust transition-colors">
                  {project.title}
                </h3>
                
                <p className="font-body text-sm text-coffee-cream italic mb-4 line-clamp-2">
                  {project.objective}
                </p>

                {project.milestones && (
                  <div className="mb-4">
                    <p className="font-label text-[0.6rem] uppercase tracking-wider-label text-coffee-cream mb-2">
                      Progress: Step {(project.current_step || 0) + 1} of {project.milestones.length}
                    </p>
                    <div className="w-full bg-coffee-cream/20 rounded-full h-1.5">
                      <div 
                        className="bg-maple-rust h-1.5 rounded-full transition-all"
                        style={{ width: `${((project.current_step || 0) / (project.milestones?.length || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setSelectedProject(project)}
                  className="w-full flex items-center justify-center gap-2 bg-yale-blue text-page-cream px-4 py-2 rounded-sm font-label text-xs uppercase tracking-wider-label hover:bg-maple-rust transition-all"
                >
                  Open Project
                  <ChevronRight size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}