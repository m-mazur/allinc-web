"use client";

import { useEffect, useState } from "react";

// Hero background: a muted looping video on larger screens, the poster image otherwise.
// The video is only added after hydration, and not at all for reduced motion, Save-Data or
// narrow screens, so phones never download it.

type Props = { video: string; poster: string; posterSmall?: string };

export function HeroMedia({ video, poster, posterSmall }: Props) {
  const [play, setPlay] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 768px)");
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const update = () => setPlay(!reduce.matches && wide.matches && !saveData);
    update();
    reduce.addEventListener("change", update);
    wide.addEventListener("change", update);
    return () => {
      reduce.removeEventListener("change", update);
      wide.removeEventListener("change", update);
    };
  }, []);

  return (
    <>
      <picture>
        {posterSmall && <source media="(max-width: 767px)" srcSet={posterSmall} />}
        <img src={poster} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      {play && (
        <video
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
          src={video}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          onPlaying={() => setReady(true)}
        />
      )}
    </>
  );
}
