import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { packageMergedPdf } from '../modules/pdf/merged-pdf-generator.ts';
import { pendingScans } from '../modules/utils/scan-summary.ts';

test('PDF con adjunto incompatible entrega originales y aviso dentro de ZIP', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage();
  const zip = new JSZip(); zip.file('original.docx', 'contenido original');
  const r = await packageMergedPdf(await pdf.save(), [{label:'original.docx',base64:btoa('contenido original'),mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}],zip,'expediente');
  assert.equal(r.filename,'expediente.zip'); assert.match(r.notice!,/1 archivo/);
  const guardado = await JSZip.loadAsync(await r.blob.arrayBuffer());
  assert.equal(await guardado.file('original.docx')!.async('string'),'contenido original');
  assert.ok(guardado.file('expediente.pdf')); assert.ok(guardado.file('_LEER_FORMATO.txt'));
});
test('PDF corrupto no se informa como PDF completo', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage();
  const zip = new JSZip(); zip.file('roto.pdf','roto');
  const r = await packageMergedPdf(await pdf.save(),[{label:'roto.pdf',base64:btoa('roto'),mimeType:'application/pdf'}],zip,'expediente');
  assert.equal(r.filename,'expediente.zip'); assert.ok(r.notice);
});
test('PDF compatible conserva formato solicitado', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage(); const bytes = await pdf.save();
  const r = await packageMergedPdf(bytes,[{label:'correcto.pdf',base64:Buffer.from(bytes).toString('base64'),mimeType:'application/pdf'}],new JSZip(),'expediente');
  assert.equal(r.filename,'expediente.pdf'); assert.equal(r.notice,undefined);
  assert.equal((await PDFDocument.load(await r.blob.arrayBuffer())).getPageCount(),2);
});
test('barrido bloqueado cuenta la causa que falló y todas las postergadas', () => {
  assert.equal(pendingScans({errors:1,skippedByChallenge:9}),10);
  assert.equal(pendingScans({missingTabs:2,missingIds:1,skippedByDownload:3}),6);
  assert.equal(pendingScans({}),0);
});
