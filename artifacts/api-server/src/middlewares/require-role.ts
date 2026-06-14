import { type Request, type Response, type NextFunction } from "express";

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.roleName)) {
      res.status(403).json({ error: `Access restricted to: ${roles.join(", ")}` });
      return;
    }
    next();
  };
}
