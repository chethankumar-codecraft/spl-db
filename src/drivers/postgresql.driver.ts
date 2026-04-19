import type { IDatabaseDriver } from "../core/db.js";
import postgres from "postgres";
import type { DatabaseDriverResult } from "../core/db.js";
import type { ClientConfig } from "pg";
import { Client } from "pg";
export class PostgreSqlDriver implements IDatabaseDriver {
  private client: Client | null = null;
  private connectionConfig: string | ClientConfig;

  constructor(connectionConfig: string | ClientConfig) {
    this.connectionConfig = connectionConfig;
  }

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    this.client =
      typeof this.connectionConfig === "string"
        ? new Client({ connectionString: this.connectionConfig })
        : new Client(this.connectionConfig);

    await this.client.connect();
    await this.client.query("SELECT 1");
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.end();
    this.client = null;
  }

  async execute(
    query: string,
    params?: unknown[],
  ): Promise<DatabaseDriverResult> {
    if (!this.client) {
      throw new Error("Not connected to the database");
    }

    const result = await this.client.query(query, params);
    const rowId = result.rows[0]?.id;
    const insertedId =
      typeof rowId === "number"
        ? rowId
        : typeof rowId === "string" &&
            rowId.trim() !== "" &&
            !Number.isNaN(Number(rowId))
          ? Number(rowId)
          : undefined;
    return {
      rows: result.rows as Record<string, unknown>[],
      affectedRows: result.rowCount ?? 0,
      ...(insertedId !== undefined ? { insertedId } : {}),
    };
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

    let innerQuery = `SELECT id FROM ${tableName}`;

    if (conditions && Object.keys(conditions).length) {
      const where = Object.keys(conditions)
        .map((key) => `${key} = ${this.getNumberedPlaceholder(index++)}`)
        .join(" AND ");

      innerQuery += ` WHERE ${where}`;
    }
    innerQuery += ` ORDER BY id`;
    if (limit !== undefined) {
      innerQuery += ` LIMIT ${limit}`;
    }
    if (offset !== undefined) {
      innerQuery += ` OFFSET ${offset}`;
    }
    return `
    DELETE FROM ${tableName}
    WHERE id IN (${innerQuery})
  `;
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
      query += ` LIMIT ${limit}`;
    }
    if (offset !== undefined) {
      query += ` OFFSET ${offset}`;
    }
    return query;
  }

  getCountQuery(
    tableName: string,
    conditions?: Record<string, unknown>,
  ): string {
    let index = 1;
    let query = `SELECT COUNT(*) AS count FROM ${tableName}`;
    if (conditions && Object.keys(conditions).length) {
      const where = Object.keys(conditions)
        .map((key) => `${key} = ${this.getNumberedPlaceholder(index++)}`)
        .join(" AND ");
      query += ` WHERE ${where}`;
    }
    return query;
  }
}
