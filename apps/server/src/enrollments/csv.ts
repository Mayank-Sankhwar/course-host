const maxRows = 1_000;

export class CsvValidationError extends Error {}

function parseRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field); field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '';
    } else {
      field += character;
    }
  }
  if (quoted) throw new CsvValidationError('CSV contains an unterminated quoted value.');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

export function parseEmailCsv(text: string): string[] {
  const rows = parseRecords(text).filter((row) => row.some((value) => value.trim()));
  if (rows.length === 0) throw new CsvValidationError('CSV must contain at least one email row.');
  if (rows[0].length === 1 && rows[0][0].trim().toLowerCase() === 'email') rows.shift();
  if (rows.length === 0) throw new CsvValidationError('CSV must contain at least one email row.');
  if (rows.length > maxRows) throw new CsvValidationError(`CSV must contain at most ${maxRows} email rows.`);
  if (rows.some((row) => row.length !== 1)) throw new CsvValidationError('CSV must contain exactly one email column.');
  return rows.map((row) => row[0]);
}

export function multipartCsv(buffer: Buffer, contentType: string | undefined): string {
  const boundary = contentType?.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)?.[1] ?? contentType?.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)?.[2];
  if (!boundary) throw new CsvValidationError('A CSV file upload is required.');
  const parts = buffer.toString('utf8').split(`--${boundary}`);
  for (const part of parts) {
    const separator = part.indexOf('\r\n\r\n');
    if (separator < 0 || !/name="file"/i.test(part.slice(0, separator))) continue;
    const headers = part.slice(0, separator);
    const filename = headers.match(/filename="([^"]*)"/i)?.[1] ?? '';
    const type = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase();
    if (!filename || (!filename.toLowerCase().endsWith('.csv') && type !== 'text/csv' && type !== 'application/csv')) throw new CsvValidationError('Upload a CSV file.');
    return part.slice(separator + 4).replace(/\r\n$/, '');
  }
  throw new CsvValidationError('A CSV file upload is required.');
}

export const csvLimits = { maxRows, maxFileBytes: 256 * 1024 };
