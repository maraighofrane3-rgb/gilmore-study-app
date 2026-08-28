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
    const { session_type, energy_level, task } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY')

    if (!apiKey) throw new Error('GROQ_API_KEY is missing.')

    let prompt = ""
    if (session_type === 'start') {
      prompt = `Give a short, energizing 2-3 sentence motivation to start a focus session on: "${task}". Energy level: ${energy_level}/5. Be encouraging and dark academia styled.`
    } else if (session_type === 'break') {
      prompt = `Give a gentle, restorative 2-sentence message for a break after focused work. Remind them to stretch, breathe, or hydrate. Energy level: ${energy_level}/5.`
    } else if (session_type === 'complete') {
      prompt = `Give a warm, congratulatory 2-3 sentence message for completing a focus session on: "${task}". Celebrate their accomplishment. Energy level: ${energy_level}/5.`
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: 'You are a supportive, wise academic mentor. Keep responses short (2-3 sentences max), warm, and encouraging.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 150
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Groq API Error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const motivation = data.choices?.[0]?.message?.content

    return new Response(JSON.stringify({ motivation }), {
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