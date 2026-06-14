import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import {
  CreateUserBody,
  UpdateUserBody,
  UpdateUserParams,
  GetUserParams,
  DeleteUserParams,
  ResetUserPasswordParams,
  ResetUserPasswordBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatUser(u: {
  id: number; username: string; full_name: string; email: string | null;
  role_id: number; role_name: string; is_active: number; created_at: string; updated_at: string;
}) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    email: u.email ?? null,
    roleId: u.role_id,
    roleName: u.role_name,
    isActive: u.is_active === 1,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

router.get("/users", requireAuth, async (_req, res): Promise<void> => {
  const users = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    ORDER BY u.created_at DESC
  `).all() as Array<{
    id: number; username: string; full_name: string; email: string | null;
    role_id: number; role_name: string; is_active: number; created_at: string; updated_at: string;
  }>;

  res.json(users.map(formatUser));
});

router.post("/users", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, password, fullName, email, roleId, isActive } = parsed.data;

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) {
    res.status(400).json({ error: "Username already exists" });
    return;
  }

  const role = db.prepare("SELECT id FROM roles WHERE id = ?").get(roleId);
  if (!role) {
    res.status(400).json({ error: "Role not found" });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, email, role_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(username, passwordHash, fullName, email ?? null, roleId, isActive !== false ? 1 : 0);

  const user = db.prepare(`
    SELECT u.*, r.name as role_name FROM users u
    JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(result.lastInsertRowid) as {
    id: number; username: string; full_name: string; email: string | null;
    role_id: number; role_name: string; is_active: number; created_at: string; updated_at: string;
  };

  res.status(201).json(formatUser(user));
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const user = db.prepare(`
    SELECT u.*, r.name as role_name FROM users u
    JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(params.data.id) as {
    id: number; username: string; full_name: string; email: string | null;
    role_id: number; role_name: string; is_active: number; created_at: string; updated_at: string;
  } | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(formatUser(user));
});

router.patch("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(params.data.id) as {
    id: number; username: string; full_name: string; email: string | null;
    role_id: number; is_active: number;
  } | undefined;

  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { username, fullName, email, roleId, isActive } = parsed.data;

  if (username && username !== existing.username) {
    const conflict = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, params.data.id);
    if (conflict) {
      res.status(400).json({ error: "Username already taken" });
      return;
    }
  }

  db.prepare(`
    UPDATE users SET
      username = COALESCE(?, username),
      full_name = COALESCE(?, full_name),
      email = COALESCE(?, email),
      role_id = COALESCE(?, role_id),
      is_active = COALESCE(?, is_active),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    username ?? null,
    fullName ?? null,
    email !== undefined ? email : null,
    roleId ?? null,
    isActive !== undefined ? (isActive ? 1 : 0) : null,
    params.data.id
  );

  const updated = db.prepare(`
    SELECT u.*, r.name as role_name FROM users u
    JOIN roles r ON u.role_id = r.id WHERE u.id = ?
  `).get(params.data.id) as {
    id: number; username: string; full_name: string; email: string | null;
    role_id: number; role_name: string; is_active: number; created_at: string; updated_at: string;
  };

  res.json(formatUser(updated));
});

router.delete("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(params.data.id);
  res.json({ message: "User deleted successfully" });
});

router.post("/users/:id/reset-password", requireAuth, async (req, res): Promise<void> => {
  const params = ResetUserPasswordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ResetUserPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const newHash = bcrypt.hashSync(parsed.data.newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newHash, params.data.id);

  res.json({ message: "Password reset successfully" });
});

export default router;
