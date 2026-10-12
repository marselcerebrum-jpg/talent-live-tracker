/** Avatar inisial dengan warna tetap per nama. */
export function Avatar({ name }: { name: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rest = name.trim().replace(/^jadi/i, "");
  const label = rest !== name.trim() ? rest.slice(0, 2).toUpperCase() : (name.trim()[0] ?? "?").toUpperCase();
  return <span className={`av c${h % 5}`} aria-hidden>{label}</span>;
}
