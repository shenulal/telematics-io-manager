import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { Product, ProductUpdate, ApiResponse } from '@/types/models';

// GET single product by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);
    
    const query = `
      SELECT p.ProductID, p.VendorID, p.ProductName, p.Description, p.TempTypeId,
             v.VendorName
      FROM Product p
      LEFT JOIN Vendor v ON p.VendorID = v.VendorID
      WHERE p.ProductID = @ProductID
    `;
    
    const result = await executeQuery<Product>(query, { ProductID: productId });
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result[0]
    } as ApiResponse<Product>);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// PUT update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);
    const body: ProductUpdate = await request.json();
    
    const query = `
      UPDATE Product
      SET VendorID = @VendorID,
          ProductName = @ProductName,
          Description = @Description,
          TempTypeId = @TempTypeId
      OUTPUT INSERTED.*
      WHERE ProductID = @ProductID
    `;
    
    const result = await executeQuery<Product>(query, {
      ProductID: productId,
      VendorID: body.VendorID,
      ProductName: body.ProductName,
      Description: body.Description || null,
      TempTypeId: body.TempTypeId || 0
    });
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: result[0],
      message: 'Product updated successfully'
    } as ApiResponse<Product>);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

// DELETE product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);
    
    const query = `
      DELETE FROM Product
      OUTPUT DELETED.*
      WHERE ProductID = @ProductID
    `;
    
    const result = await executeQuery<Product>(query, { ProductID: productId });
    
    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' } as ApiResponse<null>,
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully'
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' } as ApiResponse<null>,
      { status: 500 }
    );
  }
}

