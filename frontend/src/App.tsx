import { ConnectButton } from "./components/ConnectButton";

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>StealthVault</h1>
        <p className="tagline">Execution is transparent. Strategy is invisible.</p>
        <ConnectButton />
      </header>
      <main className="main">
        <section className="card">
          <h2>Private Strategy Vault</h2>
          <p>
            Submit encrypted trading strategies. Execute on-chain without revealing logic.
            Protect against MEV and copy trading.
          </p>
          <p className="muted">Strategy Registry + Execution Engine + Vault layer — boilerplate ready.</p>
        </section>
      </main>
    </div>
  );
}

export default App;
