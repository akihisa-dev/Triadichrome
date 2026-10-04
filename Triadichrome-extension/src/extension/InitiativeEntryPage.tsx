type InitiativeEntryPageProps = {
  initiativeName: string;
  onInitiativeNameChange: (name: string) => void;
};

export function InitiativeEntryPage({ initiativeName, onInitiativeNameChange }: InitiativeEntryPageProps) {
  return (
    <main className="initiative-entry-page" aria-labelledby="initiative-entry-title">
      <h1 id="initiative-entry-title">施策入力</h1>
      <div className="initiative-name-field">
        <label htmlFor="initiative-name">施策名</label>
        <input
          id="initiative-name"
          name="initiativeName"
          type="text"
          autoComplete="off"
          value={initiativeName}
          onChange={event => onInitiativeNameChange(event.target.value)}
        />
      </div>
    </main>
  );
}
