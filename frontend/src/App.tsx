import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Connect from './pages/Connect';
import Dashboard from './pages/Dashboard';
import Export from './pages/Export';
import './styles/custom.css';

const App: React.FC = () => {
  const { isConnected, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route
            path="/"
            element={
              isConnected ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/connect" replace />
              )
            }
          />
          <Route path="/connect" element={<Connect />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/export" element={<Export />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
