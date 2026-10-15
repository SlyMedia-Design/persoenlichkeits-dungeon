import Phaser from 'phaser';
import { elementLooks, t } from '../content';
import { pixelTexture } from './sprites';

/** Kantenlänge der Element-Icons in Pixeln */
export const ELEMENT_ICON_SIZE = 16;

/** 16×16-Icon eines Elements (aus data/elements.json) */
export function elementTexture(scene: Phaser.Scene, element: string): string {
  return pixelTexture(scene, `element-${element}`, elementLooks.icons[element]);
}

export function elementName(element: string): string {
  return t(`elements.${element}`);
}

export function elementColor(element: string): string {
  return elementLooks.colors[element];
}
