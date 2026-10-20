import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { fecha, siteUrl } from './format';

const INK = rgb(0.17, 0.16, 0.19);     // #2b2930
const LILAC = rgb(0.58, 0.27, 0.74);   // #9446bd
const DEEP = rgb(0.36, 0.15, 0.47);    // #5b2678
const MUTED = rgb(0.41, 0.40, 0.44);   // #68656f
const GOLD = rgb(0.78, 0.43, 0.90);    // lila del logo #c86de6

interface CertData {
  code: string;
  holderName: string;
  courseTitle: string;
  hours: number | null;
  issuedAt: string;
  teacherName: string | null;
}

/** Las fuentes estándar solo soportan WinAnsi (incluye tildes y ñ). Quitamos lo demás. */
function safe(font: PDFFont, text: string) {
  return Array.from(text).map((ch) => {
    try { font.encodeText(ch); return ch; } catch { return ''; }
  }).join('');
}

function centered(page: PDFPage, font: PDFFont, text: string, y: number, size: number, color = INK, spacing = 0) {
  const t = safe(font, text);
  const w = font.widthOfTextAtSize(t, size) + spacing * Math.max(0, t.length - 1);
  if (!spacing) {
    page.drawText(t, { x: (page.getWidth() - w) / 2, y, size, font, color });
    return;
  }
  let x = (page.getWidth() - w) / 2;
  for (const ch of t) {
    page.drawText(ch, { x, y, size, font, color });
    x += font.widthOfTextAtSize(ch, size) + spacing;
  }
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = safe(font, text).split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

const STAR = 'M 0 -10 L 2.35 -3.24 L 9.51 -3.09 L 3.8 1.24 L 5.88 8.09 L 0 4 L -5.88 8.09 L -3.8 1.24 L -9.51 -3.09 L -2.35 -3.24 Z';

export async function renderCertificatePdf(d: CertData) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Certificado ${d.code} — Acaiidemia`);
  pdf.setAuthor('Acaiidemia · HUEHACI');
  pdf.setSubject(d.courseTitle);

  const page = pdf.addPage([842, 595]); // A4 apaisado
  const W = page.getWidth();
  const H = page.getHeight();
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifIt = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansB = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Fondo y marcos
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.99, 0.985, 0.995) });
  page.drawRectangle({ x: 0, y: 0, width: 14, height: H, color: DEEP });
  page.drawRectangle({ x: 14, y: 0, width: 5, height: H, color: LILAC });
  page.drawRectangle({ x: 40, y: 28, width: W - 68, height: H - 56, borderColor: LILAC, borderWidth: 1.2 });
  page.drawRectangle({ x: 46, y: 34, width: W - 80, height: H - 68, borderColor: rgb(0.91, 0.84, 0.96), borderWidth: 0.6 });

  // Marca
  centered(page, sansB, 'ACAIIDEMIA', H - 92, 15, DEEP, 4.5);
  centered(page, sans, 'un producto de HUEHACI', H - 108, 8.5, MUTED, 1.2);

  // Estrellas
  [-24, 0, 24].forEach((dx, i) => {
    page.drawSvgPath(STAR, { x: W / 2 + dx, y: H - 132, scale: i === 1 ? 0.95 : 0.7, color: GOLD });
  });

  centered(page, sansB, 'CERTIFICADO DE APROBACIÓN', H - 178, 12, LILAC, 3);
  centered(page, serifIt, 'Se certifica que', H - 212, 15, MUTED);

  // Nombre (ajusta el tamaño si es largo)
  let nameSize = 40;
  while (nameSize > 22 && serif.widthOfTextAtSize(safe(serif, d.holderName), nameSize) > W - 220) nameSize -= 2;
  centered(page, serif, d.holderName, H - 262, nameSize, INK);
  page.drawLine({ start: { x: W / 2 - 170, y: H - 276 }, end: { x: W / 2 + 170, y: H - 276 }, thickness: 0.8, color: LILAC });

  centered(page, serifIt, 'completó y aprobó el curso', H - 304, 15, MUTED);
  const titleLines = wrap(serif, `«${d.courseTitle}»`, 24, W - 240).slice(0, 2);
  titleLines.forEach((l, i) => centered(page, serif, l, H - 340 - i * 28, 24, DEEP));

  const meta = [d.hours ? `Carga horaria: ${String(d.hours).replace('.', ',')} h` : null, `Emitido el ${fecha(d.issuedAt)}`]
    .filter(Boolean).join('   ·   ');
  centered(page, sans, meta, H - 340 - titleLines.length * 28 - 6, 10.5, MUTED);

  // Firmas
  const sigY = 108;
  const sig = (cx: number, name: string, role: string) => {
    page.drawLine({ start: { x: cx - 95, y: sigY }, end: { x: cx + 95, y: sigY }, thickness: 0.7, color: INK });
    const n = safe(sansB, name);
    page.drawText(n, { x: cx - sansB.widthOfTextAtSize(n, 10) / 2, y: sigY - 15, size: 10, font: sansB, color: INK });
    page.drawText(role, { x: cx - sans.widthOfTextAtSize(role, 8.5) / 2, y: sigY - 28, size: 8.5, font: sans, color: MUTED });
  };
  sig(200, 'HUEHACI', 'Dirección Académica · Acaiidemia');
  if (d.teacherName) sig(430, d.teacherName, 'Docente del curso');

  // QR de verificación
  const verifyUrl = `${siteUrl()}/certificados/${d.code}`;
  const qrPng = await QRCode.toBuffer(verifyUrl, { margin: 0, width: 300, color: { dark: '#2b2930', light: '#00000000' } });
  const qr = await pdf.embedPng(qrPng);
  const qrSize = 92;
  const qrX = W - 80 - qrSize;
  const qrY = 70;
  page.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  const codeText = d.code;
  page.drawText(codeText, { x: qrX + (qrSize - sansB.widthOfTextAtSize(codeText, 9)) / 2, y: qrY - 14, size: 9, font: sansB, color: DEEP });
  const v = 'Verificá escaneando el QR';
  page.drawText(v, { x: qrX + (qrSize - sans.widthOfTextAtSize(v, 7)) / 2, y: qrY - 25, size: 7, font: sans, color: MUTED });

  const host = safe(sans, verifyUrl.replace(/^https?:\/\//, ''));
  page.drawText(host, { x: 62, y: 46, size: 7, font: sans, color: MUTED });

  return pdf.save();
}
