import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { verifyToken, generateAccessToken, generateRefreshToken, setAuthCookies, getRefreshToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookie
    const refreshToken = await getRefreshToken();
    
    if (!refreshToken) {
      return NextResponse.json({ success: false, error: 'Refresh token not found' }, { status: 401 });
    }

    // Verify the token
    const payload = verifyToken(refreshToken);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Invalid refresh token' }, { status: 401 });
    }

    const pool = await getConnection();
    
    // Check if user still exists and is active
    const userResult = await pool.request()
      .input('UserID', payload.userId)
      .query(`SELECT UserID, Username, Email, IsActive FROM Users WHERE UserID = @UserID`);

    if (userResult.recordset.length === 0 || !userResult.recordset[0].IsActive) {
      return NextResponse.json({ success: false, error: 'User not found or inactive' }, { status: 401 });
    }

    const user = userResult.recordset[0];

    // Generate new tokens
    const tokenPayload = { userId: user.UserID, username: user.Username, email: user.Email };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    // Set new cookies
    await setAuthCookies(newAccessToken, newRefreshToken);

    return NextResponse.json({ 
      success: true, 
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken } 
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

