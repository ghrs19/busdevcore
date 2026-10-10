import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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
      return NextResponse.json({ success: false, error: 'ID proposal tidak valid' }, { status: 400 });
    }

    const docsRes = await pool.query(`
      SELECT cd.*, u.name as creator_name
      FROM contract_documents cd
      LEFT JOIN users u ON cd.created_by_user_id = u.id
      WHERE cd.proposal_id = $1
      ORDER BY cd.id ASC
    `, [proposalId]);

    return NextResponse.json({ success: true, documents: docsRes.rows });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(
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
      return NextResponse.json({ success: false, error: 'ID proposal tidak valid' }, { status: 400 });
    }

    // Ambil data proposal lengkap
    const propRes = await pool.query(`
      SELECT cp.*, c.name as company_name, p.name as project_name
      FROM commercial_proposals cp
      JOIN companies c ON cp.company_id = c.id
      JOIN projects p ON cp.project_id = p.id
      WHERE cp.id = $1
    `, [proposalId]);

    if (propRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Proposal tidak ditemukan' }, { status: 404 });
    }

    const proposal = propRes.rows[0];
    const body = await req.json();
    const { action_type } = body; // "GENERATE_ALL", "GENERATE_SPK", "GENERATE_BAST"

    const currentYear = new Date().getFullYear();
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
    const paymentTerms = Array.isArray(proposal.payment_terms) ? proposal.payment_terms : [];

    const generatedDocs = [];

    // 1. Generate SPK (Surat Perintah Kerja)
    if (action_type === 'GENERATE_ALL' || action_type === 'GENERATE_SPK') {
      // Cek apakah SPK sudah pernah dibuat
      const existSPK = await pool.query(
        `SELECT id FROM contract_documents WHERE proposal_id = $1 AND doc_type = 'SPK'`,
        [proposalId]
      );

      if (existSPK.rows.length === 0) {
        const spkNumber = `SPK/${currentYear}/${currentMonth}/${String(proposal.id).padStart(4, '0')}`;
        const spkTitle = `Surat Perintah Kerja (SPK) - ${proposal.project_name}`;
        
        const insSPK = await pool.query(`
          INSERT INTO contract_documents (
            proposal_id, doc_type, doc_number, title,
            sign_date, amount, status, notes, created_by_user_id
          ) VALUES ($1, 'SPK', $2, $3, CURRENT_DATE, $4, 'draft', $5, $6)
          RETURNING *
        `, [
          proposalId,
          spkNumber,
          spkTitle,
          proposal.grand_total,
          `Dokumen SPK resmi turunan dari proposal ${proposal.proposal_number} v${proposal.version}`,
          user.id
        ]);
        generatedDocs.push(insSPK.rows[0]);

        await logAudit({
          userId: user.id,
          entityType: 'commercial_proposal',
          entityId: proposalId,
          action: 'DOCUMENT_GENERATE',
          details: { doc_type: 'SPK', doc_number: spkNumber },
        });
      }
    }

    // 2. Generate BAST per Termin
    if (action_type === 'GENERATE_ALL' || action_type === 'GENERATE_BAST') {
      for (let i = 0; i < paymentTerms.length; i++) {
        const term = paymentTerms[i];
        const termIdx = i + 1;
        
        const existBAST = await pool.query(
          `SELECT id FROM contract_documents WHERE proposal_id = $1 AND doc_type = 'BAST_TERMIN' AND term_index = $2`,
          [proposalId, termIdx]
        );

        if (existBAST.rows.length === 0) {
          const bastNumber = `BAST/${currentYear}/${currentMonth}/${String(proposal.id).padStart(4, '0')}/T${termIdx}`;
          const bastTitle = `BAST Termin ${termIdx} (${term.percent}%) - ${term.milestone_name}`;

          const insBAST = await pool.query(`
            INSERT INTO contract_documents (
              proposal_id, doc_type, doc_number, title, term_index,
              sign_date, amount, status, notes, created_by_user_id
            ) VALUES ($1, 'BAST_TERMIN', $2, $3, $4, CURRENT_DATE, $5, 'draft', $6, $7)
            RETURNING *
          `, [
            proposalId,
            bastNumber,
            bastTitle,
            termIdx,
            term.amount || 0,
            `Syarat Penagihan: ${term.trigger_condition || '-'}`,
            user.id
          ]);
          generatedDocs.push(insBAST.rows[0]);

          await logAudit({
            userId: user.id,
            entityType: 'commercial_proposal',
            entityId: proposalId,
            action: 'DOCUMENT_GENERATE',
            details: { doc_type: 'BAST_TERMIN', doc_number: bastNumber, term_index: termIdx },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil generate ${generatedDocs.length} dokumen turunan kontrak`,
      generated: generatedDocs,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
