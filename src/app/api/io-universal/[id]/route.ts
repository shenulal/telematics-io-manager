import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { IOUniversal, IOUniversalUpdate, ApiResponse } from '@/types/models';

// GET single IOUniversal by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ioId = parseInt(id);
    
    const query = `
      SELECT IOID, IOName, IOCategory, DataType, Unit, Description
      FROM IOUniversal
      WHERE IOID = @IOID
    `;
    
    const result = await executeQuery<IOUniversal>(query, { IOID: ioId });
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'IO Universal entry not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result[0]
    } as ApiResponse<IOUniversal>);
  } catch (error) {
    console.error('Error fetching IO Universal entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch IO Universal entry' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// PUT update IOUniversal
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ioId = parseInt(id);
    const body: IOUniversalUpdate = await request.json();
    
    const query = `
      UPDATE IOUniversal
      SET IOName = @IOName,
          IOCategory = @IOCategory,
          DataType = @DataType,
          Unit = @Unit,
          Description = @Description
      OUTPUT INSERTED.*
      WHERE IOID = @IOID
    `;
    
    const result = await executeQuery<IOUniversal>(query, {
      IOID: ioId,
      IOName: body.IOName || null,
      IOCategory: body.IOCategory || null,
      DataType: body.DataType || null,
      Unit: body.Unit || null,
      Description: body.Description || null
    });
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'IO Universal entry not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'IO Universal entry updated successfully'
    } as ApiResponse<IOUniversal>);
  } catch (error) {
    console.error('Error updating IO Universal entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update IO Universal entry' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// DELETE IOUniversal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ioId = parseInt(id);
    
    const query = `
      DELETE FROM IOUniversal
      OUTPUT DELETED.*
      WHERE IOID = @IOID
    `;
    
    const result = await executeQuery<IOUniversal>(query, { IOID: ioId });
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'IO Universal entry not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'IO Universal entry deleted successfully'
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Error deleting IO Universal entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete IO Universal entry' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

