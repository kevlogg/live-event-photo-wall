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
  const format = searchParams.get('format') || 'a4'; // 'a4' | 'tent' | 'mini' | 'grid4'
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

  // 3. Generate PDF Document using PDFKit with ZERO margin for exact mathematical centering
  try {
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const isMini = format === 'mini';
      const isTent = format === 'tent';
      const isGrid4 = format === 'grid4' || format === 'multi';

      const pageSize = isMini ? [283.46, 425.2] : 'A4'; // [100mm, 150mm] in points or A4
      const doc = new PDFDocument({
        size: pageSize,
        margin: 0,
        autoFirstPage: false,
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      (async () => {
        try {
          if (isGrid4) {
            // 4 TABLES PER A4 SHEET (2x2 Grid with cutting guidelines)
            for (let i = 0; i < tables.length; i += 4) {
              doc.addPage({ size: 'A4', margin: 0 });
              const W = doc.page.width;
              const H = doc.page.height;
              const cellW = W / 2; // 297.64
              const cellH = H / 2; // 420.94

              doc.rect(0, 0, W, H).fillColor(design.bgColor).fill();

              const chunk = tables.slice(i, i + 4);
              for (let j = 0; j < chunk.length; j++) {
                const table = chunk[j];
                const col = j % 2;
                const row = Math.floor(j / 2);
                const originX = col * cellW;
                const originY = row * cellH;

                const qrTargetUrl = `${baseUrl}/q/${table.token_hash}`;
                const qrImageBuffer = await QRCode.toBuffer(qrTargetUrl, {
                  width: 400,
                  margin: 1,
                  color: { dark: '#09090b', light: '#ffffff' },
                  errorCorrectionLevel: 'H',
                });

                renderQuadrantCard(doc, {
                  venueName: venue.name,
                  tableNumber: table.table_number,
                  qrBuffer: qrImageBuffer,
                  originX,
                  originY,
                  cellW,
                  cellH,
                  design,
                });
              }

              // Draw Cutting Guides (dashed line with scissors)
              const cutColor = design.isDark ? '#52525b' : '#a1a1aa';
              doc.dash(4, { space: 4 }).lineWidth(0.75).strokeColor(cutColor);

              // Vertical cut line
              doc.moveTo(cellW, 10).lineTo(cellW, H - 10).stroke();

              // Horizontal cut line
              doc.moveTo(10, cellH).lineTo(W - 10, cellH).stroke();

              doc.undash();
              doc.fontSize(7).fillColor(cutColor)
                .text('✂ CORTE', cellW + 4, cellH - 10, { lineBreak: false });
            }
          } else {
            // 1 TABLE PER SHEET / CARD
            for (let i = 0; i < tables.length; i++) {
              const table = tables[i];
              doc.addPage();

              // Paint entire page background
              doc.rect(0, 0, doc.page.width, doc.page.height).fillColor(design.bgColor).fill();

              const qrTargetUrl = `${baseUrl}/q/${table.token_hash}`;
              const qrImageBuffer = await QRCode.toBuffer(qrTargetUrl, {
                width: 600,
                margin: 1,
                color: { dark: '#09090b', light: '#ffffff' },
                errorCorrectionLevel: 'H',
              });

              if (isTent) {
                // TABLE TENT FORMAT (Folding Card - 2 identical sides on 1 page)
                // Side 1 (Top half) is rotated 180° so that when folded along the center,
                // BOTH sides face upright for guests on opposite sides of the table.
                const halfHeight = doc.page.height / 2;

                // Render Side 1 (Top half, rotated 180°)
                doc.save();
                doc.rotate(180, { origin: [doc.page.width / 2, halfHeight / 2] });
                renderTableCard(doc, {
                  venueName: venue.name,
                  tableNumber: table.table_number,
                  totalTables: tables.length,
                  qrBuffer: qrImageBuffer,
                  yOffset: 20,
                  cardHeight: halfHeight - 40,
                  design,
                });
                doc.restore();

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
                    width: doc.page.width,
                    align: 'center',
                    characterSpacing: 0.5,
                  });

                // Render Side 2 (Bottom half, standard orientation)
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
                // MINI ACRYLIC STAND FORMAT (10x15cm) - PROPORTIONAL & ZERO WASTED SPACE
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
          }

          doc.end();
        } catch (renderError) {
          reject(renderError);
        }
      })();
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
  } catch (error) {
    console.error('[PDF Export Fatal Error]:', error);
    return new Response(
      JSON.stringify({
        error: 'Error al generar el archivo PDF',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
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
  const W = doc.page.width;

  // Outer border with accent color
  doc.rect(25, yOffset, W - 50, cardHeight)
    .lineWidth(1.5)
    .strokeColor(design.accentColor)
    .stroke();

  // Subtle inner decorative line
  doc.rect(28, yOffset + 3, W - 56, cardHeight - 6)
    .lineWidth(0.5)
    .strokeColor(design.isDark ? '#27272a' : '#f4f4f5')
    .stroke();

  // Venue Name
  doc.fontSize(8.5)
    .fillColor(design.subtextColor)
    .text(venueName.toUpperCase(), 0, yOffset + 14, {
      width: W,
      align: 'center',
      characterSpacing: 1.5,
    });

  // Mesa Badge - Perfectly centered
  const badgeW = 150;
  const badgeH = 30;
  const badgeX = (W - badgeW) / 2;
  const badgeY = yOffset + 30;

  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 8)
    .fillColor(design.accentColor)
    .fill();

  doc.fontSize(15)
    .fillColor(design.badgeTextColor)
    .text(`MESA #${tableNumber}`, badgeX, badgeY + 8, {
      width: badgeW,
      align: 'center',
      lineBreak: false,
    });

  // QR Container plaque
  const qrSize = 135;
  const qrBoxPadding = 8;
  const qrBoxSize = qrSize + qrBoxPadding * 2;
  const qrBoxX = (W - qrBoxSize) / 2;
  const qrBoxY = badgeY + badgeH + 8;

  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 8)
    .fillColor('#ffffff')
    .fill();

  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 8)
    .lineWidth(1)
    .strokeColor(design.accentColor)
    .stroke();

  doc.image(qrBuffer, qrBoxX + qrBoxPadding, qrBoxY + qrBoxPadding, {
    width: qrSize,
    height: qrSize,
  });

  // Instructions
  const textY = qrBoxY + qrBoxSize + 10;
  doc.fontSize(11)
    .fillColor(design.textColor)
    .text('¡ESCANEÁ Y SUMÁ TUS FOTOS EN PANTALLA!', 0, textY, {
      width: W,
      align: 'center',
    });

  doc.fontSize(8.5)
    .fillColor(design.subtextColor)
    .text('Cámara del celular • Cero descargas • Proyección en vivo', 0, textY + 16, {
      width: W,
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
  const W = doc.page.width;
  const H = doc.page.height;

  // Outer border with accent color
  doc.rect(12, 12, W - 24, H - 24)
    .lineWidth(1.5)
    .strokeColor(design.accentColor)
    .stroke();

  // Subtle inner frame
  doc.rect(15, 15, W - 30, H - 30)
    .lineWidth(0.5)
    .strokeColor(design.isDark ? '#27272a' : '#f4f4f5')
    .stroke();

  // Venue Name
  doc.fontSize(9)
    .fillColor(design.subtextColor)
    .text(venueName.toUpperCase(), 0, 24, {
      width: W,
      align: 'center',
      characterSpacing: 1.5,
    });

  // Mesa Badge - Centered
  const badgeW = 150;
  const badgeH = 32;
  const badgeX = (W - badgeW) / 2;
  const badgeY = 44;

  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 8)
    .fillColor(design.accentColor)
    .fill();

  doc.fontSize(16)
    .fillColor(design.badgeTextColor)
    .text(`MESA #${tableNumber}`, badgeX, badgeY + 8, {
      width: badgeW,
      align: 'center',
      lineBreak: false,
    });

  // QR with clean container plaque - Generous size with no wasted space
  const qrSize = 175;
  const qrBoxPadding = 10;
  const qrBoxSize = qrSize + qrBoxPadding * 2; // 195
  const qrBoxX = (W - qrBoxSize) / 2;
  const qrBoxY = badgeY + badgeH + 12; // 88

  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 12)
    .fillColor('#ffffff')
    .fill();

  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 12)
    .lineWidth(1)
    .strokeColor(design.accentColor)
    .stroke();

  doc.image(qrBuffer, qrBoxX + qrBoxPadding, qrBoxY + qrBoxPadding, {
    width: qrSize,
    height: qrSize,
  });

  // Call to action
  const textY = qrBoxY + qrBoxSize + 14; // 297
  doc.fontSize(13)
    .fillColor(design.textColor)
    .text('¡FOTOS EN VIVO!', 0, textY, {
      width: W,
      align: 'center',
    });

  // 3 Steps
  const stepY = textY + 18; // 315
  doc.fontSize(9.5)
    .fillColor(design.subtextColor)
    .text('1. Abrí tu cámara y escaneá este QR', 0, stepY, {
      width: W,
      align: 'center',
    })
    .moveDown(0.3)
    .text('2. Sacá tu foto o selfie de la mesa', {
      width: W,
      align: 'center',
    })
    .moveDown(0.3)
    .text('3. Mirala en vivo en la pantalla gigante', {
      width: W,
      align: 'center',
    });

  // Footer note
  doc.fontSize(7.5)
    .fillColor(design.subtextColor)
    .text('Cartel reutilizable • Cero descargas', 0, H - 25, {
      width: W,
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
  const W = doc.page.width;
  const H = doc.page.height;

  // Outer border with accent color
  doc.rect(25, 25, W - 50, H - 50)
    .lineWidth(2)
    .strokeColor(design.accentColor)
    .stroke();

  // Inner subtle border
  doc.rect(30, 30, W - 60, H - 60)
    .lineWidth(0.75)
    .strokeColor(design.isDark ? '#27272a' : '#e4e4e7')
    .stroke();

  // Corner decorative crosses
  const cornerSize = 12;
  const corners = [
    { x: 35, y: 35 },
    { x: W - 35, y: 35 },
    { x: 35, y: H - 35 },
    { x: W - 35, y: H - 35 },
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
      width: W,
      align: 'center',
      characterSpacing: 2,
    });

  // Venue Name
  doc.fontSize(22)
    .fillColor(design.textColor)
    .text(venueName.toUpperCase(), 0, 72, {
      width: W,
      align: 'center',
    });

  // Mesa Badge - PERFECT CENTER ALIGNMENT
  const badgeWidth = 220;
  const badgeHeight = 46;
  const badgeX = (W - badgeWidth) / 2;
  const badgeY = 112;

  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 12)
    .fillColor(design.accentColor)
    .fill();

  doc.fontSize(24)
    .fillColor(design.badgeTextColor)
    .text(`MESA #${tableNumber}`, badgeX, badgeY + 11, {
      width: badgeWidth,
      align: 'center',
      lineBreak: false,
    });

  // QR Container Plaque
  const qrSize = 270;
  const qrBoxPadding = 16;
  const qrBoxSize = qrSize + qrBoxPadding * 2;
  const qrBoxX = (W - qrBoxSize) / 2;
  const qrBoxY = badgeY + badgeHeight + 25;

  // White base plate for QR
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16)
    .fillColor('#ffffff')
    .fill();

  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16)
    .lineWidth(1.5)
    .strokeColor(design.accentColor)
    .stroke();

  doc.image(qrBuffer, qrBoxX + qrBoxPadding, qrBoxY + qrBoxPadding, {
    width: qrSize,
    height: qrSize,
  });

  // Text Steps
  const textStartY = qrBoxY + qrBoxSize + 25;
  doc.fontSize(18)
    .fillColor(design.textColor)
    .text('¡COMPARTÍ TUS FOTOS EN LA PANTALLA GIGANTE!', 0, textStartY, {
      width: W,
      align: 'center',
    });

  const stepsY = textStartY + 30;
  doc.fontSize(12)
    .fillColor(design.subtextColor)
    .text('1. Abrí la cámara de tu celular y escaneá este código QR', 0, stepsY, {
      width: W,
      align: 'center',
    })
    .moveDown(0.35)
    .text('2. Sacá una foto de tu mesa, dedicatoria o selfie con amigos', {
      width: W,
      align: 'center',
    })
    .moveDown(0.35)
    .text('3. ¡Mirala proyectada en tiempo real en la pantalla de la fiesta!', {
      width: W,
      align: 'center',
    });

  doc.fontSize(8.5)
    .fillColor(design.subtextColor)
    .text(
      `Cartel permanente reutilizable para todos los eventos del salón • Mesa ${tableNumber} de ${totalTables}`,
      0,
      H - 52,
      { width: W, align: 'center' }
    );
}

