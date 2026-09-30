import { Capacitor } from '@capacitor/core';

type Strength = 'light' | 'medium' | 'heavy' | 'success';

/** Tactile feedback: native Taptic Engine in the iOS app, vibration on the web. */
export async function haptic(strength: Strength = 'light'): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (strength === 'success') {
        await Haptics.notification({ type: NotificationType.Success });
      } else {
        const style = strength === 'heavy' ? ImpactStyle.Heavy
          : strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light;
        await Haptics.impact({ style });
      }
      return;
    }
    const pattern = strength === 'success' ? [12, 60, 24] : strength === 'heavy' ? 30 : strength === 'medium' ? 18 : 8;
    navigator.vibrate?.(pattern);
  } catch {
    // Haptics are best-effort
  }
}
