import type { Request, Response, NextFunction } from "express";

type AsyncRouteHandler = (
  req: Request<Record<string, string>>,
  res: Response,
  next: NextFunction
) => Promise<void>;

export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req as Request<Record<string, string>>, res, next).catch(next);
  };
}
