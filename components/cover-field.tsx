'use client';
import { useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Cover } from '@/components/ui';
import { COVER_ACCEPT, COVER_MAX_MB, mediaOf } from '@/lib/media';

/**
 * Portada del curso con dos opciones: subir un archivo (imagen o video) o pegar un link
 * (imagen, video, YouTube o Vimeo). El archivo se sube directo a Supabase Storage desde el
 * navegador y su URL pública queda en el campo "cover_url" que guarda el formulario.
 */
export function CoverField({ defaultValue, title }: { defaultValue: string | null; title: string }) {
  const [url, setUrl] = useState(defaultValue ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setMsg(null);
    if (!COVER_ACCEPT.split(',').includes(file.type)) {
      setMsg({ type: 'error', text: 'Formato no permitido. Usá JPG, PNG, WebP, GIF, MP4, WebM o MOV.' });
      return;
    }
    if (file.size > COVER_MAX_MB * 1024 * 1024) {
      setMsg({ type: 'error', text: `El archivo pesa más de ${COVER_MAX_MB} MB. Probá con uno más liviano o subilo a YouTube y pegá el link.` });
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Tu sesión venció. Volvé a ingresar.');
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('portadas').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
      if (error) throw error;
      const { data } = supabase.storage.from('portadas').getPublicUrl(path);
      setUrl(data.publicUrl);
      setMsg({ type: 'ok', text: 'Archivo subido. Tocá "Guardar" para aplicar la portada.' });
    } catch (e) {
      setMsg({ type: 'error', text: `No se pudo subir: ${e instanceof Error ? e.message : 'error desconocido'}` });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const linkInvalid = url.trim() !== '' && !mediaOf(url.trim());

  return (
    <div className="field cover-field">
      <label>Portada del curso</label>
      <div className="hint" style={{ marginTop: 0, marginBottom: 10 }}>Puede ser una imagen o un video. Si es video, se reproduce solo y sin sonido en el catálogo.</div>

      <div className="cover-preview"><Cover url={linkInvalid ? null : url.trim() || null} title={title || 'Curso'} /></div>

      <div className="cover-options">
        <div>
          <div className="cover-option-title">Opción 1 · Subir un archivo</div>
          <input ref={fileRef} type="file" accept={COVER_ACCEPT} disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          <div className="hint">JPG, PNG, WebP, GIF, MP4, WebM o MOV · hasta {COVER_MAX_MB} MB. Para video, mejor un clip corto (10–20 s).</div>
        </div>
        <div>
          <div className="cover-option-title">Opción 2 · Pegar un link</div>
          <input type="url" name="cover_url" value={url} onChange={(e) => { setUrl(e.target.value); setMsg(null); }}
            placeholder="https://… (imagen, video .mp4, YouTube o Vimeo)" aria-invalid={linkInvalid} />
          <div className="hint">Funciona con links de YouTube (youtube.com o youtu.be), Vimeo, o a una imagen o video directo.</div>
        </div>
      </div>

      {busy && <div className="flash info" role="status" style={{ marginTop: 10 }}>Subiendo archivo…</div>}
      {msg && <div className={`flash ${msg.type}`} role={msg.type === 'error' ? 'alert' : 'status'} style={{ marginTop: 10 }}>{msg.text}</div>}
      {linkInvalid && <div className="hint" style={{ color: 'var(--danger)' }}>El link tiene que empezar con https://</div>}
      {url && !busy && <button type="button" className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => { setUrl(''); setMsg(null); }}>Quitar portada</button>}
    </div>
  );
}
