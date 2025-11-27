// Base type for DataTable compatibility
export type DataRecord = Record<string, unknown>;

// Vendor Model
export interface Vendor extends DataRecord {
  VendorID: number;
  VendorName: string;
  Country: string | null;
  Website: string | null;
}

export interface VendorCreate {
  VendorName: string;
  Country?: string;
  Website?: string;
}

export interface VendorUpdate extends Partial<VendorCreate> {
  VendorID: number;
}

// Product Model
export interface Product extends DataRecord {
  ProductID: number;
  VendorID: number;
  ProductName: string;
  Description: string | null;
  TempTypeId: number;
  // Joined fields
  VendorName?: string;
}

export interface ProductCreate {
  VendorID: number;
  ProductName: string;
  Description?: string;
  TempTypeId: number;
}

export interface ProductUpdate extends Partial<ProductCreate> {
  ProductID: number;
}

// IOUniversal Model
export interface IOUniversal extends DataRecord {
  IOID: number;
  IOName: string | null;
  IOCategory: string | null;
  DataType: string | null;
  Unit: string | null;
  Description: string | null;
}

export interface IOUniversalCreate {
  IOID: number;
  IOName?: string;
  IOCategory?: string;
  DataType?: string;
  Unit?: string;
  Description?: string;
}

export interface IOUniversalUpdate extends Partial<Omit<IOUniversalCreate, 'IOID'>> {
  IOID: number;
}

// IOMapping Model
export interface IOMapping extends DataRecord {
  MappingID: number;
  VendorID: number | null;
  ProductID: number | null;
  IOID: number;
  IOCode: string | null;
  IOName: string | null;
  Bytes: number | null;
  MinValue: unknown;
  MaxValue: unknown;
  Multiplier: number | null;
  Offset: number | null;
  Unit: string | null;
  ErrorValues: string | null;
  ConversionFormula: string | null;
  Averaging: string | null;
  EventOnChange: boolean | null;
  EventOnHysterisis: boolean | null;
  ParameterGroup: string | null;
  Description: string | null;
  RawValueJson: string | null;
  // Joined fields
  VendorName?: string;
  ProductName?: string;
  UniversalIOName?: string;
}

export interface IOMappingCreate {
  VendorID?: number;
  ProductID?: number;
  IOID: number;
  IOCode?: string;
  IOName?: string;
  Bytes?: number;
  MinValue?: unknown;
  MaxValue?: unknown;
  Multiplier?: number;
  Offset?: number;
  Unit?: string;
  ErrorValues?: string;
  ConversionFormula?: string;
  Averaging?: string;
  EventOnChange?: boolean;
  EventOnHysterisis?: boolean;
  ParameterGroup?: string;
  Description?: string;
  RawValueJson?: string;
}

export interface IOMappingUpdate extends Partial<IOMappingCreate> {
  MappingID: number;
}

// =============================================
// User Management Models
// =============================================
export interface User extends DataRecord {
  UserID: number;
  Username: string;
  Email: string;
  PasswordHash?: string; // Not returned to client
  FirstName: string | null;
  LastName: string | null;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string | null;
  LastLoginAt: string | null;
  // Joined fields
  Roles?: Role[];
  RoleNames?: string;
}

export interface UserCreate {
  Username: string;
  Email: string;
  Password: string;
  FirstName?: string;
  LastName?: string;
  IsActive?: boolean;
  RoleIds?: number[];
}

export interface UserUpdate {
  UserID: number;
  Email?: string;
  Password?: string;
  FirstName?: string;
  LastName?: string;
  IsActive?: boolean;
  RoleIds?: number[];
}

// =============================================
// Role Management Models
// =============================================
export interface Role extends DataRecord {
  RoleID: number;
  RoleName: string;
  Description: string | null;
  IsSystem: boolean;
  CreatedAt: string;
  // Joined fields
  Permissions?: Permission[];
  PermissionIds?: number[];
  UserCount?: number;
}

export interface RoleCreate {
  RoleName: string;
  Description?: string;
  PermissionIds?: number[];
}

export interface RoleUpdate {
  RoleID: number;
  RoleName?: string;
  Description?: string;
  PermissionIds?: number[];
}

// =============================================
// Permission Models
// =============================================
export interface Permission extends DataRecord {
  PermissionID: number;
  PermissionName: string;
  Description: string | null;
  Module: string;
  Action: string;
}

// =============================================
// Audit Log Models
// =============================================
export interface AuditLog extends DataRecord {
  AuditLogID: number;
  UserID: number | null;
  Username: string | null;
  Action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'EXPORT' | 'IMPORT';
  Module: string;
  RecordID: string | null;
  RecordDescription: string | null;
  OldValue: string | null;
  NewValue: string | null;
  IPAddress: string | null;
  UserAgent: string | null;
  Timestamp: string;
}

export interface AuditLogCreate {
  UserID?: number;
  Username?: string;
  Action: string;
  Module: string;
  RecordID?: string;
  RecordDescription?: string;
  OldValue?: string;
  NewValue?: string;
  IPAddress?: string;
  UserAgent?: string;
}

// =============================================
// Authentication Models
// =============================================
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'PasswordHash'>;
  accessToken: string;
  refreshToken: string;
  permissions: string[];
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface AuthUser {
  UserID: number;
  Username: string;
  Email: string;
  FirstName: string | null;
  LastName: string | null;
  IsActive: boolean;
  Roles: string[];
  Permissions: string[];
}

// =============================================
// API Response Types
// =============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

