// utils/screenSettings.ts

export const getShadowMapSize = (isSmallScreen: boolean): number => {
  return isSmallScreen ? 512 : 1024;
};
