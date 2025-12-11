import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { IOUniversal, IOUniversalUpdate, ApiResponse } from '@/types/models';
import { getAuthUser } from '@/lib/authMiddleware';
import { createAuditLog, getClientIP, getUserAgent, sanitizeForAudit, ModuleNames, ActionTypes } from '@/lib/auditLog';

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
  const user = await getAuthUser(request);

  try {
    const { id } = await params;
    const ioId = parseInt(id);
    const body: IOUniversalUpdate = await request.json();

    // Get old value for audit
    const oldResult = await executeQuery<IOUniversal>(
      `SELECT * FROM IOUniversal WHERE IOID = @IOID`,
      { IOID: ioId }
    );
    const oldIO = oldResult[0];

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

    // Audit log
    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.UPDATE,
      Module: ModuleNames.IO_UNIVERSAL,
      RecordID: id,
      RecordDescription: `Updated IO Universal: ${body.IOName || id}`,
      OldValue: oldIO ? sanitizeForAudit(oldIO as unknown as Record<string, unknown>) : undefined,
      NewValue: sanitizeForAudit(body as unknown as Record<string, unknown>),
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

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
  const user = await getAuthUser(request);

  try {
    const { id } = await params;
    const ioId = parseInt(id);

    // Get old value for audit before delete
    const oldResult = await executeQuery<IOUniversal>(
      `SELECT * FROM IOUniversal WHERE IOID = @IOID`,
      { IOID: ioId }
    );
    const oldIO = oldResult[0];

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

    // Audit log
    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.DELETE,
      Module: ModuleNames.IO_UNIVERSAL,
      RecordID: id,
      RecordDescription: `Deleted IO Universal: ${oldIO?.IOName || id}`,
      OldValue: oldIO ? sanitizeForAudit(oldIO as unknown as Record<string, unknown>) : undefined,
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

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

