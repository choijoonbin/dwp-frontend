export type SettingsSearchDocument<T> = {
  value: T;
  fields: readonly string[];
};

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/gu, ' ');
}

export function filterSettingsDocuments<T>(
  documents: readonly SettingsSearchDocument<T>[],
  query: string
): T[] {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (terms.length === 0) return documents.map((document) => document.value);

  return documents
    .filter((document) => {
      const haystack = normalize(document.fields.join(' '));
      return terms.every((term) => haystack.includes(term));
    })
    .map((document) => document.value);
}
