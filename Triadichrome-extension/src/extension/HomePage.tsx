import { initiativesForKind } from "../core/initiatives";
import { type PlanChange } from "../core/kindAmounts";
import { PreviousInputPage } from "./PreviousInputPage";
import { type KindChange } from "../core/kindMaster";
import { KindMasterPage } from "./KindMasterPage";
import { DetailTablePage } from "./DetailTablePage";
import { type DetailChange } from "../core/details";
import { HomeRelationsPage, type RelationView } from "./HomeRelationsPage";
import { type PeriodTypeChange } from "../core/periodMaster";
import { PeriodMasterPage } from "./PeriodMasterPage";
import { type DepartmentChange } from "../core/departmentMaster";
import { DepartmentMasterPage } from "./DepartmentMasterPage";
import { ExpansionTablePage } from "./ExpansionTablePage";
import { type IndustryChange } from "../core/industryMaster";
import { IndustryMasterPage } from "./IndustryMasterPage";
import { type ExpansionChange } from "../core/expansionMaster";
import { ExpansionMasterPage } from "./ExpansionMasterPage";
import { useCallback, useEffect, useRef, useState } from "react";
import { InitiativeEntryPage } from "./InitiativeEntryPage";
import { InitiativeListPage } from "./InitiativeListPage";
import { InitiativeDetailPage } from "./InitiativeDetailPage";
import { createInitiativeDraft, type Initiative, type InitiativeEntryDraft, type PlanContents } from "../core/initiatives";
import { StatusNotice } from "./StatusNotice";
import { FadeSwap } from "./FadeSwap";
import { MasterPage } from "./MasterPage";
import { AccountMasterPage } from "./AccountMasterPage";
import { type AccountChange } from "../core/accountMaster";
import { type AggregationChange } from "../core/aggregationMaster";
import { AggregationMasterPage } from "./AggregationMasterPage";
import { CostTablePage } from "./CostTablePage";
import { useSidebar } from "./useSidebar";
import { SidebarIcon } from "./SidebarIcon";
import appIcon from "../../../branding/logo-512.png?no-inline";

type Page = "previous-input" | "details" | "home" | "initiative-entry" | "initiative-list" | "initiative-detail" | "cost-table" | "expansion-table" | "master" | "account-master" | "aggregation-master" | "expansion-master" | "industry-master" | "department-master" | "period-master" | "kind-master";

type HomePageProps = {
  onChangePlan: (change: PlanChange) => Promise<PlanContents>;
  fileName: string;
  initialContents: PlanContents;
  onChangeMaster: (change: AccountChange) => Promise<PlanContents>;
  onChangeKinds: (change: KindChange) => Promise<PlanContents>;
  onChangePeriodTypes: (change: PeriodTypeChange) => Promise<PlanContents>;
  onChangeDepartments: (change: DepartmentChange) => Promise<PlanContents>;
  onChangeIndustries: (change: IndustryChange) => Promise<PlanContents>;
  onChangeExpansions: (change: ExpansionChange) => Promise<PlanContents>;
  onChangeAggregations: (change: AggregationChange) => Promise<PlanContents>;
  onRegisterInitiative: (draft: InitiativeEntryDraft) => Promise<PlanContents>;
  onUpdateInitiative: (id: number, year: number | null, draft: InitiativeEntryDraft) => Promise<PlanContents>;
  onChangeDetail: (change: DetailChange) => Promise<PlanContents>;
  onPrepareSave: () => Promise<void>;
  onCloseFile: () => void;
};

