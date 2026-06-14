import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "threeninempos-secret-key-change-in-production";
const JWT_EXPIRES_IN = "8h";

export interface JwtPayload {
  userId: number;
  username: string;
  roleId: number;
  roleName: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
