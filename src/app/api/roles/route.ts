import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requirePermission, Permissions } from '@/lib/authMiddleware';
import { createAuditLog, getClientIP, getUserAgent, sanitizeForAudit, ModuleNames, ActionTypes } from '@/lib/auditLog';
import { RoleCreate } from '@/types/models';

export async function GET(request: NextRequest) {
  const { response, user } = await requirePermission(request, Permissions.ROLES_READ);
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
      whereClause = `WHERE r.RoleName LIKE '%' + @Search + '%' OR r.Description LIKE '%' + @Search + '%'`;
    }

    const countResult = await pool.request()
      .input('Search', search)
      .query(`SELECT COUNT(*) as total FROM Roles r ${whereClause}`);

    const result = await pool.request()
      .input('Search', search)
      .input('Offset', offset)
      .input('PageSize', pageSize)
      .query(`
        SELECT r.RoleID, r.RoleName, r.Description, r.IsSystem, r.CreatedAt,
               (SELECT COUNT(*) FROM UserRoles ur WHERE ur.RoleID = r.RoleID) as UserCount
        FROM Roles r
        ${whereClause}
        ORDER BY r.RoleName
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
    console.error('Error fetching roles:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { response, user } = await requirePermission(request, Permissions.ROLES_CREATE);
  if (response) return response;

  try {
    const body: RoleCreate = await request.json();
    const { RoleName, Description, PermissionIds = [] } = body;

    if (!RoleName) {
      return NextResponse.json({ success: false, error: 'Role name is required' }, { status: 400 });
    }

    const pool = await getConnection();

    // Check for duplicate
    const existing = await pool.request()
      .input('RoleName', RoleName)
      .query(`SELECT RoleID FROM Roles WHERE RoleName = @RoleName`);

    if (existing.recordset.length > 0) {
      return NextResponse.json({ success: false, error: 'Role name already exists' }, { status: 400 });
    }

    const result = await pool.request()
      .input('RoleName', RoleName)
      .input('Description', Description || null)
      .query(`
        INSERT INTO Roles (RoleName, Description)
        OUTPUT INSERTED.RoleID
        VALUES (@RoleName, @Description)
      `);

    const newRoleId = result.recordset[0].RoleID;

    // Assign permissions
    for (const permId of PermissionIds) {
      await pool.request()
        .input('RoleID', newRoleId)
        .input('PermissionID', permId)
        .query(`INSERT INTO RolePermissions (RoleID, PermissionID) VALUES (@RoleID, @PermissionID)`);
    }

    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.CREATE,
      Module: ModuleNames.ROLES,
      RecordID: newRoleId.toString(),
      RecordDescription: `Created role: ${RoleName}`,
      NewValue: sanitizeForAudit({ RoleName, Description, PermissionIds }),
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({ success: true, data: { RoleID: newRoleId } }, { status: 201 });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json({ success: false, error: 'Failed to create role' }, { status: 500 });
  }
}

