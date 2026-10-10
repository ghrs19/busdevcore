export const MAX_DRAFT_FILES = 5;
export const MAX_DRAFT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DRAFT_BODY_BYTES = MAX_DRAFT_FILES * MAX_DRAFT_FILE_BYTES + 1024 * 1024;
const allowed = /\.(xlsx|xls|csv|pdf|docx|txt|png|jpe?g|webp)$/i;

export function validateDraftUploads(files: { name: string; size: number }[]): string | null {
  if (files.length > MAX_DRAFT_FILES) return `Maksimal ${MAX_DRAFT_FILES} lampiran.`;
  for (const file of files) {
    if (!allowed.test(file.name)) return `Format file tidak didukung: ${file.name}`;
    if (file.size > MAX_DRAFT_FILE_BYTES) return `Maksimal 10 MB per file: ${file.name}`;
  }
  return null;
}

export async function parseDraftFormData(req: Request): Promise<FormData> {
  if (Number(req.headers.get('content-length')) > MAX_DRAFT_BODY_BYTES) throw new RangeError('Ukuran total permintaan melebihi batas 51 MB.');
  if (!req.body) return req.formData();
  let bytes = 0;
  const limited = req.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_DRAFT_BODY_BYTES) throw new RangeError('Ukuran total permintaan melebihi batas 51 MB.');
      controller.enqueue(chunk);
    },
  }));
  return new Request(req.url, { method: req.method, headers: req.headers, body: limited, duplex: 'half' } as RequestInit).formData();
}
