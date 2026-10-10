import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { initModel, runVisionInference } from '../utils/tfliteHelper';
import { testFirmness } from '../utils/firmnessHelper';
import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Cross-platform icon mapping supporting iOS SF Symbols & Android/Web Material Symbols
interface IconSpec {
  ios: any;
  android: string;
  web: string;
  fallback: string;
}

const ICONS: Record<string, IconSpec> = {
  camera: { ios: 'camera.viewfinder', android: 'photo_camera', web: 'photo_camera', fallback: '📷' },
  upload: { ios: 'photo.fill', android: 'image', web: 'image', fallback: '🖼️' },
  acoustic: { ios: 'waveform.path.ecg', android: 'graphic_eq', web: 'graphic_eq', fallback: '🔊' },
  eye: { ios: 'eye.fill', android: 'visibility', web: 'visibility', fallback: '👁️' },
  resonance: { ios: 'waveform', android: 'sensors', web: 'sensors', fallback: '〰️' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle', fallback: '✓' },
};

function AppIcon({ type, size = 22, color = '#fff' }: { type: string; size?: number; color?: string }) {
  const icon = ICONS[type] || ICONS.camera;
  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.android, web: icon.web } as any}
      size={size}
      tintColor={color}
      fallback={<Text style={{ fontSize: size - 4, color }}>{icon.fallback}</Text>}
    />
  );
}

interface AnimatedButtonProps {
  iconType: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  color: string;
  isLoading: boolean;
}

const AnimatedButton = ({ iconType, label, onPress, disabled, color, isLoading }: AnimatedButtonProps) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.92); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionButton, 
        { backgroundColor: disabled ? `${color}70` : color },
        animatedStyle
      ]}
    >
      <View style={styles.buttonContent}>
        {isLoading ? (
          <ActivityIndicator color="#fff" size="small" style={styles.buttonIcon} />
        ) : (
          <View style={styles.buttonIcon}>
            <AppIcon type={iconType} size={20} color="#fff" />
          </View>
        )}
        <Text style={styles.actionButtonText}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
};

// Formats classification strings like "apple_60_80" into human-friendly representation
const formatVisionResult = (raw: string) => {
  if (!raw || raw.includes('...') || raw.includes('Awaiting') || raw.includes('Error')) {
    return { title: raw, stage: '', fruit: '', badgeColor: '#64748b' };
  }
  
  const clean = raw.toLowerCase().trim();
  const parts = clean.split('_');
  const fruitName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Fruit';
  
  let stageText = 'Ripeness Assessed';
  let badgeColor = '#10b981';

  if (clean.includes('0_20')) {
    stageText = '0 - 20% (Unripe / Raw)';
    badgeColor = '#ef4444';
  } else if (clean.includes('20_40')) {
    stageText = '20 - 40% (Early Ripening)';
    badgeColor = '#f59e0b';
  } else if (clean.includes('40_60')) {
    stageText = '40 - 60% (Mid Ripening)';
    badgeColor = '#eab308';
  } else if (clean.includes('60_80')) {
    stageText = '60 - 80% (Prime Ripe)';
    badgeColor = '#10b981';
  } else if (clean.includes('100')) {
    stageText = '100% (Fully Ripe)';
    badgeColor = '#06b6d4';
  }

  return {
    title: `${fruitName}`,
    stage: stageText,
    fruit: fruitName,
    badgeColor,
  };
};

