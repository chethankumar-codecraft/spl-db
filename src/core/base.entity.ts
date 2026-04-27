import { DB, type DatabaseDriverResult } from "./db.js";
import { TABLE_METADATA_KEY } from "./table.decorator.js";
import { Column, getColumnSqlName } from "./column.decorator.js";
import { type Condition, type Expression } from "./expressions.js";

export interface IBaseEntity {
  id?: number | undefined;
  createdAt: Date;
  createdBy: number;
  updatedAt: Date;
  updatedBy: number;
}

export abstract class BaseEntity implements IBaseEntity {
  @Column()
  id?: number | undefined;
  @Column("created_at")
  createdAt: Date;
  @Column("created_by")
  createdBy: number;
  @Column("updated_at")
  updatedAt: Date;
  @Column("updated_by")
  updatedBy: number;

  constructor(entity: IBaseEntity) {
    this.id = entity.id;
    this.createdAt = entity.createdAt;
    this.createdBy = entity.createdBy;
    this.updatedAt = entity.updatedAt;
    this.updatedBy = entity.updatedBy;
  }

  static getTableName(): string {
    return Reflect.getMetadata(TABLE_METADATA_KEY, this);
  }

  static transformValue(expr: Expression): unknown {
    switch (expr.op) {
      case "contains":
        return `%${expr.value}%`;

      case "startsWith":
        return `${expr.value}%`;

      case "endsWith":
        return `%${expr.value}`;

      default:
        return expr.value;
    }
  }

  static buildDbConditions<T extends BaseEntity, I extends IBaseEntity>(
    this: new (entity: I) => T,
    conditions?: Condition,
  ): { dbConditions: Condition; values: unknown[] } {
    const dbConditions: Condition = {};
    const values: unknown[] = [];
    const proto = this.prototype as object;
    const entries = Object.entries(conditions || {});
    for (const [key, expr] of entries) {
      const meta = getColumnSqlName(proto, key);

      if (!meta.dbColumnName) {
        throw new Error(`Unknown column: ${key}`);
      }
      dbConditions[meta.dbColumnName] = expr;
      values.push(BaseEntity.transformValue(expr));
    }
    return { dbConditions: dbConditions, values: values };
  }

  async save(): Promise<void> {
    const ctor = this.constructor;
    const proto = Object.getPrototypeOf(this) as object;
    const tableName = Reflect.getMetadata(TABLE_METADATA_KEY, ctor) as string;
    const propertyValues = Object.keys(this).reduce<Record<string, unknown>>(
      (acc, key) => {
        acc[key] = (this as any)[key];
        return acc;
      },
      {},
    );
    const persistableValues = Object.entries(propertyValues).reduce<
      Record<string, unknown>
    >((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});
    const dbValues: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(persistableValues)) {
      const meta = getColumnSqlName(proto, key);
      if (!meta.dbColumnName) {
        throw new Error(`Unknown column: ${key}`);
      }
      dbValues[meta.dbColumnName] = value;
    }

