import type { IDatabaseDriver } from "../core/db.js";
import type { DatabaseDriverResult } from "../core/db.js";
import type { ClientConfig } from "pg";
import { Client } from "pg";
import { type Condition } from "../core/expressions.js";

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
    conditions?: Condition,
    startIndex: number = 1,
  ): { clause: string; nextIndex: number } {
    if (!conditions || Object.keys(conditions).length === 0) {
      return {
        clause: "",
        nextIndex: startIndex,
      };
    }

    const predicates = Object.entries(conditions).map(([column, expr]) => {
      const col = this.escapeName(column);
      const placeholder = this.getNumberedPlaceholder(startIndex++);

      switch (expr.op) {
        case "equal":
          return `${col} = ${placeholder}`;

        case "notEqual":
          return `${col} != ${placeholder}`;

        case "greaterThan":
          return `${col} > ${placeholder}`;

        case "lessThan":
          return `${col} < ${placeholder}`;

        case "greaterThanOrEqual":
          return `${col} >= ${placeholder}`;

        case "lessThanOrEqual":
          return `${col} <= ${placeholder}`;

        case "contains":
        case "startsWith":
        case "endsWith":
          return `${col} LIKE ${placeholder}`;

        default:
          throw new Error("Unsupported operator");
      }
    });

    return {
      clause: predicates.join(" AND "),
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
      .map(
        (col) =>
          `${this.escapeName(col)} = ${this.getNumberedPlaceholder(startIndex++)}`,
      )
      .join(", ");
    return {
      clause: setClause,
      nextIndex: startIndex,
    };
  }

  escapeName(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  getInsertQuery(tableName: string, columns: string[]): string {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    return `INSERT INTO ${this.escapeName(tableName)} (${columns.map((col) => this.escapeName(col)).join(", ")}) VALUES (${placeholders}) RETURNING id`;
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
    const conflictClause = conflictColumns
      .map((col) => this.escapeName(col))
      .join(", ");
    const updateClause =
      updateColumns.length > 0
        ? `DO UPDATE SET ${updateColumns.map((column) => `${this.escapeName(column)} = EXCLUDED.${this.escapeName(column)}`).join(", ")}`
        : "DO NOTHING"; //EXCLUDE: new insert values that failed because of conflict so it not give error
    return `INSERT INTO ${this.escapeName(tableName)} (${columns.map((col) => this.escapeName(col)).join(", ")}) VALUES (${placeholders}) ON CONFLICT (${conflictClause}) ${updateClause} RETURNING *`;
  }

  getUpdateQuery(
    tableName: string,
    columns: string[],
    conditions: Condition,
  ): string {
    const setClause = this.prepareSetClause(columns, 1);
    const whereClause = this.prepareWhereClause(
      conditions,
      setClause.nextIndex,
    );
    let query = `UPDATE ${this.escapeName(tableName)} SET ${setClause.clause}`;
    if (whereClause.clause) {
      query += ` WHERE ${whereClause.clause}`;
    }
    return query;
  }

  getDeleteQuery(
    tableName: string,
    conditions?: Condition,
    limit?: number,
    offset?: number,
  ): string {
    const whereClause = this.prepareWhereClause(conditions, 1);
    let innerQuery = `SELECT id FROM ${this.escapeName(tableName)}`;
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
    DELETE FROM ${this.escapeName(tableName)}
    WHERE id IN (${innerQuery})
  `;
  }

  getSelectQuery(
    tableName: string,
    columns: string[],
    conditions?: Condition,
    limit?: number,
    offset?: number,
  ): string {
    const whereClause = this.prepareWhereClause(conditions, 1);
    let query = `SELECT ${columns.map((c) => (c === "*" ? "*" : this.escapeName(c))).join(", ")} FROM ${this.escapeName(tableName)}`;
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

  getCountQuery(tableName: string, conditions?: Condition): string {
    const whereClause = this.prepareWhereClause(conditions, 1);
    let query = `SELECT COUNT(*) AS count FROM ${this.escapeName(tableName)}`;
    if (whereClause.clause) {
      query += ` WHERE ${whereClause.clause}`;
    }
    return query;
  }
}
