import { useMutation } from "./useMutation";
import { useScreenHistory } from "./useScreenHistory";
import { initiativesForKind } from "../core/tables/initiatives";
import { KindSelectionSlots } from "./KindSelectionSlots";
import { type KindId, type KindScreen, type PlanChange } from "../core/domain/kinds";
import { PreviousInputPage } from "./PreviousInputPage";
import { KindMasterPage } from "./KindMasterPage";
import { DetailTablePage } from "./DetailTablePage";
import { type DetailChange } from "../core/domain/details";
import { HomeRelationsPage, type RelationView } from "./HomeRelationsPage";
import { type PeriodTypeChange } from "../core/domain/periodMaster";
import { PeriodMasterPage } from "./PeriodMasterPage";
import { type DepartmentChange } from "../core/domain/departmentMaster";
import { DepartmentMasterPage } from "./DepartmentMasterPage";
import { ExpansionTablePage } from "./ExpansionTablePage";
import { type IndustryChange } from "../core/domain/industryMaster";
import { IndustryMasterPage } from "./IndustryMasterPage";
import { type ExpansionChange } from "../core/domain/expansionMaster";
import { ExpansionMasterPage } from "./ExpansionMasterPage";
import { useCallback, useEffect, useRef, useState } from "react";
import { InitiativeEntryPage } from "./InitiativeEntryPage";
import { InitiativeListPage } from "./InitiativeListPage";
import { InitiativeDetailPage } from "./InitiativeDetailPage";
import { createInitiativeDraft, hasInitiativeDraftInput } from "../core/domain/initiativeRules";
import { type Initiative, type InitiativeEntryDraft, type PlanContents } from "../core/domain/plan";
import { StatusNotice } from "./StatusNotice";
import { FadeSwap } from "./FadeSwap";
import { MasterPage } from "./MasterPage";
import { AccountMasterPage } from "./AccountMasterPage";
import { type AccountChange } from "../core/domain/accountMaster";
import { type AggregationChange } from "../core/domain/aggregationMaster";
import { AggregationMasterPage } from "./AggregationMasterPage";
import { CostTablePage } from "./CostTablePage";
import { useSidebar } from "./useSidebar";
import { SidebarIcon } from "./SidebarIcon";
import { DataHistoryPage, historyDate } from "./DataHistoryPage";
import { HistoryReadOnlyContext } from "./HistoryReadOnly";
import { SavedOperationRevisionContext } from "./SavedOperationRevision";
import { ConfirmationDialog } from "./ConfirmationDialog";
import type { DataHistoryEntry, DataHistoryStatus, HistoryDeletion } from "../core/storage/dataHistory";
import "./ScreenHistory.css";
import appIcon from "../../../branding/logo-512.png?no-inline";

export type Page = "data-history" | "previous-input" | "details" | "home" | "initiative-entry" | "initiative-list" | "initiative-detail" | "cost-table" | "expansion-table" | "master" | "account-master" | "aggregation-master" | "expansion-master" | "industry-master" | "department-master" | "period-master" | "kind-master";

type Screen = {
  page: Page;
  selectedInitiative: Pick<Initiative, "id" | "fiscalYear"> | null;
  detailOrigin: "details" | "home" | "initiative-list" | "expansion-table";
};

type HomePageProps = {
  onChangePlan: (change: PlanChange) => Promise<PlanContents>;
  fileName: string;
  initialContents: PlanContents;
  onChangeMaster: (change: AccountChange) => Promise<PlanContents>;
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
  dataHistory: DataHistoryStatus;
  historyError: string;
  historyBusy: boolean;
  onPreviewHistory: (id: number) => Promise<PlanContents>;
  onRestoreHistory: (id: number) => Promise<PlanContents>;
  onDeleteHistory: (deletion: HistoryDeletion) => Promise<void>;
  onRetryHistory: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  operationRevision: number;
  onTravelOperation: (direction: -1 | 1) => Promise<PlanContents>;
};

