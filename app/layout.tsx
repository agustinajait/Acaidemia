import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getSession } from '@/lib/auth';
import { signOut } from './actions/auth';

export const metadata: Metadata = {
  title: { default: 'Acaidemia — Cursos online con certificado', template: '%s · Acaidemia' },
  description: 'Cursos online con certificado verificable. Un producto de HUEHACI.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSession();
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="header">
          <div className="container">
            <Link href="/" className="logo">
              <span className="logo-mark">A</span>
              <span>Ac<b>ai</b>demia</span>
            </Link>
            <nav className="nav">
              <Link href="/cursos">Cursos</Link>
              {profile ? (
                <>
                  <Link href="/mi-cuenta">Mis cursos</Link>
                  {(profile.role === 'docente' || profile.role === 'admin') && <Link href="/docente" className="hide-sm">Docente</Link>}
                  {profile.role === 'admin' && <Link href="/admin" className="hide-sm">Admin</Link>}
                  <form action={signOut}><button className="btn ghost sm" type="submit">Salir</button></form>
                </>
              ) : (
                <>
                  <Link href="/ingresar">Ingresar</Link>
                  <Link href="/registro" className="btn sm" style={{ color: 'var(--brand-ink)' }}>Crear cuenta</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <div className="container row between">
            <span>Acaidemia · un producto de <strong>HUEHACI</strong></span>
            <span className="row"><Link href="/certificados">Verificar un certificado</Link></span>
          </div>
        </footer>
      </body>
    </html>
  );
}
