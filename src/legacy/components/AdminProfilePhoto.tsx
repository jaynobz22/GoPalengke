import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ImageUploadField } from './ImageUploadField';

export function AdminProfilePhoto() {
  const { profile, refreshProfile } = useAuth();
  const [saved, setSaved] = useState(false);
  if (!profile) return null;

  return (
    <section className="mb-5 border-b border-border pb-5">
      <h3 className="mb-3 font-semibold text-foreground">Admin Profile</h3>
      <div className="max-w-xs">
        <ImageUploadField
          label="Profile Picture ng Admin"
          value={profile.avatar_url || ''}
          bucket="profile-images"
          folder={`avatars/${profile.id}`}
          aspectClass="h-40"
          cropAspect={1}
          objectFit="contain"
          onChange={async (url) => {
            setSaved(false);
            const { data, error } = await supabase.from('profiles')
              .update({ avatar_url: url || null }).eq('id', profile.id)
              .select('id').single();
            if (error) throw error;
            if (!data) throw new Error('Hindi na-save ang profile picture. Subukan muli.');
            await refreshProfile();
            setSaved(true);
          }}
        />
      </div>
      {saved && <p role="status" className="mt-2 text-sm text-primary">Na-save ang profile picture.</p>}
    </section>
  );
}