import { DB } from "./db.js";
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
  @Column("ID")
  id?: number | undefined;
  @Column()
  createdAt: Date;
  @Column()
  createdBy: number;
  @Column()
  updatedAt: Date;
  @Column()
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

  async save(): Promise<void> {
    const ctor = this.constructor;
    const proto = Object.getPrototypeOf(this) as object;
    const keys = Object.keys(this);
    console.log(keys);

    const columnsMetadata = keys
      .map((k) => getColumnSqlName(proto, k))
      .filter((metadata) => metadata.dbColumnName);
    const values = columnsMetadata.map(
      (col) => (this as any)[col.propertyName],
    );
    const columns = columnsMetadata.map((col) => col.dbColumnName);
    const query = DB.driver.getInsertQuery(
      Reflect.getMetadata(TABLE_METADATA_KEY, ctor),
      columns,
    );
    await DB.driver.execute(query, values);
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
    },
    options?: {
      conditions?: Record<string, unknown>;
      limit?: number;
      offset?: number;
    },
  ): Promise<T[]> {
    const query = DB.driver.getSelectQuery(
      this.getTableName(),
      ["*"],
      options?.conditions,
      options?.limit,
      options?.offset,
    );
    const values = [];
    if (options?.conditions) {
      for (const key of Object.keys(options.conditions!)) {
        values.push((options.conditions as any)[key]);
      }
    }

    if (options?.limit !== undefined) {
      values.push(options.limit);
    }

    if (options?.offset !== undefined) {
      values.push(options.offset);
    }
    const result = await DB.driver.execute(query, values);
    const metadata = (this as any).getAllColumns(this);

    return result.map((row: any) => {
      const mapped: any = {};
      for (const col of metadata) {
        mapped[col.propertyKey] = row[col.columnName];
      }
      return new this(mapped);
    });
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
  ): Promise<number> {
    return await (this as any).deleteOne({ id });
  }
  static async deleteAll<T extends BaseEntity, I extends IBaseEntity>(
    this: {
      new (entity: I): T;
      getTableName(): string;
    },
    options?: {
      conditions?: Record<string, unknown>;
      limit?: number;
      offset?: number;
    },
  ): Promise<number> {
    const query = DB.driver.getDeleteQuery(
      this.getTableName(),
      options?.conditions,
      options?.limit,
      options?.offset,
    );
    const values = [];
    if (options?.conditions) {
      for (const key of Object.keys(options.conditions!)) {
        values.push((options.conditions as any)[key]);
      }
    }

    if (options?.limit !== undefined) {
      values.push(options.limit);
    }

    if (options?.offset !== undefined) {
      values.push(options.offset);
    }
    const result = await DB.driver.execute(query, values);
    return result.affectedRows;
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
    this: { new (entity: I): T; getTableName(): string },
    conditions?: Record<string, unknown>,
  ): Promise<number> {
    const query = DB.driver.getCountQuery(this.getTableName(), conditions);
    const values = [];

    if (conditions) {
      for (const key of Object.keys(conditions)) {
        values.push((conditions as any)[key]);
      }
    }
    const result = await DB.driver.execute(query, values);
    return result?.[0]?.count ?? 0;
  }
  static async updateAll<T extends BaseEntity, I extends IBaseEntity>(
    this: { new (entity: I): T; getTableName(): string },
    updates: Record<string, unknown>,
    conditions: Record<string, unknown>,
  ): Promise<number> {
    const metadata = (this as any).getAllColumns(this);

    const updateKeys = Object.keys(updates);
    const conditionKeys = Object.keys(conditions);

    const updateColumns = metadata
      .filter((col: any) => updateKeys.includes(col.propertyKey))
      .map((col: any) => col.columnName);

    const conditionColumns = metadata
      .filter((col: any) => conditionKeys.includes(col.propertyKey))
      .reduce((acc: any, col: any) => {
        acc[col.columnName] = (conditions as any)[col.propertyKey];
        return acc;
      }, {});

    const query = DB.driver.getUpdateQuery(
      this.getTableName(),
      updateColumns,
      conditionColumns,
    );

    // build params in same order
    const params = [];
    // updates
    for (const col of metadata) {
      if (updateKeys.includes(col.propertyKey)) {
        params.push((updates as any)[col.propertyKey]);
      }
    }
    // conditions
    for (const col of metadata) {
      if (conditionKeys.includes(col.propertyKey)) {
        params.push((conditions as any)[col.propertyKey]);
      }
    }
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
}
