/**
 * Pure address parsing — no Prisma import, so the paste box can show a live
 * preview in the browser with the same code the server imports.
 */

export interface Recipient {
  email: string;
  name: string;
}

// Deliberately loose: the org owns whatever domain it owns.
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export const isEmail = (value: string) => EMAIL.test(value);

/**
 * A name to start from, read off the address: asha.menon@acme.com is Asha
 * Menon, dev_raval is Dev Raval, p@n.com is P. It is a placeholder — a lead
 * renames anyone whose address does not flatter them.
 */
export function nameFromEmail(email: string) {
  const local = email.split('@')[0].split('+')[0];
  const words = local
    .split(/[._\-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.join(' ') || email;
}

/**
 * Everything pasteable: commas, semicolons, spaces, newlines, and the
 * "Asha Menon <asha@acme.com>" form a mail client copies. A display name in
 * the paste wins over one derived from the address.
 */
export function parseRecipients(text: string) {
  const found: Recipient[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  // Pull out "Name <addr>" pairs first, then split whatever is left.
  const rest = text.replace(/([^<,;\n]*)<([^>]+)>/g, (_m, rawName: string, rawEmail: string) => {
    add(rawEmail.trim(), rawName.trim().replace(/^["']|["']$/g, ''));
    return ' ';
  });

  for (const token of rest.split(/[\s,;]+/)) {
    if (token.trim()) add(token.trim(), '');
  }

  function add(raw: string, displayName: string) {
    const email = raw.toLowerCase();
    if (!isEmail(email)) {
      invalid.push(raw);
      return;
    }
    if (seen.has(email)) return;
    seen.add(email);
    found.push({ email, name: displayName || nameFromEmail(email) });
  }

  return { recipients: found, invalid };
}
