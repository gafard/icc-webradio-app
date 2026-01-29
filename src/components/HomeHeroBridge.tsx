'use client';

import { useMode } from '../contexts/ModeContext';
import HomeHeroOneToOne from './HomeHeroOneToOne';

type Video = {
  id: string;
  title: string;
  published: string;
  thumbnail: string;
};

export default function HomeHeroBridge({
  latestVideo,
  radioStreamUrl,
}: {
  latestVideo: Video | null;
  radioStreamUrl: string;
}) {
  const { mode } = useMode(); // ✅ ModeContext -> { mode, toggleMode }

  return (
    <HomeHeroOneToOne
      mode={mode}
      latestVideo={latestVideo}
      radioStreamUrl={radioStreamUrl}
      customRadioImage="/hero-radio-new.jpg"
    />
  );
}