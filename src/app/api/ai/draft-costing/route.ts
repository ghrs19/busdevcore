// Polyfill DOMMatrix for Node.js environments when parsing complex PDFs
if (typeof (globalThis as any).DOMMatrix === 'undefined') {
  class SimpleDOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    constructor(init?: any) {
      if (Array.isArray(init)) {
        if (init.length === 6) {
          this.a = this.m11 = init[0];
          this.b = this.m12 = init[1];
          this.c = this.m21 = init[2];
          this.d = this.m22 = init[3];
          this.e = this.m41 = init[4];
          this.f = this.m42 = init[5];
        } else if (init.length === 16) {
          this.m11 = this.a = init[0]; this.m12 = this.b = init[1]; this.m13 = init[2]; this.m14 = init[3];
          this.m21 = this.c = init[4]; this.m22 = this.d = init[5]; this.m23 = init[6]; this.m24 = init[7];
          this.m31 = init[8]; this.m32 = init[9]; this.m33 = init[10]; this.m34 = init[11];
          this.m41 = this.e = init[12]; this.m42 = this.f = init[13]; this.m43 = init[14]; this.m44 = init[15];
          this.is2D = false;
        }
      }
    }
    multiply(other: any) { return new SimpleDOMMatrix(); }
    translate(tx = 0, ty = 0) { return new SimpleDOMMatrix(); }
    scale(sx = 1, sy = 1) { return new SimpleDOMMatrix(); }
    rotate(angle = 0) { return new SimpleDOMMatrix(); }
    inverse() { return new SimpleDOMMatrix(); }
    transformPoint(point: any) { return point || { x: 0, y: 0 }; }
  }
  (globalThis as any).DOMMatrix = SimpleDOMMatrix;
}

import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

interface RoleMasterItem {
  id: number;
  code: string;
  name: string;
  default_hourly_rate: number;
}

interface CompanyItem {
  id: number;
  name: string;
}

interface ProjectItem {
  id: number;
  company_id: number;
  company_name: string;
  name: string;
}

interface RawTaskItem {
  name?: string;
  task_name?: string;
  role_hours?: Record<string, number | undefined>;
  hours_pm?: number;
  hours_web_dev?: number;
  hours_ui_ux?: number;
  hours_qc_doc?: number;
  hours_dev_ops?: number;
}

interface RawModuleItem {
  name?: string;
  tasks?: RawTaskItem[];
}

interface RawMaintRole {
  role_code?: string;
  code?: string;
  monthly_hours?: number;
  hours?: number;
}

interface RawMaintTask {
  name?: string;
  task_name?: string;
  role_hours?: Record<string, number>;
}

interface RawInfraItem {
  name?: string;
  billing_type?: string;
  quantity?: number;
  unit_cost?: number;
  period_count?: number;
  notes?: string;
}

interface RawDraftStructure {
  company_name?: string;
  company?: string;
  is_new_company?: boolean;
  project_name?: string;
  project?: string;
  title?: string;
  is_new_project?: boolean;
  service_code?: string;
  categories?: string[];
  tag_code?: string | null;
  tag?: string | null;
  development_modules?: RawModuleItem[];
  modules?: RawModuleItem[];
  maintenance_config?: {
    duration_months?: number;
    roles?: RawMaintRole[];
    tasks?: RawMaintTask[];
  };
  maintenance?: {
    duration_months?: number;
    roles?: RawMaintRole[];
    tasks?: RawMaintTask[];
  };
  infrastructure_items?: RawInfraItem[];
  infrastructure?: RawInfraItem[];
  summary_notes?: string;
  summary?: string;
}

// Helper: Parse spreadsheets (.xlsx, .xls, .csv)
function parseSpreadsheet(buffer: Buffer, filename: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let text = `[Spreadsheet: ${filename}]\n`;
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv && csv.trim()) {
        text += `--- Sheet: ${sheetName} ---\n${csv}\n\n`;
      }
    }
    return text;
  } catch (err: unknown) {
    return `[Spreadsheet: ${filename} (Gagal parsing: ${err instanceof Error ? err.message : String(err)})]\n`;
  }
}

