export const launchNativePlayer = async (_opts?: any) => {
  console.info('[NativePlayer] Native video player deprecated in Manga reader mode.');
};

export const NativePlayer = {
  launch: launchNativePlayer,
  updatePosition: async (_opts?: any) => {},
};
