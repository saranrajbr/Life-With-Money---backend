import jwt from "jsonwebtoken";

export default function (req, res, next) {
  const head = req.headers.authorization;
  if (!head) return res.status(401).json({ msg: "No token provided" });

  const parts = head.split(" ");
  if (parts.length !== 2) {
    return res.status(401).json({ msg: "Malformed Authorization header" });
  }

  const [schema, token] = parts;
  if (!/^Bearer$/i.test(schema) || !token) {
    return res.status(401).json({ msg: "Malformed token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id };
    next();
  } catch {
    return res.status(401).json({ msg: "Invalid or expired token" });
  }
}