import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function fmtDur(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function buildEmail(s: any, snap: any): string {
  const tasks: string[] = (snap?.task_list || '').split('\n').filter(Boolean)
  const goal = Number(snap?.goal_hours || 0)
  const done = Number(snap?.focused_minutes || 0)
  const pct = goal > 0 ? Math.min(100, Math.round((done / (goal * 60)) * 100)) : 0
  const taskRows = tasks.length
    ? tasks.map(t => `<div style="padding:8px 0;border-bottom:1px solid #e4d9c3;color:#3b2f22;font-size:14px;">☐&nbsp; ${t.replace(/</g, '&lt;')}</div>`).join('')
    : `<div style="padding:8px 0;color:#6b5b4f;font-size:14px;font-style:italic;">No pending tasks — open the app and plan your day.</div>`

  return `
  <div style="background:#f3ead8;padding:32px 16px;font-family:Georgia,serif;">
    <div style="max-width:520px;margin:0 auto;background:#fbf6ec;border:1px solid #d9c9a8;border-radius:6px;overflow:hidden;">
      <div style="background:#7d1128;padding:20px 24px;">
        <div style="color:#f4ebdd;font-size:20px;font-weight:bold;">📜 Rory's World</div>
        <div style="color:#e8c9b0;font-size:13px;margin-top:4px;">Your desk misses you, darling.</div>
      </div>
      <div style="padding:24px;">
        <div style="font-size:26px;margin-bottom:4px;">🔥 ${snap?.streak || 0}-day streak</div>
        <div style="color:#6b5b4f;font-size:14px;margin-bottom:20px;">Don't let the flame go out today.</div>

        <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#7d1128;font-weight:bold;margin-bottom:6px;">Daily goal</div>
        <div style="background:#e4d9c3;border-radius:99px;height:14px;margin-bottom:6px;">
          <div style="background:#a51c30;height:14px;border-radius:99px;width:${pct}%;"></div>
        </div>
        <div style="color:#3b2f22;font-size:14px;margin-bottom:20px;">${fmtDur(done)} focused of ${goal}h goal (${pct}%)</div>

        <div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#7d1128;font-weight:bold;margin-bottom:6px;">Today's tasks (${snap?.tasks_due || 0} left)</div>
        ${taskRows}

        <div style="text-align:center;margin-top:24px;">
          <a href="${Deno.env.get('APP_URL') || 'https://gilmoreacademia.vercel.app'}" style="display:inline-block;background:#7d1128;color:#fbf3e4;text-decoration:none;padding:12px 28px;border-radius:4px;font-size:14px;letter-spacing:1px;">OPEN YOUR DESK ☕</a>
        </div>
      </div>
      <div style="padding:14px 24px;background:#efe7d8;color:#8a7a68;font-size:11px;font-style:italic;">
        "Coffee's on. The rest can wait." — Change how often this arrives in Settings → Reminders.
      </div>
    </div>
  </div>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // 🧯 Env first, with graceful failures (never throw at boot)
    const url = Deno.env.get('SUPABASE_URL') || ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    const resendKey = Deno.env.get('RESEND_API_KEY') || ''
    const from = Deno.env.get('RESEND_FROM') || "Rory's World <onboarding@resend.dev>"

    if (!url || !serviceKey) return json({ error: 'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY secrets' }, 500)
    if (!resendKey) return json({ error: 'Missing RESEND_API_KEY secret' }, 500)

    const body = await req.json().catch(() => ({}))
    const isTest = !!body.test && !!body.userId

    // 🔐 Three doors: cron secret, service key, or signed-in user testing themselves
    const authHeader = req.headers.get('Authorization') || ''
    const cronHeader = req.headers.get('x-cron-secret') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    let authorized =
      (!!cronSecret && (cronHeader === cronSecret || authHeader.includes(cronSecret))) ||
      (!!serviceKey && (authHeader.includes(serviceKey) || cronHeader === serviceKey))

    if (!authorized && isTest && anonKey && token) {
      const anonClient = createClient(url, anonKey)
      const { data: me, error: meErr } = await anonClient.auth.getUser(token)
      if (!meErr && me?.user?.id === body.userId) authorized = true
    }

    if (!authorized) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(url, serviceKey)

    let q = admin.from('reminder_settings').select('*').eq('enabled', true)
    if (isTest) q = q.eq('user_id', body.userId)
    const { data: rows, error: rowsErr } = await q
    if (rowsErr) return json({ error: rowsErr.message }, 500)

    const now = new Date()
    const utcHour = now.getUTCHours()
    const today = now.toISOString().slice(0, 10)
    let sent = 0, skipped = 0

    for (const s of rows || []) {
      // 🕐 waking window + spacing (skipped in test mode)
      if (!isTest) {
        const localHour = (utcHour + (s.tz_offset || 0) + 24) % 24
        if (localHour < s.wake_hour || localHour >= s.sleep_hour) { skipped++; continue }
        if (s.last_sent_at && now.getTime() - new Date(s.last_sent_at).getTime() < (s.every_hours || 3) * 3600e3) { skipped++; continue }
      }

      // 📸 today's snapshot, else latest
      let { data: snap } = await admin.from('reminder_snapshots')
        .select('*').eq('user_id', s.user_id).eq('day', today).maybeSingle()
      if (!snap) {
        const latest = await admin.from('reminder_snapshots')
          .select('*').eq('user_id', s.user_id).order('day', { ascending: false }).limit(1).maybeSingle()
        snap = latest.data
      }

      // 🏆 day already won → silence
      if (!isTest && snap && snap.tasks_due === 0 && snap.goal_hours > 0 && snap.focused_minutes >= snap.goal_hours * 60) { skipped++; continue }
      if (!isTest && !s.email_notifications) { skipped++; continue }

      const { data: userData } = await admin.auth.admin.getUserById(s.user_id)
      const email = userData?.user?.email
      if (!email) { skipped++; continue }

      const subject = (snap?.tasks_due || 0) > 0
        ? `⏳ ${snap.tasks_due} task${snap.tasks_due > 1 ? 's' : ''} waiting · 🔥 ${snap?.streak || 0}-day streak`
        : `🎯 ${Math.max(0, Number(snap?.goal_hours || 0) - Math.floor(Number(snap?.focused_minutes || 0) / 60))}h left of today's goal · 🔥 ${snap?.streak || 0}`

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject, html: buildEmail(s, snap) }),
      })

      if (res.ok) {
        sent++
        await admin.from('reminder_settings').update({ last_sent_at: now.toISOString() }).eq('user_id', s.user_id)
        console.log(`✅ Reminder emailed to ${email}`)
      } else {
        console.error('❌ Resend failed:', await res.text())
      }
    }

    return json({ sent, skipped, test: isTest })
  } catch (e: any) {
    console.error('❌ send-reminders:', e?.message || e)
    return json({ error: e?.message || 'Unknown error' }, 500)
  }
})