export default function App() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [modelReady, setModelReady] = useState(false);
  
  const [visionStatus, setVisionStatus] = useState('Awaiting analysis...');
  const [firmnessStatus, setFirmnessStatus] = useState('Awaiting test...');
  const [decibelsValue, setDecibelsValue] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTestingFirmness, setIsTestingFirmness] = useState(false);
  
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    let isMounted = true;
    const loadModel = async () => {
      try {
        const success = await initModel();
        if (isMounted) setModelReady(success);
      } catch (e) {
        console.warn('initModel error caught:', e);
        if (isMounted) setModelReady(true);
      }
    };
    loadModel();
    return () => { isMounted = false; };
  }, []);

  const handleAnalyzeVision = async () => {
    if (!cameraRef.current) return;
    setIsAnalyzing(true);
    setVisionStatus('Analyzing camera frame...');
    
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo && photo.uri) {
        const result = await runVisionInference(photo.uri);
        setVisionStatus(result);
      } else {
        setVisionStatus('Capture failed, please retry');
      }
    } catch (err) {
      console.error('Vision analysis error:', err);
      setVisionStatus('Error analyzing image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTestFirmness = async () => {
    setIsTestingFirmness(true);
    setFirmnessStatus('Testing acoustic resonance...');
    setDecibelsValue(null);
    
    try {
      const { result, decibels } = await testFirmness();
      setFirmnessStatus(result);
      setDecibelsValue(decibels);
    } catch (err: any) {
      console.error('Firmness testing error:', err);
      setFirmnessStatus(err?.message || 'Error testing firmness');
    } finally {
      setIsTestingFirmness(false);
    }
  };

  const handleUploadImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsAnalyzing(true);
        setVisionStatus('Analyzing selected image...');
        
        try {
          const inferenceResult = await runVisionInference(result.assets[0].uri);
          setVisionStatus(inferenceResult);
        } catch (err) {
          console.error('Upload analysis error:', err);
          setVisionStatus('Error analyzing image');
        } finally {
          setIsAnalyzing(false);
        }
      }
    } catch (pickerErr) {
      console.warn('Image picker canceled or failed:', pickerErr);
    }
  };

  const formattedVision = formatVisionResult(visionStatus);

  return (
    <View style={styles.container}>
      {/* Background Camera (Rendered without nested children for Android stability) */}
      {permission?.granted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          ref={cameraRef}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cameraFallback]}>
          <Text style={styles.cameraFallbackTitle}>Camera Access</Text>
          <Text style={styles.cameraFallbackSubtitle}>
            {permission ? 'Camera permission is required for live scanning' : 'Checking camera permission...'}
          </Text>
          {permission && !permission.granted && (
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Enable Camera</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Target Reticle Viewfinder Overlay */}
      {permission?.granted && (
        <View style={styles.reticleContainer} pointerEvents="none">
          <View style={styles.reticleBox}>
            <View style={[styles.reticleCorner, styles.cornerTL]} />
            <View style={[styles.reticleCorner, styles.cornerTR]} />
            <View style={[styles.reticleCorner, styles.cornerBL]} />
            <View style={[styles.reticleCorner, styles.cornerBR]} />
            <Text style={styles.reticleHint}>Center fruit within frame</Text>
          </View>
        </View>
      )}

      {/* Top Header Floating Glass View */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <GlassView glassEffectStyle="regular" colorScheme="dark" style={styles.headerGlass}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>FruitScanner</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>AI DUAL-SENSE</Text>
            </View>
          </View>
        </GlassView>
      </View>

      {/* Floating Bottom Dashboard Overlay */}
      <View style={[styles.bottomOverlay, { paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : 28 }]} pointerEvents="box-none">
        <GlassView glassEffectStyle="regular" colorScheme="dark" style={styles.bottomGlass}>
          
          {/* Assessment Results Card */}
          <View style={styles.resultsCard}>
            
            {/* Vision Ripeness Section */}
            <View style={styles.resultRow}>
              <View style={styles.resultLabelContainer}>
                <AppIcon type="eye" size={18} color="#00ffcc" />
                <Text style={styles.resultLabel}>Ripeness (Vision):</Text>
              </View>
              {formattedVision.stage ? (
                <View style={[styles.tagBadge, { backgroundColor: formattedVision.badgeColor }]}>
                  <Text style={styles.tagBadgeText}>{formattedVision.title}: {formattedVision.stage}</Text>
                </View>
              ) : (
                <Text style={styles.resultValue}>{visionStatus}</Text>
              )}
            </View>

            <View style={styles.divider} />

            {/* Acoustic Firmness Section */}
            <View style={styles.resultRow}>
              <View style={styles.resultLabelContainer}>
                <AppIcon type="acoustic" size={18} color="#10b981" />
                <Text style={styles.resultLabel}>Firmness (Acoustic):</Text>
              </View>
              <Text style={[styles.resultValue, firmnessStatus.includes('Ripe') && styles.ripeValue]}>
                {firmnessStatus}{decibelsValue !== null ? ` (${decibelsValue} dB)` : ''}
              </Text>
            </View>
          </View>

          {/* Action Controls Row */}
          <View style={styles.controlsRow}>
            {/* Camera Vision Button */}
            {permission?.granted && (
              <AnimatedButton 
                iconType="camera"
                label={isAnalyzing ? 'Scanning' : 'Scan'}
                onPress={handleAnalyzeVision}
                disabled={isAnalyzing || !modelReady}
                color="#2563eb"
                isLoading={isAnalyzing}
              />
            )}

            {/* Gallery Upload Button (available on mobile and web) */}
            <AnimatedButton 
              iconType="upload"
              label="Gallery"
              onPress={handleUploadImage}
              disabled={isAnalyzing || !modelReady}
              color="#7c3aed"
              isLoading={false}
            />

            {/* Acoustic Resonance Test Button */}
            <AnimatedButton 
              iconType="resonance"
              label={isTestingFirmness ? 'Testing' : 'Acoustic'}
              onPress={handleTestFirmness}
              disabled={isTestingFirmness}
              color="#059669"
              isLoading={isTestingFirmness}
            />
          </View>

          {/* Loading Indicator */}
          {!modelReady && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#00ffcc" />
              <Text style={styles.loadingText}>Calibrating Neural Vision Engine...</Text>
            </View>
          )}
        </GlassView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a0f',
  },
  cameraFallback: {
    backgroundColor: '#0d1117',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  cameraFallbackTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  cameraFallbackSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 280,
  },
  permissionButton: {
    backgroundColor: '#00ffcc',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#00ffcc',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  permissionButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  reticleContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  reticleBox: {
    width: width * 0.65,
    height: width * 0.65,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#00ffcc',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  reticleHint: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  headerGlass: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  badge: {
    marginLeft: 10,
    backgroundColor: 'rgba(0, 255, 204, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 204, 0.35)',
  },
  badgeText: {
    color: '#00ffcc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  bottomGlass: {
    padding: 20,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  resultsCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  resultLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  resultValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    maxWidth: '55%',
    textAlign: 'right',
  },
  ripeValue: {
    color: '#34d399',
  },
  tagBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    maxWidth: '55%',
  },
  tagBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  loadingText: {
    color: '#00ffcc',
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '500',
  },
});
