import { type ReactNode } from "react";

type MasterPageProps = { onOpenAmountItems: () => void; onOpenAccountTypes: () => void; onOpenAccounts: () => void; onOpenExpansions: () => void; onOpenIndustries: () => void; onOpenDepartments: () => void; onOpenPeriods: () => void; onOpenKinds: () => void };

const icons: ReactNode[] = [
  <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6M9 11h6M9 15h2m3 0h1M9 18h2m3 0h1" /></>,
  <><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-4h12v4" /></>,
  <><path d="M4 6h12m-4-4 4 4-4 4M20 18H8m4-4-4 4 4 4M4 12h16" /></>,
  <><path d="M3 21V9l8-4v16M11 21V3h10v18M2 21h20M6 11v1m0 3v1m9-9h2m-2 4h2m-2 4h2" /></>,
  <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 11v-3a6 6 0 0 0-2-4" /></>,
  <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18M7 15h3m4 0h3M7 18h3" /></>,
  <><path d="M3 4h9l9 9-8 8-10-10V4Z" /><circle cx="7.5" cy="8.5" r="1" /></>,
  <><path d="M3 4h9l9 9-8 8-10-10V4Z" /><circle cx="7.5" cy="8.5" r="1" /><path d="m10 13 2 2 4-4" /></>,
  <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 8h10M7 12h10M7 16h6" /></>,
];

export function MasterPage({ onOpenAmountItems, onOpenAccountTypes, onOpenAccounts, onOpenExpansions, onOpenIndustries, onOpenDepartments, onOpenPeriods, onOpenKinds }: MasterPageProps) {
  const items = [
    { name: "勘定科目マスタ", description: "科目・集計の名称、表示順、所属と加減", open: onOpenAccounts },
    { name: "展開マスタ", description: "展開コード・展開名", open: onOpenExpansions },
    { name: "業種マスタ", description: "業種コード・業種名", open: onOpenIndustries },
    { name: "部署マスタ", description: "部署名", open: onOpenDepartments },
    { name: "期間マスタ", description: "期間名", open: onOpenPeriods },
    { name: "種別マスタ", description: "種別", open: onOpenKinds },
    { name: "科目属性マスタ", description: "科目属性", open: onOpenAccountTypes },
    { name: "金額項目マスタ", description: "金額項目・表示順・構成", open: onOpenAmountItems },
  ];
  return <main className="master-page master-index" aria-labelledby="master-title">
    <h1 id="master-title">マスタ</h1>
    <div className="master-menu">
      {items.map((item, index) => <button key={item.name} className="master-menu-item" type="button" onClick={item.open}>
        <span className="master-menu-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{icons[index === 0 ? 0 : index + 1]}</svg>
        </span>
        <span className="master-menu-label"><strong>{item.name}</strong><span>{item.description}</span></span>
        <svg className="master-menu-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" /></svg>
      </button>)}
    </div>
  </main>;
}
