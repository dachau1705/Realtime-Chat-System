import { dbPool } from './index';

export class ModelBase<T extends Record<string, any>> {
  protected tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  /**
   * Helper to execute a raw SQL query.
   */
  async query<R = any>(sql: string, params: any[] = []): Promise<R[]> {
    const result = await dbPool.query(sql, params);
    return result.rows as R[];
  }

  /**
   * Find a record by its primary key ID.
   */
  async findById(id: string): Promise<T | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`;
    const rows = await this.query<T>(sql, [id]);
    return rows[0] || null;
  }

  /**
   * Find a single record matching specific criteria.
   */
  async findOne(filter: Partial<T>): Promise<T | null> {
    const keys = Object.keys(filter);
    if (keys.length === 0) return null;

    const whereClause = keys.map((key, index) => `"${key}" = $${index + 1}`).join(' AND ');
    const params = keys.map(key => filter[key]);
    const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`;
    
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }

  /**
   * Find all records matching specific criteria.
   */
  async findAll(filter?: Partial<T>, orderBy?: string): Promise<T[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    let params: any[] = [];

    if (filter && Object.keys(filter).length > 0) {
      const keys = Object.keys(filter);
      const whereClause = keys.map((key, index) => `"${key}" = $${index + 1}`).join(' AND ');
      params = keys.map(key => filter[key]);
      sql += ` WHERE ${whereClause}`;
    }

    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    return this.query<T>(sql, params);
  }

  /**
   * Create a new record.
   */
  async create(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      throw new Error('Cannot insert empty object');
    }

    const columns = keys.map(key => `"${key}"`).join(', ');
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
    const params = keys.map(key => data[key]);

    const sql = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const rows = await this.query<T>(sql, params);
    return rows[0];
  }

  /**
   * Update an existing record by ID.
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    const keys = Object.keys(data).filter(key => key !== 'id');
    if (keys.length === 0) return this.findById(id);

    const setClause = keys.map((key, index) => `"${key}" = $${index + 2}`).join(', ');
    const params = [id, ...keys.map(key => data[key])];

    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }

  /**
   * Delete a record by ID.
   */
  async delete(id: string): Promise<boolean> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await dbPool.query(sql, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
