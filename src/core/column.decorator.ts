export const COLUMNS_METADATA_KEY = Symbol("columns");

//key and custom name
export interface ColumnMetadata {
  propertyKey: string;
  columnName: string;
}

export function Column(columnName?: string) {
  return function (target: any, propertyKey: string) {
    const existing: ColumnMetadata[] =
      Reflect.getMetadata(COLUMNS_METADATA_KEY, target.constructor) || [];
    if (!existing.some((col) => col.propertyKey === propertyKey)) {
      existing.push({
        propertyKey,
        columnName: columnName || propertyKey,
      });
    }
    Reflect.defineMetadata(COLUMNS_METADATA_KEY, existing, target.constructor);
  };
}
