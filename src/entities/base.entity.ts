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
      const placeholders = "?, ".repeat(keys.length).slice(0, -2);
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
  static async findAll<T extends BaseEntity, I extends IBaseEntity>(this: {
    new (entity: I): T;
    getTableName(): string;
  }): Promise<T[]> {
    const query = `SELECT * FROM ${this.getTableName()}`;
    console.log(query);
    const result = await db.execute(query);
    return result;
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
  ): Promise<void> {
    const query = `DELETE FROM ${this.getTableName()} WHERE id = ?`;
    console.log(query);
    await db.execute(query, [id]);
  }
  static async deleteAll<T extends BaseEntity, I extends IBaseEntity>(this: {
    new (entity: I): T;
    getTableName(): string;
  }): Promise<void> {
    const query = `DELETE FROM ${this.getTableName()}`;
    console.log(query);
    await db.execute(query);
  }
  static async deleteOne<T extends BaseEntity, I extends IBaseEntity>(
    this: {
      new (entity: I): T;
      getTableName(): string;
    },
    conditions: Partial<I>,
  ): Promise<void> {
    const keys = Object.keys(conditions);

    const whereCondition = keys.map((k) => `${k} = ?`).join(" AND ");
    const values = Object.values(conditions);

    const query = `DELETE FROM ${this.getTableName()} WHERE ${whereCondition} LIMIT 1`;
    console.log(query);

    await db.execute(query, values);
  }
}
