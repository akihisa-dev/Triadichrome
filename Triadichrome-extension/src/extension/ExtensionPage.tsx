import manifest from "../../manifest.template.json";
import "./ExtensionPage.css";

export function ExtensionPage() {
  return (
    <main className="entry-page">
      <div className="entry-content">
        <h1 className="entry-title">Triadichrome</h1>
        <p className="entry-version">v{manifest.version}</p>
        <button className="entry-open-button" type="button">
          ファイルを開く
        </button>
      </div>
    </main>
  );
}