// Helper: Parse PDF
async function parsePdf(buffer: Buffer, filename: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfModule = require('pdf-parse');
    if (typeof pdfModule === 'function') {
      const data = await pdfModule(buffer);
      return `[Dokumen PDF: ${filename}]\n${data.text || ''}\n\n`;
    } else if (pdfModule.PDFParse) {
      const parser = new pdfModule.PDFParse({ data: buffer });
      const result = await parser.getText();
      return `[Dokumen PDF: ${filename}]\n${result.text || ''}\n\n`;
    } else if (pdfModule.default && typeof pdfModule.default === 'function') {
      const data = await pdfModule.default(buffer);
      return `[Dokumen PDF: ${filename}]\n${data.text || ''}\n\n`;
    }
    return `[Dokumen PDF: ${filename} (Format tidak didukung)]\n`;
  } catch (err: unknown) {
    return `[Dokumen PDF: ${filename} (Gagal parsing: ${err instanceof Error ? err.message : String(err)})]\n`;
  }
}

// Helper: Parse DOCX
async function parseDocx(buffer: Buffer, filename: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return `[Dokumen DOCX: ${filename}]\n${result.value || ''}\n\n`;
  } catch (err: unknown) {
    return `[Dokumen DOCX: ${filename} (Gagal parsing: ${err instanceof Error ? err.message : String(err)})]\n`;
  }
}

// Helper: Parse text files
function parseTextFile(buffer: Buffer, filename: string): string {
  try {
    return `[Dokumen Teks: ${filename}]\n${buffer.toString('utf-8')}\n\n`;
  } catch (err: unknown) {
    return `[Dokumen Teks: ${filename} (Gagal membaca: ${err instanceof Error ? err.message : String(err)})]\n`;
  }
}

// Helper: Extract JSON from LLM output
function extractJson(rawText: string): RawDraftStructure {
  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
  }
  return JSON.parse(cleaned) as RawDraftStructure;
}

// Helper: Execute Hermes CLI
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
      { maxBuffer: 15 * 1024 * 1024, timeout: 180000 },
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

