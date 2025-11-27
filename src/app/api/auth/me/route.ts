import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/authMiddleware';
import { getConnection } from '@/lib/db';
import { AuthUser } from '@/types/models';

export async function GET(request: NextRequest) {
  try {
    const tokenUser = await getAuthUser(request);
    
    if (!tokenUser) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const pool = await getConnection();
    
    // Get full user info
    const userResult = await pool.request()
      .input('UserID', tokenUser.userId)
      .query(`
        SELECT u.UserID, u.Username, u.Email, u.FirstName, u.LastName, u.IsActive,
               STRING_AGG(r.RoleName, ', ') as RoleNames
        FROM Users u
        LEFT JOIN UserRoles ur ON u.UserID = ur.UserID
        LEFT JOIN Roles r ON ur.RoleID = r.RoleID
        WHERE u.UserID = @UserID AND u.IsActive = 1
        GROUP BY u.UserID, u.Username, u.Email, u.FirstName, u.LastName, u.IsActive
      `);

    if (userResult.recordset.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const user = userResult.recordset[0];
    const roles = user.RoleNames ? user.RoleNames.split(', ') : [];

    const authUser: AuthUser = {
      UserID: user.UserID,
      Username: user.Username,
      Email: user.Email,
      FirstName: user.FirstName,
      LastName: user.LastName,
      IsActive: user.IsActive,
      Roles: roles,
      Permissions: tokenUser.permissions,
    };

    return NextResponse.json({ success: true, data: authUser });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

