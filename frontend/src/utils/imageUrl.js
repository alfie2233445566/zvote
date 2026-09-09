/**
 * Resolves candidate and election image URLs across different hosts.
 * When the frontend is hosted on Netlify (e.g. https://zvote.netlify.app)
 * and the backend is on Render/Koyeb (e.g. https://zvote-backend.onrender.com),
 * relative /uploads/... URLs must be resolved against the API base URL.
 *
 * @param {string} url - The pictureUrl or image path
 * @returns {string} Fully qualified or normalized image URL
 */
export function getImageUrl(url) {
  if (!url || typeof url !== "string") return "";

  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }

  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const normalizedBase = apiBase.replace(/\/+$/, "");
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  return `${normalizedBase}${normalizedPath}`;
}

export default getImageUrl;
