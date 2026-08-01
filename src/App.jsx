import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Landing from './pages/Landing.jsx';
import Room from './pages/Room.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/room/:id"
            element={(
              <ProtectedRoute>
                <Room />
              </ProtectedRoute>
            )}
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
