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

  const { data: tables, error: tablesError } = await supabase
    .from('physical_tables')
    .select('id, table_number, token_hash')
    .eq('venue_id', venueId)
    .order('table_number', { ascending: true });

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
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
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
        width: 600,
        margin: 1,
        color: {
          dark: '#18181b',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });

      // Page Background & Decorative Border
      doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50)
        .lineWidth(2)
        .strokeColor('#7c3aed')
        .stroke();

      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
        .lineWidth(0.5)
        .strokeColor('#e4e4e7')
        .stroke();

      // Top Tag
      doc.fontSize(10)
        .fillColor('#71717a')
        .text('KIT DE MESAS PERMANENTE • LIVE EVENT PHOTO WALL', 0, 55, {
          align: 'center',
          characterSpacing: 1.5,
        });

      // Venue Title
      doc.moveDown(0.4);
      doc.fontSize(22)
        .fillColor('#18181b')
        .text(venue.name.toUpperCase(), {
          align: 'center',
        });

      // Table Number Badge (Accent)
      doc.moveDown(0.8);
      const badgeY = doc.y;
      doc.roundedRect(doc.page.width / 2 - 110, badgeY, 220, 48, 12)
        .fillColor('#7c3aed')
        .fill();

      doc.fontSize(26)
        .fillColor('#ffffff')
        .text(`MESA #${table.table_number}`, 0, badgeY + 11, {
          align: 'center',
        });

      // QR Code Placement
      const qrSize = 250;
      const qrX = (doc.page.width - qrSize) / 2;
      const qrY = badgeY + 75;

      doc.image(qrImageBuffer, qrX, qrY, { width: qrSize, height: qrSize });

      // Action Title
      const textStartY = qrY + qrSize + 25;
      doc.fontSize(18)
        .fillColor('#18181b')
        .text('¡COMPARTÍ TUS FOTOS EN LA PANTALLA!', 0, textStartY, {
          align: 'center',
        });

      // Step-by-Step Instructions
      doc.moveDown(0.6);
      doc.fontSize(12)
        .fillColor('#3f3f46')
        .text('1. Abrí la cámara de tu celular y escaneá este código QR', { align: 'center' })
        .moveDown(0.3)
        .text('2. Sacá una foto de tu mesa o selfie con amigos', { align: 'center' })
        .moveDown(0.3)
        .text('3. ¡Mirala proyectada en tiempo real en la pantalla gigante!', { align: 'center' });

      // Footer
      doc.fontSize(9)
        .fillColor('#a1a1aa')
        .text(
          `Cartel permanente reutilizable para todos los eventos del salón • Mesa ${table.table_number} de ${tables.length}`,
          0,
          doc.page.height - 55,
          { align: 'center' }
        );
    }

    doc.end();
  });

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Master-QRs-${venue.slug}.pdf"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
