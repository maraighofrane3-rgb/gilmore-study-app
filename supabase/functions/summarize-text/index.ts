import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ✅ Ordered by preference. gemini-2.5-flash is EOL Oct 16, 2026 — kept as a
// fallback for now, but gemini-flash-latest (aliases to gemini-3.5-flash) and
// the explicit gemini-3.1-flash-lite entry are the long-term-safe picks.
const GEMINI_MODELS = [
  "gemini-flash-latest",   // alias — Google repoints this as models rotate
  "gemini-2.5-flash",      // stable today, shuts down 2026-10-16 — remove after that date
  "gemini-3.1-flash-lite"  // stable Gemini 3 model, no shutdown date yet
]

const API_VERSIONS = ["v1beta", "v1"]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, action, custom_prompt } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY is missing!')
      throw new Error('GEMINI_API_KEY is missing in Supabase Secrets.')
    }

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'No text provided.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let systemPrompt = custom_prompt || "Analyze the following text clearly and concisely."
    const truncatedText = text.substring(0, 100000)
    const fullPrompt = `${systemPrompt}\n\n---\n\nText to analyze:\n${truncatedText}`

    // ✅ Increased output tokens for complex tasks
    const maxOutputTokens = action === 'quotes' ? 2000 : action === 'explain' ? 2000 : 4000

    let lastError: any = null
    let finalContent = ''
    let modelUsed = ''

    for (const model of GEMINI_MODELS) {
      for (const version of API_VERSIONS) {
        try {
          console.log(`🔄 Trying ${model} on ${version}...`)

          const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`

          // ✅ Timeout to prevent hanging
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: maxOutputTokens
              }
            }),
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          if (response.ok) {
            const data = await response.json()
            const content = data?.candidates?.[0]?.content?.parts?.[0]?.text

            if (content) {
              finalContent = content
              modelUsed = `${model} (${version})`
              console.log(`✅ Success with ${modelUsed}`)
              break
            } else {
              console.warn(`⚠️ ${model} returned empty content`)
            }
          } else {
            const errText = await response.text()
            console.warn(`⚠️ ${model} on ${version} failed (${response.status}): ${errText}`)
            lastError = new Error(`${model} on ${version}: ${response.status}`)
          }
        } catch (err: any) {
          console.error(`❌ Exception with ${model} on ${version}:`, err.message)
          lastError = err
        }
      }
      if (finalContent) break
    }

    if (!finalContent) {
      console.error('❌ All models failed. Last error:', lastError?.message)
      throw lastError || new Error('All Gemini models and endpoints failed.')
    }

    return new Response(JSON.stringify({
      result: finalContent,
      model_used: modelUsed
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('❌ Edge Function Critical Error:', err.message)
    console.error('Stack trace:', err.stack)

    return new Response(JSON.stringify({
      error: err.message,
      details: err.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})