import { describe, expect, test } from 'bun:test';
import { honeyState } from './state';
import { resolve } from 'node:path';

describe('Honey balance presentation', () => {
  test('empty, partial, full and overflow retain the real balance', () => {
    expect(honeyState(0).ratio).toBe(0);
    expect(honeyState(45).ratio).toBe(0.45);
    expect(honeyState(100).ratio).toBe(1);
    expect(honeyState(145)).toEqual({ amount: 100, ratio: 1, label: '145 Honey, vessel full with 45 Honey in overflow' });
  });
  test('invalid balances cannot corrupt mesh transforms', () => {
    for (const value of [-1, NaN, Infinity]) expect(honeyState(value).ratio).toBe(0);
  });
  test('exported GLB exposes separate, bottom-anchored honey meshes', async () => {
    const bytes = await Bun.file(resolve(import.meta.dir, '../../../assets/hive-3d/hive.glb')).arrayBuffer();
    const view = new DataView(bytes);
    expect(view.getUint32(0, true)).toBe(0x46546c67);
    const document = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + view.getUint32(12, true))));
    const fill = document.nodes.find((node: { name: string }) => node.name === 'Honey_Fill');
    const surface = document.nodes.find((node: { name: string }) => node.name === 'Honey_Surface');
    expect(fill.translation[1]).toBeCloseTo(0.7);
    expect(fill.extras.fillHeight).toBe(2.1);
    expect(surface.translation[1]).toBeCloseTo(2.8);
    expect(document.images).toBeUndefined();
    expect(document.buffers).toHaveLength(1);
    expect(document.buffers[0].uri).toBeUndefined();
  });
});