export function HomePage({ onChangePlan, fileName, initialContents, onChangeMaster, onChangeAggregations, onChangeExpansions, onChangeIndustries, onChangeDepartments, onChangePeriodTypes, onRegisterInitiative, onUpdateInitiative, onPrepareSave, onChangeDetail, onCloseFile, dataHistory, historyError, historyBusy, onPreviewHistory, onRestoreHistory, onDeleteHistory, onRetryHistory, canUndo, canRedo, operationRevision, onTravelOperation }: HomePageProps) {
  const menuButton = useRef<HTMLButtonElement>(null);
  const homeContent = useRef<HTMLDivElement>(null);
  const relationView = useRef<RelationView | null>(null);
  const sidebar = useSidebar();
  const isSidebarOpen = sidebar.expanded;
  const collapseSidebar = sidebar.collapse;
  const screens = useScreenHistory<Screen>({ page: "home", selectedInitiative: null, detailOrigin: "initiative-list" },
    (left, right) => left.page === right.page && left.selectedInitiative?.id === right.selectedInitiative?.id && left.detailOrigin === right.detailOrigin);
  const screen = screens.current;
  const { page, selectedInitiative, detailOrigin } = screen;
  const navigate = screens.navigate;
  const detailScroll = useRef({ top: 0, left: 0 });
  const [initiativeDraft, setInitiativeDraft] = useState(() => createInitiativeDraft(String(initialContents.fiscalYear)));
  const currentContents = initialContents;
  const [preview, setPreview] = useState<{ entry: DataHistoryEntry; contents: PlanContents } | null>(null);
  const [restoreRequested, setRestoreRequested] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const contents = preview?.contents ?? currentContents;
  const assertWritable = () => { if (preview) throw new Error("過去のデータは閲覧専用です。"); };

  const { accounts, initiatives } = contents;
  useEffect(() => {
    if (page === "initiative-detail" && !initiatives.some(item => item.id === selectedInitiative?.id)) {
      navigate({ ...screen, page: detailOrigin, selectedInitiative: null });
    }
  }, [page, initiatives, selectedInitiative, navigate, screen, detailOrigin]);
  const openInitiative = (initiative: Initiative) => {
    dismissNotice();
    navigate({
      page: "initiative-detail",
      detailOrigin: page === "details" ? "details" : page === "home" ? "home" : page === "expansion-table" ? "expansion-table" : "initiative-list",
      selectedInitiative: { id: initiative.id, fiscalYear: initiative.fiscalYear },
    });
  };
  const [notice, setNotice] = useState({ message: "", error: false });
  const dismissNotice = useCallback(() => setNotice({ message: "", error: false }), []);
  const mutation = useMutation(assertWritable);
  const { busy: isSaving, running: saving } = mutation;
  const [editPending, setEditPending] = useState(false);
  const restoreMutation = useMutation();
  const operationMutation = useMutation(assertWritable);
  const navigationBlocked = isSaving || restoreMutation.busy || operationMutation.busy || editPending || historyBusy;
  const [discardRequest, setDiscardRequest] = useState<{ perform: () => void } | null>(null);
  const operationBlocked = navigationBlocked || preview !== null || restoreRequested || discardRequest !== null || hasInitiativeDraftInput(initiativeDraft);
  const travelOperation = async (direction: -1 | 1) => {
    if (operationBlocked || saving.current || operationMutation.running.current || document.querySelector("dialog[open]") || !(direction === -1 ? canUndo : canRedo)) return;
    dismissNotice();
    try {
      const saved = await operationMutation.run(async () => {
        await onPrepareSave();
        return onTravelOperation(direction);
      });
      if (page === "initiative-detail" && !saved.initiatives.some(item => item.id === selectedInitiative?.id)) {
        navigate({ ...screen, page: detailOrigin, selectedInitiative: null });
      }
      setNotice({ message: direction === -1 ? "操作を取り消しました。" : "操作をやり直しました。", error: false });
    } catch (failure) {
      setNotice({ message: failure instanceof Error ? failure.message : "操作を戻せませんでした。", error: true });
    }
  };
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest("input, textarea, select") || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && !(key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey)) return;
      const direction = key === "y" || event.shiftKey ? 1 : -1;
      if (operationBlocked || document.querySelector("dialog[open]") || !(direction === -1 ? canUndo : canRedo)) return;
      event.preventDefault();
      void travelOperation(direction);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });
  const requestNavigation = (next: Screen, perform = () => navigate(next)) => {
    if (navigationBlocked || saving.current || discardRequest) return;
    if (next.page === "initiative-list" && !preview && hasInitiativeDraftInput(initiativeDraft)) {
      setDiscardRequest({ perform });
      return;
    }
    perform();
  };
  const setPage = (next: Page) => requestNavigation({ ...screen, page: next });
  const startInitiative = () => {
    if (preview || navigationBlocked || saving.current) return;
    setInitiativeDraft(createInitiativeDraft(String(contents.fiscalYear)));
    dismissNotice();
    setPage("initiative-entry");
  };
  const usedAccountIds = new Set(initiativeDraft.rows.flatMap(row => row.accountId === null ? [] : [row.accountId]));
  const changePlan = (change: PlanChange) => mutation.run(async () => { await onChangePlan(change); });
  const kindSelection = (screen: KindScreen) => <KindSelectionSlots screen={screen} selected={contents.kindSelections[screen]} disabled={navigationBlocked}
    onChange={(selected: KindId[]) => {
      if (preview) {
        setPreview({ ...preview, contents: { ...contents, kindSelections: { ...contents.kindSelections, [screen]: selected } } });
        return;
      }
      void changePlan({ type: "selection", screen, selected }).catch(error => setNotice({ message: error instanceof Error ? error.message : "種別の選択を保存できませんでした。", error: true }));
    }} />;
  const changeDetail = (change: DetailChange) => mutation.run(async () => { await onChangeDetail(change); });
  const changeMaster = (change: AccountChange) => mutation.run(async () => {
    if (change.type === "delete" && usedAccountIds.has(change.id)) throw new Error("施策入力で使用している勘定科目は削除できません。");
    await onChangeMaster(change);
  });
  const changePeriodTypes = (change: PeriodTypeChange) => mutation.run(async () => {
    if (change.type === "delete" && initiativeDraft.periodTypeId === change.id) throw new Error("施策入力で選択している期間は削除できません。");
    await onChangePeriodTypes(change);
  });
  const changeDepartments = (change: DepartmentChange) => mutation.run(async () => {
    if (change.type === "delete" && initiativeDraft.departmentId === change.id) throw new Error("施策入力で選択している部署は削除できません。");
    await onChangeDepartments(change);
  });
  const changeIndustries = (change: IndustryChange) => mutation.run(async () => {
    if (change.type === "delete" && initiativeDraft.industryId === change.id) throw new Error("施策入力で選択している業種は削除できません。");
    await onChangeIndustries(change);
  });
  const changeExpansions = (change: ExpansionChange) => mutation.run(async () => {
    if (change.type === "delete" && initiativeDraft.expansionId === change.id) throw new Error("施策入力で選択している展開名は削除できません。");
    await onChangeExpansions(change);
  });
  const changeAggregations = (change: AggregationChange) => mutation.run(async () => { await onChangeAggregations(change); });
  const updateSelected = (target: { id: number; fiscalYear: number | null }, draft: InitiativeEntryDraft) => mutation.run(async () => {
    await onUpdateInitiative(target.id, target.fiscalYear, draft);
  });

  const update = async (draft: InitiativeEntryDraft) => {
    if (!selectedInitiative) throw new Error("施策を選択してください。");
    await updateSelected(selectedInitiative, draft);
  };

  const register = async () => {
    if (saving.current) return;
    dismissNotice();
    try {
      await mutation.run(async () => { await onRegisterInitiative(initiativeDraft); });
      setInitiativeDraft(createInitiativeDraft(initiativeDraft.fiscalYear));
      navigate({ ...screen, page: "initiative-list" });
      setNotice({ message: "施策を登録しました。", error: false });
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setNotice({ message: cancelled ? "保存をキャンセルしました。入力内容は残っています。" : error instanceof Error ? error.message : "施策を登録できませんでした。", error: !cancelled });
    }
  };

  const resetScreens = (next: Page) => screens.reset({ page: next, selectedInitiative: null, detailOrigin: "initiative-list" });
  const previewEntry = async (entry: DataHistoryEntry) => {
    if (navigationBlocked || saving.current) return;
    await mutation.run(async () => {
      const past = await onPreviewHistory(entry.id);
      setPreview({ entry, contents: past }); resetScreens("home"); dismissNotice();
    });
  };
  const restorePreview = async () => {
    if (!preview || navigationBlocked || saving.current) return;
    setRestoreError("");
    try {
      // Restoring is the sole write allowed while viewing a past state.
      await restoreMutation.run(async () => { await onRestoreHistory(preview.entry.id); });
      setPreview(null); setRestoreRequested(false); resetScreens("data-history");
      setInitiativeDraft(createInitiativeDraft(String(contents.fiscalYear)));
      setNotice({ message: "選んだ時点に戻しました。復元前の状態も履歴に残っています。", error: false });
    } catch (failure) { setRestoreError(failure instanceof Error ? failure.message : "復元できませんでした。"); }
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
    <HistoryReadOnlyContext value={preview !== null}><SavedOperationRevisionContext value={operationRevision}><div className="home-page">
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
        <div className="home-identity">
          <span className="home-brand">
            <img src={appIcon} width="28" height="28" alt="" draggable={false} />
            Triadichrome
          </span>
          <output className="home-fiscal-year" aria-label="基準年度">{contents.fiscalYear}年度</output>
        </div>
        <nav className="screen-history" aria-label="画面の移動履歴">
          {([-1, 1] as const).map(direction => {
            const label = direction === -1 ? "前の画面に戻る" : "次の画面に進む";
            return <button key={direction} className="home-icon-button" type="button" aria-label={label} title={label}
              disabled={navigationBlocked || (direction === -1 ? !screens.canBack : !screens.canForward)}
              onClick={() => {
                if (navigationBlocked) return;
                dismissNotice();
                requestNavigation(screens.destination(direction), () => screens.travel(direction));
              }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={direction === -1 ? "M19 12H5m6-6-6 6 6 6" : "M5 12h14m-6-6 6 6-6 6"} />
              </svg>
            </button>;
          })}
        </nav>
        <nav className="operation-history" aria-label="操作の取り消し・やり直し">
          {([-1, 1] as const).map(direction => {
            const label = direction === -1 ? "操作を取り消す" : "操作をやり直す";
            return <button key={direction} className="home-icon-button" type="button" aria-label={label}
              title={label}
              disabled={operationBlocked || (direction === -1 ? !canUndo : !canRedo)} onClick={() => { void travelOperation(direction); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={direction === -1 ? "M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12" : "m15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12"} />
              </svg>
            </button>;
          })}
        </nav>
        <strong className="home-file-name" title={fileName}>{fileName}</strong>
        {preview ? <div className="history-preview-controls" aria-label="過去のデータを閲覧中">
          <span className="history-preview-label">{historyDate(preview.entry.recordedAt)} · 閲覧専用</span>
          <button className="secondary-button" type="button" disabled={navigationBlocked} onClick={() => { setPreview(null); resetScreens("data-history"); }}>現在に戻る</button>
          <button className="primary-button" type="button" disabled={navigationBlocked} onClick={() => { setRestoreError(""); setRestoreRequested(true); }}>この時点に戻す</button>
        </div> : null}
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
            <button className="sidebar-item" type="button" aria-label="施策一覧" disabled={navigationBlocked} aria-current={page === "initiative-list" || page === "initiative-entry" || (page === "initiative-detail" && detailOrigin === "initiative-list") ? "page" : undefined} onClick={() => { dismissNotice(); setPage("initiative-list"); }}>
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
            <button className="sidebar-item" type="button" aria-label="履歴" disabled={navigationBlocked || preview !== null} aria-current={page === "data-history" ? "page" : undefined} onClick={() => setPage("data-history")}>
              <SidebarIcon name="history" /><span className="sidebar-label">履歴</span>
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
        <div className="home-content" ref={homeContent} inert={operationMutation.busy}>
          <FadeSwap key={preview ? `past:${preview.entry.id}` : "current"} value={screen} className="page-switch">
            {displayed => {
              const { selectedInitiative, detailOrigin } = displayed;
              const currentInitiative = initiatives.find(item => item.id === selectedInitiative?.id && item.fiscalYear === selectedInitiative?.fiscalYear);
              switch (displayed.page) {
                case "data-history": return <DataHistoryPage entries={dataHistory.entries} busy={navigationBlocked} error={historyError} onPreview={previewEntry} onDelete={onDeleteHistory} onRetry={onRetryHistory} />;
                case "previous-input": return <PreviousInputPage contents={contents} onSave={input => changePlan({ type: "previous", input })} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} />;
                case "details": return <DetailTablePage contents={contents} scroll={detailScroll} onSave={changeDetail} onOpenInitiative={openInitiative} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} />;
                case "home": return <HomeRelationsPage view={relationView} disabled={navigationBlocked} onNavigate={target => { dismissNotice(); setPage(target); }} />;
                case "initiative-entry": return <InitiativeEntryPage onBack={() => setPage("initiative-list")} draft={initiativeDraft} onDraftChange={setInitiativeDraft} accounts={accounts} expansions={contents.expansions} departments={contents.departments} periodTypes={contents.periodTypes} industries={contents.industries} onOpenMaster={() => setPage("account-master")} isSaving={isSaving} onRegister={() => { void register(); }} />;
                case "initiative-detail": return currentInitiative && <InitiativeDetailPage key={currentInitiative.id} initiative={currentInitiative} accounts={accounts} expansions={contents.expansions} departments={contents.departments} periodTypes={contents.periodTypes} industries={contents.industries} onOpenMaster={() => setPage("account-master")} onUpdate={update} onPendingChange={setEditPending} onPrepareSave={onPrepareSave} backLabel={detailOrigin === "details" ? "明細" : detailOrigin === "home" ? "Home" : detailOrigin === "expansion-table" ? "展開表" : "施策一覧"} onBack={() => setPage(detailOrigin)} />;
                case "initiative-list": return <InitiativeListPage onAddInitiative={startInitiative} selectedKind={contents.kindSelections["initiative-list"][0]!} selection={kindSelection("initiative-list")} initiatives={initiativesForKind(contents.initiatives, accounts, contents.kindSelections["initiative-list"][0]!)} fiscalYear={String(contents.fiscalYear)} onOpenInitiative={openInitiative} navigationBlocked={navigationBlocked} />;
                case "cost-table": return <CostTablePage selection={kindSelection("cost-table")} contents={contents} selected={contents.kindSelections["cost-table"]} onOpenMaster={() => setPage("aggregation-master")} />;
                case "expansion-table": return <ExpansionTablePage selection={kindSelection("expansion-table")} contents={contents} selected={contents.kindSelections["expansion-table"]} onOpenInitiative={openInitiative} />;
                case "master": return <MasterPage onOpenAccounts={() => setPage("account-master")} onOpenAggregations={() => setPage("aggregation-master")} onOpenExpansions={() => setPage("expansion-master")} onOpenIndustries={() => setPage("industry-master")} onOpenDepartments={() => setPage("department-master")} onOpenPeriods={() => setPage("period-master")} onOpenKinds={() => setPage("kind-master")} />;
                case "kind-master": return <KindMasterPage kinds={contents.kinds} isSaving={isSaving} onBack={() => setPage("master")} />;
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
      <StatusNotice message={notice.message || historyError} error={notice.message ? notice.error : Boolean(historyError)} onDismiss={dismissNotice} />
      <ConfirmationDialog open={discardRequest !== null} title="入力内容を破棄しますか？" message="登録前の入力を破棄して施策一覧へ戻ります。"
        confirmLabel="破棄して一覧へ戻る" busy={navigationBlocked}
        onCancel={() => setDiscardRequest(null)} onConfirm={() => {
          if (!discardRequest || navigationBlocked) return;
          setInitiativeDraft(createInitiativeDraft(String(currentContents.fiscalYear)));
          dismissNotice();
          setDiscardRequest(null);
          discardRequest.perform();
        }} />
      <ConfirmationDialog open={restoreRequested} title="過去の状態に戻す" message={restoreError || (preview ? `${historyDate(preview.entry.recordedAt)}の状態にファイル全体を戻しますか？ 復元前の状態も履歴に残します。` : "")} confirmLabel={restoreError ? "保存を再試行して戻す" : "この時点に戻す"} busy={isSaving || restoreMutation.busy || historyBusy}
        onCancel={() => setRestoreRequested(false)} onConfirm={() => { void (restoreError ? onPrepareSave().then(restorePreview).catch(failure => setRestoreError(failure instanceof Error ? failure.message : "保存先を選択できませんでした。")) : restorePreview()); }} />
    </div></SavedOperationRevisionContext></HistoryReadOnlyContext>
  );
}
