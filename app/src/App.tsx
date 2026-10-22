import { Navigate, Route, Routes } from "react-router";
import StoreGate from "./components/StoreGate";
import Today from "./pages/Today";
import Create from "./pages/Create";
import Workbench from "./pages/Workbench";
import Ask from "./pages/Ask";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";

function StoreRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/create" element={<Create />} />
      <Route path="/create/:taskId" element={<Workbench />} />
      <Route path="/ask" element={<Ask />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<StoreGate><StoreRoutes /></StoreGate>} />
    </Routes>
  );
}
