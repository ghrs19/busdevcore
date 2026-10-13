import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { executeHermes } from '@/lib/hermes-agent.mjs';

// Regex detector untuk percobaan instruksi modifikasi data
function isProhibitedAction(prompt: string): string | null {
  const p = prompt.toLowerCase();
  
  // Deteksi usaha modifikasi Master Data (Roles, Users, Templates, Companies)
  const masterKeywords = ['master data', 'master role', 'role master', 'tarif role', 'hourly rate', 'manajemen user', 'tabel user', 'template wbs'];
  const auditKeywords = ['audit log', 'activity log', 'audit trail', 'tabel audit', 'hapus log', 'edit log', 'bersihkan log'];
  const mutationKeywords = ['ubah', 'ganti', 'update', 'edit', 'hapus', 'delete', 'drop', 'insert', 'tambah', 'modifikasi', 'set tarif', 'reset password'];

  const hasMutation = mutationKeywords.some((m) => p.includes(m));
  
  if (hasMutation && auditKeywords.some((a) => p.includes(a))) {
    return 'KEBIJAKAN KEAMANAN: AI Copilot beroperasi dalam mode Read-Only dan DILARANG KERAS mengubah atau menghapus rekaman Audit Log / Activity Trail. Riwayat audit log bersifat permanen demi akuntabilitas sistem.';
  }

  if (hasMutation && masterKeywords.some((m) => p.includes(m))) {
    return 'KEBIJAKAN KEAMANAN: AI Copilot beroperasi dalam mode Read-Only dan TIDAK MEMILIKI HAK AKSES untuk mengubah Master Data (tarif role, user, template). Pengubahan master data wajib dilakukan secara manual oleh pengguna dengan hak akses Admin di menu Master Data.';
  }

  return null;
}

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

    // Guard 1: Enforcement penolakan mutasi master data dan audit log di level controller
    const policyViolation = isProhibitedAction(message);
    if (policyViolation) {
      return NextResponse.json({
        success: true,
        reply: policyViolation,
      });
    }

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

    if (hasSearch) {
      // Use regex case-insensitive search
      const regexPattern = searchKeywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      companyFilter = ` WHERE c.name ~* '${regexPattern}'`;
      projectFilter = ` WHERE (p.name ~* '${regexPattern}' OR c.name ~* '${regexPattern}')`;
      estimateFilter = ` WHERE (pe.title ~* '${regexPattern}' OR c.name ~* '${regexPattern}' OR p.name ~* '${regexPattern}')`;
      proposalFilter = ` WHERE (cp.proposal_number ~* '${regexPattern}' OR c.name ~* '${regexPattern}' OR p.name ~* '${regexPattern}')`;
    }

    // 1. Fetch live system summary context from PostgreSQL busdevcore (Read-Only)
    const [companiesRes, projectsRes, estimatesRes, proposalsRes, rolesRes, settingsRes] = await Promise.all([
      pool.query(`SELECT id, name FROM companies${companyFilter} ORDER BY name ASC LIMIT ${companyLimit}`),
      pool.query(`
        SELECT p.id, p.name, c.name as company_name 
        FROM projects p 
        JOIN companies c ON p.company_id = c.id${projectFilter}
        ORDER BY p.id DESC LIMIT ${projectLimit}
      `),
      pool.query(`
        SELECT pe.id, pe.title, pe.version, pe.total_cost, pe.total_hours, c.name as company_name, p.name as project_name 
        FROM project_estimates pe 
        JOIN companies c ON pe.company_id = c.id 
        JOIN projects p ON pe.project_id = p.id${estimateFilter}
        ORDER BY pe.id DESC LIMIT ${estimateLimit}
      `),
      pool.query(`
        SELECT cp.id, cp.proposal_number, cp.version, cp.grand_total, cp.margin_percent, cp.deal_status, c.name as company_name, p.name as project_name 
        FROM commercial_proposals cp 
        JOIN companies c ON cp.company_id = c.id 
        JOIN projects p ON cp.project_id = p.id${proposalFilter}
        ORDER BY cp.id DESC LIMIT ${proposalLimit}
      `),
      pool.query('SELECT code, name, default_hourly_rate FROM role_masters WHERE is_active = TRUE ORDER BY id ASC'),
      pool.query('SELECT ai_system_prompt FROM company_settings WHERE id = 1 LIMIT 1'),
    ]);

    const companies = companiesRes.rows.map((c) => `- ${c.name}`).join('\n') || '-';
    const projects = projectsRes.rows.map((p) => `- [${p.company_name}] ${p.name}`).join('\n') || '-';
    const estimates = estimatesRes.rows.map((e) => `- #${e.id} [${e.company_name} - ${e.project_name}] ${e.title} v${e.version}: Total Jam ${e.total_hours}h, Total Biaya Rp ${Number(e.total_cost).toLocaleString('id-ID')}`).join('\n') || '-';
    const proposals = proposalsRes.rows.map((pr) => `- ${pr.proposal_number} v${pr.version} [${pr.company_name} - ${pr.project_name}]: Penawaran Rp ${Number(pr.grand_total).toLocaleString('id-ID')} (Margin: +${pr.margin_percent}%, Status: ${pr.deal_status || 'draft'})`).join('\n') || '-';
    const roles = rolesRes.rows.map((r) => `- ${r.name} (${r.code}): Rp ${Number(r.default_hourly_rate).toLocaleString('id-ID')}/jam`).join('\n') || '-';

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

