import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Icon } from '@/components/icons';
import { Spotlight } from '@/components/spotlight';
import { linkedinUrl, mediaOf } from '@/lib/media';
import type { Specialist } from '@/lib/types';

export const metadata = {
  title: 'Especialistas',
  description: 'Conocé a las y los especialistas que forman parte de Acaiidemia.',
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default async function Especialistas({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from('specialists').select('*').eq('published', true).order('position').order('full_name');
  const all = (data ?? []) as Specialist[];
  const categories = [...new Set(all.map((s) => s.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const list = categoria ? all.filter((s) => s.category.trim() === categoria) : all;

  return (
    <div className="container section">
      <div className="narrow" style={{ marginBottom: 28 }}>
        <span className="badge brand">Quiénes enseñan</span>
        <h1 style={{ marginTop: 12 }}>Especialistas</h1>
        <p className="muted" style={{ fontSize: '1.1rem' }}>
          Personas con experiencia en territorio, gestión y emprendimientos de impacto social que comparten lo que saben en Acaiidemia.
        </p>
      </div>

      {categories.length > 1 && (
        <nav className="chips" aria-label="Filtrar por categoría">
          <Link href="/especialistas" className={!categoria ? 'active' : ''}>Todas</Link>
          {categories.map((c) => (
            <Link key={c} href={`/especialistas?categoria=${encodeURIComponent(c)}`} className={categoria === c ? 'active' : ''}>{c}</Link>
          ))}
        </nav>
      )}

      {list.length ? (
        <Spotlight className="specialists">
          {list.map((s, i) => {
            const photo = mediaOf(s.photo_url);
            const li = linkedinUrl(s.linkedin_url);
            return (
              <article key={s.id} className="specialist feature" style={{ '--i': i } as React.CSSProperties}>
                <div className="specialist-head">
                  <span className="avatar">{photo?.kind === 'image' ? <img src={photo.src} alt={`Foto de ${s.full_name}`} loading="lazy" /> : initials(s.full_name)}</span>
                  <div>
                    <h3>{s.full_name}</h3>
                    {s.category && <Link href={`/especialistas?categoria=${encodeURIComponent(s.category.trim())}`} className="badge brand">{s.category}</Link>}
                  </div>
                </div>
                {s.bio && <p className="specialist-bio">{s.bio}</p>}
                {li && (
                  <a className="btn secondary sm linkedin" href={li} target="_blank" rel="noopener noreferrer" aria-label={`LinkedIn de ${s.full_name}`}>
                    <Icon name="linkedin" size={18} /> Ver LinkedIn
                  </a>
                )}
              </article>
            );
          })}
        </Spotlight>
      ) : (
        <div className="card flat muted">Pronto vas a conocer a nuestras y nuestros especialistas.</div>
      )}
    </div>
  );
}
