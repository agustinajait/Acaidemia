import Link from 'next/link';
import { CourseCard } from '@/components/ui';
import { publishedCourses, teacherName } from '@/lib/queries';

export default async function Home() {
  const courses = await publishedCourses({ limit: 6 });
  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="badge brand">Un producto de HUEHACI</span>
          <h1 style={{ marginTop: 14 }}>Cursos y contenidos para emprendedores de <em>impacto social</em></h1>
          <p className="lead">Aprendé a tu ritmo con especialistas y obtené un certificado digital verificable por QR. Pagás con Mercado Pago o transferencia.</p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link href="/cursos" className="btn">Ver cursos</Link>
            <Link href="/mi-cuenta#docente" className="btn secondary">Quiero enseñar</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="features">
            <div className="feature"><div className="ic">🎓</div><h3>Certificado con QR</h3><p className="muted small">Cada certificado tiene un código único que cualquiera puede verificar online.</p></div>
            <div className="feature"><div className="ic">⭐</div><h3>Estrellas en tu perfil</h3><p className="muted small">Por cada curso aprobado sumás una estrella en tu perfil público.</p></div>
            <div className="feature"><div className="ic">💳</div><h3>Mercado Pago o transferencia</h3><p className="muted small">Pagá con tarjeta, dinero en cuenta o transferí y subí el comprobante.</p></div>
            <div className="feature"><div className="ic">🧑‍🏫</div><h3>Docentes de la comunidad</h3><p className="muted small">Publicá tu curso, nosotros lo revisamos y lo ponemos a la venta.</p></div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="row between" style={{ marginBottom: 18 }}>
            <h2 style={{ margin: 0 }}>Cursos recientes</h2>
            <Link href="/cursos" className="btn ghost sm">Ver todos →</Link>
          </div>
          {courses.length ? (
            <div className="grid">{courses.map((c) => <CourseCard key={c.id} c={c} teacher={teacherName(c.owner)} />)}</div>
          ) : (
            <div className="card flat muted">Todavía no hay cursos publicados.</div>
          )}
        </div>
      </section>
    </>
  );
}
