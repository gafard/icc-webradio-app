'use client';

import { useMode } from '../contexts/ModeContext';
import { useSettings } from '../contexts/SettingsContext';
import HomeHeroOneToOne from './HomeHeroOneToOne';
import MobileRadioPlayer from './MobileRadioPlayer';

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
  const { dataSaver } = useSettings();

  return (
    <>
      <MobileRadioPlayer streamUrl={radioStreamUrl} />
      <HomeHeroOneToOne
        mode={mode}
        latestVideo={latestVideo}
        radioStreamUrl={radioStreamUrl}
        customRadioImage="/hero-radio-new.jpg"
        dataSaver={dataSaver}
      />
    </>
  );
}
