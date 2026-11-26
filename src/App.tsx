import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell, FullScreenLoader } from './components/AppShell'
import { FeedbackProvider } from './components/Feedback'
import { RequireProfile } from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { HolidaysProvider } from './context/HolidaysContext'

const AuthPage = lazy(() => import('./pages/AuthPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const EntriesPage = lazy(() => import('./pages/EntriesPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const EntryPage = lazy(() => import('./pages/EntryPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

export default function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <AuthProvider>
          <DataProvider>
            <HolidaysProvider>
              <Suspense fallback={<FullScreenLoader />}>
                <Routes>
                  <Route path="/auth" element={<AuthPage />} />
                  <Route
                    element={
                      <RequireProfile>
                        <AppShell />
                      </RequireProfile>
                    }
                  >
                    <Route index element={<DashboardPage />} />
                    <Route path="journal" element={<EntriesPage />} />
                    <Route path="journal/calendar" element={<CalendarPage />} />
                    <Route path="journal/new" element={<EntryPage />} />
                    <Route path="journal/:id/edit" element={<EntryPage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </HolidaysProvider>
          </DataProvider>
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  )
}
