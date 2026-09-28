import { useAuthenticatedApi } from '../api/context';
import { Card } from '../components/ui';

export function Profile() {
  const { student } = useAuthenticatedApi();
  return <div className="page-container profile-page"><h1>Profile</h1><p className="muted">Your account information.</p><Card><dl><dt>Full name</dt><dd>{student.name}</dd><dt>Email</dt><dd>{student.email}</dd></dl></Card></div>;
}
