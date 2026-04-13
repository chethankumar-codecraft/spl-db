import { TABLE_METADATA_KEY } from "./table.decorator.js";

export interface IBaseEntity {
  id: number;

  createdAt: Date;
  createdBy: number;
  updatedAt: Date;
  updatedBy: number;
}

export abstract class BaseEntity implements IBaseEntity {
  id: number;

  createdAt: Date;
  createdBy: number;
  updatedAt: Date;
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
  // TASK: update this to insert / update
  async save(): Promise<void> {
    const keys = Object.keys(this).filter((k) => k !== "id") as (keyof this)[];
    const values = keys.map((k) => this[k]);
    const existing = await (this.constructor as any).findById(this.id);
    if (existing) {
      const keys = Object.keys(this).filter((k) => k !== "id");
      const setClause = keys.map((k) => `${k} = ?`).join(", ");
      const query = `UPDATE ${(this.constructor as typeof BaseEntity).getTableName()} SET ${setClause} WHERE id = ?`;
      console.log(query);
      await db.execute(query, [...values, this.id]);
    } else {
      const columns = keys.join(", ");
      const placeholders = "?, ".repeat(keys.length + 1).slice(0, -2);
      const query = `INSERT INTO ${(this.constructor as typeof BaseEntity).getTableName()} (id, ${columns}) VALUES (${placeholders})`;
      console.log(query);
      await db.execute(query, [this.id, ...values]);
    }
  }

  static async findById<T extends BaseEntity, I extends IBaseEntity>(
    this: { new (entity: I): T; getTableName(): string },
    id: number,
  ): Promise<T | null> {
    const query = `SELECT * FROM ${this.getTableName()} WHERE id = ?`;
    console.log(query);
    const result = await db.execute(query, [id]);
    if (!result.length) return null;
    const instance = new this(result[0]);
    return instance;
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
    let query = `SELECT * FROM ${this.getTableName()}`;
    const values = [];
    // WHERE
    if (options?.conditions && Object.keys(options.conditions).length > 0) {
      const keys = Object.keys(options.conditions);
      const whereClause = keys.map((k) => `${k} = ?`).join(" AND ");
      query += ` WHERE ${whereClause}`;
      values.push(...Object.values(options.conditions));
    }
    // PAGINATION
    if (options?.limit !== undefined) {
      query += ` LIMIT ?`;
      values.push(options.limit);
    }
    if (options?.offset !== undefined) {
      query += ` OFFSET ?`;
      values.push(options.offset);
    }
    console.log(query);
    const result = await db.execute(query, values);
    return result.map((row: I) => new this(row));
  }
  static async findOne<T extends BaseEntity, I extends IBaseEntity>(
    this: { new (entity: I): T; getTableName(): string },
    conditions: Partial<I>,
  ): Promise<T | null> {
    const keys = Object.keys(conditions);
    const whereCondition = keys.map((key) => `${key}=?`).join(" AND ");
    const query = `SELECT * FROM ${this.getTableName()} WHERE ${whereCondition} LIMIT 1`;
    console.log(query);
    const values = Object.values(conditions);
    const result = await db.execute(query, values);
    if (!result.length) return null;
    const instance = new this(result[0]);
    return instance;
  }

  static async deleteById<T extends BaseEntity, I extends IBaseEntity>(
    this: { new (entity: I): T; getTableName(): string },
    id: number,
  ): Promise<number> {
    const query = `DELETE FROM ${this.getTableName()} WHERE id = ?`;
    console.log(query);
    const result = await db.execute(query, [id]);
    return result.affectedRows ?? 0;
  }
  static async deleteAll<T extends BaseEntity, I extends IBaseEntity>(
    this: {
      new (entity: I): T;
      getTableName(): string;
    },
    options?: {
      conditions?: Partial<I>;
      limit?: number;
    },
  ): Promise<number> {
    let query = `DELETE FROM ${this.getTableName()}`;
    const values = [];
    // WHERE
    if (options?.conditions && Object.keys(options.conditions).length > 0) {
      const keys = Object.keys(options.conditions);
      const whereClause = keys.map((k) => `${k} = ?`).join(" AND ");
      query += ` WHERE ${whereClause}`;
      values.push(...Object.values(options.conditions));
    }

    if (options?.limit !== undefined) {
      query += ` LIMIT ?`;
      values.push(options.limit);
    }
    console.log(query);
    const result = await db.execute(query, values);
    return result.affectedRows ?? 0;
  }
  static async deleteOne<T extends BaseEntity, I extends IBaseEntity>(
    this: {
      new (entity: I): T;
      getTableName(): string;
    },
    conditions: Partial<I>,
  ): Promise<number> {
    const keys = Object.keys(conditions);
    if (keys.length === 0) return 0;

    const whereCondition = keys.map((k) => `${k} = ?`).join(" AND ");
    const values = Object.values(conditions);

    const query = `DELETE FROM ${this.getTableName()} WHERE ${whereCondition} LIMIT 1`;
    console.log(query);
    const result = await db.execute(query, values);
    return result.affectedRows ?? 0;
  }
}
