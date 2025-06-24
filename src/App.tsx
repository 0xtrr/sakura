import { AuthProvider } from './hooks/useAuth';
import { MainLayout } from './components/MainLayout';
import { LoginScreen } from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSpinnerCenter } from './components/LoadingSpinner';
import { ErrorToastManager } from './components/ErrorToast';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinnerCenter />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <MainLayout />;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <ErrorToastManager position="top-right" maxToasts={3} />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