// Helper: Normalize draft to ensure complete structure
function normalizeDraft(
  raw: RawDraftStructure,
  companies: CompanyItem[],
  projects: ProjectItem[],
  roles: RoleMasterItem[]
) {
  const companyName = String(raw.company_name || raw.company || 'PT Klien').trim();
  const projectName = String(raw.project_name || raw.project || raw.title || 'Proyek Baru').trim();

  // Company matching
  const matchedCompany = companies.find(
    (c) => c.name.toLowerCase() === companyName.toLowerCase()
  );
  const isNewCompany =
    raw.is_new_company !== undefined ? Boolean(raw.is_new_company) : !matchedCompany;

  // Project matching
  const matchedProject = projects.find(
    (p) =>
      p.name.toLowerCase() === projectName.toLowerCase() &&
      (matchedCompany ? p.company_id === matchedCompany.id : true)
  );
  const isNewProject =
    raw.is_new_project !== undefined ? Boolean(raw.is_new_project) : !matchedProject;

  // Categories
  let categories: string[] = Array.isArray(raw.categories) ? raw.categories : [];
  const validCatSet = new Set(['DEVELOPMENT', 'MAINTENANCE', 'INFRASTRUCTURE']);
  categories = categories
    .map((c) => String(c).toUpperCase())
    .filter((c) => validCatSet.has(c));
  if (categories.length === 0) {
    categories = ['DEVELOPMENT'];
  }

  // Tag code: INITIAL | CR | null
  let tagCode: 'INITIAL' | 'CR' | null = null;
  if (categories.includes('DEVELOPMENT')) {
    const rawTag = String(raw.tag_code || raw.tag || 'INITIAL').toUpperCase();
    tagCode = rawTag.includes('CR') ? 'CR' : 'INITIAL';
  }

  // Active role codes map
  const activeRoleCodes = new Set(roles.map((r) => r.code));

  // Development modules
  const rawModules = Array.isArray(raw.development_modules)
    ? raw.development_modules
    : Array.isArray(raw.modules)
    ? raw.modules
    : [];

  const devModules = rawModules.map((m: RawModuleItem, mIdx: number) => {
    const modName = String(m.name || `Modul ${mIdx + 1}`);
    const rawTasks = Array.isArray(m.tasks) ? m.tasks : [];
    const tasks = rawTasks.map((t: RawTaskItem, tIdx: number) => {
      const taskName = String(t.task_name || t.name || `Task ${tIdx + 1}`);
      const roleHours: Record<string, number> = {};

      if (t.role_hours && typeof t.role_hours === 'object') {
        for (const [code, hrs] of Object.entries(t.role_hours)) {
          const cleanCode = code.toUpperCase();
          const num = Number(hrs);
          if (!isNaN(num) && num > 0) {
            roleHours[cleanCode] = num;
          }
        }
      }

      // Backward compatible hour mappings
      if (t.hours_pm) roleHours['PM'] = Number(t.hours_pm);
      if (t.hours_web_dev) roleHours['WEB_DEV'] = Number(t.hours_web_dev);
      if (t.hours_ui_ux) roleHours['UI_UX'] = Number(t.hours_ui_ux);
      if (t.hours_qc_doc) roleHours['QC_DOC'] = Number(t.hours_qc_doc);
      if (t.hours_dev_ops) roleHours['DEV_OPS'] = Number(t.hours_dev_ops);

      // Default role hours if completely empty
      if (Object.keys(roleHours).length === 0 && activeRoleCodes.size > 0) {
        if (activeRoleCodes.has('WEB_DEV')) roleHours['WEB_DEV'] = 8;
        else if (activeRoleCodes.has('PM')) roleHours['PM'] = 4;
      }

      return {
        name: taskName,
        task_name: taskName,
        role_hours: roleHours,
        hours_pm: roleHours['PM'] || 0,
        hours_web_dev: roleHours['WEB_DEV'] || 0,
        hours_ui_ux: roleHours['UI_UX'] || 0,
        hours_qc_doc: roleHours['QC_DOC'] || 0,
        hours_dev_ops: roleHours['DEV_OPS'] || 0,
      };
    });

    return {
      name: modName,
      tasks,
    };
  });

  // Maintenance config
  const rawMaint = raw.maintenance_config || raw.maintenance || {};
  const maintDuration =
    Number(rawMaint.duration_months) || (categories.includes('MAINTENANCE') ? 12 : 0);
  const rawMaintRoles = Array.isArray(rawMaint.roles) ? rawMaint.roles : [];
  const maintRoles = rawMaintRoles.map((r: RawMaintRole) => ({
    role_code: String(r.role_code || r.code || '').toUpperCase(),
    monthly_hours: Number(r.monthly_hours || r.hours || 0),
  }));

  const rawMaintTasks = Array.isArray(rawMaint.tasks) ? rawMaint.tasks : [];
  const maintTasks = rawMaintTasks.map((t: RawMaintTask, tIdx: number) => ({
    name: String(t.name || t.task_name || `Maintenance Task ${tIdx + 1}`),
    role_hours: t.role_hours || {},
  }));

  // Infrastructure items
  const rawInfra = Array.isArray(raw.infrastructure_items)
    ? raw.infrastructure_items
    : Array.isArray(raw.infrastructure)
    ? raw.infrastructure
    : [];

  const infraItems = rawInfra.map((item: RawInfraItem, iIdx: number) => {
    let billingType = String(item.billing_type || 'MONTHLY').toUpperCase();
    if (!['ONE_TIME', 'MONTHLY', 'YEARLY'].includes(billingType)) {
      billingType = 'MONTHLY';
    }
    return {
      name: String(item.name || `Infra Item ${iIdx + 1}`),
      billing_type: billingType as 'ONE_TIME' | 'MONTHLY' | 'YEARLY',
      quantity: Number(item.quantity) || 1,
      unit_cost: Number(item.unit_cost) || 0,
      period_count: Number(item.period_count) || (billingType === 'ONE_TIME' ? 1 : 12),
      notes: String(item.notes || ''),
    };
  });

  const summaryNotes = String(raw.summary_notes || raw.summary || '').trim();

  return {
    company_name: companyName,
    is_new_company: isNewCompany,
    company_id: matchedCompany ? matchedCompany.id : null,
    project_name: projectName,
    is_new_project: isNewProject,
    project_id: matchedProject ? matchedProject.id : null,
    title: projectName,
    service_code: 'IT',
    categories,
    tag_code: tagCode,
    development_modules: devModules,
    modules: devModules,
    maintenance_config: {
      duration_months: maintDuration,
      roles: maintRoles,
      tasks: maintTasks,
    },
    infrastructure_items: infraItems,
    summary_notes: summaryNotes,
    notes: summaryNotes,
  };
}

