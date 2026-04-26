import type { IDatabaseDriver } from "../core/db.js";
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

  prepareWhereClause(
    conditions?: Record<string, unknown>,
    startIndex: number = 1,
  ): { clause: string; nextIndex: number } {
    if (!conditions || Object.keys(conditions).length === 0) {
      return {
        clause: "",
        nextIndex: startIndex,
      };
    }
    const whereClause = Object.keys(conditions)
      .map((key) => `${key} = ${this.getNumberedPlaceholder(startIndex++)}`)
      .join(" AND ");
    return {
      clause: whereClause,
      nextIndex: startIndex,
    };
  }

  prepareSetClause(
    columns: string[],
    startIndex: number = 1,
  ): { clause: string; nextIndex: number } {
    if (!columns.length) {
      return {
        clause: "",
        nextIndex: startIndex,
      };
    }
    const setClause = columns
      .map((col) => `${col} = ${this.getNumberedPlaceholder(startIndex++)}`)
      .join(", ");
    return {
      clause: setClause,
      nextIndex: startIndex,
    };
  }

  getInsertQuery(tableName: string, columns: string[]): string {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    return `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING id`;
  }

  getUpsertQuery(
    tableName: string,
    columns: string[],
    conflictColumns: string[],
  ): string {
    const placeholders = columns
      .map((_, index) => this.getNumberedPlaceholder(index + 1))
      .join(", ");
    const updateColumns = columns.filter(
      (column) => !conflictColumns.includes(column),
    );
    const conflictClause = conflictColumns.join(", ");
    const updateClause =
      updateColumns.length > 0
        ? `DO UPDATE SET ${updateColumns.map((column) => `${column} = EXCLUDED.${column}`).join(", ")}`
        : "DO NOTHING"; //EXCLUDE: new insert values that failed because of conflict so it not give error
    return `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT (${conflictClause}) ${updateClause} RETURNING *`;
  }

  getUpdateQuery(
    tableName: string,
    columns: string[],
    conditions: Record<string, unknown>,
  ): string {
    const setClause = this.prepareSetClause(columns, 1);
    const whereClause = this.prepareWhereClause(
      conditions,
      setClause.nextIndex,
    );
    return `UPDATE ${tableName} SET ${setClause.clause} WHERE ${whereClause.clause}`;
  }

  getDeleteQuery(
    tableName: string,
    conditions?: Record<string, unknown>,
    limit?: number,
    offset?: number,
  ): string {
    const whereClause = this.prepareWhereClause(conditions, 1);
    let innerQuery = `SELECT id FROM ${tableName}`;
    if (whereClause.clause) {
      innerQuery += ` WHERE ${whereClause.clause}`;
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
    const whereClause = this.prepareWhereClause(conditions, 1);
    let query = `SELECT ${columns.join(", ")} FROM ${tableName}`;
    if (whereClause.clause) {
      query += ` WHERE ${whereClause.clause}`;
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
    const whereClause = this.prepareWhereClause(conditions, 1);
    let query = `SELECT COUNT(*) AS count FROM ${tableName}`;
    if (whereClause.clause) {
      query += ` WHERE ${whereClause.clause}`;
    }
    return query;
  }
}
