import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const adminSupabase = createAdminClient();
    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    // 1. Fetch all families
    const { data: families, error: famErr } = await adminSupabase
      .from('families')
      .select('id, name, settings');

    if (famErr) throw famErr;
    if (!families || families.length === 0) {
      return NextResponse.json({ message: 'No families found' });
    }

    let digestsSent = 0;

    // 2. Loop through families to compile and send digests
    for (const family of families) {
      const settings = (family.settings || {}) as Record<string, any>;
      const timezone = settings.timezone || 'Asia/Kolkata';

      // Get current date/time in the family's timezone
      let nowInTz: Date;
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        });
        const parts = formatter.formatToParts(new Date());
        const tempMap = new Map(parts.map(p => [p.type, p.value]));
        
        nowInTz = new Date(
          parseInt(tempMap.get('year')!),
          parseInt(tempMap.get('month')!) - 1,
          parseInt(tempMap.get('day')!)
        );
      } catch (tzError) {
        nowInTz = new Date();
      }

      const sevenDaysAgo = new Date(nowInTz);
      sevenDaysAgo.setDate(nowInTz.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString();

      // A. Query completed habits (we fetch habits first, then query logs)
      const { data: habits } = await adminSupabase
        .from('habits')
        .select('id')
        .eq('family_id', family.id);
      
      const habitIds = habits?.map(h => h.id) || [];
      let completedHabitsCount = 0;
      if (habitIds.length > 0) {
        const { count } = await adminSupabase
          .from('habit_logs')
          .select('*', { count: 'exact', head: true })
          .in('habit_id', habitIds)
          .gte('logged_at', sevenDaysAgoStr);
        completedHabitsCount = count || 0;
      }

      // B. Query shared expenses
      const { data: expenses } = await adminSupabase
        .from('expenses')
        .select('amount, title')
        .eq('family_id', family.id)
        .gte('created_at', sevenDaysAgoStr);
      
      const expensesCount = expenses?.length || 0;
      const totalExpensesAmount = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

      // C. Query upcoming occasions in the next 7 days
      const upcomingDates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(nowInTz);
        d.setDate(nowInTz.getDate() + i);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        upcomingDates.push(`${m}-${day}`);
      }

      const { data: occasions } = await adminSupabase
        .from('occasions')
        .select('name, date, type')
        .eq('family_id', family.id);
      
      const upcomingOccasions = occasions?.filter(occ => {
        if (!occ.date) return false;
        const [, m, day] = occ.date.split('-');
        return upcomingDates.push(`${m}-${day}`) && upcomingDates.includes(`${m}-${day}`);
      }) || [];

      // D. Query completed todos
      const { count: completedTodosCount } = await adminSupabase
        .from('todos')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family.id)
        .eq('status', 'completed')
        .gte('updated_at', sevenDaysAgoStr);

      // E. Query new memories
      const { count: newMemoriesCount } = await adminSupabase
        .from('memories')
        .select('*', { count: 'exact', head: true })
        .eq('family_id', family.id)
        .gte('created_at', sevenDaysAgoStr);

      // F. Fetch family members to send emails to
      const { data: users } = await adminSupabase
        .from('users')
        .select('email, full_name')
        .eq('family_id', family.id)
        .eq('status', 'active');

      if (!users || users.length === 0) continue;

      const emails = users.map(u => u.email);

      // Construct a highly premium HTML Email template
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Weekly Family Digest</title>
          <style>
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background-color: #030712;
              color: #f3f4f6;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #0f172a;
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 24px;
              overflow: hidden;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            }
            .header {
              padding: 40px 30px;
              background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
              border-bottom: 1px solid rgba(255, 255, 255, 0.08);
              text-align: center;
            }
            .header h1 {
              font-size: 28px;
              font-weight: 800;
              margin: 0;
              color: #4fdbc8;
              letter-spacing: -0.03em;
            }
            .header p {
              font-size: 14px;
              color: #94a3b8;
              margin: 8px 0 0 0;
            }
            .content {
              padding: 30px;
              space-y: 25px;
            }
            .section-title {
              font-size: 16px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #adc6ff;
              margin-bottom: 15px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.05);
              padding-bottom: 5px;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
              margin-bottom: 25px;
            }
            .card {
              background-color: rgba(255, 255, 255, 0.02);
              border: 1px solid rgba(255, 255, 255, 0.05);
              border-radius: 16px;
              padding: 20px;
              text-align: center;
            }
            .card-val {
              font-size: 32px;
              font-weight: 800;
              color: #4fdbc8;
              margin: 0 0 5px 0;
            }
            .card-label {
              font-size: 12px;
              color: #94a3b8;
              text-transform: uppercase;
              font-weight: 600;
            }
            .list-item {
              padding: 12px 15px;
              background-color: rgba(255, 255, 255, 0.02);
              border: 1px solid rgba(255, 255, 255, 0.05);
              border-radius: 12px;
              margin-bottom: 10px;
              font-size: 14px;
              color: #e2e8f0;
            }
            .footer {
              padding: 30px;
              background-color: #090d16;
              border-top: 1px solid rgba(255, 255, 255, 0.05);
              text-align: center;
              font-size: 12px;
              color: #64748b;
            }
            .btn {
              display: inline-block;
              padding: 12px 24px;
              background-color: #4fdbc8;
              color: #030712;
              text-decoration: none;
              font-weight: 700;
              border-radius: 12px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Neralla Nexus</h1>
              <p>Weekly Family Digest • ${sevenDaysAgo.toLocaleDateString('en-IN')} to ${nowInTz.toLocaleDateString('en-IN')}</p>
            </div>
            
            <div class="content">
              <div class="section-title">Household Accomplishments</div>
              <div class="grid">
                <div class="card">
                  <div class="card-val">${completedTodosCount || 0}</div>
                  <div class="card-label">Tasks Finished</div>
                </div>
                <div class="card">
                  <div class="card-val">${completedHabitsCount}</div>
                  <div class="card-label">Habits Checked</div>
                </div>
              </div>

              <div class="section-title">Finance & Expense Log</div>
              <div class="grid">
                <div class="card">
                  <div class="card-val">${expensesCount}</div>
                  <div class="card-label">Shared Expenses</div>
                </div>
                <div class="card">
                  <div class="card-val">₹${totalExpensesAmount.toLocaleString('en-IN')}</div>
                  <div class="card-label">Total Spent</div>
                </div>
              </div>

              <div class="section-title">Memories Captured</div>
              <div style="text-align: center; padding: 10px 0 25px 0;">
                <div style="font-size: 44px; margin-bottom: 5px;">📸</div>
                <div style="font-size: 18px; font-weight: bold; color: #ffb59e;">${newMemoriesCount || 0} New Memories Added</div>
                <p style="font-size: 12px; color: #94a3b8; margin: 5px 0 0 0;">Relive your precious family moments in the gallery vault.</p>
              </div>

              ${upcomingOccasions.length > 0 ? `
                <div class="section-title">Upcoming Occasions</div>
                <div style="margin-bottom: 25px;">
                  ${upcomingOccasions.map(occ => `
                    <div class="list-item" style="display: flex; justify-content: space-between; align-items: center;">
                      <span>🎉 <strong>${occ.name}</strong></span>
                      <span style="color: #ffb59e; font-size: 12px; text-transform: uppercase;">${occ.type}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              <div style="text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://neralla-nexus.vercel.app'}/dashboard" class="btn">Open Family Headquarters</a>
              </div>
            </div>
            
            <div class="footer">
              <p>Sent with love from Neralla Nexus</p>
              <p>You received this email because you are a registered member of the ${family.name}.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // G. Dispatch Email
      if (!resendApiKey) {
        console.log('--- [MOCK WEEKLY DIGEST EMAIL] ---');
        console.log(`From: ${emailFrom}`);
        console.log(`To: ${emails.join(', ')}`);
        console.log(`Subject: Weekly Family Digest — ${family.name}`);
        console.log(`Content Compiled successfully.`);
        console.log('-----------------------------------');
        digestsSent++;
        continue;
      }

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `Neralla Nexus <${emailFrom}>`,
            to: emails,
            subject: `Weekly Family Digest — ${family.name} 🏠`,
            html: htmlContent,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          digestsSent++;
        } else {
          console.error(`Resend API error sending digest to family ${family.id}:`, data);
        }
      } catch (emailErr) {
        console.error(`Failed to send weekly digest email to family ${family.id}:`, emailErr);
      }
    }

    return NextResponse.json({ success: true, digestsSent });
  } catch (err: any) {
    console.error('Weekly digest cron error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
