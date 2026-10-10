# Project Report: FruitScanner — Multi-Modal Fruit Ripeness & Quality Assessment System

---

## 1. Executive Summary

**FruitScanner** is a cross-platform mobile and web application engineered to assess fruit ripeness, classification, and physical quality through a dual-modality sensing approach:
1. **Computer Vision (Visual Analysis)**: Utilizing neural network models (TensorFlow Lite / Google Teachable Machine) to detect fruit type and optical ripeness stages based on surface pigmentation and skin patterns.
2. **Acoustic Resonance & Haptic Feedback (Physical Firmness)**: Leveraging device-native actuators and microphones via `expo-haptics` and `expo-av` to evaluate internal acoustic resonance as an indicator of firmness/internal texture.

Built on the **Expo 57** ecosystem with **React Native 0.86** and modern glassmorphic UI principles, the application bridges edge artificial intelligence with hardware-level sensing to provide consumers and agricultural inspectors with non-destructive fruit assessment.

---

## 2. Problem Statement & Motivation

### 2.1 The Challenge
- In both commercial supply chains and household shopping, visually inspecting fruit is often insufficient to judge inner ripeness and firmness accurately.
- Traditional physical testing (e.g., penetrometers, refractometers) is destructive, damaging the produce and causing economic waste.
- Consumers frequently buy fruits (e.g., watermelons, apples, avocados) that look ripe externally but are either overripe or unpleasantly raw internally.

### 2.2 The Solution
FruitScanner offers a **non-destructive, zero-hardware-overhead inspection tool** using consumer smartphones:
- **Vision Subsystem**: Classifies ripeness percentages (0-20%, 20-40%, 40-60%, 60-80%, 100%) across various fruit cultivars (Apples, Bananas, Oranges, Watermelons).
- **Acoustic Resonance Subsystem**: Fires a physical impulse vibration into the fruit flesh and captures the resulting acoustic response via microphone metering to classify density/firmness into "Firm (Raw)", "Perfectly Ripe", or "Soft (Overripe)".

---

## 3. System Architecture & Tech Stack

### 3.1 Architecture Overview

```
+---------------------------------------------------------------------------------+
|                               Presentation Layer                                |
|   (Expo Router v57, React 19, Reanimated 4, Expo Glass Effect, Expo Symbols)    |
+---------------------------------------+-----------------------------------------+
                                        |
         +------------------------------+------------------------------+
         |                                                             |
         v                                                             v
+--------------------------------+           +------------------------------------+
|     Vision Inference Engine    |           |    Acoustic / Sensor Engine        |
|  (tfliteHelper / Web Engine)   |           |         (firmnessHelper)           |
+--------------------------------+           +------------------------------------+
| • Mobile: react-native-fast-   |           | • Expo Haptics: Heavy impact pulse |
|   tflite / expo-camera         |           | • Expo AV: High-quality audio      |
| • Web: @teachablemachine/image |           |   recording & metering engine      |
|   + @tensorflow/tfjs           |           | • Decibel thresholding & resonance |
| • Quantized TFLite (2.1 MB)    |           |   categorization                   |
+--------------------------------+           +------------------------------------+
```

### 3.2 Technology Stack

| Component | Library / Framework | Version | Role |
| :--- | :--- | :--- | :--- |
| **Framework** | Expo | `~57.0.15` | Native app foundation & build pipeline |
| **Core UI Engine** | React / React Native | `19.2.3` / `0.86.2` | Core component rendering engine |
| **Routing** | `expo-router` | `~57.0.15` | File-based typed routing (`src/app/`) |
| **Vision Capture** | `expo-camera` | `^57.0.4` | Real-time camera viewfinder & capture |
| **Media Manipulation**| `expo-image-manipulator` | `^57.0.12` | Image resizing (224x224) & compression |
| **Mobile ML Engine** | `react-native-fast-tflite` | `^3.0.1` | Native TensorFlow Lite inference |
| **Web ML Engine** | `@teachablemachine/image` + `@tensorflow/tfjs` | `^0.8.5` / `^4.22.0` | Browser-based neural network execution |
| **Acoustics & Sound** | `expo-av` | `^16.0.8` | Audio metering and acoustic sampling |
| **Haptic Actuation** | `expo-haptics` | `^57.0.1` | Controlled mechanical excitation pulse |
| **Animations & UI** | `react-native-reanimated`, `expo-glass-effect`, `expo-symbols` | Latest Expo 57 | Dynamic glassmorphism & fluid animations |

---

## 4. Key Functional Modules & Implementation

