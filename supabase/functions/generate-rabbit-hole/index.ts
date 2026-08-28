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
    const { question, category } = await req.json()

    if (!question || typeof question !== 'string' || !question.trim()) {
      return new Response(JSON.stringify({ error: 'A non-empty "question" field is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('GROQ_API_KEY')
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is missing in Supabase Secrets.')
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // gpt-oss-120b: modèle recommandé par Groq en remplacement de qwen/qwen3-32b (en cours de dépréciation)
        model: 'openai/gpt-oss-120b',
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a curious academic librarian. Return ONLY valid JSON, no markdown, no explanations:
            {
              "title": "A compelling dark-academia style title",
              "starting_question": "The refined original question",
              "discoveries": "Key concepts to explore (3-4 sentences)",
              "sources": "Suggested books or articles (comma separated)",
              "related_questions": "3 related questions separated by newlines",
              "difficulty": "beginner, intermediate, or advanced"
            }`
          },
          {
            role: 'user',
            content: `Explore: "${question}" in the category of ${category ?? 'general knowledge'}.`
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Groq API Error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content

    if (!rawContent) {
      throw new Error(`Groq returned empty content. Full response: ${JSON.stringify(data)}`)
    }

    // Nettoyage défensif au cas où le modèle ajoute quand même des balises markdown
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