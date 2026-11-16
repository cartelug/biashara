// Motion tokens (MOTION.md section 2), mirrored from 00-tokens.css. Nothing else invents a duration or a curve.
export const D = { quick: 0.24, base: 0.64, slow: 1.1 };
export const STAGGER = 0.06;
// GSAP's built-in curves that match the CSS tokens: expo.out ≈ cubic-bezier(.16, 1, .3, 1) (--ease-out),
// power3.inOut ≈ cubic-bezier(.65, .05, .36, 1) (--ease-thread). Using them saves loading CustomEase.
export const E = { out: 'expo.out', thread: 'power3.inOut' };
