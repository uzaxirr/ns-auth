import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "sonner"
import { Layout } from "@/components/layout/Layout"
import { Dashboard } from "@/pages/Dashboard"
import { CreateApp } from "@/pages/CreateApp"
import { AppDetail } from "@/pages/AppDetail"

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/apps/new" element={<CreateApp />} />
            <Route path="/apps/:id" element={<AppDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" richColors position="bottom-right" />
    </>
  )
}

export default App
