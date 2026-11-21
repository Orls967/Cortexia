import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppRoutes } from './app/routes';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary title="CORTEXIA Application Error">
      <AppRoutes />
    </ErrorBoundary>
  </StrictMode>,
);
