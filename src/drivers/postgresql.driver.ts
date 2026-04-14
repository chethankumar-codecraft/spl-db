import type { IDatabaseDriver } from "../core/db.js";
import postgres from "postgres";
export class PostgreSqlDriver implements IDatabaseDriver {
  private connection: ReturnType<typeof postgres> | null = null;
  private connectionConfig: string | postgres.Options<{}>;

  constructor(connectionConfig: string | postgres.Options<{}>) {
    this.connectionConfig = connectionConfig;
  }

  async connect(): Promise<void> {
    if (this.connection) {
      return;
    }
    this.connection =
      typeof this.connectionConfig === "string"
        ? postgres(this.connectionConfig)
        : postgres(this.connectionConfig);
    await this.connection`SELECT 1`;
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      return;
    }

    await this.connection.end();
    this.connection = null;
  }

  async execute(query: string, params?: any[]): Promise<any> {
    if (!this.connection) {
      throw new Error("Not connected to database");
    }

    // postgres.js uses tagged templates OR unsafe for raw queries
    if (params && params.length > 0) {
      return await this.connection.unsafe(query, params);
    }

    return await this.connection.unsafe(query);
  }

  getPlaceholderPrefix(): string {
    return "$";
  }
  getNumberedPlaceholder(index: number): string {
    return `${this.getPlaceholderPrefix()}${index}`;
  }
  getInsertQuery(tableName: string, columns: string[]): string {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

    const updates = columns
      .filter((c) => c !== "id")
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(", ");
    return `
    INSERT INTO ${tableName} (${columns.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (id)
    DO UPDATE SET ${updates}
  `;
  }
  getUpdateQuery(
    tableName: string,
    columns: string[],
    conditions: Record<string, unknown>,
  ): string {
    let index = 1;
    const setClause = columns
      .map((col) => `${col} = ${this.getNumberedPlaceholder(index++)}`)
      .join(", ");
    let query = `UPDATE ${tableName} SET ${setClause}`;

    if (conditions && Object.keys(conditions).length) {
      const whereClause = Object.keys(conditions)
        .map((key) => `${key} = ${this.getNumberedPlaceholder(index++)}`)
        .join(" AND ");

      query += ` WHERE ${whereClause}`;
    }
    return query;
  }
  getDeleteQuery(
    tableName: string,
    conditions?: Record<string, unknown>,
    limit?: number,
    offset?: number,
  ): string {
    let index = 1;
    let query = `DELETE FROM ${tableName}`;

    if (conditions && Object.keys(conditions).length) {
      const where = Object.keys(conditions)
        .map((key) => `${key} = ${this.getNumberedPlaceholder(index++)}`)
        .join(" AND ");
      query += ` WHERE ${where}`;
    }
    if (limit !== undefined) {
      query += ` LIMIT ${this.getNumberedPlaceholder(index++)}`;
    }
    if (offset !== undefined) {
      query += ` OFFSET ${this.getNumberedPlaceholder(index++)}`;
    }
    return query;
  }
  getSelectQuery(
    tableName: string,
    columns: string[],
    conditions?: Record<string, unknown>,
    limit?: number,
    offset?: number,
  ): string {
    let index = 1;
    let query = `SELECT ${columns.join(", ")} FROM ${tableName}`;
    if (conditions && Object.keys(conditions).length) {
      const where = Object.keys(conditions)
        .map((key) => `${key} = ${this.getNumberedPlaceholder(index++)}`)
        .join(" AND ");
      query += ` WHERE ${where}`;
    }
    if (limit !== undefined) {
      query += ` LIMIT ${this.getNumberedPlaceholder(index++)}`;
    }
    if (offset !== undefined) {
      query += ` OFFSET ${this.getNumberedPlaceholder(index++)}`;
    }
    return query;
  }
  getCountQuery(
    tableName: string,
    conditions?: Record<string, unknown>,
  ): string {
    let index = 1;
    let query = `SELECT COUNT(*) as count FROM ${tableName}`;
    if (conditions && Object.keys(conditions).length) {
      const where = Object.keys(conditions)
        .map((key) => `${key} = ${this.getNumberedPlaceholder(index++)}`)
        .join(" AND ");
      query += ` WHERE ${where}`;
    }
    return query;
  }
}
