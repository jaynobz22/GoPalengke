import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const declineRiderDelivery = createServerFn({ method: 'POST' })
  .inputValidator(input => z.object({ accessToken: z.string().min(20).max(8000), orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env['GOPALENGKE_SERVICE_ROLE_KEY'];
    if (!key) throw new Error('Hindi available ang pag-save ng decline ngayon. Subukan muli mamaya.');
    const { createClient } = await import('@supabase/supabase-js');
    const { GP_URL } = await import('./onboarding-reminders.server');
    const client = createClient(GP_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error } = await client.auth.getUser(data.accessToken);
    if (error || !auth.user) throw new Error('Mag-login muli bago i-decline ang delivery.');
    // No client-supplied rider ID or role is trusted: the verified account must
    // own the current, unaccepted assignment before any privileged update.
    const { releaseRiderAssignment } = await import('./rider-decline.server');
    return releaseRiderAssignment(client, data.orderId, auth.user.id);
  });