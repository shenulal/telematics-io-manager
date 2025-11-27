import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { getAuthUser } from '@/lib/authMiddleware';
import { createAuditLog, getClientIP, getUserAgent, ModuleNames, ActionTypes } from '@/lib/auditLog';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ success: false, error: 'All fields are required' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, error: 'New passwords do not match' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, error: 'New password must be at least 6 characters' }, { status: 400 });
    }

    const pool = await getConnection();

    // Get current password hash
    const userResult = await pool.request()
      .input('UserID', user.userId)
      .query('SELECT PasswordHash FROM Users WHERE UserID = @UserID AND IsActive = 1');

    if (userResult.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const storedHash = userResult.recordset[0].PasswordHash;

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, storedHash);
    if (!isValidPassword) {
      return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 });
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(newPassword);

    await pool.request()
      .input('UserID', user.userId)
      .input('PasswordHash', newPasswordHash)
      .query('UPDATE Users SET PasswordHash = @PasswordHash, UpdatedAt = GETDATE() WHERE UserID = @UserID');

    // Create audit log
    await createAuditLog({
      UserID: user.userId,
      Username: user.username,
      Action: ActionTypes.UPDATE,
      Module: ModuleNames.USERS,
      RecordID: user.userId.toString(),
      RecordDescription: `Password changed for user: ${user.username}`,
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ success: false, error: 'Failed to change password' }, { status: 500 });
  }
}

