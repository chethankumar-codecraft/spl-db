import { DB, type DatabaseDriverResult } from "./db.js";
import { TABLE_METADATA_KEY } from "./table.decorator.js";
import { Column, getColumnSqlName } from "./column.decorator.js";

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

  static buildDbConditions<T extends BaseEntity, I extends IBaseEntity>(
    this: abstract new (entity: I) => T,
    conditions?: Record<string, unknown>,
  ): { dbConditions: Record<string, unknown>; values: unknown[] } {
    const dbConditions: Record<string, unknown> = {};
    const values: unknown[] = [];
    const proto = this.prototype as object;
    const entries = Object.entries(conditions || {});
    for (const [key, value] of entries) {
      const meta = getColumnSqlName(proto, key);
      if (!meta.dbColumnName) {
        throw new Error(`Unknown column: ${key}`);
      }
      dbConditions[meta.dbColumnName] = value;
      values.push(value);
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
    const { dbConditions } = BaseEntity.buildDbConditions(persistableValues);
    const columns = Object.keys(dbConditions);
    if (columns.length === 0) {
      throw new Error("Cannot save entity without any mapped columns");
    }

    const values = Object.values(dbConditions);
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
    return await (this as any).findOne({ id });
  }

  // TASKS:
  static async findAll<T extends BaseEntity, I extends IBaseEntity>(
    this: {
      new (entity: I): T;
      getTableName(): string;
      buildDbConditions(conditions?: Record<string, unknown>): {
        dbConditions: Record<string, unknown>;
        values: unknown[];
      };
    },
    options?: {
      conditions?: Record<string, unknown>;
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
    return result.rows.map((row) => new this(row as I));
  }
  static async findOne<T extends BaseEntity, I extends IBaseEntity>(
    this: { new (entity: I): T; getTableName(): string },
    conditions: Record<string, unknown>,
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
    return await (this as any).deleteOne({ id });
  }
  static async deleteAll<T extends BaseEntity, I extends IBaseEntity>(
    this: {
      new (entity: I): T;
      getTableName(): string;
      buildDbConditions(conditions?: Record<string, unknown>): {
        dbConditions: Record<string, unknown>;
        values: unknown[];
      };
    },
    options?: {
      conditions?: Record<string, unknown>;
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
    return result.affectedRows; //affectedRows in mysql & count in postgresql
  }

  static async deleteOne<T extends BaseEntity, I extends IBaseEntity>(
    this: new (entity: I) => T,
    conditions: Record<string, unknown>,
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
      buildDbConditions(conditions?: Record<string, unknown>): {
        dbConditions: Record<string, unknown>;
        values: unknown[];
      };
    },
    conditions?: Record<string, unknown>,
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
      buildDbConditions(conditions?: Record<string, unknown>): {
        dbConditions: Record<string, unknown>;
        values: unknown[];
      };
    },
    updates: Record<string, unknown>,
    conditions: Record<string, unknown>,
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
    const affectedRows = await (this as any).updateAll(updates, { id });
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
      { id: entityId },
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
