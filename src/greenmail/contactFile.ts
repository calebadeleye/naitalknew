/**
 * Reads an uploaded contact list in the browser: a CSV/TSV (Excel "Save as
 * CSV", Google Contacts, Outlook) or a vCard (.vcf, exported from a phone).
 * Only addresses go to the server, never the file.
 */
export type UploadedContact = { email: string; name: string | null; phone: string | null; company: string | null };
export type ContactFile = { contacts: UploadedContact[]; withoutEmail: number };

const EMAIL = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

/** Splits CSV text into rows, with quoted fields ("Obi, Ada") and the delimiter Excel picked. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((v) => v.trim())).filter((r) => r.some(Boolean));
}

const pick = (header: string[], tests: RegExp[]) => {
  for (const test of tests) {
    const index = header.findIndex((h) => test.test(h));
    if (index >= 0) return index;
  }
  return -1;
};

const value = (row: string[], index: number) => (index >= 0 && row[index] ? row[index] : null);

/** Turns CSV rows into contacts, with or without a header row. */
export function contactsFromRows(rows: string[][]): ContactFile {
  if (rows.length === 0) return { contacts: [], withoutEmail: 0 };
  const header = rows[0].map((h) => h.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim());
  const hasHeader = !rows[0].some((cell) => EMAIL.test(cell)) && header.some((h) => /e ?mail/.test(h));

  if (!hasHeader) return looseRows(rows);

  const email = pick(header, [/^e ?mail( address)?$/, /^e ?mail 1 (value|address)$/, /e ?mail/]);
  const name = pick(header, [/^(full |display )?name$/, /^contact( name)?$/, /^customer( name)?$/]);
  const first = pick(header, [/^first( name)?$/, /^given name$/, /^firstname$/]);
  const last = pick(header, [/^(last|sur|family)( ?name)?$/, /^lastname$/]);
  const phone = pick(header, [/^(phone|mobile|telephone|tel|whatsapp)( number| no)?$/, /^(mobile|primary|home|business) phone$/, /^phone 1 value$/, /phone|mobile|whatsapp/]);
  const company = pick(header, [/^(company|organi[sz]ation|business)( name)?$/, /^organi[sz]ation 1 name$/, /company|organi[sz]ation/]);

  const contacts: UploadedContact[] = [];
  const seen = new Set<string>();
  let withoutEmail = 0;
  for (const row of hasHeader ? rows.slice(1) : rows) {
    let address = (value(row, email) ?? "").replace(/^mailto:/i, "");
    const angled = address.match(/<([^>]+)>/);
    if (angled) address = angled[1];
    address = address.trim().toLowerCase();
    if (!EMAIL.test(address)) {
      withoutEmail++;
      continue;
    }
    if (seen.has(address)) continue;
    seen.add(address);
    const fullName = value(row, name) ?? ([value(row, first), value(row, last)].filter(Boolean).join(" ") || null);
    contacts.push({ email: address, name: fullName, phone: value(row, phone), company: value(row, company) });
  }
  return { contacts, withoutEmail };
}

/** No header: in each row, the cell holding an address ("Ada <ada@x.com>" too) and the first other text as the name. */
function looseRows(rows: string[][]): ContactFile {
  const contacts: UploadedContact[] = [];
  const seen = new Set<string>();
  let withoutEmail = 0;
  for (const row of rows) {
    let found: { email: string; name: string | null; index: number } | null = null;
    row.some((cell, index) => {
      const angled = cell.match(/^(.*?)\s*<([^>]+)>\s*$/);
      const address = (angled ? angled[2] : cell).replace(/^mailto:/i, "").trim().toLowerCase();
      if (EMAIL.test(address)) found = { email: address, name: angled ? angled[1].replace(/^["']|["']$/g, "").trim() || null : null, index };
      return found !== null;
    });
    const hit = found as { email: string; name: string | null; index: number } | null;
    if (!hit) {
      withoutEmail++;
      continue;
    }
    if (seen.has(hit.email)) continue;
    seen.add(hit.email);
    const name = hit.name ?? row.find((cell, index) => index !== hit.index && /[a-z]/i.test(cell) && !cell.includes("@")) ?? null;
    contacts.push({ email: hit.email, name, phone: null, company: null });
  }
  return { contacts, withoutEmail };
}

/** vCard (.vcf), as phones and Outlook export it. */
export function contactsFromVcard(text: string): ContactFile {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const cards = unfolded.split(/BEGIN:VCARD/i).slice(1);
  const contacts: UploadedContact[] = [];
  const seen = new Set<string>();
  let withoutEmail = 0;
  const field = (card: string, key: string) => {
    const match = card.match(new RegExp(`^(?:item\\d+\\.)?${key}(?:;[^:\\n]*)?:(.*)$`, "im"));
    return match ? match[1].replace(/\\([,;\\])/g, "$1").replace(/\\n/gi, " ").trim() || null : null;
  };
  for (const card of cards) {
    const address = (field(card, "EMAIL") ?? "").toLowerCase();
    if (!EMAIL.test(address)) {
      withoutEmail++;
      continue;
    }
    if (seen.has(address)) continue;
    seen.add(address);
    const n = field(card, "N")?.split(";");
    const name = field(card, "FN") ?? (n ? [n[1], n[0]].filter(Boolean).join(" ") || null : null);
    contacts.push({ email: address, name, phone: field(card, "TEL"), company: field(card, "ORG")?.split(";")[0] || null });
  }
  return { contacts, withoutEmail };
}

export function readContactFile(fileName: string, text: string): ContactFile {
  if (/\.vcf$/i.test(fileName) || /^\s*BEGIN:VCARD/i.test(text)) return contactsFromVcard(text);
  return contactsFromRows(parseCsv(text));
}
