import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { IOMapping, IOMappingCreate, ApiResponse } from '@/types/models';

// GET all IO mappings
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const search = searchParams.get('search') || '';
    const vendorId = searchParams.get('vendorId');
    const productId = searchParams.get('productId');
    const ioId = searchParams.get('ioId');
    
    const offset = (page - 1) * pageSize;
    
    let query = `
      SELECT m.MappingID, m.VendorID, m.ProductID, m.IOID, m.IOCode, m.IOName,
             m.Bytes, m.MinValue, m.MaxValue, m.Multiplier, m.[Offset], m.Unit,
             m.ErrorValues, m.ConversionFormula, m.Averaging, m.EventOnChange,
             m.EventOnHysterisis, m.ParameterGroup, m.Description, m.RawValueJson,
             v.VendorName, p.ProductName, u.IOName as UniversalIOName
      FROM IOMapping m
      LEFT JOIN Vendor v ON m.VendorID = v.VendorID
      LEFT JOIN Product p ON m.ProductID = p.ProductID
      LEFT JOIN IOUniversal u ON m.IOID = u.IOID
      WHERE 1=1
    `;
    
    const params: Record<string, unknown> = {};
    
    if (search) {
      query += ` AND (m.IOName LIKE @search OR m.IOCode LIKE @search OR m.ParameterGroup LIKE @search)`;
      params.search = `%${search}%`;
    }
    
    if (vendorId) {
      query += ` AND m.VendorID = @vendorId`;
      params.vendorId = parseInt(vendorId);
    }
    
    if (productId) {
      query += ` AND m.ProductID = @productId`;
      params.productId = parseInt(productId);
    }
    
    if (ioId) {
      query += ` AND m.IOID = @ioId`;
      params.ioId = parseInt(ioId);
    }
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM IOMapping m
      LEFT JOIN Vendor v ON m.VendorID = v.VendorID
      LEFT JOIN Product p ON m.ProductID = p.ProductID
      LEFT JOIN IOUniversal u ON m.IOID = u.IOID
      WHERE 1=1` + (search ? ` AND (m.IOName LIKE @search OR m.IOCode LIKE @search)` : '') +
      (vendorId ? ` AND m.VendorID = @vendorId` : '') +
      (productId ? ` AND m.ProductID = @productId` : '') +
      (ioId ? ` AND m.IOID = @ioId` : '');
    
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = countResult[0]?.total || 0;
    
    query += ` ORDER BY m.MappingID OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;
    params.offset = offset;
    params.pageSize = pageSize;
    
    const mappings = await executeQuery<IOMapping>(query, params);
    
    return NextResponse.json({
      success: true,
      data: mappings,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('Error fetching IO mappings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch IO mappings' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// POST create new IO mapping
export async function POST(request: NextRequest) {
  try {
    const body: IOMappingCreate = await request.json();
    
    if (!body.IOID) {
      return NextResponse.json(
        { success: false, error: 'IOID is required' } as ApiResponse<null>,
        { status: 400 }
      );
    }
    
    const query = `
      INSERT INTO IOMapping (VendorID, ProductID, IOID, IOCode, IOName, Bytes,
        MinValue, MaxValue, Multiplier, [Offset], Unit, ErrorValues, ConversionFormula,
        Averaging, EventOnChange, EventOnHysterisis, ParameterGroup, Description, RawValueJson)
      OUTPUT INSERTED.*
      VALUES (@VendorID, @ProductID, @IOID, @IOCode, @IOName, @Bytes,
        @MinValue, @MaxValue, @Multiplier, @Offset, @Unit, @ErrorValues, @ConversionFormula,
        @Averaging, @EventOnChange, @EventOnHysterisis, @ParameterGroup, @Description, @RawValueJson)
    `;
    
    const result = await executeQuery<IOMapping>(query, {
      VendorID: body.VendorID || null,
      ProductID: body.ProductID || null,
      IOID: body.IOID,
      IOCode: body.IOCode || null,
      IOName: body.IOName || null,
      Bytes: body.Bytes || null,
      MinValue: body.MinValue || null,
      MaxValue: body.MaxValue || null,
      Multiplier: body.Multiplier || null,
      Offset: body.Offset || null,
      Unit: body.Unit || null,
      ErrorValues: body.ErrorValues || null,
      ConversionFormula: body.ConversionFormula || null,
      Averaging: body.Averaging || null,
      EventOnChange: body.EventOnChange || null,
      EventOnHysterisis: body.EventOnHysterisis || null,
      ParameterGroup: body.ParameterGroup || null,
      Description: body.Description || null,
      RawValueJson: body.RawValueJson || null
    });
    
    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'IO Mapping created successfully'
    } as ApiResponse<IOMapping>);
  } catch (error) {
    console.error('Error creating IO mapping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create IO mapping' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