// Fallback generator if Hermes fails
function generateFallbackDraft(
  prompt: string,
  parsedDocs: string,
  companies: CompanyItem[],
  projects: ProjectItem[],
  roles: RoleMasterItem[]
) {
  const combined = `${prompt} ${parsedDocs}`.toLowerCase();
  const matchedCompany = companies.find((c) => combined.includes(c.name.toLowerCase()));
  const isNewCompany = !matchedCompany;
  const companyName = matchedCompany ? matchedCompany.name : 'PT Klien Baru';

  let matchedProject: ProjectItem | undefined;
  if (matchedCompany) {
    matchedProject = projects.find(
      (p) => p.company_id === matchedCompany!.id && combined.includes(p.name.toLowerCase())
    );
  }
  const isNewProject = !matchedProject;
  const projectName = matchedProject ? matchedProject.name : 'Sistem Informasi & Aplikasi Web';

  const categories: string[] = ['DEVELOPMENT'];
  if (combined.includes('maintenance') || combined.includes('pemeliharaan') || combined.includes('support')) {
    categories.push('MAINTENANCE');
  }
  if (combined.includes('infra') || combined.includes('server') || combined.includes('cloud') || combined.includes('hosting')) {
    categories.push('INFRASTRUCTURE');
  }

  const roleCodeMap = roles.reduce((acc, r) => {
    acc[r.code] = r.code;
    return acc;
  }, {} as Record<string, string>);

  const devModules = [
    {
      name: '1.0 Perencanaan & Analisis Sistem',
      tasks: [
        {
          name: 'Kickoff & Requirements Gathering',
          task_name: 'Kickoff & Requirements Gathering',
          role_hours: { [roleCodeMap['PM'] || 'PM']: 4, [roleCodeMap['UI_UX'] || 'UI_UX']: 4 },
        },
        {
          name: 'Arsitektur Sistem & Desain Mockup',
          task_name: 'Arsitektur Sistem & Desain Mockup',
          role_hours: { [roleCodeMap['UI_UX'] || 'UI_UX']: 12, [roleCodeMap['WEB_DEV'] || 'WEB_DEV']: 8 },
        },
      ],
    },
    {
      name: '2.0 Implementasi Core Features',
      tasks: [
        {
          name: 'Pengembangan Backend API & Database',
          task_name: 'Pengembangan Backend API & Database',
          role_hours: { [roleCodeMap['WEB_DEV'] || 'WEB_DEV']: 24, [roleCodeMap['DEV_OPS'] || 'DEV_OPS']: 8 },
        },
        {
          name: 'Pengembangan Antarmuka Pengguna (Frontend)',
          task_name: 'Pengembangan Antarmuka Pengguna (Frontend)',
          role_hours: { [roleCodeMap['WEB_DEV'] || 'WEB_DEV']: 24, [roleCodeMap['UI_UX'] || 'UI_UX']: 8 },
        },
      ],
    },
    {
      name: '3.0 Testing & Deployment',
      tasks: [
        {
          name: 'Pengujian QA & UAT',
          task_name: 'Pengujian QA & UAT',
          role_hours: { [roleCodeMap['QC_DOC'] || 'QC_DOC']: 12, [roleCodeMap['PM'] || 'PM']: 4 },
        },
        {
          name: 'Deployment & Go-Live Staging/Prod',
          task_name: 'Deployment & Go-Live Staging/Prod',
          role_hours: { [roleCodeMap['DEV_OPS'] || 'DEV_OPS']: 8, [roleCodeMap['WEB_DEV'] || 'WEB_DEV']: 8 },
        },
      ],
    },
  ];

  return normalizeDraft(
    {
      company_name: companyName,
      is_new_company: isNewCompany,
      project_name: projectName,
      is_new_project: isNewProject,
      service_code: 'IT',
      categories,
      tag_code: 'INITIAL',
      development_modules: devModules,
      maintenance_config: {
        duration_months: categories.includes('MAINTENANCE') ? 12 : 0,
        roles: categories.includes('MAINTENANCE') ? [{ role_code: 'WEB_DEV', monthly_hours: 10 }] : [],
        tasks: [],
      },
      infrastructure_items: categories.includes('INFRASTRUCTURE')
        ? [
            {
              name: 'Cloud VPS & Managed Database Server',
              billing_type: 'MONTHLY',
              quantity: 1,
              unit_cost: 1500000,
              period_count: 12,
              notes: 'Spesifikasi 4 vCPU 8GB RAM SSD 160GB',
            },
          ]
        : [],
      summary_notes: `Estimasi draft disusun berdasarkan analisis requirement: "${prompt || 'Dokumen lampiran'}".`,
    },
    companies,
    projects,
    roles
  );
}