    const columns = Object.keys(dbValues);
    const values = Object.values(dbValues);
    const query = DB.driver.getUpsertQuery(tableName, columns, ["id"]);
    const result = await DB.driver.execute(query, values);
    const resolvedId = BaseEntity.resolveNumericId(
      result.insertedId ?? result.rows[0]?.id,
    );
    if (resolvedId !== undefined) {
      this.id = resolvedId;
    }
    const returnedRow = result.rows[0];
    if (returnedRow) {
      this.hydrateFromRow(proto, returnedRow);
      return;
    }
    await this.reloadCurrentState(tableName, proto);
  }

  static async findById<T extends BaseEntity, I extends IBaseEntity>(
    this: new (entity: I) => T,
    id: number,
  ): Promise<T | null> {
    return await (this as any).findOne({
      id: { op: "equal", value: id },
    });
  }

  static async findAll<T extends BaseEntity, I extends IBaseEntity>(
    this: {
      new (entity: I): T;
      getTableName(): string;
      buildDbConditions(conditions?: Condition): {
        dbConditions: Condition;
        values: unknown[];
      };
    },
    options?: {
      conditions?: Condition;
      limit?: number;
      offset?: number;
    },
  ): Promise<T[]> {
    const { dbConditions, values } = this.buildDbConditions(
      options?.conditions,
    );
    const query = DB.driver.getSelectQuery(
      this.getTableName(),
      ["*"],
      dbConditions,
      options?.limit,
      options?.offset,
    );
    console.log(query);
    const result = await DB.driver.execute(query, values);
    return result.rows.map((row) => {
      const entity = new this({} as I);
      entity.hydrateFromRow(this.prototype, row);
      return entity;
    });
  }
  static async findOne<T extends BaseEntity, I extends IBaseEntity>(
    this: { new (entity: I): T; getTableName(): string },
    conditions: Condition,
  ): Promise<T | null> {
    const results = await (this as any).findAll({
      conditions: conditions,
      limit: 1,
    });
    return results.length > 0 ? results[0] : null;
  }

  static async deleteById<T extends BaseEntity, I extends IBaseEntity>(
    this: new (entity: I) => T,
    id: number,
  ): Promise<boolean> {
    return await (this as any).deleteOne({
      id: { op: "equal", value: id },
    });
  }
  static async deleteAll<T extends BaseEntity, I extends IBaseEntity>(
    this: {
      new (entity: I): T;
      getTableName(): string;
      buildDbConditions(conditions?: Condition): {
        dbConditions: Condition;
        values: unknown[];
      };
    },
    options?: {
      conditions?: Condition;
      limit?: number;
      offset?: number;
    },
  ): Promise<number> {
    const { dbConditions, values } = this.buildDbConditions(
      options?.conditions,
    );
    const query = DB.driver.getDeleteQuery(
      this.getTableName(),
      dbConditions,
      options?.limit,
      options?.offset,
    );
    console.log(query);
    const result = await DB.driver.execute(query, values);
    return result.affectedRows;
  }

  static async deleteOne<T extends BaseEntity, I extends IBaseEntity>(
    this: new (entity: I) => T,
    conditions: Condition,
  ): Promise<boolean> {
    const affectedRows = await (this as any).deleteAll({
      conditions,
      limit: 1,
    });
    return affectedRows > 0;
  }

  static async count<T extends BaseEntity, I extends IBaseEntity>(
    this: {
      new (entity: I): T;
      getTableName(): string;
      buildDbConditions(conditions?: Condition): {
        dbConditions: Condition;
        values: unknown[];
      };
    },
    conditions?: Condition,
  ): Promise<number> {
    const { dbConditions, values } = this.buildDbConditions(conditions);
    const query = DB.driver.getCountQuery(this.getTableName(), dbConditions);

    const result = await DB.driver.execute(query, values);
    return Number(result.rows[0]?.count ?? 0);
  }
  static async updateAll<T extends BaseEntity, I extends IBaseEntity>(
    this: {
      new (entity: I): T;
      getTableName(): string;
      buildDbConditions(conditions?: Condition): {
        dbConditions: Condition;
        values: unknown[];
      };
    },
    updates: Record<string, unknown>,
    conditions: Condition,
  ): Promise<number> {
    const proto = this.prototype as object;
    const dbUpdatesColumns: string[] = [];
    const updateEntries = Object.entries(updates || {});
    const { dbConditions, values } = this.buildDbConditions(conditions);

    const updateValues = [];
    //updates
    for (const [key, value] of updateEntries) {
      const meta = getColumnSqlName(proto, key);
      if (!meta.dbColumnName) {
        throw new Error(`Unknown column: ${key}`);
      }
      dbUpdatesColumns.push(meta.dbColumnName);
      updateValues.push(value);
    }
    const params = [...updateValues, ...values];

    const query = DB.driver.getUpdateQuery(
      this.getTableName(),
      dbUpdatesColumns,
      dbConditions,
    );
    console.log(query);
    const result = await DB.driver.execute(query, params);
    return result.affectedRows;
  }
  static async updateById<T extends BaseEntity, I extends IBaseEntity>(
    this: new (entity: I) => T,
    id: number,
    updates: Record<string, unknown>,
  ): Promise<boolean> {
    const affectedRows = await (this as any).updateAll(updates, {
      id: { op: "equal", value: id },
    });
    return affectedRows > 0;
  }
  private async reloadCurrentState(
    tableName: string,
    prototype: object,
  ): Promise<void> {
    const entityId = BaseEntity.resolveNumericId(this.id);
    if (entityId === undefined) {
      throw new Error("Cannot reload entity after save without an id");
    }

    const query = DB.driver.getSelectQuery(
      tableName,
      ["*"],
      {
        id: { op: "equal", value: entityId },
      },
      1,
    );
    const result = await DB.driver.execute(query);
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Unable to reload entity with id ${entityId} after save`);
    }

    this.hydrateFromRow(prototype, row);
  }

  private static resolveNumericId(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
    return undefined;
  }

  private hydrateFromRow(
    prototype: object,
    row: Record<string, unknown>,
  ): void {
    const propertyToColumn = Object.keys(this).reduce<Record<string, string>>(
      (acc, propertyName) => {
        const metadata = getColumnSqlName(prototype, propertyName);
        if (metadata.dbColumnName) {
          acc[metadata.dbColumnName] = propertyName;
        }
        return acc;
      },
      {},
    );
    for (const [columnName, value] of Object.entries(row)) {
      const propertyName = propertyToColumn[columnName] ?? columnName;
      if (propertyName in this) {
        (this as Record<string, unknown>)[propertyName] = value;
      }
    }
  }
}
