import { Router, type IRouter } from "express";
import { db } from "../lib/database";
import { requireAuth } from "../middlewares/auth";
import {
  CreateRoleBody,
  UpdateRoleBody,
  UpdateRoleParams,
  GetRoleParams,
  DeleteRoleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatRole(r: {
  id: number; name: string; description: string | null;
  is_system: number; user_count: number; created_at: string;
}) {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    isSystem: r.is_system === 1,
    userCount: r.user_count,
    createdAt: r.created_at,
  };
}

router.get("/roles", requireAuth, async (_req, res): Promise<void> => {
  const roles = db.prepare(`
    SELECT r.*, COUNT(u.id) as user_count
    FROM roles r
    LEFT JOIN users u ON u.role_id = r.id
    GROUP BY r.id
    ORDER BY r.id ASC
  `).all() as Array<{
    id: number; name: string; description: string | null;
    is_system: number; user_count: number; created_at: string;
  }>;

  res.json(roles.map(formatRole));
});

router.post("/roles", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, description } = parsed.data;

  const existing = db.prepare("SELECT id FROM roles WHERE name = ?").get(name);
  if (existing) {
    res.status(400).json({ error: "Role name already exists" });
    return;
  }

  const result = db.prepare(
    "INSERT INTO roles (name, description, is_system) VALUES (?, ?, 0)"
  ).run(name, description ?? null);

  const role = db.prepare(`
    SELECT r.*, COUNT(u.id) as user_count
    FROM roles r LEFT JOIN users u ON u.role_id = r.id
    WHERE r.id = ? GROUP BY r.id
  `).get(result.lastInsertRowid) as {
    id: number; name: string; description: string | null;
    is_system: number; user_count: number; created_at: string;
  };

  res.status(201).json(formatRole(role));
});

router.get("/roles/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetRoleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const role = db.prepare(`
    SELECT r.*, COUNT(u.id) as user_count
    FROM roles r LEFT JOIN users u ON u.role_id = r.id
    WHERE r.id = ? GROUP BY r.id
  `).get(params.data.id) as {
    id: number; name: string; description: string | null;
    is_system: number; user_count: number; created_at: string;
  } | undefined;

  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  res.json(formatRole(role));
});

router.patch("/roles/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateRoleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = db.prepare("SELECT * FROM roles WHERE id = ?").get(params.data.id) as {
    id: number; is_system: number;
  } | undefined;

  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  const { name, description } = parsed.data;

  if (name && name !== (db.prepare("SELECT name FROM roles WHERE id = ?").get(params.data.id) as { name: string })?.name) {
    const conflict = db.prepare("SELECT id FROM roles WHERE name = ? AND id != ?").get(name, params.data.id);
    if (conflict) {
      res.status(400).json({ error: "Role name already taken" });
      return;
    }
  }

  db.prepare(`
    UPDATE roles SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(name ?? null, description !== undefined ? description : null, params.data.id);

  const updated = db.prepare(`
    SELECT r.*, COUNT(u.id) as user_count
    FROM roles r LEFT JOIN users u ON u.role_id = r.id
    WHERE r.id = ? GROUP BY r.id
  `).get(params.data.id) as {
    id: number; name: string; description: string | null;
    is_system: number; user_count: number; created_at: string;
  };

  res.json(formatRole(updated));
});

router.delete("/roles/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteRoleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const existing = db.prepare("SELECT * FROM roles WHERE id = ?").get(params.data.id) as {
    id: number; is_system: number; name: string;
  } | undefined;

  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  if (existing.is_system === 1) {
    res.status(400).json({ error: "Cannot delete system roles" });
    return;
  }

  const userCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role_id = ?").get(params.data.id) as { count: number }).count;
  if (userCount > 0) {
    res.status(400).json({ error: "Cannot delete role with assigned users" });
    return;
  }

  db.prepare("DELETE FROM roles WHERE id = ?").run(params.data.id);
  res.json({ message: "Role deleted successfully" });
});

export default router;
