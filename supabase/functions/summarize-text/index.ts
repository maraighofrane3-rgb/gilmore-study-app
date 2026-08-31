import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, action, custom_prompt } = await req.json()
    const apiKey = Deno.env.get('GROQ_API_KEY')

    if (!apiKey) {
      throw new Error('GROQ_API_KEY is missing in Supabase Secrets.')
    }
    
    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'No text provided.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ✅ Smart prompt selection based on the action
    let systemPrompt = custom_prompt || "Analyze the following text."
    if (action === 'summarize') {
      systemPrompt = "Provide a concise, clear summary of this study material. Focus on the main concepts and key takeaways in 2-3 paragraphs."
    } else if (action === 'explain') {
      systemPrompt = "Explain this content in simple, clear terms, breaking down any complex concepts or jargon."
    } else if (action === 'keypoints') {
      systemPrompt = "Extract the 5-7 most important key points. Return as a bulleted list."
    }

    // ✅ Call Groq API with a 100% reliable, free-tier model
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // ✅ Changed to a proven, ultra-reliable Groq model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
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
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('Groq returned empty content.')
    }

    return new Response(JSON.stringify({ result: content }), {
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