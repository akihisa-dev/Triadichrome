import type { DetailField, DetailRecord } from "../core/domain/details";
import type { PlanContents } from "../core/domain/plan";
import { accountTypes, isAccountType } from "../core/domain/accountTypes";
import type { TableColumn } from "../core/tables/tableView";
export type DetailColumn = TableColumn<DetailRecord> & { field?: DetailField };
export function detailColumns(contents: PlanContents): DetailColumn[] {
  const name = (list: { id: number; name: string }[], id: number | null) => list.find(item => item.id === id)?.name ?? null;
  return [
    { id: "fiscalYear", label: "年度", numeric: true, value: row => row.fiscalYear },
    { id: "kind", label: "種別", value: row => row.kindName },
    { id: "industry", label: "業種名", field: "industryId", value: row => name(contents.industries.map(item => ({ id: item.id, name: item.industryName })), row.industryId) },
    { id: "initiativeName", label: "施策名", field: "name", value: row => row.initiativeName },
    { id: "expansion", label: "展開名", field: "expansionId", value: row => name(contents.expansions.map(item => ({ id: item.id, name: item.expansionName })), row.expansionId) },
    { id: "department", label: "部署名", field: "departmentId", value: row => name(contents.departments.map(item => ({ id: item.id, name: item.departmentName })), row.departmentId) },
    { id: "period", label: "期間名", field: "periodTypeId", value: row => name(contents.periodTypes.map(item => ({ id: item.id, name: item.periodName })), row.periodTypeId) },
    { id: "startYearMonth", label: "開始年月", value: row => row.startYearMonth ?? "" },
    { id: "accountCode", label: "科目コード", field: "accountId", value: row => row.accountCode },
    { id: "account", label: "科目名", field: "accountId", value: row => row.accountName },
    { id: "attribute", label: "科目属性", value: row => isAccountType(row.accountType) ? accountTypes[row.accountType] : null },
    { id: "month", label: "年月", value: row => `${row.year}-${String(row.month).padStart(2, "0")}` },
    { id: "amount", label: "金額", field: "amount", numeric: true, amount: true, value: row => row.amount },
    { id: "sales", label: "売上", numeric: true, amount: true, value: row => row.sales },
    { id: "expense", label: "費用", numeric: true, amount: true, value: row => row.accountType === "expense" ? row.amount : "0" },
    { id: "profit", label: "利益", numeric: true, amount: true, value: row => row.profit },
    { id: "note", label: "施策備考", field: "note", value: row => row.note },
  ];
}
export function detailChoices(contents: PlanContents, field?: DetailField) {
  return field === "accountId" ? contents.accounts.filter(item => item.accountType).map(item => ({ id: item.id, name: `${item.accountCode ?? "未設定"} ${item.accountName}` }))
    : field === "industryId" ? contents.industries.map(item => ({ id: item.id, name: item.industryName })) : field === "expansionId" ? contents.expansions.map(item => ({ id: item.id, name: item.expansionName })) : field === "departmentId" ? contents.departments.map(item => ({ id: item.id, name: item.departmentName })) : field === "periodTypeId" ? contents.periodTypes.map(item => ({ id: item.id, name: item.periodName })) : null;
}
