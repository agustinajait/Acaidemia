import { CourseCard } from '@/components/ui';
import { publishedCourses, teacherName } from '@/lib/queries';

export const metadata = { title: 'Cursos' };

export default async function Cursos({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  const { q, cat } = await searchParams;
  const [courses, all] = await Promise.all([publishedCourses({ q, category: cat }), publishedCourses()]);
  const categories = Array.from(new Set(all.map((c) => c.category).filter(Boolean))) as string[];
  return (
    <div className="container section">
      <h1>Cursos</h1>
      <form className="row" style={{ marginBottom: 24 }}>
        <input type="text" name="q" defaultValue={q} placeholder="Buscar por tema o título…" style={{ flex: '1 1 240px' }} />
        {categories.length > 0 && (
          <select name="cat" defaultValue={cat ?? ''} style={{ flex: '0 1 200px' }}>
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button className="btn" type="submit">Buscar</button>
      </form>
      {courses.length ? (
        <div className="grid">{courses.map((c) => <CourseCard key={c.id} c={c} teacher={teacherName(c.owner)} />)}</div>
      ) : (
        <div className="card flat muted">No encontramos cursos con esos filtros.</div>
      )}
    </div>
  );
}
