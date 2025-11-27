import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requirePermission, Permissions } from '@/lib/authMiddleware';
import { createAuditLog, getClientIP, getUserAgent, sanitizeForAudit, ModuleNames, ActionTypes } from '@/lib/auditLog';
import { UserCreate } from '@/types/models';

export async function GET(request: NextRequest) {
  const { response, user } = await requirePermission(request, Permissions.USERS_READ);
  if (response) return response;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * pageSize;

    const pool = await getConnection();

    let whereClause = '';
    if (search) {
      whereClause = `WHERE u.Username LIKE '%' + @Search + '%' OR u.Email LIKE '%' + @Search + '%' OR u.FirstName LIKE '%' + @Search + '%' OR u.LastName LIKE '%' + @Search + '%'`;
    }

    const countResult = await pool.request()
      .input('Search', search)
      .query(`SELECT COUNT(*) as total FROM Users u ${whereClause}`);

    const result = await pool.request()
      .input('Search', search)
      .input('Offset', offset)
      .input('PageSize', pageSize)
      .query(`
        SELECT u.UserID, u.Username, u.Email, u.FirstName, u.LastName, u.IsActive, u.CreatedAt, u.UpdatedAt, u.LastLoginAt,
               STRING_AGG(r.RoleName, ', ') as RoleNames
        FROM Users u
        LEFT JOIN UserRoles ur ON u.UserID = ur.UserID
        LEFT JOIN Roles r ON ur.RoleID = r.RoleID
        ${whereClause}
        GROUP BY u.UserID, u.Username, u.Email, u.FirstName, u.LastName, u.IsActive, u.CreatedAt, u.UpdatedAt, u.LastLoginAt
        ORDER BY u.Username
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
      `);

    const total = countResult.recordset[0].total;
    return NextResponse.json({
      success: true,
      data: result.recordset,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requirePermission(request, Permissions.USERS_CREATE);
  if (response) return response;

  try {
    const body: UserCreate = await request.json();
    const { Username, Email, Password, FirstName, LastName, IsActive = true, RoleIds = [] } = body;

    if (!Username || !Email || !Password) {
      return NextResponse.json({ success: false, error: 'Username, Email, and Password are required' }, { status: 400 });
    }

    const pool = await getConnection();

    // Check for duplicates
    const existingUser = await pool.request()
      .input('Username', Username)
      .input('Email', Email)
      .query(`SELECT UserID FROM Users WHERE Username = @Username OR Email = @Email`);

    if (existingUser.recordset.length > 0) {
      return NextResponse.json({ success: false, error: 'Username or Email already exists' }, { status: 400 });
    }

    const passwordHash = await hashPassword(Password);

    const result = await pool.request()
      .input('Username', Username)
      .input('Email', Email)
      .input('PasswordHash', passwordHash)
      .input('FirstName', FirstName || null)
      .input('LastName', LastName || null)
      .input('IsActive', IsActive)
      .query(`
        INSERT INTO Users (Username, Email, PasswordHash, FirstName, LastName, IsActive)
        OUTPUT INSERTED.UserID
        VALUES (@Username, @Email, @PasswordHash, @FirstName, @LastName, @IsActive)
      `);

    const newUserId = result.recordset[0].UserID;

    // Assign roles
    for (const roleId of RoleIds) {
      await pool.request()
        .input('UserID', newUserId)
        .input('RoleID', roleId)
        .query(`INSERT INTO UserRoles (UserID, RoleID) VALUES (@UserID, @RoleID)`);
    }

    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.CREATE,
      Module: ModuleNames.USERS,
      RecordID: newUserId.toString(),
      RecordDescription: `Created user: ${Username}`,
      NewValue: sanitizeForAudit({ Username, Email, FirstName, LastName, IsActive, RoleIds }),
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({ success: true, data: { UserID: newUserId } }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
  }
}

