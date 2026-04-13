import { DB } from "./db.js";
import { TABLE_METADATA_KEY } from "./table.decorator.js";
import {
  Column,
  COLUMNS_METADATA_KEY,
  type ColumnMetadata,
} from "./column.decorator.js";

export interface IBaseEntity {
  id?: number | undefined;
  createdAt: Date;
  createdBy: number;
  updatedAt: Date;
  updatedBy: number;
}

export abstract class BaseEntity implements IBaseEntity {
  @Column('ID')
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

  static getAllColumns(target: any): ColumnMetadata[] {
    let columns: ColumnMetadata[] = [];
    while (target && target !== Function.prototype) {
      const current = Reflect.getMetadata(COLUMNS_METADATA_KEY, target) || [];
      columns = [...columns, ...current];
      target = Object.getPrototypeOf(target);
    }
    return columns;
  }

  async save(): Promise<void> {
    const metadata: ColumnMetadata[] = (this.constructor as any).getAllColumns(
      this.constructor,
    );
    const columns = metadata.map((col: any) => col.columnName); // DB columns
    const values = metadata.map((col: any) => (this as any)[col.propertyKey]); // object values
    const query = DB.driver.getInsertQuery(
      (this.constructor as typeof BaseEntity).getTableName(),
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
      conditions?: Partial<I>;
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
    return result.map((row: any) => new this(row));
  }
  static async findOne<T extends BaseEntity, I extends IBaseEntity>(
    this: { new (entity: I): T; getTableName(): string },
    conditions: Partial<I>,
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
      conditions?: Partial<I>;
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
    conditions: Partial<I>,
  ): Promise<boolean> {
    const affectedRows = await (this as any).deleteAll({
      conditions,
      limit: 1,
    });
    return affectedRows > 0;
  }

  static async count<T extends BaseEntity, I extends IBaseEntity>(
    this: { new (entity: I): T; getTableName(): string },
    conditions?: Partial<I>,
  ): Promise<number> {
    const query = DB.driver.getCountQuery(this.getTableName(), conditions);
    const result = await DB.driver.execute(query);
    return result?.[0]?.count ?? 0;
  }
  static async updateAll<T extends BaseEntity, I extends IBaseEntity>(
    this: { new (entity: I): T; getTableName(): string },
    updates: Partial<I>,
    conditions: Partial<I>,
  ): Promise<number> {
    const query = DB.driver.getUpdateQuery(
      this.getTableName(),
      Object.keys(updates),
      conditions,
    );
    const params = [];
    for (const key of Object.keys(updates)) {
      params.push((updates as any)[key]);
    }
    for (const key of Object.keys(conditions)) {
      params.push((conditions as any)[key]);
    }
    const result = await DB.driver.execute(query, params);
    return result.affectedRows;
  }
  static async updateById<T extends BaseEntity, I extends IBaseEntity>(
    this: new (entity: I) => T,
    id: number,
    updates: Partial<I>,
  ): Promise<boolean> {
    const affectedRows = await (this as any).updateAll(updates, { id });
    return affectedRows > 0;
  }
}