export async function POST(req: Request) {
  const tempFilesToClean: string[] = [];

  try {
    const formData = await req.formData();
    const prompt = (formData.get('prompt') as string) || '';
    const files = formData.getAll('files') as File[];
    const currentStateRaw = (formData.get('current_state') as string) || '';
    const chatHistoryRaw = (formData.get('chat_history') as string) || '';

    let currentState = null;
    if (currentStateRaw) {
      try {
        currentState = JSON.parse(currentStateRaw);
      } catch {}
    }

    let chatHistory = [];
    if (chatHistoryRaw) {
      try {
        chatHistory = JSON.parse(chatHistoryRaw);
      } catch {}
    }

    // 1. Ambil konteks master database
    const [companiesRes, projectsRes, rolesRes] = await Promise.all([
      pool.query('SELECT id, name FROM companies ORDER BY name ASC'),
      pool.query(`
        SELECT p.id, p.company_id, c.name as company_name, p.name 
        FROM projects p 
        JOIN companies c ON p.company_id = c.id 
        ORDER BY p.name ASC
      `),
      pool.query(`
        SELECT id, code, name, default_hourly_rate 
        FROM role_masters 
        WHERE is_active = TRUE 
        ORDER BY id ASC
      `),
    ]);

    const companies: CompanyItem[] = companiesRes.rows;
    const projects: ProjectItem[] = projectsRes.rows;
    const roles: RoleMasterItem[] = rolesRes.rows.map((r) => ({
      ...r,
      default_hourly_rate: Number(r.default_hourly_rate),
    }));

    // 2. Parse file lampiran
    const parsedDocumentTexts: string[] = [];
    const imageWorkspacePaths: string[] = [];

    const uploadDir = path.resolve(process.cwd(), 'tmp/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      if (!file || !file.name) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
        parsedDocumentTexts.push(parseSpreadsheet(buffer, file.name));
      } else if (lowerName.endsWith('.pdf')) {
        const text = await parsePdf(buffer, file.name);
        parsedDocumentTexts.push(text);
      } else if (lowerName.endsWith('.docx')) {
        const text = await parseDocx(buffer, file.name);
        parsedDocumentTexts.push(text);
      } else if (lowerName.endsWith('.txt')) {
        parsedDocumentTexts.push(parseTextFile(buffer, file.name));
      } else if (
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.webp')
      ) {
        const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const localPath = path.join(uploadDir, safeName);
        fs.writeFileSync(localPath, buffer);
        tempFilesToClean.push(localPath);

        // Path inside Hermes container busdev (/workspace/tmp/uploads/...)
        const busdevContainerPath = `/workspace/tmp/uploads/${safeName}`;
        imageWorkspacePaths.push(busdevContainerPath);
      }
    }

    // 3. Susun prompt untuk Hermes busdev
    const companiesContext = companies.map((c) => `- ${c.name} (ID: ${c.id})`).join('\n') || '(Belum ada perusahaan)';
    const projectsContext =
      projects.map((p) => `- [${p.company_name}] ${p.name} (ID: ${p.id})`).join('\n') || '(Belum ada project)';
    const rolesContext =
      roles.map((r) => `- Role Code: "${r.code}", Nama: "${r.name}", Default Rate/Jam: Rp ${r.default_hourly_rate.toLocaleString('id-ID')}`).join('\n');
    const roleCodes = roles.map((r) => r.code);

    let imageInstructions = '';
    if (imageWorkspacePaths.length > 0) {
      imageInstructions = `
LAMPIRAN GAMBAR (VISION):
Terdapat ${imageWorkspacePaths.length} gambar mockup / arsitektur di workspace:
${imageWorkspacePaths.map((p) => `- File: ${p}`).join('\n')}
Gunakan tool vision_analyze untuk memeriksa file gambar tersebut dan memahami modul, UI/UX, database, arsitektur, atau fitur-fitur yang perlu diestimasi.
`;
    }

    let attachmentContext = '';
    if (parsedDocumentTexts.length > 0) {
      attachmentContext = `
ISI LAMPIRAN DOKUMEN / SPREADSHEET YANG TELAH DIPARSING:
${parsedDocumentTexts.join('\n\n')}
`;
    }

    const systemPrompt = `Kamu adalah Senior IT Solution Architect & Costing Specialist.
Tugasmu adalah menganalisis kebutuhan klien (prompt teks, lampiran dokumen/spreadsheet, dan gambar arsitektur/mockup) lalu menghasilkan draft costing terstruktur dalam format JSON yang valid.

KONTEKS MASTER DATABASE:
1. Daftar Perusahaan Terdaftar:
${companiesContext}

2. Daftar Project Per Perusahaan:
${projectsContext}

3. Daftar Master Role Aktif & Default Tarif per Jam:
${rolesContext}

PETUNJUK ANALISIS & MAPPING:
1. Perusahaan (company_name & is_new_company):
   - Jika kebutuhan menyebutkan perusahaan yang cocok atau mirip dengan salah satu di daftar perusahaan terdaftar, gunakan nama persis perusahaan tersebut dan set "is_new_company": false.
   - Jika tidak ada di daftar perusahaan terdaftar, gunakan nama perusahaan yang relevan dari brief dan set "is_new_company": true. Default: "PT Klien Baru".
2. Project (project_name & is_new_project):
   - Jika nama project cocok dengan project yang sudah ada di perusahaan tersebut, set "is_new_project": false.
   - Jika project baru, berikan nama project yang representatif dan set "is_new_project": true.
3. Kategori (categories):
   - Array kombinasi dari: ["DEVELOPMENT", "MAINTENANCE", "INFRASTRUCTURE"].
   - Tentukan kategori berdasarkan lingkup pekerjaan yang dibutuhkan.
4. Tag (tag_code):
   - Jika categories menyertakan "DEVELOPMENT", set "INITIAL" (project baru) atau "CR" (jika change request/fitur tambahan).
   - Jika categories TIDAK menyertakan "DEVELOPMENT", set null.
5. Development Modules (development_modules):
   - Jika categories menyertakan "DEVELOPMENT", buat modul-modul spesifik dan task-task terinci dengan estimasi jam per role (role_hours: { [role_code]: number }).
   - Gunakan HANYA role_code dari master role aktif berikut: ${roleCodes.join(', ')}.
   - Jika tidak ada DEVELOPMENT, isi array kosong [].
6. Maintenance Config (maintenance_config):
   - Jika categories menyertakan "MAINTENANCE", tentukan duration_months (misal 3, 6, atau 12 bulan), roles ([{ "role_code": string, "monthly_hours": number }]), dan daftar tasks.
   - Jika tidak ada MAINTENANCE, isi duration_months: 0, roles: [], tasks: [].
7. Infrastructure Items (infrastructure_items):
   - Jika categories menyertakan "INFRASTRUCTURE", buat daftar item ([{ "name": string, "billing_type": "ONE_TIME" | "MONTHLY" | "YEARLY", "quantity": number, "unit_cost": number, "period_count": number, "notes": string }]).
   - Jika tidak ada INFRASTRUCTURE, isi array kosong [].
8. Summary Notes (summary_notes):
   - Ringkasan profesional tentang lingkup estimasi, asumsi teknis, dan timeline proyek.

${imageInstructions}
${attachmentContext}

INPUT USER:
DRAFT / KONDISI SAAT INI (STATE SEBELUMNYA):
${currentState ? JSON.stringify(currentState, null, 2) : '(Belum ada draft sebelumnya - ini adalah inisiasi draft baru)'}

RIWAYAT PERCAKAPAN PENYESUAIAN SEBELUMNYA:
${chatHistory && chatHistory.length > 0 ? chatHistory.map((m: any) => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n') : '(Percakapan baru)'}

INSTRUKSI PENYESUAIAN (ITERATIVE ADJUSTMENT):
Jika sudah ada DRAFT / KONDISI SAAT INI di atas:
- Lakukan penyesuaian (tambah/ubah/hapus modul, task, durasi maintenance, atau item infra) SESUAI INSTRUKSI TERBARU USER.
- Pertahankan modul/task/item yang tidak diminta diubah, hanya modifikasi bagian yang diinstruksikan.
- Jika user meminta menambah modul baru, tambahkan ke dalam development_modules.

INPUT TERBARU USER:
"${prompt.trim() || 'Buat draft costing berdasarkan seluruh lampiran dokumen/gambar yang disediakan.'}"

OUTPUT WAJIB:
Keluarkan HANYA JSON valid sesuai struktur berikut tanpa pembuka atau penutup markdown:
{
  "company_name": "string",
  "is_new_company": boolean,
  "project_name": "string",
  "is_new_project": boolean,
  "service_code": "IT",
  "categories": ["DEVELOPMENT"],
  "tag_code": "INITIAL",
  "development_modules": [
    {
      "name": "string",
      "tasks": [
        {
          "task_name": "string",
          "role_hours": {
            "PM": 4,
            "WEB_DEV": 16
          }
        }
      ]
    }
  ],
  "maintenance_config": {
    "duration_months": 0,
    "roles": [],
    "tasks": []
  },
  "infrastructure_items": [],
  "summary_notes": "string"
}`;

    // 4. Eksekusi Hermes busdev
    let draftResult;
    try {
      const hermesOutput = await executeHermes(systemPrompt);
      const rawJson = extractJson(hermesOutput);
      draftResult = normalizeDraft(rawJson, companies, projects, roles);
    } catch (llmError) {
      console.warn('Hermes execution warning, using intelligent fallback draft:', llmError);
      draftResult = generateFallbackDraft(prompt, parsedDocumentTexts.join('\n'), companies, projects, roles);
    }

    return NextResponse.json({
      success: true,
      draft: draftResult,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown internal error';
    return NextResponse.json(
      {
        success: false,
        error: `Gagal memproses AI draft costing: ${errorMsg}`,
      },
      { status: 500 }
    );
  } finally {
    // Bersihkan file sementara
    for (const filePath of tempFilesToClean) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // ignore cleanup error
      }
    }
  }
}
