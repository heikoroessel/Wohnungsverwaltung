import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ObjektePage from './pages/ObjektePage';
import ObjektDetailPage from './pages/ObjektDetailPage';
import MieterDetailPage from './pages/MieterDetailPage';
import InputPage from './pages/InputPage';
import NebenkostenPage from './pages/NebenkostenPage';
import SteuerberichtPage from './pages/SteuerberichtPage';
import VermoegensPage from './pages/VermoegensPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ObjektePage />} />
        <Route path="/objekte/:id" element={<ObjektDetailPage />} />
        <Route path="/mieter/:id" element={<MieterDetailPage />} />
        <Route path="/input" element={<InputPage />} />
        <Route path="/nebenkosten" element={<NebenkostenPage />} />
        <Route path="/steuerbericht" element={<SteuerberichtPage />} />
        <Route path="/vermoegen" element={<VermoegensPage />} />
      </Route>
    </Routes>
  );
}
