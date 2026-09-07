import { serve } from "https://deno.land/std@0.192.0/http/server.ts"

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
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    console.log('API Key exists:', !!apiKey)
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing in Supabase Secrets.')
    }

    // Get local hour from client or use server time
    let localHour = null
    let timeOfDay = 'morning'
    
    try {
      const body = await req.json()
      console.log('Request body:', body)
      if (typeof body?.localHour === 'number' && body.localHour >= 0 && body.localHour <= 23) {
        localHour = body.localHour
      }
    } catch (e) {
      console.log('No JSON body or parse error:', e.message)
    }

    const hour = localHour ?? new Date().getUTCHours()
    if (hour >= 12 && hour < 17) timeOfDay = 'afternoon'
    else if (hour >= 17) timeOfDay = 'evening'
    
    console.log('Time of day:', timeOfDay, '(hour:', hour, ')')

    const prompt = `You are an encouraging, wise, dark-academia-style academic mentor.

Provide a daily study coaching message for the ${timeOfDay}.

Return ONLY valid JSON in this exact format (no markdown, no explanations):
{
  "greeting": "A warm, personalized greeting for the ${timeOfDay}.",
  "tip": "A specific, actionable study tip for deep work today (2-3 sentences).",
  "quote": "A short, inspiring reflection in the spirit of academic wisdom.",
  "author": "The author of the quote, or an empty string if unattributed."
}`

    console.log('Calling Gemini API...')
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
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

    console.log('Gemini response status:', response.status)

    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini API error:', errText)
      throw new Error(`Gemini API Error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    console.log('Gemini response data:', data)
    
    const rawContent = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!rawContent) {
      throw new Error('Gemini returned empty response')
    }

    const cleanJson = rawContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    let aiResponse
    try {
      aiResponse = JSON.parse(cleanJson)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Raw content:', rawContent)
      aiResponse = {
        greeting: `Good ${timeOfDay}, scholar!`,
        tip: "Focus on one task at a time with deep concentration.",
        quote: "The mind is not a vessel to be filled, but a fire to be kindled.",
        author: "Plutarch"
      }
    }

    console.log('Returning response:', aiResponse)

    return new Response(JSON.stringify(aiResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Edge Function Critical Error:', error.message)
    console.error('Stack:', error.stack)
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})