import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { ProductPage } from '@/product/ProductPage'
import { CaseStudy } from '@/case/CaseStudy'
import { DemoProvider } from '@/demo/DemoContext'
import DebugPage from '@/pages/DebugPage'

// Three routes (PRODUCT.md §5): "/" is the product, "/case-study" the write-up, "/debug" the engine
// tables. vercel.json rewrites every path to index.html, so a hard refresh on /case-study works.
const path = window.location.pathname.replace(/\/+$/, '') || '/'
const TITLES: Record<string, string> = {
  '/': 'Tax & Cost Insights',
  '/case-study': 'Tax & Cost Insights · case study',
  '/debug': 'Tax & Cost Insights · engine debug',
}
document.title = TITLES[path] ?? TITLES['/']

const page =
  path === '/debug' ? (
    <DebugPage />
  ) : path === '/case-study' ? (
    <CaseStudy />
  ) : (
    <DemoProvider>
      <ProductPage />
    </DemoProvider>
  )

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      {page}
      <Toaster position="bottom-center" />
    </TooltipProvider>
  </StrictMode>,
)
