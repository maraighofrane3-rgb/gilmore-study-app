import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { images } = await req.json() // [{ pageNum, base64 }]
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY missing')
    if (!images?.length) throw new Error('No images provided')

    const parts: any[] = [{ text: `Transcribe ALL visible text from these book pages VERBATIM.
Rules:
- Keep the original language exactly (Arabic stays Arabic, French stays French).
- Preserve reading order and paragraph breaks; for Arabic read right-to-left correctly.
- Prefix each page with a line: - Page N -
- Do NOT translate, summarize or comment. Output only the transcribed text.` }]
    
    for (const img of images) {
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: img.base64 } })
    }

    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest']
    let text = ''
    for (const model of models) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 8000 } })
        }
      )
      if (!res.ok) { console.warn(`⚠️ vision ${model}: ${res.status}`); continue }
      const data = await res.json()
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (text) break
    }
    if (!text) throw new Error('Vision transcription returned empty')

    return new Response(JSON.stringify({ text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('❌ extract-text-vision:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})