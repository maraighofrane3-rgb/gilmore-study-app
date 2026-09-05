import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // 1. Security: Verify the Cron Secret
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    // 2. Initialize Admin Client (Bypasses RLS to scan all users)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Find users who opted into notifications
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, username')
      .eq('notifications_enabled', true)

    if (usersError || !users) throw new Error('Failed to fetch users')

    const today = new Date().toISOString().split('T')[0]
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    let emailsSent = 0

    // 4. Process each user
    for (const user of users) {
      // Check Tasks
      const { count: taskCount } = await supabaseAdmin
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('due_date', today)
        .eq('status', 'todo')

      // Check Books
      const { data: stalledBooks } = await supabaseAdmin
        .from('books')
        .select('title')
        .eq('user_id', user.id)
        .eq('status', 'reading')
        .lt('updated_at', twoDaysAgo.toISOString())

      // Check Goals
      const { data: stalledGoals } = await supabaseAdmin
        .from('goals')
        .select('title')
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .lt('updated_at', twoDaysAgo.toISOString())

      // Only send email if there is something to remind them about
      const needsReminder = taskCount === 0 || stalledBooks.length > 0 || stalledGoals.length > 0

      if (needsReminder) {
        let messageBody = `<p>Dear ${user.username || 'Scholar'},</p><p>The Dean of Stars Hollow Academy has reviewed your records, and a few matters require your attention today:</p><ul>`

        if (taskCount === 0) {
          messageBody += `<li><strong>A Blank Page:</strong> You have no tasks scheduled for today. Lorelai says: "Write down your plans, even if it's just drinking coffee."</li>`
        }
        if (stalledBooks.length > 0) {
          messageBody += `<li><strong>Gathering Dust:</strong> You haven't opened <em>${stalledBooks[0].title}</em> in two days. The library misses you.</li>`
        }
        if (stalledGoals.length > 0) {
          messageBody += `<li><strong>Stalled Ambitions:</strong> No progress on <em>${stalledGoals[0].title}</em> recently. Don't let your dreams become "someday".</li>`
        }

        messageBody += `</ul><p>Return to your studies when you are ready.</p><p>— The Dean of Stars Hollow Academy</p>`

        // 5. Send via Resend
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'The Dean <onboarding@resend.dev>', // Replace with your verified domain later
            to: [user.email],
            subject: '☕ Your Morning Briefing from Stars Hollow',
            html: `
              <div style="font-family: 'Georgia', serif; background-color: #F7F2E9; padding: 40px; color: #132A44; max-width: 600px; margin: 0 auto; border: 1px solid #C9A227;">
                <h1 style="color: #A13D2B; font-style: italic;">The Morning Chronicle</h1>
                <div style="background-color: #FBF6EC; padding: 20px; border-radius: 4px; border-left: 4px solid #A13D2B;">
                  ${messageBody}
                </div>
              </div>
            `
          })
        })

        if (resendRes.ok) emailsSent++
      }
    }

    return new Response(JSON.stringify({ success: true, emailsSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})