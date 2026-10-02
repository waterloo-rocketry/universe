import { APP_NAME } from '../shared';
import { Header } from './components/Header';

export default function App() {
  return (
    <div className="app-shell">
      <Header title={APP_NAME} />
      <main>
        <section aria-label="Dashboard">
          <p>Dashboard coming soon</p>
        </section>
      </main>
    </div>
  );
}
