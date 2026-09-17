import { HomePageView } from './home/home-page-view';
import { useHomePageController } from './home/use-home-page-controller';

export default function HomePage() {
  return <HomePageView {...useHomePageController()} />;
}
