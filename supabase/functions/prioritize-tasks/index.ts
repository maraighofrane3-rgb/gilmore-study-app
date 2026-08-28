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
    const { tasks } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY')

    if (!apiKey) {
      console.error('GROQ_API_KEY not found')
      throw new Error('API key missing')
    }

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ error: 'No tasks provided.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('Prioritizing tasks:', tasks.length)

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        // "low" suffit pour trier une courte liste — évite d'épuiser le budget de tokens en raisonnement interne
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an expert productivity coach. 
            Analyze the provided list of tasks and return them sorted by priority (most urgent/important first).
            Return ONLY valid JSON in this exact format:
            {
              "ordered_ids": ["id1", "id2", "id3"],
              "top_tip": "A short, encouraging sentence on what to start with and why."
            }`
          },
          {
            role: 'user',
            content: `Here are my tasks: ${JSON.stringify(tasks)}`
          }
        ],
        temperature: 0.5,
        // Les tokens de raisonnement interne du modèle consomment aussi ce budget :
        // 300 était trop bas et coupait la réponse avant même de produire le JSON final.
        max_tokens: 1024
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Groq API error:', response.status, errText)
      throw new Error(`API Error: ${response.status}`)
    }

    const data = await response.json()
    const choice = data.choices?.[0]
    const rawContent = choice?.message?.content

    if (choice?.finish_reason === 'length') {
      console.error('Response was cut off by max_tokens. Raw so far:', rawContent)
    }

    if (!rawContent) {
      throw new Error(`Empty response from AI. finish_reason: ${choice?.finish_reason}`)
    }

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