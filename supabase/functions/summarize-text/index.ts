import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const API_VERSION = "v1beta"
const PER_CALL_TIMEOUT_MS = 30000
const MODELS_CACHE_TTL_MS = 10 * 60 * 1000
const STATIC_FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"]

let modelsCache: { names: string[]; at: number } | null = null

// 🔍 Ask Google which models this key can use TODAY (no more dead names)
async function discoverModels(apiKey: string): Promise<string[]> {
  if (modelsCache && Date.now() - modelsCache.at < MODELS_CACHE_TTL_MS) return modelsCache.names
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/${API_VERSION}/models?key=${apiKey}&pageSize=100`)
    if (!res.ok) return modelsCache?.names ?? STATIC_FALLBACK_MODELS
    const data = await res.json()
    const names: string[] = (data.models || [])
      .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m: any) => (m.name || "").replace("models/", ""))
      .filter((n: string) => n && !n.includes("embedding") && !n.includes("tts") && !n.includes("image") && !n.includes("aqa"))
    const flash = names.filter((n) => n.includes("flash") && !n.includes("exp") && !n.includes("preview"))
    const pro = names.filter((n) => n.includes("pro") && !n.includes("exp") && !n.includes("preview"))
    const exp = names.filter((n) => !flash.includes(n) && !pro.includes(n))
    const ordered = [...flash, ...pro, ...exp].slice(0, 3)
    if (ordered.length) {
      modelsCache = { names: ordered, at: Date.now() }
      console.log("Discovered live models:", ordered.join(", "))
      return ordered
    }
  } catch (e: any) {
    console.warn("Model discovery failed:", e.message)
  }
  return modelsCache?.names ?? STATIC_FALLBACK_MODELS
}

// 🌍 The multilingual rule
const LANGUAGE_RULE = `

LANGUAGE RULE: Detect the language of the SOURCE TEXT provided below. You MUST write your ENTIRE response in that same language (French source → French response, German source → German response, Arabic source → Arabic response, Spanish source → Spanish response, etc.). Keep every quoted passage verbatim in the original language, and write any interpretation or commentary in that same language too. Only if the language truly cannot be detected, respond in English.`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { text, action, custom_prompt } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    if (!apiKey) throw new Error('GEMINI_API_KEY is missing in Supabase Secrets.')
    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'No text provided.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let defaultPrompt = "Analyze the following text clearly and concisely."
    if (!custom_prompt) {
      if (action === 'summarize') defaultPrompt = "Provide a concise, clear summary of the following text, capturing the main arguments and themes in 2-3 paragraphs."
      else if (action === 'explain') defaultPrompt = "Explain the following text in simple, clear terms, breaking down any complex jargon so a beginner can understand."
      else if (action === 'quotes') defaultPrompt = "Extract exactly 3 to 5 of the most beautiful, meaningful or powerful quotes from the following text. Return each quote on its own line, wrapped in quotation marks, followed by a brief one-line interpretation."
    }

    // ✅ The rule wraps EVERY request, custom_prompt included
    const systemPrompt = (custom_prompt || defaultPrompt) + LANGUAGE_RULE
    const truncatedText = text.substring(0, 100000)
    const fullPrompt = `${systemPrompt}\n\n---\n\nText to analyze:\n${truncatedText}`
    const maxOutputTokens = action === 'quotes' || action === 'explain' ? 2000 : 4000

    const models = await discoverModels(apiKey)
    const errors: string[] = []
    let finalContent = ''
    let modelUsed = ''

    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS)
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/${API_VERSION}/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens }
              }),
              signal: controller.signal
            }
          )
          clearTimeout(t)

          if (res.status === 503 || res.status === 429) {
            errors.push(`${model}->HTTP ${res.status} (attempt ${attempt})`)
            if (attempt === 1) { await new Promise(r => setTimeout(r, 1000)); continue }
            break
          }
          if (!res.ok) {
            const errText = await res.text()
            errors.push(`${model}->HTTP ${res.status}`)
            console.warn(`⚠️ ${model} failed (${res.status}): ${errText.slice(0, 300)}`)
            break
          }
          const data = await res.json()
          const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          if (content) { finalContent = content; modelUsed = model; break }
          errors.push(`${model}->empty`)
          break
        } catch (e: any) {
          clearTimeout(t)
          errors.push(`${model}->${e.name === 'AbortError' ? 'timeout' : e.message}`)
          break
        }
      }
      if (finalContent) break
    }

    if (!finalContent) throw new Error(`All models failed: ${errors.join(' | ')}`)

    console.log(`✅ Success with ${modelUsed}`)
    return new Response(JSON.stringify({ result: finalContent, model_used: modelUsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('❌ summarize-text Critical Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})