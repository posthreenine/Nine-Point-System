import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "../lib/database";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middlewares/auth";
import {
  LoginBody,
  ChangePasswordBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password } = parsed.data;

  const user = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.username = ? AND u.is_active = 1
  `).get(username) as {
    id: number; username: string; password_hash: string; full_name: string;
    email: string | null; role_id: number; role_name: string; is_active: number; created_at: string;
  } | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = signToken({
    userId: user.id,
    username: user.username,
    roleId: user.role_id,
    roleName: user.role_name,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email ?? null,
      roleId: user.role_id,
      roleName: user.role_name,
      isActive: user.is_active === 1,
      createdAt: user.created_at,
    },
  });
});

router.post("/auth/logout", requireAuth, async (_req, res): Promise<void> => {
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `).get(req.user!.userId) as {
    id: number; username: string; full_name: string; email: string | null;
    role_id: number; role_name: string; is_active: number; created_at: string;
  } | undefined;

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    email: user.email ?? null,
    roleId: user.role_id,
    roleName: user.role_name,
    isActive: user.is_active === 1,
    createdAt: user.created_at,
  });
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.userId) as {
    id: number; password_hash: string;
  } | undefined;

  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newHash, req.user!.userId);

  res.json({ message: "Password changed successfully" });
});

export default router;
