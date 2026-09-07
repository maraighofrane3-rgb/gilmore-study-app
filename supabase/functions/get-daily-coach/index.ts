import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ✅ Fallback chain: If one model is overloaded (503), try the next
const GEMINI_MODELS = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-1.5-flash" // Ultimate stable fallback
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing in Supabase Secrets.')
    }

    // Get local hour from client or use server time
    let localHour = null
    try {
      const body = await req.json()
      if (typeof body?.localHour === 'number' && body.localHour >= 0 && body.localHour <= 23) {
        localHour = body.localHour
      }
    } catch {
      // No JSON body, use server time
    }

    const hour = localHour ?? new Date().getUTCHours()
    let timeOfDay = 'morning'
    if (hour >= 12 && hour < 17) timeOfDay = 'afternoon'
    else if (hour >= 17) timeOfDay = 'evening'

    const prompt = `You are an encouraging, wise, dark-academia-style academic mentor.

Provide a daily study coaching message for the ${timeOfDay}.

Return ONLY valid JSON in this exact format (no markdown, no explanations):
{
  "greeting": "A warm, personalized greeting for the ${timeOfDay}.",
  "tip": "A specific, actionable study tip for deep work today (2-3 sentences).",
  "quote": "A short, inspiring reflection in the spirit of academic wisdom.",
  "author": "The author of the quote, or an empty string if unattributed."
}`

    let lastError: any = null
    let aiResponse = null

    // ✅ Try each model until one works
    for (const model of GEMINI_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 500,
              }
            })
          }
        )

        if (response.ok) {
          const data = await response.json()
          const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text

          if (rawContent) {
            const cleanJson = rawContent
              .replace(/```json\n?/g, '')
              .replace(/```\n?/g, '')
              .trim()

            try {
              aiResponse = JSON.parse(cleanJson)
              console.log(`✅ Success with model: ${model}`)
              break // Success! Stop trying other models
            } catch (parseError) {
              console.warn(`⚠️ Model ${model} returned invalid JSON`)
              lastError = new Error('Invalid JSON')
            }
          }
        } else {
          const errText = await response.text()
          console.warn(`⚠️ Model ${model} failed (${response.status}): ${errText}`)
          lastError = new Error(`Model ${model} failed: ${response.status}`)
        }
      } catch (err: any) {
        console.warn(`❌ Exception with model ${model}:`, err.message)
        lastError = err
      }
    }

    // ✅ Fallback response if ALL models fail
    if (!aiResponse) {
      console.error('All models failed. Using hardcoded fallback.')
      aiResponse = {
        greeting: `Good ${timeOfDay}, scholar.`,
        tip: "When the tools are busy, the mind must be steady. Focus on one small task at a time with deep concentration.",
        quote: "The mind is not a vessel to be filled, but a fire to be kindled.",
        author: "Plutarch"
      }
    }

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Edge Function Critical Error:', error.message)
    
    // Even in a catastrophic failure, return a valid JSON so the frontend doesn't crash
    const fallback = {
      greeting: "Greetings, scholar.",
      tip: "Take a deep breath. Your focus is your greatest asset today.",
      quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
      author: "Aristotle"
    }

    return new Response(JSON.stringify(fallback), {
      status: 200, // Return 200 so the UI still shows a nice message instead of an error screen
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})