import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { idea } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY')

    if (!apiKey) throw new Error('GROQ_API_KEY is missing in Supabase Secrets.')
    if (!idea || idea.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'No idea provided.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a brilliant project manager and academic advisor. 
            Analyze the user's project idea and generate a structured plan.
            Return ONLY valid JSON in this exact format:
            {
              "title": "A catchy, professional title for the project",
              "objective": "A clear, one-sentence goal for the project",
              "milestones": ["Milestone 1: Actionable step", "Milestone 2: Actionable step", "Milestone 3: Actionable step"],
              "resources": ["Resource 1 (e.g., a book, tool, or website)", "Resource 2"]
            }`
          },
          { role: 'user', content: `My idea is: "${idea}"` }
        ],
        temperature: 0.7,
        max_tokens: 600
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Groq API Error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content
    if (!rawContent) throw new Error('Empty response.')

    const cleanJson = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const aiResponse = JSON.parse(cleanJson)

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Edge Function Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})