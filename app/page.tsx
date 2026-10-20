import Link from 'next/link';
import { CourseCard } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import { Spotlight } from '@/components/spotlight';
import { publishedCourses, teacherName } from '@/lib/queries';

const FEATURES: { icon: IconName; title: string; text: string; cta: string; href: string }[] = [
  { icon: 'award', title: 'Certificado con QR', text: 'Cada certificado tiene un código único que cualquiera puede verificar online.', cta: 'Verificar uno', href: '/certificados' },
  { icon: 'star', title: 'Estrellas en tu perfil', text: 'Por cada curso aprobado sumás una estrella en tu perfil público.', cta: 'Empezar a sumar', href: '/cursos' },
  { icon: 'card', title: 'Mercado Pago o transferencia', text: 'Pagá con tarjeta, dinero en cuenta o transferí y subí el comprobante.', cta: 'Ver cursos', href: '/cursos' },
  { icon: 'users', title: 'Docentes de la comunidad', text: 'Publicá tu curso, nosotros lo revisamos y lo ponemos a la venta.', cta: 'Quiero enseñar', href: '/mi-cuenta#docente' },
];

export default async function Home() {
  const courses = await publishedCourses({ limit: 6 });
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
          <span className="badge brand">Un producto de HUEHACI</span>
          <h1 style={{ marginTop: 14 }}>Aprender para <em>generar impacto</em></h1>
          <p className="lead">Formación práctica para acompañar personas, fortalecer comunidades y emprender con propósito.</p>
          <p className="hero-note">Cursos para operadores sociocomunitarios, emprendedores socioeducativos y agentes de desarrollo humano y económico, con certificado verificable por QR.</p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link href="/cursos" className="btn">Ver cursos</Link>
            <Link href="/mi-cuenta#docente" className="btn secondary">Quiero enseñar</Link>
          </div>
          </div>
          <figure className="hero-art">
            <img
              src="/hero.jpg" srcSet="/hero-900.jpg 900w, /hero.jpg 1584w" sizes="(max-width: 860px) 100vw, 640px"
              width={1584} height={672} fetchPriority="high"
              alt="Lamparita de alambre lila con monedas adentro, rodeada de amatistas, lavanda y un camino de alambre con personas, un libro y un árbol"
            />
          </figure>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Spotlight className="features">
            {FEATURES.map((f, i) => (
              <Link key={f.title} href={f.href} className="feature" style={{ '--i': i } as React.CSSProperties}>
                <span className="ic"><Icon name={f.icon} size={22} /></span>
                <h3>{f.title}</h3>
                <p className="muted small">{f.text}</p>
                <span className="more">{f.cta} <Icon name="arrow" size={16} /></span>
              </Link>
            ))}
          </Spotlight>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="row between" style={{ marginBottom: 18 }}>
            <h2 style={{ margin: 0 }}>Cursos recientes</h2>
            <Link href="/cursos" className="btn ghost sm">Ver todos <Icon name="arrow" size={16} /></Link>
          </div>
          {courses.length ? (
            <Spotlight className="grid">{courses.map((c, i) => <CourseCard key={c.id} c={c} teacher={teacherName(c.owner)} index={i} />)}</Spotlight>
          ) : (
            <div className="card flat muted">Todavía no hay cursos publicados.</div>
          )}
        </div>
      </section>
    </>
  );
}
