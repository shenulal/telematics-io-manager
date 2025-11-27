import sql from 'mssql';

// Parse server and port from DB_SERVER (format: "host,port" or "host")
const serverParts = (process.env.DB_SERVER || 'localhost').split(',');
const server = serverParts[0];
const port = serverParts.length > 1 ? parseInt(serverParts[1]) : 1433;

// Get password - handle escaped $ characters from .env file
let password = (process.env.DB_PASSWORD || '').replace(/\\\$/g, '$');

const config: sql.config = {
  user: process.env.DB_USER || '',
  password: password,
  server: server,
  port: port,
  database: process.env.DB_NAME || 'TelematicsIOManager',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool: sql.ConnectionPool | null = null;

export async function getConnection(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  try {
    // Close existing pool if it exists but is not connected
    if (pool) {
      await pool.close();
      pool = null;
    }

    pool = await sql.connect(config);
    console.log('Database connected successfully to', server, 'port', port);
    return pool;
  } catch (error) {
    console.error('Database connection error:', error);
    pool = null;
    throw error;
  }
}

export async function executeQuery<T>(query: string, params?: Record<string, unknown>): Promise<T[]> {
  const connection = await getConnection();
  const request = connection.request();
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }
  
  const result = await request.query(query);
  return result.recordset as T[];
}

export async function executeStoredProcedure<T>(
  procedureName: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const connection = await getConnection();
  const request = connection.request();
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }
  
  const result = await request.execute(procedureName);
  return result.recordset as T[];
}

export { sql };

