import { Component, type ReactNode } from "react";
import "./TableCalculationBoundary.css";

type Props = { children: ReactNode; resetKeys: readonly unknown[] };
type State = { error: Error | null; resetKeys: readonly unknown[] };

/** Keep navigation and display controls outside failures in table calculations. */
export class TableCalculationBoundary extends Component<Props, State> {
  state: State = { error: null, resetKeys: this.props.resetKeys };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error("表を表示できませんでした。") };
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    if (props.resetKeys.length !== state.resetKeys.length || props.resetKeys.some((key, index) => !Object.is(key, state.resetKeys[index]))) {
      return { error: null, resetKeys: props.resetKeys };
    }
    return null;
  }

  render() {
    if (this.state.error) return <div className="initiative-list-container table-calculation-error" role="alert">
      <p>{this.state.error.message}</p>
      <p>入力した金額や表示条件を確認してください。</p>
    </div>;
    return this.props.children;
  }
}
