import { getConnection } from './db';
import { AuditLogCreate } from '@/types/models';

export async function createAuditLog(log: AuditLogCreate): Promise<void> {
  try {
    const pool = await getConnection();
    await pool.request()
      .input('UserID', log.UserID || null)
      .input('Username', log.Username || null)
      .input('Action', log.Action)
      .input('Module', log.Module)
      .input('RecordID', log.RecordID || null)
      .input('RecordDescription', log.RecordDescription || null)
      .input('OldValue', log.OldValue || null)
      .input('NewValue', log.NewValue || null)
      .input('IPAddress', log.IPAddress || null)
      .input('UserAgent', log.UserAgent || null)
      .query(`
        INSERT INTO [dbo].[AuditLogs] 
        (UserID, Username, Action, Module, RecordID, RecordDescription, OldValue, NewValue, IPAddress, UserAgent)
        VALUES (@UserID, @Username, @Action, @Module, @RecordID, @RecordDescription, @OldValue, @NewValue, @IPAddress, @UserAgent)
      `);
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

// Helper to get client IP from request headers
export function getClientIP(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
         headers.get('x-real-ip') || 
         'unknown';
}

// Helper to get user agent from request headers
export function getUserAgent(headers: Headers): string {
  return headers.get('user-agent') || 'unknown';
}

// Helper to sanitize object for JSON storage (remove sensitive data)
export function sanitizeForAudit(obj: Record<string, unknown>): string {
  const sanitized = { ...obj };
  // Remove sensitive fields
  delete sanitized.Password;
  delete sanitized.PasswordHash;
  delete sanitized.accessToken;
  delete sanitized.refreshToken;
  return JSON.stringify(sanitized);
}

// Module name mappings
export const ModuleNames = {
  VENDORS: 'Vendors',
  PRODUCTS: 'Products',
  IO_UNIVERSAL: 'IOUniversal',
  IO_MAPPING: 'IOMapping',
  USERS: 'Users',
  ROLES: 'Roles',
  AUTH: 'Auth',
  AUDIT: 'AuditLogs',
} as const;

// Action types
export const ActionTypes = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
} as const;

