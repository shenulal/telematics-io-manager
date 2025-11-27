import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requirePermission, Permissions } from '@/lib/authMiddleware';
import { createAuditLog, getClientIP, getUserAgent, sanitizeForAudit, ModuleNames, ActionTypes } from '@/lib/auditLog';
import { RoleUpdate } from '@/types/models';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requirePermission(request, Permissions.ROLES_READ);
  if (response) return response;

  try {
    const { id } = await params;
    const pool = await getConnection();

    const result = await pool.request()
      .input('RoleID', parseInt(id))
      .query(`SELECT * FROM Roles WHERE RoleID = @RoleID`);

    if (result.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }

    // Get role permissions
    const permsResult = await pool.request()
      .input('RoleID', parseInt(id))
      .query(`SELECT p.* FROM Permissions p JOIN RolePermissions rp ON p.PermissionID = rp.PermissionID WHERE rp.RoleID = @RoleID`);

    const roleData = { ...result.recordset[0], Permissions: permsResult.recordset, PermissionIds: permsResult.recordset.map((p: { PermissionID: number }) => p.PermissionID) };
    return NextResponse.json({ success: true, data: roleData });
  } catch (error) {
    console.error('Error fetching role:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch role' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, user } = await requirePermission(request, Permissions.ROLES_UPDATE);
  if (response) return response;

  try {
    const { id } = await params;
    const body: RoleUpdate = await request.json();
    const { RoleName, Description, PermissionIds } = body;

    const pool = await getConnection();

    const oldResult = await pool.request()
      .input('RoleID', parseInt(id))
      .query(`SELECT * FROM Roles WHERE RoleID = @RoleID`);

    if (oldResult.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }

    const oldRole = oldResult.recordset[0];

    // System roles can have permissions changed but not renamed
    if (oldRole.IsSystem && RoleName && RoleName !== oldRole.RoleName) {
      return NextResponse.json({ success: false, error: 'Cannot rename system roles' }, { status: 400 });
    }

    const updates: string[] = [];
    const req = pool.request().input('RoleID', parseInt(id));

    if (RoleName !== undefined) { updates.push('RoleName = @RoleName'); req.input('RoleName', RoleName); }
    if (Description !== undefined) { updates.push('Description = @Description'); req.input('Description', Description); }

    if (updates.length > 0) {
      await req.query(`UPDATE Roles SET ${updates.join(', ')} WHERE RoleID = @RoleID`);
    }

    // Update permissions if provided
    if (PermissionIds !== undefined) {
      await pool.request().input('RoleID', parseInt(id)).query(`DELETE FROM RolePermissions WHERE RoleID = @RoleID`);
      for (const permId of PermissionIds) {
        await pool.request()
          .input('RoleID', parseInt(id))
          .input('PermissionID', permId)
          .query(`INSERT INTO RolePermissions (RoleID, PermissionID) VALUES (@RoleID, @PermissionID)`);
      }
    }

    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.UPDATE,
      Module: ModuleNames.ROLES,
      RecordID: id,
      RecordDescription: `Updated role: ${oldRole.RoleName}`,
      OldValue: sanitizeForAudit(oldRole),
      NewValue: sanitizeForAudit({ RoleName, Description, PermissionIds }),
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({ success: true, message: 'Role updated successfully' });
  } catch (error) {
    console.error('Error updating role:', error);
    return NextResponse.json({ success: false, error: 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, user } = await requirePermission(request, Permissions.ROLES_DELETE);
  if (response) return response;

  try {
    const { id } = await params;
    const pool = await getConnection();

    const oldResult = await pool.request()
      .input('RoleID', parseInt(id))
      .query(`SELECT * FROM Roles WHERE RoleID = @RoleID`);

    if (oldResult.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }

    const oldRole = oldResult.recordset[0];

    if (oldRole.IsSystem) {
      return NextResponse.json({ success: false, error: 'Cannot delete system roles' }, { status: 400 });
    }

    await pool.request().input('RoleID', parseInt(id)).query(`DELETE FROM Roles WHERE RoleID = @RoleID`);

    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.DELETE,
      Module: ModuleNames.ROLES,
      RecordID: id,
      RecordDescription: `Deleted role: ${oldRole.RoleName}`,
      OldValue: sanitizeForAudit(oldRole),
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete role' }, { status: 500 });
  }
}

