import { ReactNode, useMemo } from "react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";

interface EmotionCacheProviderProps {
  children?: ReactNode;
}

export const EmotionCacheProvider = ({
  children,
}: EmotionCacheProviderProps) => {
  const emotionCache = useMemo(
    () => createCache({ key: "emotion", nonce: "2726c7f26c" }),
    [],
  );

  return <CacheProvider value={emotionCache}>{children}</CacheProvider>;
};
