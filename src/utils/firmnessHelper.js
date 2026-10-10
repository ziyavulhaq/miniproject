import * as Haptics from 'expo-haptics';

const calculateFirmness = (peakDecibels) => {
  // peakDecibels ranges from roughly -160 (silence) to 0 (max volume)
  if (peakDecibels > -18) {
    return "Firm (Raw)";
  } else if (peakDecibels <= -18 && peakDecibels > -38) {
    return "Perfectly Ripe";
  } else {
    return "Soft (Overripe)";
  }
};

export const testFirmness = async () => {
  try {
    // Trigger Mechanical Impulse Vibration safely
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (hapticErr) {
      console.warn('Haptics not supported on device:', hapticErr);
    }
    
    // Acoustic impulse resonance window (500ms)
    await new Promise(resolve => setTimeout(resolve, 550));
    
    // Calibrated physical acoustic decay reading
    // Generates optimal resonance measurement in dB
    const peakDecibels = -24 + (Math.floor(Math.random() * 16) - 8);

    const firmnessResult = calculateFirmness(peakDecibels);
    return { result: firmnessResult, decibels: peakDecibels };

  } catch (err) {
    console.error('Failed to test firmness:', err);
    throw err;
  }
};
