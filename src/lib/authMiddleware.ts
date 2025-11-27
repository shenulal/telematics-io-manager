import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from './auth';
import { getConnection } from './db';

export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload & { permissions: string[] };
}

// Verify token from Authorization header or cookie
export async function getAuthUser(request: NextRequest): Promise<(TokenPayload & { permissions: string[] }) | null> {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  // Fall back to cookie
  if (!token) {
    token = request.cookies.get('accessToken')?.value || null;
  }
  
  if (!token) return null;
  
  const payload = verifyToken(token);
  if (!payload) return null;
  
  // Get user permissions from database
  try {
    const pool = await getConnection();
    const result = await pool.request()
      .input('UserID', payload.userId)
      .query(`
        SELECT DISTINCT p.PermissionName
        FROM Users u
        JOIN UserRoles ur ON u.UserID = ur.UserID
        JOIN RolePermissions rp ON ur.RoleID = rp.RoleID
        JOIN Permissions p ON rp.PermissionID = p.PermissionID
        WHERE u.UserID = @UserID AND u.IsActive = 1
      `);
    
    const permissions = result.recordset.map((r: { PermissionName: string }) => r.PermissionName);
    return { ...payload, permissions };
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return null;
  }
}

// Middleware to require authentication
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

// Middleware to require specific permission
export async function requirePermission(
  request: NextRequest,
  permission: string
): Promise<{ response?: NextResponse; user?: TokenPayload & { permissions: string[] } }> {
  const user = await getAuthUser(request);
  
  if (!user) {
    return { response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  
  if (!user.permissions.includes(permission)) {
    return { response: NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions' }, { status: 403 }) };
  }
  
  return { user };
}

// Check if user has any of the specified permissions
export async function hasAnyPermission(
  request: NextRequest,
  permissions: string[]
): Promise<{ response?: NextResponse; user?: TokenPayload & { permissions: string[] } }> {
  const user = await getAuthUser(request);
  
  if (!user) {
    return { response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  
  const hasPermission = permissions.some(p => user.permissions.includes(p));
  if (!hasPermission) {
    return { response: NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions' }, { status: 403 }) };
  }
  
  return { user };
}

// Permission constants for easy reference
export const Permissions = {
  // Vendors
  VENDORS_CREATE: 'vendors.create',
  VENDORS_READ: 'vendors.read',
  VENDORS_UPDATE: 'vendors.update',
  VENDORS_DELETE: 'vendors.delete',
  VENDORS_EXPORT: 'vendors.export',
  VENDORS_IMPORT: 'vendors.import',
  // Products
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_READ: 'products.read',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  PRODUCTS_EXPORT: 'products.export',
  PRODUCTS_IMPORT: 'products.import',
  // IO Universal
  IO_UNIVERSAL_CREATE: 'io-universal.create',
  IO_UNIVERSAL_READ: 'io-universal.read',
  IO_UNIVERSAL_UPDATE: 'io-universal.update',
  IO_UNIVERSAL_DELETE: 'io-universal.delete',
  IO_UNIVERSAL_EXPORT: 'io-universal.export',
  IO_UNIVERSAL_IMPORT: 'io-universal.import',
  // IO Mappings
  IO_MAPPINGS_CREATE: 'io-mappings.create',
  IO_MAPPINGS_READ: 'io-mappings.read',
  IO_MAPPINGS_UPDATE: 'io-mappings.update',
  IO_MAPPINGS_DELETE: 'io-mappings.delete',
  IO_MAPPINGS_EXPORT: 'io-mappings.export',
  IO_MAPPINGS_IMPORT: 'io-mappings.import',
  // Users
  USERS_CREATE: 'users.create',
  USERS_READ: 'users.read',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  // Roles
  ROLES_CREATE: 'roles.create',
  ROLES_READ: 'roles.read',
  ROLES_UPDATE: 'roles.update',
  ROLES_DELETE: 'roles.delete',
  // Audit
  AUDIT_READ: 'audit_logs.read',
} as const;

