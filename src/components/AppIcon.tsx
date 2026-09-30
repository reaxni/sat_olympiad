import dashboardIcon from '../../assets/icons/dashboard_icon.svg';
import rankingIcon from '../../assets/icons/ranking_icon.svg';
import profileIcon from '../../assets/icons/profile_icon.svg';
import './AppIcon.css';

const icons = { dashboard: dashboardIcon, ranking: rankingIcon, profile: profileIcon };

export function AppIcon({ name }: { name: keyof typeof icons }) {
  return <img className="app-icon" src={icons[name]} alt="" aria-hidden="true" width={22} height={22} />;
}
