export type SchemaColumn = { readonly name: string; readonly reference?: string };
export type SchemaTable = { readonly name: string; readonly columns: readonly SchemaColumn[] };
export type DataColumn = { name: string; label: string; reference?: string };
export type DataTable = { name: string; label: string; columns: DataColumn[] };

/** Structural facts always come from the schema; new items remain visible without a label. */
export function describeDataTables(schema: readonly SchemaTable[], tableLabels: Readonly<Record<string, string | undefined>>,
  columnLabels: Readonly<Record<string, string | undefined>>): DataTable[] {
  return schema.map(table => ({ name: table.name, label: tableLabels[table.name] ?? table.name,
    columns: table.columns.map(column => ({ ...column,
      label: columnLabels[`${table.name}.${column.name}`] ?? columnLabels[column.name] ?? column.name })) }));
}
