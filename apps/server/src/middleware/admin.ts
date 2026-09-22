import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { ErrorCode } from '@rummy/shared';

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      code: ErrorCode.FORBIDDEN,
      message: 'Access denied: Administrator role required'
    });
  }

  return next();
}
