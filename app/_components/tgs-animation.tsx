"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";

type TgsAnimationProps = Readonly<{
  ariaLabel: string;
  className?: string;
  src: string;
}>;

export function TgsAnimation({ ariaLabel, className, src }: TgsAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let animation: AnimationItem | undefined;

    const loadAnimation = async () => {
      try {
        const response = await fetch(src, { signal: abortController.signal });

        if (!response.ok || !response.body) {
          return;
        }

        const decompressedStream = response.body.pipeThrough(
          new DecompressionStream("gzip"),
        );
        const animationData = await new Response(decompressedStream).json();

        if (abortController.signal.aborted || !containerRef.current) {
          return;
        }

        const lottie = (await import("lottie-web")).default;

        animation = lottie.loadAnimation({
          animationData,
          autoplay: true,
          container: containerRef.current,
          loop: true,
          renderer: "svg",
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Не удалось загрузить анимацию выбора группы.", error);
        }
      }
    };

    void loadAnimation();

    return () => {
      abortController.abort();
      animation?.destroy();
    };
  }, [src]);

  return <div aria-label={ariaLabel} className={className} ref={containerRef} role="img" />;
}
