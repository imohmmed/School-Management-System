/** Server-controlled exact email allowlist; never take it from a request or client claims. */
export function isConfiguredOwnerEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (process.env.SCHOOL_OWNER_EMAILS ?? "").split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
