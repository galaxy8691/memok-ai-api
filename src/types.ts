import type { Request } from "express";

export interface ValidatedRequest<TBody = unknown, TQuery = unknown>
  extends Request {
  validatedBody?: TBody;
  validatedQuery?: TQuery;
}
