import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { getAuthUser } from '@/lib/authMiddleware';

export async function GET(request: NextRequest) {
  // Check if user is authenticated and is an Administrator
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Allow access if user has audit_logs.read permission or has admin permissions (users/roles management)
  const hasPermission = user.permissions.includes('audit_logs.read');
  const isAdmin = user.permissions.some(p => p.startsWith('users.') || p.startsWith('roles.'));

  if (!hasPermission && !isAdmin) {
    return NextResponse.json({ success: false, error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '25');
    const search = searchParams.get('search') || '';
    const module = searchParams.get('module') || '';
    const action = searchParams.get('action') || '';
    const userId = searchParams.get('userId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const offset = (page - 1) * pageSize;

    const pool = await getConnection();
    
    // Build where clause
    const conditions: string[] = [];
    const req = pool.request()
      .input('Offset', offset)
      .input('PageSize', pageSize);

    if (search) {
      conditions.push(`(a.Username LIKE '%' + @Search + '%' OR a.RecordDescription LIKE '%' + @Search + '%' OR a.RecordID LIKE '%' + @Search + '%')`);
      req.input('Search', search);
    }
    if (module) {
      conditions.push(`a.Module = @Module`);
      req.input('Module', module);
    }
    if (action) {
      conditions.push(`a.Action = @Action`);
      req.input('Action', action);
    }
    if (userId) {
      conditions.push(`a.UserID = @UserID`);
      req.input('UserID', parseInt(userId));
    }
    if (dateFrom) {
      conditions.push(`CAST(a.Timestamp AS DATE) >= CAST(@DateFrom AS DATE)`);
      req.input('DateFrom', dateFrom);
    }
    if (dateTo) {
      conditions.push(`CAST(a.Timestamp AS DATE) <= CAST(@DateTo AS DATE)`);
      req.input('DateTo', dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countReq = pool.request();
    if (search) countReq.input('Search', search);
    if (module) countReq.input('Module', module);
    if (action) countReq.input('Action', action);
    if (userId) countReq.input('UserID', parseInt(userId));
    if (dateFrom) countReq.input('DateFrom', dateFrom);
    if (dateTo) countReq.input('DateTo', dateTo);

    const countResult = await countReq.query(`SELECT COUNT(*) as total FROM AuditLogs a ${whereClause}`);

    const result = await req.query(`
      SELECT a.AuditLogID, a.UserID, a.Username, a.Action, a.Module, a.RecordID, a.RecordDescription,
             a.OldValue, a.NewValue, a.IPAddress, a.UserAgent, a.Timestamp
      FROM AuditLogs a
      ${whereClause}
      ORDER BY a.Timestamp DESC
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
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

