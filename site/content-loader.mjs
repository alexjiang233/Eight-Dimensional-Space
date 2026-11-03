import { readFile } from 'node:fs/promises';

export async function loadCatalog() {
  const catalog = JSON.parse(await readFile(new URL('./content/catalog.json', import.meta.url), 'utf8'));
  catalog.documents = [];
  for (const id of new Set(catalog.notes.map(note => note.documentId).filter(Boolean))) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid document ID: ${id}`);
    const document = JSON.parse(await readFile(new URL(`./content/documents/${id}.json`, import.meta.url), 'utf8'));
    catalog.documents.push({ id, ...document });
  }
  catalog.stories = [];
  for (const id of new Set(catalog.events.map(event => event.storyId).filter(Boolean))) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid event record ID: ${id}`);
    const story = JSON.parse(await readFile(new URL(`./content/events/${id}.json`, import.meta.url), 'utf8'));
    catalog.stories.push({ id, ...story });
  }
  return catalog;
}
