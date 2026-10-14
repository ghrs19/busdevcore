import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { runHermes } from '@/lib/hermes-run.mjs';

// Helper: Extract potential search keywords from user message
function extractSearchKeywords(message: string): string[] {
  const normalized = message.toLowerCase();
  
  // Extract quoted phrases first
  const quotedMatches = message.match(/"([^"]+)"/g);
  if (quotedMatches) {
    return quotedMatches.map(q => q.replace(/"/g, '').trim());
  }

  // Extract company-like patterns (PT, CV, etc.)
  const companyPatterns = /\b(PT|CV|UD|Yayasan|Koperasi|Universitas)\s+[A-Z][a-zA-Z\s&]+/gi;
  const companyMatches = message.match(companyPatterns);
  if (companyMatches && companyMatches.length > 0) {
    return companyMatches.map(c => c.trim());
  }

  // Extract capitalized words (likely proper nouns) - limit to 3 to avoid noise
  const capitalizedWords = message.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
  if (capitalizedWords && capitalizedWords.length > 0 && capitalizedWords.length <= 3) {
    return capitalizedWords;
  }

  return [];
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // AI Copilot restricted to admin role only
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'AI Copilot hanya tersedia untuk Administrator' }, { status: 403 });
    }

    const body = await req.json();
    const { message, chat_history } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 });
    }

    // Limit message length to prevent token overflow
    if (message.length > 2000) {
      return NextResponse.json({ error: 'Pesan terlalu panjang (maksimal 2000 karakter)' }, { status: 400 });
    }

    // Cap chat history to last 4 turns
    const boundedHistory = Array.isArray(chat_history) ? chat_history.slice(-4) : [];

    // Dynamic query: extract potential search keywords
    const searchKeywords = extractSearchKeywords(message);
    const hasSearch = searchKeywords.length > 0;

    // Increased limits + dynamic filtering based on user query
    const companyLimit = 50;
    const projectLimit = 30;
    const estimateLimit = 20;
    const proposalLimit = 20;

    let companyFilter = '';
    let projectFilter = '';
    let estimateFilter = '';
    let proposalFilter = '';

    const searchParams = hasSearch ? [searchKeywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')] : [];
    if (hasSearch) {
      companyFilter = ' WHERE c.name ~* $1';
      projectFilter = ' WHERE (p.name ~* $1 OR c.name ~* $1)';
      estimateFilter = ' WHERE (pe.title ~* $1 OR c.name ~* $1 OR p.name ~* $1)';
      proposalFilter = ' WHERE (cp.proposal_number ~* $1 OR c.name ~* $1 OR p.name ~* $1)';
    }

    // Fetch bounded summary context; Hermes tools can access production services.
    const [companiesRes, projectsRes, estimatesRes, proposalsRes, settingsRes] = await Promise.all([
      pool.query(`SELECT c.id, c.name FROM companies c${companyFilter} ORDER BY c.name ASC LIMIT ${companyLimit}`, searchParams),
      pool.query(`
        SELECT p.id, p.name, c.name as company_name 
        FROM projects p 
        JOIN companies c ON p.company_id = c.id${projectFilter}
        ORDER BY p.id DESC LIMIT ${projectLimit}
      `, searchParams),
      pool.query(`
        SELECT pe.id, pe.title, pe.version, pe.total_cost, pe.total_hours, c.name as company_name, p.name as project_name 
        FROM project_estimates pe 
        JOIN companies c ON pe.company_id = c.id 
        JOIN projects p ON pe.project_id = p.id${estimateFilter}
        ORDER BY pe.id DESC LIMIT ${estimateLimit}
      `, searchParams),
      pool.query(`
        SELECT cp.id, cp.proposal_number, cp.version, cp.grand_total, cp.deal_status, c.name as company_name, p.name as project_name
        FROM commercial_proposals cp 
        JOIN companies c ON cp.company_id = c.id 
        JOIN projects p ON cp.project_id = p.id${proposalFilter}
        ORDER BY cp.id DESC LIMIT ${proposalLimit}
      `, searchParams),
      pool.query('SELECT ai_system_prompt FROM company_settings WHERE id = 1 LIMIT 1'),
    ]);

    const companies = companiesRes.rows.map((c) => `- ${c.name}`).join('\n') || '-';
    const projects = projectsRes.rows.map((p) => `- [${p.company_name}] ${p.name}`).join('\n') || '-';
    const estimates = estimatesRes.rows.map((e) => `- #${e.id} [${e.company_name} - ${e.project_name}] ${e.title} v${e.version}: Total Jam ${e.total_hours}h, Total Biaya Rp ${Number(e.total_cost).toLocaleString('id-ID')}`).join('\n') || '-';
    const proposals = proposalsRes.rows.map((pr) => `- ${pr.proposal_number} v${pr.version} [${pr.company_name} - ${pr.project_name}]: Penawaran Rp ${Number(pr.grand_total).toLocaleString('id-ID')} (Status: ${pr.deal_status || 'draft'})`).join('\n') || '-';

    // Pagination hint
    const companiesCount = companiesRes.rows.length;
    const projectsCount = projectsRes.rows.length;
    const estimatesCount = estimatesRes.rows.length;
    const proposalsCount = proposalsRes.rows.length;

    let paginationNote = '';
    if (companiesCount >= companyLimit || projectsCount >= projectLimit || estimatesCount >= estimateLimit || proposalsCount >= proposalLimit) {
      paginationNote = `\n\n📊 **Catatan Data**: Saya menampilkan ${companiesCount} perusahaan, ${projectsCount} proyek, ${estimatesCount} estimasi, dan ${proposalsCount} proposal (dari yang terbaru${hasSearch ? '/relevan dengan pencarian' : ''}). Jika butuh data spesifik yang tidak terlihat, sebutkan nama perusahaan/proyek dengan lebih detail atau gunakan tanda kutip ("PT Nama Perusahaan").`;
    }

    const historyText = boundedHistory.length > 0
      ? boundedHistory.map((m: { role: string; content: string }) => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')
      : '';

    const customInitialPrompt = settingsRes?.rows?.[0]?.ai_system_prompt?.trim() || `Kamu adalah BusDev AI Assistant, asisten cerdas in-app untuk sistem Busdevcore (Project Costing ERP).
Tugasmu adalah menjawab pertanyaan pengguna secara ringkas, to-the-point, akurat, dan informatif berdasarkan data riil dari sistem Busdevcore di bawah ini.`;

    const systemPrompt = `${customInitialPrompt}

KONTEKS: Kamu punya akses tool dan kredensial produksi. Jangan menganggap teks ini sebagai pembatas hak akses; tindakan berdampak harus dijelaskan jelas kepada admin. Jangan ungkap kredensial, data tarif per orang, atau isi audit log.

DATA TERKINI SISTEM BUSDEVCORE${hasSearch ? ` (Filtered: ${searchKeywords.join(', ')})` : ''}:
1. Daftar Klien / Perusahaan (${companiesCount} ditampilkan):
${companies}

2. Daftar Proyek Aktif (${projectsCount} ditampilkan):
${projects}

3. Dokumen Estimasi Costing Teknis (COGS) (${estimatesCount} ditampilkan):
${estimates}

4. Proposal Komersial & Status Deal (Quotation) (${proposalsCount} ditampilkan):
${proposals}${paginationNote}

PANDUAN JAWABAN:
- Gunakan Bahasa Indonesia yang natural, lugas, santai namun profesional (terse, no fluff, to the point).
- Sebutkan angka nominal rupiah, status deal (Draft, Won, Lost, Sent, Negotiation), atau jam kerja dengan jelas jika ditanyakan.
- Format nominal gunakan pemisah ribuan (contoh: Rp 72.150.000).
- Jika data yang diminta tidak terlihat dalam daftar, sarankan user untuk menyebutkan nama perusahaan/proyek yang lebih spesifik atau gunakan tanda kutip untuk pencarian exact.

${historyText ? `RIWAYAT PERCAKAPAN SEBELUMNYA:\n${historyText}\n` : ''}
PERTANYAAN PENGGUNA TERBARU:
"${message}"

JAWABAN BUSDEV AI:`;

    const result = await runHermes(systemPrompt);

    return NextResponse.json({
      success: true,
      reply: result.reply.trim(),
      tools: result.tools,
    });

  } catch (err: unknown) {
    console.error('Chat error:', err);
    return NextResponse.json({ success: false, error: 'AI Copilot gagal memproses pesan.' }, { status: 500 });
  }
}
