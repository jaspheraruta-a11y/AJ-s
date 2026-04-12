import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ShopView from './views/ShopView';
import AdminDashboardWrapper from './views/AdminDashboardWrapper';
import StaffDashboardWrapper from './views/StaffDashboardWrapper';
import PaymentDashboard from './views/PaymentDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ShopView />} />
        <Route path="/admin" element={<AdminDashboardWrapper />} />
        <Route path="/staff" element={<StaffDashboardWrapper />} />
        <Route path="/payment" element={<PaymentDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
