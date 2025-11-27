import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { verifyPassword, generateAccessToken, generateRefreshToken, setAuthCookies, generateRandomToken } from '@/lib/auth';
import { createAuditLog, getClientIP, getUserAgent, ModuleNames, ActionTypes } from '@/lib/auditLog';
import { LoginRequest, AuthUser } from '@/types/models';

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username and password are required' }, { status: 400 });
    }

    const pool = await getConnection();
    
    // Get user with password hash
    const userResult = await pool.request()
      .input('Username', username)
      .query(`
        SELECT u.*, STRING_AGG(r.RoleName, ', ') as RoleNames
        FROM Users u
        LEFT JOIN UserRoles ur ON u.UserID = ur.UserID
        LEFT JOIN Roles r ON ur.RoleID = r.RoleID
        WHERE u.Username = @Username
        GROUP BY u.UserID, u.Username, u.Email, u.PasswordHash, u.FirstName, u.LastName, u.IsActive, u.CreatedAt, u.UpdatedAt, u.LastLoginAt
      `);

    if (userResult.recordset.length === 0) {
      await createAuditLog({
        Action: ActionTypes.LOGIN_FAILED,
        Module: ModuleNames.AUTH,
        RecordDescription: `Failed login attempt for username: ${username}`,
        IPAddress: getClientIP(request.headers),
        UserAgent: getUserAgent(request.headers),
      });
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    const user = userResult.recordset[0];

    if (!user.IsActive) {
      await createAuditLog({
        Action: ActionTypes.LOGIN_FAILED,
        Module: ModuleNames.AUTH,
        RecordDescription: `Login attempt for inactive user: ${username}`,
        IPAddress: getClientIP(request.headers),
        UserAgent: getUserAgent(request.headers),
      });
      return NextResponse.json({ success: false, error: 'Account is inactive' }, { status: 401 });
    }

    const isValidPassword = await verifyPassword(password, user.PasswordHash);
    if (!isValidPassword) {
      await createAuditLog({
        Action: ActionTypes.LOGIN_FAILED,
        Module: ModuleNames.AUTH,
        UserID: user.UserID,
        Username: user.Username,
        RecordDescription: `Invalid password for user: ${username}`,
        IPAddress: getClientIP(request.headers),
        UserAgent: getUserAgent(request.headers),
      });
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    // Get user permissions
    const permResult = await pool.request()
      .input('UserID', user.UserID)
      .query(`
        SELECT DISTINCT p.PermissionName FROM Permissions p
        JOIN RolePermissions rp ON p.PermissionID = rp.PermissionID
        JOIN UserRoles ur ON rp.RoleID = ur.RoleID
        WHERE ur.UserID = @UserID
      `);

    const permissions = permResult.recordset.map((r: { PermissionName: string }) => r.PermissionName);
    const roles = user.RoleNames ? user.RoleNames.split(', ') : [];

    // Generate tokens
    const tokenPayload = { userId: user.UserID, username: user.Username, email: user.Email };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const dbRefreshToken = generateRandomToken();

    // Store refresh token in database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await pool.request()
      .input('UserID', user.UserID)
      .input('Token', dbRefreshToken)
      .input('ExpiresAt', expiresAt)
      .query(`INSERT INTO RefreshTokens (UserID, Token, ExpiresAt) VALUES (@UserID, @Token, @ExpiresAt)`);

    // Update last login
    await pool.request()
      .input('UserID', user.UserID)
      .query(`UPDATE Users SET LastLoginAt = GETDATE() WHERE UserID = @UserID`);

    // Set cookies
    await setAuthCookies(accessToken, refreshToken);

    // Audit log
    await createAuditLog({
      UserID: user.UserID,
      Username: user.Username,
      Action: ActionTypes.LOGIN,
      Module: ModuleNames.AUTH,
      RecordDescription: `User ${username} logged in`,
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    const authUser: AuthUser = {
      UserID: user.UserID,
      Username: user.Username,
      Email: user.Email,
      FirstName: user.FirstName,
      LastName: user.LastName,
      IsActive: user.IsActive,
      Roles: roles,
      Permissions: permissions,
    };

    return NextResponse.json({ 
      success: true, 
      data: { user: authUser, accessToken, refreshToken, permissions } 
    });
  } catch (error) {
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}

