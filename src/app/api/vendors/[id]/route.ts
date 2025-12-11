import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { Vendor, VendorUpdate, ApiResponse } from '@/types/models';
import { getAuthUser } from '@/lib/authMiddleware';
import { createAuditLog, getClientIP, getUserAgent, sanitizeForAudit, ModuleNames, ActionTypes } from '@/lib/auditLog';

// GET single vendor by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const vendorId = parseInt(id);
    
    const query = `
      SELECT VendorID, VendorName, Country, Website
      FROM Vendor
      WHERE VendorID = @VendorID
    `;
    
    const result = await executeQuery<Vendor>(query, { VendorID: vendorId });
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Vendor not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result[0]
    } as ApiResponse<Vendor>);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch vendor' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// PUT update vendor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);

  try {
    const { id } = await params;
    const vendorId = parseInt(id);
    const body: VendorUpdate = await request.json();

    // Get old value for audit
    const oldResult = await executeQuery<Vendor>(
      `SELECT * FROM Vendor WHERE VendorID = @VendorID`,
      { VendorID: vendorId }
    );
    const oldVendor = oldResult[0];

    const query = `
      UPDATE Vendor
      SET VendorName = @VendorName,
          Country = @Country,
          Website = @Website
      OUTPUT INSERTED.*
      WHERE VendorID = @VendorID
    `;

    const result = await executeQuery<Vendor>(query, {
      VendorID: vendorId,
      VendorName: body.VendorName,
      Country: body.Country || null,
      Website: body.Website || null
    });

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Vendor not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }

    // Audit log
    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.UPDATE,
      Module: ModuleNames.VENDORS,
      RecordID: id,
      RecordDescription: `Updated vendor: ${body.VendorName}`,
      OldValue: oldVendor ? sanitizeForAudit(oldVendor as unknown as Record<string, unknown>) : undefined,
      NewValue: sanitizeForAudit(body as unknown as Record<string, unknown>),
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Vendor updated successfully'
    } as ApiResponse<Vendor>);
  } catch (error) {
    console.error('Error updating vendor:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update vendor' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// DELETE vendor
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);

  try {
    const { id } = await params;
    const vendorId = parseInt(id);

    // Get old value for audit before delete
    const oldResult = await executeQuery<Vendor>(
      `SELECT * FROM Vendor WHERE VendorID = @VendorID`,
      { VendorID: vendorId }
    );
    const oldVendor = oldResult[0];

    const query = `
      DELETE FROM Vendor
      OUTPUT DELETED.*
      WHERE VendorID = @VendorID
    `;

    const result = await executeQuery<Vendor>(query, { VendorID: vendorId });

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Vendor not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }

    // Audit log
    await createAuditLog({
      UserID: user?.userId,
      Username: user?.username,
      Action: ActionTypes.DELETE,
      Module: ModuleNames.VENDORS,
      RecordID: id,
      RecordDescription: `Deleted vendor: ${oldVendor?.VendorName || id}`,
      OldValue: oldVendor ? sanitizeForAudit(oldVendor as unknown as Record<string, unknown>) : undefined,
      IPAddress: getClientIP(request.headers),
      UserAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({
      success: true,
      message: 'Vendor deleted successfully'
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Error deleting vendor:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete vendor' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

