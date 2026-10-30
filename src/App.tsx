import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { VerificationBanner } from './components/VerificationBanner';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToTop } from './components/ScrollToTop';
import { AuthProvider } from './context/AuthContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { AdminRoute, UserRoute, GuestRoute } from './components/RouteGuards';

import { Home } from './pages/Home';
import { ProfessionalsListing } from './pages/ProfessionalsListing';
import { PublicProfile } from './pages/PublicProfile';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Account } from './pages/Account';
import { VerifyProfile } from './pages/VerifyProfile';
import { JobsListing } from './pages/JobsListing';
import { JobCreate } from './pages/JobCreate';
import { JobDetail } from './pages/JobDetail';
import { MyJobs } from './pages/MyJobs';
import { MyApplications } from './pages/MyApplications';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminPanel } from './pages/AdminPanel';
import { AdminProfileForm } from './pages/AdminProfileForm';
import { NotFound } from './pages/NotFound';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <SiteSettingsProvider>
            <BrowserRouter>
              <ScrollToTop />
              <div className="min-h-screen flex flex-col bg-[#F4F7FB] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100 transition-colors duration-200">
                <Navbar />
                <VerificationBanner />
                <main className="flex-1">
                  <Routes>
                    {/* Public Directory & Marketplace Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="/professionals" element={<ProfessionalsListing />} />
                    <Route path="/profile/:id" element={<PublicProfile />} />
                    <Route path="/jobs" element={<JobsListing />} />

                    {/* Authenticated User Routes */}
                    <Route path="/jobs/new" element={<UserRoute><JobCreate /></UserRoute>} />
                    <Route path="/jobs/:id/edit" element={<UserRoute><JobCreate /></UserRoute>} />
                    <Route path="/jobs/:id" element={<JobDetail />} />
                    <Route path="/my-jobs" element={<UserRoute><MyJobs /></UserRoute>} />
                    <Route path="/my-applications" element={<UserRoute><MyApplications /></UserRoute>} />
                    <Route path="/notifications" element={<UserRoute><NotificationsPage /></UserRoute>} />
                    <Route path="/verify" element={<UserRoute><VerifyProfile /></UserRoute>} />
                    <Route path="/account" element={<UserRoute><Account /></UserRoute>} />

                    {/* Guest Only Routes */}
                    <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                    <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
                    <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />

                    {/* Admin Panel & Legacy Dashboard Routes (Admin Only) */}
                    <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
                    <Route path="/admin/profiles/new" element={<AdminRoute><AdminProfileForm /></AdminRoute>} />
                    <Route path="/admin/profiles/:id/edit" element={<AdminRoute><AdminProfileForm /></AdminRoute>} />
                    <Route path="/dashboard" element={<AdminRoute><AdminPanel /></AdminRoute>} />
                    <Route path="/dashboard/profiles/new" element={<AdminRoute><AdminProfileForm /></AdminRoute>} />
                    <Route path="/dashboard/profiles/:id/edit" element={<AdminRoute><AdminProfileForm /></AdminRoute>} />

                    {/* Catch-all Not Found */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </main>
                <Footer />
              </div>
            </BrowserRouter>
          </SiteSettingsProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
