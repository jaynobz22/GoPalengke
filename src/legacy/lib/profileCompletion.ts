const filled = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== '';

/** Required details before first dashboard access. */
export function needsProfileCompletion(p: any): boolean {
  if (!p || p.role === 'admin') return false;
  if (!filled(p.full_name)) return true;
  if (p.role === 'buyer') {
    return ![p.avatar_url, p.house_photo_url, p.complete_address, p.city, p.barangay].every(filled);
  }
  if (p.role === 'rider') {
    return ![
      p.avatar_url, p.vehicle_type, p.rider_age, p.rider_family_status, p.rider_residence_address,
      p.rider_plate_number, p.rider_motor_model, p.rider_valid_id_url, p.rider_lto_or_cr_url, p.city, p.barangay,
    ].every(filled);
  }
  return false;
}