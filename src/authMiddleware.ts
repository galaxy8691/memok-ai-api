import { Request, Response, NextFunction } from "express";
import { isPasswordSet } from "./auth.js";

export interface AuthRequest extends Request {
  session: Request["session"] & {
    authenticated?: boolean;
  };
}

const ALWAYS_PUBLIC = [
  "/health",
  "/openapi.json",
  "/api-docs",
  "/metrics",
  "/api/health",
  "/api/setup-status",
];

function isApiPath(path: string): boolean {
  return path.startsWith("/api/") || path.startsWith("/v1/");
}

const SETUP_PUBLIC = [
  "/api/setup",
  "/api/login",
];

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  if (ALWAYS_PUBLIC.includes(req.path) || req.path.startsWith("/v1/")) {
    next();
    return;
  }

  if (!isPasswordSet()) {
    if (SETUP_PUBLIC.includes(req.path)) {
      next();
      return;
    }
    if (req.path === "/" || req.path === "/setup") {
      next();
      return;
    }
    if (isApiPath(req.path)) {
      res.status(403).json({ error: "Password not initialized" });
      return;
    }
    res.redirect("/");
    return;
  }

  if (req.session.authenticated) {
    next();
    return;
  }

  if (req.path === "/login" || req.path === "/api/login") {
    next();
    return;
  }

  if (isApiPath(req.path)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.redirect("/login");
}

export function redirectIfAuthenticated(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.session.authenticated) {
    res.redirect("/");
    return;
  }
  next();
}

export function redirectIfSetupComplete(_req: AuthRequest, res: Response, next: NextFunction): void {
  if (isPasswordSet()) {
    res.redirect("/login");
    return;
  }
  next();
}
