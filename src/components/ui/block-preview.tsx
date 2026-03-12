'use client';

import * as THREE from 'three';
import React, { useState, useEffect } from 'react';
import { LoadedBlock } from '@/lib/voxel-types';

interface BlockPreviewProps {
  block: LoadedBlock;
  size?: number;
}

export const BlockPreview: React.FC<BlockPreviewProps> = ({ block, size = 64 }) => {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    // To prevent race conditions if props change quickly
    let isActive = true; 

    const generatePreview = () => {
      if (!block?.geometry) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      
      // Important: Preserve drawing buffer for toDataURL to work
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
      renderer.setSize(size, size);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(5, 10, 7.5);
      scene.add(directionalLight);

      const material = new THREE.MeshStandardMaterial({ color: '#A0A5A9' });
      const mesh = new THREE.Mesh(block.geometry, material);

      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const bSize = box.getSize(new THREE.Vector3());
      const maxSize = Math.max(bSize.x, bSize.y, bSize.z);

      mesh.position.sub(center);
      scene.add(mesh);

      camera.position.z = maxSize * 2.5;
      camera.position.y = maxSize * 1.5;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL();
      
      if (isActive) {
        setDataUrl(url);
      }

      // Cleanup
      renderer.dispose();
      renderer.forceContextLoss(); // More aggressive cleanup
      material.dispose();
      scene.clear();
    };

    // Use a timeout to allow the UI to render before starting heavy work
    const timer = setTimeout(generatePreview, 0);
    
    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [block, size]);

  if (!dataUrl) {
    return <div className="w-full h-full bg-muted rounded-md animate-pulse" />;
  }
  
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt={block.name} className="w-full h-full object-contain" />;
};
