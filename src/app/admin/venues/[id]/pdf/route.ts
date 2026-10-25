import { NextRequest } from 'next/server';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';

function normalizeHex(hex: string | null | undefined, defaultHex: string): string {
  if (!hex) return defaultHex;
  let clean = hex.trim();
  if (clean.startsWith('%23')) clean = clean.replace('%23', '#');
  if (!clean.startsWith('#')) clean = `#${clean}`;
  return /^#[0-9A-Fa-f]{6}$/.test(clean) ? clean : defaultHex;
}

function isDarkColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) || 0;
  const g = parseInt(c.substring(2, 4), 16) || 0;
  const b = parseInt(c.substring(4, 6), 16) || 0;
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

export interface PdfDesignOptions {
  bgColor: string;
  accentColor: string;
  textColor: string;
  badgeTextColor: string;
  subtextColor: string;
  isDark: boolean;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: venueId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'a4'; // 'a4' | 'tent' | 'mini'
  const tableFilter = searchParams.get('table');

  // Custom Colors
  const bgColor = normalizeHex(searchParams.get('bg'), '#ffffff');
  const accentColor = normalizeHex(searchParams.get('accent'), '#7c3aed');
  const textColor = normalizeHex(searchParams.get('text'), '#18181b');
  const badgeTextColor = normalizeHex(searchParams.get('badgeText'), '#ffffff');

  const isDark = isDarkColor(bgColor);
  const defaultSubtext = isDark ? '#a1a1aa' : '#52525b';
  const subtextColor = normalizeHex(searchParams.get('subtext'), defaultSubtext);

  const design: PdfDesignOptions = {
    bgColor,
    accentColor,
    textColor,
    badgeTextColor,
    subtextColor,
    isDark,
  };

  const supabase = createAdminClient();

  // 1. Fetch Venue and its Physical Tables
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('id, name, slug')
    .eq('id', venueId)
    .single();

