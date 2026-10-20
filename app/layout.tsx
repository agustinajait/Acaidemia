import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { getSession } from '@/lib/auth';
import { signOut } from './actions/auth';
import { Icon } from '@/components/icons';

export const metadata: Metadata = {
  title: { default: 'Acaiidemia — Cursos y contenidos para emprendedores de impacto social', template: '%s · Acaiidemia' },
  description: 'Cursos y contenidos para emprendedores de impacto social, con certificado verificable. Un producto de HUEHACI.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getSession();
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,500;6..12,600;6..12,700;6..12,800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="header">
          <div className="container">
            <Link href="/" className="logo">
              <img src="/logo.png" alt="" className="logo-mark" width={34} height={34} />
              <span>Ac<b>aii</b>demia</span>
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
          <div className="container footer-grid">
            <div className="footer-brand">
              <Link href="/" className="logo">
                <img src="/logo.png" alt="" className="logo-mark" width={34} height={34} />
                <span>Ac<b>aii</b>demia</span>
              </Link>
              <p>Cursos y contenidos para emprendedores de impacto social.</p>
            </div>
            <nav aria-label="Plataforma">
              <h4>Plataforma</h4>
              <ul>
                <li><Link href="/cursos">Cursos</Link></li>
                <li><Link href="/certificados">Verificar un certificado</Link></li>
                <li><Link href="/mi-cuenta#docente">Quiero enseñar</Link></li>
              </ul>
            </nav>
            <nav aria-label="Tu cuenta">
              <h4>Tu cuenta</h4>
              <ul>
                {profile ? (
                  <>
                    <li><Link href="/mi-cuenta">Mis cursos</Link></li>
                    <li><Link href={`/perfil/${profile.id}`}>Mi perfil</Link></li>
                  </>
                ) : (
                  <>
                    <li><Link href="/ingresar">Ingresar</Link></li>
                    <li><Link href="/registro">Crear cuenta</Link></li>
                  </>
                )}
              </ul>
            </nav>
            <div>
              <h4>Un producto de HUEHACI</h4>
              <a className="addr" href="https://www.google.com/maps/search/?api=1&query=Esmeralda+1029%2C+CABA%2C+Argentina" target="_blank" rel="noopener noreferrer">
                <Icon name="pin" size={18} />
                <span>Esmeralda 1029<br />Ciudad Autónoma de Buenos Aires</span>
              </a>
            </div>
          </div>
          <div className="container footer-bottom">
            <span>© {new Date().getFullYear()} HUEHACI. Todos los derechos reservados.</span>
            <span>Hecho en Buenos Aires</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
