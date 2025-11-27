import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requirePermission, Permissions } from '@/lib/authMiddleware';
import { Permission } from '@/types/models';

export async function GET(request: NextRequest) {
  const { response } = await requirePermission(request, Permissions.ROLES_READ);
  if (response) return response;

  try {
    const pool = await getConnection();

    const result = await pool.request()
      .query(`
        SELECT PermissionID, PermissionName, Description, Module, Action
        FROM Permissions
        ORDER BY Module, Action
      `);

    const permissions = result.recordset as Permission[];

    // Group permissions by module
    const grouped = permissions.reduce((acc: Record<string, Permission[]>, perm) => {
      if (!acc[perm.Module]) {
        acc[perm.Module] = [];
      }
      acc[perm.Module].push(perm);
      return acc;
    }, {});

    return NextResponse.json({ success: true, data: permissions, grouped });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch permissions' }, { status: 500 });
  }
}

