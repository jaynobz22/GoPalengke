import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { needsProfileCompletion } from '../legacy/lib/profileCompletion';

// Uses the existing external account system, not the managed Cloud session.
export const ensureRiderApprovalReminder = createServerFn({ method: 'POST' })
  .inputValidator(input => z.object({ accessToken: z.string().min(20).max(10000) }).parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import('@supabase/supabase-js');
    const { GP_URL, GP_ANON } = await import('./onboarding-reminders.server');
    const userClient = createClient(GP_URL, GP_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser(data.accessToken);
    if (authError || !auth.user) throw new Error('Hindi valid ang session.');
    const { data: profile, error: profileError } = await userClient.from('profiles').select('*').eq('id', auth.user.id).single();
    if (profileError) throw new Error('Hindi mabasa ang rider profile.');
    if (profile?.role !== 'rider' || profile.is_approved || needsProfileCompletion(profile)) return { sent: false };
    const { data: conversation, error: conversationError } = await userClient.from('admin_conversations')
      .select('id,admin_id').eq('user_id', auth.user.id).order('created_at').limit(1).maybeSingle();
    if (conversationError || !conversation) throw new Error('Hindi mabasa ang admin chat.');
    const key = process.env['GOPALENGKE_SERVICE_ROLE_KEY'];
    if (!key) throw new Error('Hindi available ang rider reminder.');
    const { sendRiderApprovalReminder } = await import('./rider-onboarding.server');
    const admin = createClient(GP_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
    await sendRiderApprovalReminder(admin, conversation);
    return { sent: true };
  });