ATURAN KEAMANAN & BATASAN SISTEM WAJIB (SECURITY POLICY):
1. MODE READ-ONLY & INFORMASIONAL:
   - Kamu HANYA berfungsi sebagai asisten pembaca dan penjawab informasi (Read-Only).
   - Kamu DILARANG KERAS dan TIDAK DAPAT mengubah, menambah, mengedit, atau menghapus data Master Data (Role Master, Tarif Role per Jam, Akun User, Template WBS).
   - Jika pengguna memintamu untuk mengubah tarif role, menambah user, atau mengedit master data, TOLAK SECARA TEGAS dan jelaskan bahwa pengubahan Master Data hanya bisa dilakukan oleh Administrator melalui menu "Master Data" (/master).
2. KEKEBALAN AUDIT LOG (IMMUTABILITY):
   - Kamu DILARANG KERAS dan TIDAK DAPAT mengubah, memanipulasi, atau menghapus riwayat Activity Log / Audit Trail.
   - Audit log bersifat permanen, akuntabel, dan tidak boleh dimodifikasi oleh siapapun termasuk AI.

DATA TERKINI SISTEM BUSDEVCORE${hasSearch ? ` (Filtered: ${searchKeywords.join(', ')})` : ''}:
1. Daftar Klien / Perusahaan (${companiesCount} ditampilkan):
${companies}

2. Daftar Proyek Aktif (${projectsCount} ditampilkan):
${projects}

3. Dokumen Estimasi Costing Teknis (COGS) (${estimatesCount} ditampilkan):
${estimates}

4. Proposal Komersial & Status Deal (Quotation) (${proposalsCount} ditampilkan):
${proposals}

5. Master Tarif Role per Jam (semua active):
${roles}${paginationNote}

PANDUAN JAWABAN:
- Gunakan Bahasa Indonesia yang natural, lugas, santai namun profesional (terse, no fluff, to the point).
- Sebutkan angka nominal rupiah, status deal (Draft, Won, Lost, Sent, Negotiation), atau jam kerja dengan jelas jika ditanyakan.
- Format nominal gunakan pemisah ribuan (contoh: Rp 72.150.000).
- Jika data yang diminta tidak terlihat dalam daftar, sarankan user untuk menyebutkan nama perusahaan/proyek yang lebih spesifik atau gunakan tanda kutip untuk pencarian exact.

${historyText ? `RIWAYAT PERCAKAPAN SEBELUMNYA:\n${historyText}\n` : ''}
PERTANYAAN PENGGUNA TERBARU:
"${message}"

JAWABAN BUSDEV AI:`;

    const reply = await executeHermes(systemPrompt);

    return NextResponse.json({
      success: true,
      reply: reply.trim(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI chat error';
    console.error('Chat error:', err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
