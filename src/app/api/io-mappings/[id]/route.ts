import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { IOMapping, IOMappingUpdate, ApiResponse } from '@/types/models';

// GET single IO mapping by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mappingId = parseInt(id);
    
    const query = `
      SELECT m.MappingID, m.VendorID, m.ProductID, m.IOID, m.IOCode, m.IOName,
             m.Bytes, m.MinValue, m.MaxValue, m.Multiplier, m.[Offset], m.Unit,
             m.ErrorValues, m.ConversionFormula, m.Averaging, m.EventOnChange,
             m.EventOnHysterisis, m.ParameterGroup, m.Description, m.RawValueJson,
             v.VendorName, p.ProductName, u.IOName as UniversalIOName
      FROM IOMapping m
      LEFT JOIN Vendor v ON m.VendorID = v.VendorID
      LEFT JOIN Product p ON m.ProductID = p.ProductID
      LEFT JOIN IOUniversal u ON m.IOID = u.IOID
      WHERE m.MappingID = @MappingID
    `;
    
    const result = await executeQuery<IOMapping>(query, { MappingID: mappingId });
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'IO Mapping not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result[0]
    } as ApiResponse<IOMapping>);
  } catch (error) {
    console.error('Error fetching IO mapping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch IO mapping' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// PUT update IO mapping
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mappingId = parseInt(id);
    const body: IOMappingUpdate = await request.json();
    
    const query = `
      UPDATE IOMapping
      SET VendorID = @VendorID, ProductID = @ProductID, IOID = @IOID,
          IOCode = @IOCode, IOName = @IOName, Bytes = @Bytes,
          MinValue = @MinValue, MaxValue = @MaxValue, Multiplier = @Multiplier,
          [Offset] = @Offset, Unit = @Unit, ErrorValues = @ErrorValues,
          ConversionFormula = @ConversionFormula, Averaging = @Averaging,
          EventOnChange = @EventOnChange, EventOnHysterisis = @EventOnHysterisis,
          ParameterGroup = @ParameterGroup, Description = @Description, RawValueJson = @RawValueJson
      OUTPUT INSERTED.*
      WHERE MappingID = @MappingID
    `;
    
    const result = await executeQuery<IOMapping>(query, {
      MappingID: mappingId,
      VendorID: body.VendorID ?? null,
      ProductID: body.ProductID ?? null,
      IOID: body.IOID,
      IOCode: body.IOCode ?? null,
      IOName: body.IOName ?? null,
      Bytes: body.Bytes ?? null,
      MinValue: body.MinValue ?? null,
      MaxValue: body.MaxValue ?? null,
      Multiplier: body.Multiplier ?? null,
      Offset: body.Offset ?? null,
      Unit: body.Unit ?? null,
      ErrorValues: body.ErrorValues ?? null,
      ConversionFormula: body.ConversionFormula ?? null,
      Averaging: body.Averaging ?? null,
      EventOnChange: body.EventOnChange ?? null,
      EventOnHysterisis: body.EventOnHysterisis ?? null,
      ParameterGroup: body.ParameterGroup ?? null,
      Description: body.Description ?? null,
      RawValueJson: body.RawValueJson ?? null
    });
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'IO Mapping not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'IO Mapping updated successfully'
    } as ApiResponse<IOMapping>);
  } catch (error) {
    console.error('Error updating IO mapping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update IO mapping' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// DELETE IO mapping
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mappingId = parseInt(id);
    
    const query = `DELETE FROM IOMapping OUTPUT DELETED.* WHERE MappingID = @MappingID`;
    const result = await executeQuery<IOMapping>(query, { MappingID: mappingId });
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'IO Mapping not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'IO Mapping deleted successfully'
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Error deleting IO mapping:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete IO mapping' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

