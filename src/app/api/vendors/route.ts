import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, sql } from '@/lib/db';
import { Vendor, VendorCreate, ApiResponse } from '@/types/models';

// GET all vendors
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';
    
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT VendorID, VendorName, Country, Website
      FROM Vendor
      WHERE 1=1
    `;
    
    const params: Record<string, unknown> = {};
    
    if (search) {
      query += ` AND (VendorName LIKE @search OR Country LIKE @search)`;
      params.search = `%${search}%`;
    }
    
    // Get total count
    const countQuery = query.replace('SELECT VendorID, VendorName, Country, Website', 'SELECT COUNT(*) as total');
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = countResult[0]?.total || 0;
    
    // Get paginated results
    query += ` ORDER BY VendorName OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;
    params.offset = offset;
    params.pageSize = pageSize;
    
    const vendors = await executeQuery<Vendor>(query, params);
    
    return NextResponse.json({
      success: true,
      data: vendors,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendors' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// POST create new vendor
export async function POST(request: NextRequest) {
  try {
    const body: VendorCreate = await request.json();
    
    if (!body.VendorName) {
      return NextResponse.json(
        { success: false, error: 'VendorName is required' } as ApiResponse<null>,
        { status: 400 }
      );
    }
    
    const query = `
      INSERT INTO Vendor (VendorName, Country, Website)
      OUTPUT INSERTED.*
      VALUES (@VendorName, @Country, @Website)
    `;
    
    const result = await executeQuery<Vendor>(query, {
      VendorName: body.VendorName,
      Country: body.Country || null,
      Website: body.Website || null
    });
    
    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Vendor created successfully'
    } as ApiResponse<Vendor>);
  } catch (error) {
    console.error('Error creating vendor:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create vendor' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

