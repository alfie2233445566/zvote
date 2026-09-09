import jwt from "jsonwebtoken";

// Generated in memory on server process startup.
// Whenever the server is stopped and restarted, this value changes,
// immediately invalidating any previous JWT sessions.
export const SERVER_BOOT_ID = Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 9);

/**
 * Verifies the JWT sent in the Authorization header (format: "Bearer <token>").
 * On success, attaches the decoded payload ({ id, studentId, role, walletAddress, department })
 * to req.user for downstream handlers to use.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed Authorization header." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.bootId || payload.bootId !== SERVER_BOOT_ID) {
      return res.status(401).json({ error: "Server was restarted. Session expired, please log in again." });
    }
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

/**
 * Must be used after requireAuth. Rejects the request unless req.user.role === "ADMIN".
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin privileges required." });
  }
  next();
}
