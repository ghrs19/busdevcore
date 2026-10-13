import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { currentUser } from '@/lib/auth';

const DEFAULT_AI_PROMPT = `Anda adalah Hermes AI Copilot terintegrasi untuk busdevcore (Sistem ERP Project Costing, Komersial & Penagihan PT Penta Code Digital).
Tugas Anda:
1. Membantu tim Business Development menyusun draft WBS, estimasi manhours, dan perhitungan biaya proyek.
2. Memberikan rekomendasi role tim teknis (PM, WEB_DEV, UI_UX, QC_DOCS, DEVOPS, FULL_DEV, MOB_DEV) dan alokasi jam yang realistis.
3. Menjelaskan status proposal penawaran, termin pembayaran, dan data invoice klien jika ditanyakan.
4. Memberikan insight analitik bisnis dan komersial secara profesional, ringkas, dan akurat.

ATURAN KEAMANAN MUTLAK:
- Anda TIDAK DIPERKENANKAN mengubah, menambah, atau menghapus Master Data (Role Master, Rate Card, User Master, Template WBS).
- Anda TIDAK DIPERKENANKAN memodifikasi atau menghapus catatan Audit Trail (Audit Logs).
- Seluruh tindakan berisiko tinggi wajib diarahkan ke pengguna untuk dilakukan secara manual melalui menu antarmuka sistem.`;

export async function GET() {
  try {
    const res = await pool.query(
      'SELECT * FROM company_settings WHERE id = 1 LIMIT 1'
    );
    if (res.rows.length === 0) {
      return NextResponse.json({
        success: true,
        settings: {
          id: 1,
          company_name: 'PT PENTA CODE DIGITAL',
          tagline: 'Software Development & Digital Solutions • pentacode.id',
          address: 'Graha Pena Lantai 15, Jl. Ahmad Yani No. 88, Surabaya, Jawa Timur - Indonesia',
          email: 'finance@pentacode.id',
          website: 'pentacode.id',
          phone: '+62 812-3456-7890',
          bank_name: 'Bank Central Asia (BCA)',
          bank_account_number: '088-726-1928',
          bank_account_name: 'PT PENTA CODE DIGITAL',
          signer_name: 'Authorized Finance Department',
          signer_role: 'Finance & Accounting Lead',
          ai_system_prompt: DEFAULT_AI_PROMPT,
        },
      });
    }

    const settings = res.rows[0];
    if (!settings.ai_system_prompt) {
      settings.ai_system_prompt = DEFAULT_AI_PROMPT;
    }

    return NextResponse.json({ success: true, settings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown database error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      company_name,
      tagline,
      address,
      email,
      website,
      phone,
      bank_name,
      bank_account_number,
      bank_account_name,
      signer_name,
      signer_role,
      ai_system_prompt,
    } = body;

    const res = await pool.query(
      `INSERT INTO company_settings (
        id, company_name, tagline, address, email, website, phone,
        bank_name, bank_account_number, bank_account_name, signer_name, signer_role, ai_system_prompt, updated_at
      ) VALUES (
        1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        company_name = COALESCE(EXCLUDED.company_name, company_settings.company_name),
        tagline = EXCLUDED.tagline,
        address = EXCLUDED.address,
        email = EXCLUDED.email,
        website = EXCLUDED.website,
        phone = EXCLUDED.phone,
        bank_name = EXCLUDED.bank_name,
        bank_account_number = EXCLUDED.bank_account_number,
        bank_account_name = EXCLUDED.bank_account_name,
        signer_name = EXCLUDED.signer_name,
        signer_role = EXCLUDED.signer_role,
        ai_system_prompt = COALESCE(EXCLUDED.ai_system_prompt, company_settings.ai_system_prompt),
        updated_at = NOW()
      RETURNING *`,
      [
        company_name || 'PT PENTA CODE DIGITAL',
        tagline || null,
        address || null,
        email || null,
        website || null,
        phone || null,
        bank_name || null,
        bank_account_number || null,
        bank_account_name || null,
        signer_name || null,
        signer_role || null,
        ai_system_prompt || DEFAULT_AI_PROMPT,
      ]
    );

    return NextResponse.json({ success: true, settings: res.rows[0] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
