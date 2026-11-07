import { demoSourceDocuments } from './demo-data.js';

const DB = 'anduin-preflight-originals';
function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function transact(mode, operation) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction('files', mode);
      const r = operation(t.objectStore('files'));
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Original storage transaction aborted'));
    });
  } finally {
    db.close();
  }
}
export const saveOriginal = (key, file) => transact('readwrite', (s) => s.put(file, key));
export async function getOriginal(key) {
  if (!key) return null;
  const stored = await transact('readonly', (s) => s.get(key));
  if (stored) return stored;
  const sample = Object.values(demoSourceDocuments)
    .flat()
    .find((doc) => doc.originalKey === key);
  if (!sample) return stored;
  const response = await fetch(`${import.meta.env.BASE_URL}${sample.samplePath}`);
  if (!response.ok) throw new Error('The bundled demo original could not be loaded.');
  const blob = await response.blob();
  await saveOriginal(key, blob);
  return blob;
}
