   import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

   const corsHeaders = {
     'Access-Control-Allow-Origin': '*',
     'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   }

   serve(async (req) => {
     if (req.method === 'OPTIONS') {
       return new Response('ok', { headers: corsHeaders })
     }

     try {
       const authHeader = req.headers.get('Authorization')
       if (!authHeader) throw new Error('Missing authorization header')

       // Create Supabase client with the user's JWT to respect Row Level Security
       const supabase = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_ANON_KEY') ?? '',
         { global: { headers: { Authorization: authHeader } } }
       )

       const { data: { user }, error: authError } = await supabase.auth.getUser()
       if (authError || !user) throw new Error('Unauthorized')

       // Calculate date 7 days ago
       const sevenDaysAgo = new Date()
       sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
       const dateStr = sevenDaysAgo.toISOString()

       // 1. Fetch Focus Sessions
       const { data: sessions, error: sessionError } = await supabase
         .from('focus_sessions')
         .select('duration_minutes')
         .eq('user_id', user.id)
         .gte('created_at', dateStr)
       
       if (sessionError) throw sessionError
       const totalFocusMinutes = sessions?.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0
       const totalFocusHours = (totalFocusMinutes / 60).toFixed(1)
       const sessionCount = sessions?.length || 0

       // 2. Fetch Completed Tasks
       const { count: completedTasks, error: taskError } = await supabase
         .from('tasks')
         .select('*', { count: 'exact', head: true })
         .eq('user_id', user.id)
         .eq('status', 'completed')
         .gte('updated_at', dateStr)

       if (taskError) throw taskError

       // 3. Fetch Books Read or Progressed
       const { count: booksProgressed, error: bookError } = await supabase
         .from('books')
         .select('*', { count: 'exact', head: true })
         .eq('user_id', user.id)
         .gte('updated_at', dateStr)

       if (bookError) throw bookError

       // 4. Call Groq API
       const apiKey = Deno.env.get('GROQ_API_KEY')
       if (!apiKey) throw new Error('GROQ_API_KEY is missing.')

       const systemPrompt = `You are the Dean of Stars Hollow Academy and the Head Librarian. 
       Write a beautifully formatted, 3-paragraph weekly progress letter to the scholar. 
       Use a Dark Academia, encouraging, slightly poetic, and intellectual tone (think Rory Gilmore meets Dead Poets Society). 
       Address them as "Dear Scholar". 
       Sign off as "— The Dean of Stars Hollow Academy".
       Do not use markdown formatting like bold or italics. Just use plain text with paragraph breaks.`

       const userPrompt = `Here is the scholar's progress for the last 7 days:
       - Total Focus Time: ${totalFocusHours} hours (across ${sessionCount} sessions).
       - Tasks Completed: ${completedTasks || 0}.
       - Books Read or Progressed: ${booksProgressed || 0}.

       Write the letter based on this data. If the numbers are low, be gently encouraging. If they are high, praise their dedication.`

       const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${apiKey}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           model: 'llama-3.1-8b-instant', // Fast and reliable
           messages: [
             { role: 'system', content: systemPrompt },
             { role: 'user', content: userPrompt }
           ],
           temperature: 0.8,
           max_tokens: 800
         })
       })

       if (!response.ok) throw new Error('Groq API request failed')

       const data = await response.json()
       const letter = data.choices[0].message.content

       return new Response(JSON.stringify({ letter }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 200,
       })

     } catch (error) {
       return new Response(JSON.stringify({ error: error.message }), {
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
         status: 400,
       })
     }
   })