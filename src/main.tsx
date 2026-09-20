import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { CaseStudy } from '@/case/CaseStudy'
import { DemoProvider } from '@/demo/DemoContext'
import DebugPage from '@/pages/DebugPage'

// Two routes: "/" is the case study, "/debug" the stage-1 engine tables. vercel.json rewrites every path to index.html.
const isDebug = window.location.pathname.replace(/\/+$/, '') === '/debug'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      {isDebug ? (
        <DebugPage />
      ) : (
        <DemoProvider>
          <CaseStudy />
        </DemoProvider>
      )}
      <Toaster position="bottom-center" />
    </TooltipProvider>
  </StrictMode>,
)
