import { useState } from "react";
import { mechanisms, type Mechanism } from "./mechanismModel";
import "./MechanismMap.css";

/** Describes the implementation only. No plan contents, file access or commands enter this view. */
export function MechanismMap({ kind }: { kind: Mechanism["kind"] }) {
  const topics = mechanisms.filter(topic => topic.kind === kind);
  const [selected, select] = useState(topics[0]!.id);
  const topic = topics.find(item => item.id === selected) ?? topics[0]!;
  return <section className="mechanism-map" aria-label={kind === "calculation" ? "計算の仕組み" : "処理の流れ"}>
    <nav className="screen-data-screens" aria-label="確認する仕組み">
      {topics.map(item => <button key={item.id} type="button" aria-pressed={item.id === topic.id} onClick={() => select(item.id)}>{item.name}</button>)}
    </nav>
    <article className="mechanism-content" key={topic.id}>
      <header><h2>{topic.name}</h2><p>{topic.purpose}</p></header>
      <div className="mechanism-inputs"><h3>元になる情報</h3><ul>{topic.inputs.map(input => <li key={input}>{input}</li>)}</ul></div>
      <ol className="mechanism-flow" aria-label={`${topic.name}の流れ`}>
        {topic.steps.map((step, index) => <li key={step.name}><span className="mechanism-step" aria-hidden="true">{index + 1}</span><div><h3>{step.name}</h3><p>{step.detail}</p></div></li>)}
      </ol>
      <div className="mechanism-outcomes">
        <section><h3>条件と例外</h3><ul>{topic.conditions.map(condition => <li key={condition}>{condition}</li>)}</ul></section>
        <section><h3>結果</h3><p>{topic.result}</p><h3>どこに残るか</h3><p>{topic.retention}</p></section>
      </div>
      <details className="mechanism-sources"><summary>説明に対応する実装</summary><ul>{topic.sources.map(source => <li key={source}><code>{source.replace("Triadichrome-extension/src/", "src/")}</code></li>)}</ul></details>
    </article>
  </section>;
}
