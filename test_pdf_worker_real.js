const { PDFParse } = require('pdf-parse');
async function test() {
  // A PDF with an image or operator stream to trigger worker/DOMMatrix
  const dummyPdf = ;

  const parser = new PDFParse({ data: Buffer.from(dummyPdf) });
  try {
    const res = await parser.getText();
    console.log('Result text:', JSON.stringify(res.text));
  } catch (e) {
    console.error('Error in test:', e);
  }
}
test();
