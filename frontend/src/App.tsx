import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "sonner"
import { Layout } from "@/components/layout/Layout"
import { Dashboard } from "@/pages/Dashboard"
import { CreateApp } from "@/pages/CreateApp"
import { AppDetail } from "@/pages/AppDetail"
import { LoginPage } from "@/pages/LoginPage"
import { ConsentPage } from "@/pages/ConsentPage"
import { AdminLayout } from "@/pages/admin/AdminLayout"
import { ScopeManagement } from "@/pages/admin/ScopeManagement"
import { ClaimsManagement } from "@/pages/admin/ClaimsManagement"

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* OAuth flow pages (outside Layout) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/consent" element={<ConsentPage />} />

          {/* Admin dashboard pages */}
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/apps/new" element={<CreateApp />} />
            <Route path="/apps/:id" element={<AppDetail />} />
          </Route>

          {/* Admin section */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/scopes" replace />} />
            <Route path="scopes" element={<ScopeManagement />} />
            <Route path="claims" element={<ClaimsManagement />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster theme="light" richColors position="bottom-right" />
    </>
  )
}

export default App