function renderQuadrantCard(
  doc: PDFKit.PDFDocument,
  opts: {
    venueName: string;
    tableNumber: number;
    qrBuffer: Buffer;
    originX: number;
    originY: number;
    cellW: number;
    cellH: number;
    design: PdfDesignOptions;
  }
) {
  const { venueName, tableNumber, qrBuffer, originX, originY, cellW, cellH, design } = opts;
  const padding = 10;
  const cardX = originX + padding;
  const cardY = originY + padding;
  const cardW = cellW - padding * 2;
  const cardH = cellH - padding * 2;

  // Outer border with accent color
  doc.rect(cardX, cardY, cardW, cardH)
    .lineWidth(1.2)
    .strokeColor(design.accentColor)
    .stroke();

  // Subtle inner decorative line
  doc.rect(cardX + 2.5, cardY + 2.5, cardW - 5, cardH - 5)
    .lineWidth(0.5)
    .strokeColor(design.isDark ? '#27272a' : '#f4f4f5')
    .stroke();

  // Venue Name
  doc.fontSize(8)
    .fillColor(design.subtextColor)
    .text(venueName.toUpperCase(), originX, cardY + 12, {
      width: cellW,
      align: 'center',
      characterSpacing: 1.2,
    });

  // Mesa Badge - Perfectly centered in cell
  const badgeW = 135;
  const badgeH = 28;
  const badgeX = originX + (cellW - badgeW) / 2;
  const badgeY = cardY + 26;

  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 7)
    .fillColor(design.accentColor)
    .fill();

  doc.fontSize(14)
    .fillColor(design.badgeTextColor)
    .text(`MESA #${tableNumber}`, badgeX, badgeY + 7, {
      width: badgeW,
      align: 'center',
      lineBreak: false,
    });

  // QR Code on White Plaque
  const qrSize = 150;
  const qrBoxPadding = 8;
  const qrBoxSize = qrSize + qrBoxPadding * 2; // 166
  const qrBoxX = originX + (cellW - qrBoxSize) / 2;
  const qrBoxY = badgeY + badgeH + 8;

  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 10)
    .fillColor('#ffffff')
    .fill();

  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 10)
    .lineWidth(1)
    .strokeColor(design.accentColor)
    .stroke();

  doc.image(qrBuffer, qrBoxX + qrBoxPadding, qrBoxY + qrBoxPadding, {
    width: qrSize,
    height: qrSize,
  });

  // Call to action
  const textY = qrBoxY + qrBoxSize + 10;
  doc.fontSize(11)
    .fillColor(design.textColor)
    .text('¡COMPARTÍ TUS FOTOS EN PANTALLA!', originX, textY, {
      width: cellW,
      align: 'center',
    });

  // Steps
  const stepsY = textY + 15;
  doc.fontSize(8)
    .fillColor(design.subtextColor)
    .text('1. Escaneá con tu celular • 2. Sacá tu foto • 3. En vivo en la fiesta', originX, stepsY, {
      width: cellW,
      align: 'center',
    });
}
