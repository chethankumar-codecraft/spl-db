import type { ConnectionOptions } from "mysql2";
import type { IDatabaseDriver, DatabaseDriverResult } from "../core/db.js";
import { createConnection, Connection } from "mysql2/promise";

export class MySqlDriver implements IDatabaseDriver {
  private connection: Connection | null = null;
  private connectionConfig: string | ConnectionOptions;

  constructor(connectionConfig: string | ConnectionOptions) {
    this.connectionConfig = connectionConfig;
  }

  async connect(): Promise<void> {
    if (this.connection) {
      return;
    }
    this.connection = await (typeof this.connectionConfig === "string"
      ? createConnection(this.connectionConfig)
      : createConnection(this.connectionConfig));
    await this.connection.query("SELECT 1");
  }

  async disconnect(): Promise<void> {
    if (!this.connection) {
      return;
    }
    await this.connection.end();
    this.connection = null;
  }

  async execute(
    query: string,
    params?: unknown[],
  ): Promise<DatabaseDriverResult> {
    if (!this.connection) {
      throw new Error("Not connected to the database");
    }
    const [results] = await this.connection.execute(query, params as any);
    if (Array.isArray(results)) {
      return {
        rows: results as Record<string, unknown>[],
        affectedRows: 0,
      };
    }
    if (results && typeof results === "object" && "affectedRows" in results) {
      const maybeInsertId =
        "insertId" in results ? results.insertId : undefined;
      const insertedId =
        typeof maybeInsertId === "number" && Number.isFinite(maybeInsertId)
          ? maybeInsertId
          : undefined;
      return {
        rows: [],
        affectedRows: Number(results.affectedRows ?? 0),
        ...(insertedId !== undefined ? { insertedId } : {}),
      };
    }
    return {
      rows: [],
      affectedRows: 0,
    };
  }

  getPlaceholderPrefix(): string {
    return "?";
  }

  escapeName(name: string): string {
    return `\`${name.replace(/`/g, "``")}\``;
  }

  private prepareWhereClause(conditions?: Record<string, unknown>): string {
    if (!conditions || Object.keys(conditions).length === 0) {
      return "";
    }
    const entries = Object.entries(conditions);
    const predicates = entries.map(
      ([column]) => `${this.escapeName(column)} = ?`,
    );
    return `${predicates.join(" AND ")}`;
  }

  getInsertQuery(tableName: string, columns: string[]): string {
    const placeholders = columns
      .map(() => this.getPlaceholderPrefix())
      .join(", ");
    return `INSERT INTO ${this.escapeName(tableName)} (${columns.map((col) => this.escapeName(col)).join(", ")}) VALUES (${placeholders})`;
  }

  getUpsertQuery(
    tableName: string,
    columns: string[],
    _conflictColumns: string[],
  ): string {
    const placeholders = columns
      .map(() => this.getPlaceholderPrefix())
      .join(", ");
    const updateColumns = columns.filter((column) => column !== "id");
    const updateAssignments = updateColumns.map(
      (column) =>
        `${this.escapeName(column)} = VALUES(${this.escapeName(column)})`,
    );
    updateAssignments.push(
      `${this.escapeName("id")} = LAST_INSERT_ID(${this.escapeName("id")})`,
    );
    const updateClause = updateAssignments.join(", ");
    return `INSERT INTO ${this.escapeName(tableName)} (${columns.map((col) => this.escapeName(col)).join(", ")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`;
  }

  getUpdateQuery(
    tableName: string,
    columns: string[],
    conditions: Record<string, unknown>,
  ): string {
    const setClause = columns
      .map((col) => `${this.escapeName(col)} = ?`)
      .join(", ");
    let query = `UPDATE ${this.escapeName(tableName)} SET ${setClause}`;
    const whereClause = this.prepareWhereClause(conditions);
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    return query;
  }

  getDeleteQuery(
    tableName: string,
    conditions: Record<string, unknown>,
    limit?: number,
    offset?: number,
  ): string {
    let query = `DELETE FROM ${this.escapeName(tableName)}`;
    const whereClause = this.prepareWhereClause(conditions);
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    if (limit !== undefined) {
      query += ` LIMIT ${limit}`;
      if (offset !== undefined) query += ` OFFSET ${offset}`;
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
    let query = `SELECT ${columns.map((col) => (col === "*" ? "*" : this.escapeName(col))).join(", ")} FROM ${this.escapeName(tableName)}`;
    const whereClause = this.prepareWhereClause(conditions);
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    if (limit !== undefined) query += ` LIMIT ${limit}`;
    if (offset !== undefined) query += ` OFFSET ${offset}`;
    return query;
  }

  getCountQuery(
    tableName: string,
    conditions?: Record<string, unknown>,
  ): string {
    let query = `SELECT COUNT(*) AS count FROM ${this.escapeName(tableName)}`;
    const whereClause = this.prepareWhereClause(conditions);
    if (whereClause) {
      query += ` WHERE ${whereClause}`;
    }
    return query;
  }
}
