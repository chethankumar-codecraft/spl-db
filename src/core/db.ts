import { type Condition } from "./expressions.js";
export interface DatabaseDriverResult {
  rows: Record<string, unknown>[];
  affectedRows: number;
  insertedId?: number;
}

export interface IDatabaseDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  execute(query: string, params?: unknown[]): Promise<DatabaseDriverResult>;

  getPlaceholderPrefix(): string;
  getInsertQuery(tableName: string, columns: string[]): string;
  getUpsertQuery(
    tableName: string,
    columns: string[],
    conflictColumns: string[],
  ): string;
  getUpdateQuery(
    tableName: string,
    columns: string[],
    conditions: Condition,
  ): string;
  getDeleteQuery(
    tableName: string,
    conditions: Condition,
    limit?: number,
    offset?: number,
  ): string;
  getSelectQuery(
    tableName: string,
    columns: string[],
    conditions?: Condition,
    limit?: number,
    offset?: number,
  ): string;
  getCountQuery(
    tableName: string,
    conditions?: Condition,
  ): string;
}

export class DB {
  private static instance: IDatabaseDriver;
  static setDriver(driver: IDatabaseDriver) {
    this.instance = driver;
  }
  static get driver(): IDatabaseDriver {
    if (!this.instance) {
      throw new Error("Database driver not set");
    }
    return this.instance;
  }
}
