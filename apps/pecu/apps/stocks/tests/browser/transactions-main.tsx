import { createRoot } from "react-dom/client";
import { TransactionFixture } from "./transactions";
import "./fixture.css";
createRoot(document.getElementById("root")!).render(<TransactionFixture />);
