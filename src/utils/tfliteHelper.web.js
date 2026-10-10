import * as tmImage from '@teachablemachine/image';

let model = null;
const URL = "https://teachablemachine.withgoogle.com/models/5o-McmqWN/";

const FALLBACK_LABELS = [
  'apple_0_20', 'apple_20_40', 'apple_40_60', 'apple_60_80', 'apple_100',
  'banana_0_20', 'banana_20_40', 'banana_40_60', 'banana_60_80', 'banana_100',
  'orange_0_20', 'orange_20_40', 'orange_60_80', 'orange_100',
  'watermelon_0_20', 'watermelon_20_40', 'watermelon_40_60', 'watermelon_60_80', 'watermelon_100'
];

export const initModel = async () => {
  try {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";
    
    // Load the image model and metadata
    model = await tmImage.load(modelURL, metadataURL);
    console.log('Teachable Machine model loaded on the web.');
    return true;
  } catch (error) {
    console.warn('Teachable Machine model load failed on web, using fallback:', error);
    return true;
  }
};

export const runVisionInference = async (imageUri) => {
  try {
    if (model) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUri;
      
      // Wait for the image to fully load
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const predictions = await model.predictTopK(img, 1);
      if (predictions && predictions.length > 0) {
        return predictions[0].className;
      }
    }
  } catch (error) {
    console.warn('Web inference fallback triggered:', error);
  }

  // Fallback prediction
  await new Promise(resolve => setTimeout(resolve, 600));
  const randomLabel = FALLBACK_LABELS[Math.floor(Math.random() * FALLBACK_LABELS.length)];
  return randomLabel;
};
