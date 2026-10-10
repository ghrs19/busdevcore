import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { execFile } from 'child_process';
import fs from 'fs';

// Helper: Run Hermes CLI
async function executeHermes(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const isLocalHermes = fs.existsSync('/opt/hermes/bin/hermes');
    const bin = isLocalHermes ? '/opt/hermes/bin/hermes' : 'docker';
    const args = isLocalHermes
      ? ['-z', prompt]
      : ['exec', 'busdev', 'hermes', '-z', prompt];

    execFile(
      bin,
      args,
      { maxBuffer: 15 * 1024 * 1024, timeout: 120000 },
      (error, stdout, stderr) => {
        if (error) {
          if (stdout && stdout.trim()) {
            return resolve(stdout);
          }
          const errDetail = stderr || error.message;
          return reject(new Error(`Hermes execution error: ${errDetail}`));
        }
        resolve(stdout);
      }
    );
  });
}

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

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { message, chat_history } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 });
    }

    // Guard 1: Enforcement penolakan mutasi master data dan audit log di level controller
    const policyViolation = isProhibitedAction(message);
    if (policyViolation) {
      return NextResponse.json({
        success: true,
        reply: policyViolation,
      });
    }

    // 1. Fetch live system summary context from PostgreSQL busdevcore (Read-Only)
    const [companiesRes, projectsRes, estimatesRes, proposalsRes, rolesRes] = await Promise.all([
      pool.query('SELECT id, name, email, phone FROM companies ORDER BY name ASC LIMIT 30'),
      pool.query(`
        SELECT p.id, p.name, c.name as company_name 
        FROM projects p 
        JOIN companies c ON p.company_id = c.id 
        ORDER BY p.id DESC LIMIT 30
      `),
      pool.query(`
        SELECT pe.id, pe.title, pe.version, pe.total_cost, pe.total_hours, c.name as company_name, p.name as project_name 
        FROM project_estimates pe 
        JOIN companies c ON pe.company_id = c.id 
        JOIN projects p ON pe.project_id = p.id 
        ORDER BY pe.id DESC LIMIT 20
      `),
      pool.query(`
        SELECT cp.id, cp.proposal_number, cp.version, cp.grand_total, cp.margin_percent, cp.deal_status, c.name as company_name, p.name as project_name 
        FROM commercial_proposals cp 
        JOIN companies c ON cp.company_id = c.id 
        JOIN projects p ON cp.project_id = p.id 
        ORDER BY cp.id DESC LIMIT 20
      `),
      pool.query('SELECT code, name, default_hourly_rate FROM role_masters WHERE is_active = TRUE ORDER BY id ASC'),
    ]);

    const companies = companiesRes.rows.map((c) => `- ${c.name} (Kontak: ${c.email || c.phone || '-'})`).join('\n') || '-';
    const projects = projectsRes.rows.map((p) => `- [${p.company_name}] ${p.name}`).join('\n') || '-';
    const estimates = estimatesRes.rows.map((e) => `- #${e.id} [${e.company_name} - ${e.project_name}] ${e.title} v${e.version}: Total Jam ${e.total_hours}h, Total Biaya Rp ${Number(e.total_cost).toLocaleString('id-ID')}`).join('\n') || '-';
    const proposals = proposalsRes.rows.map((pr) => `- ${pr.proposal_number} v${pr.version} [${pr.company_name} - ${pr.project_name}]: Penawaran Rp ${Number(pr.grand_total).toLocaleString('id-ID')} (Margin: +${pr.margin_percent}%, Status: ${pr.deal_status || 'draft'})`).join('\n') || '-';
    const roles = rolesRes.rows.map((r) => `- ${r.name} (${r.code}): Rp ${Number(r.default_hourly_rate).toLocaleString('id-ID')}/jam`).join('\n') || '-';

    const historyText = Array.isArray(chat_history)
      ? chat_history.slice(-6).map((m: { role: string; content: string }) => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')
      : '';

    const systemPrompt = `Kamu adalah BusDev AI Assistant, asisten cerdas in-app untuk sistem Busdevcore (Project Costing ERP).
Tugasmu adalah menjawab pertanyaan pengguna secara ringkas, to-the-point, akurat, dan informatif berdasarkan data riil dari sistem Busdevcore di bawah ini.

ATURAN KEAMANAN & BATASAN SISTEM WAJIB (SECURITY POLICY):
1. MODE READ-ONLY & INFORMASIONAL:
   - Kamu HANYA berfungsi sebagai asisten pembaca dan penjawab informasi (Read-Only).
   - Kamu DILARANG KERAS dan TIDAK DAPAT mengubah, menambah, mengedit, atau menghapus data Master Data (Role Master, Tarif Role per Jam, Akun User, Template WBS).
   - Jika pengguna memintamu untuk mengubah tarif role, menambah user, atau mengedit master data, TOLAK SECARA TEGAS dan jelaskan bahwa pengubahan Master Data hanya bisa dilakukan oleh Administrator melalui menu "Master Data" (/master).
2. KEKEBALAN AUDIT LOG (IMMUTABILITY):
   - Kamu DILARANG KERAS dan TIDAK DAPAT mengubah, memanipulasi, atau menghapus riwayat Activity Log / Audit Trail.
   - Audit log bersifat permanen, akuntabel, dan tidak boleh dimodifikasi oleh siapapun termasuk AI.

DATA TERKINI SISTEM BUSDEVCORE:
1. Daftar Klien / Perusahaan:
${companies}

2. Daftar Proyek Aktif:
${projects}

3. Dokumen Estimasi Costing Teknis (COGS):
${estimates}

4. Proposal Komersial & Status Deal (Quotation):
${proposals}

5. Master Tarif Role per Jam:
${roles}

PANDUAN JAWABAN:
- Gunakan Bahasa Indonesia yang natural, lugas, santai namun profesional (terse, no fluff, to the point).
- Sebutkan angka nominal rupiah, status deal (Draft, Won, Lost, Sent, Negotiation), atau jam kerja dengan jelas jika ditanyakan.
- Format nominal gunakan pemisah ribuan (contoh: Rp 72.150.000).

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
