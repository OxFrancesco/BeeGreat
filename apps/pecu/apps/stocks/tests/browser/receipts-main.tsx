import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MessageResponse } from "../../src/components/ai-elements/message";
import cases from "../../../../tests/fixtures/presentation/receipts.json";
import "./fixture.css";
function ReceiptsFixture() {
  const [index, setIndex] = useState(0);
  return <main className="pecu transaction-fixture">
    <h1>Receipt replies</h1><p>Fictional data. No transaction is submitted.</p>
    <div className="transaction-fixture-controls"><label>Example<select value={index} onChange={(event) => setIndex(Number(event.target.value))}>{cases.map((example, i) => <option key={example.name} value={i}>{example.name}</option>)}</select></label></div>
    <MessageResponse key={index}>{cases[index]!.input}</MessageResponse>
  </main>;
}
createRoot(document.getElementById("root")!).render(<ReceiptsFixture />);
