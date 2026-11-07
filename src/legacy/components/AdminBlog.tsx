import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2, Upload, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { compressImage } from '../lib/imageCompress';
import { Button } from '@/components/ui/button';
import { adminListBlogPosts, deleteBlogPost, saveBlogPost, uploadBlogImage } from '@/lib/blog.functions';
import { BLOG_CATEGORIES, SEO_DESC_MAX, SEO_TITLE_MAX, parseKeywords, slugify, type BlogPost } from '@/lib/blog';

type Draft = Omit<BlogPost, 'id' | 'publishedAt' | 'updatedAt' | 'keywords'> & { id?: string; keywordsText: string };
const empty: Draft = { title: '', slug: '', excerpt: '', content: '', coverImage: '', category: 'Balita', seoTitle: '', seoDescription: '', keywordsText: '', status: 'draft' };

async function token() {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error('Mag-login ulit.');
  return t;
}

const input = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={`text-xs ${n > max ? 'text-destructive' : 'text-muted-foreground'}`}>{n}/{max}</span>;
}

export function AdminBlog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [d, setD] = useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try { setPosts(await adminListBlogPosts({ data: { token: await token() } })); }
    catch (e: any) { setMsg(e.message); }
  }
  useEffect(() => { load(); }, []);

  const set = (patch: Partial<Draft>) => setD(prev => prev && { ...prev, ...patch });

  function edit(p?: BlogPost) {
    setMsg(null);
    setSlugTouched(!!p);
    setD(p ? { ...p, keywordsText: p.keywords.join(', ') } : { ...empty });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setMsg(null);
    try {
      const c = await compressImage(f);
      const dataUrl = await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = no; r.readAsDataURL(c); });
      const { url } = await uploadBlogImage({ data: { token: await token(), dataUrl } });
      set({ coverImage: url });
    } catch (err: any) { setMsg(err.message || 'Hindi ma-upload.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function save(status: 'draft' | 'published') {
    if (!d) return;
    setBusy(true); setMsg(null);
    try {
      const { keywordsText, ...rest } = d;
      const saved = await saveBlogPost({ data: { token: await token(), post: { ...rest, status, keywords: parseKeywords(keywordsText) } } });
      setD({ ...saved, keywordsText: saved.keywords.join(', ') });
      setMsg(status === 'published' ? 'Na-publish na! ✅' : 'Na-save bilang draft.');
      load();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('Burahin ang article na ito?')) return;
    try { await deleteBlogPost({ data: { token: await token(), id } }); setD(null); load(); }
    catch (e: any) { setMsg(e.message); }
  }

  if (!d) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Blog Articles</h2>
        <div className="flex gap-2">
          <a href="/blog" target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink />Tingnan</Button></a>
          <Button size="sm" onClick={() => edit()}><Plus />Bagong Article</Button>
        </div>
      </div>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
      {posts.length === 0 && <p className="text-sm text-muted-foreground">Wala pang article.</p>}
      <div className="space-y-2">
        {posts.map(p => (
          <button key={p.id} onClick={() => edit(p)} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-primary">
            {p.coverImage ? <img src={p.coverImage} alt="" className="h-14 w-24 shrink-0 rounded object-cover" /> : <div className="h-14 w-24 shrink-0 rounded bg-secondary" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.title}</p>
              <p className="truncate text-xs text-muted-foreground">/blog/{p.slug} · {p.category}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === 'published' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{p.status === 'published' ? 'Published' : 'Draft'}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const seoTitle = d.seoTitle || d.title;
  const seoDesc = d.seoDescription || d.excerpt;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setD(null)}>← Lahat ng Articles</Button>
        <div className="flex gap-2">
          {d.id && <Button variant="outline" size="sm" onClick={() => remove(d.id!)}><Trash2 />Burahin</Button>}
          <Button variant="outline" size="sm" disabled={busy} onClick={() => save('draft')}>Save Draft</Button>
          <Button size="sm" disabled={busy} onClick={() => save('published')}>{busy && <Loader2 className="animate-spin" />}Publish</Button>
        </div>
      </div>
      {msg && <p className="text-sm font-medium text-primary">{msg}</p>}

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-bold">Thumbnail (1200×630 ideal)</h3>
        {d.coverImage ? <img src={d.coverImage} alt="" className="aspect-[1200/630] w-full max-w-xl rounded-lg object-cover" /> : <div className="flex aspect-[1200/630] w-full max-w-xl items-center justify-center rounded-lg bg-secondary text-sm text-muted-foreground">Walang thumbnail</div>}
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}><Upload />{d.coverImage ? 'Palitan' : 'Mag-upload'}</Button>
          {d.coverImage && <Button variant="ghost" size="sm" onClick={() => set({ coverImage: '' })}>Alisin</Button>}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-bold">Article</h3>
        <label className="block text-sm font-medium">Title
          <input className={input} value={d.title} onChange={e => set({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })} /></label>
        <label className="block text-sm font-medium">Category
          <select className={input} value={d.category} onChange={e => set({ category: e.target.value })}>{BLOG_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
        <label className="block text-sm font-medium">Maikling buod (excerpt)
          <textarea className={input} rows={2} value={d.excerpt} onChange={e => set({ excerpt: e.target.value })} /></label>
        <label className="block text-sm font-medium">Content
          <span className="block text-xs font-normal text-muted-foreground">## Heading · **bold** · - list · [link](https://...) · ![larawan](https://...)</span>
          <textarea className={`${input} font-mono`} rows={18} value={d.content} onChange={e => set({ content: e.target.value })} /></label>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="font-bold">SEO Setup</h3>
        <label className="block text-sm font-medium"><span className="flex justify-between">SEO Title <Counter n={seoTitle.length} max={SEO_TITLE_MAX} /></span>
          <input className={input} placeholder={d.title} value={d.seoTitle} onChange={e => set({ seoTitle: e.target.value })} /></label>
        <label className="block text-sm font-medium"><span className="flex justify-between">Meta Description <Counter n={seoDesc.length} max={SEO_DESC_MAX} /></span>
          <textarea className={input} rows={3} placeholder={d.excerpt} value={d.seoDescription} onChange={e => set({ seoDescription: e.target.value })} /></label>
        <label className="block text-sm font-medium">Slug
          <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">gopalengke.net/blog/</span>
            <input className={input} value={d.slug} onChange={e => { setSlugTouched(true); set({ slug: slugify(e.target.value) }); }} /></div></label>
        <label className="block text-sm font-medium">Target Keywords (hiwalay sa kuwit)
          <input className={input} placeholder="online palengke, alternatibo sa grab" value={d.keywordsText} onChange={e => set({ keywordsText: e.target.value })} /></label>
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="mb-1 text-xs text-muted-foreground">Google preview</p>
          <p className="truncate text-xs text-muted-foreground">gopalengke.net › blog › {d.slug || '...'}</p>
          <p className="truncate text-lg text-primary">{seoTitle || 'Title ng article'}</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">{seoDesc || 'Meta description...'}</p>
        </div>
      </section>
    </div>
  );
}
