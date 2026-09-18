import { createRoot } from 'react-dom/client'
import { AuthRoot } from '@/components/AuthRoot';
import App from './App.tsx'
import './index.css'
import './theme.css'

// This entry only imports and mounts. Never define a component here — put
// providers and guards in their own modules and import them. A component in
// this file makes the next hot reload run createRoot a second time on #root.

// design.css is @import'ed from index.css so it shares the Tailwind PostCSS
// pass — don't import it here.

createRoot(document.getElementById("root")!).render(
  <AuthRoot>
    <App />
  </AuthRoot>
);
