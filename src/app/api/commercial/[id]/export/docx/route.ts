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
  HeadingLevel,
} from 'docx';

const formatIDR = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return `Rp ${(num || 0).toLocaleString('id-ID')}`;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const proposalId = parseInt(id, 10);
    if (isNaN(proposalId)) {
      return NextResponse.json({ error: 'ID proposal tidak valid' }, { status: 400 });
    }

    // 1. Fetch proposal details
    const propRes = await pool.query(`
      SELECT 
        cp.*,
        c.name as company_name,
        c.email as company_email,
        c.phone as company_phone,
        c.address as company_address,
        p.name as project_name,
        p.description as project_description,
        pe.title as estimate_title,
        pe.version as estimate_version,
        u.name as creator_name
      FROM commercial_proposals cp
      JOIN companies c ON cp.company_id = c.id
      JOIN projects p ON cp.project_id = p.id
      JOIN project_estimates pe ON cp.estimate_id = pe.id
      LEFT JOIN users u ON cp.created_by_user_id = u.id
      WHERE cp.id = $1
    `, [proposalId]);

    if (propRes.rows.length === 0) {
      return NextResponse.json({ error: 'Proposal tidak ditemukan' }, { status: 404 });
    }

    const proposal = propRes.rows[0];

    // 2. Fetch modules & tasks (Scope of work)
    const modulesRes = await pool.query(`
      SELECT 
        m.id,
        m.name,
        json_agg(
          json_build_object(
            'id', t.id,
            'name', t.name
          ) ORDER BY t.order_index ASC, t.id ASC
        ) as tasks
      FROM estimate_modules m
      LEFT JOIN estimate_tasks t ON t.module_id = m.id
      WHERE m.estimate_id = $1
      GROUP BY m.id, m.name, m.order_index
      ORDER BY m.order_index ASC, m.id ASC
    `, [proposal.estimate_id]);

    const modules = modulesRes.rows;

    const createdDate = new Date(proposal.created_at);
    const dateFormatted = createdDate.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const validUntilDate = new Date(createdDate.getTime() + (proposal.validity_days || 30) * 86400000);
    const validUntilFormatted = validUntilDate.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // 3. Build docx document
    const borderNone = {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    };

    const borderCell = {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    };

    const docChildren: any[] = [];

    // Header block
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: 'COMMERCIAL PROPOSAL', bold: true, size: 20, color: '475569' }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'BUSDEVCORE', bold: true, size: 36, color: '0F172A' }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Digital Solution & Engineering Partner', size: 18, color: '64748B' }),
        ],
      }),
      new Paragraph({ text: '' }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: `No. Dokumen: ${proposal.proposal_number}\n`, bold: true, size: 20, color: '0F172A' }),
          new TextRun({ text: `Tanggal Terbit: ${dateFormatted}\n`, size: 18, color: '64748B' }),
          new TextRun({ text: `Masa Berlaku: ${validUntilFormatted}`, size: 18, color: '64748B' }),
        ],
      }),
      new Paragraph({ text: '' })
    );

    // Client Info Box (Table)
    docChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: borderCell,
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'KEPADA YTH:', bold: true, size: 16, color: '64748B' })] }),
                  new Paragraph({ children: [new TextRun({ text: proposal.company_name, bold: true, size: 22, color: '0F172A' })] }),
                  new Paragraph({ children: [new TextRun({ text: proposal.company_address || '-', size: 18, color: '334155' })] }),
                  new Paragraph({ children: [new TextRun({ text: `Email: ${proposal.company_email || '-'} | Telp: ${proposal.company_phone || '-'}`, size: 18, color: '64748B' })] }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: borderCell,
                children: [
                  new Paragraph({ children: [new TextRun({ text: 'INFORMASI PROYEK:', bold: true, size: 16, color: '64748B' })] }),
                  new Paragraph({ children: [new TextRun({ text: proposal.project_name, bold: true, size: 22, color: '0F172A' })] }),
                  new Paragraph({ children: [new TextRun({ text: proposal.project_description || 'Pengembangan Solusi Teknologi & Sistem Terintegrasi', size: 18, color: '334155' })] }),
                  new Paragraph({ children: [new TextRun({ text: `Account Exec / Lead: ${proposal.creator_name || 'Admin'}`, size: 18, color: '64748B' })] }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ text: '' }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Bersama surat ini, kami menyampaikan proposal penawaran resmi untuk pengembangan solusi teknologi bagi ${proposal.project_name}. Rincian ruang lingkup pekerjaan, timeline, nilai investasi komersial, dan skema pembayaran tertera di bawah ini:`,
            size: 20,
            color: '334155',
          }),
        ],
      }),
      new Paragraph({ text: '' })
    );

    // SECTION 1: Ruang Lingkup Pekerjaan & Deliverables
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: '1. RUANG LINGKUP PEKERJAAN & DELIVERABLES (SCOPE OF WORK)', bold: true, size: 22, color: '0369A1' })],
      })
    );

    const moduleTableRows = [
      new TableRow({
        children: [
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'NO', bold: true, size: 18 })] })] }),
          new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'MODUL / FUNGSIONALITAS', bold: true, size: 18 })] })] }),
          new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'SPESIFIKASI & RINCIAN DELIVERABLES', bold: true, size: 18 })] })] }),
        ],
      }),
    ];

    modules.forEach((m: any, idx: number) => {
      const taskListParagraphs = Array.isArray(m.tasks) && m.tasks.length > 0
        ? m.tasks.map((t: any) => new Paragraph({ children: [new TextRun({ text: `• ${t.name}`, size: 18, color: '334155' })] }))
        : [new Paragraph({ children: [new TextRun({ text: `• Penyelesaian dan pengujian fungsional modul ${m.name}`, size: 18, color: '334155' })] })];

      moduleTableRows.push(
        new TableRow({
          children: [
            new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 18 })] })] }),
            new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: m.name, bold: true, size: 18, color: '0F172A' })] })] }),
            new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, borders: borderCell, children: taskListParagraphs }),
          ],
        })
      );
    });

    docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: moduleTableRows }), new Paragraph({ text: '' }));

    // SECTION 2: Delivery Timeline
    if (proposal.timeline_config && Array.isArray(proposal.timeline_config.milestones)) {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: `2. ESTIMASI WAKTU PENGERJAAN (DELIVERY TIMELINE: ${proposal.timeline_config.total_weeks || 4} MINGGU)`, bold: true, size: 22, color: '0369A1' })],
        })
      );

      const timelineRows = [
        new TableRow({
          children: [
            new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'NO', bold: true, size: 18 })] })] }),
            new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'TAHAPAN / FASE', bold: true, size: 18 })] })] }),
            new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'DURASI', bold: true, size: 18 })] })] }),
            new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'HASIL LUARAN (DELIVERABLE)', bold: true, size: 18 })] })] }),
          ],
        }),
      ];

      proposal.timeline_config.milestones.forEach((ms: any, idx: number) => {
        timelineRows.push(
          new TableRow({
            children: [
              new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 18 })] })] }),
              new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: ms.phase, bold: true, size: 18 })] })] }),
              new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: `${ms.duration_weeks} Minggu`, size: 18 })] })] }),
              new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: ms.deliverable, size: 18 })] })] }),
            ],
          })
        );
      });

      docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: timelineRows }), new Paragraph({ text: '' }));
    }

    // SECTION 3: Nilai Investasi Komersial
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: '3. RINCIAN NILAI INVESTASI (COMMERCIAL INVESTMENT)', bold: true, size: 22, color: '0369A1' })],
      })
    );

    const investmentRows = [
      new TableRow({
        children: [
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'NO', bold: true, size: 18 })] })] }),
          new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'KOMPONEN INVESTASI', bold: true, size: 18 })] })] }),
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'JUMLAH (IDR)', bold: true, size: 18 })] })] }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: '1', size: 18 })] })] }),
          new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: `Pengembangan Aplikasi & Solusi Teknologi (${proposal.project_name})`, bold: true, size: 18 })] })] }),
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatIDR(proposal.base_price), bold: true, size: 18 })] })] }),
        ],
      }),
    ];

    if (Number(proposal.discount_value) > 0) {
      investmentRows.push(
        new TableRow({
          children: [
            new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: '-', size: 18 })] })] }),
            new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: `Potongan Diskon (${proposal.discount_type === 'PERCENTAGE' ? `${proposal.discount_value}%` : 'Diskon Tetap'})`, size: 18, color: 'B45309' })] })] }),
            new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `-${formatIDR(Number(proposal.base_price) - Number(proposal.subtotal_after_discount))}`, size: 18, color: 'B45309' })] })] }),
          ],
        })
      );
    }

    investmentRows.push(
      new TableRow({
        children: [
          new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, columnSpan: 2, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Subtotal Investasi', bold: true, size: 18 })] })] }),
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatIDR(proposal.subtotal_after_discount), bold: true, size: 18 })] })] }),
        ],
      })
    );

    if (proposal.is_tax_enabled) {
      investmentRows.push(
        new TableRow({
          children: [
            new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, columnSpan: 2, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Pajak Pertambahan Nilai (PPN 11%)', size: 18, color: '64748B' })] })] }),
            new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatIDR(proposal.tax_amount), size: 18, color: '64748B' })] })] }),
          ],
        })
      );
    }

    investmentRows.push(
      new TableRow({
        children: [
          new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, columnSpan: 2, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL NILAI INVESTASI PENAWARAN (NETT)', bold: true, size: 20, color: '0F172A' })] })] }),
          new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatIDR(proposal.grand_total), bold: true, size: 22, color: '0F172A' })] })] }),
        ],
      })
    );

    docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: investmentRows }), new Paragraph({ text: '' }));

    // SECTION 4: Termin Pembayaran
    if (Array.isArray(proposal.payment_terms) && proposal.payment_terms.length > 0) {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: '4. SKEMA TERMIN PEMBAYARAN (TERM OF PAYMENT)', bold: true, size: 22, color: '0369A1' })],
        })
      );

      const paymentRows = [
        new TableRow({
          children: [
            new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'NO', bold: true, size: 18 })] })] }),
            new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'TAHAP TAGIHAN', bold: true, size: 18 })] })] }),
            new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'BOBOT (%)', bold: true, size: 18 })] })] }),
            new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'NOMINAL (IDR)', bold: true, size: 18 })] })] }),
            new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: 'KONDISI / SYARAT', bold: true, size: 18 })] })] }),
          ],
        }),
      ];

      proposal.payment_terms.forEach((pt: any, idx: number) => {
        paymentRows.push(
          new TableRow({
            children: [
              new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: String(idx + 1), size: 18 })] })] }),
              new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: pt.milestone_name, bold: true, size: 18 })] })] }),
              new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: `${pt.percent}%`, size: 18 })] })] }),
              new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatIDR(pt.amount), bold: true, size: 18 })] })] }),
              new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, borders: borderCell, children: [new Paragraph({ children: [new TextRun({ text: pt.trigger_condition || '-', size: 18 })] })] }),
            ],
          })
        );
      });

      docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: paymentRows }), new Paragraph({ text: '' }));
    }

    // SECTION 5: Notes & Syarat
    if (proposal.notes) {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: '5. KETENTUAN & SYARAT TAMBAHAN', bold: true, size: 22, color: '0369A1' })],
        }),
        new Paragraph({
          children: [new TextRun({ text: proposal.notes, size: 18, color: '334155' })],
        }),
        new Paragraph({ text: '' })
      );
    }

    // Signatures Table
    docChildren.push(
      new Paragraph({ text: '' }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: borderNone,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Diajukan Oleh,', size: 18, color: '64748B' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BUSDEVCORE', bold: true, size: 20 })] }),
                  new Paragraph({ text: '' }),
                  new Paragraph({ text: '' }),
                  new Paragraph({ text: '' }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: proposal.creator_name || 'Business Development', bold: true, size: 20 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Authorized Representative', size: 16, color: '64748B' })] }),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: borderNone,
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Disetujui Oleh,', size: 18, color: '64748B' })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: proposal.company_name, bold: true, size: 20 })] }),
                  new Paragraph({ text: '' }),
                  new Paragraph({ text: '' }),
                  new Paragraph({ text: '' }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '( _________________________ )', bold: true, size: 20 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Pejabat Berwenang / Klien', size: 16, color: '64748B' })] }),
                ],
              }),
            ],
          }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch
                bottom: 1440,
                left: 1440,
                right: 1440,
              },
            },
          },
          children: docChildren,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const cleanFilename = `Proposal_${proposal.proposal_number.replace(/\//g, '_')}.docx`;

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${cleanFilename}"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Export docx failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
