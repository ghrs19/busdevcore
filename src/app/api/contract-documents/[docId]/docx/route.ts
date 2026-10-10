import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx';

const formatIDR = (num: number) => {
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { docId } = await params;
    const documentId = parseInt(docId, 10);
    if (isNaN(documentId)) {
      return NextResponse.json({ error: 'ID dokumen tidak valid' }, { status: 400 });
    }

    const res = await pool.query(`
      SELECT 
        cd.*,
        cp.proposal_number,
        cp.version as proposal_version,
        cp.grand_total as proposal_grand_total,
        cp.payment_terms,
        c.name as company_name,
        c.address as company_address,
        p.name as project_name,
        u.name as creator_name
      FROM contract_documents cd
      JOIN commercial_proposals cp ON cd.proposal_id = cp.id
      JOIN companies c ON cp.company_id = c.id
      JOIN projects p ON cp.project_id = p.id
      LEFT JOIN users u ON cd.created_by_user_id = u.id
      WHERE cd.id = $1
    `, [documentId]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 });
    }

    const docData = res.rows[0];
    const isSPK = docData.doc_type === 'SPK';
    const docTitle = isSPK
      ? 'SURAT PERINTAH KERJA (SPK)'
      : `BERITA ACARA SERAH TERIMA (BAST) TERMIN ${docData.term_index || ''}`;

    const signDateFormatted = new Date(docData.sign_date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Generate Word Document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          children: [
            // Header Title
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [
                new TextRun({
                  text: docTitle,
                  bold: true,
                  size: 32, // 16pt
                  color: '0F172A',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
              children: [
                new TextRun({
                  text: `Nomor: ${docData.doc_number}`,
                  bold: true,
                  size: 22,
                  color: '475569',
                }),
              ],
            }),

            // Meta Info Table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 30, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: 'PIHAK PERTAMA (KLIEN)', bold: true, size: 20 })] })],
                    }),
                    new TableCell({
                      width: { size: 70, type: WidthType.PERCENTAGE },
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({ text: `${docData.company_name}\n${docData.company_address || '-'}`, size: 20 }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: 'NAMA PEKERJAAN', bold: true, size: 20 })] })],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: docData.project_name, bold: true, size: 20 })],
                        }),
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: 'REFERENSI PENAWARAN', bold: true, size: 20 })] })],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: `${docData.proposal_number} (Versi v${docData.proposal_version})`, size: 20 })],
                        }),
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: isSPK ? 'NILAI KONTRAK TOTAL' : 'NILAI PENAGIHAN TERMIN', bold: true, size: 20 })] })],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: formatIDR(Number(docData.amount)), bold: true, color: '059669', size: 22 })],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),

            new Paragraph({ spacing: { before: 200, after: 150 }, children: [] }),

            // Body Paragraph
            new Paragraph({
              spacing: { after: 150 },
              children: [
                new TextRun({
                  text: isSPK
                    ? `Dengan diterbitkannya Surat Perintah Kerja ini, Pihak Pertama secara resmi menginstruksikan pelaksanaan pekerjaan kepada Pihak Kedua dengan mengacu pada ruang lingkup deliverables dan penawaran yang telah disepakati bersama.`
                    : `Pada hari ini, ${signDateFormatted}, telah diselesaikan tahapan pekerjaan sesuai dengan kesepakatan Termin ${docData.term_index || ''}. Pihak Pertama menyatakan bahwa hasil pekerjaan telah diperiksa dan diterima dengan baik.`,
                  size: 21,
                }),
              ],
            }),

            new Paragraph({
              spacing: { after: 300 },
              children: [
                new TextRun({
                  text: `Keterangan / Kondisi: ${docData.notes || '-'}`,
                  italics: true,
                  size: 20,
                  color: '64748B',
                }),
              ],
            }),

            new Paragraph({ spacing: { before: 300, after: 200 }, children: [] }),

            // Signature Blocks
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                      },
                      children: [
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Pihak Pertama (Pemberi Tugas)', size: 20 })] }),
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: docData.company_name, bold: true, size: 20 })] }),
                        new Paragraph({ spacing: { before: 800 }, children: [] }),
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '( _______________________ )', size: 20 })] }),
                      ],
                    }),
                    new TableCell({
                      width: { size: 50, type: WidthType.PERCENTAGE },
                      borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                      },
                      children: [
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Pihak Kedua (Pelaksana Pekerjaan)', size: 20 })] }),
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'PT PENTA CODE DIGITAL', bold: true, size: 20 })] }),
                        new Paragraph({ spacing: { before: 800 }, children: [] }),
                        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `( ${docData.creator_name || 'Admin'} )`, size: 20 })] }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const fileName = `${docData.doc_type}_${docData.doc_number.replace(/\//g, '-')}.docx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export docx error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
