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
    const { title, description, target_date } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY')

    if (!apiKey) throw new Error('GROQ_API_KEY is missing.')

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
            content: `You are an expert goal-setting coach. Break down a goal into actionable milestones.
            Return ONLY valid JSON in this format:
            {
              "milestones": [
                {"title": "Milestone title", "description": "What to do", "estimated_days": 7}
              ],
              "tips": ["Tip 1", "Tip 2", "Tip 3"],
              "potential_obstacles": ["Obstacle 1", "Obstacle 2"]
            }`
          },
          {
            role: 'user',
            content: `Goal: "${title}"${description ? '\nDescription: ' + description : ''}${target_date ? '\nTarget date: ' + target_date : ''}
            
            Break this down into 3-5 concrete, actionable milestones with estimated timeframes.`
          }
        ],
        temperature: 0.7,
        max_tokens: 800
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
    const breakdown = JSON.parse(cleanJson)

    return new Response(JSON.stringify(breakdown), {
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