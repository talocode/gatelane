declare module "sql.js" {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
  }
  interface SqlJsDatabase {
    run(sql: string, params?: any[]): void;
    exec(sql: string): SqlResult[];
    export(): Uint8Array;
    close(): void;
  }
  interface SqlResult {
    columns: string[];
    values: any[][];
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}
