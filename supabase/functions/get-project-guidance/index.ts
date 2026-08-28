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
    const { project_title, current_step, milestones, user_question } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY')

    if (!apiKey) throw new Error('GROQ_API_KEY is missing.')

    const stepInfo = milestones?.[current_step] || 'Current step'

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `You are a supportive project mentor helping someone complete their project step-by-step.
            Be encouraging, practical, and specific. Provide actionable advice.
            IMPORTANT: Keep your answer complete but concise (under 500 words). 
            Use simple formatting: short paragraphs and plain bullet points with "- ". 
            Avoid markdown tables and heavy headers.`
          },
          {
            role: 'user',
            content: `Project: "${project_title}"
Current Step (${(current_step || 0) + 1}): ${stepInfo}
User Question: ${user_question || "What should I focus on for this step?"}

Provide specific guidance for this exact step. Break it into small, manageable tasks.`
          }
        ],
        temperature: 0.7,
        max_tokens: 2048  // ✅ Increased from 500 → 2048 so answers never get cut off
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Groq API Error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const choice = data.choices?.[0]
    const content = choice?.message?.content

    if (!content) throw new Error('Empty response.')

    // Log if the answer was still cut off (for debugging)
    if (choice?.finish_reason === 'length') {
      console.warn('Response hit max_tokens limit.')
    }

    return new Response(JSON.stringify({ guidance: content }), {
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