  if (venueError || !venue) {
    return new Response(JSON.stringify({ error: 'Salón no encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let query = supabase
    .from('physical_tables')
    .select('id, table_number, token_hash')
    .eq('venue_id', venueId)
    .order('table_number', { ascending: true });

  if (tableFilter) {
    const tableNum = parseInt(tableFilter, 10);
    if (!isNaN(tableNum)) {
      query = query.eq('table_number', tableNum);
    }
  }

  const { data: tables, error: tablesError } = await query;

  if (tablesError || !tables || tables.length === 0) {
    return new Response(JSON.stringify({ error: 'No se encontraron mesas para este salón' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Base URL for QR links
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  // 3. Generate PDF Document using PDFKit
  const pdfBuffer = await new Promise<Buffer>(async (resolve, reject) => {
    const isMini = format === 'mini';
    const isTent = format === 'tent';

    const pageSize = isMini ? [283.46, 425.2] : 'A4'; // [100mm, 150mm] in points
    const doc = new PDFDocument({
      size: pageSize,
      margin: isMini ? 15 : 35,
      autoFirstPage: false,
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      doc.addPage();

      // Paint entire page background
      doc.rect(0, 0, doc.page.width, doc.page.height).fillColor(design.bgColor).fill();

      const qrTargetUrl = `${baseUrl}/q/${table.token_hash}`;
      // High-contrast QR generation: dark code on pure white box ensures 100% camera detection in dim lighting
      const qrImageBuffer = await QRCode.toBuffer(qrTargetUrl, {
        width: 600,
        margin: 1,
        color: { dark: '#09090b', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });

      if (isTent) {
        // TABLE TENT FORMAT (Folding Card - 2 identical sides on 1 page)
        const halfHeight = doc.page.height / 2;

        // Render Side 1 (Top half)
        renderTableCard(doc, {
          venueName: venue.name,
          tableNumber: table.table_number,
          totalTables: tables.length,
          qrBuffer: qrImageBuffer,
          yOffset: 20,
          cardHeight: halfHeight - 40,
          design,
        });

        // Fold dotted line
        const foldLineColor = design.isDark ? '#52525b' : '#a1a1aa';
        doc.dash(4, { space: 4 })
          .moveTo(25, halfHeight)
          .lineTo(doc.page.width - 25, halfHeight)
          .lineWidth(1)
          .strokeColor(foldLineColor)
          .stroke();

        doc.undash();
        doc.fontSize(7.5)
          .fillColor(foldLineColor)
          .text('✂ LÍNEA DE PLIEGUE CENTRAL (DOBLAR AQUÍ) ✂', 0, halfHeight - 9, {
            align: 'center',
            characterSpacing: 0.5,
          });

        // Render Side 2 (Bottom half)
        renderTableCard(doc, {
          venueName: venue.name,
          tableNumber: table.table_number,
          totalTables: tables.length,
          qrBuffer: qrImageBuffer,
          yOffset: halfHeight + 20,
          cardHeight: halfHeight - 40,
          design,
        });
      } else if (isMini) {
        // MINI ACRYLIC STAND FORMAT (10x15cm)
        renderMiniCard(doc, {
          venueName: venue.name,
          tableNumber: table.table_number,
          qrBuffer: qrImageBuffer,
          design,
        });
      } else {
        // STANDARD A4 FORMAT
        renderStandardA4Card(doc, {
          venueName: venue.name,
          tableNumber: table.table_number,
          totalTables: tables.length,
          qrBuffer: qrImageBuffer,
          design,
        });
      }
    }

    doc.end();
  });

  const filename = `Master-QRs-${venue.slug}-${format}${tableFilter ? `-mesa-${tableFilter}` : ''}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

function renderTableCard(
  doc: PDFKit.PDFDocument,
  opts: {
    venueName: string;
    tableNumber: number;
    totalTables: number;
    qrBuffer: Buffer;
    yOffset: number;
    cardHeight: number;
    design: PdfDesignOptions;
  }
) {
  const { venueName, tableNumber, qrBuffer, yOffset, cardHeight, design } = opts;

  // Outer border with accent color
  doc.rect(25, yOffset, doc.page.width - 50, cardHeight)
    .lineWidth(1.5)
    .strokeColor(design.accentColor)
    .stroke();

  // Subtle inner decorative line
  doc.rect(28, yOffset + 3, doc.page.width - 56, cardHeight - 6)
    .lineWidth(0.5)
    .strokeColor(design.isDark ? '#27272a' : '#f4f4f5')
    .stroke();

  // Venue Name
  doc.fontSize(8.5)
    .fillColor(design.subtextColor)
    .text(venueName.toUpperCase(), 0, yOffset + 14, { align: 'center', characterSpacing: 1.5 });

  // Mesa Badge
  const badgeY = yOffset + 30;
  doc.roundedRect(doc.page.width / 2 - 75, badgeY, 150, 28, 8)
    .fillColor(design.accentColor)
    .fill();

  doc.fontSize(15)
    .fillColor(design.badgeTextColor)
    .text(`MESA #${tableNumber}`, 0, badgeY + 6, { align: 'center' });

  // QR Container plaque (guarantees camera scannability)
  const qrSize = 135;
  const qrBoxPadding = 8;
  const qrBoxSize = qrSize + qrBoxPadding * 2;
  const qrBoxX = (doc.page.width - qrBoxSize) / 2;
  const qrBoxY = badgeY + 36;

  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 8)
    .fillColor('#ffffff')
    .fill();

  doc.image(qrBuffer, qrBoxX + qrBoxPadding, qrBoxY + qrBoxPadding, {
    width: qrSize,
    height: qrSize,
  });

  // Instructions
  const textY = qrBoxY + qrBoxSize + 10;
  doc.fontSize(11)
    .fillColor(design.textColor)
    .text('¡ESCANEÁ Y SUMÁ TUS FOTOS EN PANTALLA!', 0, textY, { align: 'center' });

  doc.fontSize(8.5)
    .fillColor(design.subtextColor)
    .text('Cámara del celular • Cero descargas • Proyección en vivo', 0, textY + 16, {
      align: 'center',
    });
}

function renderMiniCard(
  doc: PDFKit.PDFDocument,
  opts: {
    venueName: string;
    tableNumber: number;
    qrBuffer: Buffer;
    design: PdfDesignOptions;
  }
) {
  const { venueName, tableNumber, qrBuffer, design } = opts;

  // Outer border with accent color
  doc.rect(10, 10, doc.page.width - 20, doc.page.height - 20)
    .lineWidth(1.5)
    .strokeColor(design.accentColor)
    .stroke();

  // Subtle inner frame
  doc.rect(13, 13, doc.page.width - 26, doc.page.height - 26)
    .lineWidth(0.5)
    .strokeColor(design.isDark ? '#27272a' : '#f4f4f5')
    .stroke();

  // Venue Name
  doc.fontSize(8)
    .fillColor(design.subtextColor)
    .text(venueName.toUpperCase(), 0, 22, { align: 'center', characterSpacing: 1.5 });

  // Mesa Badge
  const badgeY = 38;
  doc.roundedRect(doc.page.width / 2 - 70, badgeY, 140, 28, 8)
    .fillColor(design.accentColor)
    .fill();

  doc.fontSize(14)
    .fillColor(design.badgeTextColor)
    .text(`MESA #${tableNumber}`, 0, badgeY + 6, { align: 'center' });

  // QR with clean container plaque
  const qrSize = 150;
  const qrBoxPadding = 10;
  const qrBoxSize = qrSize + qrBoxPadding * 2;
  const qrBoxX = (doc.page.width - qrBoxSize) / 2;
  const qrBoxY = badgeY + 40;

  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 10)
    .fillColor('#ffffff')
    .fill();

  doc.image(qrBuffer, qrBoxX + qrBoxPadding, qrBoxY + qrBoxPadding, {
    width: qrSize,
    height: qrSize,
  });

  // Call to action
  const textY = qrBoxY + qrBoxSize + 15;
  doc.fontSize(12)
    .fillColor(design.textColor)
    .text('¡FOTOS EN VIVO!', 0, textY, { align: 'center' });

  doc.fontSize(8.5)
    .fillColor(design.subtextColor)
    .text('Escaneá con tu cámara y aparecé en la pantalla gigante', 15, textY + 16, {
      align: 'center',
    });
}

function renderStandardA4Card(
  doc: PDFKit.PDFDocument,
  opts: {
    venueName: string;
    tableNumber: number;
    totalTables: number;
    qrBuffer: Buffer;
    design: PdfDesignOptions;
  }
) {
  const { venueName, tableNumber, totalTables, qrBuffer, design } = opts;

  // Outer border with accent color
  doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50)
    .lineWidth(2)
    .strokeColor(design.accentColor)
    .stroke();

  // Inner subtle border
  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
    .lineWidth(0.75)
    .strokeColor(design.isDark ? '#27272a' : '#e4e4e7')
    .stroke();

  // Corner decorative crosses
  const cornerSize = 12;
  const corners = [
    { x: 35, y: 35 },
    { x: doc.page.width - 35, y: 35 },
    { x: 35, y: doc.page.height - 35 },
    { x: doc.page.width - 35, y: doc.page.height - 35 },
  ];
  corners.forEach(({ x, y }) => {
    doc.lineWidth(1).strokeColor(design.accentColor);
    doc.moveTo(x - cornerSize / 2, y).lineTo(x + cornerSize / 2, y).stroke();
    doc.moveTo(x, y - cornerSize / 2).lineTo(x, y + cornerSize / 2).stroke();
  });

  // Subtitle
  doc.fontSize(9.5)
    .fillColor(design.subtextColor)
    .text('KIT DE MESAS PERMANENTE • QR IMÁGENES DINÁMICAS', 0, 52, {
      align: 'center',
      characterSpacing: 2,
    });

  // Venue Name
  doc.moveDown(0.5);
  doc.fontSize(22)
    .fillColor(design.textColor)
    .text(venueName.toUpperCase(), { align: 'center' });

  // Mesa Badge
  doc.moveDown(0.8);
  const badgeY = doc.y;
  doc.roundedRect(doc.page.width / 2 - 110, badgeY, 220, 48, 12)
    .fillColor(design.accentColor)
    .fill();

  doc.fontSize(24)
    .fillColor(design.badgeTextColor)
    .text(`MESA #${tableNumber}`, 0, badgeY + 11, { align: 'center' });

  // QR Container Plaque
  const qrSize = 250;
  const qrBoxPadding = 14;
  const qrBoxSize = qrSize + qrBoxPadding * 2;
  const qrBoxX = (doc.page.width - qrBoxSize) / 2;
  const qrBoxY = badgeY + 70;

  // White base plate for QR (for maximum scanner contrast)
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 14)
    .fillColor('#ffffff')
    .fill();

  // Decorative border around QR plate
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 14)
    .lineWidth(1)
    .strokeColor(design.accentColor)
    .stroke();

  doc.image(qrBuffer, qrBoxX + qrBoxPadding, qrBoxY + qrBoxPadding, {
    width: qrSize,
    height: qrSize,
  });

  // Text Steps
  const textStartY = qrBoxY + qrBoxSize + 22;
  doc.fontSize(17)
    .fillColor(design.textColor)
    .text('¡COMPARTÍ TUS FOTOS EN LA PANTALLA GIGANTE!', 0, textStartY, { align: 'center' });

  doc.moveDown(0.6);
  doc.fontSize(11.5)
    .fillColor(design.subtextColor)
    .text('1. Abrí la cámara de tu celular y escaneá este código QR', { align: 'center' })
    .moveDown(0.3)
    .text('2. Sacá una foto de tu mesa, dedicatoria o selfie con amigos', { align: 'center' })
    .moveDown(0.3)
    .text('3. ¡Mirala proyectada en tiempo real en la pantalla de la fiesta!', { align: 'center' });

  doc.fontSize(8.5)
    .fillColor(design.subtextColor)
    .text(
      `Cartel permanente reutilizable para todos los eventos del salón • Mesa ${tableNumber} de ${totalTables}`,
      0,
      doc.page.height - 52,
      { align: 'center' }
    );
}
