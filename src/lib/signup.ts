/**
 * Who is allowed to sign in at all.
 *
 * This matters more for RelayStand than for most self-hosted apps. A Google or
 * Entra OAuth client in its usual "any account" mode will happily authenticate
 * every Google account on earth, and anyone who gets that far can create their
 * own organisation here (`POST /api/orgs`). Joining *your* organisation still
 * needs an admin's approval, so nobody reaches your data — but without a list
 * below, strangers can sign up and squat on your server.
 *
 * Two env vars, either or both:
 *
 *   AUTH_ALLOWED_DOMAINS="acme.com, acme.co.uk"
 *   AUTH_ALLOWED_EMAILS="asha@gmail.com, bo@gmail.com"
 *
 * Leave both empty and sign-in is open to anyone your provider authenticates.
 * That is the default so a first run works, not because it is a good idea.
 */

const list = (raw: string | undefined) =>
  (raw ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

/** The domain part, lowercase. `''` for anything that is not an address. */
export function domainOf(email: string) {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

/**
 * Exact matches only — `acme.com` does not admit `evil-acme.com` and does not
 * admit `mail.acme.com` either. List every domain you mean.
 */
export function signUpAllowed(email: string) {
  const domains = list(process.env.AUTH_ALLOWED_DOMAINS);
  const emails = list(process.env.AUTH_ALLOWED_EMAILS);
  if (domains.length === 0 && emails.length === 0) return true;

  const addr = email.trim().toLowerCase();
  if (!addr) return false;
  return emails.includes(addr) || domains.includes(domainOf(addr));
}

/**
 * Demo mode: a password-less "sign in as the demo lead" button, so somebody can
 * see the product without registering an OAuth app first.
 *
 * Two conditions, both required, and the second is not one an operator can talk
 * themselves past. A production build — the Docker image, `next start`, anything
 * with NODE_ENV=production — cannot turn this on at all, whatever DEMO_MODE
 * says. It is a local-demo switch, not a deployment mode.
 */
export function demoMode() {
  return process.env.DEMO_MODE === '1' && process.env.NODE_ENV !== 'production';
}

/** True when this deployment lets anyone in. Used for the one-time boot warning. */
export function signUpIsOpen() {
  return (
    list(process.env.AUTH_ALLOWED_DOMAINS).length === 0 &&
    list(process.env.AUTH_ALLOWED_EMAILS).length === 0
  );
}
