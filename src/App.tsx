import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToTop } from './components/ScrollToTop';
import { AuthProvider } from './context/AuthContext';
import { AdminRoute, UserRoute, GuestRoute } from './components/RouteGuards';

import { Home } from './pages/Home';
import { ProfessionalsListing } from './pages/ProfessionalsListing';
import { PublicProfile } from './pages/PublicProfile';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Account } from './pages/Account';
import { Dashboard } from './pages/Dashboard';
import { AdminProfileForm } from './pages/AdminProfileForm';
import { NotFound } from './pages/NotFound';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <div className="min-h-screen flex flex-col bg-[#F4F7FB] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100 transition-colors duration-200">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/professionals" element={<ProfessionalsListing />} />
                  <Route path="/profile/:id" element={<PublicProfile />} />

                  {/* Guest Only Routes */}
                  <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                  <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
                  <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />

                  {/* User Account Route (Requires Login) */}
                  <Route path="/account" element={<UserRoute><Account /></UserRoute>} />

                  {/* Admin Dashboard Routes (Requires Admin Role) */}
                  <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                  <Route path="/dashboard/profiles/new" element={<AdminRoute><AdminProfileForm /></AdminRoute>} />
                  <Route path="/dashboard/profiles/:id/edit" element={<AdminRoute><AdminProfileForm /></AdminRoute>} />
                  <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/admin/profiles/new" element={<Navigate to="/dashboard/profiles/new" replace />} />
                  <Route path="/admin/profiles/:id/edit" element={<AdminRoute><AdminProfileForm /></AdminRoute>} />

                  {/* Catch-all Not Found */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
            </div>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
