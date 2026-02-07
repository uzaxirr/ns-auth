import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "sonner"
import { PrivyAppProvider } from "@/components/providers/PrivyProvider"
import { Layout } from "@/components/layout/Layout"
import { Dashboard } from "@/pages/Dashboard"
import { CreateApp } from "@/pages/CreateApp"
import { AppDetail } from "@/pages/AppDetail"
import { LoginPage } from "@/pages/LoginPage"
import { ConsentPage } from "@/pages/ConsentPage"

function App() {
  return (
    <>
      <BrowserRouter>
        <PrivyAppProvider>
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
          </Routes>
        </PrivyAppProvider>
      </BrowserRouter>
      <Toaster theme="dark" richColors position="bottom-right" />
    </>
  )
}

export default App
