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
    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is missing in Supabase Secrets.')
    }

    // Utilise l'heure locale envoyée par le client si disponible ;
    // sinon on retombe sur l'heure du serveur (mieux que rien, mais pas fiable)
    let localHour = null
    try {
      const body = await req.json()
      if (typeof body?.localHour === 'number' && body.localHour >= 0 && body.localHour <= 23) {
        localHour = body.localHour
      }
    } catch {
      // pas de corps JSON envoyé, on continue avec l'heure serveur
    }

    const hour = localHour ?? new Date().getHours()
    let timeOfDay = 'morning'
    if (hour >= 12 && hour < 17) timeOfDay = 'afternoon'
    else if (hour >= 17) timeOfDay = 'evening'

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        reasoning_effort: 'medium',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an encouraging, wise, dark-academia-style academic mentor. 
            Return ONLY valid JSON, no markdown, no explanations. Format:
            {
              "greeting": "A warm, personalized greeting for the ${timeOfDay}.",
              "tip": "A specific, actionable study tip for deep work today (2-3 sentences).",
              "quote": "A short, inspiring reflection in the spirit of academic wisdom. If you attribute it to a real historical scholar, author, or philosopher, only use a quote you are highly confident is accurately attributed; otherwise write it as an unattributed reflection.",
              "author": "The author of the quote, or an empty string if unattributed."
            }`
          },
          {
            role: 'user',
            content: "Give me my daily study coaching."
          }
        ],
        temperature: 0.8,
        max_tokens: 300
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Groq API Error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content

    if (!rawContent) throw new Error('Groq returned empty content.')

    const cleanJson = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    let aiResponse
    try {
      aiResponse = JSON.parse(cleanJson)
    } catch (parseError) {
      throw new Error(`Failed to parse model output as JSON. Raw content: ${rawContent}`)
    }

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