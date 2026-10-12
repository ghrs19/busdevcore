import { PDFParse } from 'pdf-parse';
async function test() {
  // A PDF with an image or operator stream to trigger worker/DOMMatrix
  const dummyPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nstream\nBT /F1 12 Tf (Worker test) Tj ET\nendstream\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n200\n%%EOF';

  const parser = new PDFParse({ data: Buffer.from(dummyPdf) });
  try {
    const res = await parser.getText();
    console.log('Result text:', JSON.stringify(res.text));
  } catch (e) {
    console.error('Error in test:', e);
  }
}
test();
