'use client';
import { useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_MB = 5;

/** Foto de especialista: subir una imagen (va al bucket "portadas") o pegar un link. Guarda la URL en `name`. */
export function PhotoField({ name, defaultValue }: { name: string; defaultValue: string | null }) {
  const [url, setUrl] = useState(defaultValue ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    if (!ACCEPT.split(',').includes(file.type)) { setError('Usá una foto JPG, PNG o WebP.'); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`La foto pesa más de ${MAX_MB} MB.`); return; }
    setBusy(true);
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Tu sesión venció. Volvé a ingresar.');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/especialistas/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('portadas').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
      if (upErr) throw upErr;
      setUrl(supabase.storage.from('portadas').getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setError(`No se pudo subir: ${e instanceof Error ? e.message : 'error desconocido'}`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="field photo-field">
      <label>Foto</label>
      <div className="row" style={{ alignItems: 'center', gap: 14 }}>
        <span className="avatar sm">{url ? <img src={url} alt="" /> : '?'}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input ref={fileRef} type="file" accept={ACCEPT} disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <div className="hint">Subí una foto (JPG, PNG o WebP, hasta {MAX_MB} MB) o pegá un link abajo. Mejor cuadrada.</div>
        </div>
      </div>
      <input type="url" name={name} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (link a la foto)" style={{ marginTop: 8 }} />
      {busy && <div className="hint">Subiendo foto…</div>}
      {error && <div className="hint" style={{ color: 'var(--danger)' }}>{error}</div>}
    </div>
  );
}
