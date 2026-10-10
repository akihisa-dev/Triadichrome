import type ExcelJS from 'exceljs';
type TableCell = { row: number; col: number; rowspan: number; colspan: number; text: string };
export function markupCells(markup: string): TableCell[];
export function workbookCells(sheet: ExcelJS.Worksheet): TableCell[];
