import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Fetch the user's current academic context
    const [booksRes, goalsRes, projectsRes, tasksRes] = await Promise.all([
      supabase.from('books').select('title, author, current_page, total_pages').eq('user_id', user.id).eq('status', 'reading').limit(3),
      supabase.from('goals').select('title, current_value, target_value').eq('user_id', user.id).eq('status', 'active').limit(3),
      supabase.from('projects').select('title').eq('user_id', user.id).in('status', ['active', 'in_progress', 'idea']).limit(3),
      supabase.from('tasks').select('title').eq('user_id', user.id).eq('status', 'todo').limit(10)
    ]);

    const context = {
      books: booksRes.data || [],
      goals: goalsRes.data || [],
      projects: projectsRes.data || [],
      existingTasks: (tasksRes.data || []).map(t => t.title)
    };

    // If the user has nothing active, return empty suggestions
    if (context.books.length === 0 && context.goals.length === 0 && context.projects.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Call the AI (Using Gemini, same as your Daily Mentor)
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set in Supabase Secrets');

    const prompt = `You are an academic planner with a Dark Academia aesthetic. 
Based on the user's current active books, goals, and projects, suggest exactly 3 to 4 specific, actionable daily tasks to maintain steady progress.
Keep task titles concise (max 8 words) and practical. Do not suggest tasks they are already planning.

Current Books: ${JSON.stringify(context.books)}
Current Goals: ${JSON.stringify(context.goals)}
Current Projects: ${JSON.stringify(context.projects)}
Already planned today: ${JSON.stringify(context.existingTasks)}

Return ONLY a valid JSON array of objects with this exact format, no markdown, no explanations:
[
  {
    "title": "Read 20 pages of [Book Title]",
    "category": "Reading"
  },
  {
    "title": "Draft outline for [Project Title]",
    "category": "Project"
  }
]
Valid categories are exactly: "Reading", "Project", "Goals", "General".`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        }),
      }
    );

    if (!response.ok) throw new Error('AI API failed');
    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    
    // Clean up potential markdown formatting from the AI
    const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const suggestions = JSON.parse(cleanText);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message, suggestions: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});