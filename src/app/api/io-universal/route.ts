import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { IOUniversal, IOUniversalCreate, ApiResponse } from '@/types/models';
import { getAuthUser } from '@/lib/authMiddleware';
import { createAuditLog, getClientIP, getUserAgent, sanitizeForAudit, ModuleNames, ActionTypes } from '@/lib/auditLog';

// GET all IOUniversal entries
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category');
    
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT IOID, IOName, IOCategory, DataType, Unit, Description
      FROM IOUniversal
      WHERE 1=1
    `;
    
    const params: Record<string, unknown> = {};
    
    if (search) {
      query += ` AND (IOName LIKE @search OR IOCategory LIKE @search OR Description LIKE @search)`;
      params.search = `%${search}%`;
    }
    
    if (category) {
      query += ` AND IOCategory = @category`;
      params.category = category;
    }
    
    // Get total count
    const countQuery = query.replace(
      'SELECT IOID, IOName, IOCategory, DataType, Unit, Description',
      'SELECT COUNT(*) as total'
    );
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = countResult[0]?.total || 0;
    
    // Get paginated results
    query += ` ORDER BY IOID OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;
    params.offset = offset;
    params.pageSize = pageSize;
    
    const ioList = await executeQuery<IOUniversal>(query, params);
    
    return NextResponse.json({
      success: true,
      data: ioList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('Error fetching IO Universal entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch IO Universal entries' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// POST create new IOUniversal
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);

  try {
    const body: IOUniversalCreate = await request.json();

    if (!body.IOID) {
      return NextResponse.json(
        { success: false, error: 'IOID is required' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    // Check if IOID already exists
    const existsQuery = `SELECT IOID FROM IOUniversal WHERE IOID = @IOID`;
    const exists = await executeQuery<IOUniversal>(existsQuery, { IOID: body.IOID });

    if (exists.length > 0) {
      return NextResponse.json(
        { success: false, error: 'IOID already exists' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO IOUniversal (IOID, IOName, IOCategory, DataType, Unit, Description)
      OUTPUT INSERTED.*
      VALUES (@IOID, @IOName, @IOCategory, @DataType, @Unit, @Description)
    `;

    const result = await executeQuery<IOUniversal>(query, {
      IOID: body.IOID,
      IOName: body.IOName || null,
      IOCategory: body.IOCategory || null,
      DataType: body.DataType || null,
      Unit: body.Unit || null,
      Description: body.Description || null
    });

    // Audit log
    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.CREATE,
      Module: ModuleNames.IO_UNIVERSAL,
      RecordID: body.IOID.toString(),
      RecordDescription: `Created IO Universal: ${body.IOName || body.IOID}`,
      NewValue: sanitizeForAudit(body as unknown as Record<string, unknown>),
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'IO Universal entry created successfully'
    } as ApiResponse<IOUniversal>);
  } catch (error) {
    console.error('Error creating IO Universal entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create IO Universal entry' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

