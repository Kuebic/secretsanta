import './index.css';
import './i18n/config';
import '@fontsource/cherry-swash/400.css';
import '@fontsource/cherry-swash/700.css';
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, useNavigate, useSearchParams } from "react-router-dom";
import { Home } from './pages/Home';
import { Pairing } from './pages/Pairing';
import { OrganizerEvent } from './pages/OrganizerEvent';
import { ParticipantEvent } from './pages/ParticipantEvent';
import { useEffect } from 'react';
import { migrateLegacyStorage } from './utils/legacyStorage';

function Redirect({ to }: { to: string }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`${to}?${searchParams.toString()}`);
  }, []);

  return null;
}

const router = createBrowserRouter([{
  path: "/",
  element: <Home />,
}, {
  path: "/o/:eventId",
  element: <OrganizerEvent />,
}, {
  path: "/p/:eventId/:participantId",
  element: <ParticipantEvent />,
}, {
  path: "/pairing",
  element: <Pairing />,
}, {
  path: "/pairing.html",
  element: <Redirect to="/pairing" />
}], {
  // @ts-ignore
  basename: import.meta.env.BASE_URL,
});

void migrateLegacyStorage();

const root = createRoot(document.getElementById("root")!);
root.render(
  <RouterProvider router={router} />
); 