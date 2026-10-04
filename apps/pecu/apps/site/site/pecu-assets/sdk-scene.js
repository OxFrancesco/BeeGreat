const script = document.querySelector('script[data-scene]');
const start = () => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData) return;
  const scene = script?.dataset.scene;
  if (scene) import(scene).catch(() => {});
};
if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
