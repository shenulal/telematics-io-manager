import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, getRefreshToken } from '@/lib/auth';
import { getAuthUser } from '@/lib/authMiddleware';
import { createAuditLog, getClientIP, getUserAgent, ModuleNames, ActionTypes } from '@/lib/auditLog';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    // Revoke refresh token in database
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      const pool = await getConnection();
      await pool.request()
        .input('Token', refreshToken)
        .query(`UPDATE RefreshTokens SET RevokedAt = GETDATE() WHERE Token = @Token`);
    }

    // Clear cookies
    await clearAuthCookies();

    // Audit log
    if (user) {
      await createAuditLog({
        UserID: user.userId,
        Username: user.username,
        Action: ActionTypes.LOGOUT,
        Module: ModuleNames.AUTH,
        RecordDescription: `User ${user.username} logged out`,
        IPAddress: getClientIP(request.headers),
        UserAgent: getUserAgent(request.headers),
      });
    }

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