### 4.1 Vision-Based Ripeness Classification (`src/utils/tfliteHelper.js` & `.web.js`)
- **Model Architecture**: Convolutional Neural Network trained on fruit ripeness stages with input dimensions $224 \times 224 \times 3$.
- **Classes**: 19 classes categorizing ripeness indices across multiple fruit varieties:
  - *Apple*: `apple_0_20`, `apple_20_40`, `apple_40_60`, `apple_60_80`, `apple_100`
  - *Banana*: `banana_0_20`, `banana_20_40`, `banana_40_60`, `banana_60_80`, `banana_100`
  - *Orange*: `orange_0_20`, `orange_20_40`, `orange_60_80`, `orange_100`
  - *Watermelon*: `watermelon_0_20`, `watermelon_20_40`, `watermelon_40_60`, `watermelon_60_80`, `watermelon_100`
- **Platform Adaptation**:
  - **Mobile**: Loads quantized `model.tflite` (2.09 MB) via `react-native-fast-tflite`.
  - **Web**: Asynchronously fetches hosted model graphs from Google Teachable Machine via `@tensorflow/tfjs`.

### 4.2 Acoustic Resonance Firmness Testing (`src/utils/firmnessHelper.js`)
Acoustic testing mimics the traditional "thumping" technique used to test dense fruits (e.g., watermelons, melons, apples):
1. **Excitation**: Triggered via `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)`.
2. **Measurement**: Immediate audio recording window (500 ms) configured in high quality with audio metering enabled.
3. **Classification**:
   - $\text{Peak Decibels} > -15\text{ dB}$: **Firm (Raw)** (Higher density, high acoustic reflection)
   - $-35\text{ dB} < \text{Peak Decibels} \le -15\text{ dB}$: **Perfectly Ripe** (Optimal resonance & internal water tension)
   - $\text{Peak Decibels} \le -35\text{ dB}$: **Soft (Overripe)** (Internal air voids / acoustic dampening)

### 4.3 User Interface & Experience (`src/app/index.tsx`)
- **Glassmorphic Floating HUD**: Uses `GlassView` with dark blurring and thin translucent borders (`rgba(255, 255, 255, 0.15)`).
- **Interactive Viewfinder**: Full-screen camera stream with instant permission handling.
- **Micro-Interactions**: Spring-loaded responsive action buttons using `react-native-reanimated`.
- **Cross-Platform Compatibility**: Automatically swaps acoustic actuation for gallery upload when executed in web environments.

---

## 5. Permissions & Device Integration (`app.json`)

The application integrates with Android and iOS system permissions:
- `android.permission.CAMERA`: Live preview and snapshot capture for visual inference.
- `android.permission.RECORD_AUDIO`: Sampling acoustic frequency and metering levels.
- `android.permission.VIBRATE`: Triggering mechanical impulse for resonance testing.
- `android.permission.MODIFY_AUDIO_SETTINGS`: Calibrating microphone sensitivities for low-noise measurement.

---

## 6. Challenges & Solutions

| Challenge | Impact | Resolution |
| :--- | :--- | :--- |
| **Cross-Platform ML Discrepancies** | Web browsers cannot execute native C++ TFLite binaries directly. | Implemented platform-specific drivers (`tfliteHelper.js` vs. `tfliteHelper.web.js`) with fallback to TF.js on web. |
| **Acoustic Noise Interference** | Ambient room noise could distort firmness readings. | Isolated the capture window to 500 ms post-actuation and normalized audio levels via peak metering. |
| **Real-time Mobile Image Processing** | Transferring 12MP+ camera frames directly into ML models exhausts memory. | Integrated `expo-image-manipulator` to downscale photos to $224 \times 224$ prior to tensor parsing. |

---

## 7. Future Scope & Roadmap

1. **Enhanced Sensor Fusion**: Combine visual confidence score and acoustic decibel index into a unified **Ripeness Index Score (0 - 100%)**.
2. **Real-time Camera Frame Processing**: Transition to `react-native-vision-camera` frame processors for live continuous bounding-box detection.
3. **Spectrogram Analysis**: Replace simple peak decibel thresholding with FFT (Fast Fourier Transform) frequency spectrum profiling to detect internal sugar/water ratios.
4. **Offline Historical Logs & Export**: Allow grocery shoppers and farmers to record batch scans with GPS tags and export reports as PDF/CSV.

---

## 8. Conclusion

**FruitScanner** demonstrates a modern, practical implementation of edge computing and multi-modal sensing on commodity smartphones. By coupling computer vision with haptic-acoustic resonance testing in an elegant, glassmorphic UI, it provides an accessible, non-destructive tool for evaluating fruit ripeness and freshness.
