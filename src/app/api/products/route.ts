import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { Product, ProductCreate, ApiResponse } from '@/types/models';
import { getAuthUser } from '@/lib/authMiddleware';
import { createAuditLog, getClientIP, getUserAgent, sanitizeForAudit, ModuleNames, ActionTypes } from '@/lib/auditLog';

// GET all products
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';
    const vendorId = searchParams.get('vendorId');
    
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT p.ProductID, p.VendorID, p.ProductName, p.Description, p.TempTypeId,
             v.VendorName
      FROM Product p
      LEFT JOIN Vendor v ON p.VendorID = v.VendorID
      WHERE 1=1
    `;
    
    const params: Record<string, unknown> = {};
    
    if (search) {
      query += ` AND (p.ProductName LIKE @search OR v.VendorName LIKE @search)`;
      params.search = `%${search}%`;
    }
    
    if (vendorId) {
      query += ` AND p.VendorID = @vendorId`;
      params.vendorId = parseInt(vendorId);
    }
    
    // Get total count
    const countQuery = query.replace(
      'SELECT p.ProductID, p.VendorID, p.ProductName, p.Description, p.TempTypeId,\n             v.VendorName',
      'SELECT COUNT(*) as total'
    );
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = countResult[0]?.total || 0;
    
    // Get paginated results
    query += ` ORDER BY p.ProductName OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;
    params.offset = offset;
    params.pageSize = pageSize;
    
    const products = await executeQuery<Product>(query, params);
    
    return NextResponse.json({
      success: true,
      data: products,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// POST create new product
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);

  try {
    const body: ProductCreate = await request.json();

    if (!body.ProductName || !body.VendorID) {
      return NextResponse.json(
        { success: false, error: 'ProductName and VendorID are required' } as ApiResponse<null>,
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO Product (VendorID, ProductName, Description, TempTypeId)
      OUTPUT INSERTED.*
      VALUES (@VendorID, @ProductName, @Description, @TempTypeId)
    `;

    const result = await executeQuery<Product>(query, {
      VendorID: body.VendorID,
      ProductName: body.ProductName,
      Description: body.Description || null,
      TempTypeId: body.TempTypeId || 0
    });

    // Audit log
    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.CREATE,
      Module: ModuleNames.PRODUCTS,
      RecordID: result[0].ProductID.toString(),
      RecordDescription: `Created product: ${body.ProductName}`,
      NewValue: sanitizeForAudit(body as unknown as Record<string, unknown>),
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Product created successfully'
    } as ApiResponse<Product>);
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

