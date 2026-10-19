import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="container section narrow" style={{ textAlign: 'center' }}>
      <h1>No encontramos esta página</h1>
      <p className="muted">Puede que el curso ya no esté disponible.</p>
      <Link href="/cursos" className="btn">Ver cursos</Link>
    </div>
  );
}
