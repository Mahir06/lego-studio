'use client';

import * as THREE from 'three';

// This function creates a THREE.Sprite that displays text.
function makeTextSprite(message: string, parameters?: {
    fontface?: string,
    fontsize?: number,
    backgroundColor?: { r: number, g: number, b: number, a: number },
    textColor?: { r: number, g: number, b: number, a: number }
}) {
    const {
        fontface = 'Nunito',
        fontsize = 48,
        backgroundColor = { r: 20, g: 20, b: 20, a: 0.5 },
        textColor = { r: 255, g: 255, b: 255, a: 1.0 },
    } = parameters || {};

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    const font = `Bold ${fontsize}px ${fontface}`;
    context.font = font;

    // Measure text and add padding
    const metrics = context.measureText(message);
    const textWidth = metrics.width;
    const padding = 20;
    canvas.width = textWidth + padding;
    canvas.height = fontsize + padding;

    // Re-apply font after canvas resize (it can be reset)
    context.font = font;

    // Background
    context.fillStyle = `rgba(${backgroundColor.r},${backgroundColor.g},${backgroundColor.b},${backgroundColor.a})`;
    const cornerRadius = 20;
    context.beginPath();
    context.moveTo(cornerRadius, 0);
    context.lineTo(canvas.width - cornerRadius, 0);
    context.quadraticCurveTo(canvas.width, 0, canvas.width, cornerRadius);
    context.lineTo(canvas.width, canvas.height - cornerRadius);
    context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - cornerRadius, canvas.height);
    context.lineTo(cornerRadius, canvas.height);
    context.quadraticCurveTo(0, canvas.height, 0, canvas.height - cornerRadius);
    context.lineTo(0, cornerRadius);
    context.quadraticCurveTo(0, 0, cornerRadius, 0);
    context.closePath();
    context.fill();

    // Text
    context.fillStyle = `rgba(${textColor.r}, ${textColor.g}, ${textColor.b}, ${textColor.a})`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(message, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Scale sprite to a reasonable size in the scene
    sprite.scale.set(canvas.width / 150, canvas.height / 150, 1.0);

    return sprite;
}

// NameTag is a THREE.Object3D that contains the text sprite.
export class NameTag extends THREE.Object3D {
  constructor(text: string) {
    super();

    const sprite = makeTextSprite(text);
    if (sprite) {
        this.add(sprite);
    }
  }
}
