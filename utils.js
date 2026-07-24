export const $ = id => document.getElementById(id);
export const normalizeBarcode = value => String(value || "").replace(/\D/g, "");
export const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pl-PL");
}
export function showView(id) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("hidden", view.id !== id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
