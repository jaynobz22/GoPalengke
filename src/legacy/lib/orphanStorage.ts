// @ts-nocheck
import { supabase } from './supabase';

/** Buckets we sweep for orphaned (unreferenced) uploads. */
const SWEEP_BUCKETS = ['profile-images', 'store-images', 'product-images'];

const URL_RE = /\/storage\/v1\/object\/public\/([^/"'\s]+)\/([^"'\s?\\]+)/g;

function collect(rows: any, out: Map<string, Set<string>>) {
  if (!rows) return;
  const text = JSON.stringify(rows);
  let m: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    const bucket = m[1];
    const path = decodeURIComponent(m[2]);
    if (!out.has(bucket)) out.set(bucket, new Set());
    out.get(bucket)!.add(path);
  }
}

/** Reads a whole table; throws when the read fails so we never delete on partial data. */
async function readAll(table: string): Promise<any[] | null> {
  const rows: any[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + page - 1);
    if (error) {
      // Table may simply not exist in this project — that is fine.
      if (/does not exist|schema cache|relation/i.test(error.message || '')) return [];
      throw new Error(`Hindi mabasa ang "${table}": ${error.message}`);
    }
    rows.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return rows;
}

/** Recursively lists every object path inside a bucket. */
async function listBucket(bucket: string, prefix = ''): Promise<string[]> {
  const found: string[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: page, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Hindi mabuksan ang "${bucket}": ${error.message}`);
    const entries = data || [];
    for (const entry of entries) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null || entry.metadata === null) {
        // It is a folder — go deeper.
        found.push(...(await listBucket(bucket, full)));
      } else {
        found.push(full);
      }
    }
    if (entries.length < page) break;
  }
  return found;
}

export type OrphanScan = {
  /** bucket -> list of unreferenced object paths */
  orphans: Map<string, string[]>;
  totalFiles: number;
  totalOrphans: number;
};

/** Finds every uploaded file that no database record points to any more. */
export async function scanOrphanStorage(): Promise<OrphanScan> {
  const referenced = new Map<string, Set<string>>();

  const tables = [
    'profiles',
    'stores',
    'products',
    'messages',
    'admin_messages',
    'affiliate_messages',
    'orders',
    'reviews',
    'affiliates',
    'fee_payments',
    'rider_fee_payments',
    'video_credit_purchases',
    'announcements',
    'tutorials',
    'marketing_materials',
    'campaigns',
  ];

  for (const table of tables) {
    collect(await readAll(table), referenced);
  }

  const orphans = new Map<string, string[]>();
  let totalFiles = 0;
  let totalOrphans = 0;

  for (const bucket of SWEEP_BUCKETS) {
    let paths: string[];
    try {
      paths = await listBucket(bucket);
    } catch {
      continue; // bucket may not exist
    }
    totalFiles += paths.length;
    const used = referenced.get(bucket) || new Set<string>();
    const unused = paths.filter(p => !used.has(p));
    if (unused.length) {
      orphans.set(bucket, unused);
      totalOrphans += unused.length;
    }
  }

  return { orphans, totalFiles, totalOrphans };
}

/** Deletes the files reported by scanOrphanStorage. Returns how many were actually removed. */
export async function deleteOrphanStorage(scan: OrphanScan): Promise<number> {
  let removed = 0;
  for (const [bucket, paths] of scan.orphans) {
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { data, error } = await supabase.storage.from(bucket).remove(batch);
      if (error) throw new Error(`Hindi mabura sa "${bucket}": ${error.message}`);
      removed += data?.length || 0;
    }
  }
  return removed;
}
