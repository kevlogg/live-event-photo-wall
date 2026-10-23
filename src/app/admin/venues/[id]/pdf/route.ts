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

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: venueId } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get('format') || 'a4'; // 'a4' | 'tent' | 'mini'
  const tableFilter = searchParams.get('table');

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

      const qrTargetUrl = `${baseUrl}/q/${table.token_hash}`;
      const qrImageBuffer = await QRCode.toBuffer(qrTargetUrl, {
        width: 500,
        margin: 1,
        color: { dark: '#18181b', light: '#ffffff' },
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
        });

        // Fold dotted line
        doc.dash(4, { space: 4 })
          .moveTo(20, halfHeight)
          .lineTo(doc.page.width - 20, halfHeight)
          .lineWidth(1)
          .strokeColor('#a1a1aa')
          .stroke();

        doc.undash();
        doc.fontSize(8)
          .fillColor('#a1a1aa')
          .text('--- LÍNEA DE PLIEGUE CENTRAL (DOBLAR AQUÍ) ---', 0, halfHeight - 10, {
            align: 'center',
          });

        // Render Side 2 (Bottom half)
        renderTableCard(doc, {
          venueName: venue.name,
          tableNumber: table.table_number,
          totalTables: tables.length,
          qrBuffer: qrImageBuffer,
          yOffset: halfHeight + 20,
          cardHeight: halfHeight - 40,
        });
      } else if (isMini) {
        // MINI ACRYLIC STAND FORMAT (10x15cm)
        renderMiniCard(doc, {
          venueName: venue.name,
          tableNumber: table.table_number,
          qrBuffer: qrImageBuffer,
        });
      } else {
        // STANDARD A4 FORMAT
        renderStandardA4Card(doc, {
          venueName: venue.name,
          tableNumber: table.table_number,
          totalTables: tables.length,
          qrBuffer: qrImageBuffer,
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
  }
) {
  const { venueName, tableNumber, qrBuffer, yOffset, cardHeight } = opts;

  doc.rect(25, yOffset, doc.page.width - 50, cardHeight)
    .lineWidth(1.5)
    .strokeColor('#7c3aed')
    .stroke();

  doc.fontSize(9)
    .fillColor('#71717a')
    .text(venueName.toUpperCase(), 0, yOffset + 14, { align: 'center', characterSpacing: 1 });

  // Mesa Badge
  const badgeY = yOffset + 32;
  doc.roundedRect(doc.page.width / 2 - 70, badgeY, 140, 30, 8)
    .fillColor('#7c3aed')
    .fill();

  doc.fontSize(16)
    .fillColor('#ffffff')
    .text(`MESA #${tableNumber}`, 0, badgeY + 7, { align: 'center' });

  // QR
  const qrSize = 135;
  const qrX = (doc.page.width - qrSize) / 2;
  const qrY = badgeY + 42;
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  // Instructions
  doc.fontSize(11)
    .fillColor('#18181b')
    .text('¡ESCANEÁ Y SUMÁ TUS FOTOS EN PANTALLA!', 0, qrY + qrSize + 10, { align: 'center' });

  doc.fontSize(9)
    .fillColor('#52525b')
    .text('Cámara del celular • Cero descargas • En vivo', 0, qrY + qrSize + 26, {
      align: 'center',
    });
}

function renderMiniCard(
  doc: PDFKit.PDFDocument,
  opts: {
    venueName: string;
    tableNumber: number;
    qrBuffer: Buffer;
  }
) {
  const { venueName, tableNumber, qrBuffer } = opts;

  doc.rect(10, 10, doc.page.width - 20, doc.page.height - 20)
    .lineWidth(1.5)
    .strokeColor('#7c3aed')
    .stroke();

  doc.fontSize(8)
    .fillColor('#71717a')
    .text(venueName.toUpperCase(), 0, 25, { align: 'center', characterSpacing: 1 });

  const badgeY = 42;
  doc.roundedRect(doc.page.width / 2 - 65, badgeY, 130, 28, 8)
    .fillColor('#7c3aed')
    .fill();

  doc.fontSize(15)
    .fillColor('#ffffff')
    .text(`MESA #${tableNumber}`, 0, badgeY + 6, { align: 'center' });

  const qrSize = 150;
  const qrX = (doc.page.width - qrSize) / 2;
  const qrY = badgeY + 45;
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  doc.fontSize(12)
    .fillColor('#18181b')
    .text('¡FOTOS EN VIVO!', 0, qrY + qrSize + 15, { align: 'center' });

  doc.fontSize(9)
    .fillColor('#52525b')
    .text('Escaneá con tu cámara y aparecé en la pantalla gigante', 20, qrY + qrSize + 32, {
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
  }
) {
  const { venueName, tableNumber, totalTables, qrBuffer } = opts;

  doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50)
    .lineWidth(2)
    .strokeColor('#7c3aed')
    .stroke();

  doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
    .lineWidth(0.5)
    .strokeColor('#e4e4e7')
    .stroke();

  doc.fontSize(10)
    .fillColor('#71717a')
    .text('KIT DE MESAS PERMANENTE • QR IMÁGENES DINÁMICAS', 0, 55, {
      align: 'center',
      characterSpacing: 1.5,
    });

  doc.moveDown(0.4);
  doc.fontSize(22)
    .fillColor('#18181b')
    .text(venueName.toUpperCase(), { align: 'center' });

  doc.moveDown(0.8);
  const badgeY = doc.y;
  doc.roundedRect(doc.page.width / 2 - 110, badgeY, 220, 48, 12)
    .fillColor('#7c3aed')
    .fill();

  doc.fontSize(26)
    .fillColor('#ffffff')
    .text(`MESA #${tableNumber}`, 0, badgeY + 11, { align: 'center' });

  const qrSize = 250;
  const qrX = (doc.page.width - qrSize) / 2;
  const qrY = badgeY + 75;
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  const textStartY = qrY + qrSize + 25;
  doc.fontSize(18)
    .fillColor('#18181b')
    .text('¡COMPARTÍ TUS FOTOS EN LA PANTALLA!', 0, textStartY, { align: 'center' });

  doc.moveDown(0.6);
  doc.fontSize(12)
    .fillColor('#3f3f46')
    .text('1. Abrí la cámara de tu celular y escaneá este código QR', { align: 'center' })
    .moveDown(0.3)
    .text('2. Sacá una foto de tu mesa o selfie con amigos', { align: 'center' })
    .moveDown(0.3)
    .text('3. ¡Mirala proyectada en tiempo real en la pantalla gigante!', { align: 'center' });

  doc.fontSize(9)
    .fillColor('#a1a1aa')
    .text(
      `Cartel permanente reutilizable para todos los eventos del salón • Mesa ${tableNumber} de ${totalTables}`,
      0,
      doc.page.height - 55,
      { align: 'center' }
    );
}
