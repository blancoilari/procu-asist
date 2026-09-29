import { test } from 'node:test';
import assert from 'node:assert/strict';
import { downloadLongAttachment } from '../modules/pdf/long-attachment.ts';

function setup(reply: 'ok' | 'disconnect' | 'wait') {
  let listener: any;
  let receive: any;
  let disconnect: any;
  let removed = false;
  let detached = false;
  const runtime = {
    getURL: (path: string) => `chrome-extension://test/${path}`,
    onConnect: { addListener: (fn: any) => { listener = fn; }, removeListener: () => { detached = true; } },
  };
  const tabs = {
    create: async ({ url }: { url: string }) => {
      const port = {
        name: url.split('#')[1], sender: { url },
        onMessage: { addListener: (fn: any) => { receive = fn; } },
        onDisconnect: { addListener: (fn: any) => { disconnect = fn; } },
        disconnect: () => {},
        postMessage: () => {
          if (reply === 'ok') {
            receive({ type: 'chunk', data: 'YWJj' });
            receive({ type: 'chunk', data: 'ZGVm' });
            receive({ status: 'ok', base64: '', mimeType: 'application/pdf' });
          } else if (reply === 'disconnect') disconnect();
        },
      };
      listener({ ...port, sender: { url: 'https://untrusted.example/' } });
      assert.equal(receive, undefined, 'no acepta mensajes desde una página ajena');
      listener(port);
      return { id: 12 };
    },
    remove: async (id: number) => { assert.equal(id, 12); removed = true; },
  };
  (globalThis as any).chrome = { runtime, tabs };
  return () => { assert.ok(removed); assert.ok(detached); };
}

test('adjunto largo reúne bloques y cierra sólo su pestaña al terminar', async () => {
  const cleanup = setup('ok');
  assert.deepEqual(await downloadLongAttachment('https://docs.scba.gov.ar/Documentos?nombre=test'), {
    status: 'ok', base64: 'YWJjZGVm', mimeType: 'application/pdf',
  });
  cleanup();
});

test('cerrar la pestaña informa error y libera el listener', async () => {
  const cleanup = setup('disconnect');
  const result = await downloadLongAttachment('https://docs.scba.gov.ar/Documentos?nombre=test');
  assert.equal(result.status, 'error');
  cleanup();
});

test('detener no deja esperando diez minutos ni una pestaña abierta', async () => {
  const cleanup = setup('wait');
  const result = await downloadLongAttachment('https://docs.scba.gov.ar/Documentos?nombre=test', () => 'stop-save');
  assert.equal(result.status, 'error');
  cleanup();
});

test('no convierte el descargador en un proxy a otros servidores', async () => {
  assert.equal((await downloadLongAttachment('https://example.org/file.pdf')).status, 'error');
});
