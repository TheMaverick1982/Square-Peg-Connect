import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/lib/auth';
import App from './App.tsx'
import './index.css'
import './theme.css'

// design.css is @import'ed from index.css so it shares the Tailwind PostCSS
// pass — don't import it here.

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
