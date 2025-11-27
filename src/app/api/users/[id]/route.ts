import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requirePermission, Permissions } from '@/lib/authMiddleware';
import { createAuditLog, getClientIP, getUserAgent, sanitizeForAudit, ModuleNames, ActionTypes } from '@/lib/auditLog';
import { UserUpdate } from '@/types/models';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, user } = await requirePermission(request, Permissions.USERS_READ);
  if (response) return response;

  try {
    const { id } = await params;
    const pool = await getConnection();

    const result = await pool.request()
      .input('UserID', parseInt(id))
      .query(`
        SELECT u.UserID, u.Username, u.Email, u.FirstName, u.LastName, u.IsActive, u.CreatedAt, u.UpdatedAt, u.LastLoginAt
        FROM Users u WHERE u.UserID = @UserID
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Get user roles
    const rolesResult = await pool.request()
      .input('UserID', parseInt(id))
      .query(`SELECT r.RoleID, r.RoleName FROM Roles r JOIN UserRoles ur ON r.RoleID = ur.RoleID WHERE ur.UserID = @UserID`);

    const userData = { ...result.recordset[0], Roles: rolesResult.recordset };
    return NextResponse.json({ success: true, data: userData });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, user } = await requirePermission(request, Permissions.USERS_UPDATE);
  if (response) return response;

  try {
    const { id } = await params;
    const body: UserUpdate = await request.json();
    const { Email, Password, FirstName, LastName, IsActive, RoleIds } = body;

    const pool = await getConnection();

    // Get old values for audit
    const oldResult = await pool.request()
      .input('UserID', parseInt(id))
      .query(`SELECT * FROM Users WHERE UserID = @UserID`);

    if (oldResult.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const oldUser = oldResult.recordset[0];

    // Build update query
    const updates: string[] = ['UpdatedAt = GETDATE()'];
    const req = pool.request().input('UserID', parseInt(id));

    if (Email !== undefined) { updates.push('Email = @Email'); req.input('Email', Email); }
    if (FirstName !== undefined) { updates.push('FirstName = @FirstName'); req.input('FirstName', FirstName); }
    if (LastName !== undefined) { updates.push('LastName = @LastName'); req.input('LastName', LastName); }
    if (IsActive !== undefined) { updates.push('IsActive = @IsActive'); req.input('IsActive', IsActive); }
    if (Password) {
      const passwordHash = await hashPassword(Password);
      updates.push('PasswordHash = @PasswordHash');
      req.input('PasswordHash', passwordHash);
    }

    await req.query(`UPDATE Users SET ${updates.join(', ')} WHERE UserID = @UserID`);

    // Update roles if provided
    if (RoleIds !== undefined) {
      await pool.request().input('UserID', parseInt(id)).query(`DELETE FROM UserRoles WHERE UserID = @UserID`);
      for (const roleId of RoleIds) {
        await pool.request()
          .input('UserID', parseInt(id))
          .input('RoleID', roleId)
          .query(`INSERT INTO UserRoles (UserID, RoleID) VALUES (@UserID, @RoleID)`);
      }
    }

    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.UPDATE,
      Module: ModuleNames.USERS,
      RecordID: id,
      RecordDescription: `Updated user: ${oldUser.Username}`,
      OldValue: sanitizeForAudit(oldUser),
      NewValue: sanitizeForAudit({ Email, FirstName, LastName, IsActive, RoleIds }),
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { response, user } = await requirePermission(request, Permissions.USERS_DELETE);
  if (response) return response;

  try {
    const { id } = await params;
    const pool = await getConnection();

    const oldResult = await pool.request()
      .input('UserID', parseInt(id))
      .query(`SELECT * FROM Users WHERE UserID = @UserID`);

    if (oldResult.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const oldUser = oldResult.recordset[0];

    // Prevent deleting admin user
    if (oldUser.Username === 'admin') {
      return NextResponse.json({ success: false, error: 'Cannot delete admin user' }, { status: 400 });
    }

    await pool.request().input('UserID', parseInt(id)).query(`DELETE FROM Users WHERE UserID = @UserID`);

    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.DELETE,
      Module: ModuleNames.USERS,
      RecordID: id,
      RecordDescription: `Deleted user: ${oldUser.Username}`,
      OldValue: sanitizeForAudit(oldUser),
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 });
  }
}