export function HomePage({ onChangePlan, fileName, initialContents, onChangeMaster, onChangeAggregations, onChangeExpansions, onChangeIndustries, onChangeDepartments, onChangePeriodTypes, onChangeKinds, onRegisterInitiative, onUpdateInitiative, onPrepareSave, onChangeDetail, onCloseFile }: HomePageProps) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const homeContent = useRef<HTMLDivElement>(null);
  const relationView = useRef<RelationView | null>(null);
  const sidebar = useSidebar();
  const isSidebarOpen = sidebar.expanded;
  const collapseSidebar = sidebar.collapse;
  const [page, setPage] = useState<Page>("home");
  const detailScroll = useRef({ top: 0, left: 0 });
  const [initiativeDraft, setInitiativeDraft] = useState(() => createInitiativeDraft(String(initialContents.fiscalYear)));
  const [contents, setContents] = useState(initialContents);

  const { accounts, initiatives } = contents;
  const [selectedInitiative, setSelectedInitiative] = useState<Pick<Initiative, "id" | "fiscalYear"> | null>(null);
  const currentInitiative = initiatives.find(item => item.id === selectedInitiative?.id && item.fiscalYear === selectedInitiative?.fiscalYear);
  const [detailOrigin, setDetailOrigin] = useState<"details" | "home" | "initiative-list" | "expansion-table">("initiative-list");
  const openInitiative = (initiative: Initiative) => {
    dismissNotice();
    setDetailOrigin(page === "details" ? "details" : page === "home" ? "home" : page === "expansion-table" ? "expansion-table" : "initiative-list");
    setSelectedInitiative({ id: initiative.id, fiscalYear: initiative.fiscalYear });
    setPage("initiative-detail");
  };
  const [notice, setNotice] = useState({ message: "", error: false });
  const dismissNotice = useCallback(() => setNotice({ message: "", error: false }), []);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const [editPending, setEditPending] = useState(false);
  const navigationBlocked = isSaving || editPending;
  const usedAccountIds = new Set(initiativeDraft.rows.flatMap(row => row.accountId === null ? [] : [row.accountId]));
  const changePlan = async (change: PlanChange) => {
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    saving.current = true; setIsSaving(true);
    try { setContents(await onChangePlan(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };
  const changeDetail = async (change: DetailChange) => {
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    saving.current = true; setIsSaving(true);
    try { setContents(await onChangeDetail(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };
  const changeMaster = async (change: AccountChange) => {
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    if (change.type === "delete" && usedAccountIds.has(change.id)) throw new Error("施策入力で使用している勘定科目は削除できません。");
    saving.current = true;
    setIsSaving(true);
    try { setContents(await onChangeMaster(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };

  const changeKinds = async (change: KindChange) => {
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    saving.current = true; setIsSaving(true);
    try { setContents(await onChangeKinds(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };
  const changePeriodTypes = async (change: PeriodTypeChange) => {
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    if (change.type === "delete" && initiativeDraft.periodTypeId === change.id) throw new Error("施策入力で選択している期間は削除できません。");
    saving.current = true; setIsSaving(true);
    try { setContents(await onChangePeriodTypes(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };
  const changeDepartments = async (change: DepartmentChange) => {
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    if (change.type === "delete" && initiativeDraft.departmentId === change.id) throw new Error("施策入力で選択している部署は削除できません。");
    saving.current = true; setIsSaving(true);
    try { setContents(await onChangeDepartments(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };
  const changeIndustries = async (change: IndustryChange) => {
    if (change.type === "delete" && initiativeDraft.industryId === change.id) throw new Error("施策入力で選択している業種は削除できません。");
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    saving.current = true; setIsSaving(true);
    try { setContents(await onChangeIndustries(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };
  const changeExpansions = async (change: ExpansionChange) => {
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    if (change.type === "delete" && initiativeDraft.expansionId === change.id) throw new Error("施策入力で選択している展開名は削除できません。");
    saving.current = true; setIsSaving(true);
    try { setContents(await onChangeExpansions(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };
  const changeAggregations = async (change: AggregationChange) => {
    if (saving.current) throw new Error("保存が終わるまでお待ちください。");
    saving.current = true;
    setIsSaving(true);
    try { setContents(await onChangeAggregations(change)); }
    finally { saving.current = false; setIsSaving(false); }
  };

  const update = async (draft: InitiativeEntryDraft) => {
    if (!selectedInitiative || saving.current) throw new Error("保存が終わるまでお待ちください。");
    saving.current = true;
    setIsSaving(true);
    try {
      const saved = await onUpdateInitiative(selectedInitiative.id, selectedInitiative.fiscalYear, draft);
      setContents(saved);
      setSelectedInitiative({ id: selectedInitiative.id, fiscalYear: Number(draft.fiscalYear) });
    } finally { saving.current = false; setIsSaving(false); }
  };

  const register = async () => {
    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);
    dismissNotice();
    try {
      const saved = await onRegisterInitiative(initiativeDraft);
      setContents(saved);
      setInitiativeDraft(createInitiativeDraft(initiativeDraft.fiscalYear));
      setPage("initiative-list");
      setNotice({ message: "施策を登録しました。", error: false });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : error instanceof Error ? error.message : "施策を登録できませんでした。", error: !cancelled });
    } finally { saving.current = false; setIsSaving(false); }
  };

  const closeSidebar = useCallback(() => {
    collapseSidebar();
    menuButton.current?.focus();
  }, [collapseSidebar]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        closeSidebar();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen, closeSidebar]);

  return (
    <div className="home-page">
      <header className="home-header">
        <button
          ref={menuButton}
          className="home-icon-button"
          type="button"
          aria-label={isSidebarOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
          aria-controls="home-sidebar"
          aria-expanded={isSidebarOpen}
          onClick={() => isSidebarOpen ? closeSidebar() : sidebar.pin()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="home-brand">
          <img src={appIcon} width="28" height="28" alt="" draggable={false} />
          Triadichrome
        </span>
        <strong className="home-file-name" title={fileName}>{fileName}</strong>
        <span>{contents.fiscalYear}年度</span>
        <button className="text-button" type="button" disabled={navigationBlocked} onClick={() => { void changePlan({ type: "revised", active: !contents.revisedActive }).catch(error => setNotice({ message: error instanceof Error ? error.message : "修正予算の状態を保存できませんでした。", error: true })); }}>{contents.revisedActive ? "確定予算を使う状態に戻す" : "修正予算を開始"}</button>
      </header>
      <div className="home-layout">
        <aside id="home-sidebar" className={`sidebar-panel${isSidebarOpen ? " is-open" : ""}`} aria-label="メニュー"
          onPointerEnter={sidebar.onPointerEnter} onPointerLeave={sidebar.onPointerLeave}
          onFocusCapture={sidebar.onFocusCapture} onBlurCapture={sidebar.onBlurCapture}>
          <div className="sidebar-inner">
          <header className="sidebar-header">
            <SidebarIcon name="file" />
            <strong className="sidebar-label sidebar-file-name" title={fileName}>{fileName}</strong>
            <button className="home-icon-button sidebar-close" type="button" aria-label="サイドバーを閉じる" aria-hidden={!isSidebarOpen} inert={!isSidebarOpen} onClick={closeSidebar}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <nav className="sidebar-navigation" aria-label="メインナビゲーション">
            <button className="sidebar-item" type="button" aria-label="Home" disabled={navigationBlocked} aria-current={page === "home" ? "page" : undefined} onClick={() => setPage("home")}>
              <SidebarIcon name="home" />
              <span className="sidebar-label">Home</span>
            </button>
            <button className="sidebar-item" type="button" aria-label="前年入力" disabled={navigationBlocked} aria-current={page === "previous-input" ? "page" : undefined} onClick={() => setPage("previous-input")}>
              <SidebarIcon name="previous" /><span className="sidebar-label">前年入力</span>
            </button>
            <button className="sidebar-item" type="button" aria-label="施策入力" disabled={navigationBlocked} aria-current={page === "initiative-entry" ? "page" : undefined} onClick={() => setPage("initiative-entry")}>
              <SidebarIcon name="entry" />
              <span className="sidebar-label">施策入力</span>
            </button>
            <button className="sidebar-item" type="button" aria-label="施策一覧" disabled={navigationBlocked} aria-current={page === "initiative-list" || (page === "initiative-detail" && detailOrigin === "initiative-list") ? "page" : undefined} onClick={() => { dismissNotice(); setPage("initiative-list"); }}>
              <SidebarIcon name="list" />
              <span className="sidebar-label">施策一覧</span>
            </button>
            <button className="sidebar-item" type="button" aria-label="総原価表" disabled={navigationBlocked} aria-current={page === "cost-table" ? "page" : undefined} onClick={() => { dismissNotice(); setPage("cost-table"); }}>
              <SidebarIcon name="cost" />
              <span className="sidebar-label">総原価表</span>
            </button>
            <button className="sidebar-item" type="button" aria-label="展開表" disabled={navigationBlocked} aria-current={page === "expansion-table" || (page === "initiative-detail" && detailOrigin === "expansion-table") ? "page" : undefined} onClick={() => { dismissNotice(); setPage("expansion-table"); }}>
              <SidebarIcon name="expansion" />
              <span className="sidebar-label">展開表</span>
            </button>
            <button className="sidebar-item" type="button" aria-label="明細" disabled={navigationBlocked} aria-current={page === "details" || (page === "initiative-detail" && detailOrigin === "details") ? "page" : undefined} onClick={() => { dismissNotice(); setPage("details"); }}>
              <SidebarIcon name="details" /><span className="sidebar-label">明細</span>
            </button>
            <button className="sidebar-item" type="button" aria-label="マスタ" disabled={navigationBlocked} aria-current={page === "master" || page === "account-master" || page === "aggregation-master" || page === "expansion-master" || page === "industry-master" || page === "department-master" || page === "period-master" || page === "kind-master" ? "page" : undefined} onClick={() => setPage("master")}>
              <SidebarIcon name="master" />
              <span className="sidebar-label">マスタ</span>
            </button>
          </nav>
          <footer className="sidebar-footer">
            <button className="sidebar-item" type="button" aria-label="ファイルを閉じる" disabled={navigationBlocked} onClick={onCloseFile}>
              <SidebarIcon name="close-file" />
              <span className="sidebar-label">ファイルを閉じる</span>
            </button>
          </footer>
          </div>
        </aside>
        <div className="home-content" ref={homeContent}>
          <FadeSwap value={page} className="page-switch">
            {displayed => {
              switch (displayed) {
                case "previous-input": return <PreviousInputPage contents={contents} onSave={input => changePlan({ type: "previous", input })} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} />;
                case "details": return <DetailTablePage contents={contents} scroll={detailScroll} onSave={changeDetail} onOpenInitiative={openInitiative} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} />;
                case "home": return <HomeRelationsPage view={relationView} disabled={navigationBlocked} onNavigate={target => { dismissNotice(); setPage(target); }} />;
                case "initiative-entry": return <InitiativeEntryPage revisedActive={contents.revisedActive} draft={initiativeDraft} onDraftChange={setInitiativeDraft} accounts={accounts} expansions={contents.expansions} departments={contents.departments} periodTypes={contents.periodTypes} industries={contents.industries} onOpenMaster={() => setPage("account-master")} isSaving={isSaving} onRegister={() => { void register(); }} />;
                case "initiative-detail": return currentInitiative && <InitiativeDetailPage revisedActive={contents.revisedActive} initiative={currentInitiative} accounts={accounts} expansions={contents.expansions} departments={contents.departments} periodTypes={contents.periodTypes} industries={contents.industries} onOpenMaster={() => setPage("account-master")} onUpdate={update} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} backLabel={detailOrigin === "details" ? "明細" : detailOrigin === "home" ? "Home" : detailOrigin === "expansion-table" ? "展開表" : "施策一覧"} onBack={() => setPage(detailOrigin)} />;
                case "initiative-list": return <InitiativeListPage initiatives={initiativesForKind(contents.initiatives, accounts, contents.kindSelections["initiative-list"][0]!, contents.revisedActive)} fiscalYear={String(contents.fiscalYear)} onOpenInitiative={openInitiative} />;
                case "cost-table": return <CostTablePage contents={contents} selected={contents.kindSelections["cost-table"]} onOpenMaster={() => setPage("aggregation-master")} />;
                case "expansion-table": return <ExpansionTablePage contents={contents} selected={contents.kindSelections["expansion-table"]} onOpenInitiative={openInitiative} />;
                case "master": return <MasterPage onOpenAccounts={() => setPage("account-master")} onOpenAggregations={() => setPage("aggregation-master")} onOpenExpansions={() => setPage("expansion-master")} onOpenIndustries={() => setPage("industry-master")} onOpenDepartments={() => setPage("department-master")} onOpenPeriods={() => setPage("period-master")} onOpenKinds={() => setPage("kind-master")} />;
                case "kind-master": return <KindMasterPage kinds={contents.kinds} isSaving={isSaving} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} onChange={changeKinds} onBack={() => setPage("master")} />;
                case "period-master": return <PeriodMasterPage periodTypes={contents.periodTypes} isSaving={isSaving} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} onChange={changePeriodTypes} onBack={() => setPage("master")} />;
                case "department-master": return <DepartmentMasterPage departments={contents.departments} isSaving={isSaving} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} onChange={changeDepartments} onBack={() => setPage("master")} />;
                case "industry-master": return <IndustryMasterPage industries={contents.industries} isSaving={isSaving} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} onChange={changeIndustries} onBack={() => setPage("master")} />;
                case "expansion-master": return <ExpansionMasterPage usedExpansionIds={new Set([...initiatives.map(item => item.expansionId), initiativeDraft.expansionId].filter((id): id is number => id !== null))} expansions={contents.expansions} isSaving={isSaving} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} onChange={changeExpansions} onBack={() => setPage("master")} />;
                case "aggregation-master": return <AggregationMasterPage accounts={accounts} groups={contents.aggregations} isSaving={isSaving} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} onChange={changeAggregations} onBack={() => setPage("master")} />;
                case "account-master": return <AccountMasterPage accounts={accounts} usedAccountIds={usedAccountIds} isSaving={isSaving} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} onChange={changeMaster} onBack={() => setPage("master")} />;
              }
            }}
          </FadeSwap>
        </div>
      </div>
      <StatusNotice {...notice} onDismiss={dismissNotice} />
    </div>
  );
}
