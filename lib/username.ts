/** Domain internal untuk akun talent. Bukan email sungguhan: tidak ada email yang dikirim ke alamat ini. */
export const USER_DOMAIN = "live.cerebrum.id";

/** "ginta" -> "ginta@live.cerebrum.id"; email lengkap dibiarkan apa adanya (untuk admin). */
export function toLoginEmail(input: string) {
  const v = input.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${USER_DOMAIN}`;
}

/** Tampilkan username saja untuk akun internal, email lengkap untuk yang lain. */
export function displayLogin(email: string | null | undefined) {
  if (!email) return "–";
  return email.endsWith(`@${USER_DOMAIN}`) ? email.slice(0, -USER_DOMAIN.length - 1) : email;
}

export function validUsername(v: string) {
  return /^[a-z0-9][a-z0-9._-]{2,29}$/.test(v);
}
